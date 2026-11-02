import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { generateAdminToken } from '@/lib/auth';
import { articlePublicationLabel, formatPublicationTime } from '@/lib/article-publication-display';

const mocks = vi.hoisted(() => ({ siteSetting: { findMany: vi.fn() }, writingsItem: { findMany: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks }));
import { articlePublicationTimes } from '@/lib/article-publication-times';
import { GET } from '@/app/api/writings/route';

const slot = { id: 'night-ch02', novelId: 'night', chapterIds: ['chapter-2'], publishAt: '2026-11-03T00:30:00.000Z', state: 'scheduled', contentHashes: { 'chapter-2': 'a'.repeat(64) } };
beforeEach(() => {
  vi.stubEnv('ADMIN_USERNAME', 'test'); vi.stubEnv('ADMIN_PASSWORD', 'test-password');
  mocks.siteSetting.findMany.mockReset().mockResolvedValue([{ key: `novel-publication:v1:slot:${slot.id}`, value: JSON.stringify(slot) }]);
  mocks.writingsItem.findMany.mockReset().mockResolvedValue([{ id: 'chapter-2', title: '第二章', isHidden: true }]);
});
afterEach(() => vi.unstubAllEnvs());

describe('admin read-only article publication times', () => {
  it('maps actual chapter IDs to current dates without serializing hashes', async () => {
    const times = await articlePublicationTimes();
    expect(times['chapter-2']).toEqual({ state: 'scheduled', scheduledAt: slot.publishAt, publishedAt: null, preview: false });
    expect(JSON.stringify(times)).not.toContain('contentHashes');
    expect(mocks.siteSetting.findMany).toHaveBeenCalledTimes(1);
  });
  it('uses the actual preview time instead of the original future release date', async () => {
    mocks.siteSetting.findMany.mockResolvedValue([{ key: `novel-publication:v1:slot:${slot.id}`, value: JSON.stringify({ ...slot, state: 'published', publicationKind: 'preview', publishedAt: '2026-10-25T05:38:00.000Z' }) }]);
    const timing = (await articlePublicationTimes())['chapter-2'];
    expect(articlePublicationLabel(timing, false)).toContain('2026/10/25');
    expect(articlePublicationLabel(timing, false)).not.toContain('2026/11/03');
  });
  it('does not reveal private schedules to anonymous requests', async () => {
    const r = await GET(new NextRequest('https://museum.test/api/writings?includeHidden=true'));
    expect((await r.json()).publicationTimingAvailable).toBeUndefined();
    expect(mocks.siteSetting.findMany).not.toHaveBeenCalled();
    expect(mocks.writingsItem.findMany.mock.calls[0][0].where.isHidden).toBe(false);
  });
  it('adds timing only to authenticated admin responses with no-store caching', async () => {
    const r = await GET(new NextRequest('https://museum.test/api/writings?includeHidden=true', { headers: { cookie: `admin_token=${generateAdminToken()}` } }));
    const body = await r.json();
    expect(body.publicationTimingAvailable).toBe(true); expect(body.data[0].publication.scheduledAt).toBe(slot.publishAt);
    expect(r.headers.get('cache-control')).toContain('no-store');
  });
  it('keeps the article list usable but explicitly reports a failed timing lookup', async () => {
    mocks.siteSetting.findMany.mockRejectedValue(new Error('Unavailable'));
    const r = await GET(new NextRequest('https://museum.test/api/writings?includeHidden=true', { headers: { cookie: `admin_token=${generateAdminToken()}` } }));
    const body = await r.json();
    expect(body.ok).toBe(true); expect(body.data).toHaveLength(1); expect(body.publicationTimingAvailable).toBe(false);
  });
  it('rejects malformed and duplicate chapter mappings instead of guessing dates', async () => {
    mocks.siteSetting.findMany.mockResolvedValue([{ key: 'novel-publication:v1:slot:wrong', value: JSON.stringify(slot) }]);
    await expect(articlePublicationTimes()).rejects.toThrow();
    mocks.siteSetting.findMany.mockResolvedValue([slot, { ...slot, id: 'other' }].map(s=>({key:`novel-publication:v1:slot:${s.id}`,value:JSON.stringify(s)})));
    await expect(articlePublicationTimes()).rejects.toThrow('AMBIGUOUS_PUBLICATION_TIME');
  });
  it('formats Taipei time and never substitutes creation dates for missing history', () => {
    expect(formatPublicationTime(slot.publishAt)).toContain('08:30');
    expect(articlePublicationLabel(undefined, true)).toBe('尚未排程');
    expect(articlePublicationLabel(undefined, false)).toBe('已公開・上線時間未記錄');
    expect(articlePublicationLabel(undefined, true, false)).toBe('上線時間暫時無法讀取');
    expect(articlePublicationLabel({ state:'blocked',scheduledAt:slot.publishAt,publishedAt:null,preview:false },true)).toContain('發布受阻');
  });
});
