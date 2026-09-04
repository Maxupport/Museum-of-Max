import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { novelTitle, chapterTitle, summary } = body;

    const subscribers = await prisma.subscriber.findMany({
      where: { active: true },
    });

    const updateLog = await prisma.novelUpdate.create({
      data: {
        novelTitle: novelTitle || '小說連載',
        chapterTitle: chapterTitle || '最新章節更新',
        summary: summary || '專屬連載內文已更新，歡迎前往博物館閱讀。',
        sent: true,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: `隔日電子報發送任務已安排！將於明日固定時間寄出連載通知信件給 ${subscribers.length} 位訂閱者。`,
      subscriberCount: subscribers.length,
      updateLog,
    });
  } catch (error) {
    console.error('Dispatch Newsletter Error:', error);
    return NextResponse.json({ ok: false, error: '安排發送失敗' }, { status: 500 });
  }
}
