import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { title, category, excerpt, content, order } = body;

    const updated = await prisma.writingsItem.update({
      where: { id },
      data: {
        title: title ? title.trim() : undefined,
        category: category || undefined,
        excerpt: excerpt !== undefined ? (excerpt ? excerpt.trim() : null) : undefined,
        content: content ? content.trim() : undefined,
        order: typeof order === 'number' ? order : undefined,
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error('Update Writing Error:', error);
    return NextResponse.json({ ok: false, error: '更新失敗' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.writingsItem.delete({
      where: { id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete Writing Error:', error);
    return NextResponse.json({ ok: false, error: '刪除失敗' }, { status: 500 });
  }
}
