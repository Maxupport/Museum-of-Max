import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://maxupport.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/museum', '/museum/*', '/api/public'],
        disallow: ['/admin', '/admin/*', '/api/auth/*'],
      },
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'ClaudeBot',
          'Claude-Web',
          'PerplexityBot',
          'Google-Extended',
          'Googlebot',
          'Bingbot',
        ],
        allow: '/',
        disallow: ['/admin', '/admin/*'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
