'use client';

import { useState } from 'react';

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, novelId: 'all', website_url: new FormData(event.currentTarget).get('website_url') }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || '登記失敗，請稍後再試。');
      setMessage(data.message); setEmail(''); setName('');
    } catch (error) { setMessage(error instanceof Error ? error.message : '連線失敗，請稍後再試。'); }
    finally { setBusy(false); }
  }
  return <section className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }} aria-labelledby="newsletter-heading">
    <h2 id="newsletter-heading">訂閱創作與連載更新</h2>
    <p>接收訂閱歡迎信、小說更新進度與網站通告。依寄送佇列及每日額度處理，可由信內連結取消訂閱。</p>
    <form onSubmit={(event) => void submit(event)} style={{ display: 'grid', gap: '1rem' }}>
      <label>稱呼（選填）<input className="museum-input" autoComplete="name" maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Email<input className="museum-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <div style={{ display: 'none' }} aria-hidden="true"><input name="website_url" tabIndex={-1} autoComplete="off" /></div>
      <button className="museum-btn" disabled={busy}>{busy ? '登記中…' : '訂閱全部創作更新'}</button>
    </form>
    {message && <p role="status">{message}</p>}
  </section>;
}
