import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { queuePublishedUpdate } from '@/lib/newsletter-queue';
import { kickNewsletterQueue } from '@/lib/newsletter-kick';

export const maxDuration = 60;

// Importers/schedulers call ONCE after a batch is public, not once per imported chapter.
export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!body || typeof body.novelId !== 'string' || body.novelId.length > 200 ||
      typeof body.eventId !== 'string' || !/^[\w:-]{8,128}$/.test(body.eventId) ||
      (body.isTest != null && typeof body.isTest !== 'boolean') ||
      !Array.isArray(body.chapterIds) || !body.chapterIds.length || body.chapterIds.length > 100 ||
      body.chapterIds.some((id: unknown) => typeof id !== 'string' || id.length > 200)) {
    return NextResponse.json({ ok: false, error: '請提供作品、章節清單與本次更新的識別碼。' }, { status: 400 });
  }
  try {
    const result = await queuePublishedUpdate(body.novelId, body.chapterIds, `published:${body.eventId}`, body.isTest === true);
    if (!result.duplicate) kickNewsletterQueue();
    return NextResponse.json({ ok: true, ...result }, { status: 202 });
  }
  catch { return NextResponse.json({ ok: false, error: '無法排入通知：請確認章節屬於此作品、已正式公開，且有有效訂閱者。' }, { status: 400 }); }
}
