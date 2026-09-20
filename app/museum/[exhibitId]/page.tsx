'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Calendar, Briefcase, ChevronRight, ChevronDown, BookOpen, TrendingUp, Building, ExternalLink, Sparkles, Mail, Image as ImageIcon, Building2, X } from 'lucide-react';
import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { EXHIBITS, YOUTH_SONGS_YOUTUBE_CHANNEL } from '@/lib/constants';
import { getYouTubeEmbedUrl } from '@/utils/youtube';

const YoutubeIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

interface CareerItem {
  id: string;
  company: string;
  role: string;
  period: string;
  description: string;
  logoUrl?: string | null;
  photoUrl?: string | null;
  order: number;
  createdAt?: string;
}

interface VentureItem {
  id: string;
  category: string;
  title: string;
  logoUrl: string | null;
  period: string;
  status: string;
  description: string | null;
  linkUrl: string | null;
  order: number;
  createdAt?: string;
}

interface MusicItem {
  id: string;
  category: string;
  title: string;
  youtubeUrl: string;
  description: string | null;
  order: number;
  createdAt?: string;
}

interface WritingsItem {
  id: string;
  exhibitId?: string;
  title: string;
  category: string;
  topic?: string | null;
  fbUrl?: string | null;
  fbDate?: string | null;
  excerpt: string | null;
  content: string;
  youtubeUrl?: string | null;
  isPinned?: boolean;
  isHidden?: boolean;
  views?: number;
  order: number;
  createdAt?: string;
}

interface NovelData {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  description: string | null;
  status: string;
  order: number;
  totalChapters: number;
  latestChapterTitle: string | null;
}

