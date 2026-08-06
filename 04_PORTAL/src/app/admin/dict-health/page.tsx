'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, Search, ShieldCheck, Sparkles, Filter, ExternalLink, Play, Layers, HelpCircle, History, FileCheck } from 'lucide-react';
import { getChampIcon } from '../../../lib/ddragonClient';
import Collapsible from '../../../components/Collapsible';
import DictFactCheckPanel from '../knowledge/DictFactCheckPanel';
import RevisionsPanel from '../knowledge/RevisionsPanel';
import DictReviewPanel from '../knowledge/DictReviewPanel';

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

export default function DictHealthDashboard() {
  const [data, setData] = useState<{
    currentPatch: string;
    totalCount: number;
    summary: { verified: number; aiGenerated: number; stale: number };
    priorityChampions?: ChampHealth[];
    champions: ChampHealth[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [hubTab, setHubTab] = useState<'health' | 'factcheck' | 'revisions' | 'auto_update'>('health');
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
      }
    } catch {
      showMessage('通信エラーが発生しました', 'error');
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
            {/* 使い方ガイド (折りたたみ可能) */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-8 shadow-sm">
          <Collapsible
            defaultOpen={false}
            title={
              <div className="flex items-center gap-2 text-stone-800">
                <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="text-xs font-black">📖 辞典ヘルス診断の使い方ガイド（ここをクリックで開閉）</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full ml-auto">
                  ヘルプ
                </span>
              </div>
            }
          >
            <div className="pt-3 border-t border-stone-100 text-xs text-stone-700 space-y-3 leading-relaxed">
              <p className="font-semibold text-stone-800">
                このページは、チャンピオン辞典（全170+体）の情報が「最新かつ信頼できる状態か」を一目で監視・メンテするための管理画面です。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
                    🟢 確認済み (Verified)
                  </div>
                  <p className="text-[11px] text-emerald-800/80 leading-normal">
                    管理者が内容を確認・手動保存した高品質データ。手動保存すると自動でこの状態になります。
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                  <div className="font-bold text-amber-900 mb-1 flex items-center gap-1">
                    🟡 AI生成 (AI Updated)
                  </div>
                  <p className="text-[11px] text-amber-800/80 leading-normal">
                    現行パッチでAIが自動収集・更新したデータ。内容は最新ですが人間による確認が未完了の状態です。
                  </p>
                </div>

                <div className="bg-red-50 border border-red-200 p-3 rounded-xl">
                  <div className="font-bold text-red-900 mb-1 flex items-center gap-1">
                    🔴 要対応 (Stale / Outdated)
                  </div>
                  <p className="text-[11px] text-red-800/80 leading-normal">
                    パッチが古い、またはデータが空の状態。「🔴 一括自動更新」ボタンでAIが自動的に最新化します。
                  </p>
                </div>
              </div>

              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-[11px] space-y-1.5">
                <div className="font-bold text-stone-800">💡 おすすめのメンテナンス手順：</div>
                <ul className="list-disc list-inside space-y-1 text-stone-600">
                  <li><strong>手順1:</strong> パッチ更新後は「🔴 要対応の全チャンピオンを一括自動更新」を押してAIに一括最新化させます。</li>
                  <li><strong>手順2:</strong> 画面中央の「🔥 今パッチ最優先確認チャンピオン (Top 10)」から主要チャンピオンの内容をチェックし「✅ 確認完了」を押します。</li>
                  <li><strong>手順3:</strong> 個別に内容を編集したい場合はカード右下の外部リンクアイコンから辞典本文へ移動して直接編集・保存できます。</li>
                </ul>
              </div>
            </div>
          </Collapsible>
        </div>
        {/* 🔰 初心者安心 1分でわかる使い方ガイド */}
        <div className="mb-6 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-300/80 rounded-2xl p-5 shadow-sm text-stone-900">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔰</span>
            <h2 className="text-base font-extrabold text-amber-900">1分でできる！おすすめメンテナンスの3ステップ</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-white/80 backdrop-blur p-3.5 rounded-xl border border-amber-200 shadow-xs">
              <span className="font-extrabold text-amber-800 block mb-1">ステップ1: パッチ自動照合 🔄</span>
              <p className="text-stone-600 leading-relaxed">右上の「パッチ自動照合」を押すと、Riot公式の最新パッチ(P16.15)とDBを比較し、古いデータを赤色(要対応)として検出します。</p>
            </div>
            <div className="bg-white/80 backdrop-blur p-3.5 rounded-xl border border-amber-200 shadow-xs">
              <span className="font-extrabold text-amber-800 block mb-1">ステップ2: 一括AI最新化 ⚡</span>
              <p className="text-stone-600 leading-relaxed">「古いデータのみ一括AI最新化」を押すと、赤色の古いチャンプだけを全自動で最新化します。</p>
            </div>
            <div className="bg-white/80 backdrop-blur p-3.5 rounded-xl border border-amber-200 shadow-xs">
              <span className="font-extrabold text-amber-800 block mb-1">ステップ3: 辞典で確認・完了 🎯</span>
              <p className="text-stone-600 leading-relaxed">気になるカードの「編集」をタップ。内容に問題がなければ「完了」を押せば緑色(確認済み)になります。</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-stone-200 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <Activity className="w-8 h-8 text-amber-600" />
              <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">
                辞典ヘルスダッシュボード
              </h1>
              <span className="bg-amber-100 text-amber-800 border border-amber-300 px-3 py-0.5 rounded-full text-xs font-bold">
                パッチ {data?.currentPatch || '16.15'}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1.5">
              全 {data?.totalCount || 0} チャンピオンのSSOTデータ健康度を一瞥し、最小限の操作で手動検証・パッチ自動更新を行えます
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => fetchHealth()}
              className="px-4 py-3 rounded-xl border border-amber-400 bg-amber-100 hover:bg-amber-200 text-amber-950 transition flex items-center gap-2 text-xs font-black shadow-sm"
              title="【ステップ1】Riot公式の最新パッチとデータベースを比較・照合します"
            >
              <RefreshCw className="w-4 h-4 text-amber-700" />
              ① 🔄 パッチ自動照合 (最新チェック)
            </button>

            <button
              onClick={handleBulkEnqueueStale}
              disabled={!!actionLoading}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-95 text-white text-xs font-black transition flex items-center gap-2 shadow-lg disabled:opacity-50"
              title="【ステップ2】データが古い・不足しているチャンピオンのみをAIで一括最新化します"
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
              ② ⚡ 古いデータ({data?.summary.stale || 0}件)を一括AI最新化
            </button>

            <button
              onClick={() => {
                const el = document.getElementById('fact-check-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-4 py-3 rounded-xl border border-cyan-400 bg-cyan-50 hover:bg-cyan-100 text-cyan-950 transition flex items-center gap-2 text-xs font-black shadow-sm"
              title="【ステップ3】全170+体のチャンピオンの誤記述・パッチ矛盾をAIが自動完走スキャンします"
            >
              <ShieldCheck className="w-4 h-4 text-cyan-700" />
              ③ 🛡️ 全チャンプAI誤り監査
            </button>

            <Link
              href="/champions"
              className="px-4 py-3 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md ml-auto"
            >
              <Layers className="w-4 h-4" />
              📚 チャンピオン辞典へ
            </Link>
          </div>
        </div>

        {/* 集計サマリーカード */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
                🟢 確認済み (Verified)
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
                🟡 AI生成 (AI Updated)
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
                🔴 要対応 (Stale / Outdated)
              </span>
              <span className="text-2xl font-black text-red-900">{data?.summary.stale || 0}</span>
            </div>
            <p className="text-[11px] text-red-700/80 mt-2">パッチ遅れ・データ未入力（要自動/手動更新）</p>
          </button>
        </div>

        {/* 今パッチ最優先確認チャンピオン Top 10 */}
        {data?.priorityChampions && data.priorityChampions.length > 0 && (
          <div className="bg-amber-950/10 border border-amber-500/30 rounded-2xl p-4 mb-8 bg-amber-50/50 shadow-sm">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                      <span className="font-bold text-stone-700">根拠・ステータス:</span> {champ.sourceSummary || '現行パッチ16.15データ統合済み'}
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
                <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                  <Link
                    href={`/champions?select=${encodeURIComponent(champ.champion)}`}
                    className="py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition text-center flex items-center justify-center gap-1 shadow-sm shrink-0"
                    title="このチャンピオンの辞典詳細を開き内容を確認・編集します"
                  >
                    ✏️ 辞典で直接編集
                  </Link>

                  {isVerified ? (
                    <button
                      onClick={() => handleVerify(champ.champion, 'unverify')}
                      disabled={actionLoading === champ.champion + '_unverify'}
                      className="flex-1 py-1.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[11px] font-bold transition text-center disabled:opacity-50"
                    >
                      ↩️ 未確認に戻す
                    </button>
                  ) : (
                    <button
                      onClick={() => handleVerify(champ.champion, 'verify')}
                      disabled={actionLoading === champ.champion + '_verify'}
                      className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition text-center flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      ✅ 人間チェック完了
                    </button>
                  )}

                  <button
                    onClick={() => handleVerify(champ.champion, 'enqueue_update')}
                    disabled={actionLoading === champ.champion + '_enqueue_update'}
                    title="このチャンピオンのSSOTデータをAIで単体再生成・最新化します"
                    className="py-1.5 px-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 shadow-xs disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${actionLoading === champ.champion + '_enqueue_update' ? 'animate-spin' : ''}`} />
                    ⚡ AI再生成
                  </button>
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

        {/* 統合パネル1: 🕵️‍♂️ AIファクトチェック＆不正確表現の誤り自動検知 */}
        <div id="fact-check-section" className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm scroll-mt-6">
          <Collapsible
            defaultOpen={false}
            title={
              <div className="flex items-center gap-2 text-stone-900">
                <FileCheck className="text-cyan-600 w-5 h-5" />
                <span className="text-sm font-extrabold">🕵️‍♂️ AIファクトチェック & 誤記述の自動検知キュー</span>
              </div>
            }
          >
            <div className="pt-4 border-t border-stone-100 mt-3">
              <p className="text-xs text-stone-500 mb-4">
                全170+体のチャンピオン辞典から、パッチ数値の相違や古い記述・誤った解説をAIがスキャンしキューとして表示します。
              </p>
              <DictFactCheckPanel />
            </div>
          </Collapsible>
        </div>

        {/* 統合パネル2: 📜 変更リビジョン履歴＆ワンタップ復元 */}
        <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm">
          <Collapsible
            defaultOpen={false}
            title={
              <div className="flex items-center gap-2 text-stone-900">
                <History className="text-pink-600 w-5 h-5" />
                <span className="text-sm font-extrabold">📜 変更履歴 Diff & 0秒ワンタップ巻き戻し</span>
              </div>
            }
          >
            <div className="pt-4 border-t border-stone-100 mt-3">
              <p className="text-xs text-stone-500 mb-4">
                過去にいつ・誰が（手動またはAI）・何を変更したかの全差分ログを閲覧し、必要に応じて以前の状態へ巻き戻せます。
              </p>
              <RevisionsPanel />
            </div>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
