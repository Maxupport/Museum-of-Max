import { NextRequest, NextResponse, NextFetchEvent } from 'next/server';
import { detectAiBot } from '@/lib/ai-bots';

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get('user-agent');
  const aiBot = detectAiBot(userAgent);

  // 1. 若為四大 AI 系統或主流搜尋/AI 爬蟲
  if (aiBot.isAiBot && aiBot.botFamily && aiBot.botName) {
    // 非同步記錄 AI 爬蟲造訪紀錄至後台資料庫 (不阻塞回應)
    const origin = request.nextUrl.origin;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip');
    const referer = request.headers.get('referer');

    event.waitUntil(
      fetch(`${origin}/api/internal/track-crawler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botFamily: aiBot.botFamily,
          botName: aiBot.botName,
          userAgent,
          path: pathname,
          ip,
          referer,
        }),
      }).catch((err) => {
        console.error('Async AI crawl log error:', err);
      })
    );

    // AI 爬蟲嚴禁造訪後台 /admin
    if (pathname.startsWith('/admin')) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // 允許 AI 爬蟲讀取 /museum 展區與公開文章，以建立索引與 AI 引用
    return NextResponse.next();
  }

  // 2. 一般人類訪客之權限保護
  // 保護 /admin 及 /admin/* (除 /admin/login 外)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const adminToken = request.cookies.get('admin_token')?.value;
    if (!adminToken) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // 保護 /museum 及 /museum/* (需持有訪客通行證或管理員 Token)
  if (pathname.startsWith('/museum')) {
    const visitorToken = request.cookies.get('visitor_token')?.value;
    const visitorPermissions = request.cookies.get('visitor_permissions')?.value;
    const adminToken = request.cookies.get('admin_token')?.value;

    if (!adminToken && (!visitorToken || !visitorPermissions)) {
      // 未經驗證之真人訪客導回首頁輸入通行碼
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // 3. 確保一般訪客具備 site_visitor_id 識別碼 (用於精準統計 UV 獨立訪客數)
  const response = NextResponse.next();
  if (!request.cookies.get('site_visitor_id')) {
    const visitorId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    response.cookies.set('site_visitor_id', visitorId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 年有效
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  // 比對所有頁面路徑，排除靜態資源、圖片與 API 路由
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
