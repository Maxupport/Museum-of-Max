'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, BookOpen, ArrowLeft, Loader2 } from 'lucide-react';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [subscriberEmail, setSubscriberEmail] = useState<string | null>(null);
  const [alreadyUnsubscribed, setAlreadyUnsubscribed] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorMsg('無效的取消訂閱連結，缺少驗證金鑰。');
      return;
    }

    fetch(`/api/subscribe/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setSubscriberEmail(data.email);
          if (!data.active) {
            setAlreadyUnsubscribed(true);
          }
        } else {
          setErrorMsg(data.error || '查無此訂閱資料或金鑰已失效。');
        }
      })
      .catch(() => setErrorMsg('連線錯誤，請稍後再試。'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleConfirmUnsubscribe = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/subscribe/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
      } else {
        setErrorMsg(data.error || '取消訂閱失敗');
      }
    } catch {
      setErrorMsg('連線錯誤，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      maxWidth: '480px',
      width: '100%',
      background: 'rgba(22, 22, 28, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '2.5rem 2rem',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(16px)',
      textAlign: 'center',
    }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(192, 132, 252, 0.1)', color: '#c084fc', marginBottom: '1.5rem', border: '1px solid rgba(192, 132, 252, 0.25)' }}>
        <BookOpen size={26} />
      </div>

      <h1 style={{ fontFamily: 'var(--font-noto-serif)', fontSize: '1.5rem', color: '#fff', margin: '0 0 0.8rem 0' }}>
        取消小說連載訂閱
      </h1>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', color: 'var(--text-secondary)', padding: '2rem 0' }}>
          <Loader2 size={18} className="animate-spin" />
          <span>正在驗證訂閱資訊...</span>
        </div>
      ) : errorMsg ? (
        <div>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', padding: '1rem', color: '#f87171', fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', textAlign: 'left' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
          <Link href="/" className="museum-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
            <ArrowLeft size={15} /> 返回首頁
          </Link>
        </div>
      ) : success || alreadyUnsubscribed ? (
        <div>
          <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '6px', padding: '1.2rem', color: '#4ade80', fontSize: '0.95rem', marginBottom: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
            <CheckCircle2 size={22} style={{ flexShrink: 0 }} />
            <div>
              <strong>{alreadyUnsubscribed ? '您先前已取消訂閱' : '已成功取消訂閱'}</strong>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                信箱 <code>{subscriberEmail}</code> 未來不會再收到本連載的更新通知信。
              </p>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            若未來想重新接收通知，您隨時可以在小說閱讀頁面重新輸入信箱訂閱。
          </p>
          <Link href="/museum/creation_lab" className="museum-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
            <ArrowLeft size={15} /> 返回創作 LAB
          </Link>
        </div>
      ) : (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.8rem' }}>
            您確定要為信箱 <span style={{ color: '#fff', fontWeight: 600 }}>{subscriberEmail}</span> 取消接收未來的最新章節更新通知嗎？
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              type="button"
              className="museum-btn"
              onClick={() => router.push('/museum/creation_lab')}
              style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}
            >
              返回繼續閱讀
            </button>
            <button
              type="button"
              className="museum-btn"
              disabled={submitting}
              onClick={handleConfirmUnsubscribe}
              style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
            >
              {submitting ? '處理中...' : '確認取消訂閱'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      background: 'radial-gradient(ellipse at 50% 30%, rgba(192, 132, 252, 0.08) 0%, rgba(11, 11, 14, 1) 75%)',
    }}>
      <Suspense fallback={
        <div style={{ color: 'var(--text-secondary)' }}>載入中...</div>
      }>
        <UnsubscribeContent />
      </Suspense>
    </div>
  );
}
