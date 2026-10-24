// Stored chapter content may opt in to a protected illustration, never an arbitrary URL.
export function chapterIllustrationUrl(chapterId: string, content: string): string | null {
  if (!/^[\w-]{1,128}$/.test(chapterId)) return null;
  try {
    const parsed = JSON.parse(content);
    return parsed?.illustration === true && typeof parsed.textContent === 'string'
      ? `/api/novel-illustrations/${chapterId}` : null;
  } catch { return null; }
}
