import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { publicationContentAudit, recoverBlockedRevision } from '@/lib/novel-publication-edit';

export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false }, { status: 401, headers });
  try { return NextResponse.json({ ok: true, data: await publicationContentAudit() }, { headers }); }
  catch { return NextResponse.json({ ok: false, error: '無法核對章節版本。' }, { status: 503, headers }); }
}
export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false }, { status: 401, headers });
  try {
    const body = await request.json();
    if (body.confirmation !== 'approve-current-revision-keep-release-date') return NextResponse.json({ ok: false }, { status: 400, headers });
    return NextResponse.json({ ok: true, data: await recoverBlockedRevision(body.chapterId, body.expectedContentHash) }, { headers });
  } catch { return NextResponse.json({ ok: false, error: '未恢復排程，請重新核對章節版本、配圖與受阻狀態。' }, { status: 409, headers }); }
}
