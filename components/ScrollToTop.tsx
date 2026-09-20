'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const scrollToZero = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    // 立即置頂
    scrollToZero();

    // 透過 requestAnimationFrame 在下一幀確認置頂
    const rafId = requestAnimationFrame(scrollToZero);

    // 透過延遲定時器防止非同步資料或圖片載入導致的版面位移
    const t1 = setTimeout(scrollToZero, 50);
    const t2 = setTimeout(scrollToZero, 150);
    const t3 = setTimeout(scrollToZero, 350);
    const t4 = setTimeout(scrollToZero, 600);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [pathname]);

  return null;
}
