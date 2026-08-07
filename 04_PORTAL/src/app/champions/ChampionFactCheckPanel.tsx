'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import FactCheckQueueCard, { QueueItem } from '../../components/FactCheckQueueCard';

export default function ChampionFactCheckPanel({ champion }: { champion: string }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [initialTotal, setInitialTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [everChecked, setEverChecked] = useState<boolean | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [pendingRes, allRes] = await Promise.all([
        fetch(`/api/admin/dict-fact-check/queue?status=pending&champion=${encodeURIComponent(champion)}`, { credentials: 'include' }),
        fetch(`/api/admin/dict-fact-check/queue?status=all&champion=${encodeURIComponent(champion)}`, { credentials: 'include' }),
      ]);
      const d = await pendingRes.json();
      if (!pendingRes.ok) throw new Error(d.error || '取得に失敗しました');
      const loadedItems = d.items || [];
      setItems(loadedItems);
      setInitialTotal(loadedItems.length);
      const allD = await allRes.json();
      setEverChecked(allRes.ok ? (allD.items || []).length > 0 : null);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [champion]);

  const runCheck = async () => {
    setRunning(true); setMsg(''); setError('');
    try {
      const res = await fetch('/api/admin/dict-fact-check/champion', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champion }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'ファクトチェックに失敗しました');
      if (d.capped) {
        setMsg('⚠️ 未処理レビューが上限(50件)に達しているため、新規チェックを一時停止しています。先に管理画面のレビューキューを処理してください。');
      } else {
        setMsg(d.flagged > 0 ? `✅ ${d.flagged}件の要レビュー項目を検出しました` : '✅ 問題は見つかりませんでした');
      }
      await load();
    } catch (e: any) { setError(e.message); } finally { setRunning(false); }
  };

  const handleActed = (actedId: number) => {
    setItems((prev) => prev.filter((x) => x.id !== actedId));
  };

  const currentItem = items[0]; // 常に1件ずつ最優先の1つだけを表示
  const processedCount = initialTotal - items.length;
  const progressPercent = initialTotal > 0 ? Math.round((processedCount / initialTotal) * 100) : 100;

  return (
    <div className="glass-panel border-t-2 border-indigo-400 p-5 rounded-2xl group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] shadow-indigo-400/20 relative col-span-1 md:col-span-2 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-black flex items-center gap-2 text-indigo-600">
            <ShieldCheck size={18} /> ファクトチェック（1件ずつ集中して片付けるフォーカスモード）
          </h3>
          <p className="text-[11px] text-stone-500 mt-0.5">
            一度に大量にカードを出さず、最優先の1件ずつ順番に「確認・採択・却下」で片付けます
          </p>
        </div>

        <button
          onClick={runCheck}
          disabled={running}
          className="flex items-center gap-1.5 text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 active:scale-95 text-white px-3.5 py-2 rounded-xl transition disabled:opacity-50 shadow-md"
          title="過去に蓄積された古い19件等の未処理データを一発でリセットし、最新のAIで厳選された1〜2件のみに最新化します"
        >
          {running ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {running ? '最新AI再判定中...' : '⚡ 過去の残留キューをリセットして最新化'}
        </button>
      </div>

      {msg && <p className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">{msg}</p>}
      {error && <p className="text-xs text-rose-700 font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-xl">{error}</p>}

      {/* 1件ずつ集中処理のプログレスバー */}
      {!loading && items.length > 0 && (
        <div className="bg-stone-100 border border-stone-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold text-stone-800">
            <span className="flex items-center gap-1.5 text-indigo-900">
              <Sparkles size={14} className="text-indigo-600" />
              残り {items.length} 件 （{processedCount + 1} / {initialTotal} 件目を片付け中）
            </span>
            <span className="text-stone-500 font-mono">{progressPercent}% 完了</span>
          </div>
          <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
            <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      )}

      {/* --- メインコンテンツ --- */}
      {loading ? (
        <div className="py-8 text-center text-xs text-stone-500 font-bold flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin text-indigo-600" />
          ファクトチェックデータをロード中...
        </div>
      ) : items.length === 0 ? (
        <div className="p-6 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center space-y-2">
          <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
          <h4 className="text-sm font-extrabold text-emerald-900">🎉 すべての矛盾・不整合の片付けが完了しました！</h4>
          <p className="text-xs text-emerald-800/80">
            {everChecked
              ? 'このチャンピオンに関する全ての要レビュー項目は人間確認・採択・訂正が完了しています。'
              : 'まだこのチャンピオンのファクトチェックは実行されていません。「再チェック」ボタンを押して点検を開始できます。'}
          </p>
        </div>
      ) : (
        /* 1件ずつ目の前のカードのみをグラフィカルに表示 */
        <div className="space-y-3">
          <FactCheckQueueCard item={currentItem} onActed={handleActed} />
          {items.length > 1 && (
            <p className="text-[11px] text-stone-400 text-right font-bold flex items-center justify-end gap-1">
              この1件を片付けると自動で次のカードに進みます <ArrowRight size={12} />
            </p>
          )}
        </div>
      )}
    </div>
  );
}
