'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function TrafficTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    // 忽略後台管理路徑，避免創作者自身操作稀釋統計數據
    if (!pathname || pathname.startsWith('/admin')) {
      return;
    }

    // 避免短時間內同一路徑重複回報 (例如頁面重渲染)
    if (lastTrackedPath.current === pathname) {
      return;
    }
    lastTrackedPath.current = pathname;

    // 延遲 300ms 確保 document.title 已更新
    const timer = setTimeout(() => {
      try {
        const payload = {
          path: pathname,
          title: document.title || 'Maxupport Museum',
          referrer: document.referrer || '',
        };

        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          navigator.sendBeacon('/api/track', blob);
        } else {
          fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => {});
        }
      } catch (err) {
        console.debug('Traffic tracking error:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
