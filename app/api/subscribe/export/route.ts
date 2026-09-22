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

    // 建立 CSV 內容 (加上 UTF-8 BOM \uFEFF 避免 Excel 亂碼)
    const headers = ['Email', '稱呼/暱稱', '訂閱作品ID', '來源章節', '訂閱狀態', '訂閱日期', '上次通知日期'];
    const rows = subscribers.map((sub) => [
      `"${sub.email}"`,
      `"${(sub.name || '').replace(/"/g, '""')}"`,
      `"${sub.novelId}"`,
      sub.sourceChapter ? `第 ${sub.sourceChapter} 章` : '未指定',
      sub.active ? '有效訂閱中' : '已取消訂閱',
      new Date(sub.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
      sub.lastNotifiedAt ? new Date(sub.lastNotifiedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '尚未寄送',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const fileName = `novel_subscribers_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Export Subscribers CSV Error:', error);
    return NextResponse.json({ ok: false, error: '匯出訂閱名單失敗' }, { status: 500 });
  }
}
