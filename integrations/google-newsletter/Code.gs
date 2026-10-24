/* Install in the owner's Apps Script project. All switches default OFF. */
const OWNER_EMAIL = 'maxupport@gmail.com';
const SHEET_ID = '10MojPCfHzAyCuYeGEVB91pFFEm1ufFn8rhc5eafpebI';
const LIST_HEADERS = ['訂閱者ID', 'Email', '稱呼／暱稱', '訂閱作品ID', '訂閱作品名稱', '訂閱狀態', '來源章節', '訂閱時間', '取消訂閱時間', '上次通知時間', '最近同步時間'];
const LEDGER_NAME = '_寄信紀錄';

function hexHmac(value, secret) {
  return Utilities.computeHmacSha256Signature(value, secret, Utilities.Charset.UTF_8)
    .map(function(byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}
function equalSignature(left, right) {
  if (typeof left !== 'string' || !/^[a-f0-9]{64}$/.test(left)) return false;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}
function output(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function ownerCheck() {
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== OWNER_EMAIL) throw new Error('Wrong script owner');
}
function plain(value) {
  const text = value == null ? '' : String(value);
  return /^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    ownerCheck();
    const properties = PropertiesService.getScriptProperties();
    const secret = properties.getProperty('GOOGLE_NEWSLETTER_SECRET') || '';
    const raw = event && event.postData && event.postData.contents;
    if (secret.length < 32 || typeof raw !== 'string' || raw.length > 150000) throw new Error('Unauthorized');
    const envelope = JSON.parse(raw);
    if (typeof envelope.payload !== 'string' || !/^\d{10,12}$/.test(envelope.timestamp) ||
        Math.abs(Date.now() / 1000 - Number(envelope.timestamp)) > 60 ||
        !equalSignature(envelope.signature, hexHmac('museum-newsletter-bridge-v1\n' + envelope.timestamp + '\n' + envelope.payload, secret))) throw new Error('Unauthorized');
    const payload = JSON.parse(envelope.payload);
    locked = lock.tryLock(5000);
    if (!locked) throw new Error('Busy');
    const book = SpreadsheetApp.openById(SHEET_ID);
    if (payload.operation === 'sync') {
      if (properties.getProperty('SYNC_ENABLED') !== 'true') return output({ ok: false, status: 'paused' });
      syncReader(book, properties, payload.subscriber, payload.revision);
      return output({ ok: true, status: 'synced' });
    }
    if (payload.operation !== 'send') throw new Error('Invalid operation');
    if (properties.getProperty('SENDING_ENABLED') !== 'true') return output({ ok: true, status: 'deferred' });
    return output(deliver(book, properties, payload));
  } catch (_error) {
    // Never disclose subscriber details, secret values, provider errors or spreadsheet contents.
    return output({ ok: false, status: 'unavailable' });
  } finally { if (locked) lock.releaseLock(); }
}

function syncReader(book, properties, reader, revision) {
  if (!reader || typeof reader.id !== 'string' || !/^[\w:-]{1,128}$/.test(reader.id) || !Number.isFinite(revision)) throw new Error('Invalid reader');
  const sheet = book.getSheetByName('訂閱名單');
  if (!sheet || JSON.stringify(sheet.getRange(1, 1, 1, 11).getValues()[0]) !== JSON.stringify(LIST_HEADERS)) throw new Error('Unexpected headers');
  const revisionKey = 'sync-revision:' + reader.id;
  const previousRevision = Number(properties.getProperty(revisionKey) || '0');
  if (revision < previousRevision) return;
  const count = sheet.getLastRow();
  const ids = count > 1 ? sheet.getRange(2, 1, count - 1, 1).getValues() : [];
  const index = ids.findIndex(function(row) { return row[0] === reader.id; });
  const rowIndex = index < 0 ? count + 1 : index + 2;
  if (reader.deleted && index < 0) { properties.setProperty(revisionKey, String(revision)); return; }
  const previous = index < 0 ? [] : sheet.getRange(rowIndex, 1, 1, 11).getValues()[0];
  // An equal-revision late event must never reactivate a reader who has already opted out.
  if (revision === previousRevision && previous[5] === '已退訂' && reader.active) return;
  const now = new Date();
  const date = function(value) { return value ? new Date(value) : ''; };
  const row = reader.deleted ? previous : [reader.id, plain(reader.email), plain(reader.name), plain(reader.novelId),
    plain(reader.novelTitle || ''), reader.active ? '有效訂閱' : '已退訂', reader.sourceChapter || '', date(reader.createdAt),
    reader.active ? '' : previous[8] || now, date(reader.lastNotifiedAt), now];
  if (reader.deleted) { row[5] = '已退訂'; row[8] = row[8] || now; row[10] = now; }
  sheet.getRange(rowIndex, 1, 1, 11).setValues([row]);
  sheet.getRange(rowIndex, 8, 1, 4).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  properties.setProperty(revisionKey, String(revision));
}

function deliver(book, properties, payload) {
  if (!/^[a-f0-9]{64}$/.test(payload.jobId) && !/^welcome:[\w-]{1,128}$/.test(payload.jobId)) throw new Error('Invalid job');
  if (typeof payload.to !== 'string' || payload.to.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(payload.to) ||
      typeof payload.subject !== 'string' || /[\r\n]/.test(payload.subject) || payload.subject.length > 500 ||
      typeof payload.html !== 'string' || payload.html.length > 100000) throw new Error('Invalid message');
  if (properties.getProperty('TEST_ONLY') !== 'false' && payload.to.toLowerCase() !== OWNER_EMAIL) return { ok: true, status: 'deferred' };
  let ledger = book.getSheetByName(LEDGER_NAME);
  if (!ledger) {
    ledger = book.insertSheet(LEDGER_NAME);
    ledger.appendRow(['job_id', 'status', 'reserved_at', 'finished_at']);
    ledger.hideSheet(); // Convenience only, not access control. The entire workbook must remain private.
  }
  const rows = ledger.getDataRange().getValues().slice(1);
  const existing = rows.find(function(row) { return row[0] === payload.jobId; });
  if (existing) return { ok: true, status: existing[1] === 'sent' ? 'sent' : 'uncertain' };
  const used = rows.filter(function(row) { return new Date(row[2]).getTime() > Date.now() - 86400000; }).length;
  if (used >= 80 || MailApp.getRemainingDailyQuota() < 1) return { ok: true, status: 'deferred' };
  const rowIndex = ledger.getLastRow() + 1;
  ledger.getRange(rowIndex, 1, 1, 4).setValues([[payload.jobId, 'reserved', new Date(), '']]);
  SpreadsheetApp.flush(); // Persist the attempt BEFORE calling the non-transactional mail service.
  try {
    MailApp.sendEmail({ to: payload.to, subject: payload.subject,
      body: payload.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
      htmlBody: payload.html, name: 'Maxupport 私人博物館', replyTo: OWNER_EMAIL });
    ledger.getRange(rowIndex, 2).setValue('sent');
    ledger.getRange(rowIndex, 4).setValue(new Date());
    SpreadsheetApp.flush();
    return { ok: true, status: 'sent' };
  } catch (_error) {
    ledger.getRange(rowIndex, 2).setValue('uncertain');
    return { ok: true, status: 'uncertain' }; // Never automatically retry an ambiguous provider result.
  }
}

function runWebsiteQueue() {
  ownerCheck();
  const properties = PropertiesService.getScriptProperties();
  const secret = properties.getProperty('GOOGLE_NEWSLETTER_SECRET') || '';
  if (secret.length < 32) throw new Error('Configure the shared secret first');
  const body = '{}';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = UrlFetchApp.fetch('https://museum-of-max.vercel.app/api/internal/newsletter-worker', {
    method: 'post', contentType: 'application/json', payload: body, muteHttpExceptions: true,
    headers: { 'x-newsletter-time': timestamp,
      'x-newsletter-signature': hexHmac('museum-newsletter-worker-v1\n' + timestamp + '\n' + body, secret) },
  });
  if (response.getResponseCode() !== 200) throw new Error('Website worker unavailable');
}

// Run manually only after reviewing and approving Google authorization. Does NOT send mail.
function installWorkerTrigger() {
  ownerCheck();
  const properties = PropertiesService.getScriptProperties();
  if ((properties.getProperty('GOOGLE_NEWSLETTER_SECRET') || '').length < 32) throw new Error('Configure the shared secret first');
  ScriptApp.getProjectTriggers().filter(function(trigger) { return trigger.getHandlerFunction() === 'runWebsiteQueue'; })
    .forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger('runWebsiteQueue').timeBased().everyMinutes(15).create();
}
