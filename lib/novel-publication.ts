import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { queuePublicationBatch } from '@/lib/newsletter-queue';
import { novelPrivateStoreConfig } from '@/lib/novel-private-store';
import { chapterIllustrationUrl } from '@/lib/novel-illustration';
import { preparedIllustrationReady } from '@/lib/novel-image-readiness';

const PREFIX = 'novel-publication:v1:slot:';
export type PublicationSlot = {
  id: string; novelId: string; chapterIds: string[]; publishAt: string;
  state: 'scheduled' | 'published' | 'blocked';
  publishedAt?: string; error?: 'CONTENT_CHANGED';
  // Hash approved text before scheduling; an unexpected later edit must not auto-publish.
  contentHashes: Record<string, string>;
};

export function chapterHash(content: string) {
  return createHash('sha256').update(content).digest('hex');
}

export function validatePublicationSlot(input: PublicationSlot) {
  if (!input || !/^[\w-]{1,128}$/.test(input.id) || !/^[\w-]{1,128}$/.test(input.novelId) ||
    !Array.isArray(input.chapterIds) || input.chapterIds.length < 1 || input.chapterIds.length > 2 ||
    new Set(input.chapterIds).size !== input.chapterIds.length ||
    input.chapterIds.some((id) => typeof id !== 'string' || !/^[\w-]{1,128}$/.test(id)) ||
    !input.contentHashes || input.chapterIds.some((id) => !/^[a-f0-9]{64}$/.test(input.contentHashes[id] || '')) ||
    !['scheduled', 'published', 'blocked'].includes(input.state) ||
    typeof input.publishAt !== 'string' || !Number.isFinite(Date.parse(input.publishAt)) ||
    new Date(input.publishAt).toISOString() !== input.publishAt) throw new Error('INVALID_PUBLICATION_SLOT');
  return input;
}

export async function novelPublicationStatus(now = new Date()) {
  const rows = await prisma.siteSetting.findMany({ where: { key: { startsWith: PREFIX } } });
  const counts = { scheduled: 0, published: 0, blocked: 0, invalid: 0, overdue: 0 };
  const slots: { id: string; novelId: string; publishAt: string; state: PublicationSlot['state']; chapterCount: number }[] = [];
  for (const row of rows) {
    try {
      const slot = validatePublicationSlot(JSON.parse(row.value) as PublicationSlot);
      if (row.key !== PREFIX + slot.id) throw new Error('INVALID_KEY');
      counts[slot.state]++;
      if (slot.state === 'scheduled' && Date.parse(slot.publishAt) <= now.getTime()) counts.overdue++;
      slots.push({ id: slot.id, novelId: slot.novelId, publishAt: slot.publishAt,
        state: slot.state, chapterCount: slot.chapterIds.length });
    } catch { counts.invalid++; }
  }
  slots.sort((a, b) => a.publishAt.localeCompare(b.publishAt));
  return { enabled: process.env.NOVEL_PUBLICATION_ENABLED === 'true',
    privateImageStoreConfigured: Boolean(novelPrivateStoreConfig()),
    checkedAt: now.toISOString(), ...counts, slots };
}

// Separate opt-in: deploying this code cannot accidentally activate a draft calendar.
// The existing signed five-minute worker is the only execution entry point.
export async function publishDueNovelChapters(now = new Date()) {
  if (process.env.NOVEL_PUBLICATION_ENABLED !== 'true') return { enabled: false, published: 0, blocked: 0 };
  return prisma.$transaction(async (tx) => {
    // Same lock as the mail outbox: public content + durable event commit together.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(726340821)`;
    const rows = await tx.siteSetting.findMany({ where: { key: { startsWith: PREFIX } } });
    const slots = rows.map((row) => {
      const slot = validatePublicationSlot(JSON.parse(row.value) as PublicationSlot);
      if (row.key !== PREFIX + slot.id) throw new Error('INVALID_PUBLICATION_SLOT_KEY');
      return slot;
    })
      .filter((slot) => slot.state === 'scheduled' && Date.parse(slot.publishAt) <= now.getTime())
      .sort((a, b) => a.publishAt.localeCompare(b.publishAt) || a.id.localeCompare(b.id));
    const result = { enabled: true, published: 0, blocked: 0, deferred: 0 };
    // At most one batch per novel, two novels per tick: a missing image must not
    // stall the other novel, nor may a later chapter jump ahead in the same novel.
    const firstPerNovel = slots.filter((slot, index) => slots.findIndex((candidate) => candidate.novelId === slot.novelId) === index);
    for (const slot of firstPerNovel.slice(0, 2)) {
      const novel = await tx.novel.findUnique({ where: { id: slot.novelId } });
      const chapters = await tx.writingsItem.findMany({ where: { id: { in: slot.chapterIds } } });
      if (!novel || chapters.length !== slot.chapterIds.length || chapters.some((chapter) =>
        chapter.category !== '小說' || chapter.topic !== novel.title || !chapter.isHidden ||
        !chapter.content.trim() || chapterHash(chapter.content) !== slot.contentHashes[chapter.id])) {
        await tx.siteSetting.update({ where: { key: PREFIX + slot.id },
          data: { value: JSON.stringify({ ...slot, state: 'blocked', error: 'CONTENT_CHANGED' }) } });
        result.blocked++; continue;
      }
      const imagesReady = await Promise.all(chapters.filter((chapter) => chapterIllustrationUrl(chapter.id, chapter.content))
        .map((chapter) => preparedIllustrationReady(tx, chapter.id)));
      if (imagesReady.some((ready) => !ready)) { result.deferred++; continue; }
      for (const chapter of chapters) {
        const updated = await tx.writingsItem.updateMany({ where: { id: chapter.id, isHidden: true,
          category: '小說', topic: novel.title, content: chapter.content }, data: { isHidden: false } });
        if (updated.count !== 1) throw new Error('PUBLICATION_CHANGED_CONCURRENTLY');
      }
      await queuePublicationBatch(tx, slot.novelId, slot.chapterIds, slot.id);
      await tx.siteSetting.update({ where: { key: PREFIX + slot.id },
        data: { value: JSON.stringify({ ...slot, state: 'published', publishedAt: now.toISOString() }) } });
      result.published += slot.chapterIds.length;
    }
    return result;
  }, { timeout: 25000 });
}
