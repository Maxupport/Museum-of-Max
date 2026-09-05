'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, BookOpen, Share2, Check, Video, Image as ImageIcon } from 'lucide-react';
import { EXHIBITS } from '@/lib/constants';
import { getYouTubeEmbedUrl } from '@/utils/youtube';

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

  const [dbArticle, setDbArticle] = useState<{
    id: string;
    title: string;
    category: string;
    excerpt?: string | null;
    content: string;
    youtubeUrl?: string | null;
    createdAt?: string;
  } | null>(null);

  useEffect(() => {
    if (articleId) {
      fetch(`/api/writings/${articleId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.data) {
            setDbArticle(data.data);
          }
        })
        .catch(() => {});
    }
  }, [articleId]);

  // 解析來自 Google Docs 貼上或 DB 中的文字內文 (轉換為標題、段落、引言與影片區塊)
  const parseContentBlocks = (rawContent: string, youtubeUrl?: string | null) => {
    const lines = rawContent.split('\n').map(l => l.trim()).filter(Boolean);
    const blocks: Array<{ type: string; text?: string; url?: string; caption?: string }> = [];

    if (youtubeUrl) {
      blocks.push({
        type: 'video',
        url: youtubeUrl,
        caption: '觀看精選搭配影片 / 影音紀錄',
      });
    }

    lines.forEach((line) => {
      if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ') || /^[一二三四五六七八九十]+[、.]/.test(line)) {
        blocks.push({
          type: 'heading',
          text: line.replace(/^#+\s*/, ''),
        });
      } else if (line.startsWith('> ') || line.startsWith('「') || line.startsWith('“')) {
        blocks.push({
          type: 'quote',
          text: line.replace(/^>\s*/, ''),
        });
      } else {
        blocks.push({
          type: 'paragraph',
          text: line,
        });
      }
    });

    return blocks;
  };

  const isSoundMind = articleId.startsWith('sound-mind');

  const articleData = dbArticle ? {
    id: dbArticle.id,
    title: dbArticle.title,
    date: dbArticle.createdAt ? new Date(dbArticle.createdAt).toLocaleDateString('zh-TW') : '近期發布',
    readTime: `${Math.max(1, Math.ceil(dbArticle.content.length / 400))} 分鐘閱讀`,
    author: 'Maxupport Curator',
    content: parseContentBlocks(dbArticle.content, dbArticle.youtubeUrl),
  } : isSoundMind ? {
    id: articleId,
    title: articleId === 'sound-mind-1'
      ? '【個人聲音探索心得】從發聲到心靈：個人共鳴與身心對話記錄'
      : articleId === 'sound-mind-2'
      ? '【聲音靈感筆記】聲音質地優化與日常語調重塑'
      : '【Notion 專題】聲音探索與音樂創作的雙向交會',
    date: '2026-08-25',
    readTime: '6 min read',
    author: 'Maxupport Curator',
    content: [
      {
        type: 'heading',
        text: '一、前言：開啟個人聲音覺察之旅',
      },
      {
        type: 'paragraph',
        text: '聲音不僅是傳遞語意與文字的工具，更是個人情緒、氣場與內在狀態的直接延伸。在這次的個人聲音探索實驗中，我嘗試透過呼吸調整、發聲共鳴位移與日常對話記錄，重新認識屬於自己的真實聲響。',
      },
      {
        type: 'quote',
        text: '「每一次發聲，都是身心狀態最誠實的鏡像反映。」',
      },
      {
        type: 'heading',
        text: '二、圖文紀錄：共鳴腔體與呼吸控氣訓練',
      },
      {
        type: 'paragraph',
        text: '透過胸腔與鼻腔共鳴的調控，能顯著提升語調的圓潤度與穩定度。以下為聲音訓練過程中的現場空間與感官覺察紀錄：',
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
        caption: '圖 1：聲音探索實驗室與發聲測試設備記錄',
      },
      {
        type: 'heading',
        text: '三、影音範例與精選段落演示',
      },
      {
        type: 'paragraph',
        text: '下方為聲音探索練習時錄製的影音段落，展示語調層次與氣息銜接的微幅轉折：',
      },
      {
        type: 'video',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        caption: '影片 1：個人聲音共鳴與朗讀語調測試範例',
      },
      {
        type: 'heading',
        text: '四、結語與 Notion 專題同步規劃',
      },
      {
        type: 'paragraph',
        text: '本專區未來將持續與 Notion 資料庫即時連動，隨時補充全新的聲音探索日記、圖文紀錄與影音音軌。',
      },
    ],
  } : {
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

          if (block.type === 'image' && block.url) {
            return (
              <figure key={i} style={{ margin: '2.5rem 0' }}>
                <img
                  src={block.url}
                  alt={block.caption || 'Notion 文章圖片紀錄'}
                  style={{
                    width: '100%',
                    maxHeight: '480px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                  }}
                />
                {block.caption && (
                  <figcaption style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.6rem', fontFamily: 'var(--font-noto-sans)' }}>
                    📷 {block.caption}
                  </figcaption>
                )}
              </figure>
            );
          }

          if (block.type === 'video' && block.url) {
            const embedUrl = getYouTubeEmbedUrl(block.url);
            return (
              <figure key={i} style={{ margin: '2.5rem 0' }}>
                <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {embedUrl ? (
                    <iframe
                      src={embedUrl}
                      title={block.caption || 'Notion 嵌入影片範例'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                    />
                  ) : (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                      無效的影片網址
                    </div>
                  )}
                </div>
                {block.caption && (
                  <figcaption style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.6rem', fontFamily: 'var(--font-noto-sans)' }}>
                    🎬 {block.caption}
                  </figcaption>
                )}
              </figure>
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
