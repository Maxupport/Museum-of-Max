import { MetadataRoute } from 'next';
import { ALL_EXHIBIT_KEYS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://maxupport.com';
  const currentDate = new Date();

  // 1. 核心首頁與展區主頁
  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/projects`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/museum`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];

  // 2. 六大展區主頁
  const exhibitUrls: MetadataRoute.Sitemap = ALL_EXHIBIT_KEYS.map((key) => ({
    url: `${baseUrl}/museum/${key}`,
    lastModified: currentDate,
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  // 3. 資料庫中所有公開文章 (供 AI 爬蟲與搜尋引擎深度索引)
  let articleUrls: MetadataRoute.Sitemap = [];
  try {
    const articles = await prisma.writingsItem.findMany({
      where: { isHidden: false },
      select: {
        id: true,
        exhibitId: true,
        updatedAt: true,
      },
    });

    articleUrls = articles.map((art) => ({
      url: `${baseUrl}/museum/${art.exhibitId}/${art.id}`,
      lastModified: art.updatedAt || currentDate,
      changeFrequency: 'weekly',
      priority: 0.85,
    }));
  } catch (err) {
    console.error('Error fetching articles for sitemap:', err);
  }

  // 4. 資料庫中所有小說連載頁面
  let novelUrls: MetadataRoute.Sitemap = [];
  try {
    const novels = await prisma.novel.findMany({
      select: {
        id: true,
        updatedAt: true,
      },
    });

    novelUrls = novels.map((nov) => ({
      url: `${baseUrl}/museum/creation_lab/novel/${nov.id}`,
      lastModified: nov.updatedAt || currentDate,
      changeFrequency: 'weekly',
      priority: 0.85,
    }));
  } catch (err) {
    console.error('Error fetching novels for sitemap:', err);
  }

  return [...staticUrls, ...exhibitUrls, ...articleUrls, ...novelUrls];
}
