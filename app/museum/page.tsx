'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Lock } from 'lucide-react';
import { EXHIBITS, ALL_EXHIBIT_KEYS, ExhibitConfig } from '@/lib/constants';

export default function MuseumHall() {
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(true);
  const [allowedPermissions, setAllowedPermissions] = useState<string[] | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOpening(false);
    }, 100);

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

                if (mappedPerms.includes('creation_lab_novel') && !mappedPerms.includes('vc')) {
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

  return (
    <>
      <div style={{ 
        height: '100vh', 
        overflowY: 'auto', 
        scrollSnapType: 'y mandatory',
        scrollBehavior: 'smooth'
      }}>
        
        {/* 第一頁：個人簡介與空間說明 (100vh 且 Snap) */}
        <section style={{ 
          height: '100vh', 
          scrollSnapAlign: 'start',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem',
          position: 'relative'
        }}>
          <header className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '800px', width: '100%' }}>
            
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              letterSpacing: '2px',
              boxShadow: '0 0 30px rgba(0,0,0,0.5)'
            }}>
              PHOTO
            </div>

            <div style={{ 
              width: '40px', 
              height: '2px', 
              background: '#fff', 
              marginBottom: '2rem' 
            }} />
            <h1 style={{ fontSize: '3rem', letterSpacing: '8px', color: '#fff', marginBottom: '1rem', textTransform: 'uppercase', fontFamily: 'var(--font-noto-serif)', textAlign: 'center' }}>
              Exhibition Hall
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '3rem' }}>
              Private Collection
            </p>

            <div style={{ 
              textAlign: 'center',
              padding: '2rem',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <h2 style={{ fontSize: '1.5rem', color: '#fff', marginBottom: '1rem', fontFamily: 'var(--font-noto-serif)' }}>歡迎來到 Maxupport 的專屬策展空間</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.8, letterSpacing: '1px', fontFamily: 'var(--font-noto-sans)' }}>
                這裡記錄了 Max 超過 14 年的跨界職涯軌跡，從風險投資、職涯經歷、金融保險議題分析、聲音探索、創作 Lab 到跨世代溝通，每個展區都代表著對不同領域的熱情與實踐。
              </p>
            </div>
          </header>

          <div className="animate-fade-in" style={{ 
            position: 'absolute', 
            bottom: '2rem',
            animationDelay: '1s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: 'var(--text-secondary)',
            opacity: 0.5
          }}>
            <span style={{ fontSize: '0.7rem', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Scroll to Explore</span>
            <ChevronDown size={20} />
          </div>
        </section>

        {/* 第二頁：6 大展區卡片清單 (100vh 且置中) */}
        <section style={{ 
          minHeight: '100vh', 
          scrollSnapAlign: 'start',
          padding: '4rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto'
        }}>
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
                  fontSize: '0.8rem', 
                  letterSpacing: '4px', 
                  color: 'var(--text-secondary)', 
                  marginBottom: '2rem', 
                  textTransform: 'uppercase', 
                  borderBottom: '1px solid rgba(255,255,255,0.1)', 
                  paddingBottom: '0.8rem' 
                }}>
                  6 Exhibition Galleries
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', 
                  gap: '1.8rem' 
                }}>
                  {visibleExhibits.map((exhibit, index) => (
                    <Link href={`/museum/${exhibit.id}`} key={exhibit.id} style={{ textDecoration: 'none' }}>
                      <div 
                        className="glass-panel exhibit-card" 
                        style={{ 
                          height: '240px',
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
                          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
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
