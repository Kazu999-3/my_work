'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Clock } from 'lucide-react';

interface FreshnessSource {
  key: string;
  label: string;
  lastUpdated: string | null;
  ageHours: number | null;
  expectedIntervalHours: number;
  isStale: boolean;
}

function formatAge(hours: number | null): string {
  if (hours === null) return 'データなし';
  if (hours < 24) return `${Math.round(hours)}時間前`;
  return `${Math.round(hours / 24)}日前`;
}

// ナレッジ関連の主要テーブルの最終更新時刻を一覧表示する。
// 「生成経路はあるが誰も気づかないまま止まる」パターンを個別に見つけるのではなく、
// ここで一目で分かるようにする(2026-08-03、同日に3件同種のバグが見つかったため新設)。
export default function FreshnessPanel() {
  const [sources, setSources] = useState<FreshnessSource[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/knowledge/freshness', { credentials: 'include' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '取得に失敗しました');
      setSources(d.sources || []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const staleCount = sources?.filter((s) => s.isStale).length ?? 0;

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h3 className="font-black text-foreground flex items-center gap-2">
          <Clock size={16} className="text-secondary-600" /> データ鮮度モニター
          {staleCount > 0 && (
            <span className="text-[10px] font-bold bg-danger-100 text-danger-700 border border-danger-edge-soft px-2 py-0.5 rounded-full">
              {staleCount}件 停滞中
            </span>
          )}
        </h3>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs font-bold bg-secondary-100 text-secondary-700 border border-secondary-edge-soft px-3 py-1.5 rounded-lg hover:bg-secondary-200 disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 再チェック
        </button>
      </div>
      <p className="text-[11px] text-muted-strong mb-3">
        自動生成・自動収集パイプラインが、想定より長く更新されていないテーブルが無いか確認します。
      </p>
      {error && <p className="text-sm text-danger-700 bg-danger-100 border border-danger-edge-soft rounded-lg px-3 py-2 mb-3">{error}</p>}
      {sources && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sources.map((s) => (
            <div key={s.key} className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2 ${
              s.isStale ? 'bg-danger-50 border-danger-edge-soft' : 'bg-success-50 border-success-edge-soft'
            }`}>
              <span className="text-xs font-bold text-foreground-soft">{s.label}</span>
              <span className={`text-[11px] font-mono shrink-0 ${s.isStale ? 'text-danger-700' : 'text-success-700'}`}>
                {formatAge(s.ageHours)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
