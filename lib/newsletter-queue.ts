import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendChapterUpdateEmail, sendWelcomeEmail } from '@/lib/email';
import { callGoogleBridge, newsletterConfig, isOwnerTestAddress, NEWSLETTER_LIMIT, NEWSLETTER_SENDER, NEWSLETTER_WINDOW_MS, SUBSCRIBER_SHEET_ID } from '@/lib/newsletter-config';

// Transitional durable outbox in the existing private key/value table. No schema push is needed.
const PREFIX = 'newsletter:v1:';
const JOB = `${PREFIX}job:`;
const CAMPAIGN = `${PREFIX}campaign:`;
const QUOTA = `${PREFIX}quota:`;
type Tx = Prisma.TransactionClient;
export type Job = {
  id: string; kind: 'welcome' | 'update' | 'test' | 'sync' | 'publication'; subscriberId?: string; chapterId?: string;
  campaignId?: string; novelTitle?: string; state: 'pending' | 'processing' | 'sent' | 'canceled' | 'uncertain';
  createdAt: number; reservedAt?: number; finishedAt?: number; leaseId?: string; notBefore?: number;
};
export type Campaign = {
  id: string; novelId?: string; novelTitle: string; chapterTitle: string; summary: string; createdAt: number;
  messageType?: 'update' | 'announcement'; chapterIds?: string[];
};

function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
async function save(tx: Tx, job: Job) {
  return tx.siteSetting.upsert({ where: { key: JOB + job.id }, create: { key: JOB + job.id, value: JSON.stringify(job) }, update: { value: JSON.stringify(job) } });
}
async function locked<T>(operation: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    // All enqueuers/workers share this PostgreSQL transaction lock, including across serverless instances.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(726340821)`;
    return operation(tx);
  }, { timeout: 15000 });
}
async function allJobs(tx: Tx = prisma) {
  const rows = await tx.siteSetting.findMany({ where: { key: { startsWith: JOB } } });
  return rows.map((row) => JSON.parse(row.value) as Job);
}

export async function queueSubscriber(tx: Tx, subscriberId: string, welcome = false, novelTitle?: string) {
  const jobs: Job[] = [{ id: `sync:${subscriberId}`, kind: 'sync', subscriberId, state: 'pending', createdAt: Date.now() }];
  if (welcome) jobs.push({ id: `welcome:${subscriberId}`, kind: 'welcome', subscriberId, novelTitle, state: 'pending', createdAt: Date.now() });
  // Caller owns the subscription transaction; sync replacement is safe via compare-and-swap completion.
  for (const job of jobs) {
    const key = JOB + job.id;
    await tx.siteSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(job) },
      update: job.kind === 'sync' ? { value: JSON.stringify(job) } : {} });
  }
}

export async function queuePublication(tx: Tx, chapterId: string) {
  const job: Job = { id: `publication:${chapterId}`, kind: 'publication', chapterId, state: 'pending', createdAt: Date.now() };
  await tx.siteSetting.upsert({ where: { key: JOB + job.id }, create: { key: JOB + job.id, value: JSON.stringify(job) }, update: {} });
}

export async function queuePublishedUpdate(novelId: string, chapterIds: string[], eventId: string, isTest = false) {
  const novel = await prisma.novel.findUnique({ where: { id: novelId } });
  if (!novel) throw new Error('INVALID_PUBLICATION');
  const published = await prisma.writingsItem.findMany({ where: { category: '小說', topic: novel.title, isHidden: false },
    select: { id: true, title: true }, orderBy: { order: 'asc' } });
  const selected = published.filter((chapter) => chapterIds.includes(chapter.id));
  if (!selected.length || selected.length !== new Set(chapterIds).size) throw new Error('INVALID_PUBLICATION');
  return queueCampaign({ novelId, novelTitle: novel.title, messageType: 'update', chapterIds: selected.map((chapter) => chapter.id),
    chapterTitle: `本次更新 ${selected.length} 章（截至：${selected[selected.length - 1].title.slice(0, 100)}）`,
    summary: `目前已公開 ${published.length} 章。本次更新：${selected.map((chapter) => chapter.title.slice(0, 100)).join('、')}。請由閱讀連結查看。` }, eventId, isTest);
}

