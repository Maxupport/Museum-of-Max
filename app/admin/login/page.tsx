'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, User, ArrowLeft } from 'lucide-react';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        window.location.href = '/museum';
      } else {
        setError(data.error || '登入失敗，請確認帳號密碼');
      }
    } catch {
      setError('連線失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      position: 'relative'
    }}>
      <button 
        onClick={() => router.push('/')}
        style={{ 
          position: 'absolute',
          top: '2rem',
          left: '2rem',
          background: 'none', 
          border: 'none', 
          color: 'var(--text-secondary)', 
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.85rem',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          transition: 'color 0.3s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        <ArrowLeft size={16} />
        Back to Entrance
      </button>

      <div className="glass-panel animate-fade-in" style={{
        maxWidth: '440px',
        width: '100%',
        padding: '3.5rem 2.5rem',
        textAlign: 'center'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          margin: '0 auto 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff'
        }}>
          <ShieldCheck size={28} />
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
          Museum Administrator Portal
        </p>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '0.75rem 1rem',
            borderRadius: '4px',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{
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
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="CURATOR USERNAME"
              className="museum-input"
              style={{ paddingLeft: '3rem', maxWidth: '100%' }}
              required
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="PASSWORD"
              className="museum-input"
              style={{ paddingLeft: '3rem', maxWidth: '100%' }}
              required
            />
          </div>

          <button 
            type="submit" 
            className="museum-btn" 
            disabled={loading}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            {loading ? 'AUTHENTICATING...' : 'LOGIN TO DASHBOARD'}
          </button>
        </form>
      </div>
    </div>
  );
}
