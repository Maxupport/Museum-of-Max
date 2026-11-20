// 只記錄允許的錯誤代碼，不將例外全文、收件人、信件或憑證寫入日誌。
export function newsletterErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const value = error as { name?: string; code?: string };
    if (value.name === 'AbortError' || value.name === 'TimeoutError') return 'TIMEOUT';
    if (typeof value.code === 'string' && /^(P\d{4}|BRIDGE_HTTP_[45]\d{2}|BRIDGE_RESPONSE_INVALID)$/.test(value.code)) return value.code;
  }
  return 'UNEXPECTED_ERROR';
}

export function logNewsletterWorker(data: { requestId: string; stage: string; outcome: string; elapsedMs: number; code?: string }) {
  const line = '[NewsletterWorker] ' + JSON.stringify(data);
  if (data.outcome === 'failed') console.error(line);
  else if (data.code) console.warn(line);
  else console.info(line);
}
