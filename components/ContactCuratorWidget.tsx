'use client';

import { usePathname } from 'next/navigation';
import { Mail } from 'lucide-react';
import { useEffect, useState } from 'react';

// Map pathnames to Chinese exhibit names for email subject lines
const EXHIBIT_NAME_MAP: Record<string, string> = {
  '/museum/venture_capital': '新創 / 風險投資',
  '/museum/career_experience': '職涯履歷 Max’s Career',
  '/museum/finance_insurance': '商業議題分析',
  '/museum/sound': '聲音探索',
  '/museum/creation_lab': '創作 Lab',
  '/museum/communication': '人生擺渡',
  '/museum': '展覽大廳 (Museum Overview)',
  '/projects': '過往專案與案例',
};

export function ContactCuratorWidget() {
  const pathname = usePathname();
  const [pageTitle, setPageTitle] = useState('Museum of Max');
  const [mailtoUrl, setMailtoUrl] = useState('mailto:maxupport@gmail.com');

  useEffect(() => {
    let name = EXHIBIT_NAME_MAP[pathname] || '';

    if (!name) {
      if (pathname.startsWith('/museum/creation_lab/novel/')) {
        name = '創作 Lab - 小說連載';
      } else if (pathname.includes('/museum/')) {
        name = typeof document !== 'undefined' && document.title
          ? document.title.replace(' | Maxupport', '').replace('Maxupport | ', '')
          : '展品詳細頁面';
      } else if (pathname === '/') {
        name = '首頁入口';
      } else {
        name = typeof document !== 'undefined' && document.title
          ? document.title
          : 'Museum of Max';
      }
    }

    setPageTitle(name);

    const subject = `【諮詢策展人】來自「${name}」頁面`;
    const pageUrl = typeof window !== 'undefined' ? window.location.href : 'https://maxupport.com';
    const body = `你好 Max，\n\n我在瀏覽「${name}」頁面 (${pageUrl}) 時，有興趣瞭解 / 諮詢以下內容：\n\n`;

    setMailtoUrl(`mailto:maxupport@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  }, [pathname]);

  // Hide widget on entrance page or admin pages
  if (pathname === '/' || pathname === '/admin' || pathname === '/admin/login') {
    return null;
  }

  return (
    <a
      href={mailtoUrl}
      title={`寄信聯絡策展人 (主題：【諮詢策展人】來自「${pageTitle}」頁面)`}
      style={{
        position: 'fixed',
        right: 0,
        bottom: '2.5rem',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.55rem',
        padding: '0.6rem 1rem 0.6rem 0.85rem',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRight: 'none',
        borderRadius: '24px 0 0 24px',
        color: '#ffffff',
        textDecoration: 'none',
        fontSize: '0.85rem',
        fontWeight: 500,
        letterSpacing: '1px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4), 0 0 15px rgba(56, 189, 248, 0.15)',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
      }}
      className="curator-contact-widget"
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: 'rgba(56, 189, 248, 0.15)',
          color: '#38bdf8',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          flexShrink: 0,
        }}
      >
        <Mail size={13} />
      </span>
      <span style={{ whiteSpace: 'nowrap' }}>聯絡策展人</span>
    </a>
  );
}
