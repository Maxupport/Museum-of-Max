'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Lock, ArrowLeft } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  // Mode: 'visitor' (default passcode mode) vs 'admin' (easter egg unlocked curator login)
  const [mode, setMode] = useState<'visitor' | 'admin'>('visitor');

  // Visitor state
  const [passcode, setPasscode] = useState('');
  const [isEntering, setIsEntering] = useState(false);
  const [visitorError, setVisitorError] = useState('');
  const [visitorLoading, setVisitorLoading] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  // Admin login state
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  // Visitor form submit
  const handleVisitorEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setVisitorError('請輸入通行密碼');
      return;
    }

    setVisitorError('');
    setVisitorLoading(true);

    try {
      const res = await fetch('/api/auth/visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        setIsEntering(true);
        setTimeout(() => {
          router.push(data.redirectUrl || '/museum');
        }, 1200);
      } else {
        setVisitorError(data.error || '通行密碼無效，請重新確認');
      }
    } catch {
      setVisitorError('連線失敗，請檢查網路設定');
    } finally {
      setVisitorLoading(false);
    }
  };

  // Admin login submit
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);

    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUser, password: adminPass }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        setIsEntering(true);
        setTimeout(() => {
          window.location.href = '/museum';
        }, 1000);
      } else {
        setAdminError(data.error || '帳號或密碼錯誤');
      }
    } catch {
      setAdminError('連線失敗，請稍後再試');
    } finally {
      setAdminLoading(false);
    }
  };

  // Hidden Easter Egg: Click title 5 times rapidly to activate Admin Mode
  const handleTitleClick = () => {
    if (mode === 'admin') return;
    const nextCount = clickCount + 1;
    setClickCount(nextCount);
    if (nextCount >= 5) {
      setMode('admin');
      setClickCount(0);
    }
  };

  return (
    <>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        position: 'relative'
      }}>
        <div className="glass-panel animate-fade-in" style={{
          maxWidth: '500px',
          width: '100%',
          padding: '4rem 3rem',
          textAlign: 'center',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {mode === 'visitor' ? (
            /* Visitor Passcode Mode (Clean & Default) */
            <>
              <h1 
                onClick={handleTitleClick}
                style={{
                  fontSize: '2.4rem',
                  fontWeight: 300,
                  marginBottom: '1rem',
                  letterSpacing: '4px',
                  color: '#fff',
                  fontFamily: 'var(--font-noto-serif)',
                  cursor: 'default',
                  userSelect: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  alignItems: 'center',
                  lineHeight: 1.2
                }}
              >
                <span>MAXUPPORT</span>
                <span style={{ fontSize: '1.8rem', letterSpacing: '6px', whiteSpace: 'nowrap' }}>PRIVATE MUSEUM</span>
              </h1>
              <p style={{
                color: 'var(--text-secondary)',
                marginBottom: '3rem',
                fontSize: '0.9rem',
                letterSpacing: '2px',
                textTransform: 'uppercase'
              }}>
                Curated Exhibition Space
              </p>

              <form onSubmit={handleVisitorEnter} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                alignItems: 'center'
              }}>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (visitorError) setVisitorError('');
                  }}
                  placeholder="ENTER PASSCODE"
                  className="museum-input"
                  style={{
                    textAlign: 'center',
                    letterSpacing: '4px',
                    borderColor: visitorError ? 'rgba(239, 68, 68, 0.6)' : undefined
                  }}
                  disabled={visitorLoading || isEntering}
                  autoFocus
                />

                {visitorError && (
                  <div style={{
                    color: '#f87171',
                    fontSize: '0.85rem',
                    letterSpacing: '1px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    padding: '0.5rem 1rem',
                    borderRadius: '2px',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    width: '100%',
                    maxWidth: '400px'
                  }}>
                    {visitorError}
                  </div>
                )}

                <button
                  type="submit"
                  className="museum-btn"
                  disabled={visitorLoading || isEntering}
                >
                  {visitorLoading ? 'VERIFYING...' : 'ENTER'}
                </button>
              </form>
            </>
          ) : (
            /* Admin Mode (Unlocked by 5 clicks easter egg) */
            <div className="animate-fade-in">
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                margin: '0 auto 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
              }}>
                <ShieldCheck size={26} color="#4ade80" />
              </div>

              <h1 style={{
                fontSize: '1.8rem',
                fontWeight: 300,
                marginBottom: '0.5rem',
                letterSpacing: '3px',
                color: '#fff',
                fontFamily: 'var(--font-noto-serif)'
              }}>
                CURATOR ACCESS
              </h1>
              <p style={{
                color: 'var(--text-secondary)',
                marginBottom: '2.5rem',
                fontSize: '0.8rem',
                letterSpacing: '2px',
                textTransform: 'uppercase'
              }}>
                Administrator Portal Unlocked
              </p>

              {adminError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '0.7rem 1rem',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  marginBottom: '1.5rem'
                }}>
                  {adminError}
                </div>
              )}

              <form onSubmit={handleAdminLogin} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.2rem',
                alignItems: 'center',
                width: '100%'
              }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <User size={18} style={{
                    position: 'absolute',
                    left: '1.2rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)'
                  }} />
                  <input
                    type="text"
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value)}
                    placeholder="USERNAME"
                    className="museum-input"
                    style={{ paddingLeft: '3rem', maxWidth: '100%' }}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ position: 'relative', width: '100%' }}>
                  <Lock size={18} style={{
                    position: 'absolute',
                    left: '1.2rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)'
                  }} />
                  <input
                    type="password"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    placeholder="PASSWORD"
                    className="museum-input"
                    style={{ paddingLeft: '3rem', maxWidth: '100%' }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="museum-btn"
                  disabled={adminLoading || isEntering}
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  {adminLoading ? 'AUTHENTICATING...' : 'LOGIN TO DASHBOARD'}
                </button>
              </form>

              <button
                onClick={() => {
                  setMode('visitor');
                  setAdminError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  letterSpacing: '1px',
                  marginTop: '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  margin: '2rem auto 0',
                  transition: 'color 0.3s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                <ArrowLeft size={14} /> 返回訪客輸入模式
              </button>
            </div>
          )}
        </div>

        {/* Pure & Clean Footer (Zero public links) */}
        <footer className="animate-fade-in" style={{
          marginTop: '6rem',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '2rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          maxWidth: '500px',
          color: 'var(--text-secondary)',
          fontSize: '0.8rem',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          animationDelay: '0.3s'
        }}>
          <div>© 2026 MAXUPPORT • ALL RIGHTS RESERVED</div>
        </footer>
      </div>

      {/* Door Animation Container */}
      <div className={`door-container ${isEntering ? 'door-close' : ''}`}>
        <div className="door-left" />
        <div className="door-right" />
      </div>
    </>
  );
}
