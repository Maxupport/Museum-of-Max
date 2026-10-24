import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, type NextFetchEvent } from 'next/server';
import sharp from 'sharp';
import { generateAdminToken } from '@/lib/auth';
import { csvCell } from '@/lib/csv';
import { prepareUploadImage, MAX_IMAGE_BYTES } from '@/lib/upload-image';
import { signCrawlerRequest, verifyCrawlerRequest } from '@/lib/crawler-auth';

const mocks = vi.hoisted(() => ({
  prisma: {
    aiCrawlerLog: { create: vi.fn() },
    subscriber: { findMany: vi.fn(), updateMany: vi.fn() },
    novelUpdate: { create: vi.fn(), update: vi.fn() },
  },
  sendChapterUpdateEmail: vi.fn(),
  queueCampaign: vi.fn(),
  put: vi.fn(), mkdir: vi.fn(), writeFile: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/email', () => ({ sendChapterUpdateEmail: mocks.sendChapterUpdateEmail }));
vi.mock('@/lib/newsletter-queue', () => ({ queueCampaign: mocks.queueCampaign }));
vi.mock('@vercel/blob', () => ({ put: mocks.put }));
vi.mock('fs/promises', () => ({ mkdir: mocks.mkdir, writeFile: mocks.writeFile }));

beforeEach(() => {
  vi.stubEnv('ADMIN_USERNAME', 'test');
  vi.stubEnv('ADMIN_PASSWORD', 'test-only-password');
  vi.stubEnv('ADMIN_SESSION_SECRET', 'test-only-secret');
  mocks.sendChapterUpdateEmail.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function adminRequest(path: string, body: unknown) {
  return new NextRequest(`https://museum.test${path}`, {
    method: 'POST', headers: { cookie: `admin_token=${generateAdminToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('safe CSV exports', () => {
  it.each(['=HYPERLINK("https://bad.test")', '+CMD', '-CMD', '@SUM(1)', '   =1', '\t=1', '\r=1', '\n=1'])('neutralizes %j', (value) => {
    expect(csvCell(value)).toBe(`"'${value.replace(/"/g, '""')}"`);
  });
  it('preserves normal names, plus-addressed emails, commas, quotes and line breaks', () => {
    expect(csvCell('reader+book@example.test')).toBe('"reader+book@example.test"');
    expect(csvCell('讀者,"甲"\n乙')).toBe('"讀者,""甲""\n乙"');
    expect(csvCell(null)).toBe('""');
  });
  it('escapes every column in the authenticated export', async () => {
    const { GET } = await import('@/app/api/subscribe/export/route');
    mocks.prisma.subscriber.findMany.mockResolvedValueOnce([{
      email: '=formula@example.test', name: '@malicious', novelId: 'bad,"book', active: true,
      createdAt: new Date('2026-10-20'), lastNotifiedAt: null,
    }]);
    const response = await GET(adminRequest('/api/subscribe/export', {}));
    const text = await response.text();
    expect(text).toContain('"\'=formula@example.test","\'@malicious","bad,""book"');
    expect(response.headers.get('content-type')).toContain('text/csv');
  });
});

describe('upload content verification', () => {
  it.each(['png', 'jpeg', 'webp'] as const)('decodes and re-encodes a genuine %s without trusting its filename', async (format) => {
    const buffer = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).toFormat(format).toBuffer();
    const result = await prepareUploadImage(new File([new Uint8Array(buffer)], 'dangerous.html', { type: `image/${format}` }));
    expect(result.extension).toBe(format === 'jpeg' ? 'jpg' : format);
    expect((await sharp(result.buffer).metadata()).format).toBe(format);
  });
  it.each([
    new File(['<svg onload="alert(1)"></svg>'], 'image.svg', { type: 'image/svg+xml' }),
    new File(['<html>fake png</html>'], 'image.png', { type: 'image/png' }),
    new File([], 'empty.png', { type: 'image/png' }),
    new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'huge.png', { type: 'image/png' }),
  ])('rejects unsupported, forged, empty or oversized files', async (file) => {
    await expect(prepareUploadImage(file)).rejects.toThrow();
  });
  it('rejects MIME mismatches and excessive pixel counts', async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
    await expect(prepareUploadImage(new File([new Uint8Array(png)], 'a.jpg', { type: 'image/jpeg' }))).rejects.toThrow();
    const huge = await sharp({ create: { width: 4001, height: 4001, channels: 3, background: 'white' } }).png().toBuffer();
    await expect(prepareUploadImage(new File([new Uint8Array(huge)], 'a.png', { type: 'image/png' }))).rejects.toThrow();
  });
  it('rejects strings in multipart file fields without writing anything', async () => {
    const { POST } = await import('@/app/api/upload/route');
    const form = new FormData(); form.set('file', 'not-a-file');
    const response = await POST(new NextRequest('https://museum.test/api/upload', {
      method: 'POST', headers: { cookie: `admin_token=${generateAdminToken()}` }, body: form,
    }));
    expect(response.status).toBe(400);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
  it('publishes only verified image bytes with a safe extension and content type', async () => {
    const { POST } = await import('@/app/api/upload/route');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-only-blob-token');
    mocks.put.mockResolvedValueOnce({ url: 'https://blob.test/safe.png' });
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
    const form = new FormData(); form.set('file', new File([new Uint8Array(png)], '../../attack.html', { type: 'image/png' }));
    const response = await POST(new NextRequest('https://museum.test/api/upload', {
      method: 'POST', headers: { cookie: `admin_token=${generateAdminToken()}` }, body: form,
    }));
    expect(response.status).toBe(200);
    expect(mocks.put).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9-]+\.png$/), expect.any(Buffer), expect.objectContaining({ contentType: 'image/png' }));
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
});

describe('internal crawler authentication', () => {
  const payload = JSON.stringify({ botFamily: 'OpenAI', botName: 'GPTBot', userAgent: 'GPTBot', path: '/' });
  it('binds the signature to the exact request body and a short timestamp window', () => {
    const headers = new Headers(signCrawlerRequest(payload)!);
    expect(verifyCrawlerRequest(payload, headers)).toBe(true);
    expect(verifyCrawlerRequest(payload + ' ', headers)).toBe(false);
    vi.useFakeTimers(); vi.advanceTimersByTime(61_000);
    expect(verifyCrawlerRequest(payload, headers)).toBe(false);
  });
  it('fails closed when the secret is absent or the signature malformed', () => {
    const headers = new Headers(signCrawlerRequest(payload)!);
    vi.stubEnv('ADMIN_SESSION_SECRET', '');
    expect(signCrawlerRequest(payload)).toBeNull();
    expect(verifyCrawlerRequest(payload, headers)).toBe(false);
    expect(verifyCrawlerRequest(payload, new Headers({ 'x-crawler-signature': 'bad' }))).toBe(false);
  });
  it('rejects direct callers before recording anything and returns no database record', async () => {
    const { POST } = await import('@/app/api/internal/track-crawler/route');
    const unsigned = new NextRequest('https://museum.test/api/internal/track-crawler', { method: 'POST', body: payload });
    expect((await POST(unsigned)).status).toBe(401);
    expect(mocks.prisma.aiCrawlerLog.create).not.toHaveBeenCalled();
    const signed = new NextRequest(unsigned.url, { method: 'POST', body: payload, headers: signCrawlerRequest(payload)! });
    expect(await (await POST(signed)).json()).toEqual({ ok: true });
    expect(mocks.prisma.aiCrawlerLog.create).toHaveBeenCalledOnce();
  });
  it('rejects signed but malformed or inconsistent payloads', async () => {
    const { POST } = await import('@/app/api/internal/track-crawler/route');
    for (const body of ['null', '{', JSON.stringify({ botFamily: 'fake', botName: 'fake', path: '/', userAgent: 'GPTBot' })]) {
      expect((await POST(new NextRequest('https://museum.test/api/internal/track-crawler', {
        method: 'POST', body, headers: signCrawlerRequest(body)!,
      }))).status).toBe(400);
    }
    expect(mocks.prisma.aiCrawlerLog.create).not.toHaveBeenCalled();
  });
  it('signs background proxy logging while keeping public crawler access working', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { proxy } = await import('@/proxy');
    const event = { waitUntil: vi.fn() } as unknown as NextFetchEvent;
    expect(proxy(new NextRequest('https://museum.test/museum/sound/article', { headers: { 'user-agent': 'GPTBot' } }), event).status).toBe(200);
    const options = fetchMock.mock.calls[0][1];
    expect(verifyCrawlerRequest(options.body, new Headers(options.headers))).toBe(true);
    expect(event.waitUntil).toHaveBeenCalledOnce();
    expect(proxy(new NextRequest('https://museum.test/admin', { headers: { 'user-agent': 'GPTBot' } }), event).status).toBe(403);
  });
});

