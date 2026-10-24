import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAdminToken } from '@/lib/auth';

const query = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: query } }));
import { GET } from '@/app/api/subscribe/summary/route';

beforeEach(() => {
  vi.stubEnv('ADMIN_USERNAME', 'summary-test'); vi.stubEnv('ADMIN_PASSWORD', 'summary-test-password');
  vi.stubEnv('ADMIN_SESSION_SECRET', 'summary-test-session-secret'); query.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
const request = () => new NextRequest('https://example.test/api/subscribe/summary', { headers: { cookie: `admin_token=${generateAdminToken()}` } });
const columns = ['id', 'email', 'name', 'novelId', 'active', 'createdAt', 'sourceChapter', 'lastNotifiedAt', 'unsubscribeToken'].map((column_name) => ({ column_name }));
const empty = { total: 0, owner: 0, active: 0, external: 0, externalActive: 0, externalInactive: 0 };

describe('private production subscriber summary', () => {
  it('rejects anonymous requests before accessing the database', async () => {
    expect((await GET(new NextRequest('https://example.test/api/subscribe/summary'))).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });
  it('reports a confirmed empty list separately from schema readiness', async () => {
    query.mockResolvedValueOnce([empty]).mockResolvedValueOnce(columns.slice(0, 6));
    const response = await GET(request()); const result = await response.json();
    expect(result.data).toMatchObject({ ...empty, schemaReady: false,
      missingColumns: ['sourceChapter', 'lastNotifiedAt', 'unsubscribeToken'] });
    expect(response.headers.get('cache-control')).toBe('no-store');
    const sql = query.mock.calls.map(([parts]) => parts.join('')).join('\n');
    expect(sql).not.toContain('SELECT *'); expect(sql).not.toContain('INSERT'); expect(sql).not.toContain('UPDATE');
  });
  it('returns only aggregate counts, never the private subscriber records', async () => {
    const counts = { total: 4, owner: 1, active: 3, external: 3, externalActive: 2, externalInactive: 1 };
    query.mockResolvedValueOnce([counts]).mockResolvedValueOnce(columns);
    const result = await (await GET(request())).json();
    expect(result.data).toMatchObject({ ...counts, schemaReady: true, missingColumns: [] });
    expect(Object.keys(result.data).sort()).toEqual([...Object.keys(counts), 'checkedAt', 'missingColumns', 'schemaReady'].sort());
  });
  it('never treats a database failure as zero subscribers', async () => {
    query.mockRejectedValueOnce(new Error('private database details'));
    const response = await GET(request()); expect(response.status).toBe(503);
    const result = await response.json(); expect(result.ok).toBe(false); expect(result.data).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('private database details');
  });
});
