import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ after: vi.fn(), process: vi.fn().mockResolvedValue({}) }));
vi.mock('next/server', () => ({ after: mocks.after }));
vi.mock('@/lib/newsletter-queue', () => ({ processNewsletterQueue: mocks.process }));
import { kickNewsletterQueue } from '@/lib/newsletter-kick';
afterEach(() => vi.unstubAllEnvs());

describe('best-effort acceleration with durable timer fallback', () => {
  it('does nothing while the bridge is unconfigured or all switches are OFF', () => {
    kickNewsletterQueue(); expect(mocks.after).not.toHaveBeenCalled();
  });
  it('schedules processing only after the caller has persisted work and uses the normal guarded worker', async () => {
    vi.stubEnv('GOOGLE_NEWSLETTER_WEBHOOK_URL', 'https://script.google.com/macros/s/test/exec');
    vi.stubEnv('GOOGLE_NEWSLETTER_SECRET', 'test-only-secret-at-least-32-characters');
    vi.stubEnv('NEWSLETTER_ENABLED', 'true');
    kickNewsletterQueue(); expect(mocks.after).toHaveBeenCalledOnce();
    await mocks.after.mock.calls[0][0](); expect(mocks.process).toHaveBeenCalledWith(3);
  });
});
