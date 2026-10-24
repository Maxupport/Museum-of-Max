'use client';

import { useCallback, useEffect, useState } from 'react';

type Status = {
  configured: boolean; enabled: boolean; syncEnabled: boolean; testOnly: boolean; sender: string;
  dailyLimit: number; usedInLast24Hours: number; remaining: number; pending: number; uncertain: number;
  processing: number; syncPending: number; nextSlotAt: string | null; sheetUrl: string; missing: string[];
  autoUpdatesEnabled: boolean;
  campaigns: { id: string; title: string; createdAt: string; pending: number; sent: number; uncertain: number }[];
};
export default function NewsletterSettingsPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/newsletter/status', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error();
      setStatus(data.data); setMessage('');
    } catch { setMessage('暫時無法讀取寄信狀態，請稍後重整。'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function verify() {
    setBusy(true); setMessage('正在核對簽章連線與關閉狀態；不寄信、不修改名單…');
    try {
      const response = await fetch('/api/newsletter/verify', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error();
      const data = result.data;
      setMessage(data.readyForControlledTesting
        ? '檢查通過：網站設定、Google 簽章連線、試算表存取與兩端暫停狀態正確。尚未寄信；Google TEST_ONLY 與實際送達仍需另外驗收。'
        : !data.website.configured ? 'Google URL／密鑰尚未完整設定，請核對 Production 變數並重新部署。'
          : data.google?.signedConnectionVerified ? 'Google 連線通過，但網站開關或正式網址不符合初始安全設定。請核對環境變數。'
            : '尚無法確認 Google 初始關閉狀態。請檢查兩端密鑰、Web App 部署與存取權、Sheet 權限，及 Google 的 SYNC_ENABLED／SENDING_ENABLED 是否均為 false。');
    } catch { setMessage('連線檢查失敗，請稍後再試；沒有寄送信件。'); }
    finally { setBusy(false); }
  }
  async function sync() {
    if (!window.confirm('將網站名單排入 Google Sheet 同步。這項操作不寄送信件，是否繼續？')) return;
    setBusy(true);
    try {
      const response = await fetch('/api/newsletter/sync', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error();
      await refresh(); setMessage(`已排入 ${data.queued} 筆名單同步，等待 Google 串接啟用後處理。`);
    } catch { setMessage('無法排入名單同步，請稍後再試。'); }
    finally { setBusy(false); }
  }
  async function cancel(campaignId: string) {
    if (!window.confirm('取消這批尚未處理的通知？已送出或處理中的信件無法收回。')) return;
    setBusy(true);
    try {
      const response = await fetch('/api/newsletter/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId }) });
      if (!response.ok) throw new Error();
      await refresh(); setMessage('已取消這批尚未處理的通知。');
    } catch { setMessage('取消失敗，請重新確認佇列狀態。'); }
    finally { setBusy(false); }
  }
  return <section className="glass-panel" style={{ gridColumn: '1 / -1', padding: '1.5rem' }} aria-label="訂閱寄信設定">
    <h2 style={{ marginTop: 0, fontSize: '1.2rem' }}>訂閱同步與寄信狀態</h2>
    {!status ? <p>讀取中…</p> : <>
      <p>寄件人：{status.sender}　｜　{!status.enabled ? '寄信暫停' : status.testOnly ? '僅測試信模式' : '正式寄信模式'}　｜　Google 串接：{status.configured ? '設定已填入，仍需實寄驗收' : '尚未完成授權／設定'}</p>
      <p>每 24 小時上限 {status.dailyLimit} 封；已預留 {status.usedInLast24Hours} 封，剩餘 {status.remaining} 封。歡迎信、測試信與群發共用額度。</p>
      <p>待處理 {status.pending} 筆（含名單同步 {status.syncPending} 筆），處理中 {status.processing} 筆，結果不明 {status.uncertain} 筆。</p>
      {status.nextSlotAt && <p>下一個額度預計釋出：{new Date(status.nextSlotAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}（台灣時間）</p>}
      {status.uncertain > 0 && <p role="alert" style={{ color: '#fbbf24' }}>結果不明的信件不會自動重寄。請先檢查 Google 寄信紀錄與寄件備份。</p>}
      <p>名單同步：{status.syncEnabled ? '啟用' : '暫停'}；自動更新通知：{status.autoUpdatesEnabled ? '啟用' : '暫停'}。{status.missing.join('；')}</p>
      <p>超額排隊不等於寄送失敗；加入佇列也不等於已寄出。首次啟用前請先核對待寄通知。</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        <a className="museum-btn" href={status.sheetUrl} target="_blank" rel="noreferrer">開啟訂閱名單 Google Sheet</a>
        <button className="museum-btn" onClick={() => void refresh()}>重整狀態</button>
        <button className="museum-btn" disabled={busy} onClick={() => void verify()}>檢查初始連線（不寄信）</button>
        <button className="museum-btn" disabled={busy} onClick={() => void sync()}>{busy ? '排入中…' : '排入完整名單同步（不寄信）'}</button>
      </div>
      {status.campaigns.length > 0 && <div style={{ marginTop: '1rem' }}>
        <h3>最近通知</h3>
        {status.campaigns.map((campaign) => <div key={campaign.id} style={{ borderTop: '1px solid #444', padding: '0.7rem 0' }}>
          <p>{campaign.title}　待寄 {campaign.pending}／服務已接受 {campaign.sent}／結果不明 {campaign.uncertain}</p>
          {campaign.pending > 0 && <button className="museum-btn" disabled={busy} onClick={() => void cancel(campaign.id)}>取消這批尚未處理的通知</button>}
        </div>)}
      </div>}
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
