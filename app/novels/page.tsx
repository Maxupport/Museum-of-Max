import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import NewsletterSignup from '@/components/NewsletterSignup';
import styles from './novels.module.css';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '想請你，先讀一章｜Maxupport 小說閱讀與訂閱',
  description: '免費試讀《越界之前》與《她沒有說好的那一夜》，也邀請你幫忙測試小說訂閱與更新通知。',
  openGraph: {
    title: '想請你，先讀一章。',
    description: 'Maxupport 的小說訂閱測試｜兩部小說免費試讀，歡迎幫忙試用。',
    url: 'https://museum-of-max.vercel.app/novels', type: 'website', locale: 'zh_TW',
    images: [{ url: 'https://museum-of-max.vercel.app/images/social/novel-subscription-test-20261025.png', width: 1733, height: 908, alt: 'Maxupport 邀請你試讀與測試兩部小說訂閱' }],
  },
  twitter: { card: 'summary_large_image', title: '想請你，先讀一章。', images: ['https://museum-of-max.vercel.app/images/social/novel-subscription-test-20261025.png'] },
};

export default async function NovelsPage() {
  const [novels, chapters] = await Promise.all([
    prisma.novel.findMany({ orderBy: { order: 'asc' }, select: { id: true, title: true, author: true, description: true, coverUrl: true } }),
    prisma.writingsItem.findMany({ where: { category: '小說', isHidden: false }, orderBy: { order: 'asc' }, select: { id: true, topic: true, order: true, content: true } }),
  ]);
  return <main className={styles.page}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>MAX&apos;S PRIVATE MUSEUM / FICTION</p>
      <h1>故事，留給願意停下來的你。</h1>
      <p className={styles.intro}>生涯擺渡人 Max 的小說與創作。先讀一章，再決定是否讓下一段故事，走進你的信箱。</p>
      <a className={styles.textLink} href="#newsletter">訂閱連載更新 <span aria-hidden="true">↗</span></a>
    </header>
    <section aria-labelledby="novels-heading">
    <div className={styles.sectionHeading}><h2 id="novels-heading">小說作品</h2><span>免費試讀・不需通行碼</span></div>
    <div className={styles.books}>
      {novels.map((novel) => {
        const published = chapters.filter((chapter) => chapter.topic === novel.title);
        const first = published.find((chapter) => chapter.order === 1) || published[0];
        let illustrated = false;
        try { illustrated = Boolean(first && JSON.parse(first.content).illustration === true); } catch { /* Existing plain-text chapters have no illustration. */ }
        const cover = novel.coverUrl || (first && illustrated ? `/api/novel-illustrations/${first.id}` : null);
        const count = published.length;
        const href = `/museum/creation_lab/novel/${encodeURIComponent(novel.id)}${first ? `?chapterId=${encodeURIComponent(first.id)}` : ''}`;
        const cadence = novel.title === '越界之前' ? '每週三・四・五更新' : novel.title === '她沒有說好的那一夜' ? '每週二更新' : '創作連載';
        return <article key={novel.id} className={styles.book}>
          <Link href={href} className={styles.cover} aria-label={`查看作品：${novel.title}`}>
            {cover ? <Image src={cover} alt={`《${novel.title}》封面`} width={600} height={900} unoptimized className={styles.coverImage} /> : <div className={styles.coverPlaceholder}>{novel.title}</div>}
            <span className={styles.coverLabel}>生涯擺渡人 Max · 小說</span>
          </Link>
          <div className={styles.bookBody}>
          <p className={styles.cadence}>{cadence}</p>
          <h3>{novel.title}</h3>
          <p className={styles.author}>{novel.author || '生涯擺渡人 Max'}</p>
          <p className={styles.description}>{novel.description || '關於選擇、關係，以及那些未曾說出口的心事。從第一章開始，慢慢走進故事。'}</p>
          <div className={styles.bookFooter}><span>{count ? '第一章已開放試讀' : '即將開放試讀'}</span><Link className={styles.readButton} href={href}>查看作品 <span aria-hidden="true">→</span></Link></div>
          </div>
        </article>;
      })}
    </div>
    </section>
    <NewsletterSignup />
    <footer className={styles.footer}><span>故事持續生長，謝謝你願意同行。</span><Link href="/">返回博物館首頁 ↗</Link></footer>
  </main>;
}
