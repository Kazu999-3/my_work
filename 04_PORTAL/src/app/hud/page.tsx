'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MinimalHudRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/coach');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-stone-600 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span>ソロQコーチへ移動中...</span>
      </div>
    </div>
  );
}
