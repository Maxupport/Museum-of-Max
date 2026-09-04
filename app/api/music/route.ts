import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const musicItems = await prisma.musicItem.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ createdAt: 'desc' }, { order: 'asc' }],
    });

    return NextResponse.json({ ok: true, data: musicItems });
  } catch (error) {
    console.error('Fetch Music Items Error:', error);
    return NextResponse.json({ ok: false, error: '讀取音樂作品失敗' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權的造訪' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { category, title, youtubeUrl, description, order } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ ok: false, error: '請輸入音樂創作標題' }, { status: 400 });
    }

    if (!youtubeUrl || typeof youtubeUrl !== 'string' || !youtubeUrl.trim()) {
      return NextResponse.json({ ok: false, error: '請輸入 YouTube 影片/音樂網址' }, { status: 400 });
    }

    const newItem = await prisma.musicItem.create({
      data: {
        category: category || '音樂',
        title: title.trim(),
        youtubeUrl: youtubeUrl.trim(),
        description: description ? description.trim() : null,
        order: typeof order === 'number' ? order : 0,
      },
    });

    return NextResponse.json({ ok: true, data: newItem });
  } catch (error) {
    console.error('Create Music Item Error:', error);
    return NextResponse.json({ ok: false, error: '新增音樂作品失敗' }, { status: 500 });
  }
}
