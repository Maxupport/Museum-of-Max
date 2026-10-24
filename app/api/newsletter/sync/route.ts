import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { queueFullSubscriberSync } from '@/lib/newsletter-queue';

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false }, { status: 401 });
  try { return NextResponse.json({ ok: true, queued: await queueFullSubscriberSync(), message: '已排入名單同步；不會寄送信件。' }, { status: 202 }); }
  catch { return NextResponse.json({ ok: false, error: '加入名單同步失敗' }, { status: 500 }); }
}
