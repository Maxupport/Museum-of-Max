import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { queueCampaign } from '@/lib/newsletter-queue';
import { NEWSLETTER_SENDER } from '@/lib/newsletter-config';

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: '無效的 JSON' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ ok: false }, { status: 400 });
  const { eventId, novelTitle, chapterTitle, summary, novelId, isTest, testEmail } = body;
  if (typeof eventId !== 'string' || !/^[\w:-]{8,128}$/.test(eventId) ||
      typeof chapterTitle !== 'string' || !chapterTitle.trim() || /[\r\n]/.test(chapterTitle) || chapterTitle.length > 200 ||
      [novelTitle, novelId].some((value) => value != null && (typeof value !== 'string' || value.length > 200)) ||
      (summary != null && (typeof summary !== 'string' || summary.length > 5000)) ||
      (isTest != null && typeof isTest !== 'boolean') ||
      (testEmail != null && (typeof testEmail !== 'string' || testEmail.toLowerCase() !== NEWSLETTER_SENDER))) {
    return NextResponse.json({ ok: false, error: '請填寫標題並提供有效的通知識別碼；測試信僅寄給管理者。' }, { status: 400 });
  }
  try {
    const result = await queueCampaign({ novelTitle: novelTitle || 'Maxupport 私人博物館', chapterTitle: chapterTitle.trim(),
      summary: summary || '', ...(novelId && novelId !== 'all' ? { novelId } : {}) }, eventId, isTest === true);
    return NextResponse.json({ ok: true, ...result, isTest: isTest === true,
      message: result.duplicate ? '此通知已建立，不會重複加入。' : `已加入待寄佇列 ${result.queuedCount} 封，依每 24 小時最多 80 封的額度寄送；這不代表信件已寄出。` }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === 'EVENT_CONFLICT') return NextResponse.json({ ok: false, error: '此通知識別碼已用於其他內容，請重新建立通知。' }, { status: 409 });
    const noSubscribers = error instanceof Error && error.message === 'NO_SUBSCRIBERS';
    return NextResponse.json({ ok: false, error: noSubscribers ? '目前沒有有效訂閱者。' : '建立通知失敗，請保留原通知識別碼後重試。' }, { status: noSubscribers ? 400 : 500 });
  }
}
