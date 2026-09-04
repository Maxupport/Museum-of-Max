import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { exhibitId, notionId } = await request.json();
    const passcodeId = request.cookies.get('visitor_token')?.value || null;

    if (!exhibitId) {
      return NextResponse.json({ ok: false, error: '展區 ID 為必填' }, { status: 400 });
    }

    await prisma.pageView.create({
      data: {
        exhibitId,
        notionId: notionId || 'main',
        passcodeId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Pageview record error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
