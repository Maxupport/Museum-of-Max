import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(), records: new Map<string, string>(),
  db: { $transaction: vi.fn(), $queryRaw: vi.fn(), writingsItem: { findUnique: vi.fn() },
    siteSetting: { findUnique: vi.fn(), upsert: vi.fn() } },
}));
vi.mock('@vercel/blob', () => ({ get: mocks.get, put: mocks.put }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.db }));
import { uploadNovelIllustration } from '@/lib/novel-illustration-upload';
import { preparedIllustrationReady } from '@/lib/novel-image-readiness';
import { POST } from '@/app/api/novel-illustrations/[chapterId]/route';

const hash = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
const content = JSON.stringify({ textContent: '核准正文', illustration: true });
let file: File;
let sourceHash: string;
beforeEach(async () => {
  vi.clearAllMocks(); mocks.records.clear();
  vi.stubEnv('NOVEL_PRIVATE_BLOB_READ_WRITE_TOKEN', ''); vi.stubEnv('sec_STORE_ID', 'store_vvbDqZjeyID4ikVr'); vi.stubEnv('VERCEL_OIDC_TOKEN', 'test-only-oidc');
  const buffer = await sharp({ create: { width: 8, height: 12, channels: 3, background: '#808080' } }).png().toBuffer();
  file = new File([new Uint8Array(buffer)], 'fixture.png', { type: 'image/png' }); sourceHash = hash(buffer);
  mocks.db.writingsItem.findUnique.mockResolvedValue({ isHidden: true, category: '小說', content });
  mocks.db.siteSetting.findUnique.mockImplementation(async ({ where }) => mocks.records.has(where.key)
    ? { key: where.key, value: mocks.records.get(where.key) } : null);
  mocks.db.siteSetting.upsert.mockImplementation(async ({ where, create, update }) => {
    mocks.records.set(where.key, mocks.records.has(where.key) ? update.value : create.value); return create;
  });
  mocks.db.$transaction.mockImplementation(async (operation) => operation(mocks.db));
  let remote: { pathname: string; buffer: Uint8Array } | null = null;
  mocks.put.mockImplementation(async (pathname, bytes) => { remote = { pathname, buffer: new Uint8Array(bytes) }; return {}; });
  mocks.get.mockImplementation(async () => remote ? { statusCode: 200, stream: new Response(new Uint8Array(remote.buffer)).body,
    blob: { url: `https://vvbDqZjeyID4ikVr.private.blob.vercel-storage.com/${remote.pathname}`, size: remote.buffer.length, contentType: 'image/png' } } : null);
});
afterEach(() => vi.unstubAllEnvs());

