'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Key, BarChart3, LogOut, Plus, Trash2, Shield, Eye, RefreshCw, CheckSquare, Square, Briefcase, TrendingUp, Edit3, X, Upload, Mail, Send, Music } from 'lucide-react';
import { EXHIBIT_MAP, ALL_EXHIBIT_KEYS, PASSCODE_PERM_KEYS } from '@/lib/constants';

interface PasscodeItem {
  id: string;
  code: string;
  note: string | null;
  permissions: string[];
  createdAt: string;
  pageviewCount: number;
}

interface StatData {
  totalPageviews: number;
  exhibitStats: { exhibitId: string; count: number }[];
  recentViews: {
    id: string;
    exhibitId: string;
    createdAt: string;
    passcode: { code: string; note: string | null } | null;
  }[];
}

interface CareerItemData {
  id: string;
  company: string;
  role: string;
  period: string;
  description: string;
  logoUrl?: string | null;
  photoUrl?: string | null;
  order: number;
  createdAt: string;
}

interface VentureItemData {
  id: string;
  category: string;
  title: string;
  logoUrl: string | null;
  period: string;
  status: string;
  description: string | null;
  linkUrl: string | null;
  order: number;
  createdAt: string;
}

interface MusicItemData {
  id: string;
  category: string;
  title: string;
  youtubeUrl: string;
  description: string | null;
  order: number;
}

interface WritingsItemData {
  id: string;
  title: string;
  category: string;
  excerpt: string | null;
  content: string;
  order: number;
}

