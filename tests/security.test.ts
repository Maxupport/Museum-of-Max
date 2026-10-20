import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, type NextFetchEvent } from 'next/server';
import { generateAdminToken, validateAdminToken } from '@/lib/auth';

type ApiRoute = Record<string, (
  request: NextRequest, context: { params: Promise<{ id: string }> }
) => Promise<Response>>;
const apiRoutes = import.meta.glob('../app/api/**/route.ts') as Record<string, () => Promise<ApiRoute>>;

const mocks = vi.hoisted(() => ({
  cookieValues: new Map<string, string>(),
  after: vi.fn(),
  prisma: {
    writingsItem: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    novel: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    subscriber: { findMany: vi.fn(), create: vi.fn(), upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    passcode: { findMany: vi.fn() },
    pageView: { create: vi.fn() },
  },
  sendWelcomeEmail: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('next/server', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/server')>(), after: mocks.after,
}));
vi.mock('@/lib/email', () => ({ sendWelcomeEmail: mocks.sendWelcomeEmail }));
vi.mock('@/components/ArticleDetailClient', () => ({ default: () => null }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => {
    const value = mocks.cookieValues.get(name);
    return value === undefined ? undefined : { value };
  } }),
}));

function request(path: string, method = 'GET', body?: unknown, cookie = '') {
  return new NextRequest(`https://museum.test${path}`, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.stubEnv('ADMIN_USERNAME', 'test-curator');
  vi.stubEnv('ADMIN_PASSWORD', 'test-only-password');
  vi.stubEnv('ADMIN_SESSION_SECRET', 'test-only-session-secret');
  mocks.cookieValues.clear();
  mocks.prisma.subscriber.findUnique.mockResolvedValue(null);
});

afterEach(() => vi.unstubAllEnvs());

