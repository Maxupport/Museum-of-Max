import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';
import { sendChapterUpdateEmail } from '@/lib/email';

export const maxDuration = 60;

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

    if ([novelTitle, chapterTitle, summary, novelId, testEmail].some((value) =>
      value != null && (typeof value !== 'string' || value.length > 5000)) ||
      (isTest != null && typeof isTest !== 'boolean')) {
      return NextResponse.json({ ok: false, error: '寄信欄位格式不正確' }, { status: 400 });
    }

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
          error: `測試信發送失敗：${sendResult.error || '寄信服務未接受信件'}`,
        }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: `測試信件已成功發送至 ${recipient}，請前往信箱確認排版樣式。`,
        isTest: true,
      });
    }

    // 2. 正式批次發送模式
    const subscribers = await prisma.subscriber.findMany({
      where: {
        active: true,
        ...(novelId && novelId !== 'all' ? { novelId: { in: [novelId, 'all'] } } : {}),
      },
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
        sent: false,
      },
    });

    // 批次透過 Resend 寄送信件
    const successfulIds: string[] = [];
    // Bound concurrent work instead of opening one request per subscriber at once.
    for (let offset = 0; offset < subscribers.length; offset += 2) {
      const batch = subscribers.slice(offset, offset + 2);
      const results = await Promise.allSettled(batch.map((sub) => sendChapterUpdateEmail({
        email: sub.email,
        name: sub.name,
        novelTitle: novelTitle || '原創小說連載',
        chapterTitle: chapterTitle || '最新章節更新',
        summary: summary || null,
        chapterUrl: targetUrl,
        unsubscribeToken: sub.unsubscribeToken,
      })));
      const batchIds = batch.filter((_, index) => {
        const result = results[index];
        return result.status === 'fulfilled' && result.value.ok;
      }).map((sub) => sub.id);
      // Persist each completed batch so a later failure doesn't mark unsent recipients as notified.
      if (batchIds.length) await prisma.subscriber.updateMany({
        where: { id: { in: batchIds } }, data: { lastNotifiedAt: new Date() },
      });
      successfulIds.push(...batchIds);
    }
    const successCount = successfulIds.length;
    const failedCount = subscribers.length - successCount;
    const completedLog = await prisma.novelUpdate.update({
      where: { id: updateLog.id },
      data: { sent: failedCount === 0, sentAt: failedCount === 0 ? new Date() : null },
    });

    return NextResponse.json({
      ok: successCount > 0,
      ...(successCount === 0 ? { error: '寄信服務未接受任何信件，請檢查寄件設定與額度。' } : {}),
      message: `連載更新廣播已發送！成功寄出 ${successCount} / ${subscribers.length} 封信件。`,
      subscriberCount: subscribers.length,
      successCount,
      failedCount,
      updateLog: completedLog,
    }, { status: successCount > 0 ? 200 : 502 });
  } catch (error) {
    console.error('Dispatch Newsletter Error:', error);
    return NextResponse.json({ ok: false, error: '安排發送失敗' }, { status: 500 });
  }
}
