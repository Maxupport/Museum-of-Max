import { MetadataRoute } from 'next';
import { ALL_EXHIBIT_KEYS } from '@/lib/constants';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://maxupport.com';
  const currentDate = new Date();

  const exhibitUrls = ALL_EXHIBIT_KEYS.map((key) => ({
    url: `${baseUrl}/museum/${key}`,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  return [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/museum`,
      lastModified: currentDate,
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    ...exhibitUrls,
    {
      url: `${baseUrl}/museum/creation_lab/novel/ai-novel`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/museum/creation_lab/novel/world-builder`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
  ];
}
