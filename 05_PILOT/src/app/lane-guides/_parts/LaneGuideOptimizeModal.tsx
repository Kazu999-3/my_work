'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, X, CheckCircle2, ArrowRight, Eye, Edit3, Compass, Check } from 'lucide-react';

interface LaneGuideOptimizeModalProps {
  lane: string;
  laneLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LaneGuideOptimizeModal({
  lane,
  laneLabel,
  isOpen,
  onClose,
  onSuccess,
}: LaneGuideOptimizeModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentBody, setCurrentBody] = useState('');
  const [optimizedBody, setOptimizedBody] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'diff' | 'raw'>('preview');
  const [error, setError] = useState<string | null>(null);

  // モーダルオープン時にAI最適化プレビューを取得
  useEffect(() => {
    if (!isOpen || !lane) return;
    setLoading(true);
    setError(null);

    fetch('/api/lane-guides/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preview', lane }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) throw new Error(data.error || '最適化プレビューの取得に失敗しました');
        setCurrentBody(data.currentBody || '');
        setOptimizedBody(data.optimizedBody || '');
      })
      .catch((e) => setError(e.message || 'エラーが発生しました'))
      .finally(() => setLoading(false));
  }, [isOpen, lane]);

  const handleApply = async () => {
    if (!optimizedBody.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/lane-guides/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', lane, optimizedBody }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '更新に失敗しました');

      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || '保存エラー');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#141418] border border-amber-500/40 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-zinc-100">
                  {laneLabel} ガイド全体のAI最適化・再構築
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  {lane}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                第8章の蓄積知見を第1〜7章へ自然に統合・重複を整理し、洗練された完全版バイブルを生成します
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* タブセレクター */}
        <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'preview'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Eye size={13} /> プレビュー
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'raw'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Edit3 size={13} /> 最適化文面を手動編集
            </button>
            <button
              onClick={() => setActiveTab('diff')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'diff'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Compass size={13} /> 変更前と比較
            </button>
          </div>

          <div className="text-[11px] text-zinc-400">
            {optimizedBody.length > 0 && (
              <span>文字数: <strong className="text-zinc-200">{optimizedBody.length}</strong> 字</span>
            )}
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="m-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* メインエリア */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 text-xs">
          {loading ? (
            <div className="py-28 flex flex-col items-center justify-center gap-3 text-amber-400">
              <RefreshCw size={24} className="animate-spin" />
              <div className="text-center space-y-1">
                <span className="text-sm font-bold block">Gemini が全章の知見を統合・再構築中...</span>
                <span className="text-xs text-zinc-500 block">重複の排除・各章への配置・Markdown整形を行っています（約10〜15秒）</span>
              </div>
            </div>
          ) : (
            <>
              {/* 1. プレビュー表示 */}
              {activeTab === 'preview' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                    <Sparkles size={14} className="shrink-0" />
                    <span>最適化後の完全版ガイドです。内容に問題がなければ画面下の「この内容でガイドを更新」を押してください。</span>
                  </div>
                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800 font-sans leading-relaxed text-zinc-200 whitespace-pre-wrap select-text">
                    {optimizedBody}
                  </div>
                </div>
              )}

              {/* 2. 手動編集エディタ */}
              {activeTab === 'raw' && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-zinc-400">
                    最適化後の本文を直接加筆・修正できます（Markdown形式）:
                  </span>
                  <textarea
                    value={optimizedBody}
                    onChange={(e) => setOptimizedBody(e.target.value)}
                    rows={20}
                    className="w-full p-4 bg-zinc-950 rounded-2xl border border-zinc-800 text-zinc-100 font-mono text-xs leading-relaxed focus:border-amber-500 focus:outline-none resize-y"
                  />
                </div>
              )}

              {/* 3. 変更前との比較 */}
              {activeTab === 'diff' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-zinc-400">最適化前（現在）:</span>
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 text-zinc-400 max-h-[60vh] overflow-y-auto whitespace-pre-wrap font-sans text-[11px] leading-relaxed">
                      {currentBody}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-emerald-400">最適化後（AI再構築）:</span>
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-emerald-900/50 text-zinc-200 max-h-[60vh] overflow-y-auto whitespace-pre-wrap font-sans text-[11px] leading-relaxed">
                      {optimizedBody}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer transition"
          >
            キャンセル
          </button>
          <button
            onClick={handleApply}
            disabled={loading || saving || !optimizedBody.trim()}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow-md"
          >
            {saving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>保存中...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>この内容でガイドを更新（最適化反映）</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
