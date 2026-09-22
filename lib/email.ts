import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://maxupport.com';
const DEFAULT_FROM = process.env.EMAIL_FROM || 'Maxupport 小說連載 <onboarding@resend.dev>';

interface SendWelcomeEmailParams {
  email: string;
  name?: string | null;
  novelTitle?: string;
  novelId?: string;
  unsubscribeToken?: string | null;
}

interface SendChapterUpdateParams {
  email: string;
  name?: string | null;
  novelTitle: string;
  chapterTitle: string;
  summary?: string | null;
  chapterUrl: string;
  unsubscribeToken?: string | null;
}

/**
 * 產生信件共用底部 HTML (包含法規強制之取消訂閱連結)
 */
function renderEmailFooter(unsubscribeToken?: string | null): string {
  const unsubscribeUrl = unsubscribeToken
    ? `${SITE_URL}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
    : `${SITE_URL}/unsubscribe`;

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
}: SendWelcomeEmailParams) {
  if (!resend) {
    console.warn('[Resend] RESEND_API_KEY 未設定，跳過寄送歡迎信');
    return { ok: false, error: 'RESEND_API_KEY 未設定' };
  }

  const readerGreeting = name ? `${name} 您好` : '親愛的讀者 您好';
  const targetNovelUrl = novelId
    ? `${SITE_URL}/museum/creation_lab/novel/${encodeURIComponent(novelId)}`
    : `${SITE_URL}/museum/creation_lab`;

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
                    非常感謝您對《${novelTitle}》的關注與支持！每當新章節發布時，我們將在第一時間寄送通知至此信箱，讓您不錯過任何最新連載進度。
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
                  ${renderEmailFooter(unsubscribeToken)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const data = await resend.emails.send({
      from: DEFAULT_FROM,
      to: email,
      subject: `感謝訂閱《${novelTitle}》連載更新 | Maxupport 私人博物館`,
      html,
    });
    return { ok: true, data };
  } catch (error) {
    console.error('[Resend Welcome Email Error]:', error);
    return { ok: false, error };
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
}: SendChapterUpdateParams) {
  if (!resend) {
    console.warn('[Resend] RESEND_API_KEY 未設定，無法寄送更新廣播信');
    return { ok: false, error: 'RESEND_API_KEY 未設定' };
  }

  const readerGreeting = name ? `${name} 您好` : '親愛的讀者 您好';

  const html = `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="utf-8">
      <title>《${novelTitle}》新章節發布通知</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0b0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans TC', sans-serif; color: #e5e5e5;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0b0e; padding: 40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background: rgba(22, 22, 28, 0.95); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 36px 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
              <tr>
                <td>
                  <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #60a5fa; font-weight: 600; margin-bottom: 8px;">
                    NEW CHAPTER RELEASE • 《${novelTitle}》
                  </div>
                  <h1 style="margin: 0 0 20px 0; font-size: 22px; color: #ffffff; font-weight: 600; line-height: 1.4;">
                    ${chapterTitle}
                  </h1>

                  <p style="font-size: 15px; color: #d1d5db; line-height: 1.7; margin: 0 0 16px 0;">
                    ${readerGreeting}：
                  </p>
                  <p style="font-size: 15px; color: #d1d5db; line-height: 1.7; margin: 0 0 16px 0;">
                    您所訂閱的連載作品《${novelTitle}》已發布最新章節！
                  </p>

                  ${summary ? `
                    <div style="background: rgba(255, 255, 255, 0.04); border-left: 3px solid #60a5fa; padding: 14px 18px; border-radius: 4px; margin: 20px 0; color: #e2e8f0; font-size: 14px; line-height: 1.7;">
                      ${summary.replace(/\n/g, '<br>')}
                    </div>
                  ` : ''}

                  <!-- 閱讀按鈕 -->
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${chapterUrl}" style="display: inline-block; background: #60a5fa; color: #0b0b0e; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 4px; text-decoration: none; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(96, 165, 250, 0.35);" target="_blank">
                      立即閱讀最新章節 →
                    </a>
                  </div>

                  <p style="font-size: 14px; color: #9ca3af; line-height: 1.6; margin: 0 0 8px 0;">
                    <strong>Maxupport 私人博物館</strong>
                  </p>

                  <!-- 退訂與法定聲明 -->
                  ${renderEmailFooter(unsubscribeToken)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const data = await resend.emails.send({
      from: DEFAULT_FROM,
      to: email,
      subject: `【新章節發布】《${novelTitle}》${chapterTitle}`,
      html,
    });
    return { ok: true, data };
  } catch (error) {
    console.error(`[Resend Dispatch Email Error to ${email}]:`, error);
    return { ok: false, error };
  }
}
