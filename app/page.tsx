'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Lock, ArrowLeft, KeyRound, Sparkles, ArrowRight } from 'lucide-react';

interface IntentOption {
  id: string;
  label: string;
  code: string;
  description: string;
  icon: string;
}

const INTENT_OPTIONS: IntentOption[] = [
  {
    id: 'vc',
    label: '我想了解 Max 有什麼專業。',
    code: 'VC2026',
    description: '開放展區：新創 / 風險投資、商業議題分析、職涯履歷',
    icon: '💼',
  },
  {
    id: 'nvc',
    label: '我想了解 Max 除了專業還會什麼！',
    code: 'NVC2026',
    description: '開放展區：聲音探索、創作 Lab、人生擺渡',
    icon: '✨',
  },
  {
    id: 'max',
    label: '我想知道 Max 創作過什麼',
    code: 'Max',
    description: '開放展區：創作 Lab (文章與小說)、聲音探索',
    icon: '🎨',
  },
  {
    id: 'vvip',
    label: '我想知道 Max 的所有事情！',
    code: 'VVIP',
    description: '開放權限：全站 6 大展區完整探索通行證',
    icon: '👑',
  },
  {
    id: 'series',
    label: '我想看連載故事！',
    code: 'Series',
    description: '直通門票：創作 Lab 小說連載區',
    icon: '📖',
  },
];

