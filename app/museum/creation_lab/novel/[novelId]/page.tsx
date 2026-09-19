import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import NovelReaderClient, { NovelWithChapters } from '@/components/NovelReaderClient';

interface PageProps {
  params: Promise<{ novelId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { novelId } = await params;
  const decodedId = decodeURIComponent(novelId);

  try {
    const novel = await prisma.novel.findFirst({
      where: {
        OR: [
          { id: decodedId },
          { title: decodedId },
        ],
      },
    });

    if (novel) {
      const url = `https://maxupport.com/museum/creation_lab/novel/${novelId}`;
      const description = novel.description || `《${novel.title}》小說連載作品。`;

      return {
        title: `《${novel.title}》小說連載 | Maxupport 私人博物館`,
        description,
        openGraph: {
          title: `《${novel.title}》小說連載 | Maxupport 私人博物館`,
          description,
          url,
          siteName: 'Maxupport Private Museum',
          type: 'book',
          authors: [novel.author || 'Maxupport'],
        },
        twitter: {
          card: 'summary_large_image',
          title: `《${novel.title}》小說連載 | Maxupport`,
          description,
        },
      };
    }
  } catch (err) {
    console.error('Error generating novel metadata:', err);
  }

  return {
    title: '小說連載 | Maxupport 私人博物館',
    description: '創作 Lab 小說連載專區。',
  };
}

export default async function NovelReaderPage({ params }: PageProps) {
  const { novelId } = await params;
  const decodedId = decodeURIComponent(novelId);

  let serializedNovel: NovelWithChapters | null = null;
  try {
    const novel = await prisma.novel.findFirst({
      where: {
        OR: [
          { id: decodedId },
          { title: decodedId },
        ],
      },
    });

    if (novel) {
      const chapters = await prisma.writingsItem.findMany({
        where: {
          category: '小說',
          topic: novel.title,
          isHidden: false,
        },
        orderBy: { order: 'asc' },
      });

      serializedNovel = {
        id: novel.id,
        title: novel.title,
        author: novel.author,
        coverUrl: novel.coverUrl,
        description: novel.description,
        status: novel.status,
        totalChapters: chapters.length,
        chapters: chapters.map((ch) => ({
          id: ch.id,
          title: ch.title,
          content: ch.content,
          order: ch.order,
          createdAt: ch.createdAt.toISOString(),
          updatedAt: ch.updatedAt.toISOString(),
          fbDate: ch.fbDate,
          excerpt: ch.excerpt,
        })),
      };
    }
  } catch (err) {
    console.error('Error fetching novel for SSR:', err);
  }

  // Schema.org Book / CreativeWorkSeries 結構化資料
  const jsonLd = serializedNovel ? {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: serializedNovel.title,
    description: serializedNovel.description,
    author: {
      '@type': 'Person',
      name: serializedNovel.author || 'Maxupport',
      url: 'https://maxupport.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Maxupport Private Museum',
      url: 'https://maxupport.com',
    },
    url: `https://maxupport.com/museum/creation_lab/novel/${novelId}`,
    numberOfPages: serializedNovel.totalChapters,
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <NovelReaderClient
        initialNovel={serializedNovel}
        novelId={novelId}
      />
    </>
  );
}