describe('approved private illustration upload', () => {
  it('verifies uploaded bytes, dimensions and private store, with an idempotent immutable pathname', async () => {
    expect(await uploadNovelIllustration('chapter-1', file, sourceHash, hash(content))).toMatchObject({ verified: true, duplicate: false, width: 8, height: 12 });
    expect(await uploadNovelIllustration('chapter-1', file, sourceHash, hash(content))).toMatchObject({ verified: true, duplicate: true });
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.put.mock.calls[0][2]).toMatchObject({ access: 'private', storeId: 'store_vvbDqZjeyID4ikVr', allowOverwrite: false, addRandomSuffix: false });
    expect(mocks.records.size).toBe(1);
    const value = JSON.parse([...mocks.records.values()][0]); expect(value.sourceHash).toBe(sourceHash);
    expect(value.pathname).toMatch(/^novel-illustrations\/chapter-1\/[a-f0-9]{64}\.png$/);
  });
  it('rejects a different source image before writing storage', async () => {
    await expect(uploadNovelIllustration('chapter-1', file, 'a'.repeat(64), hash(content))).rejects.toThrow('SOURCE_HASH_MISMATCH');
    expect(mocks.put).not.toHaveBeenCalled(); expect(mocks.records.size).toBe(0);
  });
  it.each(['public', 'edited'])('refuses a %s chapter without uploading', async (kind) => {
    mocks.db.writingsItem.findUnique.mockResolvedValue({ isHidden: kind !== 'public', category: '小說', content: kind === 'edited' ? content + ' ' : content });
    await expect(uploadNovelIllustration('chapter-1', file, sourceHash, hash(content))).rejects.toThrow('INVALID_HIDDEN_CHAPTER');
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it('does not create a mapping when upload and verification fail', async () => {
    mocks.put.mockRejectedValueOnce(new Error('provider-failed'));
    await expect(uploadNovelIllustration('chapter-1', file, sourceHash, hash(content))).rejects.toThrow('PRIVATE_IMAGE_VERIFICATION_FAILED');
    expect(mocks.records.size).toBe(0);
  });
  it('refuses to replace an existing chapter image mapping', async () => {
    mocks.records.set('novel-illustration:v1:chapter-1', JSON.stringify({ pathname: 'different-approved-image.png' }));
    await expect(uploadNovelIllustration('chapter-1', file, sourceHash, hash(content))).rejects.toThrow('IMAGE_MAPPING_CONFLICT');
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it('rejects anonymous upload before reading data or contacting storage', async () => {
    const response = await POST(new NextRequest('https://museum.test/api/novel-illustrations/chapter-1', { method: 'POST' }),
      { params: Promise.resolve({ chapterId: 'chapter-1' }) });
    expect(response.status).toBe(401); expect(mocks.db.writingsItem.findUnique).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it('preflights an uploaded private image and detects later byte corruption', async () => {
    await uploadNovelIllustration('chapter-1', file, sourceHash, hash(content));
    const tx = mocks.db as unknown as Parameters<typeof preparedIllustrationReady>[0];
    expect(await preparedIllustrationReady(tx, 'chapter-1')).toBe(true);
    const mapping = JSON.parse([...mocks.records.values()][0]);
    mocks.get.mockResolvedValueOnce({ statusCode: 200, stream: new Response(new Uint8Array(mapping.size)).body,
      blob: { url: `https://test.private.blob.vercel-storage.com/${mapping.pathname}`, size: mapping.size, contentType: 'image/png' } });
    expect(await preparedIllustrationReady(tx, 'chapter-1')).toBe(false);
  });
  it('preflight fails closed when a mapping or private provider is unavailable', async () => {
    const tx = mocks.db as unknown as Parameters<typeof preparedIllustrationReady>[0];
    expect(await preparedIllustrationReady(tx, 'chapter-1')).toBe(false);
    await uploadNovelIllustration('chapter-1', file, sourceHash, hash(content));
    mocks.get.mockRejectedValueOnce(new Error('temporarily-unavailable'));
    expect(await preparedIllustrationReady(tx, 'chapter-1')).toBe(false);
  });
  it('verifies complete bytes even when private streaming has no Content-Length header', async () => {
    await uploadNovelIllustration('chapter-1', file, sourceHash, hash(content));
    const mapping = JSON.parse([...mocks.records.values()][0]);
    const realGet = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation(async (...args) => {
      const result = await realGet(...args); return result ? { ...result, blob: { ...result.blob, size: 0 } } : null;
    });
    expect((await uploadNovelIllustration('chapter-1', file, sourceHash, hash(content))).verified).toBe(true);
    expect(await preparedIllustrationReady(mocks.db as unknown as Parameters<typeof preparedIllustrationReady>[0], 'chapter-1')).toBe(true);
    mocks.get.mockResolvedValueOnce({ statusCode: 200, stream: new Response(new Uint8Array([1])).body,
      blob: { url: `https://test.private.blob.vercel-storage.com/${mapping.pathname}`, size: 0, contentType: 'image/png' } });
    expect(await preparedIllustrationReady(mocks.db as unknown as Parameters<typeof preparedIllustrationReady>[0], 'chapter-1')).toBe(false);
  });
});
