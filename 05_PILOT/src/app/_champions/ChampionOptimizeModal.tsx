'use client';

import React, { useState } from 'react';
import { Sparkles, Check, AlertCircle, RefreshCw, X, ArrowRight, Eye, ShieldCheck } from 'lucide-react';

interface ChampionOptimizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  championId: string;
  championName: string;
  currentStrategy: string;
  onSuccess: (newStrategy: string) => void;
}

export default function ChampionOptimizeModal({
  isOpen,
  onClose,
  championId,
  championName,
  currentStrategy,
  onSuccess,
}: ChampionOptimizeModalProps) {
  const [loading, setLoading] = useState(false);
  const [optimizedText, setOptimizedText] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGeneratePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/champions/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', championId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '最適化プレビューの生成に失敗しました');
      }
      setOptimizedText(data.optimizedStrategy);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!optimizedText) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch('/api/champions/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', championId, optimizedStrategy: optimizedText }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '反映に失敗しました');
      }
      onSuccess(optimizedText);
      onClose();
    } catch (err: any) {
      setError(err.message || '反映に失敗しました');
    } finally {
      setApplying(false);
    }
  };

  const currentLength = currentStrategy.length;
  const optimizedLength = optimizedText ? optimizedText.length : null;
  const reductionPercent = optimizedLength ? Math.round(((currentLength - optimizedLength) / currentLength) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Sparkles size={20} className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-400 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800/60">
                  AI教本コンパイル
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  {currentLength.toLocaleString()} 文字
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-zinc-100 mt-0.5">
                【{championName}】教本マスターの完全最適化・圧縮
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!optimizedText && !loading && (
            <div className="py-8 text-center space-y-4">
              <div className="p-4 max-w-lg mx-auto rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2 text-zinc-300 text-left">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <ShieldCheck size={16} />
                  <span>AI最適化（何が行われるか？）</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-400">
                  <li>末尾に蓄積された多数の動画記事から核心知見（Why & When）を抽出</li>
                  <li>前半の体系的章立て（スキル・序盤・集団戦・NG行動）へ自然に統合</li>
                  <li>重複した解説をスマートに1本化し、末尾を「動画リンク付き目次」に整理</li>
                  <li>原本はバックアップ済みのため安全。プレビュー確認後に本番反映できます</li>
                </ul>
              </div>

              <button
                onClick={handleGeneratePreview}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black shadow-lg shadow-amber-500/20 transition flex items-center gap-2 mx-auto cursor-pointer"
              >
                <Sparkles size={16} />
                <span>AI最適化プレビューを生成する</span>
              </button>
            </div>
          )}

          {loading && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw size={28} className="animate-spin text-amber-400 mx-auto" />
              <p className="text-zinc-300 font-bold">全記事を読み込み、教本を再構築中...</p>
              <p className="text-xs text-zinc-500">Geminiが文章の重複を排除し、完全版バイブルを生成しています（約20〜30秒）</p>
            </div>
          )}

          {optimizedText && (
            <div className="space-y-4">
              {/* 比較バー */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400 line-through">
                    変更前: {currentLength.toLocaleString()}文字
                  </span>
                  <ArrowRight size={14} className="text-amber-400" />
                  <span className="text-emerald-400 font-bold">
                    最適化後: {optimizedLength?.toLocaleString()}文字
                  </span>
                </div>
                {reductionPercent !== null && (
                  <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    約 {reductionPercent}% 圧縮・洗練完了
                  </span>
                )}
              </div>

              {/* プレビュー表示 */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                {optimizedText}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          >
            閉じる
          </button>

          {optimizedText && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleGeneratePreview}
                disabled={loading || applying}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
              >
                再生成
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                {applying ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{applying ? '反映中...' : 'この最適化版を教本に反映する'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
