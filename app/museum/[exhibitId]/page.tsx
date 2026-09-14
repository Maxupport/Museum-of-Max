'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Calendar, Briefcase, ChevronRight, ChevronDown, BookOpen, TrendingUp, Building, ExternalLink, Sparkles, Mail, Image as ImageIcon, Building2 } from 'lucide-react';
import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { EXHIBITS, YOUTH_SONGS_YOUTUBE_CHANNEL } from '@/lib/constants';
import { MOCK_NOVELS } from '@/utils/notionNovels';
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

  // Writings Items state (for creation_lab FB文章備份 subcategory)
  const [writingsItems, setWritingsItems] = useState<WritingsItem[]>([]);
  const [writingsLoading, setWritingsLoading] = useState(false);

  useEffect(() => {
    const isBlogExhibit = ['finance_insurance', 'sound', 'creation_lab', 'communication'].includes(exhibitId);
    if (isBlogExhibit) {
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
    <div style={{ padding: '4rem 2rem', maxWidth: '1400px', margin: '0 auto', minHeight: '100vh' }}>
      {/* 返回展覽大廳按鈕 (若為小說直通讀者則不顯示) */}
      {!isNovelDirect && (
        <button 
          onClick={() => router.push('/museum')}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-secondary)', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '4rem',
            fontSize: '0.9rem',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            transition: 'color 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <ArrowLeft size={16} />
          Return to Exhibition Hall
        </button>
      )}

      {/* 展區標題 */}
      <header className="animate-fade-in" style={{ marginBottom: '3.5rem', display: 'flex', alignItems: 'flex-start', gap: '2rem' }}>
        <div style={{ 
          width: '3px', 
          height: '90px', 
          background: exhibit.color, 
          boxShadow: `0 0 15px ${exhibit.color}` 
        }} />
        <div>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 300, color: '#fff', marginBottom: '0.5rem', fontFamily: 'var(--font-noto-serif)', lineHeight: 1.1 }}>
            {exhibit.title}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', letterSpacing: '4px', textTransform: 'uppercase' }}>
            {exhibit.subtitle}
          </p>
        </div>
      </header>

      {/* 子區塊頁籤選單 (Subcategory Filter Tabs) */}
      {exhibit.subcategories.length > 0 && (
        <div 
          className="animate-fade-in" 
          style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '1rem', 
            marginBottom: '3.5rem' 
          }}
        >
          {exhibit.subcategories.map((subCat) => {
            const isActive = activeSubCategory === subCat;
            return (
              <button
                key={subCat}
                onClick={() => {
                  setActiveSubCategory(subCat);
                  setSearchKeyword(''); 
                }}
                style={{
                  padding: '0.8rem 2rem',
                  border: '1px solid',
                  borderColor: isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.1)',
                  background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.95rem',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontFamily: 'var(--font-noto-sans)',
                  borderRadius: '2px',
                  boxShadow: isActive ? `inset 0 -2px 0 ${exhibit.color}, 0 5px 15px rgba(0,0,0,0.5)` : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {subCat}
              </button>
            );
          })}
        </div>
      )}

      {/* 展區內容區域 */}
      {exhibitId === 'vc' ? (
        /* 風險投資 (VC Projects) 後台即時卡片展示 (不連結 Notion) */
        <div className="animate-fade-in" style={{ padding: '2rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', flexWrap: 'wrap', gap: '2rem' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                PORTFOLIO PROJECTS ({activeSubCategory})
              </div>
              <h2 style={{ fontSize: '2rem', color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
                {activeSubCategory}
              </h2>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
              <a
                href="mailto:maxupport@gmail.com?subject=【風險投資/FA諮詢】來自網站的合作與項目提案"
                className="museum-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1.2rem',
                  fontSize: '0.88rem',
                  background: 'rgba(56, 189, 248, 0.12)',
                  borderColor: 'rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  transition: 'all 0.3s ease'
                }}
              >
                <Mail size={16} />
                <span>Email 聯絡策展人</span>
              </a>

              <div style={{ position: 'relative', width: '100%', maxWidth: '260px' }}>
                <Search size={18} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                  type="text" 
                  placeholder="Search venture projects..." 
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="museum-input"
                  style={{
                    paddingLeft: '3rem',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '0',
                    background: 'rgba(255,255,255,0.02)'
                  }}
                />
              </div>
            </div>
          </div>

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
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '2rem'
            }}>
              {filteredVentureItems.map((item) => {
                const isCenteredLogo = ['早期投資', '早期投資項目', '新創項目評估', '創投項目評估', '募資 FA 服務', '募資FA服務'].includes(item.category) || true;

                const CardContent = (
                  <div className="glass-panel exhibit-card" style={{ padding: '2rem', color: exhibit.color, display: 'flex', flexDirection: 'column', height: '100%', cursor: item.linkUrl ? 'pointer' : 'default' }}>
                    {isCenteredLogo ? (
                      /* 早期投資 & 新創項目評估：Logo 置中大圖呈現 */
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.2rem' }}>
                        {item.logoUrl ? (
                          <img
                            src={item.logoUrl}
                            alt={item.title}
                            style={{
                              width: '96px',
                              height: '96px',
                              objectFit: 'contain',
                              borderRadius: '12px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              padding: '0.6rem',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                              marginBottom: '1rem',
                              transition: 'transform 0.3s ease',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '96px',
                              height: '96px',
                              borderRadius: '12px',
                              background: 'rgba(56, 189, 248, 0.08)',
                              border: '1.5px dashed rgba(56, 189, 248, 0.35)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#38bdf8',
                              marginBottom: '1rem',
                              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                            }}
                          >
                            <Building size={36} style={{ opacity: 0.9, marginBottom: '2px' }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 600, opacity: 0.8, letterSpacing: '1px' }}>LOGO</span>
                          </div>
                        )}

                        <div style={{ width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1.5rem', color: '#fff', fontFamily: 'var(--font-noto-serif)', margin: 0, wordBreak: 'break-word', overflowWrap: 'break-word', textWrap: 'balance' }}>
                              {item.title}
                            </h3>
                            {item.linkUrl && <ExternalLink size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                            <Calendar size={13} />
                            {item.period}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* 其他分類：原有橫向圖標排列 */
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
                        {item.logoUrl ? (
                          <img src={item.logoUrl} alt={item.title} style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', padding: '0.2rem' }} />
                        ) : (
                          <div style={{ width: '48px', height: '48px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                            <Building size={24} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                            <h3 style={{ fontSize: '1.5rem', color: '#fff', fontFamily: 'var(--font-noto-serif)', marginBottom: '0.2rem', wordBreak: 'break-word', overflowWrap: 'break-word', textWrap: 'balance' }}>
                              {item.title}
                            </h3>
                            {item.linkUrl && <ExternalLink size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Calendar size={12} />
                            {item.period}
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', color: '#38bdf8', padding: '0.6rem 1rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8', flexShrink: 0 }} />
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
              marginTop: '4.5rem',
              marginBottom: '2rem',
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
        <div className="animate-fade-in" style={{ padding: '2rem 0' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '3rem' }}>
            Career Timeline & Milestones
          </div>

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
              {careerItems.map((item) => (
                <div key={item.id} style={{ position: 'relative', marginBottom: '3.5rem' }}>
                  <div style={{
                    position: 'absolute',
                    left: '-2.6rem',
                    top: '0.3rem',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: exhibit.color,
                    boxShadow: `0 0 10px ${exhibit.color}`
                  }} />

                  <div className="glass-panel exhibit-card" style={{ padding: '2rem', color: exhibit.color }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.2rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem' }}>
                        {item.logoUrl ? (
                          <img
                            src={item.logoUrl}
                            alt={`${item.company} Logo`}
                            style={{
                              width: '76px',
                              height: '76px',
                              objectFit: 'contain',
                              background: 'rgba(255, 255, 255, 0.08)',
                              borderRadius: '12px',
                              padding: '0.5rem',
                              border: '1.5px solid rgba(245, 158, 11, 0.35)',
                              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            title="Company Logo 預留位置"
                            style={{
                              width: '76px',
                              height: '76px',
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
                            <Building2 size={28} style={{ opacity: 0.9, marginBottom: '3px' }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 600, opacity: 0.9, letterSpacing: '1px' }}>LOGO</span>
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h2 style={{ fontSize: '1.8rem', color: '#fff', fontFamily: 'var(--font-noto-serif)', marginBottom: '0.3rem', wordBreak: 'break-word', overflowWrap: 'break-word', textWrap: 'balance' }}>
                            {item.company}
                          </h2>
                          <h3 style={{ fontSize: '1.1rem', color: 'var(--theme-career)', fontWeight: 400, wordBreak: 'break-word', overflowWrap: 'break-word', textWrap: 'balance' }}>
                            {item.role}
                          </h3>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <Calendar size={14} />
                          {item.period}
                        </div>
                        {item.createdAt && (
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                            {formatTimestamp(item.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 兩張照片空間之二：個人工作照 / 現場照片 (Work Photo) */}
                    {item.photoUrl ? (
                      <div
                        style={{
                          margin: '1.2rem auto',
                          maxWidth: '520px',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          background: 'rgba(0, 0, 0, 0.45)',
                          padding: '0.4rem',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                        }}
                      >
                        <img
                          src={item.photoUrl}
                          alt={`${item.company} 工作現場照片`}
                          style={{
                            width: '100%',
                            maxHeight: '260px',
                            objectFit: 'contain',
                            borderRadius: '8px',
                            display: 'block',
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          margin: '1.2rem auto',
                          maxWidth: '520px',
                          padding: '1.8rem 1rem',
                          borderRadius: '12px',
                          border: '2px dashed rgba(245, 158, 11, 0.35)',
                          background: 'rgba(245, 158, 11, 0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          color: 'rgba(245, 158, 11, 0.85)',
                          textAlign: 'center',
                        }}
                      >
                        <ImageIcon size={28} style={{ opacity: 0.75 }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, letterSpacing: '1px' }}>
                          📷 【工作現場 / 團體照片 預留位置】
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                          工作現場與團體照片專屬展示區塊
                        </span>
                      </div>
                    )}

                    {item.description && (
                      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem', lineHeight: 1.7, whiteSpace: 'pre-line', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginTop: '1rem', wordBreak: 'break-word', overflowWrap: 'break-word', textWrap: 'pretty' }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 部落格型展區 (卡片清單與 Notion Blog 文章入口) */
        <div 
          className="animate-fade-in" 
          style={{ 
            padding: '2rem 0',
            borderTop: `1px solid rgba(255,255,255,0.1)`,
            position: 'relative'
          }}
        >
          {/* LED 亮線裝飾 */}
          <div style={{
            position: 'absolute',
            top: '-1px',
            left: 0,
            width: '200px',
            height: '1px',
            background: exhibit.color,
            boxShadow: `0 0 10px ${exhibit.color}, 0 0 20px ${exhibit.color}`
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', flexWrap: 'wrap', gap: '2rem' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                SECTION CONTENT
              </div>
              <h2 style={{ fontSize: '2rem', color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
                {activeSubCategory || exhibit.title}
              </h2>
            </div>
            
            <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
              <Search size={18} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="text" 
                placeholder="Search in this section..." 
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="museum-input"
                style={{
                  paddingLeft: '3rem',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '0',
                  background: 'rgba(255,255,255,0.02)'
                }}
              />
            </div>
          </div>
          
          {/* 個人聲音探索心得 / 人聲優化歷程記錄 (文章卡片與時間軸架構) 或 音樂與聲音探尋 YouTube 影片嵌入網格 */}
          {(exhibitId === 'sound' && (activeSubCategory === '個人聲音探索心得' || activeSubCategory === '人聲優化歷程記錄' || activeSubCategory === '人聲優化課程')) ? (
            writingsLoading ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>載入文章與歷程記錄中...</div>
            ) : filteredWritingsItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                <p style={{ letterSpacing: '1px' }}>目前【{activeSubCategory}】尚無作品。</p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '2.5rem'
              }}>
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
            )
          ) : (exhibitId === 'sound' || (exhibitId === 'creation_lab' && activeSubCategory === '音樂')) ? (
            <>
              {/* 青春之歌計畫專屬 YouTube 頻道 Banner */}
              {activeSubCategory === '青春之歌計畫' && (
                <div 
                  className="glass-panel" 
                  style={{ 
                    marginBottom: '2.5rem', 
                    padding: '1.8rem 2.2rem', 
                    borderRadius: '8px', 
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    boxShadow: '0 8px 32px rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '12px',
                      background: 'rgba(255, 0, 0, 0.18)',
                      border: '1px solid rgba(255, 0, 0, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ff4d4d',
                      boxShadow: '0 0 20px rgba(255, 0, 0, 0.3)',
                      flexShrink: 0
                    }}>
                      <YoutubeIcon size={28} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ff6b6b', padding: '0.15rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.4)', letterSpacing: '1px' }}>
                          YOUTUBE CHANNEL
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 600, fontFamily: 'var(--font-noto-serif)', margin: 0 }}>
                        {YOUTH_SONGS_YOUTUBE_CHANNEL.name}
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem', margin: 0 }}>
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
                      gap: '0.6rem',
                      padding: '0.75rem 1.6rem',
                      borderRadius: '6px',
                      background: '#ff0000',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '0.92rem',
                      textDecoration: 'none',
                      boxShadow: '0 4px 15px rgba(255, 0, 0, 0.4)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 0, 0, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 0, 0, 0.4)';
                    }}
                  >
                    <YoutubeIcon size={18} />
                    <span>造訪 YouTube 頻道</span>
                    <ExternalLink size={15} />
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '2.5rem' }}>
                  {filteredMusicItems.map((item) => {
                    const embedUrl = getYouTubeEmbedUrl(item.youtubeUrl);
                    return (
                      <div key={item.id} className="glass-panel exhibit-card" style={{ padding: '0', overflow: 'hidden', color: exhibit.color, display: 'flex', flexDirection: 'column' }}>
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

                        <div style={{ padding: '1.5rem 1.8rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{item.category || '音樂創作'}</span>
                            {item.createdAt && <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'none' }}>{formatTimestamp(item.createdAt)}</span>}
                          </div>
                          <h3 style={{ color: '#fff', fontSize: '1.25rem', fontFamily: 'var(--font-noto-serif)', marginBottom: '0.6rem', lineHeight: 1.4 }}>
                            {item.title}
                          </h3>
                          {item.description && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginTop: 'auto' }}>
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : exhibitId === 'creation_lab' && (activeSubCategory === '小說' || activeSubCategory === '文字') ? (
            Object.values(MOCK_NOVELS).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                <p style={{ letterSpacing: '1px' }}>目前【小說專區】尚無上架作品。</p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '2.5rem'
              }}>
                {Object.values(MOCK_NOVELS).map((novel) => (
                  <Link key={novel.id} href={`/museum/creation_lab/novel/${novel.id}`} style={{ textDecoration: 'none' }}>
                    <div className="glass-panel exhibit-card" style={{
                      padding: '2.2rem',
                      cursor: 'pointer',
                      color: exhibit.color,
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      transition: 'all 0.4s ease',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.08)', color: 'var(--theme-possibility)', padding: '0.2rem 0.6rem', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
                          小說連載專區
                        </span>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', padding: '0.2rem 0.6rem', borderRadius: '2px' }}>
                          {novel.status} ({novel.totalChapters} 章)
                        </span>
                      </div>

                      <h3 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '0.4rem', fontFamily: 'var(--font-noto-serif)', lineHeight: 1.3 }}>
                        {novel.title}
                      </h3>
                      
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.2rem', fontFamily: 'var(--font-noto-sans)' }}>
                        作者：{novel.author} | 最新更新：{novel.latestUpdate}
                      </p>

                      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                        {novel.description}
                      </p>

                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>
                        <Sparkles size={16} color="var(--theme-possibility)" />
                        <span>進入沉浸式小說閱讀器</span>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : ['creation_lab', 'communication', 'finance_insurance', 'sound'].includes(exhibitId) ? (
            writingsLoading ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>載入文章創作中...</div>
            ) : filteredWritingsItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                <p style={{ letterSpacing: '1px' }}>目前【{activeSubCategory === 'FB文章備份' ? '社群隨筆' : (activeSubCategory || exhibit.title)}】尚無文章。</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.8rem' }}>
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
                              height: '180px', 
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
                              height: '135px', 
                              background: 'rgba(255,255,255,0.03)', 
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: exhibit.color,
                              borderBottom: '1px solid rgba(255,255,255,0.06)'
                            }}>
                              <BookOpen size={30} style={{ opacity: 0.7 }} />
                            </div>
                          )}

                        <div style={{ padding: '1.5rem 1.6rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                          {/* 頂部：標籤與時間 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', gap: '0.8rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                background: 'rgba(168,85,247,0.15)', 
                                color: '#c084fc', 
                                padding: '0.2rem 0.65rem', 
                                borderRadius: '4px', 
                                border: '1px solid rgba(168,85,247,0.3)',
                                whiteSpace: 'nowrap',
                                fontWeight: 500
                              }}>
                                {item.category === 'FB文章備份' ? '社群隨筆' : (item.category || '社群隨筆')}
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
                          {(item.topic || item.fbDate || item.fbUrl) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginBottom: '0.8rem' }}>
                              {item.topic && (
                                <span style={{ 
                                  fontSize: '0.73rem', 
                                  background: 'rgba(168,85,247,0.15)', 
                                  color: '#c084fc', 
                                  border: '1px solid rgba(168,85,247,0.3)', 
                                  padding: '0.15rem 0.55rem', 
                                  borderRadius: '4px', 
                                  whiteSpace: 'nowrap'
                                }}>
                                  📌 {item.topic}
                                </span>
                              )}
                              {item.fbDate && (
                                <span style={{ 
                                  fontSize: '0.73rem', 
                                  background: 'rgba(255,255,255,0.06)', 
                                  color: 'var(--text-secondary)', 
                                  border: '1px solid rgba(255,255,255,0.12)', 
                                  padding: '0.15rem 0.55rem', 
                                  borderRadius: '4px', 
                                  whiteSpace: 'nowrap'
                                }}>
                                  📅 FB：{item.fbDate}
                                </span>
                              )}
                              {item.fbUrl && (
                                <a
                                  href={item.fbUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ 
                                    fontSize: '0.73rem', 
                                    background: 'rgba(59,130,246,0.15)', 
                                    color: '#60a5fa', 
                                    border: '1px solid rgba(59,130,246,0.3)', 
                                    padding: '0.15rem 0.55rem', 
                                    borderRadius: '4px', 
                                    textDecoration: 'none', 
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  🔗 FB 連結
                                </a>
                              )}
                            </div>
                          )}

                          {/* 很短摘要 (精簡 2 行預覽) */}
                          <p style={{ 
                            color: 'var(--text-secondary)', 
                            fontSize: '0.86rem', 
                            lineHeight: 1.6, 
                            display: '-webkit-box', 
                            WebkitLineClamp: 2, 
                            WebkitBoxOrient: 'vertical', 
                            overflow: 'hidden', 
                            marginTop: 'auto',
                            marginBottom: '1.2rem' 
                          }}>
                            {item.excerpt || cleanExcerpt(item.content)}
                          </p>

                          {/* 卡片底欄行動提示 */}
                          <div style={{ 
                            marginTop: 'auto', 
                            paddingTop: '0.8rem', 
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

    </div>
  );
}
