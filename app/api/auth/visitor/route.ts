import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parsePermissions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { passcode } = body;

    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json({ ok: false, error: '請輸入通行密碼' }, { status: 400 });
    }

    const trimmedCode = passcode.trim().toLowerCase();

    const allPasscodes = await prisma.passcode.findMany();
    const found = allPasscodes.find((p) => p.code.trim().toLowerCase() === trimmedCode);

    if (!found) {
      return NextResponse.json({ ok: false, error: '通行密碼無效，請確認後重試' }, { status: 401 });
    }

    const permissions = parsePermissions(found.permissions);

    const isNovelDirect = permissions.includes('creation_lab_novel') || 
      (found.note && (found.note.includes('小說') || found.note.includes('連載')));

    // If permissions include creation_lab_novel, make sure creation_lab is also granted
    const activePermissions = (isNovelDirect && !permissions.includes('creation_lab')) 
      ? [...permissions, 'creation_lab']
      : permissions;

    const redirectUrl = isNovelDirect ? '/museum/creation_lab' : '/museum';

    const response = NextResponse.json({
      ok: true,
      permissions: activePermissions,
      redirectUrl,
      note: found.note,
    });

    // Store visitor token and permissions in HTTP-only cookies
    response.cookies.set('visitor_token', found.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
    });

    response.cookies.set('visitor_permissions', JSON.stringify(activePermissions), {
      httpOnly: false, // Accessible in JS if needed or read server side
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    });

    // Clear any previous curator/admin cookies so visitor test is 100% clean
    response.cookies.set('is_curator', '', { path: '/', maxAge: 0 });
    response.cookies.set('admin_token', '', { path: '/', maxAge: 0 });

    return response;
  } catch (error) {
    console.error('Visitor Auth Error:', error);
    return NextResponse.json({ ok: false, error: '伺服器內部錯誤' }, { status: 500 });
  }
}
