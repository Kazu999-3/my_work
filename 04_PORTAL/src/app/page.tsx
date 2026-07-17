'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // URLハッシュ または クエリパラメータに code（OAuth認証コード）が含まれているか確認
    const hasHash = window.location.hash.includes('access_token=') || window.location.hash.includes('error=');
    const searchParams = new URLSearchParams(window.location.search);
    const hasCode = searchParams.has('code');

    if (hasHash || hasCode) {
      // 認証情報を引き継いでログイン画面へ転送
      const destination = `/login${window.location.search}${window.location.hash}`;
      router.replace(destination);
    } else {
      router.replace('/balancer');
    }
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', background: '#07080e' }} className="flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-indigo-400" />
    </div>
  );
}
