"use client";

import { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, Zap, AlertTriangle, CheckCircle2, ChevronRight, Filter, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type HealthStatusFilter = 'ALL' | 'stale' | 'ai_generated' | 'verified';

interface DictHealthData {
  currentPatch: string;
  totalCount: number;
  summary: {
    verified: number;
    aiGenerated: number;
    stale: number;
  };
  champions: Array<{
    champion: string;
    status: 'verified' | 'ai_generated' | 'stale';
    patch?: string;
  }>;
}

export default function DictHealthSummaryBar({
  activeStatusFilter,
  onFilterChange,
  onOpenFullHealth,
}: {
  activeStatusFilter: HealthStatusFilter;
  onFilterChange: (status: HealthStatusFilter) => void;
  onOpenFullHealth?: () => void;
}) {
  const [data, setData] = useState<DictHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchHealth = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/admin/dict-health', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // エラー時は非表示で静かに失敗
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleCleanseTerms = async () => {
    if (!confirm('全チャンピオンの辞典データ・攻略記事をスキャンし、残存する英語のアイテム名・ルーン名・スキル名を公式日本語名に一括正規化しますか？')) {
      return;
    }

    setActionLoading('cleanse');
    try {
      const res = await fetch('/api/admin/champions/cleanse-terms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      const json = await res.json();
      if (res.ok) {
        const total = json.summary?.totalUpdates ?? 0;
        showMsg(
          total > 0
            ? `✨ ${total}件の英語・略称用語（辞典${json.summary.factsUpdated}件/対面${json.summary.matchupsUpdated}件/知見${json.summary.knowledgeUpdated}件）を公式日本語名に正規化しました！`
            : '✅ すでに全ての用語が公式日本語名に正規化されています。',
          'success'
        );
      } else {
        showMsg(json.error || '用語正規化に失敗しました', 'error');
      }
    } catch {
      showMsg('通信エラーが発生しました', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkEnqueueStale = async () => {
    if (!data) return;
    const staleChamps = data.champions.filter((c) => c.status === 'stale').map((c) => c.champion);
    if (staleChamps.length === 0) {
      showMsg('要対応のチャンピオンはありません', 'success');
      return;
    }
    if (!confirm(`🔴 パッチ遅れ（要対応）の ${staleChamps.length} 体を一括更新タスクに積みますか？`)) return;

    setActionLoading('bulk');
    try {
      const res = await fetch('/api/admin/dict-health/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_enqueue_stale', champions: staleChamps }),
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(json.message || '一括更新タスクに登録しました！', 'success');
        fetchHealth(true);
      } else {
        showMsg(json.error || '一括処理に失敗しました', 'error');
      }
    } catch {
      showMsg('通信エラーが発生しました', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="w-full bg-surface/60 border border-border/80 rounded-2xl p-3 flex items-center justify-between text-xs text-faint animate-pulse">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="animate-spin text-primary-600" />
          <span>辞典の健全性を照合中...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const total = data.totalCount || 173;
  const verified = data.summary?.verified || 0;
  const aiGen = data.summary?.aiGenerated || 0;
  const stale = data.summary?.stale || 0;
  const verifiedPercent = Math.round((verified / total) * 100);
  const upToDatePercent = Math.round(((verified + aiGen) / total) * 100);

  return (
    <div className="w-full bg-surface border border-border/90 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3 transition-all">
      {/* 通知トースト */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              message.type === 'success' ? 'bg-success-50 text-success-800 border-emerald-300' : 'bg-danger-50 text-danger-800 border-rose-300'
            }`}
          >
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* 左側: 全体健康度ステータス ＆ パッチ情報 */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 rounded-xl border border-amber-200 text-primary-700 shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-foreground">辞典ヘルス ＆ パッチ整合度</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-subtle text-foreground-subtle border border-border">
                基準パッチ: {data.currentPatch || '最新'}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-success-50 border border-emerald-300 text-success-800">
                適用率 {upToDatePercent}%
              </span>
            </div>
            <p className="text-[11px] text-muted-strong mt-0.5">
              全 {total} 体中、{verified} 体が実戦確定、{stale} 体がパッチ更新待ち
            </p>
          </div>
        </div>

        {/* 右側: 一括アクション ＆ 詳細リンク */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleCleanseTerms}
            disabled={actionLoading === 'cleanse'}
            className="px-3 py-1.5 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 border border-amber-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="残存する英語のアイテム名・ルーン名・スキル名を公式日本語名に一括正規化"
          >
            {actionLoading === 'cleanse' ? <RefreshCw size={13} className="animate-spin text-primary-600" /> : <Wand2 size={13} className="text-primary-600" />}
            <span>🧹 用語正規化</span>
          </button>

          {stale > 0 ? (
            <button
              type="button"
              onClick={handleBulkEnqueueStale}
              disabled={actionLoading === 'bulk'}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-stone-950 font-black text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="要対応の全チャンピオンを一括で最新化キューへ登録"
            >
              {actionLoading === 'bulk' ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
              <span>⚡ パッチ遅れ ({stale}体) を一括最新化</span>
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-success-50 text-success-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              <span>全チャンピオン最新パッチ対応済</span>
            </span>
          )}

          {onOpenFullHealth && (
            <button
              type="button"
              onClick={onOpenFullHealth}
              className="px-2.5 py-1.5 rounded-xl bg-surface-subtle hover:bg-surface-hover/80 text-foreground-subtle text-xs font-bold transition border border-border flex items-center gap-1 cursor-pointer"
              title="監査ログ・ファクトチェック・変更履歴を開く"
            >
              <span>詳細点検</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 下段: ステータス別のクイック絞り込みピル */}
      <div className="pt-2 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-faint mr-1 flex items-center gap-1">
            <Filter size={11} /> 状態絞り込み:
          </span>

          <button
            type="button"
            onClick={() => onFilterChange('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
              activeStatusFilter === 'ALL'
                ? 'bg-stone-900 border-stone-900 text-white shadow-xs'
                : 'bg-background border-border text-muted hover:bg-surface-subtle'
            }`}
          >
            すべて ({total})
          </button>

          <button
            type="button"
            onClick={() => onFilterChange('stale')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border flex items-center gap-1 ${
              activeStatusFilter === 'stale'
                ? 'bg-danger-600 border-rose-600 text-white shadow-xs'
                : 'bg-danger-50 border-rose-200 text-danger-700 hover:bg-danger-100'
            }`}
          >
            <span>🔴 パッチ遅れ ({stale})</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterChange('ai_generated')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border flex items-center gap-1 ${
              activeStatusFilter === 'ai_generated'
                ? 'bg-primary-600 border-amber-600 text-white shadow-xs'
                : 'bg-primary-50 border-amber-200 text-primary-800 hover:bg-primary-100'
            }`}
          >
            <span>🟡 AI生成・要確認 ({aiGen})</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterChange('verified')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border flex items-center gap-1 ${
              activeStatusFilter === 'verified'
                ? 'bg-success-600 border-emerald-600 text-white shadow-xs'
                : 'bg-success-50 border-emerald-200 text-success-800 hover:bg-success-100'
            }`}
          >
            <span>🟢 実戦確定 ({verified})</span>
          </button>
        </div>

        {/* ミニ進行度プログレスバー */}
        <div className="flex items-center gap-2">
          <div className="w-24 sm:w-32 h-2 rounded-full bg-surface-subtle border border-border overflow-hidden flex">
            <div style={{ width: `${verifiedPercent}%` }} className="bg-success-500 h-full" title={`実戦確定: ${verified}体`} />
            <div style={{ width: `${Math.max(0, upToDatePercent - verifiedPercent)}%` }} className="bg-primary-400 h-full" title={`AI生成: ${aiGen}体`} />
            <div style={{ width: `${Math.max(0, 100 - upToDatePercent)}%` }} className="bg-danger-500 h-full" title={`パッチ遅れ: ${stale}体`} />
          </div>
          <span className="text-[10px] font-mono font-bold text-muted-strong">{verified}/{total}</span>
        </div>
      </div>
    </div>
  );
}
