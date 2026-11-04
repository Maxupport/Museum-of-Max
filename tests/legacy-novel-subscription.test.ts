import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ queue: vi.fn(), kick: vi.fn(), db: { $transaction: vi.fn(),
  subscriber: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() }, novel: { findUnique: vi.fn() } } }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.db }));
vi.mock('@/lib/newsletter-queue', () => ({ queueSubscriber: mocks.queue }));
vi.mock('@/lib/newsletter-kick', () => ({ kickNewsletterQueue: mocks.kick }));
import { POST } from '@/app/api/subscribe/route';
const title = '她沒有說好的那一夜';
function req(novelId?: string, novelTitle = title) {
  return new NextRequest('https://museum.test/api/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'new-reader@example.test', novelId, novelTitle }) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation(async f => f(mocks.db));
  mocks.db.subscriber.findUnique.mockResolvedValue(null);
  mocks.db.subscriber.create.mockResolvedValue({ id: 'reader-1' });
  mocks.db.novel.findUnique.mockImplementation(async ({ where }) => where.id === 'night-id' || where.title === title ? { id: 'night-id', title } : null);
});
describe('subscriptions from legacy novel title URLs', () => {
  it.each(['night-id', title, encodeURIComponent(title)])('stores the canonical ID for %s and queues one welcome', async alias => {
    const r = await POST(req(alias));
    expect(r.status).toBe(200);
    expect(mocks.db.subscriber.create).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({ novelId: 'night-id', active: true }) });
    expect(mocks.queue).toHaveBeenCalledExactlyOnceWith(mocks.db, 'reader-1', true, title);
    expect(mocks.kick).toHaveBeenCalledTimes(1);
  });
  it.each(['unknown-work', '%E0%A4%A'])('rejects unknown or malformed aliases without changing scope or sending: %s', async alias => {
    expect((await POST(req(alias))).status).toBe(400);
    expect(mocks.db.subscriber.create).not.toHaveBeenCalled(); expect(mocks.queue).not.toHaveBeenCalled();
  });
  it('does not use the display title to override an invalid requested work', async () => {
    expect((await POST(req('unknown-work', title))).status).toBe(400);
    expect(mocks.db.subscriber.create).not.toHaveBeenCalled();
  });
  it.each(['all', undefined])('keeps all-novel subscriptions working: %s', async scope => {
    expect((await POST(req(scope))).status).toBe(200);
    expect(mocks.db.subscriber.create).toHaveBeenCalledWith({ data: expect.objectContaining({ novelId: 'all' }) });
    expect(mocks.db.novel.findUnique).not.toHaveBeenCalled();
  });
  it('keeps an existing all-novel subscription and opt-out unchanged on a legacy-page resubmission', async () => {
    mocks.db.subscriber.findUnique.mockResolvedValue({ id: 'existing', active: false, novelId: 'all' });
    expect((await POST(req(encodeURIComponent(title)))).status).toBe(200);
    expect(mocks.db.subscriber.create).not.toHaveBeenCalled(); expect(mocks.db.subscriber.update).not.toHaveBeenCalled();
    expect(mocks.db.novel.findUnique).not.toHaveBeenCalled(); expect(mocks.queue).not.toHaveBeenCalled(); expect(mocks.kick).not.toHaveBeenCalled();
  });
});
