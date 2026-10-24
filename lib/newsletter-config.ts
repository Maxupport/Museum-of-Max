import { createHmac, timingSafeEqual } from 'node:crypto';

export const NEWSLETTER_LIMIT = 80;
export const NEWSLETTER_WINDOW_MS = 24 * 60 * 60 * 1000;
export const NEWSLETTER_SENDER = 'maxupport@gmail.com';
export const SUBSCRIBER_SHEET_ID = '10MojPCfHzAyCuYeGEVB91pFFEm1ufFn8rhc5eafpebI';

export function newsletterConfig() {
  const bridgeUrl = process.env.GOOGLE_NEWSLETTER_WEBHOOK_URL || '';
  const secret = process.env.GOOGLE_NEWSLETTER_SECRET || '';
  let validUrl = false;
  try {
    const url = new URL(bridgeUrl);
    validUrl = url.protocol === 'https:' && url.hostname === 'script.google.com' &&
      /^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname) && !url.search && !url.hash;
  } catch { /* Missing configuration is expected before Google authorization. */ }
  return {
    bridgeUrl, secret, configured: validUrl && secret.length >= 32,
    enabled: process.env.NEWSLETTER_ENABLED === 'true',
    syncEnabled: process.env.NEWSLETTER_SHEETS_SYNC_ENABLED === 'true',
    testOnly: process.env.NEWSLETTER_TEST_ONLY !== 'false',
    autoUpdatesEnabled: process.env.NEWSLETTER_AUTO_UPDATES === 'true',
  };
}

export function serviceSignature(body: string, timestamp: string, purpose: 'bridge' | 'worker') {
  const { secret } = newsletterConfig();
  if (secret.length < 32) throw new Error('Google newsletter secret is not configured');
  return createHmac('sha256', secret).update(`museum-newsletter-${purpose}-v1\n${timestamp}\n${body}`).digest('hex');
}

export function verifyWorkerRequest(body: string, headers: Headers) {
  const timestamp = headers.get('x-newsletter-time') || '';
  const signature = headers.get('x-newsletter-signature') || '';
  if (!/^\d{10,12}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 || newsletterConfig().secret.length < 32) return false;
  const expected = serviceSignature(body, timestamp, 'worker');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function callGoogleBridge(payload: Record<string, unknown>) {
  const { bridgeUrl, configured } = newsletterConfig();
  if (!configured) throw new Error('Google newsletter bridge is not configured');
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await fetch(bridgeUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp, payload: body, signature: serviceSignature(body, timestamp, 'bridge') }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('Google newsletter bridge unavailable');
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || !('ok' in result) || result.ok !== true ||
      !('status' in result) || typeof result.status !== 'string') throw new Error('Invalid Google bridge response');
  return result as { ok: true; status: string };
}

// Deliberately incomplete operations: even if a switch is accidentally ON, these
// cannot pass syncReader/deliver validation, mutate the Sheet or send any mail.
// The deployed bridge already supports these safe probes, so no Google code
// changes or secret retrieval are necessary to verify the initial OFF state.
export async function verifyGoogleNewsletterSetup() {
  const config = newsletterConfig();
  const website = {
    configured: config.configured,
    sendingPaused: !config.enabled,
    syncPaused: !config.syncEnabled,
    testOnly: config.testOnly,
    autoUpdatesPaused: !config.autoUpdatesEnabled,
    siteUrlCorrect: process.env.NEXT_PUBLIC_SITE_URL === 'https://museum-of-max.vercel.app',
  };
  if (!config.configured) return { website, google: null, readyForControlledTesting: false };
  async function probe(operation: 'sync' | 'send', expectedStatus: 'paused' | 'deferred') {
    try {
      const body = JSON.stringify({ operation });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const response = await fetch(config.bridgeUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp, payload: body, signature: serviceSignature(body, timestamp, 'bridge') }),
        signal: AbortSignal.timeout(12000), cache: 'no-store',
      });
      if (!response.ok) return false;
      const reply: unknown = await response.json();
      return !!reply && typeof reply === 'object' && 'status' in reply && reply.status === expectedStatus &&
        'ok' in reply && reply.ok === (operation === 'send');
    } catch { return false; }
  }
  const syncPaused = await probe('sync', 'paused');
  const sendingPaused = await probe('send', 'deferred');
  return {
    website,
    google: { syncPaused, sendingPaused, signedConnectionVerified: syncPaused && sendingPaused },
    readyForControlledTesting: Object.values(website).every(Boolean) && syncPaused && sendingPaused,
  };
}
