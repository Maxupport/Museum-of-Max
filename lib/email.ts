import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://museum-of-max.vercel.app';
const DEFAULT_FROM = process.env.EMAIL_FROM || 'Maxupport 小說連載 <onboarding@resend.dev>';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

function safeLink(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return escapeHtml(url.href);
  } catch { /* Invalid URLs must not become executable email links. */ }
  return '#';
}

interface SendWelcomeEmailParams {
  email: string;
  name?: string | null;
  novelTitle?: string;
  novelId?: string;
  unsubscribeToken?: string | null;
  isTest?: boolean;
}

interface SendChapterUpdateParams {
  email: string;
  name?: string | null;
  novelTitle: string;
  chapterTitle: string;
  summary?: string | null;
  chapterUrl: string;
  unsubscribeToken?: string | null;
  messageType?: 'update' | 'announcement';
  isTest?: boolean;
}

/**
 * 產生信件共用底部 HTML (包含法規強制之取消訂閱連結)
 */
function renderEmailFooter(unsubscribeToken?: string | null, isTest = false): string {
  if (!unsubscribeToken) return `<p style="margin-top:32px;color:#888;font-size:12px;text-align:center;">${isTest ? '此為管理者驗收測試信，不會新增訂閱；請由測試歡迎信驗證退訂流程。' : '若需協助取消通知，請聯絡策展人。'} <a href="mailto:maxupport@gmail.com">聯絡策展人</a></p>`;
  const unsubscribeUrl = safeLink(`${SITE_URL}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`);

  return `
    <div style="margin-top: 36px; padding-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center; font-size: 12px; color: #888888; line-height: 1.6;">
      <p style="margin: 0 0 8px 0;">
        這封信件是由 <strong>Maxupport 私人博物館</strong> 發送給小說連載訂閱讀者。
      </p>
      <p style="margin: 0;">
        若您未來不再希望收到更新通知，可點擊此處
        <a href="${unsubscribeUrl}" style="color: #60a5fa; text-decoration: underline;" target="_blank">取消訂閱</a>。
      </p>
    </div>
  `;
}

/**
 * 寄送「歡迎訂閱信」
 */