export async function queueCampaign(input: Omit<Campaign, 'id' | 'createdAt'>, eventId: string, isTest = false) {
  const campaignId = hash(`${isTest ? 'test' : 'update'}:${eventId}`);
  return locked(async (tx) => {
    const existing = await tx.siteSetting.findUnique({ where: { key: CAMPAIGN + campaignId } });
    if (existing) {
      const prior = JSON.parse(existing.value) as Campaign;
      if (JSON.stringify([prior.novelId || null, prior.novelTitle, prior.chapterTitle, prior.summary, prior.messageType || 'update', prior.chapterIds || []]) !==
          JSON.stringify([input.novelId || null, input.novelTitle, input.chapterTitle, input.summary, input.messageType || 'update', input.chapterIds || []])) throw new Error('EVENT_CONFLICT');
      return { campaignId, duplicate: true, queuedCount: 0 };
    }
    const campaign: Campaign = { ...input, id: campaignId, createdAt: Date.now() };
    if (input.novelId && input.novelId !== 'all' && !await tx.novel.findUnique({ where: { id: input.novelId } })) throw new Error('INVALID_PUBLICATION');
    const subscribers = isTest ? [] : await tx.subscriber.findMany({
      where: { active: true, ...(input.novelId && input.novelId !== 'all' ? { novelId: { in: [input.novelId, 'all'] } } : {}) },
      select: { id: true }, orderBy: [{ lastNotifiedAt: 'asc' }, { createdAt: 'asc' }],
    });
    if (!isTest && !subscribers.length) throw new Error('NO_SUBSCRIBERS');
    await tx.siteSetting.create({ data: { key: CAMPAIGN + campaignId, value: JSON.stringify(campaign) } });
    const recipients = isTest ? [undefined] : subscribers.map((subscriber) => subscriber.id);
    for (const subscriberId of recipients) await save(tx, {
      id: hash(`${campaignId}:${subscriberId || 'owner'}`), campaignId, subscriberId,
      kind: isTest ? 'test' : 'update', state: 'pending', createdAt: campaign.createdAt,
    });
    return { campaignId, duplicate: false, queuedCount: recipients.length };
  });
}

async function reservationTimes(tx: Tx = prisma) {
  const rows = await tx.siteSetting.findMany({ where: { key: { startsWith: QUOTA } } });
  return rows.map((row) => Number(row.value)).filter((time) => time > Date.now() - NEWSLETTER_WINDOW_MS).sort((a, b) => a - b);
}

