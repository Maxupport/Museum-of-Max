'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Header() {
  const pathname = usePathname();
  const [isCurator, setIsCurator] = useState(false);
  const [isNovelDirect, setIsNovelDirect] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|; )visitor_permissions=([^;]*)/);
      if (match && match[1]) {
        try {
          const perms = JSON.parse(decodeURIComponent(match[1]));
          if (Array.isArray(perms)) {
            const hasNovelDirect = perms.includes('creation_lab_novel');
            const hasFullExhibits = perms.includes('vc') && perms.includes('career') && perms.includes('finance_insurance');
            if (hasNovelDirect && !hasFullExhibits) {
              setIsNovelDirect(true);
            } else {
              setIsNovelDirect(false);
            }
          }
        } catch {}
      }
    }

    fetch('/api/auth/admin')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data && data.authenticated) {
            setIsCurator(true);
            setIsNovelDirect(false);
          } else {
            setIsCurator(false);
          }
        }
      })
      .catch(() => {
        if (isMounted) setIsCurator(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  // Hide header completely on home passcode entrance page and admin pages
  if (pathname === '/' || pathname === '/admin/login' || pathname === '/admin') {
    return null;
  }

  // Brand title links back to '/' (Passcode entrance / Role switching)
  const logoHref = '/';

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '65px',
      zIndex: 1000,
      background: 'rgba(5, 5, 5, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 clamp(0.8rem, 3vw, 2rem)',
    }}>
      <nav style={{
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Brand Title (Navigates to / for passcode entry & role switching) */}
        <Link 
          href={logoHref} 
          title="輸入通行密碼 / 切換角色"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}
        >
          <Compass size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <span style={{
            fontSize: 'clamp(0.62rem, 2.2vw, 0.9rem)',
            letterSpacing: 'clamp(1px, 0.5vw, 2.5px)',
            color: '#fff',
            fontFamily: 'var(--font-noto-serif)',
            fontWeight: 400,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>
            MAX&apos;S PRIVATE MUSEUM
          </span>
        </Link>

        {/* Navigation Links (Removed unused 'Projects' link) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.6rem, 2vw, 1.5rem)', flexShrink: 0 }}>
          {!isNovelDirect && (
            <Link 
              href="/museum" 
              onClick={() => {
                if (typeof window !== 'undefined' && window.location.pathname === '/museum') {
                  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                }
              }}
              style={{
                textDecoration: 'none',
                color: pathname === '/museum' ? '#fff' : 'var(--text-secondary)',
                fontSize: 'clamp(0.72rem, 2vw, 0.85rem)',
                letterSpacing: 'clamp(0.5px, 0.3vw, 1px)',
                transition: 'color 0.3s ease',
                whiteSpace: 'nowrap',
              }}
            >
              展覽大廳
            </Link>
          )}

          {isCurator && (
            <Link 
              href="/admin" 
              style={{
                textDecoration: 'none',
                color: '#4ade80',
                fontSize: 'clamp(0.72rem, 2vw, 0.85rem)',
                letterSpacing: 'clamp(0.5px, 0.3vw, 1px)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(74, 222, 128, 0.1)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                padding: 'clamp(0.25rem, 0.8vw, 0.35rem) clamp(0.5rem, 1.5vw, 0.9rem)',
                borderRadius: '4px',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Shield size={14} />
              策展人後台
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
