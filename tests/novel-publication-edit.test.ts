import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { generateAdminToken } from '@/lib/auth';

const mocks = vi.hoisted(() => ({ records: new Map<string, string>(), chapters: new Map<string, Record<string, unknown>>(),
  imageReady: vi.fn(), queue: vi.fn(), kick: vi.fn(),
  db: { $transaction: vi.fn(), $queryRaw: vi.fn(), siteSetting: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    novel: { findUnique: vi.fn() }, writingsItem: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.db }));
vi.mock('@/lib/novel-image-readiness', () => ({ preparedIllustrationReady: mocks.imageReady }));
vi.mock('@/lib/newsletter-queue', () => ({ queuePublicationBatch: mocks.queue, queuePublication: mocks.queue }));
vi.mock('@/lib/newsletter-kick', () => ({ kickNewsletterQueue: mocks.kick }));
import { chapterHash } from '@/lib/novel-publication';
import { recoverBlockedRevision, publicationContentAudit } from '@/lib/novel-publication-edit';
import { PUT } from '@/app/api/writings/[id]/route';
import { GET, POST } from '@/app/api/novel-publication/recovery/route';

const key = 'novel-publication:v1:slot:night-ch02';
function slot() { return JSON.parse(mocks.records.get(key)!); }
function chapter() { return mocks.chapters.get('chapter-2')!; }
function request(body: object, path = '/api/writings/chapter-2') {
  return new NextRequest(`https://museum.test${path}`, { method: path.includes('recovery') ? 'POST' : 'PUT',
    headers: { 'content-type': 'application/json', cookie: `admin_token=${generateAdminToken()}` }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.records.clear(); mocks.chapters.clear();
  vi.stubEnv('ADMIN_USERNAME', 'test'); vi.stubEnv('ADMIN_PASSWORD', 'safe-test-password');
  const original = JSON.stringify({ textContent: '原定稿', illustration: true });
  mocks.chapters.set('chapter-2', { id: 'chapter-2', category: '小說', topic: '測試小說', title: '第二章', isHidden: true, content: '最新修訂\n\n完整保留' });
  mocks.records.set(key, JSON.stringify({ id: 'night-ch02', novelId: 'night', chapterIds: ['chapter-2'],
    publishAt: '2026-11-03T00:30:00.000Z', state: 'blocked', error: 'CONTENT_CHANGED', contentHashes: { 'chapter-2': chapterHash(original) } }));
  mocks.records.set('novel-illustration:v1:chapter-2', JSON.stringify({ verifiedAt: '2026-10-25' }));
  mocks.imageReady.mockResolvedValue(true);
  mocks.db.siteSetting.findMany.mockImplementation(async ({ where }) => [...mocks.records].filter(([k]) => k.startsWith(where.key.startsWith)).map(([key, value]) => ({ key, value })));
  mocks.db.siteSetting.findUnique.mockImplementation(async ({ where }) => mocks.records.has(where.key) ? { key: where.key, value: mocks.records.get(where.key) } : null);
  mocks.db.siteSetting.update.mockImplementation(async ({ where, data }) => { mocks.records.set(where.key, data.value); return data; });
  mocks.db.siteSetting.upsert.mockImplementation(async ({ where, create }) => { if (!mocks.records.has(where.key)) mocks.records.set(where.key, create.value); });
  mocks.db.novel.findUnique.mockResolvedValue({ id: 'night', title: '測試小說' });
  mocks.db.writingsItem.findUnique.mockImplementation(async ({ where }) => mocks.chapters.has(where.id) ? { ...mocks.chapters.get(where.id) } : null);
  mocks.db.writingsItem.findMany.mockImplementation(async ({ where }) => [...mocks.chapters.values()].filter(c => where.id.in.includes(c.id)).map(c => ({ ...c })));
  mocks.db.writingsItem.update.mockImplementation(async ({ where, data }) => { const c = chapter(); if (where.id !== c.id) throw Error('missing');
    Object.entries(data).forEach(([k, v]) => { if (v !== undefined) c[k] = v; }); return { ...c }; });
  mocks.db.$transaction.mockImplementation(async (operation) => {
    const rows = new Map(mocks.records), chapters = new Map([...mocks.chapters].map(([id, c]) => [id, { ...c }]));
    try { return await operation(mocks.db); }
    catch (error) { mocks.records.clear(); rows.forEach((v, k) => mocks.records.set(k, v)); mocks.chapters.clear(); chapters.forEach((v, k) => mocks.chapters.set(k, v)); throw error; }
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('approved admin edits retain scheduled chapters and private illustrations', () => {
  it('audits the version mismatch without disclosing unpublished text', async () => {
    const result = await publicationContentAudit();
    expect(result).toEqual({ checkedChapters: 1, pendingSlots: 1, issues: [{ slotId: 'night-ch02', chapterId: 'chapter-2', reason: 'CONTENT_CHANGED' }] });
    expect(JSON.stringify(result)).not.toContain('最新修訂');
  });
  it('recovers the exact reviewed revision, keeps date and hidden state, saves backup and sends no mail', async () => {
    const before = { ...chapter() }, originalSlot = slot();
    expect(await recoverBlockedRevision('chapter-2', chapterHash(before.content as string))).toEqual({ rearmed: true, publishAt: originalSlot.publishAt, published: false, notified: false });
    expect(JSON.parse(chapter().content as string)).toEqual({ textContent: before.content, illustration: true });
    expect(chapter().isHidden).toBe(true);
    expect(slot()).toMatchObject({ state: 'scheduled', publishAt: originalSlot.publishAt, contentHashes: { 'chapter-2': chapterHash(chapter().content as string) } });
    expect(slot().error).toBeUndefined();
    const backup = [...mocks.records].find(([k]) => k.startsWith('novel-publication:v1:revision:'))!;
    expect(JSON.parse(backup[1])).toMatchObject({ slot: originalSlot, chapter: before });
    expect(await publicationContentAudit()).toMatchObject({ issues: [] });
    expect(mocks.queue).not.toHaveBeenCalled(); expect(mocks.kick).not.toHaveBeenCalled();
    await expect(recoverBlockedRevision('chapter-2', chapterHash(before.content as string))).rejects.toThrow('REVISION_CHANGED');
  });
  it.each(['concurrent-edit', 'missing-image', 'wrong-book', 'already-public'])('rejects recovery for %s without changes', async kind => {
    const expected = chapterHash(chapter().content as string);
    if (kind === 'concurrent-edit') chapter().content += '另外的修改';
    if (kind === 'missing-image') mocks.imageReady.mockResolvedValue(false);
    if (kind === 'wrong-book') chapter().topic = '其他作品';
    if (kind === 'already-public') chapter().isHidden = false;
    const before = JSON.stringify([...mocks.records]), content = chapter().content;
    await expect(recoverBlockedRevision('chapter-2', expected)).rejects.toThrow();
    expect(JSON.stringify([...mocks.records])).toBe(before); expect(chapter().content).toBe(content);
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it('an explicit admin content save preserves the illustration and approves the new hash at the old date', async () => {
    const date = slot().publishAt;
    const response = await PUT(request({ content: '再修訂的內文', approveScheduledRevision: true }), { params: Promise.resolve({ id: 'chapter-2' }) });
    expect(response.status).toBe(200);
    expect(JSON.parse(chapter().content as string)).toEqual({ textContent: '再修訂的內文', illustration: true });
    expect(slot()).toMatchObject({ state: 'scheduled', publishAt: date, contentHashes: { 'chapter-2': chapterHash(chapter().content as string) } });
    expect(mocks.db.$queryRaw).toHaveBeenCalled(); expect(mocks.queue).not.toHaveBeenCalled(); expect(mocks.kick).not.toHaveBeenCalled();
  });
  it('pin-only changes and unapproved API edits cannot approve a blocked revision', async () => {
    const before = mocks.records.get(key);
    expect((await PUT(request({ isPinned: true }), { params: Promise.resolve({ id: 'chapter-2' }) })).status).toBe(200);
    expect(mocks.records.get(key)).toBe(before);
    expect((await PUT(request({ content: '未核准API變動' }), { params: Promise.resolve({ id: 'chapter-2' }) })).status).toBe(200);
    expect(mocks.records.get(key)).toBe(before);
  });
  it('rejects anonymous recovery and edits before reading private data', async () => {
    const anon = new NextRequest('https://museum.test/api/novel-publication/recovery');
    expect((await GET(anon)).status).toBe(401); expect((await POST(anon)).status).toBe(401);
    expect((await PUT(anon, { params: Promise.resolve({ id: 'chapter-2' }) })).status).toBe(401);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it('requires explicit recovery confirmation and never recovers a published or future scheduled slot', async () => {
    expect((await POST(request({}, '/api/novel-publication/recovery'))).status).toBe(400);
    for (const state of ['scheduled', 'published']) {
      mocks.records.set(key, JSON.stringify({ ...slot(), state }));
      await expect(recoverBlockedRevision('chapter-2', chapterHash(chapter().content as string))).rejects.toThrow('REVISION_CHANGED');
    }
  });
});