export default function Home() {
  const router = useRouter();

  // Mode: 'visitor' (default) vs 'admin' (easter egg unlocked curator login)
  const [mode, setMode] = useState<'visitor' | 'admin'>('visitor');

  // Visitor step: 'welcome' (default choice screen) vs 'passcode' (input form)
  const [visitorStep, setVisitorStep] = useState<'welcome' | 'passcode'>('welcome');

  // Selected Option for Unlocked Passcode Modal / Card
  const [selectedOption, setSelectedOption] = useState<IntentOption | null>(null);

  // Visitor input state
  const [passcode, setPasscode] = useState('');
  const [isEntering, setIsEntering] = useState(false);
  const [visitorError, setVisitorError] = useState('');
  const [visitorLoading, setVisitorLoading] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  // Target redirect URL if user was intercepted when visiting protected routes
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const target = params.get('redirect');
      if (target && target.startsWith('/') && !target.startsWith('//')) {
        setRedirectUrl(target);
      }
    }
  }, []);

  // Admin login state
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  // Auto-verify & enter with code
  const handleAutoEnterWithCode = async (codeToUse: string) => {
    setPasscode(codeToUse);
    setVisitorError('');
    setVisitorLoading(true);

    try {
      const res = await fetch('/api/auth/visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: codeToUse }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        setIsEntering(true);
        setTimeout(() => {
          router.push(redirectUrl || data.redirectUrl || '/museum');
        }, 1200);
      } else {
        setVisitorError(data.error || '通行密碼驗證失敗，請手動確認');
        setVisitorStep('passcode');
      }
    } catch {
      setVisitorError('連線失敗，請檢查網路設定');
      setVisitorStep('passcode');
    } finally {
      setVisitorLoading(false);
    }
  };

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
          router.push(redirectUrl || data.redirectUrl || '/museum');
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
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.2rem',
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        <div className="glass-panel animate-fade-in" style={{
          maxWidth: visitorStep === 'welcome' && !selectedOption ? '640px' : '520px',
          width: '100%',
          padding: visitorStep === 'welcome' && !selectedOption ? '3.5rem 2.2rem' : '3.5rem 2.5rem',
          textAlign: 'center',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {mode === 'visitor' ? (
            visitorStep === 'welcome' ? (
              /* Welcome Step: 5 Intent Options */
              <div>
                <h1 
                  onClick={handleTitleClick}
                  style={{
                    fontSize: 'clamp(1.8rem, 4vw, 2.3rem)',
                    fontWeight: 300,
                    marginBottom: '0.4rem',
                    letterSpacing: '4px',
                    color: '#fff',
                    fontFamily: 'var(--font-noto-serif)',
                    cursor: 'default',
                    userSelect: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                    alignItems: 'center',
                    lineHeight: 1.2
                  }}
                >
                  <span>MAX&apos;S</span>
                  <span style={{ fontSize: 'clamp(1.2rem, 3.2vw, 1.6rem)', letterSpacing: '6px', whiteSpace: 'nowrap' }}>PRIVATE MUSEUM</span>
                </h1>
                
                <p style={{
                  color: 'var(--text-secondary)',
                  marginBottom: '2rem',
                  fontSize: 'clamp(0.68rem, 2.7vw, 0.85rem)',
                  letterSpacing: '1px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  董鈺新 Max / yuo1238 / Maxupport / Nathan
                </p>

                {redirectUrl && (
                  <div style={{
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '6px',
                    padding: '0.6rem 1rem',
                    marginBottom: '1.8rem',
                    fontSize: '0.85rem',
                    color: '#38bdf8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}>
                    <span>🎯 您正在前往目標展區，請選擇參觀身分以繼續導向</span>
                  </div>
                )}

                {/* Modal / Card when an option is clicked */}
                {selectedOption ? (
                  <div className="animate-fade-in" style={{ padding: '0.5rem 0' }}>
                    <div style={{
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1.5px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '8px',
                      padding: '2rem 1.5rem',
                      marginBottom: '2rem',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>{selectedOption.icon}</div>
                      <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '1px' }}>
                        您選擇的參觀意圖：
                      </div>
                      <div style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 600, marginBottom: '1.2rem', fontFamily: 'var(--font-noto-serif)' }}>
                        {selectedOption.label}
                      </div>

                      <div style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px dashed rgba(56, 189, 248, 0.4)',
                        padding: '1.2rem',
                        borderRadius: '6px',
                        marginBottom: '1rem'
                      }}>
                        <div style={{ fontSize: '0.8rem', color: '#38bdf8', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '0.3rem', fontWeight: 500 }}>
                          🔑 您的專屬通行密碼
                        </div>
                        <div style={{ fontSize: '2.2rem', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '4px' }}>
                          {selectedOption.code}
                        </div>
                      </div>

                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
                        {selectedOption.description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <button
                        onClick={() => handleAutoEnterWithCode(selectedOption.code)}
                        className="museum-btn"
                        disabled={visitorLoading || isEntering}
                        style={{
                          width: '100%',
                          background: 'rgba(56, 189, 248, 0.18)',
                          borderColor: '#38bdf8',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '1rem',
                          padding: '0.9rem 1.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.6rem',
                          boxShadow: '0 4px 20px rgba(56, 189, 248, 0.25)'
                        }}
                      >
                        {visitorLoading ? '驗證進入中...' : (redirectUrl ? '帶入通行碼並前往目標頁面' : '帶入通行碼並進入博物館')}
                        {!visitorLoading && <ArrowRight size={18} />}
                      </button>

                      <button
                        onClick={() => {
                          setPasscode(selectedOption.code);
                          setSelectedOption(null);
                          setVisitorStep('passcode');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          letterSpacing: '1px'
                        }}
                      >
                        手動切換至密碼輸入頁面
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Standard 5 Options List */
                  <div>
                    <div style={{
                      fontSize: 'clamp(0.72rem, 2.5vw, 0.9rem)',
                      color: '#e2e8f0',
                      marginBottom: '1.5rem',
                      letterSpacing: '1px',
                      fontFamily: 'var(--font-noto-serif)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: '100%'
                    }}>
                      <Sparkles size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
                      <span>請根據參觀動機點選以取得專屬通行碼</span>
                    </div>

                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                      marginBottom: '2rem'
                    }}>
                      {INTENT_OPTIONS.map((opt) => (
                        <div
                          key={opt.id}
                          onClick={() => {
                            setSelectedOption(opt);
                            setPasscode(opt.code);
                          }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            padding: '0.9rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'all 0.25s ease',
                            textAlign: 'left',
                            gap: '0.9rem'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{opt.icon}</span>
                            <div style={{ color: '#fff', fontSize: 'clamp(0.83rem, 2.5vw, 0.95rem)', fontWeight: 500, letterSpacing: '0.3px', lineHeight: 1.4 }}>
                              {opt.label}
                            </div>
                          </div>

                          <div style={{
                            background: 'rgba(56, 189, 248, 0.1)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            color: '#7dd3fc',
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            padding: '0.38rem 0.75rem',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                            letterSpacing: '1px',
                            flexShrink: 0,
                            marginLeft: '0.5rem'
                          }}>
                            取得通行碼
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setVisitorStep('passcode')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        letterSpacing: '1px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'color 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                      <KeyRound size={15} />
                      我已有通行碼，直接手動輸入
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Passcode Form Step */
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
                  <span>MAX&apos;S</span>
                  <span style={{ fontSize: '1.6rem', letterSpacing: '6px', whiteSpace: 'nowrap' }}>PRIVATE MUSEUM</span>
                </h1>
                <p style={{
                  color: 'var(--text-secondary)',
                  marginBottom: '2.5rem',
                  fontSize: 'clamp(0.68rem, 2.7vw, 0.85rem)',
                  letterSpacing: '1px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  董鈺新 Max / yuo1238 / Maxupport / Nathan
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

                <button
                  onClick={() => {
                    setVisitorStep('welcome');
                    setSelectedOption(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    letterSpacing: '1px',
                    marginTop: '2rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                  <ArrowLeft size={14} />
                  返回選擇參觀意圖頁面
                </button>
              </>
            )
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
          marginTop: '4rem',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '1.5rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          maxWidth: '500px',
          color: 'var(--text-secondary)',
          fontSize: 'clamp(0.65rem, 2.3vw, 0.8rem)',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          animationDelay: '0.3s'
        }}>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            © 2026 MAXUPPORT • ALL RIGHTS RESERVED
          </div>
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
