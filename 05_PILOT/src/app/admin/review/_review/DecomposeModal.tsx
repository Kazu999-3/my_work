'use client';

import React, { useState } from 'react';
import { Scissors, CheckCircle2, AlertTriangle, RefreshCw, X, Shield, BookOpen, Compass, Tag } from 'lucide-react';
import { getChampIcon } from '@/lib/ddragonClient';
import { LANE_OPTIONS, type LaneKey } from './types';
import type { DecomposedInsight } from '@/lib/knowledgeDecompose';

interface DecomposeModalProps {
  parentTitle: string;
  parentId: number;
  sourceUrl?: string | null;
  loading: boolean;
  insights: DecomposedInsight[];
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onSave: (selectedInsights: DecomposedInsight[]) => void;
  onRetry: () => void;
}

export default function DecomposeModal({
  parentTitle,
  parentId,
  sourceUrl,
  loading,
  insights: initialInsights,
  error,
  busy,
  onClose,
  onSave,
  onRetry,
}: DecomposeModalProps) {
  const [items, setItems] = useState<DecomposedInsight[]>(initialInsights);

  // 初期インサイトが親から渡されたときに更新
  React.useEffect(() => {
    setItems(initialInsights);
  }, [initialInsights]);

  const toggleSelect = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const toggleAll = (select: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const updateItem = (index: number, patch: Partial<DecomposedInsight>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  };

  const selectedCount = items.filter((i) => i.selected).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-[#141418] border border-zinc-700/80 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* ヘッダー */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <span>✂️ 複数チャンピオンへのナレッジ分解プレビュー</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono">
                  ID: {parentId}
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400 truncate max-w-xl">
                元記事: {parentTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-sm font-bold p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* コンテンツエリア */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs flex items-start gap-2 shadow-sm">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
              <button
                onClick={onRetry}
                className="px-2 py-1 rounded bg-rose-800 hover:bg-rose-700 text-white text-[11px] font-bold"
              >
                再試行
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
              <div className="text-sm font-bold text-zinc-200">
                Gemini AI が記事を精査し、チャンピオン別の知見へ分解中...
              </div>
              <p className="text-xs text-zinc-500">
                各チャンピオンのパッチ調整、スキル運用、立ち回り、アイテムビルドを抽出しています
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-zinc-400">
              分解可能な知見が見つかりませんでした。
            </div>
          ) : (
            <div className="space-y-4">
              {/* 操作バー */}
              <div className="flex items-center justify-between p-2.5 bg-zinc-950/60 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-zinc-300">
                    抽出された知見: <span className="text-amber-400">{items.length}件</span>（選択中: {selectedCount}件）
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      onClick={() => toggleAll(true)}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                    >
                      すべて選択
                    </button>
                    <button
                      onClick={() => toggleAll(false)}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 cursor-pointer"
                    >
                      全解除
                    </button>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500">
                  ※ 保存すると未承認知見（分割知見）として登録され、個別プレビュー・承認が可能になります
                </span>
              </div>

              {/* カード一覧 */}
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border transition space-y-2.5 ${
                      item.selected
                        ? 'bg-zinc-950/80 border-amber-500/40'
                        : 'bg-zinc-950/30 border-zinc-800/80 opacity-60'
                    }`}
                  >
                    {/* カード上部 */}
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleSelect(idx)}
                        className="mt-1 accent-amber-500 shrink-0 cursor-pointer"
                      />

                      {/* チャンピオンアイコン */}
                      {item.champion && item.champion !== 'Unknown' ? (
                        <img
                          src={getChampIcon(item.champion)}
                          alt={item.champion}
                          className="w-10 h-10 rounded-xl object-cover border border-amber-500/40 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0 font-bold text-xs">
                          <Compass className="w-5 h-5 text-emerald-400" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-zinc-100 text-xs">
                            {item.championNameJa || (item.champion !== 'Unknown' ? item.champion : '一般・マクロ')}
                          </span>
                          {item.champion !== 'Unknown' && (
                            <span className="text-[10px] text-zinc-500 font-mono">({item.champion})</span>
                          )}
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                            item.scope === 'champion_specific'
                              ? 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                              : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          }`}>
                            {item.scope === 'champion_specific' ? 'チャンピオン個別' : 'レーン/メタ全般'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                            {item.laneLabel || item.lane}
                          </span>
                        </div>

                        {/* タイトル入力欄 */}
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => updateItem(idx, { title: e.target.value })}
                          className="w-full px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-bold text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* レーン設定 ＆ タグ */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1 border-t border-zinc-800/60">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 text-[10px] font-bold">推奨レーン:</span>
                        <select
                          value={item.lane}
                          onChange={(e) => updateItem(idx, { lane: e.target.value as LaneKey })}
                          className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 text-[11px] focus:outline-none"
                        >
                          {LANE_OPTIONS.map((l) => (
                            <option key={l.key} value={l.key}>{l.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                        <Tag className="w-3 h-3 text-zinc-500" />
                        <span>{item.tags.join(', ')}</span>
                      </div>
                    </div>

                    {/* 本文プレビュー / 編集 */}
                    <textarea
                      value={item.content}
                      onChange={(e) => updateItem(idx, { content: e.target.value })}
                      rows={4}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-zinc-300 text-[11px] leading-relaxed font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* フッター操作バー */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition cursor-pointer"
          >
            キャンセル
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSave(items.filter((i) => i.selected))}
              disabled={busy || loading || selectedCount === 0}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              {busy ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>保存中...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>選択した {selectedCount} 件の分割知見を登録する</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
