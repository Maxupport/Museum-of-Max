import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';
import { queueSubscriber } from '@/lib/newsletter-queue';

export async function GET(request: NextRequest) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  try {
    const subscribers = await prisma.subscriber.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ ok: true, data: subscribers, total: subscribers.length });
  } catch (error) {
    console.error('Fetch Subscribers Error:', error);
    return NextResponse.json({ ok: false, error: '讀取訂閱名單失敗' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, novelId, novelTitle, sourceChapter, website_url } = body;

    // 1. 蜜罐防機器人 (Honeypot protection)
    if (website_url) {
      return NextResponse.json({
        ok: true,
        message: '感謝訂閱！未來每當有最新連載或內容更新時，將自動寄送通知給您。',
      });
    }

    if (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ ok: false, error: '請輸入有效的 Email 電子郵件地址' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    if ([name, novelId, novelTitle].some((value) => value != null &&
      (typeof value !== 'string' || value.length > 200)) ||
      (sourceChapter != null && (!Number.isSafeInteger(sourceChapter) || sourceChapter < 1))) {
      return NextResponse.json({ ok: false, error: '訂閱欄位格式不正確' }, { status: 400 });
    }
    const cleanName = name?.trim() || null;
    const cleanChapter = sourceChapter ?? null;

    // Public requests cannot overwrite an existing reader or silently undo an opt-out.
    // An identical response also avoids exposing whether an email is subscribed.
    const existing = await prisma.subscriber.findUnique({ where: { email: cleanEmail }, select: { id: true } });
    if (existing) return subscriptionResponse();

    // 2. 建立新訂閱者 (包含產生專屬退訂金鑰)
    await prisma.$transaction(async (tx) => {
      const subscriber = await tx.subscriber.create({
      data: {
        email: cleanEmail,
        name: cleanName,
        novelId: novelId || 'all',
        sourceChapter: cleanChapter,
        active: true,
      },
      });
      await queueSubscriber(tx, subscriber.id, true, novelTitle || '原創小說連載');
    });

    return subscriptionResponse();
  } catch (error) {
    // Concurrent requests for the same unique email must not send duplicate welcomes.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return subscriptionResponse();
    console.error('[Subscription] Subscription request failed');
    return NextResponse.json({ ok: false, error: '訂閱失敗，請稍後再試' }, { status: 500 });
  }
}

function subscriptionResponse() {
  return NextResponse.json({
    ok: true,
    message: '已收到訂閱登記。寄信服務啟用後，將依排程寄送歡迎信及後續更新通知。',
  });
}
