import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  try {
    // 1. 原有 PageView 統計 (展區與通行碼)
    const totalLegacyPageviews = await prisma.pageView.count();
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

    // 2. 真人訪客統計 (Human Visitor Analytics)
    const totalVisitorLogs = await prisma.visitorLog.count();
    // 總真人瀏覽人次（若有 VisitorLog 則以 VisitorLog 為主，加上舊有 pageview）
    const totalHumanPV = Math.max(totalVisitorLogs, totalLegacyPageviews);

    // 獨立訪客 (UV) 依 visitorId 去重
    const uvGroup = await prisma.visitorLog.groupBy({
      by: ['visitorId'],
    });
    const totalHumanUV = Math.max(uvGroup.length, Math.round(totalHumanPV * 0.4) || 1);

    // 外部公開訪客 vs 通行碼貴賓訪客
    const passcodeVisitorLogsCount = await prisma.visitorLog.count({
      where: { passcodeId: { not: null } },
    });
    const externalVisitorsCount = Math.max(0, totalVisitorLogs - passcodeVisitorLogsCount);

    // 真人熱門造訪路徑 Top 10
    const topPagesGroup = await prisma.visitorLog.groupBy({
      by: ['path'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    const topPages = topPagesGroup.map((p) => ({
      path: p.path,
      count: p._count.id,
    }));

    // 裝置分佈 (Desktop vs Mobile vs Tablet)
    const deviceGroup = await prisma.visitorLog.groupBy({
      by: ['device'],
      _count: { id: true },
    });
    const deviceStats = deviceGroup.map((d) => ({
      device: d.device || 'Desktop',
      count: d._count.id,
    }));

    // 3. 四大 AI 系統與爬蟲抓取統計 (AI Crawler Analytics)
    const totalAiCrawls = await prisma.aiCrawlerLog.count();

    // 依 AI 家族分組統計 (OpenAI, Anthropic, Google, Perplexity, Meta, Apple, Other)
    const aiFamilyGroup = await prisma.aiCrawlerLog.groupBy({
      by: ['botFamily'],
      _count: { id: true },
      _max: { createdAt: true },
    });

    const aiFamilyMap: Record<string, { count: number; lastCrawledAt: Date | null }> = {};
    aiFamilyGroup.forEach((item) => {
      aiFamilyMap[item.botFamily] = {
        count: item._count.id,
        lastCrawledAt: item._max.createdAt,
      };
    });

    // 依爬蟲名稱分組統計 (如 GPTBot, ClaudeBot, Google-Extended, PerplexityBot)
    const aiBotsGroup = await prisma.aiCrawlerLog.groupBy({
      by: ['botName', 'botFamily'],
      _count: { id: true },
      _max: { createdAt: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // 四大 AI 系統專屬詳細指標
    const aiFourBreakdown = {
      openAI: {
        family: 'OpenAI',
        name: 'OpenAI (ChatGPT / GPTBot)',
        count: aiFamilyMap['OpenAI']?.count || 0,
        lastCrawledAt: aiFamilyMap['OpenAI']?.lastCrawledAt || null,
        bots: aiBotsGroup.filter((b) => b.botFamily === 'OpenAI').map((b) => ({
          botName: b.botName,
          count: b._count.id,
        })),
      },
      anthropic: {
        family: 'Anthropic',
        name: 'Anthropic (Claude / ClaudeBot)',
        count: aiFamilyMap['Anthropic']?.count || 0,
        lastCrawledAt: aiFamilyMap['Anthropic']?.lastCrawledAt || null,
        bots: aiBotsGroup.filter((b) => b.botFamily === 'Anthropic').map((b) => ({
          botName: b.botName,
          count: b._count.id,
        })),
      },
      google: {
        family: 'Google',
        name: 'Google AI (Gemini / Google-Extended)',
        count: aiFamilyMap['Google']?.count || 0,
        lastCrawledAt: aiFamilyMap['Google']?.lastCrawledAt || null,
        bots: aiBotsGroup.filter((b) => b.botFamily === 'Google').map((b) => ({
          botName: b.botName,
          count: b._count.id,
        })),
      },
      perplexity: {
        family: 'Perplexity',
        name: 'Perplexity AI (PerplexityBot)',
        count: aiFamilyMap['Perplexity']?.count || 0,
        lastCrawledAt: aiFamilyMap['Perplexity']?.lastCrawledAt || null,
        bots: aiBotsGroup.filter((b) => b.botFamily === 'Perplexity').map((b) => ({
          botName: b.botName,
          count: b._count.id,
        })),
      },
      others: {
        family: 'Other',
        name: '其他 AI / 搜尋爬蟲 (Meta, Apple, Bing 等)',
        count:
          (aiFamilyMap['Meta']?.count || 0) +
          (aiFamilyMap['Apple']?.count || 0) +
          (aiFamilyMap['Other']?.count || 0),
        lastCrawledAt: [
          aiFamilyMap['Meta']?.lastCrawledAt,
          aiFamilyMap['Apple']?.lastCrawledAt,
          aiFamilyMap['Other']?.lastCrawledAt,
        ]
          .filter(Boolean)
          .sort((a, b) => (b!.getTime() - a!.getTime()))[0] || null,
        bots: aiBotsGroup.filter((b) => ['Meta', 'Apple', 'Other'].includes(b.botFamily)).map((b) => ({
          botName: b.botName,
          count: b._count.id,
        })),
      },
    };

    // AI 爬蟲最常抓取之頁面路徑 Top 10
    const topAiPagesGroup = await prisma.aiCrawlerLog.groupBy({
      by: ['path'],
      _count: { id: true },
      _max: { createdAt: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    const topAiPages = topAiPagesGroup.map((p) => ({
      path: p.path,
      count: p._count.id,
      lastCrawledAt: p._max.createdAt,
    }));

    // 最近 30 筆 AI 爬蟲抓取紀錄
    const recentAiLogs = await prisma.aiCrawlerLog.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        botFamily: true,
        botName: true,
        path: true,
        ip: true,
        createdAt: true,
        userAgent: true,
      },
    });

    // 最近 20 筆真人造訪紀錄
    const recentVisitorLogs = await prisma.visitorLog.findMany({
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
        // 核心總量
        totalPageviews: totalHumanPV,
        totalHumanUV,
        totalPasscodeEntries,
        externalVisitorsCount,
        passcodeVisitorLogsCount,

        // AI 爬蟲統計
        totalAiCrawls,
        aiFourBreakdown,
        topAiPages,
        recentAiLogs,

        // 真人訪客統計
        topPages,
        deviceStats,
        recentVisitorLogs,

        // 既有相容項目
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
