export interface NovelChapter {
  id: string;
  novelId: string;
  novelTitle: string;
  chapterNum: number;
  title: string;
  publishedDate: string;
  readTime: string;
  excerpt: string;
  content: string[];
}

export interface NovelBook {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  status: '連載中' | '已完結';
  totalChapters: number;
  latestUpdate: string;
  description: string;
  coverColor: string;
  chapters: NovelChapter[];
}

// 模擬示範小說資料 (按指示暫時移除)
export const MOCK_NOVELS: Record<string, NovelBook> = {};
