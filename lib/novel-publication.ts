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
  publicationKind?: 'preview';
  // Hash approved text before scheduling; an unexpected later edit must not auto-publish.
  contentHashes: Record<string, string>;
};

export function chapterHash(content: string) {
  return createHash('sha256').update(content).digest('hex');
}

// Author-approved first-batch previews: atomically consume the future slot,
// preserve every later date, and deliberately never create a mail event.
export async function publishNovelPreview(slotId: string, expectedHashes: Record<string, string>, now = new Date()) {
  if (!/^[\w-]{1,128}$/.test(slotId) || !expectedHashes || typeof expectedHashes !== 'object') throw new Error('INVALID_PREVIEW');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(726340821)`;
    const rows = await tx.siteSetting.findMany({ where: { key: { startsWith: PREFIX } } });
    const slots = rows.map((row) => {
      const slot = validatePublicationSlot(JSON.parse(row.value) as PublicationSlot);
      if (row.key !== PREFIX + slot.id) throw new Error('INVALID_PUBLICATION_SLOT_KEY');
      return slot;
    });
    const slot = slots.find((item) => item.id === slotId);
    if (!slot || slots.some((other) => other.novelId === slot.novelId && other.publishAt < slot.publishAt) ||
      Object.keys(expectedHashes).length !== slot.chapterIds.length || slot.chapterIds.some((id) => expectedHashes[id] !== slot.contentHashes[id])) throw new Error('PREVIEW_MISMATCH');
    const novel = await tx.novel.findUnique({ where: { id: slot.novelId } });
    const chapters = await tx.writingsItem.findMany({ where: { id: { in: slot.chapterIds } } });
    const duplicate = slot.state === 'published' && slot.publicationKind === 'preview';
    if ((!duplicate && (slot.state !== 'scheduled' || Date.parse(slot.publishAt) <= now.getTime())) || !novel ||
      chapters.length !== slot.chapterIds.length || chapters.some((chapter) => chapter.category !== '小說' || chapter.topic !== novel.title ||
        chapterHash(chapter.content) !== slot.contentHashes[chapter.id] || chapter.isHidden !== !duplicate)) throw new Error('PREVIEW_CONTENT_MISMATCH');
    if (duplicate) return { published: 0, duplicate: true, notified: false };
    for (const chapter of chapters.filter((item) => chapterIllustrationUrl(item.id, item.content))) {
      if (!await preparedIllustrationReady(tx, chapter.id)) throw new Error('PREVIEW_IMAGE_NOT_READY');
    }
    for (const chapter of chapters) {
      const changed = await tx.writingsItem.updateMany({ where: { id: chapter.id, isHidden: true, category: '小說', topic: novel.title, content: chapter.content }, data: { isHidden: false } });
      if (changed.count !== 1) throw new Error('PREVIEW_CHANGED_CONCURRENTLY');
    }
    await tx.siteSetting.update({ where: { key: PREFIX + slot.id }, data: { value: JSON.stringify({ ...slot, state: 'published', publicationKind: 'preview', publishedAt: now.toISOString() }) } });
    return { published: chapters.length, duplicate: false, notified: false };
  }, { timeout: 25000 });
}

export async function rescheduleNovelDates(input: { id: string; from: string; to: string }[], now = new Date()) {
  if (!Array.isArray(input) || !input.length || input.length > 50 || new Set(input.map((x) => x.id)).size !== input.length ||
    input.some((x) => !x || !/^[\w-]{1,128}$/.test(x.id) || ![x.from, x.to].every((date) => typeof date === 'string' && Number.isFinite(Date.parse(date)) && new Date(date).toISOString() === date) || Date.parse(x.to) <= now.getTime())) throw new Error('INVALID_CALENDAR_CHANGE');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(726340821)`;
    const rows = await tx.siteSetting.findMany({ where: { key: { startsWith: PREFIX } } });
    const slots = rows.map((row) => { const s = validatePublicationSlot(JSON.parse(row.value) as PublicationSlot); if (row.key !== PREFIX + s.id) throw new Error('INVALID_KEY'); return s; });
    const changed = input.map((change) => {
      const slot = slots.find((s) => s.id === change.id);
      if (!slot || slot.state !== 'scheduled' || ![change.from, change.to].includes(slot.publishAt)) throw new Error('CALENDAR_CHANGED');
      return { ...slot, publishAt: change.to };
    });
    const scheduled = slots.filter((s) => s.state === 'scheduled').map((s) => changed.find((c) => c.id === s.id) || s);
    if (new Set(scheduled.map((s) => s.publishAt)).size !== scheduled.length) throw new Error('CALENDAR_COLLISION');
    for (const novelId of new Set(changed.map((s) => s.novelId))) {
      const before = slots.filter((s) => s.novelId === novelId && s.state === 'scheduled').sort((a, b) => a.publishAt.localeCompare(b.publishAt));
      const after = scheduled.filter((s) => s.novelId === novelId).sort((a, b) => a.publishAt.localeCompare(b.publishAt));
      if (before.some((s, index) => s.id !== after[index].id)) throw new Error('CALENDAR_ORDER_CHANGED');
    }
    let updated = 0;
    for (const slot of changed) {
      if (slots.find((s) => s.id === slot.id)!.publishAt === slot.publishAt) continue;
      await tx.siteSetting.update({ where: { key: PREFIX + slot.id }, data: { value: JSON.stringify(slot) } }); updated++;
    }
    return { updated, scheduled: scheduled.length, notified: false };
  }, { timeout: 25000 });
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

