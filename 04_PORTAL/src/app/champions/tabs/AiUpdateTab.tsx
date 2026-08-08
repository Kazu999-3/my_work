"use client";

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles, RefreshCw, Activity, AlertTriangle, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import DeepResearchPanel from '../../admin/knowledge/DeepResearchPanel';

export default function AiUpdateTab() {
  const searchParams = useSearchParams();
  const highlightTaskId = searchParams?.get('failed_task') || null;

  const [champions, setChampions] = useState<any[]>([]);
  const [champDates, setChampDates] = useState<Record<string, string>>({});
  const [champPending, setChampPending] = useState<Record<string, boolean>>({});

  // パイプラインステータス（自動化ジョブの鮮度監視）
  const [pipelineStatus, setPipelineStatus] = useState<any[]>([]);
  const [failedTasks, setFailedTasks] = useState<any[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    let fetchedChampions: any[] = [];
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(r => r.json())
      .then(versions => fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/ja_JP/champion.json`))
      .then(r => r.json())
      .then(d => {
        fetchedChampions = Object.values(d.data).map((c: any) => ({
          id: c.id, key: c.key, name: c.name
        }));
        return fetch('/api/champions/dict-status', { credentials: 'include' }).then(r => r.json());
      })
      .then((statusData) => {
        setChampDates(statusData.dates || {});
        setChampPending(statusData.pending || {});
        setChampions(fetchedChampions);
      })
      .catch(console.error);
  }, []);

  const dbProgress = useMemo(() => {
    if (champions.length === 0) return { total: 0, completed: 0, percentage: 0, pending: 0 };
    const total = champions.length;
    const completed = champions.filter(c => champDates[c.id] && !champPending[c.id]).length;
    const pending = total - completed;
    const percentage = Math.round((completed / total) * 100) || 0;
    return { total, completed, pending, percentage };
  }, [champions, champDates, champPending]);

  const [workerStatus, setWorkerStatus] = useState<{ active: boolean; status: string; last_active: string | null }>({
    active: false,
    status: 'unknown',
    last_active: null
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/admin/system/status');
        if (res.ok) {
          const data = await res.json();
          setWorkerStatus(data.worker || { active: false, status: 'unknown', last_active: null });
        }
      } catch (err) {
        console.error('Failed to fetch worker status:', err);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const [bulkStatus, setBulkStatus] = useState<any>({
    initialized: false, total: 0, completed: 0, running: 0, failed: 0, pending: 0,
    status: 'idle', current_champ: null
  });
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkLogs, setBulkLogs] = useState('');

  const fetchQueueStatus = async () => {
    try {
      const res = await fetch('/api/admin/champions/queue');
      if (res.ok) {
        const data = await res.json();
        setBulkStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch queue status:', err);
    }
  };

  const fetchJobStatus = async () => {
    try {
      const res = await fetch('/api/admin/jobs?job=champion_db_bulk_update');
      if (res.ok) {
        const data = await res.json();
        setIsBulkRunning(data.isRunning);
        if (data.logs) setBulkLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch job status:', err);
    }
  };

  const handleStartBulkUpdate = async () => {
    if (!confirm("全チャンピオンの辞典データをGemini APIを用いて一括更新しますか？\n（API制限が発生した場合は安全に自動停止し、次回続きから再開できます）")) return;
    try {
      // 注意: ここでキューをresetしてはいけない。resetすると一時停止中の進捗
      // (完了済みチャンピオン)も丸ごと消え、「更新を再開」のはずが毎回ゼロから
      // やり直しになってしまう。キューの初期化は「キュー初期化」ボタン専用。
      const res = await fetch('/api/admin/jobs', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: 'champion_db_bulk_update' }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('🚀 チャンピオン辞典の一括更新をバックグラウンドで開始しました。');
        fetchJobStatus();
        fetchQueueStatus();
      } else {
        alert(data.error || 'ジョブの起動に失敗しました。');
      }
    } catch (err: any) {
      alert('ジョブ起動中に通信エラーが発生しました。');
    }
  };

  const handleResetQueue = async () => {
    if (!confirm("一括更新キューの進行状況とロックを完全に初期化しますか？\n（現在のキューファイルは削除され、次回起動時に全チャンピオンが未処理として再構築されます）")) return;
    try {
      const res = await fetch('/api/admin/champions/queue', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('🔄 キューとロックを正常にリセットしました。');
        fetchQueueStatus();
        fetchJobStatus();
      } else {
        alert(data.error || 'リセットに失敗しました。');
      }
    } catch (err: any) {
      alert('リセット処理中に通信エラーが発生しました。');
    }
  };

  useEffect(() => {
    fetchQueueStatus();
    fetchJobStatus();

    const timer = setInterval(() => {
      fetchQueueStatus();
      fetchJobStatus();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  // パイプラインステータスを30秒ごとにポーリング取得
  const fetchPipeline = async () => {
    try {
      const res = await fetch('/api/admin/pipeline-status');
      if (res.ok) {
        const data = await res.json();
        setPipelineStatus(data.pipelines || []);
        setFailedTasks(data.failedTasks || []);
      }
    } catch (err) {
      console.error('パイプラインステータス取得エラー:', err);
    }
  };

  useEffect(() => {
    fetchPipeline();
    const interval = setInterval(fetchPipeline, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRetryFailedTask = async (task: any) => {
    const champion = task.payload?.champion;
    const role = task.payload?.role || 'Jungle';
    if (!champion) return;
    setRetryingId(task.id);
    try {
      const res = await fetch('/api/admin/champions/trend', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champion, role }),
      });
      const data = await res.json();
      if (data.success) {
        setFailedTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else {
        alert(data.error || '再実行の登録に失敗しました。');
      }
    } catch (err) {
      alert('再実行の登録中に通信エラーが発生しました。');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <>
    <motion.div 
      initial={{ y: 20, opacity: 0 }} 
      animate={{ y: 0, opacity: 1 }} 
      transition={{ delay: 0.1 }} 
      className="glass-panel p-6 rounded-2xl border-t-2 border-[#c89b3c]/50 relative overflow-hidden"
    >
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#c89b3c]/5 rounded-full blur-2xl pointer-events-none" />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex-1 space-y-2 w-full">
          <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2 flex-wrap">
            <Sparkles size={20} className="text-[#c89b3c]" />
            AIチャンピオン辞典一括更新システム
            {bulkStatus.patch_version && (
              <span className="text-xs bg-black/[0.03] border border-black/10 text-gray-400 px-2 py-0.5 rounded-md font-mono">
                パッチ: {bulkStatus.patch_version}
              </span>
            )}
            <span className={`text-[10px] font-black border px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-all ${
              workerStatus.active
                ? 'bg-emerald-100 border-emerald-200 text-emerald-700 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                : 'bg-rose-100 border-rose-200 text-rose-700 animate-pulse'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${workerStatus.active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              {workerStatus.active ? 'エッジワーカー: 稼働中' : 'エッジワーカー: 停止中'}
            </span>
          </h3>
          <p className="text-xs text-gray-400">
            全チャンピオンの統計・ルーン・ビルドをGemini APIで自動リサーチし、既存のユーザーメモを保護しながら辞書を一括更新します。
          </p>
          
          {isBulkRunning || (bulkStatus.initialized && bulkStatus.total > 0) ? (
            <div className="space-y-2 mt-2 w-full">
              <div className="flex justify-between text-xs font-bold text-stone-700 flex-wrap gap-2">
                <span>ジョブ進捗率: {Math.round((bulkStatus.completed / bulkStatus.total) * 100) || 0}% ({bulkStatus.completed} / {bulkStatus.total} 体)</span>
                <span className="text-gray-400">
                  {isBulkRunning ? `🔥 ${bulkStatus.current_champ || '調査中'} をリサーチ中...` :
                   bulkStatus.status === 'suspended' ? '⏸️ API制限により一時停止中' :
                   bulkStatus.status === 'completed' ? '✅ すべての更新が完了' : '💤 待機中'}
                </span>
              </div>
              <div className="w-full bg-black/[0.03] rounded-full h-2 overflow-hidden border border-black/5">
                <div
                  className={`h-full transition-all duration-500 ${isBulkRunning ? 'bg-gradient-to-r from-amber-500 to-[#c89b3c] animate-pulse' : 'bg-[#c89b3c]'}`}
                  style={{ width: `${(bulkStatus.completed / bulkStatus.total) * 100 || 0}%` }}
                />
              </div>
              <div className="flex gap-4 text-[10px] text-gray-500 font-semibold font-mono flex-wrap">
                <span>未処理: {bulkStatus.pending}</span>
                <span className="text-amber-600">実行中: {bulkStatus.running}</span>
                <span className="text-emerald-700">完了: {bulkStatus.completed}</span>
                <span className="text-red-700">失敗: {bulkStatus.failed}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2 mt-2 w-full">
              <div className="flex justify-between text-xs font-bold text-stone-700 flex-wrap gap-2">
                <span>辞典データベース構築率: {dbProgress.percentage}% ({dbProgress.completed} / {dbProgress.total} 体 構築完了)</span>
                <span className="text-gray-400">未構築: {dbProgress.pending} 体</span>
              </div>
              <div className="w-full bg-black/[0.03] rounded-full h-2 overflow-hidden border border-black/5">
                <div
                  className="h-full bg-emerald-500/80 transition-all duration-500"
                  style={{ width: `${dbProgress.percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="flex gap-3 shrink-0 flex-wrap w-full md:w-auto justify-end">
          <button
            onClick={handleStartBulkUpdate}
            disabled={isBulkRunning}
            className="px-5 py-3 bg-gradient-to-r from-amber-500 to-[#c89b3c] hover:from-amber-400 hover:to-[#b78b2c] text-black font-black text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(200,155,60,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <RefreshCw size={16} className={isBulkRunning ? 'animate-spin' : ''} />
            {isBulkRunning ? '更新を実行中...' : bulkStatus.status === 'suspended' ? '更新を再開' : '一括更新を開始'}
          </button>
          
          <button
            onClick={handleResetQueue}
            className="px-4 py-3 glass-panel glass-panel-hover text-gray-400 hover:text-stone-900 rounded-xl text-sm font-bold transition-all"
          >
            キュー初期化
          </button>
        </div>
      </div>
    </motion.div>

    {/* 特定チャンプ ディープリサーチ（バトルリサーチ）。以前はパーソナルコーチ内にあったが、
        結果はチャンピオン辞典へ直接蓄積される辞典コンテンツ生成機能のため、
        AI更新タブ側へ移設した(2026-08-08)。 */}
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.15 }}
      className="space-y-3"
    >
      <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5 px-1">
        <Target size={16} className="text-purple-600" />
        バトルリサーチ（特定チャンピオンのAIディープリサーチ）
      </h3>
      <p className="text-xs text-gray-400 px-1">
        チャンピオンを指定してAI＋YouTube最新動画から戦術・立ち回りを深掘り検索します。結果は「チャンピオン辞典」へ直接自動蓄積・同期されます。
      </p>
      <DeepResearchPanel />
    </motion.div>

    {/* 自動化パイプラインステータス */}
    {pipelineStatus.length > 0 && (
      <motion.div 
        initial={{ y: 20, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ delay: 0.2 }}
        className="glass-panel p-6 rounded-2xl"
      >
        <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2 mb-4">
          <Activity size={20} className="text-cyan-700" />
          自動化パイプラインステータス
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pipelineStatus.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-black/[0.04] border border-black/5">
              <div>
                <span className="text-sm font-bold text-stone-900">{p.label}</span>
                <div className="text-xs text-gray-500 mt-0.5">
                  {p.lastRun ? `最終: ${new Date(p.lastRun).toLocaleString('ja-JP')}` : '未実行'}
                  {p.executor && ` （${p.executor === 'cloud' ? 'クラウド実行' : 'ローカルPC実行'}）`}
                </div>
              </div>
              <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${
                p.freshness === 'fresh' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' :
                p.freshness === 'stale' ? 'bg-amber-100 border-amber-200 text-amber-700' :
                p.freshness === 'old' ? 'bg-rose-100 border-rose-200 text-rose-700' :
                'bg-stone-100 border-stone-200 text-stone-600'
              }`}>
                {p.freshness === 'fresh' ? '✅ 正常' :
                 p.freshness === 'stale' ? '⚠️ 要更新' :
                 p.freshness === 'old' ? '🔴 古い' : '➖ 未実行'}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    )}

    {/* チャンピオントレンド 失敗タスク一覧 + 再実行 */}
    {failedTasks.length > 0 && (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="glass-panel p-6 rounded-2xl border-t-2 border-rose-500/40"
      >
        <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-rose-700" />
          チャンピオントレンド更新の失敗タスク（{failedTasks.length}件）
        </h3>
        <div className="space-y-2">
          {failedTasks.map((task) => {
            const champion = task.payload?.champion || '(不明)';
            const role = task.payload?.role || '';
            const isHighlighted = highlightTaskId && task.id === highlightTaskId;
            return (
              <div
                key={task.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl bg-black/[0.04] border ${
                  isHighlighted ? 'border-rose-400/70 ring-1 ring-rose-400/40' : 'border-black/5'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-stone-900">
                    {champion} <span className="text-gray-500 font-normal">/ {role}</span>
                    {task.executor && (
                      <span className="ml-2 text-[10px] text-gray-500 font-normal">
                        ({task.executor === 'cloud' ? 'クラウド実行' : 'ローカルPC実行'})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate" title={task.error_message || ''}>
                    {(task.error_message || '').slice(0, 120) || '(エラー詳細なし)'}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {task.updated_at && new Date(task.updated_at).toLocaleString('ja-JP')}
                  </div>
                </div>
                <button
                  onClick={() => handleRetryFailedTask(task)}
                  disabled={retryingId === task.id}
                  className="shrink-0 px-4 py-2 bg-rose-100 hover:bg-rose-200 border border-rose-200 text-rose-700 font-bold text-xs rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RefreshCw size={14} className={retryingId === task.id ? 'animate-spin' : ''} />
                  再実行
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>
    )}
    </>
  );
}