const VENTURE_CATEGORIES = ['早期投資', '新創項目評估', '募資 FA 服務'];

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'passcodes' | 'venture' | 'career' | 'stats' | 'subscribers' | 'music' | 'writings'>('passcodes');

  // Passcodes state
  const [passcodes, setPasscodes] = useState<PasscodeItem[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newPermissions, setNewPermissions] = useState<string[]>(ALL_EXHIBIT_KEYS);
  const [creatingPasscode, setCreatingPasscode] = useState(false);
  const [passcodeFormError, setPasscodeFormError] = useState('');

  // Venture state
  const [ventureItems, setVentureItems] = useState<VentureItemData[]>([]);
  const [vCategory, setVCategory] = useState(VENTURE_CATEGORIES[0]);
  const [vTitle, setVTitle] = useState('');
  const [vLogoUrl, setVLogoUrl] = useState('');
  const [vPeriod, setVPeriod] = useState('');
  const [vStatus, setVStatus] = useState('');
  const [vDescription, setVDescription] = useState('');
  const [vLinkUrl, setVLinkUrl] = useState('');
  const [vOrder, setVOrder] = useState(0);
  const [creatingVenture, setCreatingVenture] = useState(false);
  const [ventureFormError, setVentureFormError] = useState('');
  const [editingVentureId, setEditingVentureId] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.ok && data.url) {
        setVLogoUrl(data.url);
      } else {
        alert(data.error || '圖片上傳失敗');
      }
    } catch {
      alert('上傳時發生連線錯誤');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Career state
  const [careerItems, setCareerItems] = useState<CareerItemData[]>([]);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [period, setPeriod] = useState('');
  const [description, setDescription] = useState('');
  const [cLogoUrl, setCLogoUrl] = useState('');
  const [cPhotoUrl, setCPhotoUrl] = useState('');
  const [uploadingCLogo, setUploadingCLogo] = useState(false);
  const [uploadingCPhoto, setUploadingCPhoto] = useState(false);
  const [order, setOrder] = useState(0);
  const [creatingCareer, setCreatingCareer] = useState(false);
  const [careerFormError, setCareerFormError] = useState('');
  const [editingCareerId, setEditingCareerId] = useState<string | null>(null);

  // Stats state
  const [stats, setStats] = useState<StatData | null>(null);

  // Subscribers state
  interface SubscriberItem {
    id: string;
    email: string;
    name?: string;
    novelId: string;
    active: boolean;
    createdAt: string;
  }
  const [subscribers, setSubscribers] = useState<SubscriberItem[]>([]);
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);

  // Dispatch Newsletter state
  const [dispatchNovelTitle, setDispatchNovelTitle] = useState('AI 小說共創實錄');
  const [dispatchChapterTitle, setDispatchChapterTitle] = useState('');
  const [dispatchSummary, setDispatchSummary] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState('');

  const fetchSubscribers = useCallback(async () => {
    setLoadingSubscribers(true);
    try {
      const res = await fetch('/api/subscribe');
      const data = await res.json();
      if (data.ok) {
        setSubscribers(data.data);
        setSubscribersCount(data.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSubscribers(false);
    }
  }, []);

  const handleDeleteSubscriber = async (id: string) => {
    if (!confirm('確定要移除此訂閱者？')) return;
    try {
      const res = await fetch(`/api/subscribe/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        fetchSubscribers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDispatchNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchChapterTitle.trim()) {
      alert('請輸入更新章節名稱');
      return;
    }
    setDispatching(true);
    setDispatchMessage('');
    try {
      const res = await fetch('/api/newsletter/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novelTitle: dispatchNovelTitle,
          chapterTitle: dispatchChapterTitle,
          summary: dispatchSummary,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDispatchMessage(data.message);
        setDispatchChapterTitle('');
        setDispatchSummary('');
        fetchSubscribers();
      } else {
        alert(data.error || '發送失敗');
      }
    } catch {
      alert('發送失敗');
    } finally {
      setDispatching(false);
    }
  };

  // Music state
  const [musicItems, setMusicItems] = useState<MusicItemData[]>([]);
  const [mCategory, setMCategory] = useState('音樂');
  const [mTitle, setMTitle] = useState('');
  const [mYoutubeUrl, setMYoutubeUrl] = useState('');
  const [mDescription, setMDescription] = useState('');
  const [mOrder, setMOrder] = useState(0);
  const [creatingMusic, setCreatingMusic] = useState(false);
  const [musicFormError, setMusicFormError] = useState('');

  const fetchMusicItems = useCallback(async () => {
    try {
      const res = await fetch('/api/music');
      const data = await res.json();
      if (data.ok) setMusicItems(data.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleCreateMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    setMusicFormError('');
    if (!mTitle.trim() || !mYoutubeUrl.trim()) {
      setMusicFormError('請輸入曲目標題與 YouTube 網址');
      return;
    }
    setCreatingMusic(true);
    try {
      const res = await fetch('/api/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: mCategory,
          title: mTitle,
          youtubeUrl: mYoutubeUrl,
          description: mDescription,
          order: mOrder,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMTitle('');
        setMYoutubeUrl('');
        setMDescription('');
        setMOrder(0);
        fetchMusicItems();
      } else {
        setMusicFormError(data.error || '新增失敗');
      }
    } catch {
      setMusicFormError('連線錯誤');
    } finally {
      setCreatingMusic(false);
    }
  };

  const handleDeleteMusic = async (id: string) => {
    if (!confirm('確定要刪除此音樂創作？')) return;
    try {
      const res = await fetch(`/api/music/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) fetchMusicItems();
    } catch (e) {
      console.error(e);
    }
  };

  // Writings state
  const [writingsItems, setWritingsItems] = useState<WritingsItemData[]>([]);
  const [wTitle, setWTitle] = useState('');
  const [wCategory, setWCategory] = useState('其他文字');
  const [wExcerpt, setWExcerpt] = useState('');
  const [wContent, setWContent] = useState('');
  const [wOrder, setWOrder] = useState(0);
  const [editingWritingId, setEditingWritingId] = useState<string | null>(null);
  const [creatingWriting, setCreatingWriting] = useState(false);
  const [writingFormError, setWritingFormError] = useState('');

  const fetchWritingsItems = useCallback(async () => {
    try {
      const res = await fetch('/api/writings');
      const data = await res.json();
      if (data.ok) setWritingsItems(data.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleCreateOrUpdateWriting = async (e: React.FormEvent) => {
    e.preventDefault();
    setWritingFormError('');
    if (!wTitle.trim() || !wContent.trim()) {
      setWritingFormError('請輸入文章標題與內文');
      return;
    }
    setCreatingWriting(true);
    try {
      const url = editingWritingId ? `/api/writings/${editingWritingId}` : '/api/writings';
      const method = editingWritingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: wTitle,
          category: wCategory,
          excerpt: wExcerpt,
          content: wContent,
          order: wOrder,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setWTitle('');
        setWCategory('其他文字');
        setWExcerpt('');
        setWContent('');
        setWOrder(0);
        setEditingWritingId(null);
        fetchWritingsItems();
      } else {
        setWritingFormError(data.error || '儲存失敗');
      }
    } catch {
      setWritingFormError('連線錯誤');
    } finally {
      setCreatingWriting(false);
    }
  };

  const handleEditWriting = (item: WritingsItemData) => {
    setEditingWritingId(item.id);
    setWTitle(item.title);
    setWCategory(item.category || '其他文字');
    setWExcerpt(item.excerpt || '');
    setWContent(item.content);
    setWOrder(item.order);
  };

  const handleDeleteWriting = async (id: string) => {
    if (!confirm('確定要刪除此文章創作？')) return;
    try {
      const res = await fetch(`/api/writings/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) fetchWritingsItems();
    } catch (e) {
      console.error(e);
    }
  };

  const router = useRouter();

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/admin');
      const data = await res.json();
      if (data.authenticated) {
        setAuthenticated(true);
      } else {
        router.push('/');
      }
    } catch {
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchPasscodes = useCallback(async () => {
    try {
      const res = await fetch('/api/passcodes');
      const data = await res.json();
      if (data.ok) setPasscodes(data.data);
    } catch (err) {
      console.error('Failed to fetch passcodes', err);
    }
  }, []);

  const fetchVentureItems = useCallback(async () => {
    try {
      const res = await fetch('/api/venture');
      const data = await res.json();
      if (data.ok) setVentureItems(data.data);
    } catch (err) {
      console.error('Failed to fetch venture items', err);
    }
  }, []);

  const fetchCareerItems = useCallback(async () => {
    try {
      const res = await fetch('/api/career');
      const data = await res.json();
      if (data.ok) setCareerItems(data.data);
    } catch (err) {
      console.error('Failed to fetch career items', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.ok) setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authenticated) {
      if (activeTab === 'passcodes') fetchPasscodes();
      if (activeTab === 'venture') fetchVentureItems();
      if (activeTab === 'career') fetchCareerItems();
      if (activeTab === 'stats') fetchStats();
      if (activeTab === 'subscribers') fetchSubscribers();
      if (activeTab === 'music') fetchMusicItems();
      if (activeTab === 'writings') fetchWritingsItems();
    }
  }, [authenticated, activeTab, fetchPasscodes, fetchVentureItems, fetchCareerItems, fetchStats, fetchSubscribers, fetchMusicItems, fetchWritingsItems]);

  const handleLogout = async () => {
    await fetch('/api/auth/admin', { method: 'DELETE' });
    window.location.href = '/admin/login';
  };

  const handleTogglePermission = (key: string) => {
    if (newPermissions.includes(key)) {
      setNewPermissions(newPermissions.filter((k) => k !== key));
    } else {
      setNewPermissions([...newPermissions, key]);
    }
  };

  const handleSelectAllPerms = () => {
    if (newPermissions.length === ALL_EXHIBIT_KEYS.length) {
      setNewPermissions([]);
    } else {
      setNewPermissions(ALL_EXHIBIT_KEYS);
    }
  };

  const handleCreatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeFormError('');

    if (!newCode.trim()) {
      setPasscodeFormError('請輸入通行密碼');
      return;
    }

    setCreatingPasscode(true);
    try {
      const res = await fetch('/api/passcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode,
          note: newNote,
          permissions: newPermissions,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setNewCode('');
        setNewNote('');
        setNewPermissions(ALL_EXHIBIT_KEYS);
        fetchPasscodes();
      } else {
        setPasscodeFormError(data.error || '新增失敗');
      }
    } catch {
      setPasscodeFormError('連線錯誤');
    } finally {
      setCreatingPasscode(false);
    }
  };

  const handleDeletePasscode = async (id: string, code: string) => {
    if (!confirm(`確定要刪除通行密碼「${code}」嗎？`)) return;

    try {
      const res = await fetch(`/api/passcodes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        fetchPasscodes();
      } else {
        alert(data.error || '刪除失敗');
      }
    } catch {
      alert('刪除時發生錯誤');
    }
  };

  // Venture Form Handlers
  const handleSaveVenture = async (e: React.FormEvent) => {
    e.preventDefault();
    setVentureFormError('');

    if (!vTitle.trim() || !vPeriod.trim() || !vStatus.trim()) {
      setVentureFormError('請填寫公司名稱、執行時間與現況更新');
      return;
    }

    setCreatingVenture(true);
    try {
      const url = editingVentureId ? `/api/venture/${editingVentureId}` : '/api/venture';
      const method = editingVentureId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: vCategory,
          title: vTitle,
          logoUrl: vLogoUrl,
          period: vPeriod,
          status: vStatus,
          description: vDescription,
          linkUrl: vLinkUrl,
          order: vOrder,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setVTitle('');
        setVLogoUrl('');
        setVPeriod('');
        setVStatus('');
        setVDescription('');
        setVLinkUrl('');
        setVOrder(0);
        setEditingVentureId(null);
        fetchVentureItems();
      } else {
        setVentureFormError(data.error || '儲存失敗');
      }
    } catch {
      setVentureFormError('連線失敗');
    } finally {
      setCreatingVenture(false);
    }
  };

  const handleEditVenture = (item: VentureItemData) => {
    setEditingVentureId(item.id);
    setVCategory(item.category);
    setVTitle(item.title);
    setVLogoUrl(item.logoUrl || '');
    setVPeriod(item.period);
    setVStatus(item.status);
    setVDescription(item.description || '');
    setVLinkUrl(item.linkUrl || '');
    setVOrder(item.order);
  };

  const handleCancelVentureEdit = () => {
    setEditingVentureId(null);
    setVTitle('');
    setVLogoUrl('');
    setVPeriod('');
    setVStatus('');
    setVDescription('');
    setVLinkUrl('');
    setVOrder(0);
  };

  const handleDeleteVenture = async (id: string, titleName: string) => {
    if (!confirm(`確定要刪除風險投資項目「${titleName}」嗎？`)) return;

    try {
      const res = await fetch(`/api/venture/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        fetchVentureItems();
      } else {
        alert(data.error || '刪除失敗');
      }
    } catch {
      alert('刪除時發生錯誤');
    }
  };

  // Career Image Upload Handlers
  const handleUploadCLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCLogo(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.ok && data.url) {
        setCLogoUrl(data.url);
      } else {
        alert(data.error || 'Logo 圖片上傳失敗');
      }
    } catch {
      alert('Logo 圖片上傳連線失敗');
    } finally {
      setUploadingCLogo(false);
    }
  };

  const handleUploadCPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCPhoto(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.ok && data.url) {
        setCPhotoUrl(data.url);
      } else {
        alert(data.error || '工作照片上傳失敗');
      }
    } catch {
      alert('工作照片上傳連線失敗');
    } finally {
      setUploadingCPhoto(false);
    }
  };

  // Career Form Handlers
  const handleSaveCareer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCareerFormError('');

    if (!company.trim() || !role.trim() || !period.trim()) {
      setCareerFormError('請輸入公司、職務與任職時間');
      return;
    }

    setCreatingCareer(true);
    try {
      const url = editingCareerId ? `/api/career/${editingCareerId}` : '/api/career';
      const method = editingCareerId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, role, period, description, logoUrl: cLogoUrl, photoUrl: cPhotoUrl, order }),
      });

      const data = await res.json();

      if (data.ok) {
        setCompany('');
        setRole('');
        setPeriod('');
        setDescription('');
        setCLogoUrl('');
        setCPhotoUrl('');
        setOrder(0);
        setEditingCareerId(null);
        fetchCareerItems();
      } else {
        setCareerFormError(data.error || '儲存失敗');
      }
    } catch {
      setCareerFormError('連線失敗');
    } finally {
      setCreatingCareer(false);
    }
  };

  const handleEditCareer = (item: CareerItemData) => {
    setEditingCareerId(item.id);
    setCompany(item.company);
    setRole(item.role);
    setPeriod(item.period);
    setDescription(item.description);
    setCLogoUrl(item.logoUrl || '');
    setCPhotoUrl(item.photoUrl || '');
    setOrder(item.order);
  };

  const handleCancelCareerEdit = () => {
    setEditingCareerId(null);
    setCompany('');
    setRole('');
    setPeriod('');
    setDescription('');
    setCLogoUrl('');
    setCPhotoUrl('');
    setOrder(0);
  };

  const handleDeleteCareer = async (id: string, companyName: string) => {
    if (!confirm(`確定要刪除「${companyName}」的職涯經歷紀錄嗎？`)) return;

    try {
      const res = await fetch(`/api/career/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        fetchCareerItems();
      } else {
        alert(data.error || '刪除失敗');
      }
    } catch {
      alert('刪除時發生錯誤');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', letterSpacing: '2px', textTransform: 'uppercase' }}>
          VERIFYING CURATOR CREDENTIALS...
        </p>
      </div>
    );
  }

  if (!authenticated) return null;

  return (
    <div style={{ padding: '3rem 2rem', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '3rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <Shield size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', color: '#fff', fontFamily: 'var(--font-noto-serif)', letterSpacing: '2px' }}>
              CURATOR DASHBOARD
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Museum Administration & Content Control
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => router.push('/museum')}
            className="museum-btn"
            style={{ fontSize: '0.85rem', padding: '0.5rem 1.2rem' }}
          >
            Enter Museum
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '0.5rem 1.2rem',
              borderRadius: '2px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              transition: 'all 0.3s ease'
            }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('passcodes')}
          style={{
            padding: '0.8rem 1.8rem',
            background: activeTab === 'passcodes' ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'passcodes' ? '2px solid #fff' : '2px solid transparent',
            color: activeTab === 'passcodes' ? '#fff' : 'var(--text-secondary)',
            fontSize: '0.95rem',
            letterSpacing: '1px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            transition: 'all 0.3s ease'
          }}
        >
          <Key size={18} />
          通行密碼管理 (Passcodes)
        </button>

        <button
          onClick={() => setActiveTab('venture')}
          style={{
            padding: '0.8rem 1.8rem',
            background: activeTab === 'venture' ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'venture' ? '2px solid #fff' : '2px solid transparent',
            color: activeTab === 'venture' ? '#fff' : 'var(--text-secondary)',
            fontSize: '0.95rem',
            letterSpacing: '1px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            transition: 'all 0.3s ease'
          }}
        >
          <TrendingUp size={18} />
          風險投資項目 (Venture Projects)
        </button>

        <button
          onClick={() => setActiveTab('career')}
          style={{
            padding: '0.8rem 1.8rem',
            background: activeTab === 'career' ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'career' ? '2px solid #fff' : '2px solid transparent',
            color: activeTab === 'career' ? '#fff' : 'var(--text-secondary)',
            fontSize: '0.95rem',
            letterSpacing: '1px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            transition: 'all 0.3s ease'
          }}
        >
          <Briefcase size={18} />
          職涯經歷管理 (Career Timeline)
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          style={{
            padding: '0.8rem 1.8rem',
            background: activeTab === 'stats' ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'stats' ? '2px solid #fff' : '2px solid transparent',
            color: activeTab === 'stats' ? '#fff' : 'var(--text-secondary)',
            fontSize: '0.95rem',
            letterSpacing: '1px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            transition: 'all 0.3s ease'
          }}
        >
          <BarChart3 size={18} />
          展區流量統計 (Analytics)
        </button>

        <button
          onClick={() => setActiveTab('subscribers')}
          style={{
            padding: '0.8rem 1.8rem',
            background: activeTab === 'subscribers' ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'subscribers' ? '2px solid #fff' : '2px solid transparent',
            color: activeTab === 'subscribers' ? '#fff' : 'var(--text-secondary)',
            fontSize: '0.95rem',
            letterSpacing: '1px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            transition: 'all 0.3s ease'
          }}
        >
          <Mail size={18} />
          連載訂閱與廣播 ({subscribersCount})
        </button>

        <button
          onClick={() => setActiveTab('music')}
          style={{
            padding: '0.8rem 1.8rem',
            background: activeTab === 'music' ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'music' ? '2px solid #fff' : '2px solid transparent',
            color: activeTab === 'music' ? '#fff' : 'var(--text-secondary)',
            fontSize: '0.95rem',
            letterSpacing: '1px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            transition: 'all 0.3s ease'
          }}
        >
          <Music size={18} />
          音樂與聲音創作 (Music)
        </button>

        <button
          onClick={() => setActiveTab('writings')}
          style={{
            padding: '0.8rem 1.8rem',
            background: activeTab === 'writings' ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'writings' ? '2px solid #fff' : '2px solid transparent',
            color: activeTab === 'writings' ? '#fff' : 'var(--text-secondary)',
            fontSize: '0.95rem',
            letterSpacing: '1px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            transition: 'all 0.3s ease'
          }}
        >
          <Edit3 size={18} />
          其他文字創作 (Writings)
        </button>
      </div>

      {/* Tab 1: Passcode Management */}
      {activeTab === 'passcodes' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', height: 'fit-content' }}>
            <h2 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-noto-serif)' }}>
              <Plus size={20} />
              新增通行密碼
            </h2>

            {passcodeFormError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.6rem 0.8rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {passcodeFormError}
              </div>
            )}

            <form onSubmit={handleCreatePasscode} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  通行密碼 (Code) *
                </label>
                <input
                  type="text"
                  placeholder="例如: VC2026 或 VIP888"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  對象備註 (Note)
                </label>
                <input
                  type="text"
                  placeholder="例如: 給 VC 投資夥伴"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    解鎖展區權限
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllPerms}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {newPermissions.length === ALL_EXHIBIT_KEYS.length ? '取消全選' : '全選'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'rgba(0,0,0,0.3)', padding: '0.8rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {PASSCODE_PERM_KEYS.map((key) => {
                    const checked = newPermissions.includes(key);
                    return (
                      <div
                        key={key}
                        onClick={() => handleTogglePermission(key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          color: checked ? '#fff' : 'var(--text-secondary)',
                          userSelect: 'none'
                        }}
                      >
                        {checked ? <CheckSquare size={16} color="#4ade80" /> : <Square size={16} />}
                        <span>{EXHIBIT_MAP[key]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="museum-btn"
                disabled={creatingPasscode}
                style={{ marginTop: '0.5rem', width: '100%' }}
              >
                {creatingPasscode ? '建立中...' : '確認新增密碼'}
              </button>
            </form>
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
                通行密碼列表 ({passcodes.length})
              </h2>
              <button onClick={fetchPasscodes} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                <RefreshCw size={14} /> 重整
              </button>
            </div>

            {passcodes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <p style={{ letterSpacing: '1px' }}>目前尚無通行密碼，請於左側新增。</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {passcodes.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: '1.2rem',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 600, color: '#fff', fontFamily: 'monospace', letterSpacing: '2px', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.6rem', borderRadius: '2px' }}>
                          {item.code}
                        </span>
                        {item.note && (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            ({item.note})
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.6rem' }}>
                        {item.permissions.map((perm) => (
                          <span
                            key={perm}
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '2px',
                              background: 'rgba(255,255,255,0.05)',
                              color: 'rgba(255,255,255,0.8)',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}
                          >
                            {EXHIBIT_MAP[perm] || perm}
                          </span>
                        ))}
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.8rem', display: 'flex', gap: '1rem' }}>
                        <span>建立時間: {new Date(item.createdAt).toLocaleDateString()}</span>
                        <span>使用次數: {item.pageviewCount} 次</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeletePasscode(item.id, item.code)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#f87171',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.8rem',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <Trash2 size={14} /> 刪除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Venture Capital Management */}
      {activeTab === 'venture' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2.5rem' }}>
          {/* Add / Edit Venture Item Form */}
          <div className="glass-panel" style={{ padding: '2rem', height: 'fit-content' }}>
            <h2 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-noto-serif)' }}>
              {editingVentureId ? <Edit3 size={20} /> : <Plus size={20} />}
              {editingVentureId ? '編輯風險投資項目' : '新增風險投資項目'}
            </h2>

            {ventureFormError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.6rem 0.8rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {ventureFormError}
              </div>
            )}

            <form onSubmit={handleSaveVenture} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  子區塊分類 (Category) *
                </label>
                <select
                  value={vCategory}
                  onChange={(e) => setVCategory(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%', background: 'rgba(10,10,10,0.9)' }}
                >
                  {VENTURE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  公司 / 專案名稱 *
                </label>
                <input
                  type="text"
                  placeholder="例如: Acme Corp / AI 算力科技"
                  value={vTitle}
                  onChange={(e) => setVTitle(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  公司 Logo 圖片 (點擊上傳電腦檔案或輸入網址)
                </label>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    id="vlogo-file-input"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="vlogo-file-input"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      padding: '0.5rem 1rem',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <Upload size={16} />
                    {uploadingLogo ? '上傳中...' : '點擊上傳電腦圖片'}
                  </label>
                  
                  {vLogoUrl && (
                    <img src={vLogoUrl} alt="Logo Preview" style={{ width: '40px', height: '40px', objectFit: 'contain', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px', border: '1px solid rgba(255,255,255,0.2)' }} />
                  )}
                </div>
                <input
                  type="text"
                  placeholder="或直接貼上雲端圖片網址 / Google Drive 連結 (選填)"
                  value={vLogoUrl}
                  onChange={(e) => setVLogoUrl(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  執行時間 (Execution Period) *
                </label>
                <input
                  type="text"
                  placeholder="例如: 2023 - Present 或 2024 Q2"
                  value={vPeriod}
                  onChange={(e) => setVPeriod(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  現況更新 (Status Update) *
                </label>
                <input
                  type="text"
                  placeholder="例如: 已完成天使輪 / 產品上線成長中"
                  value={vStatus}
                  onChange={(e) => setVStatus(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  補充說明 (Description)
                </label>
                <textarea
                  placeholder="補充此專案的評估重點或現況細節..."
                  value={vDescription}
                  onChange={(e) => setVDescription(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%', minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  外部相關連結 (External Link URL)
                </label>
                <input
                  type="text"
                  placeholder="例如: https://acme-startup.com (點擊卡片將跳轉至此連結)"
                  value={vLinkUrl}
                  onChange={(e) => setVLinkUrl(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  排序權重 (數字越小越靠前)
                </label>
                <input
                  type="number"
                  value={vOrder}
                  onChange={(e) => setVOrder(parseInt(e.target.value) || 0)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  className="museum-btn"
                  disabled={creatingVenture}
                  style={{ flex: 1 }}
                >
                  {creatingVenture ? '儲存中...' : (editingVentureId ? '更新風險投資項目' : '確認新增項目')}
                </button>
                {editingVentureId && (
                  <button
                    type="button"
                    onClick={handleCancelVentureEdit}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '2px', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Venture List */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
                風險投資項目列表 ({ventureItems.length})
              </h2>
              <button onClick={fetchVentureItems} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                <RefreshCw size={14} /> 重整
              </button>
            </div>

            {ventureItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <p style={{ letterSpacing: '1px' }}>目前尚無風險投資項目，請於左側新增。</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {ventureItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: '1.4rem',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.15rem 0.6rem', borderRadius: '2px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                          {item.category}
                        </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
                          {item.title}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px' }}>
                          ({item.period})
                        </span>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '4px', width: 'fit-content', marginBottom: '0.6rem' }}>
                        現況更新: {item.status}
                      </div>

                      {item.description && (
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginTop: '0.4rem' }}>
                          {item.description}
                        </p>
                      )}

                      {item.logoUrl && (
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.6rem' }}>
                          Logo: {item.logoUrl}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleEditVenture(item)}
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                      >
                        <Edit3 size={14} /> 編輯
                      </button>
                      <button
                        onClick={() => handleDeleteVenture(item.id, item.title)}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.4rem 0.8rem', borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                      >
                        <Trash2 size={14} /> 刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Career Management */}
      {activeTab === 'career' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', height: 'fit-content' }}>
            <h2 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-noto-serif)' }}>
              {editingCareerId ? <Edit3 size={20} /> : <Plus size={20} />}
              {editingCareerId ? '編輯職涯歷程' : '新增職涯歷程'}
            </h2>

            {careerFormError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.6rem 0.8rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {careerFormError}
              </div>
            )}

            <form onSubmit={handleSaveCareer} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  公司 / 機構名稱 *
                </label>
                <input
                  type="text"
                  placeholder="例如: 國泰金控 / 勤業眾信"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  職稱 / 角色 *
                </label>
                <input
                  type="text"
                  placeholder="例如: 高級創投經理 / 審計領組"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  任職時間 *
                </label>
                <input
                  type="text"
                  placeholder="例如: 2022 - 2025"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                  required
                />
              </div>

              {/* 照片空間 1：公司/機構 Logo 照片 */}
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  照片空間一：公司 / 機構 Logo (選填)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadCLogo}
                    id="career-logo-file-input"
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="career-logo-file-input"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      padding: '0.5rem 1rem',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Upload size={16} />
                    {uploadingCLogo ? '上傳中...' : '上傳 Logo 圖片'}
                  </label>
                  {cLogoUrl && (
                    <img
                      src={cLogoUrl}
                      alt="Logo Preview"
                      style={{
                        width: '40px',
                        height: '40px',
                        objectFit: 'contain',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '4px',
                        padding: '2px',
                        border: '1px solid rgba(255,255,255,0.2)',
                      }}
                    />
                  )}
                </div>
                <input
                  type="text"
                  placeholder="或貼上 Logo 圖片網址 (選填)"
                  value={cLogoUrl}
                  onChange={(e) => setCLogoUrl(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                />
              </div>

              {/* 照片空間 2：個人工作照 / 現場照片 */}
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  照片空間二：個人工作照 / 團隊現場照片 (選填)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadCPhoto}
                    id="career-photo-file-input"
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="career-photo-file-input"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      padding: '0.5rem 1rem',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Upload size={16} />
                    {uploadingCPhoto ? '上傳中...' : '上傳工作照片'}
                  </label>
                  {cPhotoUrl && (
                    <img
                      src={cPhotoUrl}
                      alt="Work Photo Preview"
                      style={{
                        width: '60px',
                        height: '40px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.2)',
                      }}
                    />
                  )}
                </div>
                <input
                  type="text"
                  placeholder="或貼上工作照片網址 (選填)"
                  value={cPhotoUrl}
                  onChange={(e) => setCPhotoUrl(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  成就與經歷說明 (支持多行)
                </label>
                <textarea
                  placeholder="描述在此崗位的主要職責與亮點成就..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%', minHeight: '120px', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  排序權重 (數字越小越靠前)
                </label>
                <input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  className="museum-btn"
                  disabled={creatingCareer}
                  style={{ flex: 1 }}
                >
                  {creatingCareer ? '儲存中...' : (editingCareerId ? '更新職涯卡片' : '確認新增職涯')}
                </button>
                {editingCareerId && (
                  <button
                    type="button"
                    onClick={handleCancelCareerEdit}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '2px', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
                職涯經歷歷程 ({careerItems.length})
              </h2>
              <button onClick={fetchCareerItems} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                <RefreshCw size={14} /> 重整
              </button>
            </div>

            {careerItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <p style={{ letterSpacing: '1px' }}>目前尚無職涯經歷資料，請於左側新增。</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {careerItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: '1.4rem',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
                          {item.company}
                        </span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--theme-career)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.1rem 0.6rem', borderRadius: '2px' }}>
                          {item.role}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px' }}>
                          ({item.period})
                        </span>
                      </div>

                      {item.description && (
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-line', lineHeight: 1.5, marginTop: '0.8rem' }}>
                          {item.description}
                        </p>
                      )}

                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.8rem' }}>
                        排序權重: {item.order}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleEditCareer(item)}
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                      >
                        <Edit3 size={14} /> 編輯
                      </button>
                      <button
                        onClick={() => handleDeleteCareer(item.id, item.company)}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.4rem 0.8rem', borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                      >
                        <Trash2 size={14} /> 刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Analytics & Traffic */}
      {activeTab === 'stats' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Eye size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  總瀏覽人次 (Total Pageviews)
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 300, color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
                  {stats ? stats.totalPageviews : 0}
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Key size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  通行密碼發放數 (Active Passcodes)
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 300, color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
                  {passcodes.length}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1.5rem', fontFamily: 'var(--font-noto-serif)' }}>
              各展區探索次數分布 (6大展區)
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {ALL_EXHIBIT_KEYS.map((key) => {
                const stat = stats?.exhibitStats.find((s) => s.exhibitId === key);
                const count = stat ? stat.count : 0;
                const maxCount = Math.max(...(stats?.exhibitStats.map((s) => s.count) || [1]), 1);
                const percentage = Math.round((count / maxCount) * 100);

                return (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#fff' }}>
                      <span>{EXHIBIT_MAP[key]}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{count} 次瀏覽</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0.8))',
                          borderRadius: '4px',
                          transition: 'width 0.6s ease'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1.5rem', fontFamily: 'var(--font-noto-serif)' }}>
              近期造訪紀錄 (Recent Activity Logs)
            </h2>

            {stats?.recentViews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                尚無造訪紀錄
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {stats?.recentViews.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.8rem 1rem',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '4px',
                      border: '1px solid rgba(255,255,255,0.04)',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      <span style={{ color: '#fff', fontWeight: 500 }}>
                        {EXHIBIT_MAP[log.exhibitId] || log.exhibitId}
                      </span>
                    </div>
                    <div>
                      {log.passcode ? (
                        <span style={{ color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '2px' }}>
                          🔑 {log.passcode.code} {log.passcode.note ? `(${log.passcode.note})` : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>匿名訪客</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Subscribers & Newsletter */}
      {activeTab === 'subscribers' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2.5rem' }}>
          {/* 左欄：隔日廣播信件排程表單 */}
          <div className="glass-panel" style={{ padding: '2rem', height: 'fit-content' }}>
            <h2 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-noto-serif)' }}>
              <Send size={20} style={{ color: '#60a5fa' }} />
              隔日連載更新廣播
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              當您在 Notion 上更新了小說新章節，可在此安排電子報排程。系統將於隔日固定時間為 {subscribersCount} 位訂閱者寄送連載更新通知信件。
            </p>

            {dispatchMessage && (
              <div style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', color: '#4ade80', padding: '0.6rem 0.8rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {dispatchMessage}
              </div>
            )}

            <form onSubmit={handleDispatchNewsletter} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  小說名稱 *
                </label>
                <input
                  type="text"
                  placeholder="例如: AI 小說共創實錄"
                  value={dispatchNovelTitle}
                  onChange={(e) => setDispatchNovelTitle(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  新更新章節名稱 *
                </label>
                <input
                  type="text"
                  placeholder="例如: 第三章：記憶重構與邊界"
                  value={dispatchChapterTitle}
                  onChange={(e) => setDispatchChapterTitle(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  內容導讀摘要 (選填)
                </label>
                <textarea
                  placeholder="簡短寫下本次連載新章節的亮點導讀..."
                  value={dispatchSummary}
                  onChange={(e) => setDispatchSummary(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%', minHeight: '90px', resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                className="museum-btn"
                disabled={dispatching}
                style={{ marginTop: '0.5rem', width: '100%', background: 'rgba(96, 165, 250, 0.15)', borderColor: 'rgba(96, 165, 250, 0.3)' }}
              >
                {dispatching ? '安排排程中...' : '安排隔日固定時間寄送廣播通知'}
              </button>
            </form>
          </div>

          {/* 右欄：訂閱者名單列表 */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
                連載訂閱者名單 ({subscribersCount})
              </h2>
              <button onClick={fetchSubscribers} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                <RefreshCw size={14} /> 重整
              </button>
            </div>

            {loadingSubscribers ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>載入中...</div>
            ) : subscribers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <Mail size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p style={{ letterSpacing: '1px' }}>目前尚無讀者訂閱，當讀者在小說閱讀頁面留下 Email 時將會顯示於此。</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {subscribers.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: '1rem 1.2rem',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '1rem', color: '#fff', fontWeight: 500, fontFamily: 'monospace' }}>
                        {item.email}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        訂閱時間: {new Date(item.createdAt).toLocaleDateString('zh-TW')} • 訂閱對象: {item.novelId}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteSubscriber(item.id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Trash2 size={14} />
                      移除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Music & YouTube Embeds */}
      {activeTab === 'music' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2.5rem' }}>
          {/* 左欄：新增音樂與 YouTube 連結 */}
          <div className="glass-panel" style={{ padding: '2rem', height: 'fit-content' }}>
            <h2 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-noto-serif)' }}>
              <Plus size={20} />
              新增音樂創作 (YouTube 嵌入)
            </h2>

            {musicFormError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.6rem 0.8rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {musicFormError}
              </div>
            )}

            <form onSubmit={handleCreateMusic} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  所屬類別 *
                </label>
                <select
                  value={mCategory}
                  onChange={(e) => setMCategory(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                >
                  <option value="音樂">創作 Lab - 音樂 (Music)</option>
                  <option value="聲音探尋">聲音探尋 (Sound Exploration)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  曲目 / 創作名稱 *
                </label>
                <input
                  type="text"
                  placeholder="例如: 【創作 Lab】夜間聲響實驗 #01"
                  value={mTitle}
                  onChange={(e) => setMTitle(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  YouTube 連結 (URL) *
                </label>
                <input
                  type="text"
                  placeholder="例如: https://www.youtube.com/watch?v=xxx 或 https://youtu.be/xxx"
                  value={mYoutubeUrl}
                  onChange={(e) => setMYoutubeUrl(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  曲目簡介 / 創作心得 (選填)
                </label>
                <textarea
                  placeholder="簡短寫下音樂創作靈感或紀錄..."
                  value={mDescription}
                  onChange={(e) => setMDescription(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%', minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  排序權重 (Order, 越小越前面)
                </label>
                <input
                  type="number"
                  value={mOrder}
                  onChange={(e) => setMOrder(parseInt(e.target.value) || 0)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                />
              </div>

              <button
                type="submit"
                className="museum-btn"
                disabled={creatingMusic}
                style={{ marginTop: '0.5rem', width: '100%' }}
              >
                {creatingMusic ? '新增中...' : '確認新增 YouTube 音樂嵌入卡片'}
              </button>
            </form>
          </div>

          {/* 右欄：音樂與聲音作品列表 */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
                音樂作品列表 ({musicItems.length})
              </h2>
              <button onClick={fetchMusicItems} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                <RefreshCw size={14} /> 重整
              </button>
            </div>

            {musicItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <Music size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p style={{ letterSpacing: '1px' }}>目前尚無音樂作品，請於左側貼上 YouTube 網址新增。</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {musicItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: '1.2rem',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', color: '#60a5fa', padding: '0.2rem 0.6rem', borderRadius: '2px' }}>
                          {item.category}
                        </span>
                        <h3 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600 }}>
                          {item.title}
                        </h3>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontFamily: 'monospace' }}>
                        網址: {item.youtubeUrl}
                      </div>
                      {item.description && (
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                          {item.description}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteMusic(item.id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Trash2 size={14} />
                      刪除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 7: Other Writings Editor */}
      {activeTab === 'writings' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2.5rem' }}>
          {/* 左欄：文章編輯器表單 */}
          <div className="glass-panel" style={{ padding: '2rem', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-noto-serif)' }}>
                <Edit3 size={20} />
                {editingWritingId ? '編輯文章創作' : '發布新文章創作'}
              </h2>
              {editingWritingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingWritingId(null);
                    setWTitle('');
                    setWExcerpt('');
                    setWContent('');
                    setWOrder(0);
                  }}
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                >
                  <X size={14} /> 取消編輯
                </button>
              )}
            </div>

            {writingFormError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.6rem 0.8rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {writingFormError}
              </div>
            )}

            <form onSubmit={handleCreateOrUpdateWriting} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  文章 / 創作標題 *
                </label>
                <input
                  type="text"
                  placeholder="例如: 【創作 Lab】時間與聲響的交界——深夜散文手記"
                  value={wTitle}
                  onChange={(e) => setWTitle(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  分類標籤
                </label>
                <input
                  type="text"
                  placeholder="預設: 其他文字 (或自訂如: 隨筆, 散文, 新詩)"
                  value={wCategory}
                  onChange={(e) => setWCategory(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  摘要說明 / 引言 (選填)
                </label>
                <input
                  type="text"
                  placeholder="顯示於前台卡片上的簡短摘要..."
                  value={wExcerpt}
                  onChange={(e) => setWExcerpt(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  完整文章內文 * (支援多段落)
                </label>
                <textarea
                  placeholder="在這裡撰寫完整的文字內容，支援分段與多行文字..."
                  value={wContent}
                  onChange={(e) => setWContent(e.target.value)}
                  className="museum-input"
                  style={{ maxWidth: '100%', minHeight: '220px', resize: 'vertical', lineHeight: 1.6 }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  排序權重 (Order, 越小越前面)
                </label>
                <input
                  type="number"
                  value={wOrder}
                  onChange={(e) => setWOrder(parseInt(e.target.value) || 0)}
                  className="museum-input"
                  style={{ maxWidth: '100%' }}
                />
              </div>

              <button
                type="submit"
                className="museum-btn"
                disabled={creatingWriting}
                style={{ marginTop: '0.5rem', width: '100%' }}
              >
                {creatingWriting ? '儲存中...' : editingWritingId ? '儲存文章更新' : '發布至創作 Lab (其他文字)'}
              </button>
            </form>
          </div>

          {/* 右欄：已發布文章創作列表 */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
                其他文字創作列表 ({writingsItems.length})
              </h2>
              <button onClick={fetchWritingsItems} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                <RefreshCw size={14} /> 重整
              </button>
            </div>

            {writingsItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <Edit3 size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p style={{ letterSpacing: '1px' }}>目前尚無其他文字創作，請於左側撰寫並發布。</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {writingsItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: '1.4rem',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1.5rem',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', color: '#a855f7', padding: '0.2rem 0.6rem', borderRadius: '2px' }}>
                          {item.category}
                        </span>
                        <h3 style={{ color: '#fff', fontSize: '1.15rem', fontWeight: 600, fontFamily: 'var(--font-noto-serif)' }}>
                          {item.title}
                        </h3>
                      </div>
                      {item.excerpt && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '0.8rem', lineHeight: 1.5 }}>
                          {item.excerpt}
                        </p>
                      )}
                      <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.03)', padding: '0.8rem 1rem', borderRadius: '4px', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                        {item.content}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <button
                        onClick={() => handleEditWriting(item)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: '#fff',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '2px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <Edit3 size={14} />
                        編輯
                      </button>

                      <button
                        onClick={() => handleDeleteWriting(item.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#ef4444',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '2px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <Trash2 size={14} />
                        刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