describe('protected API boundaries', () => {
  it.each([
    ['/api/passcodes', 'GET'], ['/api/passcodes', 'POST'],
    ['/api/passcodes/[id]', 'PUT'], ['/api/passcodes/[id]', 'DELETE'],
    ['/api/subscribe', 'GET'], ['/api/subscribe/export', 'GET'], ['/api/subscribe/[id]', 'DELETE'],
    ['/api/stats', 'GET'], ['/api/stats/reset', 'POST'], ['/api/upload', 'POST'],
    ['/api/newsletter/dispatch', 'POST'], ['/api/novels', 'POST'],
    ['/api/novels/[id]', 'PUT'], ['/api/novels/[id]', 'DELETE'],
    ['/api/writings', 'POST'], ['/api/writings/[id]', 'PUT'], ['/api/writings/[id]', 'DELETE'],
    ['/api/career', 'POST'], ['/api/career/[id]', 'PUT'], ['/api/career/[id]', 'DELETE'],
    ['/api/venture', 'POST'], ['/api/venture/[id]', 'PUT'], ['/api/venture/[id]', 'DELETE'],
    ['/api/music', 'POST'], ['/api/music/[id]', 'PUT'], ['/api/music/[id]', 'DELETE'],
  ])('rejects forged admin cookies at %s %s before accessing data', async (path, method) => {
    const route = await apiRoutes[`../app${path}/route.ts`]();
    const response = await route[method](request(path, method, undefined,
      'admin_token=forged; is_curator=true; visitor_token=curator_admin'), { params: Promise.resolve({ id: 'test-id' }) });
    expect(response.status).toBe(401);
    for (const model of Object.values(mocks.prisma)) {
      for (const query of Object.values(model)) expect(query).not.toHaveBeenCalled();
    }
  });

  it('keeps valid admin login, authentication status, and logout working', async () => {
    const route = await import('@/app/api/auth/admin/route');
    const login = await route.POST(request('/api/auth/admin', 'POST', {
      username: 'test-curator', password: 'test-only-password',
    }));
    expect(login.status).toBe(200);
    const token = login.cookies.get('admin_token')?.value;
    expect(validateAdminToken(token)).toBe(true);
    expect(login.headers.get('set-cookie')).toContain('HttpOnly');
    expect(await (await route.GET(request('/api/auth/admin', 'GET', undefined, `admin_token=${token}`))).json())
      .toEqual({ authenticated: true });
    expect(await (await route.GET(request('/api/auth/admin', 'GET', undefined, 'is_curator=true'))).json())
      .toEqual({ authenticated: false });
    expect((await route.DELETE()).cookies.get('admin_token')?.value).toBe('');
  });

  it('validates login input types and rejects wrong credentials', async () => {
    const { POST } = await import('@/app/api/auth/admin/route');
    expect((await POST(request('/api/auth/admin', 'POST', { username: {}, password: [] }))).status).toBe(400);
    expect((await POST(request('/api/auth/admin', 'POST', { username: 'test-curator', password: 'wrong' }))).status).toBe(401);
  });

  it('protects admin pages with the same signed session and leaves public detail pages open', async () => {
    const { proxy } = await import('@/proxy');
    const event = { waitUntil: vi.fn() } as unknown as NextFetchEvent;
    expect(proxy(request('/admin', 'GET', undefined, 'admin_token=forged; is_curator=true'), event).status).toBe(307);
    expect(proxy(request('/admin', 'GET', undefined, `admin_token=${generateAdminToken()}`), event).status).toBe(200);
    expect(proxy(request('/museum/sound/public-1'), event).status).toBe(200);
    expect(proxy(request('/museum/creation_lab/novel/novel-1'), event).status).toBe(200);
    expect(proxy(request('/museum', 'GET', undefined, 'visitor_token=preset-vc; visitor_permissions=%5B%22vc%22%5D'), event).status).toBe(200);
  });

  it('allows a signed admin session to create, edit, and delete novel metadata', async () => {
    const collection = await import('@/app/api/novels/route');
    const detail = await import('@/app/api/novels/[id]/route');
    const cookie = `admin_token=${generateAdminToken()}`;
    mocks.prisma.novel.upsert.mockResolvedValue({ id: 'novel-1', title: '測試小說' });
    mocks.prisma.novel.update.mockResolvedValue({ id: 'novel-1', title: '新書名' });
    const params = { params: Promise.resolve({ id: 'novel-1' }) };
    expect((await collection.POST(request('/api/novels', 'POST', { title: '測試小說' }, cookie))).status).toBe(200);
    expect((await detail.PUT(request('/api/novels/novel-1', 'PUT', { title: '新書名' }, cookie), params)).status).toBe(200);
    expect((await detail.DELETE(request('/api/novels/novel-1', 'DELETE', undefined, cookie), params)).status).toBe(200);
    expect(mocks.prisma.novel.upsert).toHaveBeenCalledOnce();
    expect(mocks.prisma.novel.update).toHaveBeenCalledOnce();
    expect(mocks.prisma.novel.delete).toHaveBeenCalledWith({ where: { id: 'novel-1' } });
  });
});