describe('newsletter queue API', () => {
  const subscribers = ['one', 'two', 'three'].map((id) => ({ id, email: `${id}@example.test`, name: id, unsubscribeToken: 'test-token' }));
  beforeEach(() => {
    mocks.queueCampaign.mockResolvedValue({ campaignId: 'update-1', duplicate: false, queuedCount: 3 });
    mocks.prisma.subscriber.findMany.mockResolvedValue(subscribers);
    mocks.prisma.novelUpdate.create.mockResolvedValue({ id: 'update-1', sent: false });
    mocks.prisma.novelUpdate.update.mockResolvedValue({ id: 'update-1' });
  });
  it('acknowledges queueing without claiming delivery or updating notified timestamps', async () => {
    mocks.sendChapterUpdateEmail.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false }).mockRejectedValueOnce(new Error('network'));
    const { POST } = await import('@/app/api/newsletter/dispatch/route');
    const response = await POST(adminRequest('/api/newsletter/dispatch', { eventId: 'event-test-1', novelId: 'book-1', chapterTitle: '測試章節' }));
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ queuedCount: 3 });
    expect(mocks.queueCampaign).toHaveBeenCalledWith(expect.objectContaining({ novelId: 'book-1', chapterTitle: '測試章節' }), 'event-test-1', false);
    expect(mocks.sendChapterUpdateEmail).not.toHaveBeenCalled();
    expect(mocks.prisma.subscriber.updateMany).not.toHaveBeenCalled();
  });
  it('rejects requests missing a title and stable event id', async () => {
    mocks.sendChapterUpdateEmail.mockResolvedValue({ ok: false, error: 'rejected' });
    const { POST } = await import('@/app/api/newsletter/dispatch/route');
    const response = await POST(adminRequest('/api/newsletter/dispatch', {}));
    expect(response.status).toBe(400);
    expect(mocks.queueCampaign).not.toHaveBeenCalled();
    expect(mocks.prisma.subscriber.updateMany).not.toHaveBeenCalled();
  });
  it('rejects arbitrary test recipients and only queues owner tests', async () => {
    mocks.sendChapterUpdateEmail.mockResolvedValue({ ok: true });
    const { POST } = await import('@/app/api/newsletter/dispatch/route');
    const payload = { eventId: 'test-event-1', chapterTitle: '測試', isTest: true };
    expect((await POST(adminRequest('/api/newsletter/dispatch', { ...payload, testEmail: 'other@example.test' }))).status).toBe(400);
    expect((await POST(adminRequest('/api/newsletter/dispatch', { ...payload, testEmail: 'maxupport@gmail.com' }))).status).toBe(202);
    expect(mocks.queueCampaign).toHaveBeenCalledWith(expect.any(Object), 'test-event-1', true);
  });
});
