import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const article = await prisma.writingsItem.findUnique({
      where: { id },
    });
    if (!article) {
      return NextResponse.json({ ok: false, error: '文章不存在' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: article });
  } catch (error) {
    console.error('Fetch Single Article Error:', error);
    return NextResponse.json({ ok: false, error: '讀取文章失敗' }, { status: 500 });
  }
}

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
    const { exhibitId, title, category, excerpt, content, youtubeUrl, order } = body;

    const updated = await prisma.writingsItem.update({
      where: { id },
      data: {
        exhibitId: exhibitId || undefined,
        title: title ? title.trim() : undefined,
        category: category || undefined,
        excerpt: excerpt !== undefined ? (excerpt ? excerpt.trim() : null) : undefined,
        content: content ? content.trim() : undefined,
        youtubeUrl: youtubeUrl !== undefined ? (youtubeUrl ? youtubeUrl.trim() : null) : undefined,
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