describe('article visibility', () => {
  it('ignores includeHidden=true for anonymous and forged admin requests', async () => {
    const { GET } = await import('@/app/api/writings/route');
    mocks.prisma.writingsItem.findMany.mockResolvedValue([]);
    for (const cookie of ['', 'is_curator=true']) {
      const response = await GET(request('/api/writings?includeHidden=true&exhibitId=sound', 'GET', undefined, cookie));
      expect(response.status).toBe(200);
      expect(mocks.prisma.writingsItem.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
        where: { exhibitId: 'sound', isHidden: false },
      }));
    }
  });

  it('preserves admin access to the hidden article list', async () => {
    const { GET } = await import('@/app/api/writings/route');
    mocks.prisma.writingsItem.findMany.mockResolvedValue([{ id: 'hidden-1', isHidden: true }]);
    const response = await GET(request('/api/writings?includeHidden=true', 'GET', undefined, `admin_token=${generateAdminToken()}`));
    expect((await response.json()).data).toHaveLength(1);
    expect(mocks.prisma.writingsItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('hides single articles from anonymous readers but permits signed admin previews', async () => {
    const { GET } = await import('@/app/api/writings/[id]/route');
    mocks.prisma.writingsItem.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'hidden-1', isHidden: true });
    const params = { params: Promise.resolve({ id: 'hidden-1' }) };
    expect((await GET(request('/api/writings/hidden-1'), params)).status).toBe(404);
    expect(mocks.prisma.writingsItem.findFirst).toHaveBeenLastCalledWith({ where: { id: 'hidden-1', isHidden: false } });
    expect((await GET(request('/api/writings/hidden-1', 'GET', undefined, `admin_token=${generateAdminToken()}`), params)).status).toBe(200);
    expect(mocks.prisma.writingsItem.findFirst).toHaveBeenLastCalledWith({ where: { id: 'hidden-1' } });
  });

  it('applies the same visibility and exhibit checks to server-rendered pages and metadata', async () => {
    const { getPageArticle } = await import('@/lib/articles');
    mocks.prisma.writingsItem.findFirst.mockResolvedValue(null);
    await getPageArticle('sound', 'hidden-1');
    expect(mocks.prisma.writingsItem.findFirst).toHaveBeenLastCalledWith({
      where: { id: 'hidden-1', exhibitId: 'sound', isHidden: false },
    });
    mocks.cookieValues.set('is_curator', 'true');
    await getPageArticle('sound', 'hidden-1');
    expect(mocks.prisma.writingsItem.findFirst).toHaveBeenLastCalledWith({
      where: { id: 'hidden-1', exhibitId: 'sound', isHidden: false },
    });
    mocks.cookieValues.set('admin_token', generateAdminToken());
    await getPageArticle('sound', 'hidden-1');
    expect(mocks.prisma.writingsItem.findFirst).toHaveBeenLastCalledWith({ where: { id: 'hidden-1', exhibitId: 'sound' } });
  });

  it('returns 404 and no private metadata for an inaccessible article page', async () => {
    const { default: Page, generateMetadata } = await import('@/app/museum/[exhibitId]/[articleId]/page');
    mocks.prisma.writingsItem.findFirst.mockResolvedValue(null);
    const props = { params: Promise.resolve({ exhibitId: 'sound', articleId: 'hidden-1' }) };
    await expect(Page(props)).rejects.toThrow('404');
    const metadata = await generateMetadata(props);
    expect(metadata.description).not.toContain('private');
    expect(metadata.openGraph).toBeUndefined();
  });

  it('renders published article data while escaping HTML in structured metadata', async () => {
    const { default: Page, generateMetadata } = await import('@/app/museum/[exhibitId]/[articleId]/page');
    const title = '</script><script>alert(1)</script>';
    mocks.prisma.writingsItem.findFirst.mockResolvedValue({
      id: 'public-1', exhibitId: 'sound', title, content: '公開內容', category: '心得',
      createdAt: new Date('2026-10-20'), updatedAt: new Date('2026-10-20'),
    });
    const props = { params: Promise.resolve({ exhibitId: 'sound', articleId: 'public-1' }) };
    const element = await Page(props);
    const jsonLd = element.props.children[0].props.dangerouslySetInnerHTML.__html;
    expect(jsonLd).not.toContain('</script>');
    expect(JSON.parse(jsonLd).headline).toBe(title);
    expect((await generateMetadata(props)).title).toContain(title);
  });

  it('keeps published articles and novel chapters publicly readable', async () => {
    const article = await import('@/app/api/writings/[id]/route');
    mocks.prisma.writingsItem.findFirst.mockResolvedValue({ id: 'public-1', content: '公開文章' });
    expect((await (await article.GET(request('/api/writings/public-1'), { params: Promise.resolve({ id: 'public-1' }) })).json()).data.content).toBe('公開文章');
    const novel = await import('@/app/api/novels/[id]/route');
    mocks.prisma.novel.findUnique.mockResolvedValue({ id: 'novel-1', title: '小說' });
    mocks.prisma.writingsItem.findMany.mockResolvedValue([{ id: 'chapter-1', content: '公開章節' }]);
    const response = await novel.GET(request('/api/novels/novel-1'), { params: Promise.resolve({ id: 'novel-1' }) });
    expect((await response.json()).data.chapters[0].content).toBe('公開章節');
    expect(mocks.prisma.writingsItem.findMany).toHaveBeenLastCalledWith({
      where: { category: '小說', topic: '小說', isHidden: false }, orderBy: { order: 'asc' },
    });
  });
});

