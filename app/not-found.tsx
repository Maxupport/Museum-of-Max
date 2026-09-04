'use client';

import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          maxWidth: '560px',
          width: '100%',
          padding: '4rem 3rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            marginBottom: '2rem',
            boxShadow: '0 0 25px rgba(0,0,0,0.5)',
          }}
        >
          <Lock size={30} />
        </div>

        <div style={{ fontSize: '0.8rem', letterSpacing: '4px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.8rem' }}>
          404 • GALLERY NOT FOUND
        </div>

        <h1
          style={{
            fontSize: '2.4rem',
            fontWeight: 300,
            color: '#fff',
            fontFamily: 'var(--font-noto-serif)',
            letterSpacing: '2px',
            lineHeight: 1.3,
            marginBottom: '1.2rem',
          }}
        >
          展廳暫未開放
        </h1>

        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.95rem',
            lineHeight: 1.8,
            marginBottom: '3rem',
            fontFamily: 'var(--font-noto-sans)',
          }}
        >
          您所探尋的展頁暫未開放，或已移至私人典藏特展區。
          <br />
          請點擊下方按鈕返回博物館大廳。
        </p>

        <Link href="/museum" className="museum-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
          <ArrowLeft size={16} />
          返回展覽大廳
        </Link>
      </div>
    </div>
  );
}
