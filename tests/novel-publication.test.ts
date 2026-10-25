import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { generateAdminToken } from '@/lib/auth';

const mocks = vi.hoisted(() => ({
  records: new Map<string, string>(),
  chapters: new Map<string, { id: string; category: string; topic: string; content: string; isHidden: boolean }>(),
  queue: vi.fn(), imageReady: vi.fn(),
  db: { $transaction: vi.fn(), $queryRaw: vi.fn(), siteSetting: { findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    novel: { findUnique: vi.fn() }, writingsItem: { findMany: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.db }));
vi.mock('@/lib/newsletter-queue', () => ({ queuePublicationBatch: mocks.queue }));
vi.mock('@/lib/novel-image-readiness', () => ({ preparedIllustrationReady: mocks.imageReady }));
import { chapterHash, publishDueNovelChapters, validatePublicationSlot, novelPublicationStatus, installPublicationSlots, publishNovelPreview, rescheduleNovelDates, type PublicationSlot } from '@/lib/novel-publication';

const prefix = 'novel-publication:v1:slot:';
const now = new Date('2026-11-04T00:30:00.000Z');
function seed(ids = ['chapter-1'], at = now.toISOString()) {
  for (const id of ids) mocks.chapters.set(id, { id, category: '小說', topic: '測試小說', content: `正文 ${id}`, isHidden: true });
  const slot: PublicationSlot = { id: 'release-1', novelId: 'novel-1', chapterIds: ids, publishAt: at,
    state: 'scheduled', contentHashes: Object.fromEntries(ids.map((id) => [id, chapterHash(`正文 ${id}`)])) };
  mocks.records.set(prefix + slot.id, JSON.stringify(slot));
  return slot;
}

beforeEach(() => {
  vi.stubEnv('NOVEL_PUBLICATION_ENABLED', 'true');
  vi.clearAllMocks(); mocks.records.clear(); mocks.chapters.clear();
  mocks.queue.mockResolvedValue(undefined);
  mocks.imageReady.mockResolvedValue(true);
  mocks.db.siteSetting.findMany.mockImplementation(async ({ where }) => [...mocks.records]
    .filter(([key]) => key.startsWith(where.key.startsWith)).map(([key, value]) => ({ key, value })));
  mocks.db.siteSetting.update.mockImplementation(async ({ where, data }) => { mocks.records.set(where.key, data.value); return data; });
  mocks.db.siteSetting.findUnique.mockImplementation(async ({ where }) => mocks.records.has(where.key) ? { key: where.key, value: mocks.records.get(where.key) } : null);
  mocks.db.siteSetting.create.mockImplementation(async ({ data }) => { mocks.records.set(data.key, data.value); return data; });
  mocks.db.novel.findUnique.mockResolvedValue({ id: 'novel-1', title: '測試小說' });
  mocks.db.writingsItem.findMany.mockImplementation(async ({ where }) => [...mocks.chapters.values()]
    .filter((chapter) => where.id.in.includes(chapter.id)).map((chapter) => ({ ...chapter })));
  mocks.db.writingsItem.updateMany.mockImplementation(async ({ where, data }) => {
    const chapter = mocks.chapters.get(where.id);
    if (!chapter || chapter.content !== where.content || chapter.isHidden !== where.isHidden) return { count: 0 };
    Object.assign(chapter, data); return { count: 1 };
  });
  let tail = Promise.resolve();
  mocks.db.$transaction.mockImplementation(async (operation) => {
    const previous = tail; let release!: () => void;
    tail = new Promise<void>((resolve) => { release = resolve; }); await previous;
    const records = new Map(mocks.records);
    const chapters = new Map([...mocks.chapters].map(([id, chapter]) => [id, { ...chapter }]));
    try { return await operation(mocks.db); }
    catch (error) { mocks.records.clear(); records.forEach((value, key) => mocks.records.set(key, value));
      mocks.chapters.clear(); chapters.forEach((value, key) => mocks.chapters.set(key, value)); throw error; }
    finally { release(); }
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('opt-in atomic chapter publication', () => {
  it('rejects anonymous calendar changes', async () => {
    const { PATCH } = await import('@/app/api/novel-publication/schedule/route');
    expect((await PATCH(new NextRequest('https://museum.test/api/novel-publication/schedule', { method: 'PATCH' }))).status).toBe(401);
  });
  it('moves dates atomically without changing content or notifying and deduplicates replay', async () => {
    const slot = seed(['chapter-2'], '2026-11-10T00:30:00.000Z');
    const changes = [{ id: slot.id, from: slot.publishAt, to: '2026-11-03T00:30:00.000Z' }];
    expect(await rescheduleNovelDates(changes, new Date('2026-10-25'))).toEqual({ updated: 1, scheduled: 1, notified: false });
    expect(await rescheduleNovelDates(changes, new Date('2026-10-25'))).toMatchObject({ updated: 0 });
    expect(mocks.chapters.get('chapter-2')?.isHidden).toBe(true); expect(mocks.queue).not.toHaveBeenCalled();
  });
  it('rejects calendar collisions, order reversal, drift and published slots without changes', async () => {
    const slot = seed(['chapter-2'], '2026-11-10T00:30:00.000Z');
    mocks.records.set(prefix + 'later', JSON.stringify({ ...slot, id: 'later', publishAt: '2026-11-17T00:30:00.000Z' }));
    await expect(rescheduleNovelDates([{ id: slot.id, from: slot.publishAt, to: '2026-11-17T00:30:00.000Z' }], new Date('2026-10-25'))).rejects.toThrow('CALENDAR_COLLISION');
    await expect(rescheduleNovelDates([{ id: slot.id, from: slot.publishAt, to: '2026-11-24T00:30:00.000Z' }], new Date('2026-10-25'))).rejects.toThrow('CALENDAR_ORDER_CHANGED');
    await expect(rescheduleNovelDates([{ id: slot.id, from: '2026-11-01T00:30:00.000Z', to: '2026-11-03T00:30:00.000Z' }], new Date('2026-10-25'))).rejects.toThrow('CALENDAR_CHANGED');
    mocks.records.set(prefix + slot.id, JSON.stringify({ ...slot, state: 'published' }));
    await expect(rescheduleNovelDates([{ id: slot.id, from: slot.publishAt, to: '2026-11-03T00:30:00.000Z' }], new Date('2026-10-25'))).rejects.toThrow('CALENDAR_CHANGED');
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it('rejects anonymous preview publication', async () => {
    const { POST } = await import('@/app/api/novel-publication/preview/route');
    expect((await POST(new NextRequest('https://museum.test/api/novel-publication/preview', { method: 'POST' }))).status).toBe(401);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it('publishes the approved first batch as a preview with no mail, and safely deduplicates', async () => {
    const slot = seed(['prologue', 'chapter-1']);
    const early = new Date('2026-10-25');
    expect(await publishNovelPreview(slot.id, slot.contentHashes, early)).toEqual({ published: 2, duplicate: false, notified: false });
    expect(mocks.chapters.get('chapter-1')?.isHidden).toBe(false);
    expect(await publishNovelPreview(slot.id, slot.contentHashes, early)).toEqual({ published: 0, duplicate: true, notified: false });
    expect((await publishDueNovelChapters(now)).published).toBe(0);
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it('rejects a later preview batch, unapproved hashes and unavailable illustrations', async () => {
    const first = seed(['chapter-1']);
    const later = { ...first, id: 'later', publishAt: '2026-11-05T00:30:00.000Z' };
    mocks.records.set(prefix + later.id, JSON.stringify(later));
    await expect(publishNovelPreview(later.id, later.contentHashes, new Date('2026-10-25'))).rejects.toThrow('PREVIEW_MISMATCH');
    await expect(publishNovelPreview(first.id, {}, new Date('2026-10-25'))).rejects.toThrow('PREVIEW_MISMATCH');
    const chapter = mocks.chapters.get('chapter-1')!;
    chapter.content = JSON.stringify({ textContent: 'text', illustration: true });
    first.contentHashes[chapter.id] = chapterHash(chapter.content);
    mocks.records.set(prefix + first.id, JSON.stringify(first));
    mocks.imageReady.mockResolvedValue(false);
    await expect(publishNovelPreview(first.id, first.contentHashes, new Date('2026-10-25'))).rejects.toThrow('PREVIEW_IMAGE_NOT_READY');
    expect(mocks.chapters.get(chapter.id)?.isHidden).toBe(true);
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it('rejects anonymous schedule installation before accessing the database', async () => {
    const { POST } = await import('@/app/api/novel-publication/schedule/route');
    const response = await POST(new NextRequest('https://museum.test/api/novel-publication/schedule', { method: 'POST' }));
    expect(response.status).toBe(401);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it('rolls back the entire installation if a later chapter no longer matches', async () => {
    const slot = seed(); mocks.records.clear(); vi.stubEnv('NOVEL_PUBLICATION_ENABLED', 'false');
    const second = { ...slot, id: 'release-2', chapterIds: ['missing-chapter'], publishAt: '2026-11-05T00:30:00.000Z',
      contentHashes: { 'missing-chapter': chapterHash('missing') } };
    await expect(installPublicationSlots([slot, second], new Date('2026-11-03'))).rejects.toThrow('SLOT_CONTENT_MISMATCH');
    expect(mocks.records.size).toBe(0); expect(mocks.queue).not.toHaveBeenCalled();
  });
  it('installs future hidden slots without publishing or notifying, and deduplicates replay', async () => {
    const slot = seed(); mocks.records.clear(); vi.stubEnv('NOVEL_PUBLICATION_ENABLED', 'false');
    const earlier = new Date('2026-11-03T00:30:00.000Z');
    expect(await installPublicationSlots([slot], earlier)).toEqual({ installed: 1, duplicate: 0, publicationEnabled: false });
    expect(await installPublicationSlots([slot], earlier)).toMatchObject({ installed: 0, duplicate: 1 });
    expect(mocks.queue).not.toHaveBeenCalled(); expect(mocks.chapters.get('chapter-1')?.isHidden).toBe(true);
  });
  it('rejects active publication, past dates and conflicting duplicate chapters', async () => {
    const slot = seed(); mocks.records.clear();
    await expect(installPublicationSlots([slot], now)).rejects.toThrow('PAUSE_PUBLICATION_FIRST');
    vi.stubEnv('NOVEL_PUBLICATION_ENABLED', 'false');
    await expect(installPublicationSlots([slot], now)).rejects.toThrow('INVALID_FUTURE_SLOT');
    await expect(installPublicationSlots([slot, { ...slot, id: 'other' }], new Date('2026-11-03'))).rejects.toThrow('DUPLICATE_SLOT_BATCH');
    expect(mocks.records.size).toBe(0);
  });
  it('does nothing unless separately enabled', async () => {
    seed(); vi.stubEnv('NOVEL_PUBLICATION_ENABLED', 'false');
    expect(await publishDueNovelChapters(now)).toEqual({ enabled: false, published: 0, blocked: 0 });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it('keeps a future chapter private', async () => {
    seed(['chapter-1'], '2026-11-05T00:30:00.000Z');
    expect((await publishDueNovelChapters(now)).published).toBe(0);
    expect(mocks.chapters.get('chapter-1')?.isHidden).toBe(true); expect(mocks.queue).not.toHaveBeenCalled();
  });
  it('publishes a due chapter with a durable event, exactly once', async () => {
    seed(); await Promise.all([publishDueNovelChapters(now), publishDueNovelChapters(now)]);
    expect(mocks.chapters.get('chapter-1')?.isHidden).toBe(false);
    expect(mocks.queue).toHaveBeenCalledExactlyOnceWith(mocks.db, 'novel-1', ['chapter-1'], 'release-1');
    expect(JSON.parse(mocks.records.get(prefix + 'release-1')!).state).toBe('published');
  });
  it('publishes prologue and first chapter atomically with one event', async () => {
    seed(['prologue', 'chapter-1']);
    expect((await publishDueNovelChapters(now)).published).toBe(2);
    expect(mocks.queue).toHaveBeenCalledExactlyOnceWith(mocks.db, 'novel-1', ['prologue', 'chapter-1'], 'release-1');
  });
  it('keeps an illustrated chapter private until the verified storage bytes are ready', async () => {
    const slot = seed(); const chapter = mocks.chapters.get('chapter-1')!;
    chapter.content = JSON.stringify({ textContent: '核准正文', illustration: true });
    slot.contentHashes['chapter-1'] = chapterHash(chapter.content); mocks.records.set(prefix + slot.id, JSON.stringify(slot));
    mocks.imageReady.mockResolvedValueOnce(false);
    expect(await publishDueNovelChapters(now)).toMatchObject({ published: 0, deferred: 1 });
    expect(chapter.isHidden).toBe(true); expect(mocks.queue).not.toHaveBeenCalled();
    expect(JSON.parse(mocks.records.get(prefix + slot.id)!).state).toBe('scheduled');
    expect((await publishDueNovelChapters(now)).published).toBe(1);
  });
  it.each(['edited', 'missing', 'wrong-book', 'already-public'])('blocks unexpected %s content without mail', async (kind) => {
    seed(); const chapter = mocks.chapters.get('chapter-1')!;
    if (kind === 'edited') chapter.content += ' unexpected';
    if (kind === 'missing') mocks.chapters.delete(chapter.id);
    if (kind === 'wrong-book') chapter.topic = '另一部小說';
    if (kind === 'already-public') chapter.isHidden = false;
    expect((await publishDueNovelChapters(now)).blocked).toBe(1);
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it('rolls back publication when durable enqueue fails', async () => {
    seed(['prologue', 'chapter-1']); mocks.queue.mockRejectedValueOnce(new Error('database-failure'));
    await expect(publishDueNovelChapters(now)).rejects.toThrow('database-failure');
    expect([...mocks.chapters.values()].every((chapter) => chapter.isHidden)).toBe(true);
    expect(JSON.parse(mocks.records.get(prefix + 'release-1')!).state).toBe('scheduled');
  });
  it('rejects duplicate chapter IDs and invalid dates', () => {
    const slot = seed();
    expect(() => validatePublicationSlot({ ...slot, chapterIds: ['chapter-1', 'chapter-1'] })).toThrow('INVALID_PUBLICATION_SLOT');
    expect(() => validatePublicationSlot({ ...slot, publishAt: 'tomorrow' })).toThrow('INVALID_PUBLICATION_SLOT');
  });
  it('never jumps over an earlier blocked chapter in the same novel', async () => {
    const slot = seed(); slot.state = 'blocked'; mocks.records.set(prefix + slot.id, JSON.stringify(slot));
    mocks.chapters.set('chapter-2', { id: 'chapter-2', category: '小說', topic: '測試小說', content: '正文 chapter-2', isHidden: true });
    const later: PublicationSlot = { ...slot, id: 'release-2', state: 'scheduled', chapterIds: ['chapter-2'],
      contentHashes: { 'chapter-2': chapterHash('正文 chapter-2') } };
    mocks.records.set(prefix + later.id, JSON.stringify(later));
    expect((await publishDueNovelChapters(now)).published).toBe(0);
    expect(mocks.chapters.get('chapter-2')?.isHidden).toBe(true); expect(mocks.queue).not.toHaveBeenCalled();
  });
  it('reports pending, overdue and invalid records without exposing hashes or credentials', async () => {
    seed(); mocks.records.set(prefix + 'broken', 'not-json');
    vi.stubEnv('NOVEL_PRIVATE_BLOB_READ_WRITE_TOKEN', 'private-do-not-expose');
    const status = await novelPublicationStatus(now);
    expect(status).toMatchObject({ scheduled: 1, published: 0, blocked: 0, overdue: 1, invalid: 1, privateImageStoreConfigured: true });
    expect(JSON.stringify(status)).not.toContain('private-do-not-expose');
    expect(JSON.stringify(status)).not.toContain('contentHashes');
    expect(Object.keys(status.slots[0]).sort()).toEqual(['id', 'novelId', 'publishAt', 'state', 'chapterCount'].sort());
  });
  it('protects the read-only status endpoint with admin authentication', async () => {
    const { GET } = await import('@/app/api/novel-publication/status/route');
    expect((await GET(new NextRequest('https://museum.test/api/novel-publication/status'))).status).toBe(401);
    expect(mocks.db.siteSetting.findMany).not.toHaveBeenCalled();
    vi.stubEnv('ADMIN_USERNAME', 'test'); vi.stubEnv('ADMIN_PASSWORD', 'test-password');
    const response = await GET(new NextRequest('https://museum.test/api/novel-publication/status', {
      headers: { cookie: `admin_token=${generateAdminToken()}` },
    }));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('does not report a database failure as an empty calendar', async () => {
    const { GET } = await import('@/app/api/novel-publication/status/route');
    vi.stubEnv('ADMIN_USERNAME', 'test'); vi.stubEnv('ADMIN_PASSWORD', 'test-password');
    mocks.db.siteSetting.findMany.mockRejectedValueOnce(new Error('private-db-detail'));
    const response = await GET(new NextRequest('https://museum.test/api/novel-publication/status', {
      headers: { cookie: `admin_token=${generateAdminToken()}` },
    }));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('private-db-detail');
  });
});
