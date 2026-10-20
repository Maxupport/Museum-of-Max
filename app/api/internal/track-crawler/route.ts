import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCrawlerRequest } from '@/lib/crawler-auth';
import { detectAiBot } from '@/lib/ai-bots';

export async function POST(request: NextRequest) {
  try {
    // Reject unsigned callers before reading a potentially large request body.
    if (!request.headers.get('x-crawler-signature')) {
      return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
    }
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > 8192) return NextResponse.json({ ok: false }, { status: 413 });
    if (!verifyCrawlerRequest(rawBody, request.headers)) {
      return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
    }
    let body;
    try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
    if (!body || typeof body !== 'object') return NextResponse.json({ ok: false }, { status: 400 });
    const { botFamily, botName, userAgent, path, ip, referer } = body;
    const detected = typeof userAgent === 'string' ? detectAiBot(userAgent) : null;

    if (!detected?.isAiBot || botFamily !== detected.botFamily || botName !== detected.botName ||
        typeof path !== 'string' || !path.startsWith('/') || path.length > 500 ||
        typeof userAgent !== 'string' || userAgent.length > 1000 ||
        (ip != null && (typeof ip !== 'string' || ip.length > 100)) ||
        (referer != null && (typeof referer !== 'string' || referer.length > 500))) {
      return NextResponse.json({ ok: false, error: '缺少必要欄位' }, { status: 400 });
    }

    await prisma.aiCrawlerLog.create({
      data: {
        botFamily,
        botName,
        userAgent: (userAgent || '').slice(0, 1000),
        path: (path || '/').slice(0, 500),
        ip: ip ? ip.slice(0, 100) : null,
        referer: referer ? referer.slice(0, 500) : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Track AI Crawler Error:', error);
    return NextResponse.json({ ok: false, error: '記錄 AI 爬蟲失敗' }, { status: 500 });
  }
}
