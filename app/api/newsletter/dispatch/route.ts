import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';
import { sendChapterUpdateEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      novelTitle,
      chapterTitle,
      summary,
      novelId,
      isTest,
      testEmail,
    } = body;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://maxupport.com';
    const targetUrl = novelId
      ? `${siteUrl}/museum/creation_lab/novel/${encodeURIComponent(novelId)}`
      : `${siteUrl}/museum/creation_lab`;

    // 1. 若為「發送測試信」模式
    if (isTest) {
      const recipient = testEmail || 'maxupport@gmail.com';
      const sendResult = await sendChapterUpdateEmail({
        email: recipient,
        name: '管理員 (測試預覽)',
        novelTitle: novelTitle || '原創小說連載',
        chapterTitle: chapterTitle || '最新章節更新預覽',
        summary: summary || '這是測試信件預覽內容，用於確認信件在信箱中之排版與樣式。',
        chapterUrl: targetUrl,
        unsubscribeToken: null,
      });

      if (!sendResult.ok) {
        return NextResponse.json({
          ok: false,
          error: `測試信發送失敗：${typeof sendResult.error === 'object' && sendResult.error !== null ? JSON.stringify(sendResult.error) : sendResult.error}`,
        }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: `測試信件已成功發送至 ${recipient}，請前往信箱確認排版樣式。`,
        isTest: true,
      });
    }

    // 2. 正式批次發送模式
    const whereClause: { active: boolean; novelId?: string } = { active: true };
    if (novelId && novelId !== 'all') {
      whereClause.novelId = novelId;
    }

    const subscribers = await prisma.subscriber.findMany({
      where: whereClause,
    });

    if (subscribers.length === 0) {
      return NextResponse.json({
        ok: false,
        error: '目前尚無有效的訂閱者名單可發送。',
      }, { status: 400 });
    }

    // 建立廣播日誌
    const updateLog = await prisma.novelUpdate.create({
      data: {
        novelTitle: novelTitle || '小說連載',
        chapterTitle: chapterTitle || '最新章節更新',
        summary: summary || '專屬連載內文已更新，歡迎前往博物館閱讀。',
        sent: true,
        sentAt: new Date(),
      },
    });

    // 批次透過 Resend 寄送信件
    const emailPromises = subscribers.map((sub) =>
      sendChapterUpdateEmail({
        email: sub.email,
        name: sub.name,
        novelTitle: novelTitle || '原創小說連載',
        chapterTitle: chapterTitle || '最新章節更新',
        summary: summary || null,
        chapterUrl: targetUrl,
        unsubscribeToken: sub.unsubscribeToken,
      })
    );

    // 平行發送
    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter((r) => r.status === 'fulfilled' && (r.value as { ok: boolean }).ok).length;

    // 更新 subscribers 的 lastNotifiedAt
    const subscriberIds = subscribers.map((s) => s.id);
    await prisma.subscriber.updateMany({
      where: { id: { in: subscriberIds } },
      data: { lastNotifiedAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      message: `連載更新廣播已發送！成功寄出 ${successCount} / ${subscribers.length} 封信件。`,
      subscriberCount: subscribers.length,
      successCount,
      updateLog,
    });
  } catch (error) {
    console.error('Dispatch Newsletter Error:', error);
    return NextResponse.json({ ok: false, error: '安排發送失敗' }, { status: 500 });
  }
}
