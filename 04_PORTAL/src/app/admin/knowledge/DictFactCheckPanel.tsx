'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, Tag } from 'lucide-react';
import FactCheckQueueCard, { QueueItem } from '../../../components/FactCheckQueueCard';

// 辞典/コーチAI知識層/ナレッジの一斉ファクトチェック(#②精度向上)。
// 検出のみ行い、反映（修正・アーカイブ）は必ず人間が個別に判断する。
export default function DictFactCheckPanel() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [error, setError] = useState('');

  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number; flagged: number } | null>(null);
  const [runMsg, setRunMsg] = useState('');

  const loadQueue = async () => {
    setLoadingQueue(true);
    try {
      const res = await fetch('/api/admin/dict-fact-check/queue?status=pending', { credentials: 'include' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '取得に失敗しました');
      setItems(d.items || []);
    } catch (e: any) { setError(e.message); } finally { setLoadingQueue(false); }
  };

  useEffect(() => { loadQueue(); }, []);

  const runScan = async () => {
    setScanning(true); setScanMsg(''); setError('');
    try {
      const res = await fetch('/api/admin/dict-fact-check', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'scan_tags' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'スキャンに失敗しました');
      const parts: string[] = [];
      if (d.autoResolved > 0) parts.push(`表記ゆれ対応表の更新で${d.autoResolved}件を自動解決しました`);
      if (d.inserted > 0) parts.push(`新たに${d.inserted}件検出しました`);
      setScanMsg(parts.length > 0 ? `✅ ${parts.join('、')}` : '✅ 不正なタグは見つかりませんでした');
      await loadQueue();
    } catch (e: any) { setError(e.message); } finally { setScanning(false); }
  };

  const runFactCheck = async () => {
    setRunning(true); setRunMsg(''); setError(''); setProgress(null);
    let offset = 0;
    let totalFlagged = 0;
    try {
      for (let i = 0; i < 200; i++) {
        const res = await fetch('/api/admin/dict-fact-check', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'batch', offset }),
        });
        if (res.status === 401) throw new Error(`管理者セッションが切れました（ここまで${offset}体は完了済みです）。再ログイン後、もう一度押すと続きから再開できます。`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'ファクトチェックに失敗しました');

        totalFlagged += d.flagged || 0;
        offset = d.nextOffset;
        setProgress({ processed: offset, total: d.totalChampions, flagged: totalFlagged });

        if (d.rateLimited) {
          setRunMsg(`⏳ AIの利用制限のため60秒待機します…（ここまで${offset}/${d.totalChampions}体完了）`);
          await new Promise((r) => setTimeout(r, 60000));
          continue;
        }
        if (d.done) break;
      }
      setRunMsg(`✅ 完了しました。${totalFlagged}件の要レビュー項目を検出しました。`);
      await loadQueue();
    } catch (e: any) { setError(e.message); } finally { setRunning(false); }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-3xl p-6 space-y-5">
      <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
        <ShieldCheck size={18} className="text-sky-600" /> 辞典・ナレッジの一斉ファクトチェック
      </h2>
      <p className="text-xs text-stone-500">
        辞典(matchup_sentinel)・コーチAI知識層(champion_facts/champion_notes)・ナレッジ(personal_knowledge)を横断し、
        表記ゆれ・矛盾・単一ソースのみの未確証な記述・公式データとの食い違いを検出します。
        <strong className="text-stone-700">自動修正・自動削除は一切行わず</strong>、検出結果は下のリストに積まれ、人間が個別に判断します。
        「訂正を記録」した内容は<strong className="text-stone-700">コーチAI・辞典再生成など今後の全AI生成の共通入口</strong>に反映され、同じ誤りの再発を防ぎます。
      </p>

      {error && <p className="text-sm text-rose-700 bg-rose-100 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

      {/* ステップ1 */}
      <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
        <h3 className="text-sm font-bold text-sky-900 flex items-center gap-1.5 mb-1">
          <Tag size={15} /> ステップ1: 表記ゆれ・不正タグの検出（無料・即時）
        </h3>
        <p className="text-[11px] text-stone-500 mb-2">champion列がスキン名混入やゴミ値で実在チャンピオン名に一致していない行を検出します。</p>
        <button onClick={runScan} disabled={scanning}
          className="flex items-center gap-1.5 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">
          {scanning ? <RefreshCw size={13} className="animate-spin" /> : <Tag size={13} />} {scanning ? 'スキャン中...' : '不正タグをスキャン'}
        </button>
        {scanMsg && <p className="text-xs text-emerald-700 mt-2">{scanMsg}</p>}
      </div>

      {/* ステップ2 */}
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
        <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-1.5 mb-1">
          <ShieldCheck size={15} /> ステップ2: チャンピオン横断ファクトチェック（AI・完走まで自動継続）
        </h3>
        <p className="text-[11px] text-stone-500 mb-2">チャンピオン単位で全ソースをまとめてAIに横断照合させます。レート制限時は60秒待って自動再開します。</p>
        <button onClick={runFactCheck} disabled={running}
          className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">
          {running ? <RefreshCw size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
          {running ? `実行中... (${progress?.processed ?? 0}/${progress?.total ?? '?'}体・${progress?.flagged ?? 0}件検出)` : '一斉ファクトチェックを実行'}
        </button>
        {runMsg && <p className="text-xs text-emerald-700 mt-2">{runMsg}</p>}
      </div>

      {/* レビューキュー */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-stone-900">検出結果一覧（要人間レビュー・{items.length}件）</h3>
          <button onClick={loadQueue} disabled={loadingQueue} className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1">
            <RefreshCw size={12} className={loadingQueue ? 'animate-spin' : ''} /> 再読込
          </button>
        </div>

        {loadingQueue ? (
          <p className="text-xs text-stone-500 py-4 text-center">読み込み中...</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-stone-500 py-4 text-center">未対応の検出項目はありません。</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <FactCheckQueueCard key={it.id} item={it} onActed={(id) => setItems((prev) => prev.filter((x) => x.id !== id))} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
