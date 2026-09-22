import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  try {
    // 1. 清空真人訪客造訪紀錄 (VisitorLog)
    const deletedVisitorLogs = await prisma.visitorLog.deleteMany({});

    // 2. 清空展區造訪紀錄 (PageView)
    const deletedPageViews = await prisma.pageView.deleteMany({});

    // 3. 重設所有專題文章點擊計數器為 0 (WritingsItem.views)
    const updatedArticles = await prisma.writingsItem.updateMany({
      data: { views: 0 },
    });

    // 備註：依指示保留 AiCrawlerLog (AI 爬蟲搜尋紀錄不予歸零)

    return NextResponse.json({
      ok: true,
      message: '真人流量統計數據已成功歸零重置！',
      deletedVisitorLogs: deletedVisitorLogs.count,
      deletedPageViews: deletedPageViews.count,
      resetArticlesCount: updatedArticles.count,
    });
  } catch (error) {
    console.error('Reset Traffic Stats Error:', error);
    return NextResponse.json({ ok: false, error: '重置流量統計失敗' }, { status: 500 });
  }
}
