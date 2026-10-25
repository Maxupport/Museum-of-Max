import { SUBSCRIBER_SHEET_ID } from './newsletter-config';

const DAY = 86_400_000;
const TAIPEI_OFFSET = 8 * 60 * 60 * 1000;
export type OwnerSubscriptionDigest = { date: string; newSubscribers: number; activeSubscribers: number; totalSubscribers: number };

export function taipeiDate(now: Date) { return new Date(now.getTime() + TAIPEI_OFFSET).toISOString().slice(0, 10); }

export function completedSubscriptionDay(now: Date) {
  const local = new Date(now.getTime() + TAIPEI_OFFSET);
  if (local.getUTCHours() === 0 && local.getUTCMinutes() < 5) return null;
  const end = Date.parse(`${taipeiDate(now)}T00:00:00+08:00`);
  return { date: new Date(end - DAY + TAIPEI_OFFSET).toISOString().slice(0, 10), start: new Date(end - DAY), end: new Date(end) };
}

export function ownerSubscriptionDigestMessage(digest: OwnerSubscriptionDigest) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(digest.date) || ![digest.newSubscribers, digest.activeSubscribers, digest.totalSubscribers].every((n) => Number.isSafeInteger(n) && n >= 0) || digest.newSubscribers < 1) throw new Error('INVALID_OWNER_DIGEST');
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SUBSCRIBER_SHEET_ID}/edit`;
  return {
    subject: `【訂閱日報】${digest.date} 新增 ${digest.newSubscribers} 人`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.8;color:#252525"><h2>Max，這是昨日的訂閱摘要</h2><p>統計日期：${digest.date}（台灣時間 00:00–24:00）</p><ul><li>當日新增訂閱：<strong>${digest.newSubscribers} 人</strong></li><li>目前有效訂閱：${digest.activeSubscribers} 人</li><li>累積登記：${digest.totalSubscribers} 人</li></ul><p><a href="${sheetUrl}">開啟訂閱名單 Google Sheet</a></p><p style="font-size:12px;color:#666">新增依首次成功登記日期計算，不重複計算重送表單；目前有效人數為彙整當下狀態。當日沒有新增時不寄信。試算表仍維持原有存取權限，請以管理帳號登入。</p></div>`,
  };
}
