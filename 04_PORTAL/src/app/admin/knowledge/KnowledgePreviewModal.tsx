"use client";

import { useState } from 'react';
import { CheckCircle2, RefreshCw, X, BookOpen, Puzzle } from 'lucide-react';
import ChampSelect from '../../../components/ChampSelect';

export type AtomicInsightPreview = {
  title: string;
  summary: string;
  tags: string[];
  scope: 'champion_specific' | 'lane_general';
  targetLane?: string;
};

export type KnowledgePreview = {
  title: string;
  summary: string;
  rawContent: string;
  url: string;
  genre: string;
  tags: string[];
  champion: string;
  authorKey: string | null;
  atomicInsights: AtomicInsightPreview[];
};

const LANE_OPTIONS = [
  { key: 'TOP', label: '🗺️ TOP (トップ)' },
  { key: 'JG', label: '🗺️ JG (ジャングル)' },
  { key: 'MID', label: '🗺️ MID (ミッド)' },
  { key: 'ADC', label: '🗺️ ADC (ボット)' },
  { key: 'SUP', label: '🗺️ SUP (サポート)' },
  { key: 'COMMON', label: '🗺️ 全レーン共通' },
];

// 「記事のどこがチャンピオン辞典に保存されるかプレビュー画面を挟みたい」という要望への対応
// (2026-08-15)。AI解析結果(まだDB未保存)を表示し、チャンピオン判定や分割知見の取捨選択を
// 確認・修正してから初めて実際に保存する。
export default function KnowledgePreviewModal({
  preview, saving, onConfirm, onCancel,
}: {
  preview: KnowledgePreview;
  saving: boolean;
  onConfirm: (edited: KnowledgePreview) => void;
  onCancel: () => void;
}) {
  const [champion, setChampion] = useState(preview.champion);
  const [insights, setInsights] = useState(
    preview.atomicInsights.map((i) => ({ ...i, included: true, targetLane: i.targetLane || 'COMMON' }))
  );

  const toggleIncluded = (idx: number) => {
    setInsights((prev) => prev.map((i, n) => (n === idx ? { ...i, included: !i.included } : i)));
  };
  const toggleScope = (idx: number) => {
    setInsights((prev) => prev.map((i, n) => (n === idx
      ? { ...i, scope: i.scope === 'lane_general' ? 'champion_specific' : 'lane_general' }
      : i)));
  };
  const changeTargetLane = (idx: number, lane: string) => {
    setInsights((prev) => prev.map((i, n) => (n === idx ? { ...i, targetLane: lane } : i)));
  };

  const handleConfirm = () => {
    onConfirm({
      ...preview,
      champion,
      atomicInsights: insights.filter((i) => i.included).map(({ included, ...rest }) => rest),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BookOpen size={20} className="text-danger-500" /> 登録前プレビュー
          </h3>
          <button onClick={onCancel} disabled={saving} className="text-faint hover:text-foreground disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold text-faint mb-1">タイトル</p>
            <p className="text-sm font-bold text-foreground">{preview.title}</p>
          </div>

          <div className="bg-success-50 border border-emerald-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-success-700 mb-2">
              🏆 このチャンピオンの辞典生成に使われます（空欄＝どのチャンピオンにも紐付きません）
            </p>
            <ChampSelect value={champion} onChange={setChampion} placeholder="空欄＝紐付けなし" />
          </div>

          <div>
            <p className="text-xs font-bold text-faint mb-1">全文網羅ナレッジ（このまま保存されます）</p>
            <div className="bg-background border border-border rounded-xl p-3 max-h-40 overflow-y-auto text-xs text-foreground-subtle whitespace-pre-wrap leading-relaxed">
              {preview.summary}
            </div>
          </div>

          {insights.length > 0 && (
            <div>
              <p className="text-xs font-bold text-faint mb-2 flex items-center gap-1.5">
                <Puzzle size={13} /> 分割される独立した知見（{insights.filter((i) => i.included).length}/{insights.length}件を保存）
              </p>
              <div className="space-y-2">
                {insights.map((insight, idx) => (
                  <div key={idx} className={`border rounded-xl p-3 transition ${insight.included ? 'bg-surface border-border' : 'bg-background border-border opacity-50'}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5 flex-wrap sm:flex-nowrap">
                      <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={insight.included}
                          onChange={() => toggleIncluded(idx)}
                          className="mt-0.5 shrink-0"
                        />
                        <span className="text-xs font-bold text-foreground">{insight.title}</span>
                      </label>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleScope(idx)}
                          disabled={!insight.included}
                          className={`shrink-0 text-[10px] font-black px-2 py-1 rounded-lg border disabled:opacity-40 transition ${
                            insight.scope === 'lane_general'
                              ? 'bg-secondary-50 border-teal-200 text-secondary-700'
                              : 'bg-primary-50 border-amber-200 text-primary-700'
                          }`}
                          title="クリックで切り替え"
                        >
                          {insight.scope === 'lane_general' ? 'レーン一般論' : 'チャンピオン固有'}
                        </button>
                        {insight.scope === 'lane_general' && (
                          <div className="flex items-center gap-1 bg-secondary-100/70 border border-teal-300 rounded-lg px-2 py-0.5">
                            <span className="text-[10px] font-bold text-secondary-800">統合先:</span>
                            <select
                              value={insight.targetLane || 'COMMON'}
                              onChange={(e) => changeTargetLane(idx, e.target.value)}
                              disabled={!insight.included}
                              className="text-[10px] font-black bg-transparent text-secondary-950 outline-none cursor-pointer"
                            >
                              {LANE_OPTIONS.map((opt) => (
                                <option key={opt.key} value={opt.key}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-strong leading-relaxed pl-6">{insight.summary}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-faint mt-2">
                保存後も「未承認のナレッジ」タブで内容を再確認・承認するまで辞典生成やレーンガイド統合には使われません。
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-muted-strong hover:bg-surface-subtle disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-danger-500 hover:bg-danger-600 text-white flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {saving ? '保存中...' : 'この内容で保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}
