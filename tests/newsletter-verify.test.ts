import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAdminToken } from '@/lib/auth';
import { GET } from '@/app/api/newsletter/verify/route';

const secret = 'test-only-setup-secret-with-at-least-32-characters';
const url = 'https://script.google.com/macros/s/test-only-deployment/exec';
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv('ADMIN_USERNAME', 'setup-test');
  vi.stubEnv('ADMIN_PASSWORD', 'setup-test-password');
  vi.stubEnv('ADMIN_SESSION_SECRET', 'setup-test-admin-secret');
  vi.stubEnv('GOOGLE_NEWSLETTER_SECRET', secret);
  vi.stubEnv('GOOGLE_NEWSLETTER_WEBHOOK_URL', url);
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://museum-of-max.vercel.app');
  vi.stubEnv('NEWSLETTER_ENABLED', 'false');
  vi.stubEnv('NEWSLETTER_SHEETS_SYNC_ENABLED', 'false');
  vi.stubEnv('NEWSLETTER_AUTO_UPDATES', 'false');
  vi.stubEnv('NEWSLETTER_TEST_ONLY', 'true');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const request = () => new NextRequest('https://example.test/api/newsletter/verify', { headers: { cookie: `admin_token=${generateAdminToken()}` } });

describe('read-only newsletter setup verification', () => {
  it('rejects unauthenticated callers without contacting Google', async () => {
    expect((await GET(new NextRequest('https://example.test/api/newsletter/verify'))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('checks only deliberately incomplete signed operations and returns no secrets', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ok: false, status: 'paused' }))
      .mockResolvedValueOnce(Response.json({ ok: true, status: 'deferred' }));
    const result = await (await GET(request())).json();
    expect(result.data.readyForControlledTesting).toBe(true);
    expect(result.data.google.signedConnectionVerified).toBe(true);
    for (const [target, init] of fetchMock.mock.calls) {
      expect(target).toBe(url);
      const envelope = JSON.parse(init.body);
      expect(['{"operation":"sync"}', '{"operation":"send"}']).toContain(envelope.payload);
      expect(envelope.signature).toBe(createHmac('sha256', secret).update(`museum-newsletter-bridge-v1\n${envelope.timestamp}\n${envelope.payload}`).digest('hex'));
      expect(init.body).not.toContain(secret);
    }
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(url);
  });
  it('does not claim verified credentials when Google rejects them', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: false, status: 'unavailable' }));
    const result = await (await GET(request())).json();
    expect(result.data.google.signedConnectionVerified).toBe(false);
    expect(result.data.readyForControlledTesting).toBe(false);
  });
  it('fails safely on invalid configuration or provider/network failures', async () => {
    vi.stubEnv('GOOGLE_NEWSLETTER_SECRET', '');
    expect((await (await GET(request())).json()).data.google).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv('GOOGLE_NEWSLETTER_SECRET', secret);
    fetchMock.mockRejectedValue(new Error('transport failure containing private data'));
    expect((await (await GET(request())).json()).data.readyForControlledTesting).toBe(false);
  });
  it('detects unsafe website switches and an incorrect public base URL', async () => {
    vi.stubEnv('NEWSLETTER_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://wrong.example.test');
    fetchMock.mockResolvedValueOnce(Response.json({ ok: false, status: 'paused' }))
      .mockResolvedValueOnce(Response.json({ ok: true, status: 'deferred' }));
    const result = await (await GET(request())).json();
    expect(result.data.google.signedConnectionVerified).toBe(true);
    expect(result.data.website.sendingPaused).toBe(false);
    expect(result.data.website.siteUrlCorrect).toBe(false);
    expect(result.data.readyForControlledTesting).toBe(false);
  });
});
