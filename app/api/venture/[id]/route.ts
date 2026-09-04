import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權的造訪' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { category, title, logoUrl, period, status, description, linkUrl, order } = body;

    const updated = await prisma.ventureItem.update({
      where: { id },
      data: {
        ...(category && { category: category.trim() }),
        ...(title && { title: title.trim() }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl ? logoUrl.trim() : null }),
        ...(period && { period: period.trim() }),
        ...(status && { status: status.trim() }),
        ...(description !== undefined && { description: description ? description.trim() : null }),
        ...(linkUrl !== undefined && { linkUrl: linkUrl ? linkUrl.trim() : null }),
        ...(order !== undefined && { order: Number(order) }),
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error('Update venture item error:', error);
    return NextResponse.json({ ok: false, error: '更新風險投資項目失敗' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權的造訪' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.ventureItem.delete({
      where: { id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete venture item error:', error);
    return NextResponse.json({ ok: false, error: '刪除風險投資項目失敗' }, { status: 500 });
  }
}
