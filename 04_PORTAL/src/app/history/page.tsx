'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '../../components/Feedback';

// 試合履歴はKTM大会管理（/ktm-admin?tab=history）に統合されました。
export default function HistoryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ktm-admin?tab=history');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background text-stone-900">
      <Spinner label="KTM大会管理（戦績履歴）へ移動中..." />
    </div>
  );
}
