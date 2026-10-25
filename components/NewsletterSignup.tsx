'use client';

import { useState } from 'react';
import styles from './NewsletterSignup.module.css';

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
  return <section id="newsletter" className={styles.panel} aria-labelledby="newsletter-heading">
    <div className={styles.copy}><p className={styles.eyebrow}>LET THE STORY CONTINUE</p><h2 id="newsletter-heading">下一章，寄給你。</h2>
    <p>訂閱生涯擺渡人 Max 的創作，接收歡迎信、小說更新進度與偶爾的網站通告。</p><p className={styles.note}>免費訂閱・隨時可由信內連結取消</p></div>
    <div><form onSubmit={(event) => void submit(event)} className={styles.form}>
      <label>怎麼稱呼你 <span>（選填）</span><input className={styles.input} placeholder="你的名字或暱稱" autoComplete="name" maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>電子信箱<input className={styles.input} placeholder="you@example.com" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <div style={{ display: 'none' }} aria-hidden="true"><input name="website_url" tabIndex={-1} autoComplete="off" /></div>
      <button className={styles.button} disabled={busy}>{busy ? '登記中…' : '訂閱全部創作更新'} <span aria-hidden="true">→</span></button>
    </form>
    <p className={styles.privacy}>只用於創作通知，不公開你的信箱。信件依佇列與每日額度寄送，可能稍晚抵達。</p>
    {message && <p className={styles.message} role="status" aria-live="polite">{message}</p>}</div>
  </section>;
}
