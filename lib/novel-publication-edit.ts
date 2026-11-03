import 'server-only';
import type { Prisma, WritingsItem } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { chapterHash, validatePublicationSlot, type PublicationSlot } from '@/lib/novel-publication';
import { preparedIllustrationReady } from '@/lib/novel-image-readiness';

const PREFIX = 'novel-publication:v1:slot:';
type Tx = Prisma.TransactionClient;

async function slots(tx: Tx) {
  return (await tx.siteSetting.findMany({ where: { key: { startsWith: PREFIX } } })).map((row) => {
    const slot = validatePublicationSlot(JSON.parse(row.value) as PublicationSlot);
    if (row.key !== PREFIX + slot.id) throw new Error('INVALID_SLOT_KEY');
    return slot;
  });
}

// The editor displays textContent alone. Keep the server-owned private image
// marker even when that editor sends plain text back; never replace the text.
export async function preserveChapterIllustration(tx: Tx, chapter: WritingsItem, content: string) {
  if (chapter.category !== '小說') return content;
  const mapping = await tx.siteSetting.findUnique({ where: { key: `novel-illustration:v1:${chapter.id}` } });
  if (!mapping) return content;
  let envelope: Record<string, unknown> = { textContent: content };
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.textContent === 'string') envelope = parsed;
  } catch { /* 純文字由伺服器保留配圖外層。 */ }
  return JSON.stringify({ ...envelope, illustration: true });
}

// Call only for an explicitly approved admin content save, inside the same
// advisory-locked transaction as the chapter update. No publication or mail here.
export async function approveScheduledRevision(tx: Tx, before: WritingsItem, chapter: WritingsItem) {
  const matches = (await slots(tx)).filter((slot) => slot.chapterIds.includes(chapter.id));
  if (matches.length > 1) throw new Error('AMBIGUOUS_SCHEDULE');
  const slot = matches[0];
  if (!slot || slot.state === 'published') return false;
  const novel = await tx.novel.findUnique({ where: { id: slot.novelId } });
  if (!novel || !before.isHidden || !chapter.isHidden || chapter.category !== '小說' || chapter.topic !== novel.title || !chapter.content.trim())
    throw new Error('REVISION_METADATA_MISMATCH');
  const image = await tx.siteSetting.findUnique({ where: { key: `novel-illustration:v1:${chapter.id}` } });
  if (image && !await preparedIllustrationReady(tx, chapter.id)) throw new Error('REVISION_IMAGE_NOT_READY');
  const contentHash = chapterHash(chapter.content);
  if (slot.state === 'scheduled' && slot.contentHashes[chapter.id] === contentHash) return false;
  const backupKey = `novel-publication:v1:revision:${slot.id}:${chapterHash(before.content)}`;
  await tx.siteSetting.upsert({ where: { key: backupKey },
    create: { key: backupKey, value: JSON.stringify({ savedAt: new Date().toISOString(), slot, chapter: before }) }, update: {} });
  const revised = { ...slot, state: 'scheduled' as const, contentHashes: { ...slot.contentHashes, [chapter.id]: contentHash } };
  delete revised.error;
  await tx.siteSetting.update({ where: { key: PREFIX + slot.id }, data: { value: JSON.stringify(revised) } });
  return true;
}

export async function publicationContentAudit() {
  return prisma.$transaction(async (tx) => {
    const pending = (await slots(tx)).filter((slot) => slot.state !== 'published');
    const chapters = await tx.writingsItem.findMany({ where: { id: { in: pending.flatMap((slot) => slot.chapterIds) } } });
    const issues: { slotId: string; chapterId: string; reason: string }[] = [];
    for (const slot of pending) {
      const novel = await tx.novel.findUnique({ where: { id: slot.novelId } });
      for (const id of slot.chapterIds) {
        const chapter = chapters.find((item) => item.id === id);
        const reason = !chapter ? 'CHAPTER_MISSING' : !novel || chapter.category !== '小說' || chapter.topic !== novel.title ? 'BOOK_MISMATCH'
          : !chapter.isHidden ? 'ALREADY_PUBLIC' : chapterHash(chapter.content) !== slot.contentHashes[id] ? 'CONTENT_CHANGED'
          : slot.state === 'blocked' ? 'BLOCKED' : null;
        if (reason) issues.push({ slotId: slot.id, chapterId: id, reason });
      }
    }
    return { checkedChapters: chapters.length, pendingSlots: pending.length, issues };
  }, { timeout: 25000 });
}

export async function recoverBlockedRevision(chapterId: string, expectedContentHash: string) {
  if (!/^[\w-]{1,128}$/.test(chapterId) || !/^[a-f0-9]{64}$/.test(expectedContentHash)) throw new Error('INVALID_REVISION');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(726340821)`;
    const chapter = await tx.writingsItem.findUnique({ where: { id: chapterId } });
    const matches = (await slots(tx)).filter((slot) => slot.chapterIds.includes(chapterId));
    if (!chapter || chapterHash(chapter.content) !== expectedContentHash || matches.length !== 1 || matches[0].state !== 'blocked')
      throw new Error('REVISION_CHANGED');
    const content = await preserveChapterIllustration(tx, chapter, chapter.content);
    const restored = { ...chapter, content };
    await approveScheduledRevision(tx, chapter, restored);
    await tx.writingsItem.update({ where: { id: chapterId }, data: { content } });
    return { rearmed: true, publishAt: matches[0].publishAt, published: false, notified: false };
  }, { timeout: 25000 });
}
