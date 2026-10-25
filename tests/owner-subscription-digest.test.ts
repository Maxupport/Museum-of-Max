import { describe, expect, it } from 'vitest';
import { completedSubscriptionDay, ownerSubscriptionDigestMessage } from '@/lib/owner-subscription-digest';

describe('Taipei daily owner subscription digest', () => {
  it('waits until 00:05, then covers the full previous local day across month boundaries', () => {
    expect(completedSubscriptionDay(new Date('2026-10-31T16:04:59Z'))).toBeNull();
    const day = completedSubscriptionDay(new Date('2026-10-31T16:05:00Z'))!;
    expect(day.date).toBe('2026-10-31');
    expect(day.start.toISOString()).toBe('2026-10-30T16:00:00.000Z');
    expect(day.end.toISOString()).toBe('2026-10-31T16:00:00.000Z');
    expect(day.end.getTime() - day.start.getTime()).toBe(86_400_000);
  });
  it('has the fixed private workbook link, not an attachment or a public sharing token', () => {
    const message = ownerSubscriptionDigestMessage({ date: '2026-10-25', newSubscribers: 3, activeSubscribers: 9, totalSubscribers: 10 });
    expect(message.html).toContain('10MojPCfHzAyCuYeGEVB91pFFEm1ufFn8rhc5eafpebI/edit');
    expect(message.html).toContain('3 人'); expect(message.html).not.toContain('unsubscribe');
    expect(() => ownerSubscriptionDigestMessage({ date: '<script>', newSubscribers: 1, activeSubscribers: 1, totalSubscribers: 1 })).toThrow();
    expect(() => ownerSubscriptionDigestMessage({ date: '2026-10-25', newSubscribers: 0, activeSubscribers: 1, totalSubscribers: 1 })).toThrow();
  });
});