export async function sendWelcomeEmail({
  email,
  name,
  novelTitle = '原創小說連載',
  novelId,
  unsubscribeToken,
  isTest = false,
}: SendWelcomeEmailParams, prepareOnly = false) {
  if (!resend && !prepareOnly) {
    console.warn('[Resend] RESEND_API_KEY 未設定，跳過寄送歡迎信');
    return { ok: false, error: 'RESEND_API_KEY 未設定' };
  }

  const readerGreeting = name ? `${escapeHtml(name)} 您好` : '親愛的讀者 您好';
  const subject = `${isTest ? '【測試】' : ''}感謝訂閱《${novelTitle}》連載更新 | Maxupport 私人博物館`;
  novelTitle = escapeHtml(novelTitle);
  const targetNovelUrl = safeLink(novelId
    ? `${SITE_URL}/museum/creation_lab/novel/${encodeURIComponent(novelId)}`
    : `${SITE_URL}/novels`);

  const html = `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="utf-8">
      <title>歡迎訂閱《${novelTitle}》</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0b0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans TC', sans-serif; color: #e5e5e5;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0b0e; padding: 40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background: rgba(22, 22, 28, 0.95); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 36px 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
              <tr>
                <td>
                  <!-- 標頭 -->
                  <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #c084fc; font-weight: 600; margin-bottom: 8px;">
                    MAXUPPORT PRIVATE MUSEUM • NOVEL SUBSCRIPTION
                  </div>
                  <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #ffffff; font-weight: 600; line-height: 1.4;">
                    感謝訂閱《${novelTitle}》
                  </h1>

                  <!-- 內文 -->
                  <p style="font-size: 15px; color: #d1d5db; line-height: 1.7; margin: 0 0 16px 0;">
                    ${readerGreeting}：
                  </p>
                  <p style="font-size: 15px; color: #d1d5db; line-height: 1.7; margin: 0 0 20px 0;">
                    ${isTest ? '這是僅寄給管理者的訂閱流程驗收測試。' : ''}
                    非常感謝您對《${novelTitle}》的關注與支持！作品更新後，將依寄送排程通知此信箱，信內會附上當次更新進度與閱讀連結。
                  </p>

                  <!-- 傳送門按鈕 -->
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${targetNovelUrl}" style="display: inline-block; background: #c084fc; color: #0b0b0e; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 4px; text-decoration: none; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(192, 132, 252, 0.35);" target="_blank">
                      立即進入閱讀連載 →
                    </a>
                  </div>

                  <p style="font-size: 14px; color: #9ca3af; line-height: 1.6; margin: 0 0 8px 0;">
                    祝您閱讀愉快，<br>
                    <strong>Maxupport 私人博物館</strong>
                  </p>

                  <!-- 退訂與法定聲明 -->
                  ${renderEmailFooter(unsubscribeToken, isTest)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (prepareOnly) return { ok: true, message: { subject, html } };
  try {
    const data = await resend!.emails.send({
      from: DEFAULT_FROM,
      to: email,
      subject,
      html,
    });
    if (data.error) return { ok: false, error: '寄信服務未接受此信件，請檢查寄件設定與額度' };
    return { ok: true, data: data.data };
  } catch {
    console.error('[Resend] Welcome email request failed');
    return { ok: false, error: '寄信服務暫時無法使用' };
  }
}

/**
 * 寄送「新章節更新廣播通知信」
 */
export async function sendChapterUpdateEmail({
  email,
  name,
  novelTitle,
  chapterTitle,
  summary,
  chapterUrl,
  unsubscribeToken,
  messageType = 'update',
  isTest = false,
}: SendChapterUpdateParams, prepareOnly = false) {
  if (!resend && !prepareOnly) {
    console.warn('[Resend] RESEND_API_KEY 未設定，無法寄送更新廣播信');
    return { ok: false, error: 'RESEND_API_KEY 未設定' };
  }

  const readerGreeting = name ? `${escapeHtml(name)} 您好` : '親愛的讀者 您好';
  const announcement = messageType === 'announcement';
  const subject = `${isTest ? '【測試】' : ''}${announcement ? '【網站通告】' : '【連載更新】'}《${novelTitle}》${chapterTitle}`;
  novelTitle = escapeHtml(novelTitle);
  chapterTitle = escapeHtml(chapterTitle);
  summary = summary ? escapeHtml(summary) : summary;
  chapterUrl = safeLink(chapterUrl);

  const html = `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="utf-8">
      <title>《${novelTitle}》${announcement ? '網站通告' : '連載更新通知'}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0b0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans TC', sans-serif; color: #e5e5e5;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0b0e; padding: 40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background: rgba(22, 22, 28, 0.95); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 36px 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
              <tr>
                <td>
                  <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #60a5fa; font-weight: 600; margin-bottom: 8px;">
                    ${announcement ? 'WEBSITE ANNOUNCEMENT' : 'CHAPTER UPDATE'} • 《${novelTitle}》
                  </div>
                  <h1 style="margin: 0 0 20px 0; font-size: 22px; color: #ffffff; font-weight: 600; line-height: 1.4;">
                    ${chapterTitle}
                  </h1>

                  <p style="font-size: 15px; color: #d1d5db; line-height: 1.7; margin: 0 0 16px 0;">
                    ${readerGreeting}：
                  </p>
                  <p style="font-size: 15px; color: #d1d5db; line-height: 1.7; margin: 0 0 16px 0;">
                    ${isTest ? '這是經作者同意的驗收測試，並非新的公開連載公告。' : announcement ? '以下是 Maxupport 私人博物館的最新通告。' : `您所訂閱的連載作品《${novelTitle}》已發布更新，進度如下。`}
                  </p>

                  ${summary ? `
                    <div style="background: rgba(255, 255, 255, 0.04); border-left: 3px solid #60a5fa; padding: 14px 18px; border-radius: 4px; margin: 20px 0; color: #e2e8f0; font-size: 14px; line-height: 1.7;">
                      ${summary.replace(/\n/g, '<br>')}
                    </div>
                  ` : ''}

                  <!-- 閱讀按鈕 -->
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${chapterUrl}" style="display: inline-block; background: #60a5fa; color: #0b0b0e; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 4px; text-decoration: none; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(96, 165, 250, 0.35);" target="_blank">
                      ${announcement ? '查看相關內容' : '閱讀本次更新'} →
                    </a>
                  </div>

                  <p style="font-size: 14px; color: #9ca3af; line-height: 1.6; margin: 0 0 8px 0;">
                    <strong>Maxupport 私人博物館</strong>
                  </p>

                  <!-- 退訂與法定聲明 -->
                  ${renderEmailFooter(unsubscribeToken, isTest)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (prepareOnly) return { ok: true, message: { subject, html } };
  try {
    const data = await resend!.emails.send({
      from: DEFAULT_FROM,
      to: email,
      subject,
      html,
    });
    if (data.error) return { ok: false, error: '寄信服務未接受此信件，請檢查寄件設定與額度' };
    return { ok: true, data: data.data };
  } catch {
    console.error('[Resend] Chapter email request failed');
    return { ok: false, error: '寄信服務暫時無法使用' };
  }
}
