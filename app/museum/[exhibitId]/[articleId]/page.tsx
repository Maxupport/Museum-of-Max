'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, BookOpen, Share2, Check } from 'lucide-react';
import { EXHIBITS } from '@/lib/constants';

export default function ArticleDetailPage({
  params
}: {
  params: Promise<{ exhibitId: string; articleId: string }>;
}) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const { exhibitId, articleId } = unwrappedParams;
  const exhibit = EXHIBITS[exhibitId];

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (exhibitId && articleId) {
      fetch('/api/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exhibitId, notionId: articleId }),
      }).catch(() => {});
    }
  }, [exhibitId, articleId]);

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!exhibit) {
    return (
      <div style={{ textAlign: 'center', padding: '10rem' }}>
        <h2 style={{ fontFamily: 'var(--font-noto-serif)', color: '#fff', fontSize: '2rem' }}>ARTICLE NOT FOUND</h2>
        <button className="museum-btn" onClick={() => router.push('/museum')} style={{ marginTop: '3rem' }}>
          RETURN TO MAIN HALL
        </button>
      </div>
    );
  }

  // 模擬文章詳細資料 (未來由 Notion API 即時渲染內容)
  const articleData = {
    id: articleId,
    title: `【${exhibit.title}】實務策略洞察與跨界架構`,
    date: '2026-08-20',
    readTime: '5 min read',
    author: 'Maxupport Curator',
    content: [
      {
        type: 'heading',
        text: '前言：重塑產業範式的創新思考',
      },
      {
        type: 'paragraph',
        text: '在快速變動的世界中，跨領域思維早已不再是選配，而是企業與個人持續創造非凡價值的核心引擎。本專題深入探討在當前架構下，如何結合商業洞察與實踐經驗，梳理出最具效益的推動策略。',
      },
      {
        type: 'quote',
        text: '「創新並非憑空想像，而是將現有元素進行跨界且精準的重新組合。」',
      },
      {
        type: 'heading',
        text: '一、核心策略三大柱石',
      },
      {
        type: 'paragraph',
        text: '1. 觀念定位與藍圖繪製：明確定義核心目標與價值主張，避開過度繁雜無效步驟。\n2. 跨界資源對接與串聯：有效整合資金、人脈與技術，形成強大綜效。\n3. 數據指標與動態優化：即時監測執行成效，依市場反饋靈活調整架構。',
      },
      {
        type: 'heading',
        text: '二、未來展望與落地執行',
      },
      {
        type: 'paragraph',
        text: '未來我們將持續透過 Notion 頁面更新最新內容與深度個案分析，歡迎隨時關注本展區的更新動態。',
      },
    ],
  };

  return (
    <div style={{ padding: '4rem 2rem', maxWidth: '900px', margin: '0 auto', minHeight: '100vh' }}>
      {/* 頂部導覽 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem' }}>
        <button
          onClick={() => router.push(`/museum/${exhibitId}`)}
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
          Back to {exhibit.title}
        </button>

        <button
          onClick={handleShare}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          {copied ? <Check size={14} color="#4ade80" /> : <Share2 size={14} />}
          {copied ? 'Link Copied' : 'Share Article'}
        </button>
      </div>

      {/* 文章標題區 */}
      <header className="animate-fade-in" style={{ marginBottom: '3.5rem', position: 'relative' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '0.3rem 0.8rem',
            borderRadius: '2px',
            background: 'rgba(255,255,255,0.05)',
            color: exhibit.color,
            fontSize: '0.8rem',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '1.2rem',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {exhibit.title}
        </div>

        <h1
          style={{
            fontSize: '2.6rem',
            fontWeight: 300,
            color: '#fff',
            fontFamily: 'var(--font-noto-serif)',
            lineHeight: 1.3,
            marginBottom: '1.5rem',
          }}
        >
          {articleData.title}
        </h1>

        <div
          style={{
            display: 'flex',
            gap: '1.5rem',
            alignItems: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '1.5rem',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={14} />
            {articleData.date}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BookOpen size={14} />
            {articleData.readTime}
          </span>
          <span>By {articleData.author}</span>
        </div>
      </header>

      {/* 文章內容主體 */}
      <article className="animate-fade-in" style={{ fontSize: '1.05rem', lineHeight: 1.9, color: 'rgba(255,255,255,0.85)' }}>
        {articleData.content.map((block, i) => {
          if (block.type === 'heading') {
            return (
              <h2
                key={i}
                style={{
                  fontSize: '1.6rem',
                  color: '#fff',
                  fontFamily: 'var(--font-noto-serif)',
                  marginTop: '2.5rem',
                  marginBottom: '1.2rem',
                  borderLeft: `3px solid ${exhibit.color}`,
                  paddingLeft: '1rem',
                }}
              >
                {block.text}
              </h2>
            );
          }

          if (block.type === 'quote') {
            return (
              <blockquote
                key={i}
                style={{
                  margin: '2rem 0',
                  padding: '1.5rem 2rem',
                  background: 'rgba(255,255,255,0.03)',
                  borderLeft: `4px solid ${exhibit.color}`,
                  borderRadius: '0 4px 4px 0',
                  fontSize: '1.1rem',
                  fontStyle: 'italic',
                  color: '#fff',
                  fontFamily: 'var(--font-noto-serif)',
                }}
              >
                {block.text}
              </blockquote>
            );
          }

          return (
            <p key={i} style={{ marginBottom: '1.5rem', whiteSpace: 'pre-line' }}>
              {block.text}
            </p>
          );
        })}
      </article>

      {/* 底部導覽卡 */}
      <footer
        style={{
          marginTop: '5rem',
          paddingTop: '2.5rem',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          className="museum-btn"
          onClick={() => router.push(`/museum/${exhibitId}`)}
          style={{ fontSize: '0.85rem' }}
        >
          返回展區選單
        </button>

        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            letterSpacing: '1px',
          }}
        >
          ▲ TOP OF PAGE
        </button>
      </footer>
    </div>
  );
}
