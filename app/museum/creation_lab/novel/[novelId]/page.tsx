'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, List, Calendar, User, Sparkles, Mail } from 'lucide-react';
import { MOCK_NOVELS } from '@/utils/notionNovels';

export default function NovelReaderPage({
  params
}: {
  params: Promise<{ novelId: string }>;
}) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const { novelId } = unwrappedParams;

  const novel = MOCK_NOVELS[novelId] || MOCK_NOVELS['ai-novel'];

  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [subEmail, setSubEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subMessage, setSubMessage] = useState('');

  useEffect(() => {
    if (novelId) {
      fetch('/api/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exhibitId: 'creation_lab_novel', notionId: `${novelId}_ch${currentChapterIdx + 1}` }),
      }).catch(() => {});
    }
  }, [novelId, currentChapterIdx]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEmail || !subEmail.includes('@')) return;

    setSubscribing(true);
    setSubMessage('');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subEmail, novelId }),
      });
      const data = await res.json();

      // 若有配置 Google Apps Script 網址，同步寫入 Google 試算表
      const googleScriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
      if (googleScriptUrl) {
        fetch(googleScriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: subEmail, novelTitle: novel.title }),
        }).catch((err) => console.error('Google Apps Script post error:', err));
      }

      if (data.ok) {
        setSubMessage('🎉 ' + data.message + ' (已同步至 Google 試算表)');
        setSubEmail('');
      } else {
        setSubMessage(data.error || '訂閱失敗');
      }
    } catch {
      setSubMessage('連線錯誤，請稍後再試');
    } finally {
      setSubscribing(false);
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const isCuratorCookie = document.cookie.includes('is_curator=true');
      if (!isCuratorCookie) {
        const match = document.cookie.match(/(?:^|; )visitor_permissions=([^;]*)/);
        if (match && match[1]) {
          try {
            const perms = JSON.parse(decodeURIComponent(match[1]));
            const hasAccess = Array.isArray(perms) && (perms.includes('creation_lab') || perms.includes('creation_lab_novel'));
            if (!hasAccess) {
              router.replace('/');
            }
          } catch {
            router.replace('/');
          }
        } else {
          router.replace('/');
        }
      }
    }
  }, [router]);

  const currentChapter = novel.chapters[currentChapterIdx] || novel.chapters[0];

  const handlePrevChapter = () => {
    if (currentChapterIdx > 0) {
      setCurrentChapterIdx(currentChapterIdx - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextChapter = () => {
    if (currentChapterIdx < novel.chapters.length - 1) {
      setCurrentChapterIdx(currentChapterIdx + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div style={{ padding: '3rem 2rem 6rem', maxWidth: '900px', margin: '0 auto', minHeight: '100vh' }}>
      {/* 頂部導覽按鈕 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <button
          onClick={() => router.push('/museum/creation_lab')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
            fontSize: '0.9rem',
            letterSpacing: '1px',
            transition: 'color 0.3s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <ArrowLeft size={16} />
          返回創作 Lab 展區
        </button>

        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          style={{
            background: drawerOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            padding: '0.5rem 1.2rem',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.85rem',
            letterSpacing: '1px',
            transition: 'all 0.3s ease',
          }}
        >
          <List size={16} />
          {drawerOpen ? '關閉章節目錄' : `章節目錄 (${currentChapterIdx + 1}/${novel.chapters.length})`}
        </button>
      </div>

      {/* 章節目錄抽屜 (Collapsible Chapter Index Drawer) */}
      {drawerOpen && (
        <div
          className="animate-fade-in glass-panel"
          style={{
            padding: '1.8rem',
            marginBottom: '3rem',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(15, 15, 15, 0.95)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.8rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
              {novel.title} — 章節目錄
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              連載中（共 {novel.chapters.length} 章）
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {novel.chapters.map((ch, idx) => {
              const isActive = idx === currentChapterIdx;
              return (
                <div
                  key={ch.id}
                  onClick={() => {
                    setCurrentChapterIdx(idx);
                    setDrawerOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{
                    padding: '0.8rem 1.2rem',
                    borderRadius: '4px',
                    background: isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)',
                    border: isActive ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.04)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    {isActive ? <Sparkles size={16} color="var(--theme-possibility)" /> : <BookOpen size={16} style={{ opacity: 0.5 }} />}
                    <span style={{ fontSize: '0.95rem', fontWeight: isActive ? 500 : 400, fontFamily: 'var(--font-noto-serif)' }}>
                      {ch.title}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{ch.publishedDate}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 小說封面資訊頁標 */}
      <header className="animate-fade-in" style={{ marginBottom: '3rem', position: 'relative' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.08)', color: 'var(--theme-possibility)', padding: '0.2rem 0.6rem', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
            小說連載專區
          </span>
          <span style={{ fontSize: '0.75rem', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', padding: '0.2rem 0.6rem', borderRadius: '2px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
            {novel.status}
          </span>
        </div>

        <h1
          style={{
            fontSize: '2.4rem',
            fontWeight: 300,
            color: '#fff',
            fontFamily: 'var(--font-noto-serif)',
            lineHeight: 1.3,
            marginBottom: '0.8rem',
          }}
        >
          {novel.title}
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6, marginBottom: '1.5rem', fontFamily: 'var(--font-noto-sans)' }}>
          {novel.subtitle}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '1.5rem',
            alignItems: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <User size={14} />
            作者：{novel.author}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={14} />
            更新日期：{currentChapter.publishedDate}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BookOpen size={14} />
            {currentChapter.readTime}
          </span>
        </div>
      </header>

      {/* 小說章節內文區域 (沉浸式小說閱讀器) */}
      <main
        className="animate-fade-in glass-panel"
        style={{
          padding: '3rem 2.5rem',
          color: 'rgba(255,255,255,0.9)',
          background: 'rgba(10, 10, 10, 0.85)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          borderRadius: '4px',
          marginBottom: '4rem',
        }}
      >
        {/* 章節標題 */}
        <h2
          style={{
            fontSize: '1.8rem',
            color: '#fff',
            fontFamily: 'var(--font-noto-serif)',
            marginBottom: '2.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '1rem',
            letterSpacing: '1px',
          }}
        >
          {currentChapter.title}
        </h2>

        {/* 文章段落 */}
        <article
          style={{
            fontFamily: 'var(--font-noto-serif)',
            fontSize: '1.15rem',
            lineHeight: 2.2,
            letterSpacing: '0.6px',
          }}
        >
          {currentChapter.content.map((paragraph, index) => (
            <p key={index} style={{ marginBottom: '2rem', textIndent: '2em' }}>
              {paragraph}
            </p>
          ))}
        </article>
      </main>

      {/* 底部翻頁導覽列 (Seamless Chapter Navigation Bar) */}
      <footer
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          paddingTop: '2rem',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={handlePrevChapter}
          disabled={currentChapterIdx === 0}
          style={{
            background: currentChapterIdx === 0 ? 'transparent' : 'rgba(255,255,255,0.05)',
            border: '1px solid',
            borderColor: currentChapterIdx === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
            color: currentChapterIdx === 0 ? 'rgba(255,255,255,0.2)' : '#fff',
            padding: '0.8rem 1.5rem',
            borderRadius: '4px',
            cursor: currentChapterIdx === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            transition: 'all 0.3s ease',
          }}
        >
          <ChevronLeft size={18} />
          上一章
        </button>

        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            letterSpacing: '1px',
          }}
        >
          ≡ 章節目錄 ({currentChapterIdx + 1} / {novel.chapters.length})
        </button>

        <button
          onClick={handleNextChapter}
          disabled={currentChapterIdx === novel.chapters.length - 1}
          style={{
            background: currentChapterIdx === novel.chapters.length - 1 ? 'transparent' : 'rgba(255,255,255,0.05)',
            border: '1px solid',
            borderColor: currentChapterIdx === novel.chapters.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
            color: currentChapterIdx === novel.chapters.length - 1 ? 'rgba(255,255,255,0.2)' : '#fff',
            padding: '0.8rem 1.5rem',
            borderRadius: '4px',
            cursor: currentChapterIdx === novel.chapters.length - 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            transition: 'all 0.3s ease',
          }}
        >
          下一章
          <ChevronRight size={18} />
        </button>
      </footer>

      {/* 小說連載訂閱電子報 (Email Subscription Box) */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '2.5rem 2rem', 
          marginTop: '3.5rem', 
          background: 'rgba(15, 18, 25, 0.85)', 
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '4px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#fff', marginBottom: '0.6rem' }}>
          <Mail size={22} style={{ color: '#60a5fa' }} />
          <h3 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-noto-serif)', letterSpacing: '1px' }}>
            訂閱《{novel.title}》連載更新
          </h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          留下您的 Email，當作者更新最新章節時，將於隔日固定時間為您寄送專屬連載更新通知信件。
        </p>
        <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="請輸入您的 Email 電子郵件地址..."
            value={subEmail}
            onChange={(e) => setSubEmail(e.target.value)}
            className="museum-input"
            style={{ flex: 1, minWidth: '260px' }}
            required
          />
          <button type="submit" className="museum-btn" disabled={subscribing} style={{ background: 'rgba(96, 165, 250, 0.15)', borderColor: 'rgba(96, 165, 250, 0.3)' }}>
            {subscribing ? '訂閱處理中...' : '免費訂閱連載更新'}
          </button>
        </form>
        {subMessage && (
          <div style={{ color: '#4ade80', fontSize: '0.85rem', marginTop: '1rem', background: 'rgba(74, 222, 128, 0.1)', padding: '0.6rem 1rem', borderRadius: '4px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
            {subMessage}
          </div>
        )}
      </div>

      {/* Google 表單與讀者回饋預留區 (Google Form Placeholder Box) */}
      <div
        className="glass-panel"
        style={{
          padding: '2.5rem 2rem',
          marginTop: '2.5rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '4px',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', marginBottom: '1rem', color: '#fff' }}>
          <Sparkles size={24} style={{ color: 'var(--theme-possibility)' }} />
        </div>
        <h3 style={{ fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-noto-serif)', marginBottom: '0.6rem', letterSpacing: '1px' }}>
          讀者心得與意見回饋 (Google 表單預留區)
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '560px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
          策展人後續將在此嵌入 Google 表單連結與讀後感問卷。歡迎隨時為作者留下寶貴的閱讀建議與創作回饋。
        </p>
        <div style={{ display: 'inline-block', padding: '0.6rem 1.4rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.3)', letterSpacing: '1px' }}>
          📋 FORM PLACEHOLDER • 等候策展人後續設定嵌入
        </div>
      </div>

      {/* Notion 電腦版連載寫作說明提示卡 */}
      <div
        className="glass-panel"
        style={{
          marginTop: '4rem',
          padding: '1.5rem 2rem',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '4px',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', marginBottom: '0.5rem', fontWeight: 500 }}>
          <Sparkles size={16} color="var(--theme-possibility)" />
          <span>Notion 小說連載策展說明</span>
        </div>
        <p>
          本頁面支援 Notion API 即時連載同步。在您的 Notion 資料庫中設定屬性 `NovelTitle` (小說名稱) 與 `ChapterNum` (章節號)，於 Notion 撰寫的內文段落將自動渲染為此處的沉浸式小說閱讀格式。
        </p>
      </div>
    </div>
  );
}
