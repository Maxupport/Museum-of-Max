import { createHmac, timingSafeEqual } from 'crypto';

function signature(body: string, timestamp: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  return createHmac('sha256', secret).update(`museum-crawler-v1\n${timestamp}\n${body}`).digest('hex');
}

export function signCrawlerRequest(body: string): Record<string, string> | null {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const digest = signature(body, timestamp);
  return digest ? { 'x-crawler-time': timestamp, 'x-crawler-signature': digest } : null;
}

export function verifyCrawlerRequest(body: string, headers: Headers): boolean {
  const timestamp = headers.get('x-crawler-time') || '';
  const digest = headers.get('x-crawler-signature') || '';
  if (!/^\d{10,12}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(digest)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 60) return false;
  const expected = signature(body, timestamp);
  return expected !== null && timingSafeEqual(Buffer.from(expected), Buffer.from(digest));
}
