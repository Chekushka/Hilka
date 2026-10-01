import { describe, expect, it, vi } from 'vitest';
import { requestRestore } from './restore';

function respond(status: number, body: unknown = {}) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe('requestRestore', () => {
  it('posts the code and returns the saved state', async () => {
    const fetchImpl = respond(200, { state: { completedTaskSlugs: ['g7-a'] } });
    await expect(requestRestore('ABCD-EFGH', fetchImpl)).resolves.toEqual({
      ok: true,
      state: { completedTaskSlugs: ['g7-a'] }
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/progress/restore');
    expect(JSON.parse(init.body as string)).toEqual({ code: 'ABCD-EFGH' });
  });

  it('names each failure', async () => {
    await expect(requestRestore('x', respond(404))).resolves.toEqual({ ok: false, reason: 'not_found' });
    await expect(requestRestore('x', respond(400))).resolves.toEqual({ ok: false, reason: 'invalid' });
    await expect(requestRestore('x', respond(429))).resolves.toEqual({ ok: false, reason: 'rate_limited' });
    await expect(requestRestore('x', respond(500))).resolves.toEqual({ ok: false, reason: 'error' });
    const offline = vi.fn(async () => {
      throw new TypeError('network');
    });
    await expect(requestRestore('x', offline)).resolves.toEqual({ ok: false, reason: 'error' });
  });
});