function formatTimestamp(dateStr?: string | Date | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `📅 上傳時間：${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export default function ExhibitDetail({ params }: { params: Promise<{ exhibitId: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const exhibitId = unwrappedParams.exhibitId;
  const exhibit = EXHIBITS[exhibitId as string];

  // UI States
  const [activeSubCategory, setActiveSubCategory] = useState<string>(exhibit?.subcategories[0] || '');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [isNovelDirect, setIsNovelDirect] = useState(false);
  const [isCurator, setIsCurator] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsCurator(document.cookie.includes('is_curator=true'));
    }
  }, []);
  
  // Career Items state (for career exhibit)
  const [careerItems, setCareerItems] = useState<CareerItem[]>([]);
  const [careerLoading, setCareerLoading] = useState(false);

  // Venture Items state (for vc exhibit)
  const [ventureItems, setVentureItems] = useState<VentureItem[]>([]);
  const [ventureLoading, setVentureLoading] = useState(false);

  // Music Items state (for creation_lab music subcategory or sound exhibit)
  const [musicItems, setMusicItems] = useState<MusicItem[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [selectedMusicItem, setSelectedMusicItem] = useState<MusicItem | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedMusicItem(null);
      }
    };
    if (selectedMusicItem) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedMusicItem]);

  // Writings Items state (for creation_lab FB文章備份 subcategory)
  const [writingsItems, setWritingsItems] = useState<WritingsItem[]>([]);
  const [writingsLoading, setWritingsLoading] = useState(false);

  // Novel Items state (for creation_lab 小說 subcategory)
  const [novelItems, setNovelItems] = useState<NovelData[]>([]);
  const [novelLoading, setNovelLoading] = useState(false);

  useEffect(() => {
    const isBlogExhibit = ['finance_insurance', 'sound', 'creation_lab', 'communication'].includes(exhibitId);
    if (isBlogExhibit) {
      // 小說子分類：從 /api/novels 取得最上層資訊（含章節數）
      if (activeSubCategory === '小說') {
        setNovelLoading(true);
        fetch('/api/novels')
          .then((res) => res.json())
          .then((data) => {
            if (data.ok) setNovelItems(data.data);
          })
          .finally(() => setNovelLoading(false));
        return;
      }
      setWritingsLoading(true);
      fetch(`/api/writings?exhibitId=${exhibitId}${activeSubCategory ? `&category=${encodeURIComponent(activeSubCategory)}` : ''}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) setWritingsItems(data.data);
        })
        .finally(() => setWritingsLoading(false));
    }
  }, [exhibitId, activeSubCategory]);

  useEffect(() => {
    if (exhibitId === 'sound' || exhibitId === 'creation_lab') {
      setMusicLoading(true);
      fetch('/api/music')
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) setMusicItems(data.data);
        })
        .finally(() => setMusicLoading(false));
    }
  }, [exhibitId]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const isCuratorCookie = document.cookie.includes('is_curator=true');
      if (!isCuratorCookie) {
        const match = document.cookie.match(/(?:^|; )visitor_permissions=([^;]*)/);
        if (match && match[1]) {
          try {
            const perms = JSON.parse(decodeURIComponent(match[1]));
            if (Array.isArray(perms)) {
              // Strict boundary check: Verify if visitor is authorized for this exhibitId
              const isAllowed = perms.includes(exhibitId) || 
                (exhibitId === 'creation_lab' && perms.includes('creation_lab_novel')) ||
                (perms.includes('corp') && exhibitId === 'finance_insurance') ||
                (perms.includes('audit') && exhibitId === 'finance_insurance');
              
              if (!isAllowed) {
                // Unauthorized exhibit access attempt -> Redirect to allowed exhibit or homepage
                if (perms.includes('creation_lab_novel') || perms.includes('creation_lab')) {
                  router.replace('/museum/creation_lab');
                } else if (perms.length > 0 && perms[0] !== exhibitId && perms[0] !== 'creation_lab_novel') {
                  router.replace(`/museum/${perms[0]}`);
                } else {
                  router.replace('/');
                }
                return;
              }

              if (perms.includes('creation_lab_novel') && !perms.includes('vc') && !perms.includes('career')) {
                setIsNovelDirect(true);
              }
            }
          } catch {}
        } else {
          router.replace('/');
        }
      }
    }
  }, [exhibitId, router]);

  // 獨立紀錄所有展區頁面與子分類切換的瀏覽流量
  useEffect(() => {
    if (exhibitId) {
      fetch('/api/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exhibitId, notionId: activeSubCategory || 'main' }),
      }).catch(() => {});
    }
  }, [exhibitId, activeSubCategory]);

  useEffect(() => {
    if (exhibitId === 'career') {
      setCareerLoading(true);
      fetch('/api/career')
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) setCareerItems(data.data);
        })
        .finally(() => setCareerLoading(false));
    } else if (exhibitId === 'vc') {
      setVentureLoading(true);
      fetch(`/api/venture${activeSubCategory ? `?category=${encodeURIComponent(activeSubCategory)}` : ''}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) setVentureItems(data.data);
        })
        .finally(() => setVentureLoading(false));
    }
  }, [exhibitId, activeSubCategory]);

  // 1. 切換展區或頁面載入時，強制立即使視埠回到最頂端
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    resetScroll();
    const rafId = requestAnimationFrame(resetScroll);
    const t1 = setTimeout(resetScroll, 60);
    const t2 = setTimeout(resetScroll, 200);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [exhibitId]);

  // 2. 當職涯經歷或各展區異步資料載入完成時，再次校準確保視埠維持在最頂端，避免高度暴增導致卡在中間
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isFinished = !careerLoading && !ventureLoading && !musicLoading && !writingsLoading && !novelLoading;
    if (isFinished) {
      const resetScroll = () => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      };
      resetScroll();
      const rafId = requestAnimationFrame(resetScroll);
      const t1 = setTimeout(resetScroll, 80);
      const t2 = setTimeout(resetScroll, 250);
      const t3 = setTimeout(resetScroll, 500);
      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [careerLoading, ventureLoading, musicLoading, writingsLoading, novelLoading, careerItems.length]);

  if (!exhibit) {
    return (
      <div style={{ textAlign: 'center', padding: '10rem' }}>
        <h2 style={{ fontFamily: 'var(--font-noto-serif)', color: '#fff', fontSize: '2rem' }}>SECTION NOT FOUND</h2>
        <button className="museum-btn" onClick={() => router.push('/museum')} style={{ marginTop: '3rem' }}>
          RETURN TO MAIN HALL
        </button>
      </div>
    );
  }

  const filteredWritingsItems = writingsItems.filter(item => {
    if (!searchKeyword) return true;
    const kw = searchKeyword.toLowerCase();
    return (
      item.title.toLowerCase().includes(kw) ||
      (item.excerpt && item.excerpt.toLowerCase().includes(kw)) ||
      (item.content && item.content.toLowerCase().includes(kw)) ||
      (item.topic && item.topic.toLowerCase().includes(kw))
    );
  });

  const filteredVentureItems = ventureItems.filter(item =>
    item.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    item.status.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchKeyword.toLowerCase()))
  );

  const filteredMusicItems = musicItems.filter((item) => {
    const matchesSearch = searchKeyword
      ? item.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchKeyword.toLowerCase()))
      : true;

    if (!matchesSearch) return false;

    if (exhibitId === 'sound') {
      if (activeSubCategory) {
        return item.category === activeSubCategory && activeSubCategory !== '個人聲音探索心得';
      }
      return item.category !== '個人聲音探索心得';
    }

    if (exhibitId === 'creation_lab') {
      if (activeSubCategory === '音樂') {
        return true;
      }
      return item.category === '音樂' || item.category === '創作 Lab - 音樂' || !item.category || !['個人聲音探索心得', '青春之歌計畫', '人聲優化課程', '人聲優化歷程記錄'].includes(item.category || '');
    }

    return true;
  });

  const filteredNovelItems = novelItems.filter((novel) => {
    if (!searchKeyword) return true;
    const kw = searchKeyword.toLowerCase();
    return (
      novel.title?.toLowerCase().includes(kw) ||
      novel.author?.toLowerCase().includes(kw) ||
      novel.description?.toLowerCase().includes(kw)
    );
  });

  const cleanExcerpt = (content: string) => {
    if (!content) return '';
    let text = content;
    if (content.trim().startsWith('{')) {
      try {
        const p = JSON.parse(content);
        if (p) {
          if (p.textContent) text = p.textContent;
          else if (p.overview) text = p.overview;
        }
      } catch {}
    }
    return text.replace(/^#+\s*|^>\s*/gm, '').slice(0, 150);
  };

  return (
    <div className="exhibit-page-container">
      {/* 返回展覽大廳按鈕 (若為小說直通讀者則不顯示) */}
      {!isNovelDirect && (
        <button 
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }
            router.push('/museum');
          }}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-secondary)', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            marginBottom: '0.75rem',
            fontSize: '0.82rem',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            transition: 'color 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <ArrowLeft size={14} />
          Return to Exhibition Hall
        </button>
      )}

      {/* 展區標題 */}
      <header className="animate-fade-in" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
        <div style={{ 
          width: '3px', 
          height: '36px', 
          background: exhibit.color, 
          boxShadow: `0 0 12px ${exhibit.color}` 
        }} />
        <div>
          <h1 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.1rem)', fontWeight: 400, color: '#fff', marginBottom: '0.15rem', fontFamily: 'var(--font-noto-serif)', lineHeight: 1.15 }}>
            {exhibit.title}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
            {exhibit.subtitle}
          </p>
        </div>
      </header>

      {/* 展區控制工具列：整合子分類頁籤與搜尋 (Unified Filter & Search Toolbar) */}
      <div className="animate-fade-in exhibit-toolbar">
        {/* LED 亮線裝飾 */}
        <div style={{
          position: 'absolute',
          bottom: '-1px',
          left: 0,
          width: '120px',
          height: '1px',
          background: exhibit.color,
          boxShadow: `0 0 10px ${exhibit.color}`
        }} />

        {/* 子區塊頁籤 */}
        {exhibit.subcategories.length > 0 ? (
          <div className="exhibit-subcategories-bar">
            {exhibit.subcategories.map((subCat) => {
              const isActive = activeSubCategory === subCat;
              return (
                <button
                  key={subCat}
                  onClick={() => {
                    setActiveSubCategory(subCat);
                    setSearchKeyword('');
                    if (typeof window !== 'undefined') {
                      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                      document.documentElement.scrollTop = 0;
                      document.body.scrollTop = 0;
                    }
                  }}
                  className={`exhibit-subcategory-btn ${isActive ? 'active' : ''}`}
                  style={{
                    borderColor: isActive ? exhibit.color : undefined,
                    background: isActive ? 'rgba(255,255,255,0.08)' : undefined,
                    color: isActive ? '#fff' : undefined,
                    boxShadow: isActive ? `0 0 12px ${exhibit.color}33` : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                      e.currentTarget.style.color = '#fff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  {subCat}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '2px', textTransform: 'uppercase' }}>
            {exhibit.isTimeline ? 'Career Timeline & Milestones' : 'Exhibition Content'}
          </div>
        )}

        {/* 右側：搜尋列 (或 VC 專案洽詢按鈕 + 搜尋) */}
        {!exhibit.isTimeline && (
          <div className="exhibit-toolbar-actions">
            {exhibitId === 'vc' && (
              <a
                href="mailto:maxupport@gmail.com?subject=【風險投資/FA諮詢】來自網站的合作與項目提案"
                className="museum-btn exhibit-email-btn"
              >
                <Mail size={15} />
                <span>Email 聯絡策展人</span>
              </a>
            )}

            <div className="exhibit-search-container">
              <Search size={16} className="exhibit-search-icon" />
              <input 
                type="text" 
                placeholder={exhibitId === 'vc' ? "Search venture projects..." : "Search in this section..."}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="museum-input exhibit-search-input"
              />
            </div>
          </div>
        )}
      </div>

      {/* 展區內容區域 */}
      {exhibitId === 'vc' ? (
        /* 風險投資 (VC Projects) 後台即時卡片展示 (不連結 Notion) */
        <div className="animate-fade-in">

          {ventureLoading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              載入風險投資項目中...
            </div>
          ) : filteredVentureItems.length === 0 ? (
            <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <TrendingUp size={36} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p style={{ letterSpacing: '1px' }}>此子區塊尚無項目資料。</p>
            </div>
          ) : (
            <div className="exhibit-items-grid">
              {filteredVentureItems.map((item) => {
                const isCenteredLogo = ['早期投資', '早期投資項目', '新創項目評估', '創投項目評估', '募資 FA 服務', '募資FA服務'].includes(item.category) || true;

                const CardContent = (
                  <div className="glass-panel exhibit-card" style={{ padding: '1.5rem', color: exhibit.color, display: 'flex', flexDirection: 'column', height: '100%', cursor: item.linkUrl ? 'pointer' : 'default' }}>
                    {isCenteredLogo ? (
                      /* 早期投資 & 新創項目評估：Logo 置中呈現 */
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1rem' }}>
                        {item.logoUrl ? (
                          <img
                            src={item.logoUrl}
                            alt={item.title}
                            style={{
                              width: '80px',
                              height: '80px',
                              objectFit: 'contain',
                              borderRadius: '12px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              padding: '0.5rem',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                              marginBottom: '0.8rem',
                              transition: 'transform 0.3s ease',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '80px',
                              height: '80px',
                              borderRadius: '12px',
                              background: 'rgba(56, 189, 248, 0.08)',
                              border: '1.5px dashed rgba(56, 189, 248, 0.35)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#38bdf8',
                              marginBottom: '0.8rem',
                              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                            }}
                          >
                            <Building size={32} style={{ opacity: 0.9, marginBottom: '2px' }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 600, opacity: 0.8, letterSpacing: '1px' }}>LOGO</span>
                          </div>
                        )}

                        <div style={{ width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1.35rem', color: '#fff', fontFamily: 'var(--font-noto-serif)', margin: 0, wordBreak: 'break-word', overflowWrap: 'break-word', textWrap: 'balance' }}>
                              {item.title}
                            </h3>
                            {item.linkUrl && <ExternalLink size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                            <Calendar size={13} />
                            {item.period}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* 其他分類：原有橫向圖標排列 */
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        {item.logoUrl ? (
                          <img src={item.logoUrl} alt={item.title} style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', padding: '0.2rem' }} />
                        ) : (
                          <div style={{ width: '48px', height: '48px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                            <Building size={24} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                            <h3 style={{ fontSize: '1.35rem', color: '#fff', fontFamily: 'var(--font-noto-serif)', marginBottom: '0.2rem', wordBreak: 'break-word', overflowWrap: 'break-word', textWrap: 'balance' }}>
                              {item.title}
                            </h3>
                            {item.linkUrl && <ExternalLink size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Calendar size={12} />
                            {item.period}
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', color: '#38bdf8', padding: '0.5rem 0.85rem', borderRadius: '4px', fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8', flexShrink: 0 }} />
                      <span>現況更新: {item.status}</span>
                    </div>

                    {item.description && (
                      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-line', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginTop: 'auto', wordBreak: 'break-word', overflowWrap: 'break-word', textWrap: 'pretty' }}>
                        {item.description}
                      </p>
                    )}

                    {item.linkUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontSize: '0.85rem', marginTop: '1rem', fontWeight: 500 }}>
                        <span>前往外部專案連結</span>
                        <ExternalLink size={14} />
                      </div>
                    )}
                  </div>
                );

                if (item.linkUrl) {
                  return (
                    <a key={item.id} href={item.linkUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      {CardContent}
                    </a>
                  );
                }

                return <div key={item.id}>{CardContent}</div>;
              })}
            </div>
          )}

          {/* 美觀優雅的展區結束分隔線 */}
          <div
            style={{
              marginTop: '2.5rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              width: '100%',
            }}
          >
            <div
              style={{
                height: '1px',
                width: '100%',
                maxWidth: '550px',
                background: 'linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.35), rgba(255, 255, 255, 0.7), rgba(56, 189, 248, 0.35), transparent)',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.3)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#38bdf8',
                boxShadow: '0 0 10px #38bdf8, 0 0 18px rgba(56, 189, 248, 0.6)',
              }}
            />
          </div>
        </div>
      ) : exhibit.isTimeline ? (
        /* 職涯經歷 (Career Experience) 時間軸展示 */
        <div className="animate-fade-in" style={{ padding: '0.25rem 0 2rem' }}>
          {careerLoading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              載入職涯經歷中...
            </div>
          ) : careerItems.length === 0 ? (
            <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Briefcase size={36} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p style={{ letterSpacing: '1px' }}>目前尚無職涯經歷資料。</p>
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: '2rem', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
              {careerItems.map((item, index) => {
                const isLatest = index === 0;
                return (
                  <div key={item.id} style={{ position: 'relative', marginBottom: isLatest ? '2.5rem' : '2.5rem' }}>
                    {/* 時間軸節點指示燈 */}
                    <div style={{
                      position: 'absolute',
                      left: '-2.6rem',
                      top: '0.4rem',
                      width: isLatest ? '20px' : '16px',
                      height: isLatest ? '20px' : '16px',
                      borderRadius: '50%',
                      background: isLatest ? '#f59e0b' : exhibit.color,
                      boxShadow: isLatest ? '0 0 16px #f59e0b, 0 0 6px #fff' : `0 0 10px ${exhibit.color}`,
                      border: isLatest ? '2px solid #ffffff' : 'none',
                      zIndex: 2,
                    }} />

                    <div
                      className="glass-panel exhibit-card"
                      style={{
                        padding: '1.4rem 1.6rem',
                        color: exhibit.color,
                        border: isLatest ? '1.5px solid rgba(245, 158, 11, 0.45)' : undefined,
                        boxShadow: isLatest ? '0 12px 35px rgba(245, 158, 11, 0.12)' : undefined,
                      }}
                    >
                      {/* 最上方：最新職涯經歷標籤與時間 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                        {isLatest ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.22rem 0.7rem',
                            borderRadius: '12px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            border: '1px solid rgba(245, 158, 11, 0.5)',
                            color: '#fbbf24',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            letterSpacing: '1.2px'
                          }}>
                            <Sparkles size={12} />
                            最新經歷 · CURRENT MILESTONE
                          </span>
                        ) : <span />}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: isLatest ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.05)', padding: '0.35rem 0.75rem', borderRadius: '4px', fontSize: '0.82rem', color: isLatest ? '#fbbf24' : 'var(--text-secondary)' }}>
                          <Calendar size={13} />
                          <span style={{ fontWeight: isLatest ? 600 : 400 }}>{item.period}</span>
                        </div>
                      </div>

                      {/* 公司與職位標題區 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.2rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', width: '100%' }}>
                          {item.logoUrl ? (
                            <img
                              src={item.logoUrl}
                              alt={`${item.company} Logo`}
                              style={{
                                width: '68px',
                                height: '68px',
                                objectFit: 'contain',
                                background: 'rgba(255, 255, 255, 0.08)',
                                borderRadius: '12px',
                                padding: '0.4rem',
                                border: isLatest ? '1.5px solid rgba(245, 158, 11, 0.5)' : '1.5px solid rgba(255, 255, 255, 0.15)',
                                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div
                              title="Company Logo 預留位置"
                              style={{
                                width: '68px',
                                height: '68px',
                                borderRadius: '12px',
                                border: '2px dashed rgba(245, 158, 11, 0.5)',
                                background: 'rgba(245, 158, 11, 0.08)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--theme-career)',
                                flexShrink: 0,
                                textAlign: 'center',
                                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                              }}
                            >
                              <Building2 size={26} style={{ opacity: 0.9, marginBottom: '2px' }} />
                              <span style={{ fontSize: '0.62rem', fontWeight: 600, opacity: 0.9, letterSpacing: '1px' }}>LOGO</span>
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h2 style={{ fontSize: 'clamp(1.35rem, 2.8vw, 1.7rem)', color: '#fff', fontFamily: 'var(--font-noto-serif)', marginBottom: '0.2rem', wordBreak: 'break-word', overflowWrap: 'break-word', textWrap: 'balance' }}>
                              {item.company}
                            </h2>
                            <h3 style={{ fontSize: 'clamp(0.95rem, 2vw, 1.05rem)', color: isLatest ? '#f59e0b' : 'var(--text-secondary)', fontWeight: 400, wordBreak: 'break-word', overflowWrap: 'break-word', textWrap: 'balance' }}>
                              {item.role}
                            </h3>
                          </div>
                        </div>
                      </div>

                      {/* 內容區：左右併排（桌機）/ 上下排列（手機），確保首頁不被拉長切斷 */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: item.photoUrl ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
                        gap: '1.2rem',
                        alignItems: 'center',
                        marginTop: '0.8rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        paddingTop: '1rem',
                      }}>
                        {item.photoUrl ? (
                          <div
                            style={{
                              borderRadius: '10px',
                              overflow: 'hidden',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              background: 'rgba(0, 0, 0, 0.45)',
                              padding: '0.35rem',
                              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
                              maxHeight: '230px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <img
                              src={item.photoUrl}
                              alt={`${item.company} 工作現場照片`}
                              style={{
                                width: '100%',
                                maxHeight: '220px',
                                objectFit: 'contain',
                                borderRadius: '6px',
                                display: 'block',
                              }}
                            />
                          </div>
                        ) : null}

                        {item.description && (
                          <div
                            style={{
                              color: 'rgba(255, 255, 255, 0.85)',
                              fontSize: '0.92rem',
                              lineHeight: 1.7,
                              whiteSpace: 'pre-line',
                              fontFamily: 'var(--font-noto-sans)',
                              letterSpacing: '0.3px',
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                              textWrap: 'pretty',
                            }}
                          >
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* 部落格型展區 (卡片清單與 Notion Blog 文章入口) */
        <div className="animate-fade-in">
          
          {/* 個人聲音探索心得 / 人聲優化歷程記錄 (文章卡片與時間軸架構) 或 音樂與聲音探尋 YouTube 影片嵌入網格 */}
          {(exhibitId === 'sound' && (activeSubCategory === '個人聲音探索心得' || activeSubCategory === '人聲優化歷程記錄' || activeSubCategory === '人聲優化課程')) ? (
            writingsLoading ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>載入文章與歷程記錄中...</div>
            ) : filteredWritingsItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                <p style={{ letterSpacing: '1px' }}>目前【{activeSubCategory}】尚無作品。</p>
              </div>
            ) : (
            filteredWritingsItems.length === 1 ? (
              /* 單篇精選專題卡：拉長且置中於下方空間，消除無謂空白 */
              (() => {
                const item = filteredWritingsItems[0];
                let isVocal = item.category === '人聲優化課程' || item.category === '人聲優化歷程記錄';
                let versionCount = 0;
                let coverImage: string | null = null;
                if (item.content) {
                  try {
                    const p = JSON.parse(item.content);
                    if (p) {
                      if (Array.isArray(p.versions)) versionCount = p.versions.length;
                      if (p.coverImage) coverImage = p.coverImage;
                    }
                  } catch {}
                }

                return (
                  <div className="exhibit-single-featured-container animate-fade-in">
                    <Link href={`/museum/${exhibit.id}/${item.id}`} style={{ textDecoration: 'none', width: '100%', maxWidth: '960px' }}>
                      <div className="exhibit-single-featured-card" style={{ color: exhibit.color }}>
                        <div className="exhibit-single-featured-cover">
                          {coverImage ? (
                            <img src={coverImage} alt={item.title} />
                          ) : (
                            <div style={{
                              width: '100%',
                              height: '100%',
                              minHeight: '380px',
                              background: 'rgba(236, 72, 153, 0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--theme-music, #ec4899)',
                            }}>
                              <BookOpen size={48} style={{ opacity: 0.8 }} />
                            </div>
                          )}
                        </div>

                        <div className="exhibit-single-featured-content">
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                              <span style={{ fontSize: '0.8rem', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', padding: '0.25rem 0.75rem', borderRadius: '4px', border: '1px solid rgba(236, 72, 153, 0.3)', fontWeight: 500 }}>
                                {item.category || '個人聲音探索心得'}
                              </span>
                              {versionCount > 0 && (
                                <span style={{ fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                                  🎙️ {versionCount} 個演進版本
                                </span>
                              )}
                              {item.createdAt && (
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-noto-sans)' }}>
                                  📅 {formatTimestamp(item.createdAt)}
                                </span>
                              )}
                            </div>

                            <h3 style={{ color: '#fff', fontSize: 'clamp(1.5rem, 2.5vw, 1.95rem)', marginBottom: '1.2rem', fontFamily: 'var(--font-noto-serif)', lineHeight: 1.35, letterSpacing: '0.5px' }}>
                              {item.title}
                            </h3>

                            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.96rem', lineHeight: 1.8, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '1.5rem', fontFamily: 'var(--font-noto-serif)' }}>
                              {item.excerpt || cleanExcerpt(item.content)}
                            </p>
                          </div>

                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', color: '#f472b6', fontSize: '0.92rem', fontWeight: 600, letterSpacing: '0.5px', paddingTop: '1.2rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <span>{isVocal ? '進入多版本時間軸演進錄音' : '閱讀文章完整內容'}</span>
                            <ChevronRight size={18} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })()
            ) : (
              <div className="exhibit-items-grid" style={{ gap: '2.5rem' }}>
                {filteredWritingsItems.map((item, index) => {
                  let isVocal = item.category === '人聲優化課程' || item.category === '人聲優化歷程記錄';
                  let versionCount = 0;
                  let coverImage: string | null = null;
                  if (item.content) {
                    try {
                      const p = JSON.parse(item.content);
                      if (p) {
                        if (Array.isArray(p.versions)) versionCount = p.versions.length;
                        if (p.coverImage) coverImage = p.coverImage;
                      }
                    } catch {}
                  }

                  return (
                    <Link key={item.id} href={`/museum/${exhibit.id}/${item.id}`} style={{ textDecoration: 'none' }}>
                      <div className="glass-panel exhibit-card" style={{
                        padding: '0',
                        cursor: 'pointer',
                        color: exhibit.color,
                        animationDelay: `${index * 0.1}s`,
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        transition: 'all 0.4s ease'
                      }}>
                        {coverImage ? (
                          <div style={{
                            width: '100%',
                            height: '200px',
                            overflow: 'hidden',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            background: '#000',
                            position: 'relative'
                          }}>
                            <img
                              src={coverImage}
                              alt={item.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ) : (
                          <div style={{ 
                            width: '100%', 
                            height: '180px', 
                            background: 'rgba(236, 72, 153, 0.08)', 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--theme-music, #ec4899)',
                            fontSize: '0.8rem',
                            letterSpacing: '2px',
                            textTransform: 'uppercase',
                            borderBottom: '1px solid rgba(255,255,255,0.05)'
                          }}>
                            <BookOpen size={32} style={{ opacity: 0.8 }} />
                          </div>
                        )}
                        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', padding: '0.2rem 0.6rem', borderRadius: '2px', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
                              {item.category || '個人聲音探索心得'}
                            </span>
                            {versionCount > 0 && (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                                🎙️ {versionCount} 個演進版本
                              </span>
                            )}
                            {item.createdAt && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-noto-sans)' }}>
                                📅 {formatTimestamp(item.createdAt)}
                              </span>
                            )}
                          </div>
                          <h3 style={{ color: '#fff', fontSize: '1.35rem', marginBottom: '0.8rem', fontFamily: 'var(--font-noto-serif)', lineHeight: 1.4 }}>
                            {item.title}
                          </h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: 'auto', marginBottom: '1.2rem' }}>
                            {item.excerpt || cleanExcerpt(item.content)}
                          </p>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f472b6', fontSize: '0.85rem', fontWeight: 500 }}>
                            <span>{isVocal ? '進入多版本時間軸演進錄音' : '閱讀文章完整內容'}</span>
                            <ChevronRight size={16} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))
          ) : (exhibitId === 'sound' || (exhibitId === 'creation_lab' && activeSubCategory === '音樂')) ? (
            <>
              {/* 青春之歌計畫專屬 YouTube 頻道 Banner (精緻緊湊，聚焦展區內容) */}
              {activeSubCategory === '青春之歌計畫' && (
                <div 
                  className="glass-panel youth-songs-banner" 
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: '240px', flex: '1 1 auto' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(255, 0, 0, 0.16)',
                      border: '1px solid rgba(255, 0, 0, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ff4d4d',
                      boxShadow: '0 0 10px rgba(255, 0, 0, 0.25)',
                      flexShrink: 0
                    }}>
                      <YoutubeIcon size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ff6b6b', padding: '0.1rem 0.45rem', borderRadius: '3px', border: '1px solid rgba(239, 68, 68, 0.35)', letterSpacing: '0.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          YOUTUBE CHANNEL
                        </span>
                        <h3 style={{ fontSize: '1.02rem', color: '#fff', fontWeight: 600, fontFamily: 'var(--font-noto-serif)', margin: 0 }}>
                          {YOUTH_SONGS_YOUTUBE_CHANNEL.name}
                        </h3>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.15rem', margin: 0 }}>
                        {YOUTH_SONGS_YOUTUBE_CHANNEL.description}
                      </p>
                    </div>
                  </div>

                  <a
                    href={YOUTH_SONGS_YOUTUBE_CHANNEL.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.45rem 1rem',
                      borderRadius: '6px',
                      background: '#ff0000',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '0.84rem',
                      textDecoration: 'none',
                      boxShadow: '0 3px 10px rgba(255, 0, 0, 0.35)',
                      transition: 'all 0.25s ease',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 5px 15px rgba(255, 0, 0, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 3px 10px rgba(255, 0, 0, 0.35)';
                    }}
                  >
                    <YoutubeIcon size={16} />
                    <span>造訪 YouTube 頻道</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              )}

              {musicLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>音樂與聲音作品載入中...</div>
              ) : filteredMusicItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                  <p style={{ letterSpacing: '1px' }}>
                    {activeSubCategory
                      ? `目前【${activeSubCategory}】標籤下尚無作品。`
                      : '目前尚無音樂與聲音作品。'}
                  </p>
                </div>
              ) : (
                <div className="exhibit-items-grid" style={{ gap: '2rem' }}>
                  {filteredMusicItems.map((item) => {
                    const embedUrl = getYouTubeEmbedUrl(item.youtubeUrl);
                    return (
                      <div
                        key={item.id}
                        className="glass-panel exhibit-card"
                        style={{
                          padding: '0',
                          overflow: 'hidden',
                          color: exhibit.color,
                          display: 'flex',
                          flexDirection: 'column',
                          height: '100%',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        {/* 16:9 響應式 YouTube Player */}
                        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000' }}>
                          {embedUrl ? (
                            <iframe
                              src={embedUrl}
                              title={item.title}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                            />
                          ) : (
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              無效的影片網址
                            </div>
                          )}
                        </div>

                        {/* 卡片下半部文字資訊：固定顯示3行並以...截斷，點擊可展開完整內文 */}
                        <div
                          onClick={() => setSelectedMusicItem(item)}
                          style={{
                            padding: '1.25rem 1.6rem',
                            display: 'flex',
                            flexDirection: 'column',
                            flexGrow: 1,
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                          title="點擊查看完整內容與曲目故事"
                        >
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                            <span style={{ whiteSpace: 'nowrap' }}>{item.category || '音樂創作'}</span>
                            {item.createdAt && <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'none', whiteSpace: 'nowrap' }}>{formatTimestamp(item.createdAt)}</span>}
                          </div>
                          <h3 style={{ color: '#fff', fontSize: '1.2rem', fontFamily: 'var(--font-noto-serif)', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                            {item.title}
                          </h3>
                          {item.description && (
                            <p
                              style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.86rem',
                                lineHeight: 1.6,
                                marginTop: '0.2rem',
                                marginBottom: 'auto',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                wordBreak: 'break-word',
                              }}
                            >
                              {item.description}
                            </p>
                          )}

                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              color: '#ff6b6b',
                              fontSize: '0.82rem',
                              fontWeight: 500,
                              marginTop: '0.9rem',
                              paddingTop: '0.6rem',
                              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                              transition: 'color 0.2s ease',
                            }}
                          >
                            <span>閱讀完整內文</span>
                            <ChevronRight size={14} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : ['creation_lab', 'communication', 'finance_insurance', 'sound'].includes(exhibitId) ? (
            /* 小說子分類：專屬 2 欄大卡片展示版面 */
            activeSubCategory === '小說' ? (
              novelLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                  <BookOpen size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <p>小說作品載入中...</p>
                </div>
              ) : novelItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                  <BookOpen size={36} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <p style={{ letterSpacing: '1px' }}>目前尚無小說作品。</p>
                </div>
              ) : filteredNovelItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                  <BookOpen size={36} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <p style={{ letterSpacing: '1px' }}>沒有符合「{searchKeyword}」的小說作品。</p>
                </div>
              ) : filteredNovelItems.length === 1 ? (
              /* 單部小說精案卡：拉長且置中於下方空間，消除無謂空白 */
              (() => {
                const novel = filteredNovelItems[0];
                return (
                  <div className="exhibit-single-featured-container animate-fade-in">
                    <Link 
                      href={`/museum/creation_lab/novel/${encodeURIComponent(novel.title)}`}
                      style={{ textDecoration: 'none', width: '100%', maxWidth: '960px' }}
                    >
                      <div className="exhibit-single-featured-card" style={{ color: '#c084fc' }}>
                        <div className="exhibit-single-featured-cover">
                          {novel.coverUrl ? (
                            <img src={novel.coverUrl} alt={novel.title} />
                          ) : (
                            <div style={{
                              width: '100%',
                              height: '100%',
                              minHeight: '380px',
                              background: 'rgba(168, 85, 247, 0.08)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#c084fc',
                            }}>
                              <BookOpen size={48} style={{ opacity: 0.7, marginBottom: '0.5rem' }} />
                              <span style={{ fontSize: '0.8rem', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.7 }}>Novel</span>
                            </div>
                          )}
                          <div style={{ position: 'absolute', top: '1rem', left: '1rem', background: novel.status === '已完結' ? 'rgba(74,222,128,0.25)' : 'rgba(168,85,247,0.35)', backdropFilter: 'blur(8px)', border: `1px solid ${novel.status === '已完結' ? 'rgba(74,222,128,0.5)' : 'rgba(168,85,247,0.6)'}`, color: novel.status === '已完結' ? '#4ade80' : '#c084fc', padding: '0.3rem 0.8rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                            {novel.status === '連載中' ? '🟢' : novel.status === '已完結' ? '✅' : '⏸️'} {novel.status}
                          </div>
                          <div style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(56,189,248,0.25)', backdropFilter: 'blur(8px)', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8', padding: '0.3rem 0.8rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                            📚 共 {novel.totalChapters} 章
                          </div>
                        </div>

                        <div className="exhibit-single-featured-content">
                          <div>
                            <h3 style={{ color: '#fff', fontSize: 'clamp(1.6rem, 2.8vw, 2.1rem)', fontFamily: 'var(--font-noto-serif)', lineHeight: 1.3, marginBottom: '0.5rem', letterSpacing: '0.5px' }}>
                              《{novel.title}》
                            </h3>
                            <p style={{ color: 'rgba(192,132,252,0.9)', fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Sparkles size={14} style={{ flexShrink: 0 }} />
                              創作者：{novel.author}
                            </p>
                            {novel.description && (
                              <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.95rem', lineHeight: 1.75, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '1.2rem', fontFamily: 'var(--font-noto-serif)' }}>
                                {novel.description}
                              </p>
                            )}
                            {novel.latestChapterTitle && (
                              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '0.5rem 0.9rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <BookOpen size={14} style={{ flexShrink: 0 }} />
                                最新：{novel.latestChapterTitle}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', color: '#c084fc', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.5px', paddingTop: '1.2rem', borderTop: '1px solid rgba(168,85,247,0.2)' }}>
                            <BookOpen size={16} />
                            <span>📖 進入沉浸式閱讀器</span>
                            <ChevronRight size={18} style={{ marginLeft: 'auto' }} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })()
            ) : (
                <div className="novel-grid">
                  {filteredNovelItems.map((novel) => (
                    <Link
                      key={novel.id}
                      href={`/museum/creation_lab/novel/${encodeURIComponent(novel.title)}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <div
                        className="glass-panel exhibit-card"
                        style={{
                          padding: '0',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          height: '100%',
                          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                          border: '1px solid rgba(168,85,247,0.15)',
                        }}
                      >
                        {/* 封面大圖 */}
                        <div style={{ width: '100%', height: '220px', overflow: 'hidden', position: 'relative', background: 'rgba(168,85,247,0.06)', borderBottom: '1px solid rgba(168,85,247,0.12)' }}>
                          {novel.coverUrl ? (
                            <img src={novel.coverUrl} alt={novel.title} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(168,85,247,0.4)', background: 'linear-gradient(145deg, rgba(168,85,247,0.05) 0%, rgba(0,0,0,0.3) 100%)' }}>
                              <BookOpen size={48} style={{ marginBottom: '0.6rem', opacity: 0.6 }} />
                              <span style={{ fontSize: '0.8rem', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.6 }}>Novel</span>
                            </div>
                          )}
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }} />
                          <div style={{ position: 'absolute', top: '0.8rem', left: '0.8rem', background: novel.status === '已完結' ? 'rgba(74,222,128,0.2)' : 'rgba(168,85,247,0.3)', backdropFilter: 'blur(8px)', border: `1px solid ${novel.status === '已完結' ? 'rgba(74,222,128,0.5)' : 'rgba(168,85,247,0.6)'}`, color: novel.status === '已完結' ? '#4ade80' : '#c084fc', padding: '0.25rem 0.7rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                            {novel.status === '連載中' ? '🟢' : novel.status === '已完結' ? '✅' : '⏸️'} {novel.status}
                          </div>
                          <div style={{ position: 'absolute', top: '0.8rem', right: '0.8rem', background: 'rgba(56,189,248,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8', padding: '0.25rem 0.7rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                            📚 共 {novel.totalChapters} 章
                          </div>
                        </div>

                        {/* 卡片內容 */}
                        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                          <h3 style={{ color: '#fff', fontSize: '1.45rem', fontFamily: 'var(--font-noto-serif)', lineHeight: 1.3, marginBottom: '0.4rem', letterSpacing: '0.5px' }}>
                            《{novel.title}》
                          </h3>
                          <p style={{ color: 'rgba(192,132,252,0.85)', fontSize: '0.85rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Sparkles size={13} style={{ flexShrink: 0 }} />
                            創作者：{novel.author}
                          </p>
                          {novel.description && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '0.8rem', fontFamily: 'var(--font-noto-serif)' }}>
                              {novel.description}
                            </p>
                          )}
                          {novel.latestChapterTitle && (
                            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '0.45rem 0.8rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <BookOpen size={13} style={{ flexShrink: 0 }} />
                              最新：{novel.latestChapterTitle}
                            </div>
                          )}
                          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#c084fc', fontSize: '0.88rem', fontWeight: 600, letterSpacing: '0.5px', paddingTop: '0.8rem', borderTop: '1px solid rgba(168,85,247,0.15)' }}>
                            <BookOpen size={15} />
                            <span>📖 進入沉浸式閱讀器</span>
                            <ChevronRight size={15} style={{ marginLeft: 'auto' }} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            ) : writingsLoading ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>載入文章創作中...</div>
            ) : filteredWritingsItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                <p style={{ letterSpacing: '1px' }}>目前【{activeSubCategory === 'FB文章備份' ? '社群隨筆' : (activeSubCategory || exhibit.title)}】尚無文章。</p>
              </div>
            ) : filteredWritingsItems.length === 1 ? (
              /* 單篇精案卡：拉長且置中於下方空間，消除無謂空白 */
              (() => {
                const item = filteredWritingsItems[0];
                let coverImage: string | null = null;
                if (item.content) {
                  try {
                    const p = JSON.parse(item.content);
                    if (p && p.coverImage) coverImage = p.coverImage;
                  } catch {}
                }

                return (
                  <div className="exhibit-single-featured-container animate-fade-in">
                    <Link key={item.id} href={`/museum/${exhibit.id}/${item.id}`} style={{ textDecoration: 'none', width: '100%', maxWidth: '960px' }}>
                      <div className="exhibit-single-featured-card" style={{ color: exhibit.color }}>
                        <div className="exhibit-single-featured-cover">
                          {coverImage ? (
                            <img src={coverImage} alt={item.title} />
                          ) : (
                            <div style={{
                              width: '100%',
                              height: '100%',
                              minHeight: '380px',
                              background: 'rgba(255,255,255,0.03)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: exhibit.color,
                            }}>
                              <BookOpen size={48} style={{ opacity: 0.6 }} />
                            </div>
                          )}
                        </div>

                        <div className="exhibit-single-featured-content">
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <span style={{ 
                                  fontSize: '0.8rem', 
                                  background: item.category === '小說' ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.08)', 
                                  color: item.category === '小說' ? '#c084fc' : '#fff', 
                                  padding: '0.25rem 0.75rem', 
                                  borderRadius: '4px', 
                                  border: '1px solid rgba(255,255,255,0.15)', 
                                  fontWeight: 500 
                                }}>
                                  {item.category === '小說' ? '📖 小說連載' : (item.category === 'FB文章備份' ? '社群隨筆' : (item.category || exhibit.title))}
                                </span>
                                {item.isPinned && (
                                  <span style={{ fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '0.2rem 0.55rem', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.4)', fontWeight: 600 }}>
                                    📌 置頂
                                  </span>
                                )}
                              </div>
                              {item.createdAt && (
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-noto-sans)' }}>
                                  📅 {formatTimestamp(item.createdAt)}
                                </span>
                              )}
                            </div>

                            <h3 style={{ color: '#fff', fontSize: 'clamp(1.5rem, 2.5vw, 1.95rem)', marginBottom: '1rem', fontFamily: 'var(--font-noto-serif)', lineHeight: 1.35, letterSpacing: '0.5px' }}>
                              {item.title}
                            </h3>

                            {/* 標題下方標籤: 文章主題, FB 發布時間, FB 連結 */}
                            {(item.topic || item.fbDate || item.fbUrl) && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1.2rem' }}>
                                {item.topic && (
                                  <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.6rem', borderRadius: '3px' }}>
                                    📌 {item.topic}
                                  </span>
                                )}
                                {item.fbDate && (
                                  <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.04)', padding: '0.2rem 0.6rem', borderRadius: '3px' }}>
                                    📅 FB: {item.fbDate}
                                  </span>
                                )}
                                {item.fbUrl && (
                                  <span style={{ fontSize: '0.78rem', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '0.2rem 0.6rem', borderRadius: '3px' }}>
                                    🔗 FB 連結
                                  </span>
                                )}
                              </div>
                            )}

                            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.96rem', lineHeight: 1.8, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '1.5rem', fontFamily: 'var(--font-noto-serif)' }}>
                              {item.excerpt || cleanExcerpt(item.content)}
                            </p>
                          </div>

                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', color: exhibit.color, fontSize: '0.92rem', fontWeight: 600, letterSpacing: '0.5px', paddingTop: '1.2rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <span>閱讀文章完整內容</span>
                            <ChevronRight size={18} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })()
            ) : (
              <>
                <div className="exhibit-items-grid" style={{ gap: '1.8rem' }}>
                  {filteredWritingsItems.map((item) => {
                    let coverImage: string | null = null;
                    if (item.content) {
                      try {
                        const p = JSON.parse(item.content);

                        if (p && p.coverImage) {
                          coverImage = p.coverImage;
                        }
                      } catch {}
                    }

                    return (
                      <Link key={item.id} href={`/museum/${exhibit.id}/${item.id}`} style={{ textDecoration: 'none' }}>
                        <div 
                          className="glass-panel exhibit-card" 
                          style={{ 
                            padding: '0', 
                            color: exhibit.color, 
                            display: 'flex', 
                            flexDirection: 'column', 
                            height: '100%',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxSizing: 'border-box',
                            overflow: 'hidden'
                          }}
                        >
                          {/* 縮圖 Header */}
                          {coverImage ? (
                            <div style={{ 
                              width: '100%', 
                              height: '160px', 
                              overflow: 'hidden', 
                              borderBottom: '1px solid rgba(255,255,255,0.06)',
                              background: '#000',
                              position: 'relative'
                            }}>
                              <img
                                src={coverImage}
                                alt={item.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </div>
                          ) : (
                            <div style={{ 
                              width: '100%', 
                              height: '120px', 
                              background: 'rgba(255,255,255,0.03)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              color: exhibit.color, 
                              borderBottom: '1px solid rgba(255,255,255,0.06)' 
                            }}>
                              <BookOpen size={26} style={{ opacity: 0.7 }} />
                            </div>
                          )}

                        <div style={{ padding: '1.2rem 1.35rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                          {/* 頂部：標籤與時間 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', gap: '0.8rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                background: item.category === '小說' ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.15)', 
                                color: '#c084fc', 
                                padding: '0.2rem 0.65rem', 
                                borderRadius: '4px', 
                                border: '1px solid rgba(168,85,247,0.3)', 
                                whiteSpace: 'nowrap', 
                                fontWeight: 500 
                              }}>
                                {item.category === '小說' ? '📖 小說連載' : (item.category === 'FB文章備份' ? '社群隨筆' : (item.category || '社群隨筆'))}
                              </span>
                              {item.isPinned && (
                                <span style={{ 
                                  fontSize: '0.72rem', 
                                  background: 'rgba(56, 189, 248, 0.2)', 
                                  color: '#38bdf8', 
                                  padding: '0.15rem 0.5rem', 
                                  borderRadius: '4px', 
                                  border: '1px solid rgba(56, 189, 248, 0.4)', 
                                  whiteSpace: 'nowrap', 
                                  fontWeight: 600 
                                }}>
                                  📌 置頂
                                </span>
                              )}
                            </div>
                            {isCurator && item.createdAt && (
                              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
                                📅 {formatTimestamp(item.createdAt)}
                              </span>
                            )}
                          </div>

                          {/* 主標題 (為主軸，簡潔 2 行截斷) */}
                          <h3 style={{ 
                            color: '#fff', 
                            fontSize: '1.25rem', 
                            marginBottom: '0.6rem', 
                            fontFamily: 'var(--font-noto-serif)', 
                            lineHeight: 1.4, 
                            display: '-webkit-box', 
                            WebkitLineClamp: 2, 
                            WebkitBoxOrient: 'vertical', 
                            overflow: 'hidden', 
                            wordBreak: 'break-word', 
                            textWrap: 'balance' 
                          }}>
                            {item.title}
                          </h3>

                          {/* 標題下方標籤: 文章主題, FB 發布時間, FB 連結 */}
                          {(item.topic || item.fbDate || item.fbUrl || (item.category === '小說' && typeof item.order === 'number')) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginBottom: '0.8rem' }}>
                              {item.topic && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.5rem', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
                                  📌 {item.topic}
                                </span>
                              )}
                              {item.fbDate && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.5rem', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
                                  📅 FB: {item.fbDate}
                                </span>
                              )}
                              {item.fbUrl && (
                                <a 
                                  href={item.fbUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  onClick={(e) => e.stopPropagation()} 
                                  style={{ fontSize: '0.7rem', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '0.15rem 0.5rem', borderRadius: '3px', border: '1px solid rgba(56,189,248,0.25)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                                >
                                  🔗 FB 連結
                                </a>
                              )}
                            </div>
                          )}

                          {/* 內文摘要 (最多 3 行) */}
                          <p style={{ 
                            color: 'var(--text-secondary)', 
                            fontSize: '0.88rem', 
                            lineHeight: 1.6, 
                            display: '-webkit-box', 
                            WebkitLineClamp: 3, 
                            WebkitBoxOrient: 'vertical', 
                            overflow: 'hidden', 
                            wordBreak: 'break-word', 
                            textWrap: 'pretty',
                            marginBottom: '1.2rem',
                            marginTop: 'auto'
                          }}>
                            {cleanExcerpt(item.content)}
                          </p>

                          {/* 卡片底欄行動提示 */}
                          <div style={{ 
                            marginTop: 'auto', 
                            paddingTop: '0.65rem', 
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: exhibit.color, fontSize: '0.84rem', fontWeight: 500 }}>
                              <span>閱讀完整內容</span>
                              <ChevronRight size={15} />
                            </div>
                            {isCurator && (
                              <Link 
                                href="/admin" 
                                onClick={(e) => e.stopPropagation()} 
                                style={{ 
                                  fontSize: '0.72rem', 
                                  color: 'rgba(255,255,255,0.4)', 
                                  textDecoration: 'none', 
                                  background: 'rgba(255,255,255,0.05)', 
                                  padding: '0.15rem 0.55rem', 
                                  borderRadius: '2px' 
                                }}
                              >
                                [ 編輯 ]
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

                {/* 下面還有更多提示標語 */}
                {filteredWritingsItems.length > 2 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    marginTop: '3.5rem',
                    padding: '1.1rem 1.8rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    letterSpacing: '1px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px dashed rgba(255,255,255,0.15)',
                    borderRadius: '6px',
                    textAlign: 'center',
                  }}>
                    <ChevronDown size={18} style={{ color: exhibit.color }} />
                    <span>👇 下面還有更多展品文章（往下捲動瀏覽更多內容）</span>
                    <ChevronDown size={18} style={{ color: exhibit.color }} />
                  </div>
                )}
              </>
            )
          ) : (
            <div style={{ textAlign: 'center', padding: '6rem 2rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <p style={{ letterSpacing: '2px', textTransform: 'uppercase', fontSize: '0.9rem' }}>No exhibits found matching your criteria</p>
            </div>
          )}
        </div>
      )}

      {/* 青春之歌 / 音樂作品 完整內文彈出視窗 (Modal) */}
      {selectedMusicItem && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => setSelectedMusicItem(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#0f141c',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.15)',
              overflow: 'hidden',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.2rem 1.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#ff6b6b',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    letterSpacing: '1px',
                    fontWeight: 600,
                  }}
                >
                  {selectedMusicItem.category || '青春之歌計畫'}
                </span>
                {selectedMusicItem.createdAt && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {formatTimestamp(selectedMusicItem.createdAt)}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedMusicItem(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#aaa',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#aaa';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                }}
                aria-label="關閉視窗"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
              {/* Video Player in Modal */}
              <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '1.25rem' }}>
                {getYouTubeEmbedUrl(selectedMusicItem.youtubeUrl) ? (
                  <iframe
                    src={getYouTubeEmbedUrl(selectedMusicItem.youtubeUrl)!}
                    title={selectedMusicItem.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  />
                ) : (
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    無效的影片網址
                  </div>
                )}
              </div>

              <h2 style={{ fontSize: '1.35rem', color: '#fff', fontFamily: 'var(--font-noto-serif)', marginBottom: '1rem', lineHeight: 1.4 }}>
                {selectedMusicItem.title}
              </h2>

              {selectedMusicItem.description && (
                <div
                  style={{
                    color: 'rgba(255, 255, 255, 0.88)',
                    fontSize: '0.95rem',
                    lineHeight: 1.8,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'var(--font-noto-sans)',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    wordBreak: 'break-word',
                  }}
                >
                  {selectedMusicItem.description}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '0.9rem 1.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              {selectedMusicItem.youtubeUrl && (
                <a
                  href={selectedMusicItem.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: '#ff4d4d',
                    fontSize: '0.85rem',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  <YoutubeIcon size={16} />
                  <span>在 YouTube 上觀看完整影片</span>
                  <ExternalLink size={13} />
                </a>
              )}
              <button
                onClick={() => setSelectedMusicItem(null)}
                style={{
                  padding: '0.45rem 1.2rem',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  marginLeft: 'auto'
                }}
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