export async function installPublicationSlots(input: PublicationSlot[], now = new Date()) {
  if (process.env.NOVEL_PUBLICATION_ENABLED === 'true') throw new Error('PAUSE_PUBLICATION_FIRST');
  if (!Array.isArray(input) || !input.length || input.length > 50) throw new Error('INVALID_SLOT_BATCH');
  const slots = input.map((value) => {
    const slot = validatePublicationSlot(value);
    if (slot.state !== 'scheduled' || Date.parse(slot.publishAt) <= now.getTime()) throw new Error('INVALID_FUTURE_SLOT');
    return { id: slot.id, novelId: slot.novelId, chapterIds: slot.chapterIds, publishAt: slot.publishAt,
      state: 'scheduled' as const, contentHashes: Object.fromEntries(slot.chapterIds.map((id) => [id, slot.contentHashes[id]])) };
  });
  const ids = slots.flatMap((slot) => slot.chapterIds);
  if (new Set(ids).size !== ids.length || new Set(slots.map((slot) => slot.id)).size !== slots.length ||
    new Set(slots.map((slot) => slot.publishAt)).size !== slots.length) throw new Error('DUPLICATE_SLOT_BATCH');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(726340821)`;
    const existing = (await tx.siteSetting.findMany({ where: { key: { startsWith: PREFIX } } }))
      .map((row) => {
        const slot = validatePublicationSlot(JSON.parse(row.value) as PublicationSlot);
        if (row.key !== PREFIX + slot.id) throw new Error('INVALID_PUBLICATION_SLOT_KEY');
        return slot;
      });
    let installed = 0;
    for (const slot of slots) {
      const prior = existing.find((item) => item.id === slot.id);
      if (prior) {
        if (JSON.stringify(prior) !== JSON.stringify(slot)) throw new Error('SLOT_CONFLICT');
        continue;
      }
      if (existing.some((item) => item.publishAt === slot.publishAt || item.chapterIds.some((id) => slot.chapterIds.includes(id))))
        throw new Error('SLOT_CONFLICT');
      const novel = await tx.novel.findUnique({ where: { id: slot.novelId } });
      const chapters = await tx.writingsItem.findMany({ where: { id: { in: slot.chapterIds } } });
      if (!novel || chapters.length !== slot.chapterIds.length || chapters.some((chapter) => !chapter.isHidden ||
        chapter.category !== '小說' || chapter.topic !== novel.title || !chapter.content.trim() ||
        chapterHash(chapter.content) !== slot.contentHashes[chapter.id])) throw new Error('SLOT_CONTENT_MISMATCH');
      for (const chapter of chapters.filter((chapter) => chapterIllustrationUrl(chapter.id, chapter.content))) {
        const row = await tx.siteSetting.findUnique({ where: { key: `novel-illustration:v1:${chapter.id}` } });
        const image = row ? JSON.parse(row.value) : null;
        if (!novelPrivateStoreConfig() || !image?.verifiedAt || !/^[a-f0-9]{64}$/.test(image.imageHash || ''))
          throw new Error('SLOT_IMAGE_NOT_VERIFIED');
      }
      await tx.siteSetting.create({ data: { key: PREFIX + slot.id, value: JSON.stringify(slot) } });
      installed++;
    }
    return { installed, duplicate: slots.length - installed, publicationEnabled: false };
  }, { timeout: 25000 });
}

// Separate opt-in: deploying this code cannot accidentally activate a draft calendar.
// The existing signed five-minute worker is the only execution entry point.
export async function publishDueNovelChapters(now = new Date()) {
  if (process.env.NOVEL_PUBLICATION_ENABLED !== 'true') return { enabled: false, published: 0, blocked: 0 };
  return prisma.$transaction(async (tx) => {
    // Same lock as the mail outbox: public content + durable event commit together.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(726340821)`;
    const rows = await tx.siteSetting.findMany({ where: { key: { startsWith: PREFIX } } });
    const allSlots = rows.map((row) => {
      const slot = validatePublicationSlot(JSON.parse(row.value) as PublicationSlot);
      if (row.key !== PREFIX + slot.id) throw new Error('INVALID_PUBLICATION_SLOT_KEY');
      return slot;
    });
    const slots = allSlots
      .filter((slot) => slot.state === 'scheduled' && Date.parse(slot.publishAt) <= now.getTime())
      .sort((a, b) => a.publishAt.localeCompare(b.publishAt) || a.id.localeCompare(b.id));
    const result = { enabled: true, published: 0, blocked: 0, deferred: 0 };
    // At most one batch per novel, two novels per tick: a missing image must not
    // stall the other novel, nor may a later chapter jump ahead in the same novel.
    const firstPerNovel = slots.filter((slot, index) => slots.findIndex((candidate) => candidate.novelId === slot.novelId) === index &&
      !allSlots.some((prior) => prior.novelId === slot.novelId && prior.state === 'blocked' && prior.publishAt <= slot.publishAt));
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
