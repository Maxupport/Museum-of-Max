export type ArticlePublicationTiming = {
  state: 'scheduled' | 'published' | 'blocked';
  scheduledAt: string;
  publishedAt: string | null;
  preview: boolean;
};

export function formatPublicationTime(value: string) {
  if (!Number.isFinite(Date.parse(value))) return '時間資料無效';
  return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}

export function articlePublicationLabel(timing: ArticlePublicationTiming | undefined, hidden: boolean, available = true) {
  if (!available) return '上線時間暫時無法讀取';
  if (!timing) return hidden ? '尚未排程' : '已公開・上線時間未記錄';
  if (timing.state === 'blocked') return `發布受阻・原定 ${formatPublicationTime(timing.scheduledAt)}`;
  if (timing.state === 'scheduled') return `${hidden ? '預定上線' : '已公開・原定'} ${formatPublicationTime(timing.scheduledAt)}`;
  const label = hidden ? '目前隱藏・曾上線' : timing.preview ? '試讀上線' : '實際上線';
  return timing.publishedAt ? `${label} ${formatPublicationTime(timing.publishedAt)}` : `${label}時間未記錄`;
}
