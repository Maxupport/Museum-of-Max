'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, BookOpen, Share2, Check, Video, Image as ImageIcon, Sparkles } from 'lucide-react';
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

  const [articleLoading, setArticleLoading] = useState(true);
  const [dbArticle, setDbArticle] = useState<{
    id: string;
    title: string;
    category: string;
    topic?: string | null;
    fbUrl?: string | null;
    fbDate?: string | null;
    excerpt?: string | null;
    content: string;
    youtubeUrl?: string | null;
    order?: number;
    createdAt?: string;
  } | null>(null);

  useEffect(() => {
    if (articleId) {
      setArticleLoading(true);
      fetch(`/api/writings/${articleId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.data) {
            setDbArticle(data.data);
          }
        })
        .catch(() => {})
        .finally(() => setArticleLoading(false));
    }
  }, [articleId]);

  // 解析來自 Google Docs 貼上或 DB 中的文字內文 (轉換為標題、段落、引言與影片區塊)
  const parseContentBlocks = (rawContent: string, youtubeUrl?: string | null) => {
    let textToParse = rawContent;
    let coverImg: string | null = null;

    if (rawContent.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawContent);
        if (parsed) {
          if (parsed.textContent) textToParse = parsed.textContent;
          else if (parsed.overview && !parsed.isVocalCourse) textToParse = parsed.overview;
          if (parsed.coverImage) coverImg = parsed.coverImage;
        }
      } catch {}
    }

    const lines = textToParse.split('\n').map(l => l.trim()).filter(Boolean);
    const blocks: Array<{ type: string; text?: string; url?: string; caption?: string }> = [];

    if (coverImg) {
      blocks.push({
        type: 'image',
        url: coverImg,
        caption: '專題精選封面圖',
      });
    }

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
  } : null;

  const [isCurator, setIsCurator] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsCurator(document.cookie.includes('is_curator=true'));
    }
  }, []);

  // 解析「人聲優化歷程記錄」的多版本演進 JSON
  const vocalCourseData = (() => {
    if (!dbArticle?.content) return null;
    if (dbArticle.category === '人聲優化歷程記錄' || dbArticle.category === '人聲優化課程' || dbArticle.content.includes('"isVocalCourse"')) {
      try {
        const parsed = JSON.parse(dbArticle.content);
        if (parsed && (parsed.isVocalCourse || Array.isArray(parsed.versions))) {
          return parsed as {
            isVocalCourse: boolean;
            overview?: string;
            versions: Array<{
              id: string;
              versionTitle: string;
              date: string;
              youtubeUrl: string;
              notes?: string;
            }>;
          };
        }
      } catch {
        // Not JSON
      }
    }
    return null;
  })();

  const [hasInteracted, setHasInteracted] = useState(false);
  const [currentPlayingIdx, setCurrentPlayingIdx] = useState<number | null>(null);
  const iframeRefs = useRef<Map<number, HTMLIFrameElement>>(new Map());

  // 全域監聽使用者互動 (包含滾動、點擊、觸控、鍵盤輸入)，確保瀏覽器允許 Autoplay 指令執行
  useEffect(() => {
    const handleUserInteraction = () => {
      setHasInteracted(true);
    };

    window.addEventListener('pointerdown', handleUserInteraction, { capture: true });
    window.addEventListener('touchstart', handleUserInteraction, { capture: true });
    window.addEventListener('scroll', handleUserInteraction, { capture: true });
    window.addEventListener('keydown', handleUserInteraction, { capture: true });
    window.addEventListener('click', handleUserInteraction, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', handleUserInteraction, { capture: true });
      window.removeEventListener('touchstart', handleUserInteraction, { capture: true });
      window.removeEventListener('scroll', handleUserInteraction, { capture: true });
      window.removeEventListener('keydown', handleUserInteraction, { capture: true });
      window.removeEventListener('click', handleUserInteraction, { capture: true });
    };
  }, []);

  // 向 YouTube iframe 傳送指令
  const postIframeCommand = (idx: number, command: string, args: unknown = '') => {
    const iframe = iframeRefs.current.get(idx);
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: command, args }),
        '*'
      );
    }
  };

  // 滾動觸發：當影片卡片滑至畫面中央時，自動暫停先前影片並開始自動播放當前影片
  useEffect(() => {
    if (!vocalCourseData || !vocalCourseData.versions || vocalCourseData.versions.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number(entry.target.getAttribute('data-version-idx'));
          if (entry.isIntersecting) {
            setCurrentPlayingIdx((prevIdx) => {
              if (prevIdx !== null && prevIdx !== idx) {
                postIframeCommand(prevIdx, 'pauseVideo');
              }
              postIframeCommand(idx, 'playVideo');
              return idx;
            });
          }
        });
      },
      {
        threshold: 0.5,
        rootMargin: '-10% 0px -10% 0px'
      }
    );

    vocalCourseData.versions.forEach((_, i) => {
      const el = document.getElementById(`vocal-version-card-${i}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [vocalCourseData]);

  if (articleLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '12rem 2rem', color: 'var(--text-secondary)' }}>
        <p style={{ letterSpacing: '1px' }}>專題創作內容載入中...</p>
      </div>
    );
  }

  if (!articleData && !vocalCourseData) {
    return (
      <div style={{ textAlign: 'center', padding: '10rem 2rem', color: 'var(--text-secondary)' }}>
        <h3 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '1.2rem', fontFamily: 'var(--font-noto-serif)' }}>找不到該作品或專題頁面</h3>
        <button className="museum-btn" onClick={() => router.push(`/museum/${exhibitId}`)}>
          ← 返回【{exhibit.title}】展區
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '3.5rem 1.5rem 6rem', maxWidth: '820px', margin: '0 auto', minHeight: '100vh', boxSizing: 'border-box' }}>
      {/* 頂部導覽 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3.5rem' }}>
        <button
          onClick={() => router.push(`/museum/${exhibitId}`)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.9rem',
            letterSpacing: '1px',
            transition: 'color 0.3s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <ArrowLeft size={16} />
          返回【{exhibit.title}】展區
        </button>

        <button
          onClick={handleShare}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
            padding: '0.45rem 0.9rem',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.82rem',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          {copied ? <Check size={14} color="#4ade80" /> : <Share2 size={14} />}
          {copied ? '已複製連結' : '分享文章'}
        </button>
      </div>

      {/* 文章標題區 */}
      <header className="animate-fade-in" style={{ marginBottom: '3rem', position: 'relative' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.05)',
            color: exhibit.color,
            fontSize: '0.8rem',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '1.2rem',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {dbArticle?.category === '小說' ? '小說連載' : (dbArticle?.category || exhibit.title)}
        </div>

        <h1
          style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 300,
            color: '#fff',
            fontFamily: 'var(--font-noto-serif)',
            lineHeight: 1.35,
            marginBottom: '1.2rem',
          }}
        >
          {articleData?.title || '作品專題'}
        </h1>

        {/* 標題下方標籤: 文章主題/小說名稱, FB 上線時間, FB 連結 */}
        {(dbArticle?.topic || dbArticle?.fbDate || dbArticle?.fbUrl || (dbArticle?.category === '小說' && typeof dbArticle?.order === 'number')) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', marginBottom: '1.5rem' }}>
            {dbArticle?.category === '小說' && (
              <span style={{ fontSize: '0.82rem', background: 'rgba(168,85,247,0.25)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.4)', padding: '0.25rem 0.75rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}>
                📖 小說連載
              </span>
            )}
            {dbArticle?.topic && (
              <span style={{ fontSize: '0.82rem', background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', padding: '0.25rem 0.75rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                {dbArticle.category === '小說' ? `《${dbArticle.topic}》` : `📌 主題：${dbArticle.topic}`}
              </span>
            )}
            {dbArticle?.category === '小說' && typeof dbArticle?.order === 'number' && dbArticle.order > 0 && (
              <span style={{ fontSize: '0.82rem', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', padding: '0.25rem 0.75rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                🔢 第 {dbArticle.order} 章
              </span>
            )}
            {dbArticle?.fbDate && (
              <span style={{ fontSize: '0.82rem', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.15)', padding: '0.25rem 0.75rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                📅 FB 上線時間：{dbArticle.fbDate}
              </span>
            )}
            {dbArticle?.fbUrl && (
              <a
                href={dbArticle.fbUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.82rem', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '0.25rem 0.75rem', borderRadius: '4px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                🔗 開啟 FB 原文
              </a>
            )}
          </div>
        )}

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
          {isCurator && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={14} />
              {articleData?.date || ''}
            </span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BookOpen size={14} />
            {vocalCourseData ? `${vocalCourseData.versions.length} 個演進版本` : articleData?.readTime}
          </span>
          <span>By {articleData?.author || 'Maxupport Curator'}</span>
        </div>
      </header>

      {/* 文章內容主體 或 人聲優化多版本時間軸 */}
      {vocalCourseData ? (
        <div className="animate-fade-in">
          {/* 提示 Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(15, 23, 42, 0.7) 100%)',
            border: '1px solid rgba(236, 72, 153, 0.4)',
            borderRadius: '8px',
            padding: '1.2rem 1.6rem',
            marginBottom: '3rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            color: '#f472b6',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            boxShadow: '0 8px 25px rgba(236, 72, 153, 0.12)'
          }}>
            <Sparkles size={24} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: '0.2rem' }}>
                🎙️ 人聲優化演進時間軸（共 {vocalCourseData.versions.length} 個演進版本錄音，最多支援 10 個）
              </div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.84rem' }}>
                💡 操作提示：往下滑動頁面時，當影片卡片滑至畫面中央，系統會自動無縫暫停上方影片，並自動播放當前版本的錄音影片！
              </div>
            </div>
          </div>

          {/* 總覽說明 */}
          {vocalCourseData.overview && (
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.05rem', lineHeight: 1.8, marginBottom: '2.5rem', whiteSpace: 'pre-line' }}>
              {vocalCourseData.overview}
            </p>
          )}

          {/* 垂直時間軸主體 */}
          <div style={{ position: 'relative', paddingLeft: '2.5rem' }}>
            {/* 垂直極光走廊軸線 */}
            <div style={{
              position: 'absolute',
              top: '20px',
              bottom: '40px',
              left: '12px',
              width: '2px',
              background: 'linear-gradient(180deg, #ec4899 0%, rgba(236, 72, 153, 0.2) 100%)',
              boxShadow: '0 0 10px rgba(236, 72, 153, 0.5)'
            }} />

            {vocalCourseData.versions.map((ver, idx) => {
              const embedUrl = getYouTubeEmbedUrl(ver.youtubeUrl);
              const fullEmbedUrl = embedUrl ? `${embedUrl}?enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}` : null;

              return (
                <div
                  key={ver.id || idx}
                  id={`vocal-version-card-${idx}`}
                  data-version-idx={idx}
                  style={{
                    position: 'relative',
                    marginBottom: '3.5rem',
                    scrollMarginTop: '100px'
                  }}
                >
                  {/* 時間軸節點圖示 */}
                  <div style={{
                    position: 'absolute',
                    left: '-2.5rem',
                    top: '0.4rem',
                    transform: 'translateX(-50%)',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: currentPlayingIdx === idx ? '#ec4899' : 'rgba(15, 23, 42, 0.9)',
                    border: `2px solid ${currentPlayingIdx === idx ? '#fff' : '#ec4899'}`,
                    boxShadow: currentPlayingIdx === idx ? '0 0 15px #ec4899' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    transition: 'all 0.3s ease',
                    zIndex: 2
                  }}>
                    {idx + 1}
                  </div>

                  {/* 卡片本體 */}
                  <div
                    className="glass-panel"
                    style={{
                      padding: '1.8rem',
                      borderRadius: '8px',
                      border: currentPlayingIdx === idx ? '1px solid rgba(236, 72, 153, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: currentPlayingIdx === idx ? '0 8px 30px rgba(236, 72, 153, 0.15)' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => setHasInteracted(true)}
                  >
                    {/* 版本 Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                      <span style={{
                        fontSize: '0.85rem',
                        background: 'rgba(236, 72, 153, 0.2)',
                        color: '#f472b6',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(236, 72, 153, 0.4)',
                        fontWeight: 600
                      }}>
                        {ver.versionTitle || `Ver ${idx + 1}.0`}
                      </span>
                      {ver.date && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          📅 錄音時間：{ver.date}
                        </span>
                      )}
                    </div>

                    {/* YouTube Player */}
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      paddingTop: '56.25%',
                      background: '#000',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      marginBottom: '1.2rem',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      {fullEmbedUrl ? (
                        <iframe
                          ref={(el) => {
                            if (el) iframeRefs.current.set(idx, el);
                            else iframeRefs.current.delete(idx);
                          }}
                          src={fullEmbedUrl}
                          title={ver.versionTitle}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                        />
                      ) : (
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                          未設定 YouTube 網址
                        </div>
                      )}
                    </div>

                    {/* 註記說明 */}
                    {ver.notes && (
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        borderLeft: '3px solid #ec4899',
                        padding: '0.9rem 1.2rem',
                        borderRadius: '0 4px 4px 0',
                        fontSize: '0.92rem',
                        lineHeight: 1.6,
                        color: 'rgba(255,255,255,0.85)'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: '#f472b6', marginBottom: '0.3rem', fontWeight: 500 }}>
                          💡 該階段發聲技巧與紀錄摘要：
                        </div>
                        {ver.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <article className="animate-fade-in" style={{ fontSize: '1.05rem', lineHeight: 1.9, color: 'rgba(255,255,255,0.85)' }}>
          {articleData?.content?.map((block, i) => {
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
      )}

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
          ← 返回【{exhibit.title}】展區
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
