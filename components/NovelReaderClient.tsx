'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, List, Calendar, User, Sparkles, Mail, X, AlignLeft } from 'lucide-react';

export interface ChapterItem {
  id: string;
  title: string;
  content: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  fbDate?: string | null;
  excerpt?: string | null;
}

export interface NovelWithChapters {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  description: string | null;
  status: string;
  totalChapters: number;
  chapters: ChapterItem[];
}

interface NovelReaderClientProps {
  initialNovel: NovelWithChapters | null;
  novelId: string;
}

export default function NovelReaderClient({
  initialNovel,
  novelId,
}: NovelReaderClientProps) {
  const router = useRouter();

  const [novel, setNovel] = useState<NovelWithChapters | null>(initialNovel);
  const [loading, setLoading] = useState(!initialNovel);
  const [notFound, setNotFound] = useState(false);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [indentMode, setIndentMode] = useState<'flush' | 'indent'>('flush');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('novel_reader_indent_mode');
      if (saved === 'indent' || saved === 'flush') {
        setIndentMode(saved as 'flush' | 'indent');
      }
    } catch {}
  }, []);

  const toggleIndentMode = () => {
    const next = indentMode === 'flush' ? 'indent' : 'flush';
    setIndentMode(next);
    try {
      localStorage.setItem('novel_reader_indent_mode', next);
    } catch {}
  };

  const [subEmail, setSubEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subMessage, setSubMessage] = useState('');

  // 權限驗證
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

  // 客戶端備用載入 (若 SSR 未獲取到)
  useEffect(() => {
    if (!novel && novelId) {
      setLoading(true);
      fetch(`/api/novels/${encodeURIComponent(novelId)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.data) {
            setNovel(data.data);
            setNotFound(false);
          } else {
            setNotFound(true);
          }
        })
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false));
    }
  }, [novelId, novel]);

  // 頁面瀏覽紀錄
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

      const googleScriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
      if (googleScriptUrl && novel) {
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '10rem 2rem', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <BookOpen size={40} style={{ marginBottom: '1.5rem', opacity: 0.6 }} />
        <p style={{ color: 'var(--text-secondary)', letterSpacing: '2px' }}>載入小說中...</p>
      </div>
    );
  }

  if (notFound || !novel) {
    return (
      <div style={{ textAlign: 'center', padding: '10rem 2rem', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-noto-serif)', fontSize: '2rem', marginBottom: '1rem' }}>查無此小說作品</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>此小說作品目前尚無章節或已被移除。</p>
        <button className="museum-btn" onClick={() => router.push('/museum/creation_lab')}>
          返回創作 LAB
        </button>
      </div>
    );
  }

  const chapters = novel.chapters || [];

  if (chapters.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '10rem 2rem', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-noto-serif)', fontSize: '2rem', marginBottom: '1rem' }}>《{novel.title}》</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>此小說目前尚無章節內容，請期待作者更新。</p>
        <button className="museum-btn" onClick={() => router.push('/museum/creation_lab')}>
          返回創作 LAB
        </button>
      </div>
    );
  }

  const currentChapter = chapters[currentChapterIdx] || chapters[0];

  const parseChapterContent = (content: string): string[] => {
    if (!content) return [];
    let lines: string[] = [];
    if (content.trim().startsWith('{')) {
      try {
        const p = JSON.parse(content);
        if (p.textContent) {
          lines = p.textContent.split('\n');
        } else if (p.overview) {
          lines = p.overview.split('\n');
        }
      } catch {}
    }
    if (lines.length === 0) {
      lines = content.split('\n');
    }
    return lines
      .map((line) => line.replace(/^[\s\u3000\u00A0\u2000-\u200B\uFEFF]+/, '').trimEnd())
      .filter((line) => line.length > 0);
  };

  const contentParagraphs = parseChapterContent(currentChapter.content);

  const handlePrevChapter = () => {
    if (currentChapterIdx > 0) {
      setCurrentChapterIdx(currentChapterIdx - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextChapter = () => {
    if (currentChapterIdx < chapters.length - 1) {
      setCurrentChapterIdx(currentChapterIdx + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderOutlineContent = (isMobile = false) => (
    <div
      className="glass-panel"
      style={{
        padding: '1.25rem',
        background: 'rgba(13, 16, 23, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: isMobile ? '100%' : 'calc(100vh - 110px)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div style={{ paddingBottom: '0.9rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#fff', fontSize: '0.92rem', fontWeight: 600, letterSpacing: '0.5px' }}>
            <List size={16} style={{ color: 'var(--theme-possibility, #a855f7)' }} />
            <span>文件大綱 · 章節目錄</span>
          </div>
          {isMobile ? (
            <button
              onClick={() => setMobileDrawerOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }}
            >
              <X size={18} />
            </button>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
              共 {chapters.length} 章
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(192, 132, 252, 0.85)', marginTop: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          《{novel.title}》
        </div>
      </div>

      <div
        className="outline-scrollbar"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          overflowY: 'auto',
          flex: 1,
          paddingRight: '0.2rem',
        }}
      >
        {chapters.map((ch, idx) => {
          const isActive = idx === currentChapterIdx;
          return (
            <button
              key={ch.id}
              onClick={() => {
                setCurrentChapterIdx(idx);
                if (isMobile) setMobileDrawerOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              title={ch.title}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                background: isActive ? 'rgba(168, 85, 247, 0.14)' : 'transparent',
                border: isActive ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid transparent',
                color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.65)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                }
              }}
            >
              <div
                style={{
                  width: '3px',
                  height: '18px',
                  borderRadius: '2px',
                  background: isActive ? '#c084fc' : 'transparent',
                  boxShadow: isActive ? '0 0 8px rgba(192, 132, 252, 0.8)' : 'none',
                  flexShrink: 0,
                  transition: 'background 0.2s ease',
                }}
              />

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: 'var(--font-noto-serif)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: isActive ? '#fff' : 'inherit',
                  }}
                >
                  {ch.title}
                </span>
                {ch.fbDate && (
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.35)', marginTop: '0.1rem' }}>
                    {ch.fbDate}
                  </span>
                )}
              </div>

              {isActive && (
                <Sparkles size={13} style={{ color: '#c084fc', flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>

      <div style={{ paddingTop: '0.8rem', marginTop: '0.8rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
          <span>閱讀進度</span>
          <span>第 {currentChapterIdx + 1} / {chapters.length} 章 ({Math.round(((currentChapterIdx + 1) / chapters.length) * 100)}%)</span>
        </div>
        <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${((currentChapterIdx + 1) / chapters.length) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #a855f7, #c084fc)',
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="novel-reader-wrapper">
      <div className="novel-reader-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
        <button
          onClick={() => router.push('/museum/creation_lab')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.88rem',
            letterSpacing: '1px',
            transition: 'color 0.3s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <ArrowLeft size={16} />
          返回創作 Lab 展區
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          <button
            onClick={toggleIndentMode}
            style={{
              background: indentMode === 'flush' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(168, 85, 247, 0.12)',
              border: '1px solid',
              borderColor: indentMode === 'flush' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(168, 85, 247, 0.35)',
              color: '#fff',
              padding: '0.45rem 0.9rem',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              letterSpacing: '0.5px',
              transition: 'all 0.25s ease',
            }}
            title="點擊調整文字排版機制：統一靠左（無空格）或首行縮排 2 格"
          >
            <AlignLeft size={15} style={{ color: indentMode === 'flush' ? '#38bdf8' : '#c084fc' }} />
            <span>{indentMode === 'flush' ? '排版：統一靠左' : '排版：首行縮排'}</span>
          </button>

          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setMobileDrawerOpen(true);
              } else {
                setSidebarOpen(!sidebarOpen);
              }
            }}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              padding: '0.45rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              fontSize: '0.85rem',
              letterSpacing: '0.5px',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)')}
          >
            <List size={15} style={{ color: 'var(--theme-possibility, #a855f7)' }} />
            <span>
              {sidebarOpen ? '收合章節目錄' : '展開章節目錄'} ({currentChapterIdx + 1}/{chapters.length})
            </span>
          </button>
        </div>
      </div>

      <div className="novel-reader-layout">
        {sidebarOpen && (
          <aside className="novel-reader-sidebar-desktop animate-fade-in">
            {renderOutlineContent(false)}
          </aside>
        )}

        {mobileDrawerOpen && (
          <>
            <div
              onClick={() => setMobileDrawerOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(8px)',
                zIndex: 10001,
              }}
            />
            <div
              className="animate-fade-in"
              style={{
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: 0,
                width: '320px',
                maxWidth: '85vw',
                zIndex: 10002,
                padding: '1.2rem',
                background: 'rgba(10, 12, 18, 0.98)',
                boxShadow: '4px 0 24px rgba(0, 0, 0, 0.6)',
              }}
            >
              {renderOutlineContent(true)}
            </div>
          </>
        )}

        <div
          className="novel-reader-main-content"
          style={{
            maxWidth: sidebarOpen ? '840px' : '900px',
          }}
        >
          <header className="animate-fade-in novel-reader-header" style={{ marginBottom: '2.5rem', position: 'relative' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', padding: '0.2rem 0.6rem', borderRadius: '2px', border: '1px solid rgba(168, 85, 247, 0.3)', fontWeight: 500 }}>
                小說連載專區
              </span>
              <span style={{ fontSize: '0.75rem', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', padding: '0.2rem 0.6rem', borderRadius: '2px', border: '1px solid rgba(74, 222, 128, 0.2)', fontWeight: 500 }}>
                {novel.status}
              </span>
            </div>

            <h1
              className="novel-reader-title"
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

            {novel.description && (
              <p className="novel-reader-desc" style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6, marginBottom: '1.2rem', fontFamily: 'var(--font-noto-sans)' }}>
                {novel.description}
              </p>
            )}

            <div
              className="novel-reader-meta"
              style={{
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                paddingBottom: '1.2rem',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <User size={14} />
                作者：{novel.author}
              </span>
              {currentChapter.fbDate && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={14} />
                  更新日期：{currentChapter.fbDate}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <BookOpen size={14} />
                共 {chapters.length} 章
              </span>
            </div>
          </header>

          <main
            className="animate-fade-in glass-panel novel-chapter-container"
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
            <h2
              className="novel-chapter-title"
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

            <article
              className="novel-article-body"
              style={{
                fontFamily: 'var(--font-noto-serif)',
                fontSize: '1.12rem',
                lineHeight: 2.1,
                letterSpacing: '0.5px',
                textAlign: 'left',
              }}
            >
              {contentParagraphs.length > 0 ? contentParagraphs.map((paragraph, index) => (
                <p
                  key={index}
                  style={{
                    marginBottom: '2rem',
                    textIndent: indentMode === 'indent' ? '2em' : '0',
                    textAlign: 'left',
                  }}
                >
                  {paragraph}
                </p>
              )) : (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem 0' }}>
                  本章節尚無內容。
                </p>
              )}
            </article>

            {/* AI 引用格式 */}
            <div style={{
              marginTop: '4rem',
              padding: '1.5rem',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              <div style={{ color: '#fff', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                📌 本文引用格式 (Citation Reference)
              </div>
              <div>
                {novel.author} (2026). 《{novel.title}》- {currentChapter.title}. Maxupport 私人博物館.
              </div>
              <div style={{ color: '#c084fc', fontFamily: 'monospace', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                https://maxupport.com/museum/creation_lab/novel/{novelId}
              </div>
            </div>
          </main>

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
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setMobileDrawerOpen(true);
                } else {
                  setSidebarOpen(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                letterSpacing: '1px',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              ≡ 章節目錄 ({currentChapterIdx + 1} / {chapters.length})
            </button>

            <button
              onClick={handleNextChapter}
              disabled={currentChapterIdx === chapters.length - 1}
              style={{
                background: currentChapterIdx === chapters.length - 1 ? 'transparent' : 'rgba(255,255,255,0.05)',
                border: '1px solid',
                borderColor: currentChapterIdx === chapters.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
                color: currentChapterIdx === chapters.length - 1 ? 'rgba(255,255,255,0.2)' : '#fff',
                padding: '0.8rem 1.5rem',
                borderRadius: '4px',
                cursor: currentChapterIdx === chapters.length - 1 ? 'not-allowed' : 'pointer',
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

          <div
            className="glass-panel"
            style={{
              padding: '2.5rem 2rem',
              marginTop: '3.5rem',
              background: 'rgba(15, 18, 25, 0.85)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '4px',
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
        </div>
      </div>
    </div>
  );
}
