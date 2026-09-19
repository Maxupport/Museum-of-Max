/**
 * AI 爬蟲與訪客設備辨識工具
 * 專門辨識四大 AI 系統 (OpenAI, Anthropic, Google, Perplexity) 與其他主流搜尋/AI 爬蟲
 */

export type AiBotFamily = 'OpenAI' | 'Anthropic' | 'Google' | 'Perplexity' | 'Meta' | 'Apple' | 'Other';

export interface AiBotDetectionResult {
  isAiBot: boolean;
  botFamily: AiBotFamily | null;
  botName: string | null;
}

export function detectAiBot(userAgent: string | null | undefined): AiBotDetectionResult {
  if (!userAgent) {
    return { isAiBot: false, botFamily: null, botName: null };
  }

  const ua = userAgent.toLowerCase();

  // 1. OpenAI 系列
  if (ua.includes('gptbot')) {
    return { isAiBot: true, botFamily: 'OpenAI', botName: 'GPTBot' };
  }
  if (ua.includes('chatgpt-user')) {
    return { isAiBot: true, botFamily: 'OpenAI', botName: 'ChatGPT-User' };
  }
  if (ua.includes('oai-searchbot')) {
    return { isAiBot: true, botFamily: 'OpenAI', botName: 'OAI-SearchBot' };
  }

  // 2. Anthropic 系列 (Claude)
  if (ua.includes('claudebot')) {
    return { isAiBot: true, botFamily: 'Anthropic', botName: 'ClaudeBot' };
  }
  if (ua.includes('claude-web')) {
    return { isAiBot: true, botFamily: 'Anthropic', botName: 'Claude-Web' };
  }
  if (ua.includes('anthropic-ai')) {
    return { isAiBot: true, botFamily: 'Anthropic', botName: 'anthropic-ai' };
  }

  // 3. Google AI & 搜尋系列
  if (ua.includes('google-extended')) {
    return { isAiBot: true, botFamily: 'Google', botName: 'Google-Extended (Gemini)' };
  }
  if (ua.includes('googleother')) {
    return { isAiBot: true, botFamily: 'Google', botName: 'GoogleOther' };
  }
  if (ua.includes('google-inspectiontool')) {
    return { isAiBot: true, botFamily: 'Google', botName: 'Google-InspectionTool' };
  }
  if (ua.includes('googlebot')) {
    return { isAiBot: true, botFamily: 'Google', botName: 'Googlebot' };
  }

  // 4. Perplexity AI
  if (ua.includes('perplexitybot')) {
    return { isAiBot: true, botFamily: 'Perplexity', botName: 'PerplexityBot' };
  }

  // 5. 其他主流 AI 與科技巨頭爬蟲
  if (ua.includes('meta-externalagent') || ua.includes('facebookbot') || ua.includes('meta-externalfetcher')) {
    return { isAiBot: true, botFamily: 'Meta', botName: 'Meta-ExternalAgent (Llama)' };
  }
  if (ua.includes('applebot-extended') || ua.includes('applebot')) {
    return { isAiBot: true, botFamily: 'Apple', botName: 'Applebot (Apple Intelligence)' };
  }
  if (ua.includes('bytespider')) {
    return { isAiBot: true, botFamily: 'Other', botName: 'Bytespider (ByteDance)' };
  }
  if (ua.includes('cohere-ai')) {
    return { isAiBot: true, botFamily: 'Other', botName: 'Cohere-AI' };
  }
  if (ua.includes('mistralai') || ua.includes('mistralbot')) {
    return { isAiBot: true, botFamily: 'Other', botName: 'MistralBot' };
  }
  if (ua.includes('bingbot')) {
    return { isAiBot: true, botFamily: 'Other', botName: 'Bingbot (Copilot)' };
  }

  return { isAiBot: false, botFamily: null, botName: null };
}

/**
 * 簡易解析真人訪客的裝置、作業系統與瀏覽器
 */
export function parseClientEnvironment(userAgent: string | null | undefined): {
  device: 'Desktop' | 'Mobile' | 'Tablet';
  browser: string;
  os: string;
} {
  if (!userAgent) {
    return { device: 'Desktop', browser: 'Unknown', os: 'Unknown' };
  }

  const ua = userAgent.toLowerCase();

  // 判斷裝置
  let device: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    device = 'Tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) {
    device = 'Mobile';
  }

  // 判斷作業系統
  let os = 'Other';
  if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  // 判斷瀏覽器
  let browser = 'Other';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = 'Chrome';
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = 'Safari';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';

  return { device, browser, os };
}
