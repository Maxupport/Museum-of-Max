import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { chapterIllustrationUrl } from '@/lib/novel-illustration';
import { novelPrivateStoreConfig, isPrivateBlobUrl } from '@/lib/novel-private-store';
import { validateAdminRequest } from '@/lib/auth';
import { uploadNovelIllustration } from '@/lib/novel-illustration-upload';

export const maxDuration = 60;

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, noarchive' };
const unavailable = () => new NextResponse(null, { status: 404, headers });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  if (!/^[\w-]{1,128}$/.test(chapterId)) return unavailable();
  try {
    const chapter = await prisma.writingsItem.findUnique({ where: { id: chapterId },
      select: { isHidden: true, category: true, content: true } });
    // No admin exception, redirect or CDN cache: unpublished images must stay unavailable.
    if (!chapter || chapter.isHidden || chapter.category !== '小說' || !chapterIllustrationUrl(chapterId, chapter.content)) return unavailable();
    const store = novelPrivateStoreConfig();
    if (!store) return unavailable();
    const row = await prisma.siteSetting.findUnique({ where: { key: `novel-illustration:v1:${chapterId}` } });
    const image = row ? JSON.parse(row.value) as { pathname?: string } : null;
    // Only fixed paths in the dedicated store, never URLs or user-controlled fetch targets.
    if (!image?.pathname || !new RegExp(`^novel-illustrations/${chapterId}/[a-f0-9]{64}\\.(png|jpg|webp)$`).test(image.pathname)) return unavailable();
    const result = await get(image.pathname, { access: 'private', ...store, useCache: false,
      abortSignal: AbortSignal.timeout(8000) });
    if (!result || result.statusCode !== 200 ||
      !isPrivateBlobUrl(result.blob.url) ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(result.blob.contentType)) return unavailable();
    return new NextResponse(result.stream, { headers: { ...headers, 'Content-Type': result.blob.contentType } });
  } catch { return unavailable(); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ chapterId: string }> }) {
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false }, { status: 401, headers });
  try {
    const { chapterId } = await params;
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || typeof form.get('sourceHash') !== 'string' || typeof form.get('contentHash') !== 'string')
      return NextResponse.json({ ok: false }, { status: 400, headers });
    const data = await uploadNovelIllustration(chapterId, file, form.get('sourceHash') as string, form.get('contentHash') as string);
    return NextResponse.json({ ok: true, data }, { headers });
  } catch (error) {
    const known = ['INVALID_IMAGE_INPUT', 'PRIVATE_STORE_UNAVAILABLE', 'INVALID_HIDDEN_CHAPTER', 'SOURCE_HASH_MISMATCH',
      'IMAGE_MAPPING_CONFLICT', 'PRIVATE_IMAGE_VERIFICATION_FAILED', 'PRIVATE_IMAGE_HASH_MISMATCH', 'CHAPTER_CHANGED'];
    const code = error instanceof Error && known.includes(error.message) ? error.message : 'PRIVATE_STORAGE_REQUEST_FAILED';
    return NextResponse.json({ ok: false, code, error: '私密章圖驗證或上傳失敗；請確認隱藏章節及核准來源。' }, { status: 409, headers });
  }
}
