import 'server-only';
import { after } from 'next/server';
import { newsletterConfig } from '@/lib/newsletter-config';
import { processNewsletterQueue } from '@/lib/newsletter-queue';

// Best-effort acceleration only. The transactionally saved outbox plus the
// Google timer remain the durable fallback if this request's after-hook is lost.
export function kickNewsletterQueue() {
  const config = newsletterConfig();
  if (!config.configured || (!config.enabled && !config.syncEnabled && !config.autoUpdatesEnabled)) return;
  after(async () => {
    try { await processNewsletterQueue(3); }
    catch { console.error('[Newsletter] Queue remains saved for scheduled processing'); }
  });
}
