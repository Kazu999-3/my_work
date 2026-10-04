'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Activity, CheckCircle2, AlertTriangle, RefreshCw, Search, ShieldCheck, 
  Sparkles, Filter, ExternalLink, ArrowLeft, Play, ShieldAlert, Award
} from 'lucide-react';
import { getChampIcon } from '../../../lib/ddragonClient';

interface ChampHealth {
  champion: string;
  patch: string;
  confidence: 'verified' | 'ai_generated' | 'stale';
  status: 'verified' | 'ai_generated' | 'stale';
  lastVerifiedAt: string | null;
  lastVerifiedBy: string | null;
  autoUpdatedAt: string | null;
  sourceSummary: string | null;
  updatedAt: string | null;
  hasContent: boolean;
  priorityScore: number;
}

function DictHealthDashboardContent() {
  const [data, setData] = useState<{
    currentPatch: string;
    totalCount: number;
    summary: { verified: number; aiGenerated: number; stale: number };
    priorityChampions?: ChampHealth[];
    champions: ChampHealth[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  // ?q=<チャンピオン> で開くと、そのチャンピオンに絞り込んだ状態で表示する（通知からの遷移用）
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'verified' | 'ai_generated' | 'stale'>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchHealth = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/admin/dict-health');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        showMessage('データの取得に失敗しました', 'error');
      }
    } catch {
      showMessage('通信エラーが発生しました', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleVerify = async (champion: string, action: 'verify' | 'unverify' | 'enqueue_update') => {
    setActionLoading(champion + '_' + action);

    // オプティミスティックUI反映
    if (data && (action === 'verify' || action === 'unverify')) {
      const nextStatus: 'verified' | 'ai_generated' = action === 'verify' ? 'verified' : 'ai_generated';
      setData((prev) => {
        if (!prev) return prev;
        const updatedChamps = prev.champions.map((c) =>
          c.champion.toLowerCase() === champion.toLowerCase()
            ? { ...c, status: nextStatus, confidence: nextStatus }
            : c
        );
        const verifiedCount = updatedChamps.filter((c) => c.status === 'verified').length;
        const aiGenCount = updatedChamps.filter((c) => c.status === 'ai_generated').length;
        const staleCount = updatedChamps.filter((c) => c.status === 'stale').length;
        const nextPriority = updatedChamps.filter((c) => c.status !== 'verified').slice(0, 10);

        return {
          ...prev,
          summary: { verified: verifiedCount, aiGenerated: aiGenCount, stale: staleCount },
          priorityChampions: nextPriority,
          champions: updatedChamps,
        };
      });
    }

    try {
      const res = await fetch('/api/admin/dict-health/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, champion }),
      });
      const json = await res.json();
      if (res.ok) {
        showMessage(json.message, 'success');
        fetchHealth(true);
      } else {
        showMessage(json.error || '処理に失敗しました', 'error');
        fetchHealth(true);
      }
    } catch {
      showMessage('通信エラーが発生しました', 'error');
      fetchHealth(true);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredChampions = useMemo(() => {
    if (!data?.champions) return [];
    return data.champions.filter((c) => {
      const matchSearch = !search || c.champion.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ページタイトル ＆ アクション */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Activity className="w-6 h-6 md:w-7 md:h-7 text-indigo-400" />
              🩺 辞典ヘルス監査センター
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              全173体のチャンピオン辞典データの鮮度・人間検証ステータス・AI更新を管理します。
            </p>
          </div>

          <button
            onClick={() => fetchHealth()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            最新化
          </button>
        </div>

        {/* トースト通知 */}
        {message && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
              message.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300'
                : 'bg-rose-950/80 border-rose-700/60 text-rose-300'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        {/* 状態サマリーカード */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">現行パッチ</span>
              <div className="text-xl font-black text-indigo-400 tracking-tight">
                Patch {data.currentPatch}
              </div>
              <p className="text-[10px] text-slate-500">西暦パッチSSoT</p>
            </div>

            <div 
              onClick={() => setStatusFilter(statusFilter === 'verified' ? 'ALL' : 'verified')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                statusFilter === 'verified'
                  ? 'bg-emerald-950/60 border-emerald-500 shadow-md shadow-emerald-950/50'
                  : 'bg-slate-900/90 border-slate-800 hover:border-emerald-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-emerald-400 font-medium">
                <span>🟢 実戦・確認済み</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-xl font-black text-emerald-300 mt-1">
                {data.summary.verified} <span className="text-xs text-slate-500 font-normal">/ {data.totalCount}</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${(data.summary.verified / (data.totalCount || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div 
              onClick={() => setStatusFilter(statusFilter === 'ai_generated' ? 'ALL' : 'ai_generated')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                statusFilter === 'ai_generated'
                  ? 'bg-amber-950/60 border-amber-500 shadow-md shadow-amber-950/50'
                  : 'bg-slate-900/90 border-slate-800 hover:border-amber-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-amber-400 font-medium">
                <span>🟡 AI最新生成 (未確認)</span>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xl font-black text-amber-300 mt-1">
                {data.summary.aiGenerated} <span className="text-xs text-slate-500 font-normal">/ {data.totalCount}</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${(data.summary.aiGenerated / (data.totalCount || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div 
              onClick={() => setStatusFilter(statusFilter === 'stale' ? 'ALL' : 'stale')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                statusFilter === 'stale'
                  ? 'bg-rose-950/60 border-rose-500 shadow-md shadow-rose-950/50'
                  : 'bg-slate-900/90 border-slate-800 hover:border-rose-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-rose-400 font-medium">
                <span>🔴 要対応 (旧パッチ/空)</span>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="text-xl font-black text-rose-300 mt-1">
                {data.summary.stale} <span className="text-xs text-slate-500 font-normal">/ {data.totalCount}</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${(data.summary.stale / (data.totalCount || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 優先確認ランキング（要対応トップ10） */}
        {data && data.priorityChampions && data.priorityChampions.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                最優先確認・更新推奨チャンピオン（Top {data.priorityChampions.length}）
              </span>
              <span className="text-[11px] text-slate-500">旧パッチや知見不足のチャンプ</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.priorityChampions.map((c) => (
                <div 
                  key={c.champion}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs"
                >
                  <img src={getChampIcon(c.champion)} alt={c.champion} className="w-5 h-5 rounded-md object-cover" />
                  <span className="font-bold text-slate-200">{c.champion}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-800/50">
                    P{c.patch}
                  </span>
                  <button
                    onClick={() => handleVerify(c.champion, 'verify')}
                    disabled={actionLoading === c.champion + '_verify'}
                    title="確認済みに変更"
                    className="p-1 rounded text-emerald-400 hover:bg-emerald-950/60 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 検索 ＆ フィルタバー */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="チャンピオン名で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Filter className="w-3 h-3" /> 状態:
            </span>
            {(['ALL', 'verified', 'ai_generated', 'stale'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'ALL' && '全て'}
                {st === 'verified' && '🟢 確認済'}
                {st === 'ai_generated' && '🟡 AI生成'}
                {st === 'stale' && '🔴 要対応'}
              </button>
            ))}
          </div>
        </div>

        {/* チャンピオン一覧テーブル */}
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/70 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">チャンピオン</th>
                  <th className="py-3 px-3">ステータス</th>
                  <th className="py-3 px-3">パッチ</th>
                  <th className="py-3 px-3 hidden md:table-cell">検証・更新履歴</th>
                  <th className="py-3 px-3 hidden lg:table-cell">一次ソース要約</th>
                  <th className="py-3 px-4 text-right">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <div className="inline-block animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full mr-2 align-middle" />
                      辞典データを集計中...
                    </td>
                  </tr>
                ) : filteredChampions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      該当するチャンピオンが見つかりません
                    </td>
                  </tr>
                ) : (
                  filteredChampions.map((c) => {
                    const isVerified = c.status === 'verified';
                    const isStale = c.status === 'stale';

                    return (
                      <tr key={c.champion} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={getChampIcon(c.champion)}
                              alt={c.champion}
                              className="w-8 h-8 rounded-lg object-cover border border-slate-800"
                            />
                            <div>
                              <div className="font-bold text-slate-200">{c.champion}</div>
                              <div className="text-[10px] text-slate-500">
                                {c.hasContent ? '知見データあり' : '⚠️ 空データ'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isVerified
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                : isStale
                                ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                                : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                            }`}
                          >
                            {isVerified && <CheckCircle2 className="w-3 h-3" />}
                            {isStale && <AlertTriangle className="w-3 h-3" />}
                            {!isVerified && !isStale && <Sparkles className="w-3 h-3" />}
                            {isVerified ? '確認済' : isStale ? '要対応' : 'AI生成'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-mono text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-[11px]">
                            {c.patch}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 hidden md:table-cell">
                          <div className="text-[10px] text-slate-400 space-y-0.5">
                            {c.lastVerifiedAt ? (
                              <div className="text-emerald-400 font-medium">
                                検証: {new Date(c.lastVerifiedAt).toLocaleDateString('ja-JP')} ({c.lastVerifiedBy || 'admin'})
                              </div>
                            ) : (
                              <div className="text-slate-500">未検証</div>
                            )}
                            {c.autoUpdatedAt && (
                              <div className="text-slate-500">
                                AI: {new Date(c.autoUpdatedAt).toLocaleDateString('ja-JP')}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 hidden lg:table-cell max-w-xs">
                          <p className="text-[11px] text-slate-400 truncate" title={c.sourceSummary || 'ソース情報なし'}>
                            {c.sourceSummary || '-'}
                          </p>
                        </td>

                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isVerified ? (
                              <button
                                onClick={() => handleVerify(c.champion, 'unverify')}
                                disabled={actionLoading === c.champion + '_unverify'}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition-colors"
                                title="未確認ステータスに戻す"
                              >
                                取消
                              </button>
                            ) : (
                              <button
                                onClick={() => handleVerify(c.champion, 'verify')}
                                disabled={actionLoading === c.champion + '_verify'}
                                className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-colors shadow-sm"
                                title="実戦・確認済みに設定"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                確認済みにする
                              </button>
                            )}

                            <button
                              onClick={() => handleVerify(c.champion, 'enqueue_update')}
                              disabled={actionLoading === c.champion + '_enqueue_update'}
                              className="p-1 rounded bg-slate-950 border border-slate-800 text-amber-400 hover:bg-slate-800 transition-colors"
                              title="AI再リサーチキューを起票"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>

                            <Link
                              href={`/?c=${encodeURIComponent(c.champion)}`}
                              className="p-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                              title="辞典詳細を見る"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function DictHealthDashboard() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 text-xs">ロード中...</div>}>
      <DictHealthDashboardContent />
    </Suspense>
  );
}
