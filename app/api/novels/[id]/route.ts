import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

async function isCuratorRequest(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get('is_curator')?.value === 'true';
}

/**
 * GET /api/novels/[id]
 * 取得特定小說的最上層資訊及所有章節列表（供閱讀器使用）。
 * [id] 可以是 cuid 或小說書名 (URL encoded)。
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);

    // 先嘗試以 id 查詢，再以 title 查詢
    let novel = await prisma.novel.findUnique({ where: { id: decodedId } });
    if (!novel) {
      novel = await prisma.novel.findUnique({ where: { title: decodedId } });
    }

    if (!novel) {
      return NextResponse.json({ ok: false, error: '找不到此小說' }, { status: 404 });
    }

    // 取得此小說的所有章節 (WritingsItem with category="小說" and topic=novel.title)
    const chapters = await prisma.writingsItem.findMany({
      where: {
        category: '小說',
        topic: novel.title,
        isHidden: false,
      },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      data: {
        ...novel,
        totalChapters: chapters.length,
        chapters,
      },
    });
  } catch (err) {
    console.error('[GET /api/novels/[id]] Error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/novels/[id]
 * 更新特定小說的最上層資訊（需策展人身份）。
 * Body: { title?, author?, coverUrl?, description?, status?, order? }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isCuratorRequest()) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { title, author, coverUrl, description, status, order } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (author !== undefined) updateData.author = author;
    if (coverUrl !== undefined) updateData.coverUrl = coverUrl || null;
    if (description !== undefined) updateData.description = description || null;
    if (status !== undefined) updateData.status = status;
    if (typeof order === 'number') updateData.order = order;

    const novel = await prisma.novel.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, data: novel });
  } catch (err) {
    console.error('[PUT /api/novels/[id]] Error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/novels/[id]
 * 刪除特定小說的最上層資訊（需策展人身份）。
 * 注意：不會刪除相關的 WritingsItem 章節。
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isCuratorRequest()) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.novel.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: '小說已刪除' });
  } catch (err) {
    console.error('[DELETE /api/novels/[id]] Error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
