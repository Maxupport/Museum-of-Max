import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send }; } }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('RESEND_API_KEY', 'test-only-key');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://museum.test');
  mocks.send.mockReset().mockResolvedValue({ data: { id: 'email-test' }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe('email safety and provider responses', () => {
  it('escapes reader names and book titles without corrupting the plain-text subject', async () => {
    const { sendWelcomeEmail } = await import('@/lib/email');
    expect((await sendWelcomeEmail({ email: 'reader@example.test', name: '<img src=x>', novelTitle: '<script>bad</script>', novelId: 'book/1', unsubscribeToken: 'a&b' })).ok).toBe(true);
    const options = mocks.send.mock.calls[0][0];
    expect(options.html).not.toContain('<script>bad</script>');
    expect(options.html).not.toContain('<img src=x>');
    expect(options.html).toContain('&lt;img src=x&gt;');
    expect(options.html).toContain('book%2F1');
    expect(options.html).toContain('token=a%26b');
    expect(options.subject).toContain('<script>bad</script>');
  });
  it('escapes chapter summaries and blocks executable links', async () => {
    const { sendChapterUpdateEmail } = await import('@/lib/email');
    await sendChapterUpdateEmail({ email: 'reader@example.test', novelTitle: '<book>', chapterTitle: '<chapter>', summary: '<img src=x>\n第二行', chapterUrl: 'javascript:alert(1)' });
    const options = mocks.send.mock.calls[0][0];
    expect(options.html).toContain('&lt;img src=x&gt;<br>第二行');
    expect(options.html).not.toContain('javascript:');
    expect(options.html).toContain('href="#"');
  });
  it('does not count a resolved API error as a successful send', async () => {
    mocks.send.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'private provider detail' } });
    const { sendWelcomeEmail, sendChapterUpdateEmail } = await import('@/lib/email');
    const welcome = await sendWelcomeEmail({ email: 'reader@example.test' });
    const chapter = await sendChapterUpdateEmail({ email: 'reader@example.test', novelTitle: '書名', chapterTitle: '章節', chapterUrl: 'https://museum.test/chapter' });
    expect(welcome.ok).toBe(false); expect(chapter.ok).toBe(false);
    expect(JSON.stringify(welcome)).not.toContain('private provider detail');
  });
  it('handles network failures without leaking recipient details', async () => {
    mocks.send.mockRejectedValue(new Error('recipient=private@example.test'));
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sendWelcomeEmail } = await import('@/lib/email');
    expect((await sendWelcomeEmail({ email: 'private@example.test' })).ok).toBe(false);
    expect(JSON.stringify(logger.mock.calls)).not.toContain('private@example.test');
  });
  it('reports missing configuration instead of pretending to send', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendWelcomeEmail } = await import('@/lib/email');
    expect((await sendWelcomeEmail({ email: 'reader@example.test' })).ok).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
