import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../integrations/google-newsletter/Code.gs', import.meta.url), 'utf8');
const secret = 'test-only-google-secret-at-least-32-chars';
const headers = ['訂閱者ID', 'Email', '稱呼／暱稱', '訂閱作品ID', '訂閱作品名稱', '訂閱狀態', '來源章節', '訂閱時間', '取消訂閱時間', '上次通知時間', '最近同步時間'];
class Sheet {
  rows: unknown[][] = [];
  getLastRow() { return this.rows.length; }
  getDataRange() { return { getValues: () => this.rows.map((row) => [...row]) }; }
  appendRow(row: unknown[]) { this.rows.push([...row]); }
  hideSheet() { return this; }
  getRange(row: number, column: number, height = 1, width = 1) {
    const setValues = (values: unknown[][]) => {
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        this.rows[row - 1 + y] ||= [];
        this.rows[row - 1 + y][column - 1 + x] = values[y][x];
      }
    };
    return {
      getValues: () => Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => this.rows[row - 1 + y]?.[column - 1 + x] ?? '')),
      setValues, setValue: (value: unknown) => setValues([[value]]), setNumberFormat: () => {},
    };
  }
}

function setup() {
  const properties = new Map([['GOOGLE_NEWSLETTER_SECRET', secret], ['SENDING_ENABLED', 'true'], ['SYNC_ENABLED', 'true'], ['TEST_ONLY', 'false']]);
  const list = new Sheet(); list.appendRow(headers);
  const sheets = new Map([['訂閱名單', list]]);
  const book = { getSheetByName: (name: string) => sheets.get(name) || null, insertSheet: (name: string) => { const sheet = new Sheet(); sheets.set(name, sheet); return sheet; } };
  const send = vi.fn(); const fetch = vi.fn().mockReturnValue({ getResponseCode: () => 200 });
  const open = vi.fn().mockReturnValue(book); const flush = vi.fn();
  const context = vm.createContext({
    Date, console, Session: { getEffectiveUser: () => ({ getEmail: () => 'maxupport@gmail.com' }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => properties.get(key), setProperty: (key: string, value: string) => properties.set(key, value) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: vi.fn() }) },
    Utilities: { Charset: { UTF_8: 'UTF-8' }, computeHmacSha256Signature: (value: string, key: string) => [...createHmac('sha256', key).update(value).digest()].map((byte) => byte > 127 ? byte - 256 : byte) },
    SpreadsheetApp: { openById: open, flush },
    MailApp: { sendEmail: send, getRemainingDailyQuota: () => 100 },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text: string) => ({ setMimeType: () => JSON.parse(text) }) },
    UrlFetchApp: { fetch },
  });
  vm.runInContext(source, context);
  const post = (payload: unknown, signatureOverride?: string) => {
    const body = JSON.stringify(payload), timestamp = String(Math.floor(Date.now() / 1000));
    return context.doPost({ postData: { contents: JSON.stringify({ payload: body, timestamp, signature: signatureOverride || createHmac('sha256', secret).update(`museum-newsletter-bridge-v1\n${timestamp}\n${body}`).digest('hex') }) } });
  };
  return { properties, sheets, send, fetch, open, flush, context, post };
}
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-23T01:00:00Z')); });
afterEach(() => vi.useRealTimers());
const message = { operation: 'send', jobId: 'a'.repeat(64), to: 'reader@example.test', subject: '本次更新至第四章', html: '<p>更新進度與閱讀連結</p>' };

