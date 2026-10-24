import { describe, expect, it } from 'vitest';
import plan from '../config/novel-release-plan.json';

describe('author-approved novel release calendar (not an active scheduler)', () => {
  it('keeps the unactivated plan explicit', () => {
    expect(plan.status).toBe('draft-not-active');
    expect(plan.timezone).toBe('Asia/Taipei');
    expect(plan.deliveryPolicy.publishBeforeEmail).toBe(true);
    expect(plan.deliveryPolicy.maxRecipientsPerRolling24Hours).toBe(80);
  });

  it('starts on the first approved weekday, not Sunday November 1', () => {
    expect(plan.requestedStartDate).toBe('2026-11-01');
    expect(plan.novels.map((novel) => novel.chapters[0].publishAt)).toEqual([
      '2026-11-03T00:30:00.000Z', '2026-11-04T00:30:00.000Z',
    ]);
  });

  it('contains every numbered chapter exactly once in ascending order', () => {
    expect(plan.novels.map((novel) => novel.chapters.length)).toEqual([14, 33]);
    for (const novel of plan.novels) {
      expect(novel.chapters.map((chapter) => chapter.chapter)).toEqual(
        Array.from({ length: novel.chapters.length }, (_, index) => index + 1),
      );
      const dates = novel.chapters.map((chapter) => chapter.publishAt);
      expect(dates).toEqual([...dates].sort());
    }
  });

  it('publishes only on the approved weekdays at Taiwan 08:30', () => {
    for (const novel of plan.novels) for (const chapter of novel.chapters) {
      const date = new Date(chapter.publishAt);
      expect(novel.publicationWeekdays).toContain(date.getUTCDay());
      expect(date.toISOString()).toBe(chapter.publishAt);
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(30);
    }
  });

  it('never publishes both novels in the same slot', () => {
    const dates = plan.novels.flatMap((novel) => novel.chapters.map((chapter) => chapter.publishAt));
    expect(new Set(dates).size).toBe(47);
  });

  it('covers every Tuesday through Friday while both novels are running', () => {
    const dates = new Set(plan.novels.flatMap((novel) => novel.chapters.map((chapter) => chapter.publishAt)));
    for (let day = Date.parse('2026-11-03T00:30:00.000Z'); day <= Date.parse('2027-01-15T00:30:00.000Z'); day += 86_400_000) {
      const date = new Date(day);
      if ([2, 3, 4, 5].includes(date.getUTCDay())) expect(dates.has(date.toISOString())).toBe(true);
    }
  });

  it('preserves the approved weekly cadence and last chapter dates', () => {
    expect(plan.novels.map((novel) => novel.publicationWeekdays)).toEqual([[2], [3, 4, 5]]);
    expect(plan.novels.map((novel) => novel.chapters.at(-1)?.publishAt)).toEqual([
      '2027-02-02T00:30:00.000Z', '2027-01-15T00:30:00.000Z',
    ]);
  });
});
