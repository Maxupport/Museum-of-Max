import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

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

import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, novelId, novelTitle, sourceChapter, website_url } = body;

    // 1. 蜜罐防機器人 (Honeypot protection)
    if (website_url) {
      console.warn('[Anti-Spam] Bot detected via honeypot field:', { email, website_url });
      return NextResponse.json({
        ok: true,
        message: '感謝訂閱！未來每當有最新連載或內容更新時，將自動寄送通知給您。',
      });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: '請輸入有效的 Email 電子郵件地址' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name ? String(name).trim() : null;
    const cleanChapter = typeof sourceChapter === 'number' ? sourceChapter : null;

    // 2. 寫入或更新訂閱者 (包含產生專屬退訂金鑰)
    const subscriber = await prisma.subscriber.upsert({
      where: { email: cleanEmail },
      update: {
        active: true,
        ...(cleanName && { name: cleanName }),
        ...(cleanChapter && { sourceChapter: cleanChapter }),
      },
      create: {
        email: cleanEmail,
        name: cleanName,
        novelId: novelId || 'all',
        sourceChapter: cleanChapter,
        active: true,
      },
    });

    // 3. 後端非同步同步至 Google 試算表 (保護 Webhook 網址不暴露於前端)
    const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL || process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
    if (googleScriptUrl) {
      fetch(googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: cleanName || '',
          novelTitle: novelTitle || novelId || '全本連載',
          sourceChapter: cleanChapter || 1,
          createdAt: new Date().toISOString(),
        }),
      }).catch((err) => console.error('[Google Apps Script Sync Error]:', err));
    }

    // 4. 非同步寄送歡迎確認信
    sendWelcomeEmail({
      email: cleanEmail,
      name: cleanName,
      novelTitle: novelTitle || '原創小說連載',
      novelId: novelId || undefined,
      unsubscribeToken: subscriber.unsubscribeToken,
    }).catch((err) => console.error('[Welcome Email Trigger Error]:', err));

    return NextResponse.json({
      ok: true,
      message: '感謝訂閱！未來每當有最新連載或內容更新時，將自動寄送通知給您。',
      data: subscriber,
    });
  } catch (error) {
    console.error('Subscribe Error:', error);
    return NextResponse.json({ ok: false, error: '訂閱失敗，請稍後再試' }, { status: 500 });
  }
}
