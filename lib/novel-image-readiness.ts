import 'server-only';
import { createHash } from 'node:crypto';
import { get } from '@vercel/blob';
import type { Prisma } from '@prisma/client';
import { novelPrivateStoreConfig, isPrivateBlobUrl } from '@/lib/novel-private-store';

export async function preparedIllustrationReady(tx: Prisma.TransactionClient, chapterId: string) {
  try {
    const store = novelPrivateStoreConfig();
    if (!store) return false;
    const row = await tx.siteSetting.findUnique({ where: { key: `novel-illustration:v1:${chapterId}` } });
    if (!row) return false;
    const image = JSON.parse(row.value);
    if (!/^[\w-]{1,128}$/.test(chapterId) || !/^[a-f0-9]{64}$/.test(image.imageHash || '') ||
      !/^[a-f0-9]{64}$/.test(image.sourceHash || '') || !image.verifiedAt ||
      !Number.isSafeInteger(image.size) || image.size < 1 || image.size > 4 * 1024 * 1024 ||
      !new RegExp(`^novel-illustrations/${chapterId}/${image.imageHash}\\.(png|jpg|webp)$`).test(image.pathname || '')) return false;
    const remote = await get(image.pathname, { access: 'private', ...store, useCache: false, abortSignal: AbortSignal.timeout(8000) });
    if (!remote || remote.statusCode !== 200 || (remote.blob.size !== 0 && remote.blob.size !== image.size) || remote.blob.contentType !== image.contentType ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(remote.blob.contentType) ||
      !isPrivateBlobUrl(remote.blob.url)) return false;
    const bytes = new Uint8Array(await new Response(remote.stream).arrayBuffer());
    return bytes.length === image.size && createHash('sha256').update(bytes).digest('hex') === image.imageHash;
  } catch { return false; }
}
