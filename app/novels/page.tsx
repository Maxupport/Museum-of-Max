import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import NewsletterSignup from '@/components/NewsletterSignup';

export const dynamic = 'force-dynamic';
export const metadata = { title: '小說閱讀與訂閱 | Maxupport 私人博物館', description: '免通行碼閱讀小說並訂閱創作更新。' };

export default async function NovelsPage() {
  const [novels, chapters] = await Promise.all([
    prisma.novel.findMany({ orderBy: { order: 'asc' }, select: { id: true, title: true } }),
    prisma.writingsItem.findMany({ where: { category: '小說', isHidden: false }, select: { topic: true } }),
  ]);
  return <main style={{ maxWidth: '800px', margin: '0 auto', padding: '6rem 1.25rem 3rem', color: '#e5e5e5' }}>
    <h1>小說閱讀與創作訂閱</h1>
    <p>生涯擺渡人 Max 的創作更新。此頁與公開小說章節不需要通行碼。</p>
    <NewsletterSignup />
    <h2>小說作品</h2>
    <div style={{ display: 'grid', gap: '1rem' }}>
      {novels.map((novel) => {
        const count = chapters.filter((chapter) => chapter.topic === novel.title).length;
        return <article key={novel.id} className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3>{novel.title}</h3>
          <p>{count ? `目前公開 ${count} 章` : '尚未公開章節，敬請期待連載。'}</p>
          <Link className="museum-btn" href={`/museum/creation_lab/novel/${encodeURIComponent(novel.id)}`}>{count ? '閱讀與訂閱這部作品' : '查看作品'}</Link>
        </article>;
      })}
    </div>
    <p><Link href="/">返回網站首頁</Link></p>
  </main>;
}
