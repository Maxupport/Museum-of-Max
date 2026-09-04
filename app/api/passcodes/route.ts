import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest, parsePermissions, stringifyPermissions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  try {
    const passcodes = await prisma.passcode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { pageviews: true },
        },
      },
    });

    const formatted = passcodes.map((item) => ({
      id: item.id,
      code: item.code,
      note: item.note,
      permissions: parsePermissions(item.permissions),
      createdAt: item.createdAt,
      pageviewCount: item._count.pageviews,
    }));

    return NextResponse.json({ ok: true, data: formatted });
  } catch (error) {
    console.error('Fetch Passcodes Error:', error);
    return NextResponse.json({ ok: false, error: '資料讀取失敗' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  try {
    const { code, note, permissions } = await request.json();

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ ok: false, error: '通行密碼不可為空' }, { status: 400 });
    }

    const trimmedCode = code.trim();

    // Check duplicate
    const existing = await prisma.passcode.findUnique({
      where: { code: trimmedCode },
    });

    if (existing) {
      return NextResponse.json({ ok: false, error: '該通行密碼已存在' }, { status: 400 });
    }

    const permArray = Array.isArray(permissions) ? permissions : [];
    const newPasscode = await prisma.passcode.create({
      data: {
        code: trimmedCode,
        note: note ? note.trim() : null,
        permissions: stringifyPermissions(permArray),
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        ...newPasscode,
        permissions: parsePermissions(newPasscode.permissions),
      },
    });
  } catch (error) {
    console.error('Create Passcode Error:', error);
    return NextResponse.json({ ok: false, error: '新增通行密碼失敗' }, { status: 500 });
  }
}
