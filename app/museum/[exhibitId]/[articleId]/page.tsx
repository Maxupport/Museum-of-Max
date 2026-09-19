import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { EXHIBITS } from '@/lib/constants';
import ArticleDetailClient, { SerializedArticleData } from '@/components/ArticleDetailClient';

interface PageProps {
  params: Promise<{ exhibitId: string; articleId: string }>;
}

// 1. 伺服器端動態生成 Metadata (供搜尋引擎與 AI 爬蟲讀取標題與摘要)
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { exhibitId, articleId } = await params;
  const exhibit = EXHIBITS[exhibitId];

  try {
    const article = await prisma.writingsItem.findUnique({
      where: { id: articleId },
    });

    if (article) {
      const excerpt = article.excerpt || article.content.slice(0, 180).replace(/[#>\n]/g, ' ').trim();
      const url = `https://maxupport.com/museum/${exhibitId}/${articleId}`;

      return {
        title: `${article.title} | Maxupport 私人博物館`,
        description: excerpt,
        keywords: [
          'Maxupport',
          article.category || '專題文章',
          article.topic || '',
          exhibit?.title || '展區',
          '個人作品集',
        ].filter(Boolean),
        openGraph: {
          title: `${article.title} | Maxupport 私人博物館`,
          description: excerpt,
          url,
          siteName: 'Maxupport Private Museum',
          type: 'article',
          publishedTime: article.createdAt.toISOString(),
          modifiedTime: article.updatedAt.toISOString(),
          authors: ['Maxupport'],
        },
        twitter: {
          card: 'summary_large_image',
          title: `${article.title} | Maxupport 私人博物館`,
          description: excerpt,
        },
      };
    }
  } catch (err) {
    console.error('Error generating article metadata:', err);
  }

  return {
    title: `${exhibit?.title || '作品專題'} | Maxupport 私人博物館`,
    description: exhibit?.desc || '記錄 Max 的跨界軌跡與原創專題作品。',
  };
}

// 2. 伺服器端渲染頁面 (SSR)，提供 100% 完整 HTML 與 Schema.org JSON-LD
export default async function ArticleDetailPage({ params }: PageProps) {
  const { exhibitId, articleId } = await params;
  const exhibit = EXHIBITS[exhibitId];

  if (!exhibit) {
    notFound();
  }

  let dbArticle = null;
  try {
    dbArticle = await prisma.writingsItem.findUnique({
      where: { id: articleId },
    });
  } catch (err) {
    console.error('Error fetching article for SSR:', err);
  }

  // 序列化日期物件為 ISO 字串，符合 Client Component 規範
  const serializedArticle: SerializedArticleData | null = dbArticle ? {
    id: dbArticle.id,
    title: dbArticle.title,
    category: dbArticle.category,
    topic: dbArticle.topic,
    fbUrl: dbArticle.fbUrl,
    fbDate: dbArticle.fbDate,
    excerpt: dbArticle.excerpt,
    content: dbArticle.content,
    youtubeUrl: dbArticle.youtubeUrl,
    order: dbArticle.order,
    createdAt: dbArticle.createdAt.toISOString(),
    updatedAt: dbArticle.updatedAt.toISOString(),
  } : null;

  // Schema.org Article 結構化資料 (供 ChatGPT, Perplexity, Claude, Gemini, Grok 引用解析)
  const jsonLd = serializedArticle ? {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: serializedArticle.title,
    description: serializedArticle.excerpt || serializedArticle.content.slice(0, 200).replace(/[#>\n]/g, ' ').trim(),
    author: {
      '@type': 'Person',
      name: 'Maxupport',
      url: 'https://maxupport.com',
      jobTitle: 'Venture Investor & Executive Coach',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Maxupport Private Museum',
      url: 'https://maxupport.com',
    },
    datePublished: serializedArticle.createdAt,
    dateModified: serializedArticle.updatedAt,
    mainEntityOfPage: `https://maxupport.com/museum/${exhibitId}/${articleId}`,
    articleSection: serializedArticle.category || exhibit.title,
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ArticleDetailClient
        initialArticle={serializedArticle}
        exhibitId={exhibitId}
        articleId={articleId}
      />
    </>
  );
}
