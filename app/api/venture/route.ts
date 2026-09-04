import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const items = await prisma.ventureItem.findMany({
      where: category ? { category } : undefined,
      orderBy: [
        { createdAt: 'desc' },
        { order: 'asc' },
      ],
    });
    return NextResponse.json({ ok: true, data: items });
  } catch (error) {
    console.error('Fetch venture items error:', error);
    return NextResponse.json({ ok: false, error: '讀取風險投資項目失敗' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權的造訪' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { category, title, logoUrl, period, status, description, linkUrl, order } = body;

    if (!category || !title || !period || !status) {
      return NextResponse.json({ ok: false, error: '請填寫子區塊分類、公司名稱、執行時間與現況更新' }, { status: 400 });
    }

    const newItem = await prisma.ventureItem.create({
      data: {
        category: category.trim(),
        title: title.trim(),
        logoUrl: logoUrl ? logoUrl.trim() : null,
        period: period.trim(),
        status: status.trim(),
        description: description ? description.trim() : null,
        linkUrl: linkUrl ? linkUrl.trim() : null,
        order: typeof order === 'number' ? order : 0,
      },
    });

    return NextResponse.json({ ok: true, data: newItem });
  } catch (error) {
    console.error('Create venture item error:', error);
    return NextResponse.json({ ok: false, error: '新增風險投資項目失敗' }, { status: 500 });
  }
}
