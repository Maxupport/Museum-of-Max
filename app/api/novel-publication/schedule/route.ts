import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { installPublicationSlots } from '@/lib/novel-publication';

export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false }, { status: 401, headers });
  try {
    const body = await request.json();
    const data = await installPublicationSlots(body.slots);
    return NextResponse.json({ ok: true, data }, { headers });
  } catch { return NextResponse.json({ ok: false, error: '排程未安裝，請確認發布已暫停、未來日期、隱藏章節及核准版本。' }, { status: 409, headers }); }
}
