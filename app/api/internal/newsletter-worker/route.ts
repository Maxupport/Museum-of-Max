import { NextRequest, NextResponse } from 'next/server';
import { verifyWorkerRequest } from '@/lib/newsletter-config';
import { randomUUID } from 'node:crypto';
import { runNewsletterWorker } from '@/lib/newsletter-worker';

export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (!request.headers.get('x-newsletter-signature')) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.text();
  if (body !== '{}' || !verifyWorkerRequest(body, request.headers)) return NextResponse.json({ ok: false }, { status: 401 });
  const requested = request.headers.get('x-newsletter-request-id') || '';
  const requestId = /^[a-f0-9-]{36}$/.test(requested) ? requested : randomUUID();
  const result = await runNewsletterWorker(requestId);
  return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store', 'x-newsletter-request-id': requestId } });
}
