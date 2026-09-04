import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

export async function GET() {
  try {
    const writings = await prisma.writingsItem.findMany({
      orderBy: [{ createdAt: 'desc' }, { order: 'asc' }],
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
    const { title, category, excerpt, content, order } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ ok: false, error: '請輸入文章標題' }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ ok: false, error: '請輸入文章內文' }, { status: 400 });
    }

    const newItem = await prisma.writingsItem.create({
      data: {
        title: title.trim(),
        category: category || '其他文字',
        excerpt: excerpt ? excerpt.trim() : null,
        content: content.trim(),
        order: typeof order === 'number' ? order : 0,
      },
    });

    return NextResponse.json({ ok: true, data: newItem });
  } catch (error) {
    console.error('Create Writing Error:', error);
    return NextResponse.json({ ok: false, error: '新增文章失敗' }, { status: 500 });
  }
}
