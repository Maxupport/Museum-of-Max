import { NextRequest, NextResponse } from 'next/server';
import { verifyWorkerRequest } from '@/lib/newsletter-config';
import { processNewsletterQueue } from '@/lib/newsletter-queue';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (!request.headers.get('x-newsletter-signature')) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.text();
  if (body !== '{}' || !verifyWorkerRequest(body, request.headers)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const data = await processNewsletterQueue(8);
    const timestamp = new Date().toISOString();
    await prisma.siteSetting.upsert({ where: { key: 'newsletter:v1:worker:last-run' },
      create: { key: 'newsletter:v1:worker:last-run', value: timestamp }, update: { value: timestamp } });
    return NextResponse.json({ ok: true, data });
  }
  catch { return NextResponse.json({ ok: false, error: 'Worker unavailable' }, { status: 503 }); }
}
