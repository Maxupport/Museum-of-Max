export interface SubCategory {
  id: string;
  name: string;
}

export interface ExhibitConfig {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  desc: string;
  subcategories: string[];
  hasBlog: boolean;
  isTimeline?: boolean;
}

export const EXHIBITS: Record<string, ExhibitConfig> = {
  vc: {
    id: 'vc',
    title: '風險投資',
    subtitle: 'Venture Capital',
    color: 'var(--theme-vc, #38bdf8)',
    desc: '早期投資 / 新創項目評估 / 募資 FA 服務',
    subcategories: ['早期投資', '新創項目評估', '募資 FA 服務'],
    hasBlog: false,
  },
  career: {
    id: 'career',
    title: '職涯經歷',
    subtitle: 'Career Experience',
    color: 'var(--theme-career, #f59e0b)',
    desc: '跨界職涯軌跡 / 時間軸歷程 / 重點里程碑與成果',
    subcategories: [],
    hasBlog: false,
    isTimeline: true,
  },
  finance_insurance: {
    id: 'finance_insurance',
    title: '金融保險議題分析',
    subtitle: 'Financial & Insurance Issues',
    color: 'var(--theme-audit, #10b981)',
    desc: '投資趨勢 / 保險規劃與風險控管 / 財務會計稽核實務',
    subcategories: ['投資', '保險', '財務會計'],
    hasBlog: true,
  },
  sound: {
    id: 'sound',
    title: '聲音探索',
    subtitle: 'Sound Exploration',
    color: 'var(--theme-music, #ec4899)',
    desc: '個人聲音探索心得 / 青春之歌計畫 / 人聲優化課程',
    subcategories: ['個人聲音探索心得', '青春之歌計畫', '人聲優化課程'],
    hasBlog: true,
  },
  creation_lab: {
    id: 'creation_lab',
    title: '創作 Lab',
    subtitle: 'Creation Lab',
    color: 'var(--theme-possibility, #a855f7)',
    desc: '小說連載 / 音樂創作與探尋 / 其他文字創作',
    subcategories: ['小說', '音樂', '其他文字'],
    hasBlog: true,
  },
  communication: {
    id: 'communication',
    title: '跨世代溝通',
    subtitle: 'Cross-gen Communication',
    color: 'var(--theme-corp, #6366f1)',
    desc: 'Maxupport 生涯擺渡 / 保險團隊增員計畫',
    subcategories: ['Maxupport 生涯擺渡', '保險團隊增員'],
    hasBlog: true,
  },
};

export const EXHIBIT_MAP: Record<string, string> = {
  vc: '風險投資 (Venture Capital)',
  career: '職涯經歷 (Career Experience)',
  finance_insurance: '金融保險議題分析 (Financial & Insurance)',
  sound: '聲音探索 (Sound Exploration)',
  creation_lab: '創作 Lab (Creation Lab)',
  creation_lab_novel: '創作 Lab - 小說連載 (直通門票)',
  communication: '跨世代溝通 (Cross-gen Communication)',
};

export const ALL_EXHIBIT_KEYS = Object.keys(EXHIBITS);

export const PASSCODE_PERM_KEYS = [
  'vc',
  'career',
  'finance_insurance',
  'sound',
  'creation_lab',
  'creation_lab_novel',
  'communication',
];

export const YOUTH_SONGS_YOUTUBE_CHANNEL = {
  name: '哼唱自己青春的歌 start from 1980',
  url: 'https://www.youtube.com/@OLDSONGSCOVEREDstartFrom1980',
  description: '歡迎訂閱「哼唱自己青春的歌 start from 1980」YouTube 頻道，聆聽更多經典青春回憶與音樂創作！'
};

