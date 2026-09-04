import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest, parsePermissions, stringifyPermissions } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.passcode.delete({
      where: { id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete Passcode Error:', error);
    return NextResponse.json({ ok: false, error: '刪除失敗' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { code, note, permissions } = await request.json();

    const permArray = Array.isArray(permissions) ? permissions : [];
    const updated = await prisma.passcode.update({
      where: { id },
      data: {
        ...(code ? { code: code.trim() } : {}),
        note: note !== undefined ? (note ? note.trim() : null) : undefined,
        permissions: stringifyPermissions(permArray),
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        ...updated,
        permissions: parsePermissions(updated.permissions),
      },
    });
  } catch (error) {
    console.error('Update Passcode Error:', error);
    return NextResponse.json({ ok: false, error: '更新失敗' }, { status: 500 });
  }
}
