import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /museum and /museum/*
  if (pathname.startsWith('/museum')) {
    const visitorToken = request.cookies.get('visitor_token')?.value;
    const visitorPermissions = request.cookies.get('visitor_permissions')?.value;
    const adminToken = request.cookies.get('admin_token')?.value;

    if (!adminToken && (!visitorToken || !visitorPermissions)) {
      // Redirect unauthenticated visitor back to main passcode entrance /
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Protect /admin and /admin/* (except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const adminToken = request.cookies.get('admin_token')?.value;

    if (!adminToken) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/museum/:path*', '/admin', '/admin/:path*'],
};
