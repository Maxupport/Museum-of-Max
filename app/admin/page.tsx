'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Key, BarChart3, LogOut, Plus, Trash2, Shield, Eye, RefreshCw, CheckSquare, Square, Briefcase, TrendingUp, Edit3, X, Upload, Mail, Send, Music, Sparkles, BookOpen } from 'lucide-react';
import { EXHIBIT_MAP, ALL_EXHIBIT_KEYS, PASSCODE_PERM_KEYS } from '@/lib/constants';

interface PasscodeItem {
  id: string;
  code: string;
  note: string | null;
  avatarUrl?: string | null;
  permissions: string[];
  createdAt: string;
  pageviewCount: number;
}

interface PasscodeEntryStat {
  code: string;
  note: string;
  count: number;
  isPreset: boolean;
}

interface StatData {
  totalPageviews: number;
  totalPasscodeEntries: number;
  passcodeEntryStats: PasscodeEntryStat[];
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
  createdAt?: string;
}

interface WritingsItemData {
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

const VENTURE_CATEGORIES = ['早期投資', '天使引路計畫', '募資 FA 服務', '創投項目評估'];

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'passcodes' | 'venture' | 'career' | 'stats' | 'subscribers' | 'sound' | 'creation_lab' | 'articles'>('articles');
  const [soundSubCategoryFilter, setSoundSubCategoryFilter] = useState<string>('全部分類');
  const [creationLabSubTab, setCreationLabSubTab] = useState<'music' | 'writings'>('music');

  // Passcodes state
  const [passcodes, setPasscodes] = useState<PasscodeItem[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [newPermissions, setNewPermissions] = useState<string[]>(ALL_EXHIBIT_KEYS);
  const [editingPasscodeId, setEditingPasscodeId] = useState<string | null>(null);
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
  const [mCategory, setMCategory] = useState('個人聲音探索心得');
  const [mTitle, setMTitle] = useState('');
  const [mYoutubeUrl, setMYoutubeUrl] = useState('');
  const [mDescription, setMDescription] = useState('');
  const [mOrder, setMOrder] = useState(0);
  const [creatingMusic, setCreatingMusic] = useState(false);
  const [musicFormError, setMusicFormError] = useState('');
  const [editingMusicId, setEditingMusicId] = useState<string | null>(null);

  const fetchMusicItems = useCallback(async () => {
    try {
      const res = await fetch('/api/music');
      const data = await res.json();
      if (data.ok) setMusicItems(data.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleEditMusic = (item: MusicItemData) => {
    setEditingMusicId(item.id);
    setMCategory(item.category || '個人聲音探索心得');
    setMTitle(item.title);
    setMYoutubeUrl(item.youtubeUrl);
    setMDescription(item.description || '');
    setMOrder(item.order || 0);
    setMusicFormError('');
  };

  const handleCancelMusicEdit = () => {
    setEditingMusicId(null);
    setMCategory(activeTab === 'creation_lab' ? '音樂' : '個人聲音探索心得');
    setMTitle('');
    setMYoutubeUrl('');
    setMDescription('');
    setMOrder(0);
    setMusicFormError('');
  };

  const handleSaveMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    setMusicFormError('');
    if (!mTitle.trim() || !mYoutubeUrl.trim()) {
      setMusicFormError('請輸入曲目標題與 YouTube 網址');
      return;
    }
    setCreatingMusic(true);
    try {
      const url = editingMusicId ? `/api/music/${editingMusicId}` : '/api/music';
      const method = editingMusicId ? 'PUT' : 'POST';

      const finalCategory = activeTab === 'creation_lab' ? '音樂' : mCategory;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: finalCategory,
          title: mTitle,
          youtubeUrl: mYoutubeUrl,
          description: mDescription,
          order: mOrder,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        handleCancelMusicEdit();
        fetchMusicItems();
      } else {
        setMusicFormError(data.error || '儲存失敗');
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

  // Writings / Universal Articles state
  const [writingsItems, setWritingsItems] = useState<WritingsItemData[]>([]);
  const [wExhibitId, setWExhibitId] = useState('finance_insurance');
  const [wCategory, setWCategory] = useState('投資');
  const [wTitle, setWTitle] = useState('');
  const [wCoverImage, setWCoverImage] = useState('');
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false);
  const [wVocalVersions, setWVocalVersions] = useState<Array<{ id: string; versionTitle: string; date: string; youtubeUrl: string; notes: string }>>([
    { id: 'v1', versionTitle: 'Ver 1.0 課程前初測錄音', date: '', youtubeUrl: '', notes: '' }
  ]);
  const [wTopic, setWTopic] = useState('');
  const [wFbUrl, setWFbUrl] = useState('');
  const [wFbDate, setWFbDate] = useState('');
  const [wExcerpt, setWExcerpt] = useState('');
  const [wContent, setWContent] = useState('');
  const [wYoutubeUrl, setWYoutubeUrl] = useState('');
  const [wOrder, setWOrder] = useState(0);
  const [editingWritingId, setEditingWritingId] = useState<string | null>(null);
  const [creatingWriting, setCreatingWriting] = useState(false);
  const [writingFormError, setWritingFormError] = useState('');
  const [showArticlePreview, setShowArticlePreview] = useState(false);
  const [articleSubTab, setArticleSubTab] = useState<'list' | 'editor' | 'preview'>('list');
  const [filterArticleExhibit, setFilterArticleExhibit] = useState<string>('all');

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCoverImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.ok && data.url) {
        setWCoverImage(data.url);
      } else {
        alert(data.error || '上傳圖片失敗');
      }
    } catch {
      alert('連線上傳失敗');
    } finally {
      setUploadingCoverImage(false);
    }
  };

  const fetchWritingsItems = useCallback(async () => {
    try {
      const res = await fetch('/api/writings?includeHidden=true');
      const data = await res.json();
      if (data.ok) {
        setWritingsItems(data.data.map((item: WritingsItemData) => item.category === 'FB文章備份' ? { ...item, category: '社群隨筆' } : item));
      }
    } catch (e) {
      console.error(e);
    }
    fetchMusicItems();
  }, [fetchMusicItems]);

  const handleToggleWritingPin = async (item: WritingsItemData) => {
    try {
      const res = await fetch(`/api/writings/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !item.isPinned }),
      });
      const data = await res.json();
      if (data.ok) fetchWritingsItems();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleWritingHidden = async (item: WritingsItemData) => {
    try {
      const res = await fetch(`/api/writings/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHidden: !item.isHidden }),
      });
      const data = await res.json();
      if (data.ok) fetchWritingsItems();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateOrUpdateWriting = async (e: React.FormEvent) => {
    e.preventDefault();
    setWritingFormError('');
    if (!wTitle.trim()) {
      setWritingFormError('請輸入文章/作品標題');
      return;
    }
    if (wCategory !== '人聲優化歷程記錄' && wCategory !== '人聲優化課程' && !wContent.trim()) {
      setWritingFormError('請輸入文章內文');
      return;
    }
    setCreatingWriting(true);
    try {
      const url = editingWritingId ? `/api/writings/${editingWritingId}` : '/api/writings';
      const method = editingWritingId ? 'PUT' : 'POST';

      const isVocalCategory = wCategory === '人聲優化歷程記錄' || wCategory === '人聲優化課程';
      const finalContent = isVocalCategory
        ? JSON.stringify({
            isVocalCourse: true,
            coverImage: wCoverImage || '',
            overview: wExcerpt || wContent || '人聲優化歷程記錄 - 多版本對比演進錄音',
            versions: wVocalVersions
          })
        : wContent;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exhibitId: wExhibitId,
          title: wTitle,
          category: wCategory,
          topic: isVocalCategory ? '' : wTopic,
          fbUrl: isVocalCategory ? '' : wFbUrl,
          fbDate: isVocalCategory ? '' : wFbDate,
          excerpt: wExcerpt,
          content: finalContent,
          youtubeUrl: isVocalCategory ? (wVocalVersions[0]?.youtubeUrl || wYoutubeUrl) : wYoutubeUrl,
          order: wOrder,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setWTitle('');
        setWTopic('');
        setWFbUrl('');
        setWFbDate('');
        setWExcerpt('');
        setWContent('');
        setWYoutubeUrl('');
        setWCoverImage('');
        setWVocalVersions([{ id: 'v1', versionTitle: 'Ver 1.0 課程前初測錄音', date: '', youtubeUrl: '', notes: '' }]);
        setWOrder(0);
        setEditingWritingId(null);
        fetchWritingsItems();
        setArticleSubTab('list');
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
    setWExhibitId(item.exhibitId || 'creation_lab');
    setWTitle(item.title);
    setWCategory(item.category || '社群隨筆');
    setWTopic(item.topic || '');
    setWFbUrl(item.fbUrl || '');
    setWFbDate(item.fbDate || '');
    setWExcerpt(item.excerpt || '');
    setWContent(item.content);
    setWYoutubeUrl(item.youtubeUrl || '');
    setWOrder(item.order);

    if (item.category === '人聲優化歷程記錄' || item.category === '人聲優化課程') {
      try {
        const parsed = JSON.parse(item.content);
        if (parsed) {
          if (Array.isArray(parsed.versions)) setWVocalVersions(parsed.versions);
          setWExcerpt(parsed.overview || item.excerpt || '');
          setWCoverImage(parsed.coverImage || '');
        } else {
          setWVocalVersions([{ id: 'v1', versionTitle: 'Ver 1.0 課程前初測錄音', date: item.fbDate || '', youtubeUrl: item.youtubeUrl || '', notes: item.content }]);
          setWCoverImage('');
        }
      } catch {
        setWVocalVersions([{ id: 'v1', versionTitle: 'Ver 1.0 課程前初測錄音', date: item.fbDate || '', youtubeUrl: item.youtubeUrl || '', notes: item.content }]);
        setWCoverImage('');
      }
    } else {
      setWVocalVersions([{ id: 'v1', versionTitle: 'Ver 1.0 課程前初測錄音', date: '', youtubeUrl: '', notes: '' }]);
      setWCoverImage('');
    }

    setArticleSubTab('editor');
  };

  const handleCancelWritingEdit = () => {
    setEditingWritingId(null);
    setWTitle('');
    setWTopic('');
    setWFbUrl('');
    setWFbDate('');
    setWExcerpt('');
    setWContent('');
    setWYoutubeUrl('');
    setWVocalVersions([{ id: 'v1', versionTitle: 'Ver 1.0 課程前初測錄音', date: '', youtubeUrl: '', notes: '' }]);
    setWOrder(0);
    setArticleSubTab('list');
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
      if (activeTab === 'sound') fetchMusicItems();
      if (activeTab === 'creation_lab') {
        fetchMusicItems();
        fetchWritingsItems();
      }
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.ok && data.url) {
        setNewAvatarUrl(data.url);
      } else {
        alert(data.error || '圖片上傳失敗');
      }
    } catch {
      alert('圖片上傳發生錯誤');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCreateOrUpdatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeFormError('');

    if (!newCode.trim()) {
      setPasscodeFormError('請輸入通行密碼');
      return;
    }

    setCreatingPasscode(true);
    try {
      const url = editingPasscodeId ? `/api/passcodes/${editingPasscodeId}` : '/api/passcodes';
      const method = editingPasscodeId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode,
          note: newNote,
          avatarUrl: newAvatarUrl,
          permissions: newPermissions,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setNewCode('');
        setNewNote('');
        setNewAvatarUrl('');
        setEditingPasscodeId(null);
        setNewPermissions(ALL_EXHIBIT_KEYS);
        fetchPasscodes();
      } else {
        setPasscodeFormError(data.error || '儲存失敗');
      }
    } catch {
      setPasscodeFormError('連線錯誤');
    } finally {
      setCreatingPasscode(false);
    }
  };

