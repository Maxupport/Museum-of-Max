import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ ok: false, error: '缺少取消訂閱驗證金鑰' }, { status: 400 });
    }

    const subscriber = await prisma.subscriber.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!subscriber) {
      return NextResponse.json({ ok: false, error: '查無此訂閱資料或金鑰無效' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      email: subscriber.email,
      novelId: subscriber.novelId,
      active: subscriber.active,
    });
  } catch (error) {
    console.error('Fetch Unsubscribe Info Error:', error);
    return NextResponse.json({ ok: false, error: '查詢退訂資訊失敗' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ ok: false, error: '缺少取消訂閱驗證金鑰' }, { status: 400 });
    }

    const subscriber = await prisma.subscriber.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!subscriber) {
      return NextResponse.json({ ok: false, error: '查無此訂閱資料或金鑰無效' }, { status: 404 });
    }

    // 軟刪除：將 active 改為 false，保留法律紀錄避免日後誤發
    const updated = await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { active: false },
    });

    return NextResponse.json({
      ok: true,
      message: '您已成功取消訂閱連載更新通知。',
      email: updated.email,
    });
  } catch (error) {
    console.error('Unsubscribe Error:', error);
    return NextResponse.json({ ok: false, error: '取消訂閱失敗，請稍後再試' }, { status: 500 });
  }
}
