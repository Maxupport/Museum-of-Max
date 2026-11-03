import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';
import { getArticle } from '@/lib/articles';
import { queuePublication } from '@/lib/newsletter-queue';
import { kickNewsletterQueue } from '@/lib/newsletter-kick';
import { approveScheduledRevision, preserveChapterIllustration } from '@/lib/novel-publication-edit';

export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const article = await getArticle(id, validateAdminRequest(request));
    if (!article) {
      return NextResponse.json({ ok: false, error: '文章不存在' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: article });
  } catch (error) {
    console.error('Fetch Single Article Error:', error);
    return NextResponse.json({ ok: false, error: '讀取文章失敗' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { exhibitId, title, category, topic, fbUrl, fbDate, excerpt, content, youtubeUrl, order, isPinned, isHidden, views } = body;

    if (body.notifySubscribers != null && typeof body.notifySubscribers !== 'boolean') return NextResponse.json({ ok: false }, { status: 400 });
    if (body.approveScheduledRevision != null && typeof body.approveScheduledRevision !== 'boolean') return NextResponse.json({ ok: false }, { status: 400 });
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(726340821)`;
      const before = await tx.writingsItem.findUnique({ where: { id } });
      const savedContent = before && typeof content === 'string' && content.trim()
        ? await preserveChapterIllustration(tx, before, content.trim()) : undefined;
      const item = await tx.writingsItem.update({
      where: { id },
      data: {
        exhibitId: exhibitId || undefined,
        title: title ? title.trim() : undefined,
        category: category === 'FB文章備份' ? '社群隨筆' : (category || undefined),
        topic: topic !== undefined ? (topic ? topic.trim() : null) : undefined,
        fbUrl: fbUrl !== undefined ? (fbUrl ? fbUrl.trim() : null) : undefined,
        fbDate: fbDate !== undefined ? (fbDate ? fbDate.trim() : null) : undefined,
        excerpt: excerpt !== undefined ? (excerpt ? excerpt.trim() : null) : undefined,
        content: savedContent,
        youtubeUrl: youtubeUrl !== undefined ? (youtubeUrl ? youtubeUrl.trim() : null) : undefined,
        isPinned: typeof isPinned === 'boolean' ? isPinned : undefined,
        isHidden: typeof isHidden === 'boolean' ? isHidden : undefined,
        views: typeof views === 'number' ? views : undefined,
        order: typeof order === 'number' ? order : undefined,
      },
      });
      if (before && savedContent && body.approveScheduledRevision === true) await approveScheduledRevision(tx, before, item);
      // Editing a typo is not a new release. Only first publication/unhiding captures this event.
      if (before?.isHidden && !item.isHidden && item.category === '小說' && item.topic && body.notifySubscribers !== false) await queuePublication(tx, item.id);
      return item;
    }, { timeout: 25000 });

    if (updated.category === '小說' && !updated.isHidden && body.notifySubscribers !== false) kickNewsletterQueue();
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error('Update Writing Error:', error);
    return NextResponse.json({ ok: false, error: '更新失敗' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: '未授權' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.writingsItem.delete({
      where: { id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete Writing Error:', error);
    return NextResponse.json({ ok: false, error: '刪除失敗' }, { status: 500 });
  }
}
