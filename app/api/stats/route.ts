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

    // 通行碼進入統計 (首頁通行碼按鈕與輸入)
    const entryViews = await prisma.pageView.findMany({
      where: { exhibitId: 'entry' },
      include: {
        passcode: { select: { code: true, note: true } },
      },
    });

    const customPasscodes = await prisma.passcode.findMany();

    const countMap: Record<string, number> = {};
    entryViews.forEach((pv) => {
      const codeKey = (pv.passcode?.code || pv.notionId || '').trim().toUpperCase();
      if (codeKey) {
        countMap[codeKey] = (countMap[codeKey] || 0) + 1;
      }
    });

    const presetList = [
      { code: 'VC2026', note: '我想了解 Max 有什麼專業。 (新創風投、商業議題分析、職涯履歷)' },
      { code: 'NVC2026', note: '我想了解 Max 除了專業還會什麼！ (聲音探索、創作 Lab、人生擺渡)' },
      { code: 'Max', note: '我想知道 Max 創作過什麼 (創作 Lab、聲音探索)' },
      { code: 'VVIP', note: '我想知道 Max 的所有事情！ (VVIP 全站展區通行證)' },
      { code: 'Series', note: '我想看連載故事！ (創作 Lab 小說連載直通門票)' },
    ];

    const passcodeEntryStats: Array<{
      code: string;
      note: string;
      count: number;
      isPreset: boolean;
    }> = [];

    presetList.forEach((preset) => {
      const key = preset.code.trim().toUpperCase();
      passcodeEntryStats.push({
        code: preset.code,
        note: preset.note,
        count: countMap[key] || 0,
        isPreset: true,
      });
    });

    customPasscodes.forEach((cp) => {
      const key = cp.code.trim().toUpperCase();
      if (!presetList.some((p) => p.code.toUpperCase() === key)) {
        passcodeEntryStats.push({
          code: cp.code,
          note: cp.note || '自訂通行碼',
          count: countMap[key] || 0,
          isPreset: false,
        });
      }
    });

    Object.keys(countMap).forEach((key) => {
      if (!passcodeEntryStats.some((item) => item.code.toUpperCase() === key)) {
        passcodeEntryStats.push({
          code: key,
          note: '其他通行碼進入',
          count: countMap[key],
          isPreset: false,
        });
      }
    });

    const totalPasscodeEntries = entryViews.length;

    return NextResponse.json({
      ok: true,
      stats: {
        totalPageviews,
        totalPasscodeEntries,
        passcodeEntryStats,
        exhibitStats,
        recentViews,
      },
    });
  } catch (error) {
    console.error('Stats Fetch Error:', error);
    return NextResponse.json({ ok: false, error: '無法讀取統計資料' }, { status: 500 });
  }
}