export async function newsletterStatus() {
  const config = newsletterConfig();
  const jobs = await allJobs();
  const reservations = await reservationTimes();
  const heartbeat = await prisma.siteSetting.findUnique({ where: { key: 'newsletter:v1:worker:last-run' } });
  const counts = { pending: 0, processing: 0, sent: 0, canceled: 0, uncertain: 0, syncPending: 0 };
  for (const job of jobs) {
    counts[job.state]++;
    if (job.kind === 'sync' && job.state === 'pending') counts.syncPending++;
  }
  const rows = await prisma.siteSetting.findMany({ where: { key: { startsWith: CAMPAIGN } } });
  const campaigns = rows.map((row) => JSON.parse(row.value) as Campaign).sort((a, b) => b.createdAt - a.createdAt).slice(0, 10).map((campaign) => {
    const related = jobs.filter((job) => job.campaignId === campaign.id);
    return { id: campaign.id, title: campaign.chapterTitle, createdAt: new Date(campaign.createdAt).toISOString(),
      pending: related.filter((job) => job.state === 'pending').length,
      sent: related.filter((job) => job.state === 'sent').length,
      uncertain: related.filter((job) => job.state === 'uncertain').length };
  });
  return {
    campaigns,
    lastWorkerAt: heartbeat?.value || null,
    ...counts, configured: config.configured, enabled: config.enabled, syncEnabled: config.syncEnabled,
    testOnly: config.testOnly, sender: NEWSLETTER_SENDER, dailyLimit: NEWSLETTER_LIMIT,
    autoUpdatesEnabled: config.autoUpdatesEnabled,
    usedInLast24Hours: reservations.length, remaining: Math.max(0, NEWSLETTER_LIMIT - reservations.length),
    nextSlotAt: reservations.length >= NEWSLETTER_LIMIT ? new Date(reservations[0] + NEWSLETTER_WINDOW_MS).toISOString() : null,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${SUBSCRIBER_SHEET_ID}/edit`,
    missing: [!config.configured && 'Google Web App URL／專用 secret', !config.enabled && '寄信開關尚未啟用', config.testOnly && '目前只允許測試信'].filter(Boolean),
  };
}

async function claim() {
  const config = newsletterConfig();
  if (!config.configured) return null;
  return locked(async (tx) => {
    const jobs = await allJobs(tx);
    // A crashed worker must never automatically resend an email with an unknown outcome.
    for (const job of jobs.filter((job) => job.state === 'processing' && (job.reservedAt || 0) < Date.now() - 120000)) {
      job.state = job.kind === 'sync' || job.kind === 'publication' ? 'pending' : 'uncertain'; await save(tx, job);
    }
    const used = (await reservationTimes(tx)).length;
    const candidates = jobs.filter((job) => job.state === 'pending' && (!job.notBefore || job.notBefore <= Date.now()) && (job.kind === 'sync'
      ? config.syncEnabled : job.kind === 'publication' ? config.autoUpdatesEnabled
        : config.enabled && used < NEWSLETTER_LIMIT));
    // FIFO avoids starving every welcome behind a burst of new Sheet syncs.
    // Delivery still rechecks the authoritative opt-out state before sending.
    candidates.sort((a, b) => a.createdAt - b.createdAt || Number(b.kind === 'sync') - Number(a.kind === 'sync') || a.id.localeCompare(b.id));
    let job: Job | undefined;
    for (const candidate of candidates) {
      if (config.testOnly && !['sync', 'publication', 'test'].includes(candidate.kind)) {
        const reader = candidate.subscriberId ? await tx.subscriber.findUnique({ where: { id: candidate.subscriberId }, select: { email: true } }) : null;
        if (!reader || !isOwnerTestAddress(reader.email)) continue;
      }
      job = candidate; break;
    }
    if (!job) return null;
    job.state = 'processing'; job.reservedAt = Date.now(); job.leaseId = randomUUID();
    if (job.kind !== 'sync' && job.kind !== 'publication') await tx.siteSetting.create({ data: { key: QUOTA + job.leaseId, value: String(job.reservedAt) } });
    await save(tx, job); return job;
  });
}

async function finish(job: Job, state: Job['state'], delayMs = 0) {
  // If an unsubscribe rescheduled a sync job while the worker was running, leave the newer job intact.
  await prisma.siteSetting.updateMany({ where: { key: JOB + job.id, value: JSON.stringify(job) },
    data: { value: JSON.stringify({ ...job, state, finishedAt: Date.now(), ...(delayMs ? { notBefore: Date.now() + delayMs } : {}) }) } });
}

async function readingReady(url: string, chapterIds: string[] = []) {
  try {
    const response = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) return false;
    const html = await response.text();
    return chapterIds.every((id) => html.includes(id));
  } catch { return false; }
}

export async function processNewsletterQueue(maxJobs = 3) {
  const result = { sent: 0, synced: 0, canceled: 0, uncertain: 0 };
  const started = Date.now();
  for (let index = 0; index < maxJobs && Date.now() - started < 30000; index++) {
    const job = await claim();
    if (!job) break;
    try {
      if (job.kind === 'publication') {
        const chapter = await prisma.writingsItem.findUnique({ where: { id: job.chapterId! } });
        if (!chapter || chapter.isHidden || chapter.category !== '小說' || !chapter.topic) { await finish(job, 'canceled'); continue; }
        const novel = await prisma.novel.upsert({ where: { title: chapter.topic }, create: { title: chapter.topic }, update: {} });
        try { await queuePublishedUpdate(novel.id, [chapter.id], job.id); }
        catch (error) { if (!(error instanceof Error && error.message === 'NO_SUBSCRIBERS')) throw error; }
        await finish(job, 'sent'); continue;
      }
      // Always re-read the authoritative subscriber state immediately before sending.
      const subscriber = job.subscriberId ? await prisma.subscriber.findUnique({ where: { id: job.subscriberId } }) : null;
      if (job.kind === 'sync') {
        const novel = subscriber?.novelId && subscriber.novelId !== 'all' ? await prisma.novel.findUnique({ where: { id: subscriber.novelId }, select: { title: true } }) : null;
        const reply = await callGoogleBridge({ operation: 'sync', revision: job.createdAt, subscriber: subscriber ? {
          id: subscriber.id, email: subscriber.email, name: subscriber.name, novelId: subscriber.novelId,
          active: subscriber.active, novelTitle: novel?.title || '全部作品', sourceChapter: subscriber.sourceChapter, createdAt: subscriber.createdAt.toISOString(),
          lastNotifiedAt: subscriber.lastNotifiedAt?.toISOString() || null,
        } : { id: job.subscriberId, active: false, deleted: true } });
        if (reply.status !== 'synced') throw new Error('Sync not acknowledged');
        await finish(job, 'sent'); result.synced++; continue;
      }
      if (job.kind !== 'test' && (!subscriber?.active || !subscriber.unsubscribeToken)) {
        await finish(job, 'canceled'); result.canceled++; continue;
      }
      const campaignRow = job.campaignId ? await prisma.siteSetting.findUnique({ where: { key: CAMPAIGN + job.campaignId } }) : null;
      const campaign = campaignRow ? JSON.parse(campaignRow.value) as Campaign : null;
      const email = job.kind === 'test' || (newsletterConfig().testOnly && isOwnerTestAddress(subscriber!.email)) ? NEWSLETTER_SENDER : subscriber!.email;
      const common = { email, name: subscriber?.name, unsubscribeToken: subscriber?.unsubscribeToken };
      let prepared;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://museum-of-max.vercel.app';
      let readingUrl = `${siteUrl}/novels`;
      if (job.kind === 'welcome') {
        if (subscriber?.novelId && subscriber.novelId !== 'all') readingUrl = `${siteUrl}/museum/creation_lab/novel/${encodeURIComponent(subscriber.novelId)}`;
        prepared = await sendWelcomeEmail({ ...common, novelTitle: job.novelTitle, novelId: subscriber?.novelId === 'all' ? undefined : subscriber?.novelId, isTest: newsletterConfig().testOnly }, true);
      }
      else {
        if (!campaign) throw new Error('Campaign is missing');
        if (campaign.novelId && campaign.novelId !== 'all') readingUrl = `${siteUrl}/museum/creation_lab/novel/${encodeURIComponent(campaign.novelId)}`;
        if (campaign.chapterIds?.length) {
          const novel = await prisma.novel.findUnique({ where: { id: campaign.novelId! } });
          const chapters = novel ? await prisma.writingsItem.findMany({ where: { category: '小說', topic: novel.title, isHidden: false }, select: { id: true, title: true } }) : [];
          if (campaign.chapterIds.some((id) => !chapters.some((chapter) => chapter.id === id))) { await finish(job, 'canceled'); result.canceled++; continue; }
          readingUrl += `?chapterId=${encodeURIComponent(campaign.chapterIds[0])}`;
        }
        prepared = await sendChapterUpdateEmail({ ...common, ...campaign,
          chapterUrl: readingUrl, isTest: job.kind === 'test' }, true);
      }
      // A failed/redirected reader page must not result in a premature email.
      // No provider request is made; retry with backoff (the conservative quota
      // reservation is retained, as with other known non-deliveries).
      if (!await readingReady(readingUrl, campaign?.chapterIds)) { await finish(job, 'pending', 1800000); continue; }
      if (!prepared.message) throw new Error('Cannot prepare email');
      const reply = await callGoogleBridge({ operation: 'send', jobId: job.id, to: email, ...prepared.message });
      if (reply.status === 'deferred') { await finish(job, 'pending'); break; }
      if (reply.status !== 'sent') throw new Error('Email result is uncertain');
      // Record terminal success before ancillary reporting, so reporting failures cannot resend mail.
      await finish(job, 'sent'); result.sent++;
      if (subscriber) {
        try {
          await prisma.$transaction(async (tx) => {
            await tx.subscriber.update({ where: { id: subscriber.id }, data: { lastNotifiedAt: new Date() } });
            await queueSubscriber(tx, subscriber.id);
          });
        } catch { console.error('[Newsletter] Delivery accepted; notification timestamp needs reconciliation'); }
      }
    } catch {
      if (job.kind === 'sync' || job.kind === 'publication') await finish(job, 'pending');
      else {
        // Do not overwrite an already recorded success if only status reporting failed.
        await finish(job, 'uncertain'); result.uncertain++;
      }
      break;
    }
  }
  return result;
}

export async function queueFullSubscriberSync() {
  const subscribers = await prisma.subscriber.findMany({ select: { id: true } });
  await locked(async (tx) => { for (const subscriber of subscribers) await queueSubscriber(tx, subscriber.id); });
  return subscribers.length;
}

export async function cancelCampaign(campaignId: string) {
  return locked(async (tx) => {
    let canceled = 0;
    for (const job of await allJobs(tx)) if (job.campaignId === campaignId && job.state === 'pending') {
      await save(tx, { ...job, state: 'canceled', finishedAt: Date.now() }); canceled++;
    }
    return canceled;
  });
}
