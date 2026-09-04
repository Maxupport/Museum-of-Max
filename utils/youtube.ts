/**
 * YouTube 網址轉換工具
 * 自動將各式 YouTube 網址 (watch, shorts, youtu.be) 轉換為極致相容的嵌入式防護位址 (youtube-nocookie.com/embed/VIDEO_ID)
 */
export function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // 正則解析 11 碼 YouTube 影片 ID
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);

  if (match && match[2].length === 11) {
    const videoId = match[2];
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  }

  // 若本身已經是 embed 格式，則傳回安全的 nocookie 位址
  if (trimmed.includes('/embed/')) {
    return trimmed.replace('youtube.com', 'youtube-nocookie.com');
  }

  return null;
}
