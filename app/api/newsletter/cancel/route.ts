import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { cancelCampaign } from '@/lib/newsletter-queue';

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!body || typeof body.campaignId !== 'string' || !/^[a-f0-9]{64}$/.test(body.campaignId)) return NextResponse.json({ ok: false }, { status: 400 });
  try { return NextResponse.json({ ok: true, canceled: await cancelCampaign(body.campaignId), message: '已取消尚未處理的通知；已送出或處理中的信件無法收回。' }); }
  catch { return NextResponse.json({ ok: false }, { status: 500 }); }
}
