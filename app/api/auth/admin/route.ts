import { NextRequest, NextResponse } from 'next/server';
import { checkAdminCredentials, generateAdminToken, validateAdminRequest } from '@/lib/auth';
import { ALL_EXHIBIT_KEYS } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: '請輸入帳號與密碼' }, { status: 400 });
    }

    if (!checkAdminCredentials(username.trim(), password.trim())) {
      return NextResponse.json({ ok: false, error: '帳號或密碼錯誤' }, { status: 401 });
    }

    const token = generateAdminToken();
    const response = NextResponse.json({ ok: true });

    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
      sameSite: 'lax',
    });

    response.cookies.set('visitor_token', 'curator_admin', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
      sameSite: 'lax',
    });

    response.cookies.set('visitor_permissions', JSON.stringify(ALL_EXHIBIT_KEYS), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
      sameSite: 'lax',
    });

    response.cookies.set('is_curator', 'true', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Admin Auth Error:', error);
    return NextResponse.json({ ok: false, error: '伺服器內部錯誤' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const isValid = validateAdminRequest(request);
  return NextResponse.json({ authenticated: isValid });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('admin_token');
  response.cookies.delete('visitor_token');
  response.cookies.delete('visitor_permissions');
  response.cookies.delete('is_curator');
  return response;
}
