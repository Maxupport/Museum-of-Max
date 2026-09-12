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
    title: '新創 / 風險投資',
    subtitle: 'Investment Experience',
    color: 'var(--theme-vc, #38bdf8)',
    desc: '早期投資 / 創投項目評估 / 天使引路計畫 / 募資 FA 服務',
    subcategories: ['早期投資', '創投項目評估', '天使引路計畫', '募資 FA 服務'],
    hasBlog: false,
  },
  career: {
    id: 'career',
    title: '職涯履歷',
    subtitle: 'Max’s Career / About Max',
    color: 'var(--theme-career, #f59e0b)',
    desc: '跨界職涯軌跡 / 時間軸歷程 / 重點里程碑與成果',
    subcategories: [],
    hasBlog: false,
    isTimeline: true,
  },
  finance_insurance: {
    id: 'finance_insurance',
    title: '商業議題分析',
    subtitle: 'Business Insights',
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
    desc: '小說連載 / 社群隨筆',
    subcategories: ['小說', '社群隨筆'],
    hasBlog: true,
  },
  communication: {
    id: 'communication',
    title: '人生擺渡',
    subtitle: 'Career Re-Evaluation',
    color: 'var(--theme-corp, #6366f1)',
    desc: 'Maxupport 人生擺渡 / 團隊增員計畫',
    subcategories: ['Maxupport 人生擺渡', '團隊增員'],
    hasBlog: true,
  },
};

export const EXHIBIT_MAP: Record<string, string> = {
  vc: '新創 / 風險投資 (Investment Experience)',
  career: '職涯履歷 (Max’s Career / About Max)',
  finance_insurance: '商業議題分析 (Business Insights)',
  sound: '聲音探索 (Sound Exploration)',
  creation_lab: '創作 Lab (Creation Lab)',
  creation_lab_novel: '創作 Lab - 小說連載 (直通門票)',
  communication: '人生擺渡 (Career Re-Evaluation)',
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

