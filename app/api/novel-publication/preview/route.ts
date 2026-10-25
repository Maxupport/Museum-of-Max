import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { publishNovelPreview } from '@/lib/novel-publication';

export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false }, { status: 401, headers });
  try {
    const body = await request.json();
    if (body.confirmation !== 'publish-first-batch-without-email') return NextResponse.json({ ok: false }, { status: 400, headers });
    const data = await publishNovelPreview(body.slotId, body.contentHashes);
    return NextResponse.json({ ok: true, data }, { headers });
  } catch { return NextResponse.json({ ok: false, error: '試讀尚未公開，請核對首批排程、核准版本及配圖。' }, { status: 409, headers }); }
}
