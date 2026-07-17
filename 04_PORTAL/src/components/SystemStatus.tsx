"use client";

import { useEffect, useState } from 'react';

// サイドバー下部の稼働ステータス表示（#58）。
// 以前は常時「All Systems Go」の飾りだったため、実際に /api/health を叩いて
// DB接続性を反映し、最終確認時刻も表示する。誤解を招く固定表示を廃止。
type Health = { ok: boolean; checkedAt: string } | null;

export default function SystemStatus({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const [health, setHealth] = useState<Health>(null);
  const [loading, setLoading] = useState(true);

  const check = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const data = await res.json();
      setHealth({ ok: !!data.ok, checkedAt: data.checkedAt });
    } catch {
      setHealth({ ok: false, checkedAt: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    check();
    const id = setInterval(check, 60_000); // 1分ごとに再確認
    return () => clearInterval(id);
  }, []);

  const ok = health?.ok;
  const color = loading ? 'var(--color-warning, #eab308)' : ok ? 'var(--color-success)' : '#ef4444';
  const label = loading ? '確認中...' : ok ? '正常稼働中' : '接続エラー';
  const time = health?.checkedAt
    ? new Date(health.checkedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`flex items-center gap-3 bg-black/40 rounded-2xl border border-white/5 ${isCollapsed ? 'justify-center p-3 w-10 h-10 mx-auto' : 'p-4'}`}>
      <div className="relative flex items-center justify-center shrink-0">
        <div className="w-2 h-2 rounded-full relative z-10" style={{ backgroundColor: color }}></div>
        {ok && !loading && (
          <div className="absolute w-4 h-4 rounded-full animate-ping opacity-75" style={{ backgroundColor: color }}></div>
        )}
      </div>
      {!isCollapsed && (
        <div>
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Status</p>
          <p className="text-xs font-black" style={{ color }}>
            {label}
            {time && !loading && <span className="ml-1 text-[9px] font-medium text-gray-500">({time})</span>}
          </p>
        </div>
      )}
    </div>
  );
}