describe('Google Apps Script bridge contract (isolated simulation)', () => {
  it('setup probes cannot mutate the Sheet or send, even with every switch ON', () => {
    const app = setup();
    for (const enabled of ['false', 'true']) {
      app.properties.set('SENDING_ENABLED', enabled); app.properties.set('SYNC_ENABLED', enabled);
      expect(app.post({ operation: 'sync' })).toMatchObject(enabled === 'false' ? { ok: false, status: 'paused' } : { ok: false, status: 'unavailable' });
      expect(app.post({ operation: 'send' })).toMatchObject(enabled === 'false' ? { ok: true, status: 'deferred' } : { ok: false, status: 'unavailable' });
    }
    expect(app.send).not.toHaveBeenCalled();
    expect(app.sheets.size).toBe(1); expect(app.sheets.get('訂閱名單')!.rows).toEqual([headers]);
    expect(app.properties.size).toBe(4); expect(app.flush).not.toHaveBeenCalled();
  });
  it('rejects unsigned callers before opening the private Sheet', () => {
    const app = setup(); expect(app.post(message, 'b'.repeat(64))).toMatchObject({ ok: false });
    expect(app.open).not.toHaveBeenCalled(); expect(app.send).not.toHaveBeenCalled();
  });
  it('fails closed when send/sync switches are absent and only allows owner tests by default', () => {
    const app = setup(); app.properties.delete('SENDING_ENABLED');
    expect(app.post(message)).toMatchObject({ status: 'deferred' });
    app.properties.set('SENDING_ENABLED', 'true'); app.properties.delete('TEST_ONLY');
    expect(app.post(message)).toMatchObject({ status: 'deferred' });
    expect(app.post({ ...message, to: 'maxupport@gmail.com' })).toMatchObject({ status: 'sent' });
    expect(app.send).toHaveBeenCalledOnce();
  });
  it('reserves a receipt before sending and deduplicates the same job', () => {
    const app = setup();
    app.send.mockImplementationOnce(() => expect(app.sheets.get('_寄信紀錄')!.rows[1][1]).toBe('reserved'));
    expect(app.post(message)).toMatchObject({ status: 'sent' });
    expect(app.post(message)).toMatchObject({ status: 'sent' });
    expect(app.send).toHaveBeenCalledOnce();
    expect(app.sheets.get('_寄信紀錄')!.rows[0]).toEqual(['job_id', 'status', 'reserved_at', 'finished_at']);
    expect(JSON.stringify(app.sheets.get('_寄信紀錄')!.rows)).not.toContain('reader@example.test');
  });
  it('independently enforces 80 attempts per rolling 24 hours', () => {
    const app = setup();
    for (let index = 0; index < 80; index++) expect(app.post({ ...message, jobId: index.toString(16).padStart(64, '0') })).toMatchObject({ status: 'sent' });
    expect(app.post(message)).toMatchObject({ status: 'deferred' }); expect(app.send).toHaveBeenCalledTimes(80);
    vi.setSystemTime(new Date(Date.now() + 86400001));
    expect(app.post(message)).toMatchObject({ status: 'sent' }); expect(app.send).toHaveBeenCalledTimes(81);
  });
  it('does not retry an ambiguous MailApp error', () => {
    const app = setup(); app.send.mockImplementationOnce(() => { throw new Error('ambiguous transport failure'); });
    expect(app.post(message)).toMatchObject({ status: 'uncertain' }); expect(app.post(message)).toMatchObject({ status: 'uncertain' });
    expect(app.send).toHaveBeenCalledOnce();
  });
  it('rejects multiple recipients and subject-header injection', () => {
    const app = setup();
    expect(app.post({ ...message, to: 'a@example.test,b@example.test' })).toMatchObject({ ok: false });
    expect(app.post({ ...message, subject: 'hello\r\nBcc: other@example.test' })).toMatchObject({ ok: false });
    expect(app.send).not.toHaveBeenCalled();
  });
  it('mirrors revisions safely, escapes formulas and never reactivates a later opt-out', () => {
    const app = setup();
    const reader = { id: 'reader-1', email: 'reader@example.test', name: '=IMPORTXML("bad")', active: true, novelId: 'all', createdAt: new Date().toISOString() };
    expect(app.post({ operation: 'sync', revision: 1, subscriber: reader })).toMatchObject({ status: 'synced' });
    expect(app.sheets.get('訂閱名單')!.rows[1][2]).toBe('\'=IMPORTXML("bad")');
    app.post({ operation: 'sync', revision: 3, subscriber: { ...reader, active: false } });
    app.post({ operation: 'sync', revision: 2, subscriber: reader });
    expect(app.sheets.get('訂閱名單')!.rows[1][5]).toBe('已退訂');
    app.post({ operation: 'sync', revision: 3, subscriber: reader });
    expect(app.sheets.get('訂閱名單')!.rows[1][5]).toBe('已退訂');
    expect(app.send).not.toHaveBeenCalled();
  });
  it('signs a fixed-body worker call without exposing the shared secret in its URL', () => {
    const app = setup(); app.context.runWebsiteQueue();
    const [url, request] = app.fetch.mock.calls[0];
    expect(url).toBe('https://museum-of-max.vercel.app/api/internal/newsletter-worker');
    expect(request.payload).toBe('{}');
    expect(request.headers['x-newsletter-signature']).toBe(createHmac('sha256', secret).update(`museum-newsletter-worker-v1\n${request.headers['x-newsletter-time']}\n{}`).digest('hex'));
    expect(app.send).not.toHaveBeenCalled();
  });
});
