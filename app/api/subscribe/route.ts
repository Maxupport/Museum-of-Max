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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, novelId } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: '請輸入有效的 Email 電子郵件地址' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name ? String(name).trim() : null;

    const subscriber = await prisma.subscriber.upsert({
      where: { email: cleanEmail },
      update: {
        active: true,
        ...(cleanName && { name: cleanName }),
      },
      create: {
        email: cleanEmail,
        name: cleanName,
        novelId: novelId || 'all',
        active: true,
      },
    });

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
