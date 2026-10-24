import { NextRequest, NextResponse } from 'next/server';
import { verifyWorkerRequest } from '@/lib/newsletter-config';
import { processNewsletterQueue } from '@/lib/newsletter-queue';

export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (!request.headers.get('x-newsletter-signature')) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.text();
  if (body !== '{}' || !verifyWorkerRequest(body, request.headers)) return NextResponse.json({ ok: false }, { status: 401 });
  try { return NextResponse.json({ ok: true, data: await processNewsletterQueue() }); }
  catch { return NextResponse.json({ ok: false, error: 'Worker unavailable' }, { status: 503 }); }
}
