"use client";

import { useEffect, useState } from 'react';

// サイドバー下部の稼働ステータス表示（#58）。
// 以前は常時「All Systems Go」の飾りだったため、実際に /api/health を叩いて
// DB接続性を反映し、最終確認時刻も表示する。誤解を招く固定表示を廃止。
type Health = { ok: boolean; checkedAt: string; riotKey?: boolean; geminiKey?: boolean; vapid?: boolean; discordWebhook?: boolean } | null;

export default function SystemStatus({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const [health, setHealth] = useState<Health>(null);
  const [loading, setLoading] = useState(true);

  const check = async (isInitial = false) => {
    // 初回のみ「確認中...」を表示する。60秒ごとの再確認では現在表示中のステータスを
    // 維持したまま裏で確認し、正常稼働中でも毎分ちらつくのを防ぐ。
    if (isInitial) setLoading(true);
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
    check(true);
    const id = setInterval(() => check(false), 60_000); // 1分ごとに再確認
    return () => clearInterval(id);
  }, []);

  const ok = health?.ok;
  const color = loading ? 'var(--color-warning, #eab308)' : ok ? 'var(--color-success)' : '#ef4444';
  const label = loading ? '確認中...' : ok ? '正常稼働中' : '接続エラー';
  const time = health?.checkedAt
    ? new Date(health.checkedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`flex flex-col gap-1.5 bg-black/5 rounded-2xl border border-black/5 ${isCollapsed ? 'justify-center p-2.5 w-10 mx-auto' : 'p-3'}`}>
      <div className="flex items-center gap-2.5">
        <div className="relative flex items-center justify-center shrink-0">
          <div className="w-2 h-2 rounded-full relative z-10" style={{ backgroundColor: color }}></div>
          {ok && !loading && (
            <div className="absolute w-4 h-4 rounded-full animate-ping opacity-75" style={{ backgroundColor: color }}></div>
          )}
        </div>
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Status</span>
              <span className="text-[9px] bg-amber-100/80 text-amber-900 font-black px-1.5 py-0.2 rounded border border-amber-300">
                パッチ 26.15
              </span>
            </div>
            <p className="text-xs font-black" style={{ color }}>
              {label}
              {time && !loading && <span className="ml-1 text-[9px] font-medium text-gray-500">({time})</span>}
            </p>
          </div>
        )}
      </div>
          {/* A-05: 依存サービスの設定状況（未設定のものだけ警告表示） */}
          {health && !loading && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {([['Riot', health.riotKey], ['AI', health.geminiKey], ['Push', health.vapid], ['Webhook', health.discordWebhook]] as const)
                .filter(([, okv]) => okv === false)
                .map(([name]) => (
                  <span key={name} className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">{name}未設定</span>
                ))}
            </div>
          )}
    </div>
  );
}
