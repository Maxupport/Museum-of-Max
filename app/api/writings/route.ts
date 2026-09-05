import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const exhibitId = searchParams.get('exhibitId');
    const category = searchParams.get('category');

    const whereClause: Record<string, unknown> = {};
    if (exhibitId && exhibitId !== 'all') {
      whereClause.exhibitId = exhibitId;
    }
    if (category && category !== '全部分類') {
      whereClause.category = category;
    }

    const writings = await prisma.writingsItem.findMany({
      where: whereClause,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json({ ok: true, data: writings });
  } catch (error) {
    console.error('Fetch Writings Error:', error);
    return NextResponse.json({ ok: false, error: '讀取文章失敗' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { exhibitId, title, category, excerpt, content, youtubeUrl, order } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ ok: false, error: '請輸入文章標題' }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ ok: false, error: '請輸入文章內文' }, { status: 400 });
    }

    const newItem = await prisma.writingsItem.create({
      data: {
        exhibitId: exhibitId || 'creation_lab',
        title: title.trim(),
        category: category || 'FB文章備份',
        excerpt: excerpt ? excerpt.trim() : null,
        content: content.trim(),
        youtubeUrl: youtubeUrl ? youtubeUrl.trim() : null,
        order: typeof order === 'number' ? order : 0,
      },
    });

    return NextResponse.json({ ok: true, data: newItem });
  } catch (error) {
    console.error('Create Writing Error:', error);
    return NextResponse.json({ ok: false, error: '新增文章失敗' }, { status: 500 });
  }
}
