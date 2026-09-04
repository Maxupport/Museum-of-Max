import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  try {
    const totalPageviews = await prisma.pageView.count();
    const pageviewsByExhibit = await prisma.pageView.groupBy({
      by: ['exhibitId'],
      _count: {
        id: true,
      },
    });

    const exhibitStats = pageviewsByExhibit.map((item) => ({
      exhibitId: item.exhibitId,
      count: item._count.id,
    }));

    const recentViews = await prisma.pageView.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        passcode: {
          select: { code: true, note: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      stats: {
        totalPageviews,
        exhibitStats,
        recentViews,
      },
    });
  } catch (error) {
    console.error('Stats Fetch Error:', error);
    return NextResponse.json({ ok: false, error: '無法讀取統計資料' }, { status: 500 });
  }
}
