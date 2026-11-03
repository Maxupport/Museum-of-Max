import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAdminRequest } from '@/lib/auth';
import { queueSubscriber } from '@/lib/newsletter-queue';
import { NEWSLETTER_SENDER } from '@/lib/newsletter-config';

// Repair only the owner's existing active subscription. Public signups cannot
// change preferences or reactivate opt-outs, and this does not send old mail.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false }, { status: 401, headers });
  try {
    const { id } = await params;
    const body = await request.json();
    if (body.confirmation !== 'subscribe-owner-to-all-novels' || body.novelId !== 'all' || typeof body.expectedNovelId !== 'string')
      return NextResponse.json({ ok: false }, { status: 400, headers });
    const data = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(726340821)`;
      const subscriber = await tx.subscriber.findUnique({ where: { id } });
      if (!subscriber || subscriber.email.trim().toLowerCase() !== NEWSLETTER_SENDER || !subscriber.active)
        throw new Error('INVALID_OWNER_SUBSCRIPTION');
      if (subscriber.novelId === 'all') return { updated: false, novelId: 'all', active: true, notified: false };
      if (subscriber.novelId !== body.expectedNovelId) throw new Error('SUBSCRIPTION_CHANGED');
      const key = `newsletter:v1:owner-scope-backup:${subscriber.id}`;
      await tx.siteSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(subscriber) }, update: {} });
      await tx.subscriber.update({ where: { id }, data: { novelId: 'all' } });
      await queueSubscriber(tx, id);
      return { updated: true, novelId: 'all', active: true, notified: false };
    }, { timeout: 15000 });
    return NextResponse.json({ ok: true, data }, { headers });
  } catch { return NextResponse.json({ ok: false, error: '未變更訂閱，請重新核對本人有效訂閱及原作品範圍。' }, { status: 409, headers }); }
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
    await prisma.$transaction(async (tx) => {
      await tx.subscriber.delete({ where: { id } });
      await queueSubscriber(tx, id);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete Subscriber Error:', error);
    return NextResponse.json({ ok: false, error: '刪除訂閱者失敗' }, { status: 500 });
  }
}
