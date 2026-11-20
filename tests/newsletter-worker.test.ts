import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';

const mock = vi.hoisted(() => ({ records: new Map<string,string>(), publication: vi.fn(), digest: vi.fn(), queue: vi.fn(),
  db: { $transaction: vi.fn(), $queryRaw: vi.fn(), siteSetting: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() } } }));
vi.mock('@/lib/prisma', () => ({ prisma: mock.db }));
vi.mock('@/lib/novel-publication', () => ({ publishDueNovelChapters: mock.publication }));
vi.mock('@/lib/newsletter-queue', () => ({ queueDailyOwnerDigest: mock.digest, processNewsletterQueue: mock.queue }));
import { runNewsletterWorker } from '@/lib/newsletter-worker';
import { POST } from '@/app/api/internal/newsletter-worker/route';
const leaseKey = 'newsletter:v1:worker:lease', attemptKey = 'newsletter:v1:worker:last-attempt';
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-20T01:00:00Z'));
  vi.stubEnv('GOOGLE_NEWSLETTER_SECRET', 'test-secret-at-least-32-characters-long');
  mock.records.clear(); mock.publication.mockReset().mockResolvedValue({ published: 0 }); mock.digest.mockReset().mockResolvedValue({ queued: false }); mock.queue.mockReset().mockResolvedValue({ sent: 0 });
  mock.db.siteSetting.findUnique.mockImplementation(async ({where}) => mock.records.has(where.key) ? {key: where.key,value: mock.records.get(where.key)} : null);
  mock.db.siteSetting.upsert.mockImplementation(async ({where,create,update}) => { const value = mock.records.has(where.key) ? update.value : create.value; mock.records.set(where.key,value); return {key:where.key,value}; });
  mock.db.siteSetting.updateMany.mockImplementation(async ({where,data}) => { if(mock.records.get(where.key)!==where.value)return {count:0}; mock.records.set(where.key,data.value);return {count:1}; });
  let tail = Promise.resolve();
  mock.db.$transaction.mockImplementation(async fn => {const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve;});await previous;try{return await fn(mock.db);}finally{release();}});
  vi.spyOn(console,'info').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();vi.useRealTimers();});

describe('訂閱 worker：時間預算、租約及安全診斷',()=>{
  it('相容舊固定內容簽章，回傳追蹤編號，拒絕未授權請求',async()=>{
    expect((await POST(new NextRequest('https://museum.test/api/internal/newsletter-worker',{method:'POST',body:'{}'}))).status).toBe(401);
    const timestamp=String(Date.now()/1000),signature=createHmac('sha256',process.env.GOOGLE_NEWSLETTER_SECRET!).update(`museum-newsletter-worker-v1\n${timestamp}\n{}`).digest('hex');
    const response=await POST(new NextRequest('https://museum.test/api/internal/newsletter-worker',{method:'POST',body:'{}',headers:{'x-newsletter-time':timestamp,'x-newsletter-signature':signature}}));
    expect(response.status).toBe(200);expect(response.headers.get('x-newsletter-request-id')).toMatch(/^[a-f0-9-]{36}$/);expect(mock.queue).toHaveBeenCalledOnce();
  });
  it('記錄成功時間，保留整輪期限且沒有實寄',async()=>{
    const started=Date.now();expect((await runNewsletterWorker('request-one')).status).toBe(200);
    expect(mock.queue).toHaveBeenCalledWith(3,{deadlineAt:started+45000,requestId:'request-one'});
    expect(mock.records.get(leaseKey)).toBe('');expect(JSON.parse(mock.records.get(attemptKey)!)).toMatchObject({requestId:'request-one',outcome:'success',stage:'complete'});
    expect(mock.records.get('newsletter:v1:worker:last-run')).toBe(new Date().toISOString());
  });
  it('兩輪重疊只有一輪可處理，忙碌不誤報失敗',async()=>{
    let done!:()=>void;mock.publication.mockImplementationOnce(()=>new Promise<void>(resolve=>{done=resolve;}));
    const first=runNewsletterWorker('first');await vi.waitFor(()=>expect(mock.publication).toHaveBeenCalledOnce());
    expect(await runNewsletterWorker('second')).toMatchObject({status:200,body:{skipped:'busy'}});expect(mock.queue).not.toHaveBeenCalled();
    done();await first;expect(mock.queue).toHaveBeenCalledOnce();expect(console.error).not.toHaveBeenCalled();
  });
  it('失敗只儲存安全代碼與階段，釋放租約，不刷新成功心跳',async()=>{
    mock.publication.mockRejectedValueOnce(Object.assign(new Error('PRIVATE DATABASE URL AND PASSWORD'),{code:'P1001'}));
    expect(await runNewsletterWorker('failure')).toMatchObject({status:503,body:{stage:'publication',code:'P1001'}});
    expect(mock.queue).not.toHaveBeenCalled();expect(mock.records.get(leaseKey)).toBe('');expect(mock.records.has('newsletter:v1:worker:last-run')).toBe(false);
    const diagnostics=mock.records.get(attemptKey)!;expect(diagnostics).toContain('P1001');expect(diagnostics).not.toContain('PASSWORD');expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('PRIVATE');
  });
  it('過期租約可恢復，但舊工作結束不能清掉新租約',async()=>{
    mock.records.set(leaseKey,JSON.stringify({requestId:'abandoned',expiresAt:Date.now()-1}));
    mock.queue.mockImplementationOnce(async()=>{mock.records.set(leaseKey,'new-owner');return {sent:0};});
    expect((await runNewsletterWorker('recovered')).status).toBe(200);expect(mock.records.get(leaseKey)).toBe('new-owner');
  });
  it('隔天成功不會抹掉失敗追蹤，寄送不明仍可見但不重寄',async()=>{
    mock.publication.mockRejectedValueOnce(Object.assign(new Error('private'),{code:'P1001'}));
    await runNewsletterWorker('failed-one');const failure=mock.records.get('newsletter:v1:worker:last-failure');expect(failure).toContain('P1001');
    await runNewsletterWorker('success-two');expect(mock.records.get('newsletter:v1:worker:last-failure')).toBe(failure);
    mock.queue.mockResolvedValueOnce({sent:0,uncertain:1});expect((await runNewsletterWorker('uncertain-three')).status).toBe(200);
    expect(JSON.parse(mock.records.get('newsletter:v1:worker:last-failure')!)).toMatchObject({stage:'queue',outcome:'partial',code:'QUEUE_UNCERTAIN'});
  });
  it('發布耗時接近期限，不再排入每日摘要，期限傳給寄信佇列',async()=>{
    const started=Date.now();mock.publication.mockImplementationOnce(async()=>{vi.setSystemTime(started+31000);return {};});
    expect((await runNewsletterWorker('slow')).status).toBe(200);expect(mock.digest).not.toHaveBeenCalled();expect(mock.queue).toHaveBeenCalledWith(3,{deadlineAt:started+45000,requestId:'slow'});
  });
  it('診斷儲存失敗不改變已成功的寄信處理結果',async()=>{
    const original=mock.db.siteSetting.upsert.getMockImplementation()!;mock.db.siteSetting.upsert.mockImplementation(async args=>{if(args.where.key===attemptKey)throw new Error('diagnostics unavailable');return original(args);});
    expect((await runNewsletterWorker('diagnostics-fail')).status).toBe(200);expect(mock.records.get(leaseKey)).toBe('');
  });
});
