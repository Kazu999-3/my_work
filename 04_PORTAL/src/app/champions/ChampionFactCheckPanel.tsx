'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import FactCheckQueueCard, { QueueItem } from '../../components/FactCheckQueueCard';

// 辞典の一斉ファクトチェック(admin/knowledge)は170体前後を回すため完走に時間がかかる。
// 今見ているチャンピオンだけをその場ですぐ確認したい、というニーズに対応する
// 単体版。検出結果は同じdict_fact_check_queueに積まれるため、全体チェック側の
// レビューキューにも同じ内容が表示される。
export default function ChampionFactCheckPanel({ champion }: { champion: string }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  // 単体版と全体版が同じdict_fact_check_queueを共有しているのに、「未対応の検出項目は
  // ありません」が「検証済みで綺麗」なのか「全体スキャンをまだ一度も走らせていない
  // だけ」なのか区別できなかった(2026-08-05発覚)。全ステータス込みで1件でも
  // 履歴があれば「チェック済み」とみなす。
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
      setItems(d.items || []);
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

  return (
    <div className="glass-panel border-t-2 border-indigo-400 p-5 rounded-2xl group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] shadow-indigo-400/20 relative col-span-1 md:col-span-2">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="text-sm font-black flex items-center gap-2 text-indigo-600">
          <ShieldCheck size={16} /> ファクトチェック（このチャンピオンのみ）
        </h3>
        <button onClick={runCheck} disabled={running}
          className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
          {running ? <RefreshCw size={13} className="animate-spin" /> : <ShieldCheck size={13} />} {running ? '実行中...' : 'このチャンピオンをチェック'}
        </button>
      </div>
      {msg && <p className="text-xs text-emerald-700 mb-2">{msg}</p>}
      {error && <p className="text-xs text-rose-700 mb-2">{error}</p>}
      {loading ? (
        <p className="text-xs text-stone-500 py-2">読み込み中...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-stone-500 py-2">
          {everChecked
            ? '✅ チェック済み・未対応の検出項目はありません。'
            : 'まだこのチャンピオンのファクトチェックは実行されていません（上のボタンから実行できます）。'}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <FactCheckQueueCard key={it.id} item={it} onActed={(id) => setItems((prev) => prev.filter((x) => x.id !== id))} />
          ))}
        </div>
      )}
    </div>
  );
}
