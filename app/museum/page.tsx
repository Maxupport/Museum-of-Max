'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Lock, Compass } from 'lucide-react';
import { EXHIBITS, ALL_EXHIBIT_KEYS, ExhibitConfig } from '@/lib/constants';

export default function MuseumHall() {
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(true);
  const [allowedPermissions, setAllowedPermissions] = useState<string[] | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  const [visitorAvatarUrl, setVisitorAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOpening(false);
    }, 100);

    const avatarMatch = document.cookie.match(/(?:^|; )visitor_avatar_url=([^;]*)/);
    if (avatarMatch && avatarMatch[1]) {
      setVisitorAvatarUrl(decodeURIComponent(avatarMatch[1]));
    }

    fetch('/api/auth/admin')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.authenticated) {
          setAllowedPermissions(ALL_EXHIBIT_KEYS);
          setCheckedAuth(true);
        } else {
          try {
            const isCuratorCookie = document.cookie.includes('is_curator=true');
            if (isCuratorCookie) {
              setAllowedPermissions(ALL_EXHIBIT_KEYS);
            } else {
              const match = document.cookie.match(/(?:^|; )visitor_permissions=([^;]*)/);
              if (match && match[1]) {
                const decoded = decodeURIComponent(match[1]);
                const perms = JSON.parse(decoded);
                // Backward compatibility: map old permission names to new ones if needed
                const mappedPerms: string[] = Array.isArray(perms) ? perms.map((p: string) => {
                  if (p === 'corp' || p === 'audit') return 'finance_insurance';
                  if (p === 'possibility') return 'creation_lab';
                  if (p === 'music') return 'sound';
                  return p;
                }) : [];

                const isNovelOnly = mappedPerms.includes('creation_lab_novel') &&
                  !mappedPerms.includes('vc') &&
                  !mappedPerms.includes('career') &&
                  !mappedPerms.includes('finance_insurance') &&
                  !mappedPerms.includes('sound') &&
                  !mappedPerms.includes('communication');

                if (isNovelOnly) {
                  router.replace('/museum/creation_lab');
                  return;
                }

                setAllowedPermissions(mappedPerms);
              } else {
                router.replace('/');
                return;
              }
            }
          } catch {
            router.replace('/');
            return;
          } finally {
            setCheckedAuth(true);
          }
        }
      })
      .catch(() => {
        router.replace('/');
      });

    return () => clearTimeout(timer);
  }, [router]);

  if (!checkedAuth || allowedPermissions === null) {
    return null; // Don't render anything while verifying passcode auth
  }

  const visibleExhibits = ALL_EXHIBIT_KEYS
    .map((key) => EXHIBITS[key])
    .filter((exhibit): exhibit is ExhibitConfig => exhibit !== undefined && allowedPermissions.includes(exhibit.id));

  const isRestrictedAccess = visibleExhibits.length === 0;

  const scrollToGalleries = () => {
    const el = document.getElementById('galleries-section');
    if (el) {
      const headerOffset = 65;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth'
      });
    }
  };

  return (
    <>
      <div style={{ width: '100%' }}>
        
        {/* 第一頁：個人簡介與空間說明 (動態視埠 100dvh, 無頂部重複扣除) */}
        <section style={{ 
          minHeight: 'calc(100dvh - 65px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem 1.2rem 3rem',
          boxSizing: 'border-box',
          position: 'relative'
        }}>
          <header className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
            
            <div style={{
              width: 'clamp(130px, 32vw, 190px)',
              height: 'clamp(130px, 32vw, 190px)',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              border: '2px solid rgba(255,255,255,0.25)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
              letterSpacing: '2px',
              boxShadow: '0 0 40px rgba(0,0,0,0.6)',
              overflow: 'hidden',
              position: 'relative',
              flexShrink: 0
            }}>
              {visitorAvatarUrl ? (
                <img
                  src={visitorAvatarUrl}
                  alt="Maxupport Curator Avatar"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <span style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '2px', fontSize: '0.75rem' }}>MAXUPPORT</span>
              )}
            </div>

            <div style={{ 
              width: '40px', 
              height: '2px', 
              background: '#fff', 
              marginBottom: '1rem' 
            }} />
            <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', letterSpacing: '6px', color: '#fff', marginBottom: '0.3rem', textTransform: 'uppercase', fontFamily: 'var(--font-noto-serif)', textAlign: 'center' }}>
              Exhibition Hall
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '1.2rem' }}>
              Private Collection
            </p>

            <div style={{ 
              textAlign: 'center',
              padding: '1.2rem 1.6rem',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '4px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <h2 style={{ fontSize: 'clamp(1.15rem, 3.5vw, 1.35rem)', color: '#fff', marginBottom: '0.6rem', fontFamily: 'var(--font-noto-serif)' }}>歡迎來到 Max 的專屬策展空間</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)', lineHeight: 1.7, letterSpacing: '1px', fontFamily: 'var(--font-noto-sans)' }}>
                這裡記錄了 Max 超過 14 年的跨界職涯軌跡，從新創 / 風險投資、職涯履歷、商業議題分析、聲音探索、創作 Lab 到人生擺渡，每個展區都代表著對不同領域的熱情與實踐。
              </p>

              {/* 返回通行碼選擇頁面提示 */}
              <div style={{ 
                marginTop: '1.2rem', 
                padding: '0.65rem 1.1rem', 
                background: 'rgba(56, 189, 248, 0.08)', 
                border: '1px solid rgba(56, 189, 248, 0.25)', 
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.55rem',
                color: '#7dd3fc',
                fontSize: '0.83rem',
                letterSpacing: '0.5px'
              }}>
                <Compass size={15} style={{ flexShrink: 0 }} />
                <span>💡 <strong>觀展提醒</strong>：點擊頁面左上角「<strong>MAX&apos;S PRIVATE MUSEUM</strong>」可隨時返回【通行碼選擇頁面】切換參觀身份。</span>
              </div>
            </div>

            {/* 往下轉動 / 點擊滾動瀏覽展區提示按鈕 */}
            <div 
              onClick={scrollToGalleries}
              style={{ 
                marginTop: '1.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                color: 'rgba(255, 255, 255, 0.75)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '0.6rem 1.4rem',
                borderRadius: '30px',
                backdropFilter: 'blur(10px)',
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.45)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.transform = 'translateY(2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ fontSize: '0.82rem', letterSpacing: '1.8px', fontFamily: 'var(--font-noto-sans)', fontWeight: 500 }}>
                向下滾動繼續瀏覽主題展區
              </span>
              <ChevronDown size={16} style={{ opacity: 0.8 }} />
            </div>
          </header>
        </section>

        {/* 第二頁：6 大展區卡片清單 */}
        <section 
          id="galleries-section"
          style={{ 
            minHeight: 'calc(100dvh - 65px)', 
            padding: '3.5rem 1.5rem 6rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ maxWidth: '1400px', width: '100%' }}>
            
            {isRestrictedAccess ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', background: 'rgba(20,20,20,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                <Lock size={40} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
                <h3 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '0.8rem', fontFamily: 'var(--font-noto-serif)' }}>
                  您目前的通行密碼未開放任何展區
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem' }}>
                  請使用策展人為您提供的專屬通行密碼重新解鎖展區。
                </p>
                <Link href="/" className="museum-btn">
                  返回輸入密碼
                </Link>
              </div>
            ) : (
              <div>
                <div style={{ 
                  fontSize: 'clamp(0.72rem, 2vw, 0.8rem)', 
                  letterSpacing: '4px', 
                  color: 'var(--text-secondary)', 
                  marginBottom: '2rem', 
                  textTransform: 'uppercase', 
                  borderBottom: '1px solid rgba(255,255,255,0.1)', 
                  paddingBottom: '0.8rem',
                  paddingRight: 'clamp(80px, 20vw, 130px)',
                }}>
                  6 Exhibition Galleries
                </div>

                <div className="gallery-grid">
                  {visibleExhibits.map((exhibit, index) => (
                    <Link href={`/museum/${exhibit.id}`} key={exhibit.id} style={{ textDecoration: 'none' }}>
                      <div 
                        className="glass-panel exhibit-card" 
                        style={{ 
                          minHeight: '230px',
                          padding: '1.8rem 2rem', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          justifyContent: 'space-between',
                          color: exhibit.color,
                          transition: 'all 0.4s ease'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.75rem', letterSpacing: '2px', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', fontFamily: 'var(--font-noto-sans)' }}>
                            Gallery 0{index + 1}
                          </div>
                          <h2 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '0.2rem', fontFamily: 'var(--font-noto-serif)' }}>
                            {exhibit.title}
                          </h2>
                          <h3 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', letterSpacing: '1px', fontWeight: 300 }}>
                            {exhibit.subtitle}
                          </h3>
                        </div>
                        
                        <div style={{ marginTop: 'auto' }}>
                          <p style={{
                            color: 'rgba(255,255,255,0.65)',
                            fontSize: '0.82rem',
                            lineHeight: 1.5,
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            paddingTop: '1rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {exhibit.desc}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          </div>
        </section>
      </div>

      <div className={`door-container ${isOpening ? 'door-close' : ''}`}>
        <div className="door-left" />
        <div className="door-right" />
      </div>
    </>
  );
}
