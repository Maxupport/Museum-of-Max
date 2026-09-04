import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { exhibitId, notionId } = await request.json();
    const rawPasscodeId = request.cookies.get('visitor_token')?.value || null;

    if (!exhibitId) {
      return NextResponse.json({ ok: false, error: '展區 ID 為必填' }, { status: 400 });
    }

    let passcodeId: string | null = null;
    if (rawPasscodeId) {
      const exists = await prisma.passcode.findUnique({ where: { id: rawPasscodeId } });
      if (exists) {
        passcodeId = rawPasscodeId;
      }
    }

    const record = await prisma.pageView.create({
      data: {
        exhibitId,
        notionId: notionId || 'main',
        passcodeId,
      },
    });

    return NextResponse.json({ ok: true, data: record });
  } catch (error: unknown) {
    console.error('Pageview record error:', error);
    const errorMessage = error instanceof Error ? error.message : '記錄流量失敗';
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}

