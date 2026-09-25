/**
 * Magic-link tokens: single-use, short-lived, and stored hashed — a database
 * leak must not hand out a working login link. The raw token goes back to
 * the caller once, which emails it (app/api/auth/request-link/route.ts).
 */
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { teacherLoginTokens } from '@/lib/db/schema';

const TOKEN_TTL_MS = 15 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueLoginToken(teacherId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await getDb()
    .insert(teacherLoginTokens)
    .values({
      teacherId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS)
    });
  return token;
}

/** Consumes the token if it is valid, unused and unexpired; null otherwise. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: teacherLoginTokens.id, teacherId: teacherLoginTokens.teacherId })
    .from(teacherLoginTokens)
    .where(
      and(
        eq(teacherLoginTokens.tokenHash, hashToken(token)),
        isNull(teacherLoginTokens.usedAt),
        gt(teacherLoginTokens.expiresAt, new Date())
      )
    )
    .limit(1);
  if (!row) return null;

  await db.update(teacherLoginTokens).set({ usedAt: new Date() }).where(eq(teacherLoginTokens.id, row.id));
  return row.teacherId;
}
