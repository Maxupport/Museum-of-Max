import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseClientEnvironment } from '@/lib/ai-bots';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, title, referrer } = body;

    if (!path) {
      return NextResponse.json({ ok: false, error: 'Path 為必填' }, { status: 400 });
    }

    // 創作者或排除裝置檢查：不記錄到 visitorLog 且不累加文章 views
    const isCurator =
      request.cookies.get('is_curator')?.value === 'true' ||
      Boolean(request.cookies.get('admin_token')?.value) ||
      request.cookies.get('visitor_token')?.value === 'curator_admin' ||
      request.cookies.get('exclude_from_analytics')?.value === 'true';

    if (isCurator) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const userAgent = request.headers.get('user-agent');
    const { device, browser, os } = parseClientEnvironment(userAgent);

    // 取得或產生訪客 UUID (UV 計算基礎)
    let visitorId = request.cookies.get('site_visitor_id')?.value;
    if (!visitorId) {
      visitorId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    // 取得關聯通行碼 (若訪客透過通行碼進入)
    const rawPasscodeId = request.cookies.get('visitor_token')?.value || null;
    let passcodeId: string | null = null;
    if (rawPasscodeId && rawPasscodeId !== 'curator_admin') {
      const exists = await prisma.passcode.findUnique({ where: { id: rawPasscodeId } });
      if (exists) {
        passcodeId = rawPasscodeId;
      }
    }

    // 建立真人訪客造訪紀錄
    const log = await prisma.visitorLog.create({
      data: {
        visitorId,
        path: path.slice(0, 500),
        title: title ? title.slice(0, 300) : null,
        referer: referrer ? referrer.slice(0, 500) : null,
        device,
        browser,
        os,
        passcodeId,
      },
    });

    // 若為專屬文章頁面 (如 /museum/[exhibit]/[articleId])，累加該文章觀看次數
    const segments = path.split('/').filter(Boolean);
    if (segments.length >= 3 && segments[0] === 'museum') {
      const articleId = segments[segments.length - 1];
      if (articleId && articleId.length > 5) {
        try {
          await prisma.writingsItem.update({
            where: { id: articleId },
            data: { views: { increment: 1 } },
          });
        } catch {
          // 若非 writingsItem ID 則忽略
        }
      }
    }

    const res = NextResponse.json({ ok: true, data: log });
    if (!request.cookies.get('site_visitor_id')) {
      res.cookies.set('site_visitor_id', visitorId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });
    }

    return res;
  } catch (error) {
    console.error('Track Human Visitor Error:', error);
    return NextResponse.json({ ok: false, error: '記錄真人流量失敗' }, { status: 500 });
  }
}
