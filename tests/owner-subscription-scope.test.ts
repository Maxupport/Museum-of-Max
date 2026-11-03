import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { generateAdminToken } from '@/lib/auth';
const mocks = vi.hoisted(() => ({ queue: vi.fn(), db: { $transaction: vi.fn(), $queryRaw: vi.fn(),
  subscriber: { findUnique: vi.fn(), update: vi.fn() }, siteSetting: { upsert: vi.fn() } } }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.db }));
vi.mock('@/lib/newsletter-queue', () => ({ queueSubscriber: mocks.queue }));
import { PATCH } from '@/app/api/subscribe/[id]/route';
const before = { id: 'owner', email: 'maxupport@gmail.com', novelId: 'legacy-title', active: true, unsubscribeToken: 'retained-token', lastNotifiedAt: null };
function req(overrides = {}, authenticated = true) {
  return new NextRequest('https://museum.test/api/subscribe/owner', { method: 'PATCH', headers: {
    'content-type': 'application/json', ...(authenticated ? { cookie: `admin_token=${generateAdminToken()}` } : {}) },
    body: JSON.stringify({ confirmation: 'subscribe-owner-to-all-novels', novelId: 'all', expectedNovelId: 'legacy-title', ...overrides }) });
}
const params = { params: Promise.resolve({ id: 'owner' }) };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('ADMIN_USERNAME', 'test'); vi.stubEnv('ADMIN_PASSWORD', 'safe-password');
  mocks.db.$transaction.mockImplementation(async f => f(mocks.db));
  mocks.db.subscriber.findUnique.mockResolvedValue({ ...before }); mocks.queue.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
describe('owner explicitly opts into all novels', () => {
  it('updates scope only, backs up the prior record and queues sync without a welcome or update email', async () => {
    const r = await PATCH(req(), params);
    expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(await r.json()).toMatchObject({ data: { updated: true, novelId: 'all', active: true, notified: false } });
    expect(mocks.db.subscriber.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 'owner' }, data: { novelId: 'all' } });
    expect(mocks.db.siteSetting.upsert.mock.calls[0][0].create.value).toBe(JSON.stringify(before));
    expect(mocks.queue).toHaveBeenCalledExactlyOnceWith(mocks.db, 'owner');
  });
  it('is idempotent when already subscribed to all', async () => {
    mocks.db.subscriber.findUnique.mockResolvedValue({ ...before, novelId: 'all' });
    expect(await (await PATCH(req(), params)).json()).toMatchObject({ data: { updated: false } });
    expect(mocks.queue).not.toHaveBeenCalled(); expect(mocks.db.subscriber.update).not.toHaveBeenCalled();
  });
  it.each([{ email: 'someone@example.com' }, { active: false }, { novelId: 'concurrent-change' }])('rejects other readers, opt-outs and changed preferences: %j', async changes => {
    mocks.db.subscriber.findUnique.mockResolvedValue({ ...before, ...changes });
    expect((await PATCH(req(), params)).status).toBe(409);
    expect(mocks.db.subscriber.update).not.toHaveBeenCalled(); expect(mocks.queue).not.toHaveBeenCalled();
  });
  it('rejects anonymous or unconfirmed requests without reading private records', async () => {
    expect((await PATCH(req({}, false), params)).status).toBe(401);
    expect((await PATCH(req({ confirmation: '' }), params)).status).toBe(400);
    expect((await PATCH(req({ novelId: 'other-book' }), params)).status).toBe(400);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});
