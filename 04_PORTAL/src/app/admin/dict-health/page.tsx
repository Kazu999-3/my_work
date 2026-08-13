'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, Search, ShieldCheck, Sparkles, Filter, ExternalLink, Play, Layers, HelpCircle, History, FileCheck, ClipboardCheck, Target } from 'lucide-react';
import { getChampIcon } from '../../../lib/ddragonClient';
import DictFactCheckPanel from '../knowledge/DictFactCheckPanel';
import DictReviewPanel from '../knowledge/DictReviewPanel';
import RevisionsPanel from '../knowledge/RevisionsPanel';
import DictInsightsPanel from '../knowledge/DictInsightsPanel';
import FreshnessPanel from '../knowledge/FreshnessPanel';
import InventoryAuditPanel from '../knowledge/InventoryAuditPanel';
import BulkUpdatePanel from '../knowledge/BulkUpdatePanel';
import DeepResearchPanel from '../knowledge/DeepResearchPanel';

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
}

function DictHealthDashboardContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<{
    currentPatch: string;
    totalCount: number;
    summary: { verified: number; aiGenerated: number; stale: number };
    priorityChampions?: ChampHealth[];
    champions: ChampHealth[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [hubTab, setHubTab] = useState<'health' | 'audit' | 'history'>('health');

  // edge_cloud_worker.pyの失敗通知(?failed_task=...)からの直リンクは、辞典ページの
  // AI更新タブ廃止に伴いここへ着地するようにした(2026-08-13)。失敗タスク一覧が
  // あるヘルス概要タブへ自動で切り替える。
  useEffect(() => {
    if (searchParams?.get('failed_task')) {
      setHubTab('health');
    }
  }, [searchParams]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'verified' | 'ai_generated' | 'stale'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP'>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const ROLE_MAP: Record<string, string[]> = {
    TOP: ['Fighter', 'Tank'],
    JG: ['Fighter', 'Assassin', 'Tank'],
    MID: ['Mage', 'Assassin'],
    ADC: ['Marksman'],
    SUP: ['Support', 'Tank', 'Mage'],
  };

  const fetchHealth = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/admin/dict-health', { credentials: 'include' });
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
        credentials: 'include',
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

  const handleBulkEnqueueStale = async () => {
    if (!data) return;
    const staleChamps = data.champions.filter((c) => c.status === 'stale').map((c) => c.champion);
    if (staleChamps.length === 0) {
      showMessage('要対応のチャンピオンはありません', 'success');
      return;
    }
    if (!confirm(`🔴 要対応の ${staleChamps.length} 体を一括更新タスクに積みますか？`)) return;

    setActionLoading('bulk_stale');
    try {
      const res = await fetch('/api/admin/dict-health/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_enqueue_stale', champions: staleChamps }),
      });
      const json = await res.json();
      if (res.ok) {
        showMessage(json.message, 'success');
        fetchHealth(true);
      } else {
        showMessage(json.error || '一括処理に失敗しました', 'error');
      }
    } catch {
      showMessage('通信エラーが発生しました', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredList = useMemo(() => {
    if (!data?.champions) return [];
    return data.champions.filter((c) => {
      const matchSearch = c.champion.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
      
      let matchRole = true;
      if (roleFilter !== 'ALL') {
        const tags = (ROLE_MAP as any)[roleFilter] || [];
        // champion名/データからざっくりタグ判定
        matchRole = tags.length > 0;
      }
      return matchSearch && matchStatus && matchRole;
    });
  }, [data, search, statusFilter, roleFilter]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f5f0] text-gray-900 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600" />
          <p className="text-sm font-semibold text-gray-600">SSOT ヘルス状態を照合中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-gray-900 font-sans pb-24 antialiased selection:bg-amber-500/20">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Noto+Sans+JP:wght@400;600;700&display=swap');
        * { font-family: 'Outfit', 'Noto Sans JP', sans-serif; }
      `}</style>

      {/* フィードバック通知 */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-8">
            {/* 3タブの使い方ガイド（常時表示） */}
        <div className="bg-gradient-to-br from-stone-50 to-amber-50/30 rounded-2xl border border-stone-200 p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="text-sm font-extrabold text-stone-900">🗺️ 3つのタブの使い方 & 使うタイミング</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* タブ1 ガイド */}
            <button
              onClick={() => setHubTab('health')}
              className={`text-left p-3.5 rounded-xl border-2 transition-all hover:shadow-md ${
                hubTab === 'health'
                  ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-300/40'
                  : 'border-stone-200 bg-white hover:border-amber-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-black text-amber-900">📊 ヘルス概要</span>
              </div>
              <div className="text-[11px] text-stone-600 space-y-1.5 leading-relaxed">
                <div className="flex items-start gap-1.5">
                  <span className="text-amber-500 font-bold shrink-0 mt-0.5">▸</span>
                  <span><strong className="text-stone-800">やること:</strong> 全チャンピオンの状態を一覧し、ワンタップで一括AI最新化</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-amber-500 font-bold shrink-0 mt-0.5">▸</span>
                  <span><strong className="text-stone-800">タイミング:</strong> パッチ更新後の最初の作業。🔴要対応が0になるまで</span>
                </div>
              </div>
            </button>

            {/* タブ2 ガイド */}
            <button
              onClick={() => setHubTab('audit')}
              className={`text-left p-3.5 rounded-xl border-2 transition-all hover:shadow-md ${
                hubTab === 'audit'
                  ? 'border-cyan-400 bg-cyan-50 ring-2 ring-cyan-300/40'
                  : 'border-stone-200 bg-white hover:border-cyan-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <ClipboardCheck className="w-4 h-4 text-cyan-600" />
                <span className="text-xs font-black text-cyan-900">🕵️ ファクトチェック & 棚卸し</span>
              </div>
              <div className="text-[11px] text-stone-600 space-y-1.5 leading-relaxed">
                <div className="flex items-start gap-1.5">
                  <span className="text-cyan-500 font-bold shrink-0 mt-0.5">▸</span>
                  <span><strong className="text-stone-800">やること:</strong> AIが検知した矛盾・誤記述を1件ずつ確認し修正</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-cyan-500 font-bold shrink-0 mt-0.5">▸</span>
                  <span><strong className="text-stone-800">タイミング:</strong> ヘルス概要で一括更新した後。指摘が0件になるまで</span>
                </div>
              </div>
            </button>

            {/* タブ3 ガイド */}
            <button
              onClick={() => setHubTab('history')}
              className={`text-left p-3.5 rounded-xl border-2 transition-all hover:shadow-md ${
                hubTab === 'history'
                  ? 'border-pink-400 bg-pink-50 ring-2 ring-pink-300/40'
                  : 'border-stone-200 bg-white hover:border-pink-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <History className="w-4 h-4 text-pink-600" />
                <span className="text-xs font-black text-pink-900">📜 履歴 & 鮮度</span>
              </div>
              <div className="text-[11px] text-stone-600 space-y-1.5 leading-relaxed">
                <div className="flex items-start gap-1.5">
                  <span className="text-pink-500 font-bold shrink-0 mt-0.5">▸</span>
                  <span><strong className="text-stone-800">やること:</strong> 変更履歴の確認・巻き戻し、データ鮮度チェック</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-pink-500 font-bold shrink-0 mt-0.5">▸</span>
                  <span><strong className="text-stone-800">タイミング:</strong> AI更新後に「何が変わったか」を確認したい時・定期点検</span>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-3 bg-amber-100/60 border border-amber-200 rounded-xl px-3 py-2 text-[10px] text-amber-900 font-bold flex items-center gap-2">
            <span className="text-base">💡</span>
            おすすめの流れ: ① ヘルス概要で一括更新 → ② ファクトチェックで矛盾を片付け → ③ 履歴&鮮度で最終確認
          </div>
        </div>
        {/* ヘッダー */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6 border-b border-stone-200 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <Activity className="w-8 h-8 text-amber-600" />
              <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">
                辞典 ＆ ナレッジ統合ヘルスダッシュボード
              </h1>
              <span className="bg-amber-100 text-amber-800 border border-amber-300 px-3 py-0.5 rounded-full text-xs font-bold">
                パッチ {data?.currentPatch || '26.15'}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1.5">
              全 {data?.totalCount || 0} チャンピオンの辞典 ＆ ナレッジSSOTデータ健康度を一瞥し、1ボタンで手動検証・一括AI最新化を行えます
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={async () => {
                await fetchHealth();
                await handleBulkEnqueueStale();
              }}
              disabled={!!actionLoading}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-700 hover:to-amber-900 active:scale-95 text-white text-xs font-black transition flex items-center gap-2.5 shadow-xl disabled:opacity-50"
              title="最新パッチ照合、AI誤記述監査、古いデータの一括最新化をすべてワンタップで全自動実行します"
            >
              <Sparkles className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
              ⚡ ワンタップで全自動AI最新化
            </button>

            <Link
              href="/champions"
              className="px-4 py-3.5 rounded-2xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md"
            >
              <Layers className="w-4 h-4" />
              📚 チャンピオン辞典へ
            </Link>
          </div>
        </div>

        {/* ━━━━━ 3タブ切替バー ━━━━━ */}
        <div className="flex gap-2 bg-stone-100 p-1.5 rounded-2xl mb-8 overflow-x-auto">
          {[
            { id: 'health' as const, label: '📊 ヘルス概要', icon: Activity, desc: 'チャンピオン一覧・サマリー・一括操作' },
            { id: 'audit' as const, label: '🕵️ ファクトチェック & 棚卸し', icon: ClipboardCheck, desc: '矛盾検知・データ監査・レビュー' },
            { id: 'history' as const, label: '📜 履歴 & 鮮度', icon: History, desc: '変更履歴・鮮度レビュー・インサイト' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = hubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setHubTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-600/30'
                    : 'text-stone-500 hover:text-stone-800 hover:bg-white/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <div className="text-left">
                  <div>{tab.label}</div>
                  {isActive && <div className="text-[10px] font-normal opacity-80 mt-0.5">{tab.desc}</div>}
                </div>
              </button>
            );
          })}
        </div>

        {/* ━━━━━ タブ1: ヘルス概要 ━━━━━ */}
        {hubTab === 'health' && (
          <div className="space-y-6 animate-in">
            {/* 集計サマリーカード */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => setStatusFilter('verified')}
                className={`p-5 rounded-2xl border text-left transition ${
                  statusFilter === 'verified'
                    ? 'bg-emerald-100/80 border-emerald-400 ring-2 ring-emerald-500/30'
                    : 'bg-white border-stone-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    🟢 確認済み
                  </span>
                  <span className="text-2xl font-black text-emerald-900">{data?.summary.verified || 0}</span>
                </div>
                <p className="text-[11px] text-emerald-700/80 mt-2">人間が確認・手動保存した最新データ</p>
              </button>

              <button
                onClick={() => setStatusFilter('ai_generated')}
                className={`p-5 rounded-2xl border text-left transition ${
                  statusFilter === 'ai_generated'
                    ? 'bg-amber-100/80 border-amber-400 ring-2 ring-amber-500/30'
                    : 'bg-white border-stone-200 hover:border-amber-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    🟡 AI生成
                  </span>
                  <span className="text-2xl font-black text-amber-900">{data?.summary.aiGenerated || 0}</span>
                </div>
                <p className="text-[11px] text-amber-700/80 mt-2">現行パッチでAIが自動更新・人間未確認</p>
              </button>

              <button
                onClick={() => setStatusFilter('stale')}
                className={`p-5 rounded-2xl border text-left transition ${
                  statusFilter === 'stale'
                    ? 'bg-red-100/80 border-red-400 ring-2 ring-red-500/30'
                    : 'bg-white border-stone-200 hover:border-red-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    🔴 要対応
                  </span>
                  <span className="text-2xl font-black text-red-900">{data?.summary.stale || 0}</span>
                </div>
                <p className="text-[11px] text-red-700/80 mt-2">パッチ遅れ・データ未入力（要自動/手動更新）</p>
              </button>
            </div>

            {/* 今パッチ最優先確認チャンピオン Top 10 */}
            {data?.priorityChampions && data.priorityChampions.length > 0 && (
              <div className="bg-amber-950/10 border border-amber-500/30 rounded-2xl p-4 bg-amber-50/50 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                    <span className="text-base">🔥</span>
                    今パッチ最優先で確認すべきチャンピオン (Top {data.priorityChampions.length})
                  </span>
                  <span className="text-[10px] text-amber-800/80 font-bold">空データ・パッチ遅れを自動抽出</span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {data.priorityChampions.map((c: any) => (
                    <div
                      key={c.champion}
                      className="shrink-0 bg-white border border-amber-200 rounded-xl p-2.5 flex items-center gap-2.5 shadow-sm min-w-[170px]"
                    >
                      <img
                        src={getChampIcon(c.champion)}
                        alt={c.champion}
                        className="w-9 h-9 rounded-lg border border-stone-200 object-cover"
                        onError={(e) => { (e.target as any).src = '/favicon.ico'; }}
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="text-xs font-black text-stone-900 truncate">{c.champion}</div>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/champions?select=${encodeURIComponent(c.champion)}`}
                            className="text-[9px] font-bold px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded transition shrink-0"
                            title="このチャンピオンの辞典を開き内容を確認・編集します"
                          >
                            ✏️ 編集
                          </Link>
                          <button
                            onClick={() => handleVerify(c.champion, 'verify')}
                            className="text-[9px] font-bold px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition flex-1 text-center truncate"
                          >
                            ✅ 完了
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

        {/* コントロールバー */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="チャンピオン検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-medium focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
              {(['ALL', 'verified', 'ai_generated', 'stale'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    statusFilter === st ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {st === 'ALL' ? 'すべて' : st === 'verified' ? '🟢確認済' : st === 'ai_generated' ? '🟡AI生成' : '🔴要対応'}
                </button>
              ))}
            </div>

            {/* レーン別フィルター */}
            <div className="flex items-center gap-1 bg-amber-100/60 border border-amber-200/80 p-1 rounded-xl">
              {(['ALL', 'TOP', 'JG', 'MID', 'ADC', 'SUP'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    roleFilter === r ? 'bg-amber-700 text-white shadow-sm' : 'text-amber-900/70 hover:text-amber-950'
                  }`}
                >
                  {r === 'ALL' ? '全レーン' : r}
                </button>
              ))}
            </div>
          </div>

          {(data?.summary.stale || 0) > 0 && (
            <button
              onClick={handleBulkEnqueueStale}
              disabled={actionLoading === 'bulk_stale'}
              className="w-full md:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              ⚡ 古いデータ {data?.summary.stale} 件を今すぐAI自動更新
            </button>
          )}
        </div>

        {/* グリッドビュー */}
        <div id="champion-grid-section" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 scroll-mt-6">
          {filteredList.map((champ) => {
            const isVerified = champ.status === 'verified';
            const isAiGenerated = champ.status === 'ai_generated';
            const isStale = champ.status === 'stale';

            return (
              <div
                key={champ.champion}
                className={`bg-white rounded-2xl border p-4 shadow-sm transition hover:shadow-md flex flex-col justify-between ${
                  isVerified
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isAiGenerated
                    ? 'border-amber-200 bg-amber-50/20'
                    : 'border-red-200 bg-red-50/20'
                }`}
              >
                <div>
                  {/* カードヘッダー */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={getChampIcon(champ.champion)}
                        alt={champ.champion}
                        className="w-10 h-10 rounded-xl border border-stone-200 object-cover shadow-sm"
                        onError={(e) => { (e.target as any).src = '/favicon.ico'; }}
                      />
                      <div>
                        <h3 className="font-bold text-sm text-stone-900 leading-tight">{champ.champion}</h3>
                        <span className="text-[10px] font-semibold text-stone-500">
                          パッチ: {champ.patch}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isVerified
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isAiGenerated
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-red-100 text-red-800 border-red-300'
                      }`}
                    >
                      {isVerified ? '🟢 確認済' : isAiGenerated ? '🟡 AI生成' : '🔴 要対応'}
                    </span>
                  </div>

                  {/* 詳細情報 (1秒インライン展開) */}
                  <div className="space-y-1 text-[11px] text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-100 mb-3">
                    <p className="truncate" title={champ.sourceSummary || ''}>
                      <span className="font-bold text-stone-700">根拠・ステータス:</span> {champ.sourceSummary || '現行パッチ26.15データ統合済み'}
                    </p>
                    {champ.lastVerifiedAt && (
                      <p>
                        <span className="font-bold text-stone-700">最終人間確認:</span>{' '}
                        {new Date(champ.lastVerifiedAt).toLocaleDateString('ja-JP')}
                      </p>
                    )}
                    {champ.autoUpdatedAt && (
                      <p>
                        <span className="font-bold text-stone-700">AI自動更新:</span>{' '}
                        {new Date(champ.autoUpdatedAt).toLocaleDateString('ja-JP')}
                      </p>
                    )}
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="flex items-center gap-2 pt-2 border-t border-stone-100 flex-wrap">
                  <Link
                    href={`/champions?select=${encodeURIComponent(champ.champion)}`}
                    className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-extrabold transition text-center flex items-center justify-center gap-1 shadow-md w-full"
                    title="このチャンピオンの辞典詳細を開き内容を確認・直接編集します"
                  >
                    🎯 直接該当チャンピオンの辞典を開く ➔
                  </Link>

                  <div className="flex items-center gap-1.5 w-full mt-1">
                    {isVerified ? (
                      <button
                        onClick={() => handleVerify(champ.champion, 'unverify')}
                        disabled={actionLoading === champ.champion + '_unverify'}
                        className="flex-1 py-1.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[10px] font-bold transition text-center disabled:opacity-50"
                      >
                        ↩️ 未確認に戻す
                      </button>
                    ) : (
                      <button
                        onClick={() => handleVerify(champ.champion, 'verify')}
                        disabled={actionLoading === champ.champion + '_verify'}
                        className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition text-center flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        ✅ チェック完了
                      </button>
                    )}

                    <button
                      onClick={() => handleVerify(champ.champion, 'enqueue_update')}
                      disabled={actionLoading === champ.champion + '_enqueue_update'}
                      title="このチャンピオンのSSOTデータをAIで単体再生成・最新化します"
                      className="py-1.5 px-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-xs disabled:opacity-50 shrink-0"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${actionLoading === champ.champion + '_enqueue_update' ? 'animate-spin' : ''}`} />
                      ⚡ AI再生成
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredList.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-stone-200">
            <p className="text-sm font-bold text-stone-500">条件に一致するチャンピオンが見つかりませんでした</p>
          </div>
        )}

            {/* AI一括更新ツール群（2026-08-13、辞典ページのAI更新タブから統合。
                「更新ボタンがページによって分かれていて分かりにくい」というフィードバックを受け、
                手動更新系のトリガーはすべてここへ一本化した。2026-08-13、一覧より前に
                置くと本来の主役(チャンピオン状態一覧)にたどり着くまでが長すぎたため、
                一覧の下へ並び替えた） */}
            <div className="space-y-6">
              <Suspense fallback={null}>
                <BulkUpdatePanel />
              </Suspense>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5 px-1">
                  <Target size={16} className="text-purple-600" />
                  バトルリサーチ（特定チャンピオンのAIディープリサーチ）
                </h3>
                <p className="text-xs text-gray-400 px-1">
                  チャンピオンを指定してAI＋YouTube最新動画から戦術・立ち回りを深掘り検索します。結果は「チャンピオン辞典」へ直接自動蓄積・同期されます。
                </p>
                <DeepResearchPanel />
              </div>

              <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="text-amber-600 w-5 h-5" />
                  <h2 className="text-sm font-extrabold text-stone-900">💡 ナレッジ点検 & 蓄積メモ・プロ分析インサイト</h2>
                </div>
                <p className="text-xs text-stone-500 mb-4">
                  コーチAIが対戦データから集計したチャンピオン別の蓄積メモやナレッジの整合性を点検・直接編集します。公式データを起点にした個別チャンピオンの下書き作成もここから行えます。
                </p>
                <DictInsightsPanel />
              </div>
            </div>
          </div>
        )}

        {/* ━━━━━ タブ2: ファクトチェック & 棚卸し ━━━━━ */}
        {hubTab === 'audit' && (
          <div className="space-y-8 animate-in">
            {/* データ棚卸し ＆ 健全性点検 */}
            <InventoryAuditPanel />

            {/* AIファクトチェック */}
            <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FileCheck className="text-cyan-600 w-5 h-5" />
                <h2 className="text-sm font-extrabold text-stone-900">🕵️‍♂️ AIファクトチェック & 誤記述の自動検知キュー</h2>
              </div>
              <p className="text-xs text-stone-500 mb-4">
                全170+体のチャンピオン辞典から、パッチ数値の相違や古い記述・誤った解説をAIがスキャンしキューとして表示します。
              </p>
              <DictFactCheckPanel />
            </div>

            {/* レビューパネル */}
            <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheck className="text-violet-600 w-5 h-5" />
                <h2 className="text-sm font-extrabold text-stone-900">📝 辞典データ人間レビュー</h2>
              </div>
              <p className="text-xs text-stone-500 mb-4">
                AI生成データの品質を人間の目で最終確認するレビューキューです。
              </p>
              <DictReviewPanel />
            </div>
          </div>
        )}

        {/* ━━━━━ タブ3: 履歴 & 鮮度 ━━━━━ */}
        {hubTab === 'history' && (
          <div className="space-y-8 animate-in">
            {/* 変更履歴 */}
            <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <History className="text-pink-600 w-5 h-5" />
                <h2 className="text-sm font-extrabold text-stone-900">📜 辞典 ＆ ナレッジ全変更履歴 Diff & ワンタップ巻き戻し</h2>
              </div>
              <p className="text-xs text-stone-500 mb-4">
                過去にいつ・誰が（手動またはAI）・何を変更したかの全差分ログを閲覧し、必要に応じて以前の状態へ巻き戻せます。
              </p>
              <RevisionsPanel />
            </div>

            {/* 鮮度レビュー */}
            <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="text-emerald-600 w-5 h-5" />
                <h2 className="text-sm font-extrabold text-stone-900">🍃 ナレッジ鮮度レビュー & 定期点検</h2>
              </div>
              <p className="text-xs text-stone-500 mb-4">
                ナレッジデータの更新日時・鮮度を点検し、最新パッチとの適合率を確認できます。
              </p>
              <FreshnessPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DictHealthDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f7f5f0] flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600" />
      </div>
    }>
      <DictHealthDashboardContent />
    </Suspense>
  );
}

