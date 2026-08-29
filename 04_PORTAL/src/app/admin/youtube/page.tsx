'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function YoutubeAdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/champions?scope=knowledge&tab=video');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-stone-600 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        <span>攻略ナレッジハブ（動画キュー）へ移動中...</span>
      </div>
    </div>
  );
}
