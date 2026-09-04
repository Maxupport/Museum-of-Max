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
    const { category, title, youtubeUrl, description, order } = body;

    const updated = await prisma.musicItem.update({
      where: { id },
      data: {
        category,
        title: title ? title.trim() : undefined,
        youtubeUrl: youtubeUrl ? youtubeUrl.trim() : undefined,
        description: description !== undefined ? (description ? description.trim() : null) : undefined,
        order: typeof order === 'number' ? order : undefined,
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error('Update Music Item Error:', error);
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
    await prisma.musicItem.delete({
      where: { id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete Music Item Error:', error);
    return NextResponse.json({ ok: false, error: '刪除失敗' }, { status: 500 });
  }
}