  const handleEditPasscode = (item: PasscodeItem) => {
    setEditingPasscodeId(item.id);
    setNewCode(item.code);
    setNewNote(item.note || '');
    setNewAvatarUrl(item.avatarUrl || '');
    setNewPermissions(item.permissions);
  };

  const handleCancelPasscodeEdit = () => {
    setEditingPasscodeId(null);
    setNewCode('');
    setNewNote('');
    setNewAvatarUrl('');
    setNewPermissions(ALL_EXHIBIT_KEYS);
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveTab('articles')}
            style={{
              background: activeTab === 'articles' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
              border: activeTab === 'articles' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
              color: activeTab === 'articles' ? '#38bdf8' : '#fff',
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
            <BookOpen size={16} />
            全站文章發布編輯器 ({writingsItems.length})
          </button>

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
          onClick={() => setActiveTab('sound')}
          style={{
            padding: '0.8rem 1.8rem',
            background: activeTab === 'sound' ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'sound' ? '2px solid var(--theme-music, #ec4899)' : '2px solid transparent',
            color: activeTab === 'sound' ? '#fff' : 'var(--text-secondary)',
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
          聲音探索 (Sound Exploration)
        </button>


        <button
          onClick={() => setActiveTab('creation_lab')}
          style={{
            padding: '0.8rem 1.8rem',
            background: activeTab === 'creation_lab' ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'creation_lab' ? '2px solid var(--theme-possibility, #a855f7)' : '2px solid transparent',
            color: activeTab === 'creation_lab' ? '#fff' : 'var(--text-secondary)',
            fontSize: '0.95rem',
            letterSpacing: '1px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            transition: 'all 0.3s ease'
          }}
        >
          <Sparkles size={18} />
          創作 Lab (Creation Lab)
        </button>
      </div>

      {/* Tab 1: Passcode Management */}
      {activeTab === 'passcodes' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-noto-serif)' }}>
                {editingPasscodeId ? <Edit3 size={20} /> : <Plus size={20} />}
                {editingPasscodeId ? '編輯通行密碼' : '新增通行密碼'}
              </h2>
              {editingPasscodeId && (
                <button
                  type="button"
                  onClick={handleCancelPasscodeEdit}
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                >
                  <X size={14} /> 取消編輯
                </button>
              )}
            </div>

            {passcodeFormError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.6rem 0.8rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {passcodeFormError}
              </div>
            )}

            <form onSubmit={handleCreateOrUpdatePasscode} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
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
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  專屬個人形象照圖片 (選填)
                </label>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  {newAvatarUrl && (
                    <img
                      src={newAvatarUrl}
                      alt="Avatar Preview"
                      style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.25)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                    />
                  )}
                  <input
                    type="text"
                    placeholder="圖片 URL (或點右側上傳)"
                    value={newAvatarUrl}
                    onChange={(e) => setNewAvatarUrl(e.target.value)}
                    className="museum-input"
                    style={{ flex: 1, maxWidth: '100%' }}
                  />
                  <label style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '0.5rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Upload size={14} />
                    {uploadingAvatar ? '上傳中...' : '選擇照片'}
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} disabled={uploadingAvatar} />
                  </label>
                </div>
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
                {creatingPasscode ? '儲存中...' : editingPasscodeId ? '儲存密碼更新' : '確認新增密碼'}
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
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flex: 1 }}>
                      {item.avatarUrl ? (
                        <img
                          src={item.avatarUrl}
                          alt={item.code}
                          style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)', marginTop: '0.2rem' }}
                        />
                      ) : (
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          無頭像
                        </div>
                      )}

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
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
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        onClick={() => handleEditPasscode(item)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: '#fff',
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
                        <Edit3 size={14} /> 編輯
                      </button>

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
                        <span style={{ fontSize: '1.2rem', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-noto-serif)', wordBreak: 'break-word', overflowWrap: 'break-word', textWrap: 'balance' }}>
                          {item.title}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px' }}>
                          ({item.period})
                        </span>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '4px', width: 'fit-content', marginBottom: '0.6rem', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        現況更新: {item.status}
                      </div>

                      {item.description && (
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginTop: '0.4rem', wordBreak: 'break-word', overflowWrap: 'break-word', textWrap: 'pretty' }}>
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
              <div style={{ width: '50px', height: '50px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                <Key size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  通行碼進入總次數 (Passcode Entries)
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 300, color: '#fff', fontFamily: 'var(--font-noto-serif)' }}>
                  {stats ? stats.totalPasscodeEntries : 0}
                </div>
              </div>
            </div>
          </div>

          {/* 各通行碼進入次數統計 (首頁選擇通行碼登入) */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.6rem' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#fff', margin: 0, fontFamily: 'var(--font-noto-serif)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Key size={20} style={{ color: '#38bdf8' }} />
                <span>各通行碼進入次數統計 (Passcode Entry Distribution)</span>
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                統計訪客從第一頁使用不同通行碼進入展館之累計次數
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {stats?.passcodeEntryStats && stats.passcodeEntryStats.length > 0 ? (
                stats.passcodeEntryStats.map((item) => {
                  const maxCount = Math.max(...stats.passcodeEntryStats.map((s) => s.count), 1);
                  const percentage = Math.round((item.count / maxCount) * 100);

                  return (
                    <div key={item.code} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem 1.2rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                          <span style={{ 
                            fontSize: '0.85rem', 
                            fontWeight: 700, 
                            color: '#38bdf8', 
                            background: 'rgba(56, 189, 248, 0.12)', 
                            border: '1px solid rgba(56, 189, 248, 0.3)', 
                            padding: '0.2rem 0.6rem', 
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            letterSpacing: '1px'
                          }}>
                            {item.code}
                          </span>
                          <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-noto-sans)' }}>
                            {item.note}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                          {item.count} 次進入
                        </div>
                      </div>

                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginTop: '0.2rem' }}>
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                            borderRadius: '4px',
                            transition: 'width 0.6s ease'
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  尚無通行碼進入數據
                </div>
              )}
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

      {/* Tab 6: Sound Exploration (聲音探索專用後台頁籤) */}
      {activeTab === 'sound' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 頂部說明與全站文章編輯器跳轉按鈕 */}
          <div className="glass-panel" style={{ padding: '1.5rem 2rem', borderLeft: '4px solid #ec4899', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem', fontFamily: 'var(--font-noto-serif)', margin: 0 }}>
                <Music size={24} style={{ color: '#ec4899' }} />
                聲音探索 (Sound Exploration) 作品管理
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.4rem', margin: 0, lineHeight: 1.6 }}>
                管理聲音探索專題文章與影音作品！文章發布與編輯已全面整合至全站文章發布中心。
              </p>
            </div>
            <button
              onClick={() => {
                setActiveTab('articles');
                setFilterArticleExhibit('sound');
                setArticleSubTab('editor');
              }}
              style={{
                background: 'rgba(236, 72, 153, 0.15)',
                border: '1px solid #ec4899',
                color: '#fff',
                padding: '0.6rem 1.2rem',
                borderRadius: '4px',
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 500
              }}
            >
              <Plus size={16} /> 撰寫聲音探索專題文章
            </button>
          </div>

          {/* 子標籤切換選單 */}
          <div className="glass-panel" style={{ padding: '1.2rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              聲音探索子頁籤篩選：
            </span>
            {['全部分類', '個人聲音探索心得', '青春之歌計畫', '人聲優化歷程記錄'].map((subCat) => {
              const isActive = soundSubCategoryFilter === subCat;
              return (
                <button
                  key={subCat}
                  onClick={() => {
                    setSoundSubCategoryFilter(subCat);
                    if (subCat !== '全部分類') {
                      setMCategory(subCat);
                    }
                  }}
                  style={{
                    padding: '0.5rem 1.2rem',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: isActive ? '#ec4899' : 'rgba(255,255,255,0.1)',
                    background: isActive ? 'rgba(236, 72, 153, 0.15)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {subCat}
                </button>
              );
            })}
          </div>

          {/* 全寬作品與文章橫向卡片列表 */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-noto-serif)', margin: 0 }}>
                聲音探索作品與文章列表 ({
                  musicItems.filter(item => soundSubCategoryFilter === '全部分類' ? ['個人聲音探索心得', '青春之歌計畫', '人聲優化課程', '人聲優化歷程記錄'].includes(item.category || '') : (soundSubCategoryFilter === '人聲優化歷程記錄' ? (item.category === '人聲優化歷程記錄' || item.category === '人聲優化課程') : item.category === soundSubCategoryFilter)).length +
                  writingsItems.filter(item => item.exhibitId === 'sound' && (soundSubCategoryFilter === '全部分類' ? true : (soundSubCategoryFilter === '人聲優化歷程記錄' ? (item.category === '人聲優化歷程記錄' || item.category === '人聲優化課程') : item.category === soundSubCategoryFilter))).length
                })
              </h2>
              <button onClick={fetchMusicItems} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                <RefreshCw size={14} /> 重整
              </button>
            </div>

            {/* 合併渲染 Sound 音樂影音卡片與文章卡片 */}
            {(() => {
              const matchedMusic = musicItems.filter(item => soundSubCategoryFilter === '全部分類' ? ['個人聲音探索心得', '青春之歌計畫', '人聲優化課程', '人聲優化歷程記錄'].includes(item.category || '') : (soundSubCategoryFilter === '人聲優化歷程記錄' ? (item.category === '人聲優化歷程記錄' || item.category === '人聲優化課程') : item.category === soundSubCategoryFilter));
              const matchedWritings = writingsItems.filter(item => item.exhibitId === 'sound' && (soundSubCategoryFilter === '全部分類' ? true : (soundSubCategoryFilter === '人聲優化歷程記錄' ? (item.category === '人聲優化歷程記錄' || item.category === '人聲優化課程') : item.category === soundSubCategoryFilter)));

              if (matchedMusic.length === 0 && matchedWritings.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <Music size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                    <p style={{ letterSpacing: '1px' }}>目前【{soundSubCategoryFilter}】分類下尚無作品或文章。</p>
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* 音樂影音卡片 */}
                  {matchedMusic.map((item) => (
                    <div
                      key={'music-' + item.id}
                      style={{
                        background: 'rgba(0,0,0,0.35)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        padding: '1.2rem 1.5rem',
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1.5rem',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)', padding: '0.15rem 0.6rem', borderRadius: '3px', fontWeight: 500 }}>
                            {item.category || '聲音探索'}
                          </span>
                          <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
                            {item.title}
                          </h3>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#38bdf8', marginBottom: '0.3rem', fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          網址: {item.youtubeUrl}
                        </div>
                        {item.description && (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <button
                          onClick={() => handleEditMusic(item)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            color: '#60a5fa',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Edit3 size={14} /> 編輯
                        </button>
                        <button
                          onClick={() => handleDeleteMusic(item.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#ef4444',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Trash2 size={14} /> 刪除
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* 專題文章卡片 (有限寬度橫向精簡卡片，無全文 dump) */}
                  {matchedWritings.map((item) => (
                    <div
                      key={'writing-' + item.id}
                      style={{
                        background: 'rgba(0,0,0,0.35)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        padding: '1.2rem 1.5rem',
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1.5rem',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.15rem 0.6rem', borderRadius: '3px', fontWeight: 500 }}>
                            {item.category}
                          </span>
                          <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 600, margin: 0, fontFamily: 'var(--font-noto-serif)' }}>
                            {item.title}
                          </h3>
                        </div>
                        {item.excerpt && (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {item.excerpt}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <button
                          onClick={() => {
                            setActiveTab('articles');
                            handleEditWriting(item);
                          }}
                          style={{
                            background: 'rgba(56, 189, 248, 0.1)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            color: '#38bdf8',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Edit3 size={14} /> 編輯文章
                        </button>
                        <button
                          onClick={() => handleDeleteWriting(item.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#ef4444',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Trash2 size={14} /> 刪除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Tab 7: Creation Lab (創作 Lab 專用後台頁籤) */}
      {activeTab === 'creation_lab' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 創作 Lab 說明與全站文章發布中心引導 */}
          <div className="glass-panel" style={{ padding: '1.5rem 2rem', borderLeft: '4px solid #a855f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem', fontFamily: 'var(--font-noto-serif)', margin: 0 }}>
                <Sparkles size={24} style={{ color: '#a855f7' }} />
                創作 Lab (Creation Lab) 專區管理
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.4rem', margin: 0, lineHeight: 1.6 }}>
                管理創作 Lab 的音樂作品與專題文章/FB隨筆備份！文章撰寫與發布已統一於全站文章發布中心處理。
              </p>
            </div>
            <button
              onClick={() => {
                setActiveTab('articles');
                setFilterArticleExhibit('creation_lab');
                setArticleSubTab('editor');
              }}
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid #a855f7',
                color: '#fff',
                padding: '0.6rem 1.2rem',
                borderRadius: '4px',
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 500
              }}
            >
              <Plus size={16} /> 撰寫創作 Lab 文章
            </button>
          </div>

          {/* 創作 Lab 子分類切換 */}
          <div className="glass-panel" style={{ padding: '1.2rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              創作 Lab 類別管理：
            </span>
            <button
              onClick={() => {
                setCreationLabSubTab('music');
                setMCategory('音樂');
              }}
              style={{
                padding: '0.5rem 1.5rem',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: creationLabSubTab === 'music' ? '#a855f7' : 'rgba(255,255,255,0.1)',
                background: creationLabSubTab === 'music' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                color: creationLabSubTab === 'music' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.3s ease',
              }}
            >
              <Music size={16} /> 音樂創作 (YouTube 嵌入)
            </button>
            <button
              onClick={() => setCreationLabSubTab('writings')}
              style={{
                padding: '0.5rem 1.5rem',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: creationLabSubTab === 'writings' ? '#a855f7' : 'rgba(255,255,255,0.1)',
                background: creationLabSubTab === 'writings' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                color: creationLabSubTab === 'writings' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.3s ease',
              }}
            >
              <Edit3 size={16} /> 社群隨筆 / 文章創作 ({
                writingsItems.filter(item => item.exhibitId === 'creation_lab' || !item.exhibitId).length
              })
            </button>
          </div>

          {/* 創作 Lab - 音樂創作 */}
          {creationLabSubTab === 'music' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* 音樂發布簡易區 */}
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <h2 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-noto-serif)' }}>
                  {editingMusicId ? <Edit3 size={20} /> : <Plus size={20} />}
                  {editingMusicId ? '編輯 Lab 音樂創作' : '發布至創作 Lab - 音樂'}
                </h2>

                {musicFormError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.6rem 0.8rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    {musicFormError}
                  </div>
                )}

                <form onSubmit={handleSaveMusic} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
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

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                      曲目簡介 / 創作心得 (選填)
                    </label>
                    <textarea
                      placeholder="簡短寫下音樂創作靈感或紀錄..."
                      value={mDescription}
                      onChange={(e) => setMDescription(e.target.value)}
                      className="museum-input"
                      style={{ maxWidth: '100%', minHeight: '60px', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.8rem' }}>
                    <button
                      type="submit"
                      className="museum-btn"
                      disabled={creatingMusic}
                      style={{ flex: 1, background: 'rgba(168, 85, 247, 0.15)', borderColor: 'rgba(168, 85, 247, 0.35)', color: '#fff' }}
                    >
                      {creatingMusic ? '儲存中...' : (editingMusicId ? '更新 Lab 音樂卡片' : '發布至創作 Lab (音樂)')}
                    </button>
                    {editingMusicId && (
                      <button
                        type="button"
                        onClick={handleCancelMusicEdit}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'var(--text-secondary)',
                          padding: '0.5rem 1rem',
                          borderRadius: '2px',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* 全寬 Lab 音樂列表 */}
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-noto-serif)', margin: 0 }}>
                    創作 Lab - 音樂列表 ({musicItems.filter(item => !['個人聲音探索心得', '青春之歌計畫', '人聲優化課程', '人聲優化歷程記錄'].includes(item.category || '')).length})
                  </h2>
                  <button onClick={fetchMusicItems} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                    <RefreshCw size={14} /> 重整
                  </button>
                </div>

                {musicItems.filter(item => !['個人聲音探索心得', '青春之歌計畫', '人聲優化課程', '人聲優化歷程記錄'].includes(item.category || '')).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <Music size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                    <p style={{ letterSpacing: '1px' }}>目前創作 Lab 尚無音樂作品，請於上方表單發布。</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {musicItems
                      .filter(item => !['個人聲音探索心得', '青春之歌計畫', '人聲優化課程', '人聲優化歷程記錄'].includes(item.category || ''))
                      .map((item) => (
                      <div
                        key={item.id}
                        style={{
                          background: 'rgba(0,0,0,0.35)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          padding: '1.2rem 1.5rem',
                          borderRadius: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1.5rem',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '0.15rem 0.6rem', borderRadius: '3px', fontWeight: 500 }}>
                              創作 Lab - 音樂
                            </span>
                            <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
                              {item.title}
                            </h3>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#38bdf8', marginBottom: '0.3rem', fontFamily: 'monospace' }}>
                            網址: {item.youtubeUrl}
                          </div>
                          {item.description && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                          <button
                            onClick={() => handleEditMusic(item)}
                            style={{
                              background: 'rgba(59, 130, 246, 0.1)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              color: '#60a5fa',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <Edit3 size={14} /> 編輯
                          </button>
                          <button
                            onClick={() => handleDeleteMusic(item.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              color: '#ef4444',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
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

          {/* 創作 Lab - 社群隨筆 / 文章創作 */}
          {creationLabSubTab === 'writings' && (
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-noto-serif)', margin: 0 }}>
                  社群隨筆與文章創作列表 ({writingsItems.filter(item => item.exhibitId === 'creation_lab' || !item.exhibitId).length})
                </h2>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      setActiveTab('articles');
                      setFilterArticleExhibit('creation_lab');
                      setArticleSubTab('editor');
                    }}
                    style={{
                      background: 'rgba(168, 85, 247, 0.15)',
                      border: '1px solid #a855f7',
                      color: '#a855f7',
                      padding: '0.4rem 0.9rem',
                      borderRadius: '4px',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontWeight: 500
                    }}
                  >
                    <Plus size={14} /> 撰寫新文章
                  </button>
                  <button onClick={fetchWritingsItems} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                    <RefreshCw size={14} /> 重整
                  </button>
                </div>
              </div>

              {writingsItems.filter(item => item.exhibitId === 'creation_lab' || !item.exhibitId).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <Edit3 size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <p style={{ letterSpacing: '1px' }}>目前尚無文章備份或創作，可點擊上方按鈕前往全站文章發布中心發布。</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {writingsItems
                    .filter(item => item.exhibitId === 'creation_lab' || !item.exhibitId)
                    .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: 'rgba(0,0,0,0.35)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        padding: '1.2rem 1.5rem',
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1.5rem',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '0.15rem 0.6rem', borderRadius: '3px', fontWeight: 500 }}>
                            {item.category}
                          </span>
                          <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 600, margin: 0, fontFamily: 'var(--font-noto-serif)' }}>
                            {item.title}
                          </h3>
                        </div>

                        {(item.topic || item.fbDate || item.fbUrl) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                            {item.topic && (
                              <span style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', padding: '0.15rem 0.5rem', borderRadius: '3px' }}>
                                📌 {item.topic}
                              </span>
                            )}
                            {item.fbDate && (
                              <span style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.15rem 0.5rem', borderRadius: '3px' }}>
                                📅 FB: {item.fbDate}
                              </span>
                            )}
                            {item.fbUrl && (
                              <a href={item.fbUrl} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '0.15rem 0.5rem', borderRadius: '3px', textDecoration: 'none' }}>
                                🔗 原文連結
                              </a>
                            )}
                          </div>
                        )}

                        {item.excerpt ? (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {item.excerpt}
                          </p>
                        ) : item.content ? (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {item.content.replace(/^[#>]\s*/gm, '')}
                          </p>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <button
                          onClick={() => {
                            setActiveTab('articles');
                            handleEditWriting(item);
                          }}
                          style={{
                            background: 'rgba(168, 85, 247, 0.1)',
                            border: '1px solid rgba(168, 85, 247, 0.25)',
                            color: '#c084fc',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Edit3 size={14} /> 編輯文章
                        </button>
                        <button
                          onClick={() => handleDeleteWriting(item.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#ef4444',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Trash2 size={14} /> 刪除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 8: Universal Article Publisher (全站專題文章發布與管理編輯器 - 獨立頁籤架構) */}
      {activeTab === 'articles' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 頂部功能說明與獨立子頁籤控制列 */}
          <div className="glass-panel" style={{ padding: '1.5rem 2rem', borderLeft: '4px solid #38bdf8' }}>
            <div style={{ marginBottom: '1.2rem' }}>
              <h2 style={{ fontSize: '1.3rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem', fontFamily: 'var(--font-noto-serif)', margin: 0 }}>
                <BookOpen size={24} style={{ color: '#38bdf8' }} />
                全站文章發布與編輯中心
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.4rem', margin: 0, lineHeight: 1.6 }}>
                在此統一管理金融保險、聲音探索、創作 Lab 與跨世代溝通四大展區的所有專題文章！獨立頁籤切換，享受完整寬度的列表管理與順暢的撰寫編輯體驗。
              </p>
            </div>

            {/* 主功能頁籤導覽按鈕 */}
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setArticleSubTab('list')}
                style={{
                  padding: '0.6rem 1.4rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: articleSubTab === 'list' ? '#38bdf8' : 'rgba(255,255,255,0.15)',
                  background: articleSubTab === 'list' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.04)',
                  color: articleSubTab === 'list' ? '#38bdf8' : '#fff',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <BookOpen size={17} />
                📚 全站內容與文章列表 ({
                  writingsItems.length + musicItems.length
                })
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!editingWritingId) {
                    handleCancelWritingEdit();
                  }
                  setArticleSubTab('editor');
                }}
                style={{
                  padding: '0.6rem 1.4rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: articleSubTab === 'editor' ? '#38bdf8' : 'rgba(255,255,255,0.15)',
                  background: articleSubTab === 'editor' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.04)',
                  color: articleSubTab === 'editor' ? '#38bdf8' : '#fff',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease'
                }}
              >
                {editingWritingId ? <Edit3 size={17} /> : <Plus size={17} />}
                {editingWritingId ? `✏️ 編輯文章：${wTitle || '未命名'}` : '✍️ 撰寫與發布新文章'}
              </button>

              <button
                type="button"
                onClick={() => setArticleSubTab('preview')}
                style={{
                  padding: '0.6rem 1.4rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: articleSubTab === 'preview' ? '#38bdf8' : 'rgba(255,255,255,0.15)',
                  background: articleSubTab === 'preview' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.04)',
                  color: articleSubTab === 'preview' ? '#38bdf8' : '#fff',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <Eye size={17} />
                👁️ 前台閱讀內頁實時預覽
              </button>
            </div>
          </div>

          {/* 子頁籤 1：📚 文章與音樂列表與管理 (獨立全寬顯示) */}
          {articleSubTab === 'list' && (
            <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
              {/* 頂部分類篩選與快速按鈕 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { id: 'all', name: '全部展區' },
                    { id: 'finance_insurance', name: '商業議題分析' },
                    { id: 'sound', name: '聲音探索' },
                    { id: 'creation_lab', name: '創作 Lab' },
                    { id: 'communication', name: '人生擺渡' },
                  ].map((tab) => {
                    const isActive = filterArticleExhibit === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setFilterArticleExhibit(tab.id)}
                        style={{
                          padding: '0.45rem 1rem',
                          borderRadius: '3px',
                          border: '1px solid',
                          borderColor: isActive ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                          background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                          color: isActive ? '#fff' : 'var(--text-secondary)',
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        {tab.name}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      handleCancelWritingEdit();
                      setArticleSubTab('editor');
                    }}
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid #38bdf8',
                      color: '#38bdf8',
                      padding: '0.45rem 1rem',
                      borderRadius: '4px',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontWeight: 500
                    }}
                  >
                    <Plus size={15} /> 撰寫新文章
                  </button>

                  <button onClick={fetchWritingsItems} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
                    <RefreshCw size={14} /> 重整
                  </button>
                </div>
              </div>

              {(() => {
                const combined = [
                  ...writingsItems.map((item) => ({
                    id: item.id,
                    exhibitId: item.exhibitId || 'creation_lab',
                    category: item.category || '專題文章',
                    title: item.title,
                    views: item.views || 0,
                    createdAt: item.createdAt,
                    isPinned: item.isPinned,
                    isHidden: item.isHidden,
                    type: 'writing' as const,
                    rawWritingItem: item,
                  })),
                  ...musicItems.map((item) => {
                    const isSound = ['個人聲音探索心得', '青春之歌計畫', '人聲優化課程', '人聲優化歷程記錄'].includes(item.category || '');
                    return {
                      id: item.id,
                      exhibitId: isSound ? 'sound' : 'creation_lab',
                      category: item.category || '音樂創作',
                      title: item.title,
                      views: 0,
                      createdAt: item.createdAt,
                      isPinned: false,
                      isHidden: false,
                      type: 'music' as const,
                      rawMusicItem: item,
                    };
                  }),
                ];

                const filtered = combined.filter((item) =>
                  filterArticleExhibit === 'all' ? true : item.exhibitId === filterArticleExhibit
                );

                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--text-secondary)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                      <BookOpen size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                      <p style={{ letterSpacing: '1px' }}>此篩選分類下尚無文章或音樂作品，點擊右上角「撰寫新文章」開始發布。</p>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {/* 全寬表格標頭 */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '0.5rem 1.2rem', 
                      fontSize: '0.78rem', 
                      color: 'var(--text-secondary)', 
                      letterSpacing: '1px', 
                      textTransform: 'uppercase',
                      borderBottom: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <span style={{ flex: 1 }}>文章 / 音樂作品主題與標題</span>
                      <span style={{ width: '130px', textAlign: 'center' }}>點擊率 / 類型</span>
                      <span style={{ width: '110px', textAlign: 'center' }}>建立日期</span>
                      <span style={{ width: '230px', textAlign: 'center' }}>管理操作</span>
                    </div>

                    {filtered.map((item) => (
                      <div
                        key={item.type + '-' + item.id}
                        style={{
                          background: 'rgba(0,0,0,0.35)',
                          border: item.isPinned ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                          padding: '0.8rem 1.2rem',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1.2rem',
                          transition: 'all 0.2s ease',
                          opacity: item.isHidden ? 0.65 : 1
                        }}
                      >
                        {/* 左側：狀態標籤、展區與標題 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flex: 1, minWidth: 0 }}>
                          {item.type === 'music' && (
                            <span style={{ fontSize: '0.72rem', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid #c084fc', padding: '0.15rem 0.5rem', borderRadius: '3px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              🎵 音樂
                            </span>
                          )}
                          {item.isPinned && (
                            <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid #38bdf8', padding: '0.15rem 0.5rem', borderRadius: '3px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              📌 置頂
                            </span>
                          )}
                          {item.isHidden && (
                            <span style={{ fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.15rem 0.5rem', borderRadius: '3px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              🙈 隱藏
                            </span>
                          )}

                          <span style={{ fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: '0.18rem 0.55rem', borderRadius: '3px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {EXHIBIT_MAP[item.exhibitId || 'creation_lab']?.split(' ')[0] || item.exhibitId}
                          </span>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '0.18rem 0.55rem', borderRadius: '3px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {item.category === 'FB文章備份' ? '社群隨筆' : item.category}
                          </span>

                          <h3 
                            style={{ 
                              color: '#fff', 
                              fontSize: '0.95rem', 
                              fontWeight: 500, 
                              fontFamily: 'var(--font-noto-serif)', 
                              margin: 0,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: 1,
                              minWidth: 0
                            }}
                            title={item.title}
                          >
                            {item.title}
                          </h3>
                        </div>

                        {/* 中間：點擊率 / 影音標籤 */}
                        <div style={{ flexShrink: 0, width: '130px', textAlign: 'center' }}>
                          {item.type === 'writing' ? (
                            <span style={{ fontSize: '0.85rem', color: '#4ade80', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                              <Eye size={14} /> {item.views} 次點擊
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                              🎬 YouTube 影音
                            </span>
                          )}
                        </div>

                        {/* 中間：建立時間 */}
                        <div style={{ flexShrink: 0, width: '110px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-TW') : '近期'}
                          </span>
                        </div>

                        {/* 右側：單列管理操作按鈕區 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, width: '230px', justifyContent: 'flex-end' }}>
                          {item.type === 'writing' ? (
                            <>
                              <button
                                onClick={() => handleToggleWritingPin(item.rawWritingItem)}
                                title={item.isPinned ? '取消置頂' : '該分類置頂'}
                                style={{
                                  background: item.isPinned ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                  border: item.isPinned ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                                  color: item.isPinned ? '#38bdf8' : 'var(--text-secondary)',
                                  padding: '0.3rem 0.6rem',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                📌 {item.isPinned ? '取消' : '置頂'}
                              </button>

                              <button
                                onClick={() => handleToggleWritingHidden(item.rawWritingItem)}
                                title={item.isHidden ? '恢復顯示' : '隱藏文章'}
                                style={{
                                  background: item.isHidden ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                  border: item.isHidden ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                  color: item.isHidden ? '#f87171' : 'var(--text-secondary)',
                                  padding: '0.3rem 0.6rem',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                {item.isHidden ? '👁️ 顯示' : '🙈 隱藏'}
                              </button>

                              <button
                                onClick={() => handleEditWriting(item.rawWritingItem)}
                                title="編輯文章內容"
                                style={{
                                  background: 'rgba(56, 189, 248, 0.1)',
                                  border: '1px solid rgba(56, 189, 248, 0.25)',
                                  color: '#38bdf8',
                                  padding: '0.3rem 0.6rem',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                <Edit3 size={14} />
                                編輯
                              </button>

                              <button
                                onClick={() => handleDeleteWriting(item.id)}
                                title="刪除文章"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  color: '#ef4444',
                                  padding: '0.3rem 0.6rem',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                <Trash2 size={14} />
                                刪除
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setActiveTab(item.exhibitId === 'sound' ? 'sound' : 'creation_lab');
                                  handleEditMusic(item.rawMusicItem);
                                }}
                                title="編輯音樂影音創作"
                                style={{
                                  background: 'rgba(168, 85, 247, 0.15)',
                                  border: '1px solid rgba(168, 85, 247, 0.3)',
                                  color: '#c084fc',
                                  padding: '0.3rem 0.8rem',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                <Edit3 size={14} />
                                編輯影音
                              </button>

                              <button
                                onClick={() => handleDeleteMusic(item.id)}
                                title="刪除音樂創作"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  color: '#ef4444',
                                  padding: '0.3rem 0.6rem',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                <Trash2 size={14} />
                                刪除
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* 子頁籤 2：✍️ 撰寫與發布新文章 / ✏️ 編輯文章 (獨立全寬顯示) */}
          {articleSubTab === 'editor' && (
            <div className="glass-panel animate-fade-in" style={{ padding: '2.5rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h2 style={{ fontSize: '1.3rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem', fontFamily: 'var(--font-noto-serif)', margin: 0 }}>
                  {editingWritingId ? <Edit3 size={22} style={{ color: '#38bdf8' }} /> : <Plus size={22} style={{ color: '#38bdf8' }} />}
                  {editingWritingId ? '編輯專題文章內文與屬性' : '撰寫與發布全新專題文章'}
                </h2>

                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setArticleSubTab('preview')}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      padding: '0.45rem 1rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <Eye size={15} /> 實時排版預覽
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelWritingEdit}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'var(--text-secondary)',
                      padding: '0.45rem 1rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <X size={15} /> 返回列表
                  </button>
                </div>
              </div>

              {writingFormError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', padding: '0.8rem 1rem', borderRadius: '4px', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
                  {writingFormError}
                </div>
              )}

              <form onSubmit={handleCreateOrUpdateWriting} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 500 }}>
                      目標展區 *
                    </label>
                    <select
                      value={wExhibitId}
                      onChange={(e) => {
                        const newEx = e.target.value;
                        setWExhibitId(newEx);
                        if (newEx === 'finance_insurance') setWCategory('投資');
                        else if (newEx === 'sound') setWCategory('個人聲音探索心得');
                        else if (newEx === 'creation_lab') setWCategory('社群隨筆');
                        else if (newEx === 'communication') setWCategory('Maxupport 人生擺渡');
                      }}
                      className="museum-input"
                      style={{ maxWidth: '100%', padding: '0.75rem' }}
                    >
                      <option value="finance_insurance">商業議題分析</option>
                      <option value="sound">聲音探索</option>
                      <option value="creation_lab">創作 Lab</option>
                      <option value="communication">人生擺渡</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 500 }}>
                      子標籤 / 分類 *
                    </label>
                    <select
                      value={wCategory}
                      onChange={(e) => setWCategory(e.target.value)}
                      className="museum-input"
                      style={{ maxWidth: '100%', padding: '0.75rem' }}
                    >
                      {wExhibitId === 'finance_insurance' && (
                        <>
                          <option value="投資">投資</option>
                          <option value="保險">保險</option>
                          <option value="財務會計">財務會計</option>
                        </>
                      )}
                      {wExhibitId === 'sound' && (
                        <>
                          <option value="個人聲音探索心得">個人聲音探索心得</option>
                          <option value="人聲優化歷程記錄">人聲優化歷程記錄</option>
                          <option value="青春之歌計畫">青春之歌計畫</option>
                        </>
                      )}
                      {wExhibitId === 'creation_lab' && (
                        <>
                          <option value="社群隨筆">社群隨筆</option>
                          <option value="小說">小說</option>
                        </>
                      )}
                      {wExhibitId === 'communication' && (
                        <>
                          <option value="Maxupport 人生擺渡">Maxupport 人生擺渡</option>
                          <option value="團隊增員">團隊增員</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 500 }}>
                    文章/作品標題 *
                  </label>
                  <input
                    type="text"
                    placeholder={(wCategory === '人聲優化歷程記錄' || wCategory === '人聲優化課程') ? '例如: 《聽海》人聲優化與歌唱進步紀錄' : '例如: 【聲音靈感筆記】聲音質地優化與日常語調重塑'}
                    value={wTitle}
                    onChange={(e) => setWTitle(e.target.value)}
                    className="museum-input"
                    style={{ maxWidth: '100%', padding: '0.75rem', fontSize: '1.05rem' }}
                    required
                  />
                </div>

                {(wCategory === '人聲優化歷程記錄' || wCategory === '人聲優化課程') && (
                  <div style={{
                    background: 'rgba(236, 72, 153, 0.05)',
                    border: '1px solid rgba(236, 72, 153, 0.3)',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ fontSize: '0.82rem', color: '#f472b6', letterSpacing: '1px', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 600 }}>
                        📷 封面顯示圖片 (選填，將顯示於前台展覽卡片上方)
                      </label>
                      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          placeholder="https://... 或點擊右側按鈕選擇電腦圖片上傳"
                          value={wCoverImage}
                          onChange={(e) => setWCoverImage(e.target.value)}
                          className="museum-input"
                          style={{ flex: 1, minWidth: '240px', padding: '0.65rem' }}
                        />
                        <label className="museum-btn" style={{ cursor: 'pointer', background: 'rgba(236,72,153,0.2)', border: '1px solid rgba(236,72,153,0.5)', color: '#f472b6', padding: '0.65rem 1.2rem', borderRadius: '4px', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Upload size={14} />
                          {uploadingCoverImage ? '上傳中...' : '選擇電腦圖片上傳'}
                          <input type="file" accept="image/*" onChange={handleCoverImageUpload} style={{ display: 'none' }} disabled={uploadingCoverImage} />
                        </label>
                        {wCoverImage && (
                          <button
                            type="button"
                            onClick={() => setWCoverImage('')}
                            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '0.65rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                          >
                            清除圖片
                          </button>
                        )}
                      </div>
                      {wCoverImage && (
                        <div style={{ marginTop: '0.8rem', width: '220px', height: '125px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(236, 72, 153, 0.4)', position: 'relative' }}>
                          <img src={wCoverImage} alt="Cover Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
                      <div>
                        <h4 style={{ color: '#f472b6', margin: 0, fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          🎙️ 多版本時間軸錄音管理 ({wVocalVersions.length} / 10 個版本)
                        </h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0.3rem 0 0 0' }}>
                          為這首歌添加不同演進階段的錄音/影片（最高可保留 10 個版本）。
                        </p>
                      </div>
                      {wVocalVersions.length < 10 && (
                        <button
                          type="button"
                          onClick={() => {
                            setWVocalVersions([
                              ...wVocalVersions,
                              {
                                id: 'v_' + Date.now(),
                                versionTitle: `Ver ${wVocalVersions.length + 1}.0 階段錄音`,
                                date: new Date().toISOString().split('T')[0],
                                youtubeUrl: '',
                                notes: ''
                              }
                            ]);
                          }}
                          className="museum-btn"
                          style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem', borderColor: '#f472b6', color: '#f472b6' }}
                        >
                          + 新增演進版本 (最高 10 個)
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                      {wVocalVersions.map((ver, idx) => (
                        <div key={ver.id || idx} style={{
                          background: 'rgba(0,0,0,0.35)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '6px',
                          padding: '1.1rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f472b6', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              📌 版本 {idx + 1} of {wVocalVersions.length}
                            </span>
                            {wVocalVersions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setWVocalVersions(wVocalVersions.filter((_, i) => i !== idx));
                                }}
                                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer' }}
                              >
                                🗑️ 刪除此版本
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.8rem' }}>
                            <div>
                              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                                版本名稱 (例如: Ver 1.0 課程前初測錄音)
                              </label>
                              <input
                                type="text"
                                placeholder="例如: Ver 1.0 課程前初測"
                                value={ver.versionTitle}
                                onChange={(e) => {
                                  const updated = [...wVocalVersions];
                                  updated[idx].versionTitle = e.target.value;
                                  setWVocalVersions(updated);
                                }}
                                className="museum-input"
                                style={{ maxWidth: '100%', padding: '0.55rem', fontSize: '0.88rem' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                                錄音日期 / 階段說明 (例如: 2024-03-01 或 第 1 週)
                              </label>
                              <input
                                type="text"
                                placeholder="例如: 2024-03-01"
                                value={ver.date}
                                onChange={(e) => {
                                  const updated = [...wVocalVersions];
                                  updated[idx].date = e.target.value;
                                  setWVocalVersions(updated);
                                }}
                                className="museum-input"
                                style={{ maxWidth: '100%', padding: '0.55rem', fontSize: '0.88rem' }}
                              />
                            </div>
                          </div>

                          <div style={{ marginBottom: '0.8rem' }}>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                              YouTube 影片網址 (此版本)
                            </label>
                            <input
                              type="text"
                              placeholder="https://www.youtube.com/watch?v=..."
                              value={ver.youtubeUrl}
                              onChange={(e) => {
                                const updated = [...wVocalVersions];
                                updated[idx].youtubeUrl = e.target.value;
                                setWVocalVersions(updated);
                              }}
                              className="museum-input"
                              style={{ maxWidth: '100%', padding: '0.55rem', fontSize: '0.88rem' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                              階段發聲技巧與進步註記 (選填)
                            </label>
                            <textarea
                              placeholder="例如: 調整共鳴位置，高音發聲更加放鬆..."
                              value={ver.notes}
                              onChange={(e) => {
                                const updated = [...wVocalVersions];
                                updated[idx].notes = e.target.value;
                                setWVocalVersions(updated);
                              }}
                              className="museum-input"
                              style={{ maxWidth: '100%', minHeight: '60px', padding: '0.55rem', fontSize: '0.88rem', resize: 'vertical' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(wCategory !== '人聲優化歷程記錄' && wCategory !== '人聲優化課程') && (
                  <>
                    <div>
                      <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 500 }}>
                        文章主題 (選填)
                      </label>
                      <input
                        type="text"
                        placeholder="例如: 職涯筆記 / 保險隨想 / 聲音探索"
                        value={wTopic}
                        onChange={(e) => setWTopic(e.target.value)}
                        className="museum-input"
                        style={{ maxWidth: '100%', padding: '0.7rem' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 500 }}>
                          FB 上線時間 (選填)
                        </label>
                        <input
                          type="text"
                          placeholder="例如: 2024-05-20"
                          value={wFbDate}
                          onChange={(e) => setWFbDate(e.target.value)}
                          className="museum-input"
                          style={{ maxWidth: '100%', padding: '0.7rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 500 }}>
                          FB 原文連結 (選填)
                        </label>
                        <input
                          type="url"
                          placeholder="https://facebook.com/..."
                          value={wFbUrl}
                          onChange={(e) => setWFbUrl(e.target.value)}
                          className="museum-input"
                          style={{ maxWidth: '100%', padding: '0.7rem' }}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500 }}>
                      摘要引言 (選填，顯示於前台卡片)
                    </label>
                    {wContent.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          const clean = wContent.replace(/^[#>]\s*/gm, '').trim();
                          setWExcerpt(clean.slice(0, 100) + (clean.length > 100 ? '...' : ''));
                        }}
                        style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}
                      >
                        ⚡ 自內文自動擷取 100 字摘要
                      </button>
                    )}
                  </div>
                  <textarea
                    placeholder="2~3 句精闢摘要，勾勒文章核心重點..."
                    value={wExcerpt}
                    onChange={(e) => setWExcerpt(e.target.value)}
                    className="museum-input"
                    style={{ maxWidth: '100%', minHeight: '80px', resize: 'vertical', padding: '0.75rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', fontWeight: 500 }}>
                    文章內文 (支援從 Google Docs 直接複製貼上) *
                  </label>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginBottom: '0.6rem', lineHeight: 1.5 }}>
                    💡 提示：輸入 <code style={{ color: '#38bdf8' }}>一、</code> 或 <code style={{ color: '#38bdf8' }}>#</code> 可轉為章節標題；段落開頭輸入 <code style={{ color: '#f472b6' }}>&gt; </code> 可轉為亮點金句引言框。
                  </div>
                  <textarea
                    placeholder="請在此貼上自 Google Docs 複製的文章內文..."
                    value={wContent}
                    onChange={(e) => setWContent(e.target.value)}
                    className="museum-input"
                    style={{ maxWidth: '100%', minHeight: '380px', resize: 'vertical', lineHeight: '1.75', fontFamily: 'var(--font-noto-sans)', padding: '1rem', fontSize: '0.95rem' }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 500 }}>
                      YouTube 影片連結 (選填，文章內頁自動內嵌)
                    </label>
                    <input
                      type="text"
                      placeholder="例如: https://www.youtube.com/watch?v=xxx 或 https://youtu.be/xxx"
                      value={wYoutubeUrl}
                      onChange={(e) => setWYoutubeUrl(e.target.value)}
                      className="museum-input"
                      style={{ maxWidth: '100%', padding: '0.7rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', letterSpacing: '1px', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 500 }}>
                      排序權重 (Order, 越小越靠前)
                    </label>
                    <input
                      type="number"
                      value={wOrder}
                      onChange={(e) => setWOrder(parseInt(e.target.value) || 0)}
                      className="museum-input"
                      style={{ maxWidth: '100%', padding: '0.7rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button
                    type="submit"
                    className="museum-btn"
                    disabled={creatingWriting}
                    style={{ flex: 1, background: 'rgba(56, 189, 248, 0.2)', borderColor: '#38bdf8', color: '#fff', fontSize: '1rem', padding: '0.8rem', fontWeight: 600 }}
                  >
                    {creatingWriting ? '發布儲存中...' : (editingWritingId ? '💾 儲存文章變更並返回列表' : '🚀 發布文章至全站展區')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelWritingEdit}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'var(--text-secondary)',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    取消
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 子頁籤 3：👁️ 前台閱讀內頁實時預覽 (獨立全寬顯示) */}
          {articleSubTab === 'preview' && (
            <div className="glass-panel animate-fade-in" style={{ padding: '2.5rem', maxWidth: '900px', margin: '0 auto', width: '100%', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.9rem', color: '#38bdf8', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  <Eye size={18} />
                  前台閱讀內頁實時預覽
                </div>
                <span style={{ fontSize: '0.8rem', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: '0.3rem 0.8rem', borderRadius: '4px', fontWeight: 500 }}>
                  {EXHIBIT_MAP[wExhibitId] || wExhibitId} • {wCategory}
                </span>
              </div>

              <div style={{ color: '#fff' }}>
                <h1 style={{ fontSize: '2.1rem', fontWeight: 300, fontFamily: 'var(--font-noto-serif)', lineHeight: 1.4, marginBottom: '1.2rem', color: '#fff' }}>
                  {wTitle || '（尚未輸入文章標題）'}
                </h1>

                {wExcerpt && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '2rem', fontStyle: 'italic', paddingLeft: '1rem', borderLeft: '3px solid rgba(56, 189, 248, 0.5)' }}>
                    {wExcerpt}
                  </p>
                )}

                {wYoutubeUrl && (
                  <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', borderRadius: '8px', overflow: 'hidden', margin: '2rem 0', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', fontSize: '0.95rem' }}>
                      🎬 預覽內嵌播放器: {wYoutubeUrl}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '1.05rem', lineHeight: 1.9, color: 'rgba(255,255,255,0.88)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.8rem' }}>
                  {wContent.trim() ? wContent.split('\n').map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    if (trimmed.startsWith('#') || /^[一二三四五六七八九十]+[、.]/.test(trimmed)) {
                      return <h3 key={idx} style={{ fontSize: '1.4rem', color: '#fff', fontFamily: 'var(--font-noto-serif)', marginTop: '2rem', marginBottom: '1rem', borderLeft: '4px solid #38bdf8', paddingLeft: '0.9rem' }}>{trimmed.replace(/^#+\s*/, '')}</h3>;
                    }
                    if (trimmed.startsWith('>') || trimmed.startsWith('「')) {
                      return <blockquote key={idx} style={{ margin: '1.5rem 0', padding: '1.2rem 1.6rem', background: 'rgba(255,255,255,0.03)', borderLeft: '4px solid #f472b6', borderRadius: '0 4px 4px 0', fontSize: '1.05rem', fontStyle: 'italic', color: '#fff' }}>{trimmed.replace(/^>\s*/, '')}</blockquote>;
                    }
                    return <p key={idx} style={{ marginBottom: '1.2rem', whiteSpace: 'pre-line' }}>{trimmed}</p>;
                  }) : <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '3rem 0' }}>請在左側輸入或貼上文章內文以查看預覽...</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
