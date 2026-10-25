import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { newsletterConfig, serviceSignature, verifyWorkerRequest, isOwnerTestAddress } from '@/lib/newsletter-config';
import { generateAdminToken } from '@/lib/auth';

const mocks = vi.hoisted(() => ({
  records: new Map<string, string>(), readers: new Map<string, { id: string; email: string; active: boolean; novelId: string; unsubscribeToken: string; createdAt: Date; lastNotifiedAt: Date | null }>(),
  bridge: vi.fn(), prepare: vi.fn(),
  db: {
    $transaction: vi.fn(), $queryRaw: vi.fn(),
    siteSetting: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    subscriber: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    novel: { findUnique: vi.fn(), upsert: vi.fn() },
    writingsItem: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.db }));
vi.mock('@/lib/newsletter-config', async (original) => ({ ...await original<typeof import('@/lib/newsletter-config')>(), callGoogleBridge: mocks.bridge }));
vi.mock('@/lib/email', () => ({ sendWelcomeEmail: mocks.prepare, sendChapterUpdateEmail: mocks.prepare }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-23T01:00:00Z'));
  vi.stubEnv('ADMIN_USERNAME', 'test'); vi.stubEnv('ADMIN_PASSWORD', 'test-only-password');
  vi.stubEnv('GOOGLE_NEWSLETTER_WEBHOOK_URL', 'https://script.google.com/macros/s/test-only/exec');
  vi.stubEnv('GOOGLE_NEWSLETTER_SECRET', 'test-only-secret-at-least-32-characters');
  vi.stubEnv('NEWSLETTER_ENABLED', 'true'); vi.stubEnv('NEWSLETTER_SHEETS_SYNC_ENABLED', 'true'); vi.stubEnv('NEWSLETTER_TEST_ONLY', 'false');
  vi.stubEnv('NEWSLETTER_AUTO_UPDATES', 'false');
  mocks.records.clear(); mocks.readers.clear();
  mocks.bridge.mockReset().mockImplementation(async (payload) => ({ ok: true, status: payload.operation === 'sync' ? 'synced' : 'sent' }));
  mocks.prepare.mockReset().mockResolvedValue({ ok: true, message: { subject: '更新進度', html: '<p>測試通知</p>' } });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('<html>chapter-1 chapter-2</html>', { headers: { 'Content-Type': 'text/html' } })));
  mocks.db.siteSetting.findMany.mockImplementation(async ({ where }) => [...mocks.records].filter(([key]) => key.startsWith(where.key.startsWith)).map(([key, value]) => ({ key, value })));
  mocks.db.siteSetting.findUnique.mockImplementation(async ({ where }) => mocks.records.has(where.key) ? { key: where.key, value: mocks.records.get(where.key) } : null);
  mocks.db.siteSetting.create.mockImplementation(async ({ data }) => {
    if (mocks.records.has(data.key)) throw { code: 'P2002' };
    mocks.records.set(data.key, data.value); return data;
  });
  mocks.db.siteSetting.upsert.mockImplementation(async ({ where, create, update }) => {
    const value = mocks.records.has(where.key) ? update.value ?? mocks.records.get(where.key)! : create.value;
    mocks.records.set(where.key, value); return { key: where.key, value };
  });
  mocks.db.siteSetting.updateMany.mockImplementation(async ({ where, data }) => {
    if (mocks.records.get(where.key) !== where.value) return { count: 0 };
    mocks.records.set(where.key, data.value); return { count: 1 };
  });
  mocks.db.subscriber.findMany.mockImplementation(async ({ where }) => [...mocks.readers.values()].filter((reader) =>
    (!where?.active || reader.active) && (!where?.novelId || where.novelId.in.includes(reader.novelId))));
  mocks.db.subscriber.findUnique.mockImplementation(async ({ where }) => mocks.readers.get(where.id) || null);
  mocks.db.subscriber.count.mockImplementation(async (args) => [...mocks.readers.values()].filter((reader) =>
    (!args?.where?.active || reader.active) && (!args?.where?.createdAt || (reader.createdAt >= args.where.createdAt.gte && reader.createdAt < args.where.createdAt.lt))).length);
  mocks.db.subscriber.update.mockImplementation(async ({ where, data }) => {
    const reader = mocks.readers.get(where.id); if (!reader) throw new Error('Missing reader');
    Object.assign(reader, data); return reader;
  });
  mocks.db.novel.findUnique.mockResolvedValue({ title: '測試作品' });
  mocks.db.novel.upsert.mockResolvedValue({ id: 'book-1', title: '測試作品' });
  mocks.db.writingsItem.findUnique.mockResolvedValue({ id: 'chapter-1', category: '小說', topic: '測試作品', isHidden: false });
  mocks.db.writingsItem.findMany.mockResolvedValue([{ id: 'chapter-1', title: '第一章' }, { id: 'chapter-2', title: '第二章' }]);
  let tail = Promise.resolve();
  mocks.db.$transaction.mockImplementation(async (operation) => {
    const previous = tail; let release!: () => void;
    tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const snapshot = new Map(mocks.records);
    try { return await operation(mocks.db); }
    catch (error) { mocks.records.clear(); snapshot.forEach((value, key) => mocks.records.set(key, value)); throw error; }
    finally { release(); }
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function readers(count: number, novelId = 'all') {
  for (let index = 0; index < count; index++) {
    const id = `reader-${index}`;
    mocks.readers.set(id, { id, email: `${id}@example.test`, novelId, active: true, unsubscribeToken: `private-${id}`, createdAt: new Date(), lastNotifiedAt: null });
  }
}
const campaign = { novelTitle: '測試作品', chapterTitle: '本次更新至第四章', summary: '第二至四章已上線' };
function jobs() { return [...mocks.records].filter(([key]) => key.startsWith('newsletter:v1:job:')).map(([, value]) => JSON.parse(value)); }

describe('durable newsletter outbox', () => {
  it('initializes owner reports without backfilling or sending an old report', async () => {
    readers(2); const { queueDailyOwnerDigest } = await import('@/lib/newsletter-queue');
    expect(await queueDailyOwnerDigest()).toMatchObject({ reason: 'initialized-no-backfill' });
    expect(await queueDailyOwnerDigest()).toMatchObject({ reason: 'not-due' });
    expect(jobs()).toHaveLength(0); expect(mocks.bridge).not.toHaveBeenCalled();
  });
  it('queues one prior-day report after Taipei 00:05 and sends only to the owner with the Sheet link', async () => {
    readers(2); const { queueDailyOwnerDigest, processNewsletterQueue } = await import('@/lib/newsletter-queue');
    await queueDailyOwnerDigest();
    vi.setSystemTime(new Date('2026-10-23T16:04:59Z'));
    expect((await queueDailyOwnerDigest()).queued).toBe(false);
    vi.setSystemTime(new Date('2026-10-23T16:05:00Z'));
    await Promise.all([queueDailyOwnerDigest(), queueDailyOwnerDigest()]);
    expect(jobs()).toHaveLength(1); expect(jobs()[0].digest).toEqual({ date: '2026-10-23', newSubscribers: 2, activeSubscribers: 2, totalSubscribers: 2 });
    expect(await processNewsletterQueue()).toMatchObject({ sent: 1 });
    const message = mocks.bridge.mock.calls[0][0];
    expect(message.to).toBe('maxupport@gmail.com'); expect(message.subject).toContain('2026-10-23 新增 2 人');
    expect(message.html).toContain('https://docs.google.com/spreadsheets/d/'); expect(message.html).not.toContain('reader-0@example.test');
    await queueDailyOwnerDigest(); await processNewsletterQueue(); expect(mocks.bridge).toHaveBeenCalledTimes(1);
  });
  it('does not send an owner report when yesterday had no new registrations', async () => {
    const { queueDailyOwnerDigest, processNewsletterQueue } = await import('@/lib/newsletter-queue');
    await queueDailyOwnerDigest(); vi.setSystemTime(new Date('2026-10-23T16:05:00Z'));
    expect(await queueDailyOwnerDigest()).toMatchObject({ reason: 'no-new-subscribers' });
    expect(jobs()).toHaveLength(0); await processNewsletterQueue(); expect(mocks.bridge).not.toHaveBeenCalled();
  });
  it('counts the complete prior day with an inclusive start and exclusive end', async () => {
    readers(3); const { queueDailyOwnerDigest } = await import('@/lib/newsletter-queue');
    mocks.readers.get('reader-0')!.createdAt = new Date('2026-10-22T16:00:00Z');
    mocks.readers.get('reader-1')!.createdAt = new Date('2026-10-23T15:59:59Z');
    mocks.readers.get('reader-2')!.createdAt = new Date('2026-10-23T16:00:00Z');
    await queueDailyOwnerDigest(); vi.setSystemTime(new Date('2026-10-23T16:05:00Z')); await queueDailyOwnerDigest();
    expect(jobs()[0].digest).toEqual({ date: '2026-10-23', newSubscribers: 2, activeSubscribers: 3, totalSubscribers: 3 });
  });
  it('keeps the owner report pending when the shared rolling 80-attempt quota is full', async () => {
    readers(1); const { queueDailyOwnerDigest, processNewsletterQueue } = await import('@/lib/newsletter-queue');
    await queueDailyOwnerDigest(); vi.setSystemTime(new Date('2026-10-23T16:05:00Z')); await queueDailyOwnerDigest();
    for (let i = 0; i < 80; i++) mocks.records.set(`newsletter:v1:quota:${i}`, String(Date.now()));
    await processNewsletterQueue(); expect(mocks.bridge).not.toHaveBeenCalled(); expect(jobs()[0].state).toBe('pending');
  });
  it('never automatically resends an ambiguous owner report', async () => {
    readers(1); const { queueDailyOwnerDigest, processNewsletterQueue } = await import('@/lib/newsletter-queue');
    await queueDailyOwnerDigest(); vi.setSystemTime(new Date('2026-10-23T16:05:00Z')); await queueDailyOwnerDigest();
    mocks.bridge.mockRejectedValue(new Error('timeout'));
    expect(await processNewsletterQueue()).toMatchObject({ uncertain: 1 });
    await queueDailyOwnerDigest(); await processNewsletterQueue(); expect(mocks.bridge).toHaveBeenCalledTimes(1);
  });
  it('queues one recipient per update, deduplicates retries and rejects changed content under the same id', async () => {
    readers(3); const { queueCampaign } = await import('@/lib/newsletter-queue');
    expect(await queueCampaign(campaign, 'update-1')).toMatchObject({ queuedCount: 3, duplicate: false });
    expect(await queueCampaign(campaign, 'update-1')).toMatchObject({ queuedCount: 0, duplicate: true });
    await expect(queueCampaign({ ...campaign, summary: '不同內容' }, 'update-1')).rejects.toThrow('EVENT_CONFLICT');
    expect(jobs()).toHaveLength(3); expect(mocks.bridge).not.toHaveBeenCalled();
    expect(JSON.stringify([...mocks.records])).not.toContain('private-reader-');
  });
  it('includes all-book readers, excludes inactive/unrelated readers and rolls back a campaign without recipients', async () => {
    readers(3, 'book-1'); mocks.readers.get('reader-1')!.active = false; mocks.readers.get('reader-2')!.novelId = 'book-2';
    mocks.readers.set('all-reader', { ...mocks.readers.get('reader-0')!, id: 'all-reader', novelId: 'all' });
    const { queueCampaign } = await import('@/lib/newsletter-queue');
    expect(await queueCampaign({ ...campaign, novelId: 'book-1' }, 'book-update')).toMatchObject({ queuedCount: 2 });
    mocks.readers.clear();
    await expect(queueCampaign(campaign, 'no-readers')).rejects.toThrow('NO_SUBSCRIBERS');
    expect([...mocks.records.keys()].filter((key) => key.includes(':campaign:'))).toHaveLength(1);
  });
  it('preserves pending jobs across module reloads and does nothing while disabled or unconfigured', async () => {
    readers(2); const queue = await import('@/lib/newsletter-queue');
    await queue.queueCampaign(campaign, 'pending-update');
    vi.stubEnv('NEWSLETTER_ENABLED', 'false');
    await queue.processNewsletterQueue(); expect(mocks.bridge).not.toHaveBeenCalled();
    vi.resetModules(); const reloaded = await import('@/lib/newsletter-queue');
    expect((await reloaded.newsletterStatus()).pending).toBe(2);
    vi.stubEnv('NEWSLETTER_ENABLED', 'true'); vi.stubEnv('GOOGLE_NEWSLETTER_SECRET', '');
    await reloaded.processNewsletterQueue(); expect(mocks.bridge).not.toHaveBeenCalled();
  });
  it('enforces a shared 80-attempt rolling-24-hour budget across concurrent workers', async () => {
    readers(300); const queue = await import('@/lib/newsletter-queue');
    await queue.queueCampaign(campaign, 'large-update');
    await Promise.all([queue.processNewsletterQueue(250), queue.processNewsletterQueue(250)]);
    expect(mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send')).toHaveLength(80);
    expect(await queue.newsletterStatus()).toMatchObject({ usedInLast24Hours: 80, remaining: 0 });
    const ids = mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send').map(([payload]) => payload.jobId);
    expect(new Set(ids).size).toBe(80);
    expect(mocks.db.$queryRaw).toHaveBeenCalled();
    vi.setSystemTime(new Date('2026-10-24T01:00:01Z'));
    await queue.processNewsletterQueue(250);
    expect(mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send')).toHaveLength(160);
  });
  it('shares the same limit across welcome, owner-test and campaign mail', async () => {
    readers(1); const queue = await import('@/lib/newsletter-queue');
    await mocks.db.$transaction(async (tx: Parameters<typeof queue.queueSubscriber>[0]) => queue.queueSubscriber(tx, 'reader-0', true));
    await queue.queueCampaign(campaign, 'owner-test', true); await queue.queueCampaign(campaign, 'one-update');
    await queue.processNewsletterQueue(15);
    expect((await queue.newsletterStatus()).usedInLast24Hours).toBe(3);
    expect(mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send').map(([payload]) => payload.to)).toContain('maxupport@gmail.com');
  });
  it('allows only owner tests in the default test-only mode', async () => {
    readers(2); const queue = await import('@/lib/newsletter-queue');
    vi.stubEnv('NEWSLETTER_TEST_ONLY', 'true');
    await queue.queueCampaign(campaign, 'blocked-real'); await queue.queueCampaign(campaign, 'allowed-test', true);
    await queue.processNewsletterQueue(10);
    expect(mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send')).toHaveLength(1);
    expect((await queue.newsletterStatus()).pending).toBe(2);
  });
  it('permits owner alias signup acceptance tests but canonicalizes delivery to the owner only', async () => {
    readers(2); mocks.readers.get('reader-0')!.email = 'maxupport+newsletter-qa@gmail.com';
    vi.stubEnv('NEWSLETTER_TEST_ONLY', 'true');
    const queue = await import('@/lib/newsletter-queue');
    await mocks.db.$transaction(async (tx: Parameters<typeof queue.queueSubscriber>[0]) => {
      await queue.queueSubscriber(tx, 'reader-0', true); await queue.queueSubscriber(tx, 'reader-1', true);
    });
    await queue.processNewsletterQueue(10);
    const mail = mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send');
    expect(mail).toHaveLength(1); expect(mail[0][0].to).toBe('maxupport@gmail.com');
    expect(jobs().find((job) => job.id === 'welcome:reader-1').state).toBe('pending');
  });
  it('defers mail when the public reading page redirects or is unavailable, without calling the mail provider', async () => {
    readers(1); const queue = await import('@/lib/newsletter-queue');
    await queue.queueCampaign(campaign, 'not-ready');
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 307 }));
    await queue.processNewsletterQueue(10); await queue.processNewsletterQueue(10);
    expect(mocks.bridge).not.toHaveBeenCalled();
    expect(jobs()[0]).toMatchObject({ state: 'pending', notBefore: expect.any(Number) });
  });
  it('links update notifications to the stable chapter id and checks that chapter is publicly rendered', async () => {
    readers(1); const queue = await import('@/lib/newsletter-queue');
    await queue.queuePublishedUpdate('book-1', ['chapter-2'], 'deep-link-test');
    await queue.processNewsletterQueue(10);
    expect(mocks.prepare).toHaveBeenCalledWith(expect.objectContaining({ chapterUrl: expect.stringContaining('?chapterId=chapter-2') }), true);
    expect(mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send')).toHaveLength(1);
  });
  it('rechecks opt-outs and deletions, does not send them mail, and keeps the mirror informed', async () => {
    readers(2); const queue = await import('@/lib/newsletter-queue');
    await queue.queueCampaign(campaign, 'revoke-update');
    mocks.readers.get('reader-0')!.active = false; mocks.readers.delete('reader-1');
    await mocks.db.$transaction(async (tx: Parameters<typeof queue.queueSubscriber>[0]) => queue.queueSubscriber(tx, 'reader-1'));
    await queue.processNewsletterQueue(10);
    expect(mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send')).toHaveLength(0);
    expect(mocks.bridge).toHaveBeenCalledWith(expect.objectContaining({ operation: 'sync', subscriber: { id: 'reader-1', active: false, deleted: true } }));
    expect(jobs().filter((job) => job.state === 'canceled')).toHaveLength(2);
  });
  it('quarantines timeouts and stale claims rather than automatically resending', async () => {
    readers(2); const queue = await import('@/lib/newsletter-queue');
    await queue.queueCampaign(campaign, 'uncertain-update');
    mocks.bridge.mockRejectedValueOnce(new Error('timeout'));
    await queue.processNewsletterQueue();
    expect(jobs().filter((job) => job.state === 'uncertain')).toHaveLength(1);
    await queue.processNewsletterQueue(10);
    expect(mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send')).toHaveLength(2);
    const sentJob = jobs().find((job) => job.kind === 'update' && job.state === 'sent');
    sentJob.state = 'processing'; sentJob.reservedAt = Date.now() - 180000;
    mocks.records.set('newsletter:v1:job:' + sentJob.id, JSON.stringify(sentJob));
    await queue.processNewsletterQueue(10);
    expect(jobs().filter((job) => job.state === 'uncertain')).toHaveLength(2);
  });
  it('does not clobber a newer sync revision completed during a network call', async () => {
    readers(1); const queue = await import('@/lib/newsletter-queue');
    await mocks.db.$transaction(async (tx: Parameters<typeof queue.queueSubscriber>[0]) => queue.queueSubscriber(tx, 'reader-0'));
    mocks.bridge.mockImplementationOnce(async () => {
      vi.setSystemTime(new Date(Date.now() + 1000));
      await mocks.db.$transaction(async (tx: Parameters<typeof queue.queueSubscriber>[0]) => queue.queueSubscriber(tx, 'reader-0'));
      return { ok: true, status: 'synced' };
    });
    await queue.processNewsletterQueue(1);
    expect(jobs().find((job) => job.kind === 'sync').state).toBe('pending');
  });
  it('keeps success terminal when ancillary subscriber reporting fails', async () => {
    readers(1); const queue = await import('@/lib/newsletter-queue');
    await queue.queueCampaign(campaign, 'reporting-failure');
    mocks.db.subscriber.update.mockRejectedValueOnce(new Error('DB failure'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await queue.processNewsletterQueue(10); await queue.processNewsletterQueue(10);
    expect(jobs().find((job) => job.kind === 'update').state).toBe('sent');
    expect(mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send')).toHaveLength(1);
  });
  it('cancels pending campaign mail without touching completed mail or other campaigns', async () => {
    readers(2); const queue = await import('@/lib/newsletter-queue');
    const first = await queue.queueCampaign(campaign, 'cancel-first');
    await queue.queueCampaign(campaign, 'keep-second');
    expect(await queue.cancelCampaign(first.campaignId)).toBe(2);
    await queue.processNewsletterQueue(15);
    expect(mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send')).toHaveLength(2);
  });
  it('builds a single progress notification for a public chapter batch and refuses hidden/missing ids', async () => {
    readers(2); const queue = await import('@/lib/newsletter-queue');
    expect(await queue.queuePublishedUpdate('book-1', ['chapter-1', 'chapter-2'], 'published-batch')).toMatchObject({ queuedCount: 2 });
    const stored = [...mocks.records].find(([key]) => key.includes(':campaign:'))![1];
    expect(stored).toContain('本次更新 2 章'); expect(stored).toContain('目前已公開 2 章');
    await expect(queue.queuePublishedUpdate('book-1', ['hidden-chapter'], 'hidden-batch')).rejects.toThrow('INVALID_PUBLICATION');
    expect(mocks.db.writingsItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { category: '小說', topic: '測試作品', isHidden: false } }));
  });
  it('captures publication events once, keeps them paused by default, and only sends after both switches are enabled', async () => {
    readers(2); const queue = await import('@/lib/newsletter-queue');
    await mocks.db.$transaction(async (tx: Parameters<typeof queue.queuePublication>[0]) => {
      await queue.queuePublication(tx, 'chapter-1'); await queue.queuePublication(tx, 'chapter-1');
    });
    expect(jobs()).toHaveLength(1);
    await queue.processNewsletterQueue(15); expect(mocks.bridge).not.toHaveBeenCalled();
    vi.stubEnv('NEWSLETTER_AUTO_UPDATES', 'true');
    await queue.processNewsletterQueue(15);
    expect(mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send')).toHaveLength(2);
  });
  it.each([404, 503])('defers an illustrated update when its protected image returns %s, even with reader HTML 200', async (status) => {
    readers(1); const queue = await import('@/lib/newsletter-queue');
    mocks.db.writingsItem.findMany.mockResolvedValue([{ id: 'chapter-1', title: '第一章',
      content: JSON.stringify({ textContent: '正文', illustration: true }) }]);
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).includes('/api/novel-illustrations/')
      ? new Response(null, { status }) : new Response('<html>chapter-1</html>', { headers: { 'Content-Type': 'text/html' } })));
    await queue.queuePublishedUpdate('book-1', ['chapter-1'], 'image-not-ready');
    await queue.processNewsletterQueue(15);
    expect(mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send')).toHaveLength(0);
    expect(jobs().find((job) => job.kind === 'update')).toMatchObject({ state: 'pending', notBefore: expect.any(Number) });
  });
  it('sends an illustrated update only after both public page and protected image are ready', async () => {
    readers(1); const queue = await import('@/lib/newsletter-queue');
    mocks.db.writingsItem.findMany.mockResolvedValue([{ id: 'chapter-1', title: '第一章',
      content: JSON.stringify({ textContent: '正文', illustration: true }) }]);
    const fetcher = vi.fn(async (url) => String(url).includes('/api/novel-illustrations/')
      ? new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } })
      : new Response('<html>chapter-1</html>', { headers: { 'Content-Type': 'text/html' } }));
    vi.stubGlobal('fetch', fetcher);
    await queue.queuePublishedUpdate('book-1', ['chapter-1'], 'image-ready');
    await queue.processNewsletterQueue(15);
    expect(mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send')).toHaveLength(1);
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/api/novel-illustrations/chapter-1'))).toBe(true);
  });
  it('does not announce a chapter hidden again before its publication event runs', async () => {
    readers(1); const queue = await import('@/lib/newsletter-queue');
    await mocks.db.$transaction(async (tx: Parameters<typeof queue.queuePublication>[0]) => queue.queuePublication(tx, 'chapter-1'));
    mocks.db.writingsItem.findUnique.mockResolvedValueOnce({ id: 'chapter-1', category: '小說', topic: '測試作品', isHidden: true });
    vi.stubEnv('NEWSLETTER_AUTO_UPDATES', 'true');
    await queue.processNewsletterQueue(15); expect(mocks.bridge).not.toHaveBeenCalled();
    expect(jobs()[0].state).toBe('canceled');
  });
  it('delivers one progress email per reader for an atomic prologue/chapter release, without retry duplication', async () => {
    readers(2); const queue = await import('@/lib/newsletter-queue');
    await mocks.db.$transaction(async (tx: Parameters<typeof queue.queuePublication>[0]) => {
      await queue.queuePublicationBatch(tx, 'book-1', ['chapter-1', 'chapter-2'], 'first-release');
      await queue.queuePublicationBatch(tx, 'book-1', ['chapter-1', 'chapter-2'], 'first-release');
    });
    expect(jobs()).toHaveLength(1);
    vi.stubEnv('NEWSLETTER_AUTO_UPDATES', 'true');
    await queue.processNewsletterQueue(15); await queue.processNewsletterQueue(15);
    expect(mocks.bridge.mock.calls.filter(([payload]) => payload.operation === 'send')).toHaveLength(2);
    const stored = [...mocks.records].find(([key]) => key.includes(':campaign:'))![1];
    expect(stored).toContain('本次更新 2 章');
  });
  it('cancels a batch with missing or hidden content instead of sending an incomplete update', async () => {
    readers(1); const queue = await import('@/lib/newsletter-queue');
    await mocks.db.$transaction(async (tx: Parameters<typeof queue.queuePublication>[0]) =>
      queue.queuePublicationBatch(tx, 'book-1', ['chapter-1', 'hidden-chapter'], 'invalid-release'));
    vi.stubEnv('NEWSLETTER_AUTO_UPDATES', 'true');
    await queue.processNewsletterQueue(15);
    expect(jobs()[0].state).toBe('canceled'); expect(mocks.bridge).not.toHaveBeenCalled();
  });
});

describe('newsletter configuration and service boundary', () => {
  it('recognizes only genuine owner mailbox aliases in owner-only acceptance mode', () => {
    expect(isOwnerTestAddress('Max.upport+qa@GMAIL.com')).toBe(true);
    expect(isOwnerTestAddress('maxupport@googlemail.com')).toBe(true);
    expect(isOwnerTestAddress('maxupport@gmail.com.attacker.test')).toBe(false);
    expect(isOwnerTestAddress('maxupport@attacker.test')).toBe(false);
    expect(isOwnerTestAddress('other+maxupport@gmail.com')).toBe(false);
  });
  it('rejects arbitrary webhook hosts and short secrets', () => {
    vi.stubEnv('GOOGLE_NEWSLETTER_WEBHOOK_URL', 'https://attacker.test/macros/s/test/exec'); expect(newsletterConfig().configured).toBe(false);
    vi.stubEnv('GOOGLE_NEWSLETTER_WEBHOOK_URL', 'https://script.google.com/macros/s/test/exec?secret=bad'); expect(newsletterConfig().configured).toBe(false);
    vi.stubEnv('GOOGLE_NEWSLETTER_WEBHOOK_URL', 'https://script.google.com/macros/s/test/exec');
    vi.stubEnv('GOOGLE_NEWSLETTER_SECRET', 'short'); expect(newsletterConfig().configured).toBe(false);
  });
  it('authenticates exact bodies, rejects expired signatures and separates bridge and worker purposes', () => {
    const time = String(Math.floor(Date.now() / 1000));
    const headers = new Headers({ 'x-newsletter-time': time, 'x-newsletter-signature': serviceSignature('{}', time, 'worker') });
    expect(verifyWorkerRequest('{}', headers)).toBe(true); expect(verifyWorkerRequest('{"override":true}', headers)).toBe(false);
    headers.set('x-newsletter-signature', serviceSignature('{}', time, 'bridge')); expect(verifyWorkerRequest('{}', headers)).toBe(false);
    headers.set('x-newsletter-signature', serviceSignature('{}', time, 'worker'));
    vi.setSystemTime(new Date(Date.now() + 61000)); expect(verifyWorkerRequest('{}', headers)).toBe(false);
  });
  it('rejects anonymous worker calls, including forged admin cookies', async () => {
    const { POST } = await import('@/app/api/internal/newsletter-worker/route');
    const response = await POST(new NextRequest('https://museum.test/api/internal/newsletter-worker', { method: 'POST', body: '{}', headers: { cookie: `admin_token=${generateAdminToken()}` } }));
    expect(response.status).toBe(401); expect(mocks.bridge).not.toHaveBeenCalled();
  });
  it('returns only configuration names and aggregate counts, never secrets or reader details', async () => {
    readers(1); const queue = await import('@/lib/newsletter-queue');
    await queue.queueCampaign(campaign, 'status-update');
    const status = JSON.stringify(await queue.newsletterStatus());
    expect(status).not.toContain('test-only-secret'); expect(status).not.toContain('reader-0@example.test'); expect(status).not.toContain('private-reader-0');
  });
});
