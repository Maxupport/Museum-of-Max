import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';

export async function GET() {
  try {
    const items = await prisma.careerItem.findMany({
      orderBy: [
        { createdAt: 'desc' },
        { order: 'asc' },
      ],
    });
    return NextResponse.json({ ok: true, data: items });
  } catch (error) {
    console.error('Fetch career items error:', error);
    return NextResponse.json({ ok: false, error: '讀取職涯經歷失敗' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權的造訪' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { company, role, period, description, order } = body;

    if (!company || !role || !period) {
      return NextResponse.json({ ok: false, error: '請填寫公司、職稱與任職時間' }, { status: 400 });
    }

    const newItem = await prisma.careerItem.create({
      data: {
        company: company.trim(),
        role: role.trim(),
        period: period.trim(),
        description: (description || '').trim(),
        order: typeof order === 'number' ? order : 0,
      },
    });

    return NextResponse.json({ ok: true, data: newItem });
  } catch (error) {
    console.error('Create career item error:', error);
    return NextResponse.json({ ok: false, error: '新增職涯經歷失敗' }, { status: 500 });
  }
}