describe('visitor and subscription compatibility', () => {
  it.each([['VC2026', '/museum'], ['Series', '/museum/creation_lab']])('preserves preset passcode %s', async (passcode, redirectUrl) => {
    const { POST } = await import('@/app/api/auth/visitor/route');
    mocks.prisma.passcode.findMany.mockResolvedValue([]);
    const response = await POST(request('/api/auth/visitor', 'POST', { passcode }));
    expect(response.status).toBe(200);
    expect((await response.json()).redirectUrl).toBe(redirectUrl);
    expect(response.cookies.get('visitor_token')?.value).toMatch(/^preset-/);
    expect(response.cookies.get('admin_token')?.value).toBe('');
  });

  it('preserves existing curator passcode login with a signed admin session', async () => {
    const { POST } = await import('@/app/api/auth/visitor/route');
    mocks.prisma.passcode.findMany.mockResolvedValue([{
      id: 'curator-1', code: 'test-curator-passcode', note: '策展人', avatarUrl: null, permissions: '["sound"]',
    }]);
    const response = await POST(request('/api/auth/visitor', 'POST', { passcode: 'test-curator-passcode' }));
    expect(response.status).toBe(200);
    expect(validateAdminToken(response.cookies.get('admin_token')?.value)).toBe(true);
  });

  it('accepts subscriptions without exposing subscriber details or unsubscribe tokens', async () => {
    const { POST } = await import('@/app/api/subscribe/route');
    mocks.prisma.subscriber.create.mockResolvedValue({
      id: 'subscriber-1', email: 'reader@example.test', unsubscribeToken: 'private-token', active: true,
    });
    const response = await POST(request('/api/subscribe', 'POST', { email: ' Reader@Example.test ', novelId: 'novel-1' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, message: expect.any(String) });
    expect(mocks.prisma.subscriber.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: 'reader@example.test' }) }));
    expect(mocks.sendWelcomeEmail).not.toHaveBeenCalled();
    await mocks.after.mock.calls[0][0]();
    expect(mocks.sendWelcomeEmail).toHaveBeenCalledWith(expect.objectContaining({ unsubscribeToken: 'private-token' }));
  });

  it('does not resend welcomes, overwrite a reader, or reactivate an opted-out email', async () => {
    const { POST } = await import('@/app/api/subscribe/route');
    mocks.prisma.subscriber.findUnique.mockResolvedValue({ id: 'existing-1' });
    const response = await POST(request('/api/subscribe', 'POST', { email: 'reader@example.test', name: 'overwrite' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, message: expect.any(String) });
    expect(mocks.prisma.subscriber.create).not.toHaveBeenCalled();
    expect(mocks.prisma.subscriber.update).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it('handles simultaneous duplicate subscriptions without duplicate email', async () => {
    const { POST } = await import('@/app/api/subscribe/route');
    mocks.prisma.subscriber.create.mockRejectedValueOnce({ code: 'P2002' });
    expect((await POST(request('/api/subscribe', 'POST', { email: 'reader@example.test' }))).status).toBe(200);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it.each([{ name: {} }, { novelId: [] }, { novelTitle: 'x'.repeat(201) }, { sourceChapter: -1 }, { sourceChapter: 1.2 }])('rejects malformed subscription details %j', async (details) => {
    const { POST } = await import('@/app/api/subscribe/route');
    expect((await POST(request('/api/subscribe', 'POST', { email: 'reader@example.test', ...details }))).status).toBe(400);
    expect(mocks.prisma.subscriber.findUnique).not.toHaveBeenCalled();
  });

  it('rejects invalid subscription email before touching the database', async () => {
    const { POST } = await import('@/app/api/subscribe/route');
    const response = await POST(request('/api/subscribe', 'POST', { email: 'not-an-email' }));
    expect(response.status).toBe(400);
    expect(mocks.prisma.subscriber.upsert).not.toHaveBeenCalled();
  });

  it('preserves token-based unsubscribe', async () => {
    const { POST } = await import('@/app/api/subscribe/unsubscribe/route');
    mocks.prisma.subscriber.findUnique.mockResolvedValue({ id: 'subscriber-1' });
    mocks.prisma.subscriber.update.mockResolvedValue({ email: 'reader@example.test', active: false });
    const response = await POST(request('/api/subscribe/unsubscribe', 'POST', { token: 'private-token' }));
    expect(response.status).toBe(200);
    expect(mocks.prisma.subscriber.update).toHaveBeenCalledWith({ where: { id: 'subscriber-1' }, data: { active: false } });
  });
});
