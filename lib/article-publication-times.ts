import 'server-only';
import { prisma } from '@/lib/prisma';
import { validatePublicationSlot, type PublicationSlot } from '@/lib/novel-publication';
import type { ArticlePublicationTiming } from '@/lib/article-publication-display';

// Admin-only read model. Never returns content hashes or changes a slot.
export async function articlePublicationTimes() {
  const prefix = 'novel-publication:v1:slot:';
  const rows = await prisma.siteSetting.findMany({ where: { key: { startsWith: prefix } } });
  const times = new Map<string, ArticlePublicationTiming>();
  for (const row of rows) {
    const slot = validatePublicationSlot(JSON.parse(row.value) as PublicationSlot);
    if (row.key !== prefix + slot.id) throw new Error('INVALID_PUBLICATION_KEY');
    for (const id of slot.chapterIds) {
      if (times.has(id)) throw new Error('AMBIGUOUS_PUBLICATION_TIME');
      times.set(id, { state: slot.state, scheduledAt: slot.publishAt,
        publishedAt: slot.publishedAt && Number.isFinite(Date.parse(slot.publishedAt)) ? slot.publishedAt : null,
        preview: slot.publicationKind === 'preview' });
    }
  }
  return Object.fromEntries(times);
}
