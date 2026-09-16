/**
 * Magic-link tokens: single-use, short-lived, and stored hashed — a database
 * leak must not hand out a working login link. Email delivery does not exist
 * yet (docs/TASKS.md, "Magic-link auth"): the raw link is handed back to the
 * caller and logged server-side instead of going out over email, which is
 * the accepted stand-in for the ~5 accounts this serves today. Remove that
 * once a real provider is wired up — see the route that calls this.
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
