import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { verifyGoogleNewsletterSetup } from '@/lib/newsletter-config';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false }, { status: 401 });
  // Returns only setup booleans, never credentials, raw provider replies or PII.
  const data = await verifyGoogleNewsletterSetup();
  return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
}
