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

  // 170体前後×5体/回で数分〜十数分かかるクライアント駆動ループのため、実行中にタブを
  // 閉じる/リロードすると中断される。注意書きだけでは見落とされるため、離脱時に
  // 確認ダイアログを出す(2026-08-05発覚)。
  useEffect(() => {
    if (!running) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [running]);

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
      if (d.capped) parts.push('未処理レビューが上限(50件)に達しているため、これ以上の新規検出は一時停止しています。先に下のリストを処理してください');
      setScanMsg(parts.length > 0 ? `✅ ${parts.join('、')}` : '✅ 不正なタグは見つかりませんでした');
      await loadQueue();
    } catch (e: any) { setError(e.message); } finally { setScanning(false); }
  };

  const runFactCheck = async () => {
    setRunning(true); setRunMsg(''); setError(''); setProgress(null);
    let offset = 0;
    let totalFlagged = 0;
    let stoppedByCap = false;
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
        if (d.capped) {
          stoppedByCap = true;
          setRunMsg(`⚠️ 未処理レビューが上限(50件)に達したため中断しました（ここまで${totalFlagged}件検出）。先に下のリストを処理してから再実行してください。`);
          break;
        }
        if (d.done) break;
      }
      if (!stoppedByCap) setRunMsg(`✅ 完了しました。${totalFlagged}件の要レビュー項目を検出しました。`);
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

      {/* 統合全自動ファクトチェックボタン */}
      <div className="rounded-2xl border border-cyan-300 bg-gradient-to-r from-cyan-500/10 via-indigo-500/5 to-transparent p-5 shadow-sm">
        <h3 className="text-sm font-extrabold text-cyan-950 flex items-center gap-2 mb-1.5">
          <ShieldCheck className="w-5 h-5 text-cyan-600" />
          全自動一斉ファクトチェック (表記ゆれスキャン ＋ 全170+体AI判定完走)
        </h3>
        <p className="text-xs text-stone-600 mb-3 leading-relaxed">
          ボタン1つで「表記ゆれ・タグ異常の即時検知」と「全チャンピオン全データと公式データのAI整合性チェック」を全自動で完走させます。
        </p>
        <button
          onClick={async () => {
            await runScan();
            await runFactCheck();
          }}
          disabled={scanning || running}
          className="flex items-center gap-2 text-xs font-black bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 active:scale-95 text-white px-6 py-3 rounded-xl shadow-md transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${(scanning || running) ? 'animate-spin' : ''}`} />
          {(scanning || running)
            ? `AI全自動一斉ファクトチェック実行中... (${progress?.processed ?? 0}/${progress?.total ?? '?'}体完了・${progress?.flagged ?? 0}件検出)`
            : '🛡️ 辞典・ナレッジ全自動一斉ファクトチェックを実行'}
        </button>

        {(scanning || running) && (
          <p className="text-xs text-amber-700 font-bold mt-2">
            ⚠️ 実行中にタブを閉じる・リロードすると中断されます。完走まで開いたままにしていただくか、完了をお待ちください。
          </p>
        )}
        {scanMsg && <p className="text-xs text-emerald-700 font-bold mt-2">{scanMsg}</p>}
        {runMsg && <p className="text-xs text-emerald-700 font-bold mt-2">{runMsg}</p>}
      </div>

      {/* レビューキュー */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            検出結果レビュー（要人間確認・残り {items.length} 件）
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadQueue()}
              disabled={loadingQueue}
              className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 font-bold"
            >
              <RefreshCw size={12} className={loadingQueue ? 'animate-spin' : ''} /> 再読込
            </button>
          </div>
        </div>

        {loadingQueue ? (
          <p className="text-xs text-stone-500 py-4 text-center">読み込み中...</p>
        ) : items.length === 0 ? (
          <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
            <p className="text-xs font-bold text-emerald-800">🎉 未対応の検出項目はありません。すべてのファクトチェック点検が完了しています！</p>
          </div>
        ) : (
          /* 1件ずつ集中処理のフォーカスカード */
          <div className="space-y-2">
            <div className="bg-stone-100 p-2.5 rounded-xl text-xs text-stone-600 font-extrabold flex justify-between items-center">
              <span>🎯 目の前の1件に集中して片付ける (1 / {items.length} 件目を点検中)</span>
              <span>1件片付けると自動で次のカードへ進みます</span>
            </div>
            <FactCheckQueueCard item={items[0]} onActed={(id) => setItems((prev) => prev.filter((x) => x.id !== id))} />
          </div>
        )}
      </div>
    </div>
  );
}
