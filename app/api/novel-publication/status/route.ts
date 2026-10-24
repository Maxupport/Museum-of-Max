import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { novelPublicationStatus } from '@/lib/novel-publication';

const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false }, { status: 401, headers });
  try { return NextResponse.json({ ok: true, data: await novelPublicationStatus() }, { headers }); }
  catch { return NextResponse.json({ ok: false, error: '讀取連載排程失敗' }, { status: 503, headers }); }
}
