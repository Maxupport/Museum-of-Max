import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { newsletterStatus } from '@/lib/newsletter-queue';

export async function GET(request: NextRequest) {
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false }, { status: 401 });
  try { return NextResponse.json({ ok: true, data: await newsletterStatus() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ ok: false, error: '讀取寄信狀態失敗' }, { status: 500 }); }
}
