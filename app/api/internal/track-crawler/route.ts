import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { botFamily, botName, userAgent, path, ip, referer } = body;

    if (!botFamily || !botName || !path) {
      return NextResponse.json({ ok: false, error: '缺少必要欄位' }, { status: 400 });
    }

    const record = await prisma.aiCrawlerLog.create({
      data: {
        botFamily,
        botName,
        userAgent: (userAgent || '').slice(0, 1000),
        path: (path || '/').slice(0, 500),
        ip: ip ? ip.slice(0, 100) : null,
        referer: referer ? referer.slice(0, 500) : null,
      },
    });

    return NextResponse.json({ ok: true, data: record });
  } catch (error) {
    console.error('Track AI Crawler Error:', error);
    return NextResponse.json({ ok: false, error: '記錄 AI 爬蟲失敗' }, { status: 500 });
  }
}
