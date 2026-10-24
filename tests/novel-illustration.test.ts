import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { chapterIllustrationUrl } from '@/lib/novel-illustration';

const mocks = vi.hoisted(() => ({ chapter: vi.fn(), setting: vi.fn(), get: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { writingsItem: { findUnique: mocks.chapter }, siteSetting: { findUnique: mocks.setting } } }));
vi.mock('@vercel/blob', () => ({ get: mocks.get }));
import { GET } from '@/app/api/novel-illustrations/[chapterId]/route';

const content = JSON.stringify({ textContent: '核准正文', illustration: true });
const pathname = `novel-illustrations/chapter-1/${'a'.repeat(64)}.png`;
async function request(id = 'chapter-1') {
  return GET(new NextRequest('https://museum.test/api/novel-illustrations/' + encodeURIComponent(id)), { params: Promise.resolve({ chapterId: id }) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('NOVEL_PRIVATE_BLOB_READ_WRITE_TOKEN', 'private-test-only');
  mocks.chapter.mockResolvedValue({ isHidden: false, category: '小說', content });
  mocks.setting.mockResolvedValue({ value: JSON.stringify({ pathname }) });
  mocks.get.mockImplementation(async () => ({ statusCode: 200,
    stream: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); controller.close(); } }),
    blob: { url: `https://test.private.blob.vercel-storage.com/${pathname}`, contentType: 'image/png' } }));
});
afterEach(() => vi.unstubAllEnvs());

describe('protected chapter illustration', () => {
  it('only opts in for explicit structured content and safe chapter IDs', () => {
    expect(chapterIllustrationUrl('chapter-1', content)).toBe('/api/novel-illustrations/chapter-1');
    expect(chapterIllustrationUrl('chapter-1', '一般純文字')).toBeNull();
    expect(chapterIllustrationUrl('../secret', content)).toBeNull();
    expect(chapterIllustrationUrl('chapter-1', JSON.stringify({ illustration: 'https://attacker.test' }))).toBeNull();
  });
  it('streams a published image without revealing the private blob URL or caching it', async () => {
    const response = await request();
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('location')).toBeNull(); expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(mocks.get).toHaveBeenCalledWith(pathname, expect.objectContaining({ access: 'private', useCache: false }));
    expect((await response.arrayBuffer()).byteLength).toBe(3);
  });
  it.each(['hidden', 'missing', 'not-novel', 'no-opt-in'])('does not even fetch storage for %s chapters', async (kind) => {
    mocks.chapter.mockResolvedValue(kind === 'missing' ? null : {
      isHidden: kind === 'hidden', category: kind === 'not-novel' ? '隨筆' : '小說',
      content: kind === 'no-opt-in' ? '純文字' : content,
    });
    expect((await request()).status).toBe(404); expect(mocks.get).not.toHaveBeenCalled();
  });
  it('never falls back to the existing public token', async () => {
    vi.stubEnv('NOVEL_PRIVATE_BLOB_READ_WRITE_TOKEN', ''); vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'public-test-only');
    expect((await request()).status).toBe(404); expect(mocks.get).not.toHaveBeenCalled();
  });
  it('uses the verified pre-existing private store connection without a new secret', async () => {
    vi.stubEnv('NOVEL_PRIVATE_BLOB_READ_WRITE_TOKEN', ''); vi.stubEnv('sec_STORE_ID', 'store_vvbDqZjeyID4ikVr'); vi.stubEnv('VERCEL_OIDC_TOKEN', 'test-only-oidc');
    expect((await request()).status).toBe(200);
    expect(mocks.get).toHaveBeenCalledWith(pathname, expect.objectContaining({ access: 'private', storeId: 'store_vvbDqZjeyID4ikVr' }));
    expect(mocks.get.mock.calls[0][1]).not.toHaveProperty('token');
  });
  it('fails closed when OIDC is missing even if the known private store ID is present', async () => {
    vi.stubEnv('NOVEL_PRIVATE_BLOB_READ_WRITE_TOKEN', ''); vi.stubEnv('sec_STORE_ID', 'store_vvbDqZjeyID4ikVr');
    vi.stubEnv('VERCEL_OIDC_TOKEN', ''); vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'public-token-must-not-be-used');
    expect((await request()).status).toBe(404); expect(mocks.get).not.toHaveBeenCalled();
  });
  it('refuses an unverified store instead of guessing whether it is private', async () => {
    vi.stubEnv('NOVEL_PRIVATE_BLOB_READ_WRITE_TOKEN', ''); vi.stubEnv('sec_STORE_ID', 'store_unknown');
    expect((await request()).status).toBe(404); expect(mocks.get).not.toHaveBeenCalled();
  });
  it.each(['https://attacker.test/a.png', 'novel-illustrations/other/abc.png', '../secret.png'])('refuses unsafe mapping %s', async (unsafe) => {
    mocks.setting.mockResolvedValue({ value: JSON.stringify({ pathname: unsafe }) });
    expect((await request()).status).toBe(404); expect(mocks.get).not.toHaveBeenCalled();
  });
  it('refuses public blobs and non-image content', async () => {
    mocks.get.mockResolvedValueOnce({ statusCode: 200, blob: { url: 'https://test.public.blob.vercel-storage.com/a.png', contentType: 'image/png' } });
    expect((await request()).status).toBe(404);
    mocks.get.mockResolvedValueOnce({ statusCode: 200, blob: { url: 'https://test.private.blob.vercel-storage.com/a.png', contentType: 'text/html' } });
    expect((await request()).status).toBe(404);
  });
  it('fails closed on storage errors without exposing credentials', async () => {
    mocks.get.mockRejectedValueOnce(new Error('private-provider-detail'));
    const response = await request(); expect(response.status).toBe(404); expect(await response.text()).toBe('');
  });
});
