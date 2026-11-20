import { prisma } from '@/lib/prisma';
import { processNewsletterQueue, queueDailyOwnerDigest } from '@/lib/newsletter-queue';
import { publishDueNovelChapters } from '@/lib/novel-publication';
import { logNewsletterWorker, newsletterErrorCode } from '@/lib/newsletter-diagnostics';

const LEASE = 'newsletter:v1:worker:lease';
const ATTEMPT = 'newsletter:v1:worker:last-attempt';
const FAILURE = 'newsletter:v1:worker:last-failure';
export const WORKER_BUDGET_MS = 45000;

export async function runNewsletterWorker(requestId: string) {
  const started = Date.now(), deadlineAt = started + WORKER_BUDGET_MS;
  let stage = 'lease', leaseValue = '', attemptValue = '';
  let queueUncertain = false;
  let result: { status: number; body: Record<string, unknown> } = { status: 503, body: { ok: false, error: 'Worker unavailable', requestId } };
  try {
    const acquired = await prisma.$transaction(async tx => {
      // 與既有佇列共用短交易鎖；網路請求期間不持有資料庫鎖。
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(726340821)`;
      const row = await tx.siteSetting.findUnique({ where: { key: LEASE } });
      if (row?.value) {
        const lease = JSON.parse(row.value) as { expiresAt: number };
        if (lease.expiresAt > Date.now()) return false;
      }
      leaseValue = JSON.stringify({ requestId, expiresAt: Date.now() + 120000 });
      await tx.siteSetting.upsert({ where: { key: LEASE }, create: { key: LEASE, value: leaseValue }, update: { value: leaseValue } });
      return true;
    }, { timeout: 15000 });
    if (!acquired) {
      logNewsletterWorker({ requestId, stage, outcome: 'busy', elapsedMs: Date.now() - started });
      result = { status: 200, body: { ok: true, skipped: 'busy', requestId } };
      return result;
    }
    attemptValue = JSON.stringify({ requestId, startedAt: new Date(started).toISOString(), stage: 'running', outcome: 'running' });
    try { await prisma.siteSetting.upsert({ where: { key: ATTEMPT }, create: { key: ATTEMPT, value: attemptValue }, update: { value: attemptValue } }); }
    catch { logNewsletterWorker({ requestId, stage: 'diagnostics', outcome: 'warning', elapsedMs: Date.now() - started, code: 'ATTEMPT_SAVE_FAILED' }); }
    stage = 'publication';
    logNewsletterWorker({ requestId, stage, outcome: 'started', elapsedMs: Date.now() - started });
    if (Date.now() + 25000 < deadlineAt) await publishDueNovelChapters();
    else logNewsletterWorker({ requestId, stage, outcome: 'deferred', elapsedMs: Date.now() - started, code: 'TIME_BUDGET_LOW' });
    if (Date.now() + 15000 < deadlineAt) {
      stage = 'owner-digest';
      try { await queueDailyOwnerDigest(); }
      catch (error) { logNewsletterWorker({ requestId, stage, outcome: 'warning', code: newsletterErrorCode(error), elapsedMs: Date.now() - started }); }
    }
    stage = 'queue';
    const data = await processNewsletterQueue(3, { deadlineAt, requestId });
    queueUncertain = data.uncertain > 0;
    stage = 'heartbeat';
    const timestamp = new Date().toISOString();
    await prisma.siteSetting.upsert({ where: { key: 'newsletter:v1:worker:last-run' }, create: { key: 'newsletter:v1:worker:last-run', value: timestamp }, update: { value: timestamp } });
    stage = 'complete';
    result = { status: 200, body: { ok: true, data, requestId } };
  } catch (error) {
    const code = newsletterErrorCode(error);
    result = { status: 503, body: { ok: false, error: 'Worker unavailable', requestId, stage, code } };
  } finally {
    if (leaseValue) {
      const record = { requestId, startedAt: new Date(started).toISOString(), finishedAt: new Date().toISOString(), stage: queueUncertain ? 'queue' : stage, outcome: result.status === 200 ? (queueUncertain ? 'partial' : 'success') : 'failed', elapsedMs: Date.now() - started, code: typeof result.body.code === 'string' ? result.body.code : queueUncertain ? 'QUEUE_UNCERTAIN' : undefined };
      logNewsletterWorker(record);
      try {
        // 只更新自己建立的診斷與租約，不覆蓋更新一輪的結果。
        if (attemptValue) await prisma.siteSetting.updateMany({ where: { key: ATTEMPT, value: attemptValue }, data: { value: JSON.stringify(record) } });
        // 成功心跳不會沖掉上一筆失敗，隔天收到 Google 彙整仍能對照。
        if (record.outcome !== 'success') await prisma.siteSetting.upsert({ where: { key: FAILURE }, create: { key: FAILURE, value: JSON.stringify(record) }, update: { value: JSON.stringify(record) } });
      } catch { logNewsletterWorker({ requestId, stage: 'diagnostics', outcome: 'warning', elapsedMs: Date.now() - started, code: 'ATTEMPT_SAVE_FAILED' }); }
      try { await prisma.siteSetting.updateMany({ where: { key: LEASE, value: leaseValue }, data: { value: '' } }); }
      catch { logNewsletterWorker({ requestId, stage: 'lease', outcome: 'warning', elapsedMs: Date.now() - started, code: 'LEASE_RELEASE_FAILED' }); }
    } else if (result.status !== 200) {
      logNewsletterWorker({ requestId, stage, outcome: 'failed', elapsedMs: Date.now() - started, code: String(result.body.code || 'UNEXPECTED_ERROR') });
    }
  }
  return result;
}
