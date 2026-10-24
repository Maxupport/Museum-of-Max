import 'server-only';
import { createHash } from 'node:crypto';
import { get, put } from '@vercel/blob';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { novelPrivateStoreConfig } from '@/lib/novel-private-store';
import { chapterIllustrationUrl } from '@/lib/novel-illustration';
import { MAX_IMAGE_BYTES, prepareUploadImage } from '@/lib/upload-image';

const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export async function uploadNovelIllustration(chapterId: string, file: File, sourceHash: string, expectedContentHash: string) {
  if (!/^[\w-]{1,128}$/.test(chapterId) || !/^[a-f0-9]{64}$/.test(sourceHash) ||
    !/^[a-f0-9]{64}$/.test(expectedContentHash) || file.size > MAX_IMAGE_BYTES || file.size < 1) throw new Error('INVALID_IMAGE_INPUT');
  const store = novelPrivateStoreConfig();
  if (!store) throw new Error('PRIVATE_STORE_UNAVAILABLE');
  const chapter = await prisma.writingsItem.findUnique({ where: { id: chapterId } });
  if (!chapter?.isHidden || chapter.category !== '小說' || !chapterIllustrationUrl(chapterId, chapter.content) ||
    hash(chapter.content) !== expectedContentHash) throw new Error('INVALID_HIDDEN_CHAPTER');
  if (hash(new Uint8Array(await file.arrayBuffer())) !== sourceHash) throw new Error('SOURCE_HASH_MISMATCH');
  const image = await prepareUploadImage(file);
  const imageHash = hash(image.buffer);
  const pathname = `novel-illustrations/${chapterId}/${imageHash}.${image.extension}`;
  const key = `novel-illustration:v1:${chapterId}`;
  const existing = await prisma.siteSetting.findUnique({ where: { key } });
  if (existing && JSON.parse(existing.value).pathname !== pathname) throw new Error('IMAGE_MAPPING_CONFLICT');
  let remote = await get(pathname, { access: 'private', ...store, useCache: false, abortSignal: AbortSignal.timeout(8000) });
  if (!remote) {
    try {
      await put(pathname, image.buffer, { access: 'private', ...store, contentType: image.contentType,
        addRandomSuffix: false, allowOverwrite: false, abortSignal: AbortSignal.timeout(15000) });
    } catch {
      // A timed-out/concurrent upload may have succeeded. Read the same immutable
      // path once; never create another pathname to retry an unknown result.
    }
    remote = await get(pathname, { access: 'private', ...store, useCache: false, abortSignal: AbortSignal.timeout(8000) });
  }
  if (!remote || remote.statusCode !== 200 ||
    !/^https:\/\/[a-z0-9-]+\.private\.blob\.vercel-storage\.com\//.test(remote.blob.url) ||
    remote.blob.contentType !== image.contentType || (remote.blob.size !== 0 && remote.blob.size !== image.buffer.length)) throw new Error('PRIVATE_IMAGE_VERIFICATION_FAILED');
  const bytes = new Uint8Array(await new Response(remote.stream).arrayBuffer());
  // The SDK reports size=0 when a streamed response omits Content-Length.
  // Verify the actual complete bytes instead of treating an absent header as empty.
  if (bytes.length !== image.buffer.length || hash(bytes) !== imageHash) throw new Error('PRIVATE_IMAGE_HASH_MISMATCH');
  const dimensions = await sharp(image.buffer).metadata();
  const mapping = { pathname, sourceHash, imageHash, width: dimensions.width, height: dimensions.height,
    contentType: image.contentType, size: image.buffer.length, verifiedAt: new Date().toISOString() };
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(726340821)`;
    const current = await tx.writingsItem.findUnique({ where: { id: chapterId } });
    if (!current?.isHidden || current.category !== '小說' || hash(current.content) !== expectedContentHash) throw new Error('CHAPTER_CHANGED');
    const prior = await tx.siteSetting.findUnique({ where: { key } });
    if (prior && JSON.parse(prior.value).pathname !== pathname) throw new Error('IMAGE_MAPPING_CONFLICT');
    await tx.siteSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(mapping) }, update: { value: JSON.stringify(mapping) } });
  });
  return { verified: true, duplicate: Boolean(existing), imageHash, width: dimensions.width, height: dimensions.height };
}
