"use client";

import { useState } from 'react';
import { CheckCircle2, RefreshCw, X, BookOpen, Map, Swords, Sparkles, ShieldAlert, ChevronDown, ChevronUp, Zap, Target, Layers, Plus } from 'lucide-react';
import { getChampIcon } from '../../../lib/ddragonClient';
import ChampSelect from '../../../components/ChampSelect';

export type MergePreviewItem = {
  champion: string;
  fieldName: string;
  isNewField: boolean;
  existingExcerpt: string;
  mergedExcerpt: string;
};

export type TrendFieldUpdate = {
  fieldKey: string;
  fieldLabel: string;
  existingValue: string;
  extractedValue: string;
  mergedValue: string;
  isNew: boolean;
};

export type ChampionTrendAnalysis = {
  champion: string;
  summaryPoints: string[];
  fieldUpdates: TrendFieldUpdate[];
  availableRoles?: string[];
  detectedRole?: string;
};

export type MatchupInsight = {
  targetChampion: string;
  enemyChampion: string;
  title: string;
  strategy: string;
  confidence?: 'high' | 'medium';
};

export type LaneGeneralInsight = { title: string; summary: string };

export type ChampionSpecificInsight = {
  champion: string;
  title: string;
  summary: string;
};

const LANE_LABELS: Record<string, string> = {
  COMMON: '全レーン共通（上達の原則）',
  TOP: 'TOP（トップ）',
  JG: 'JG（ジャングル）',
  MID: 'MID（ミッド）',
  ADC: 'ADC（ボット）',
  SUP: 'SUP（サポート）',
};

const FIELD_ICONS: Record<string, any> = {
  strengths: Sparkles,
  weaknesses: ShieldAlert,
  power_spikes: Zap,
  build_runes: Layers,
  strategy: Target,
  must_ban_champions: ShieldAlert,
  pick_recommendation: BookOpen,
};

export default function LibraryMergePreviewModal({
  previews,
  trendAnalyses = [],
  matchupInsights = [],
  laneGeneralInsights = [],
  detectedLane = 'COMMON',
  currentChampions = [],
  saving,
  reAnalyzing = false,
  continuousReview,
  onReAnalyze,
  onConfirm,
  onCancel,
}: {
  previews: MergePreviewItem[];
  trendAnalyses?: ChampionTrendAnalysis[];
  matchupInsights?: MatchupInsight[];
  laneGeneralInsights?: LaneGeneralInsight[];
  detectedLane?: string;
  currentChampions?: string[];
  saving: boolean;
  reAnalyzing?: boolean;
  continuousReview?: {
    currentIndex: number;
    totalCount: number;
    onSkipNext: () => void;
    onConfirmAndNext: (options: {
      sendToLane: string | null;
      approvedMatchups: MatchupInsight[];
      approvedLaneGeneralInsights: LaneGeneralInsight[];
      championSpecificInsights: ChampionSpecificInsight[];
      trendDataOverrides?: Record<string, Record<string, string>>;
      championRoles?: Record<string, string>;
      finalChampions?: string[];
    }) => void;
  };
  onReAnalyze?: (newChampions: string[]) => void;
  onConfirm: (options: {
    sendToLane: string | null;
    approvedMatchups: MatchupInsight[];
    approvedLaneGeneralInsights: LaneGeneralInsight[];
    championSpecificInsights: ChampionSpecificInsight[];
    trendDataOverrides?: Record<string, Record<string, string>>;
    championRoles?: Record<string, string>;
    finalChampions?: string[];
  }) => void;
  onCancel: () => void;
}) {
  const hasTrendAnalyses = trendAnalyses.length > 0;
  const hasMatchups = matchupInsights.length > 0;
  const hasLaneGeneral = laneGeneralInsights.length > 0;

  // 選択された対面メモ（デフォルトは全てON）
  const [selectedMatchupIndices, setSelectedMatchupIndices] = useState<number[]>(() =>
    matchupInsights.map((_, i) => i)
  );

  // 各チャンピオンの送り先レーン管理
  const [championRoles, setChampionRoles] = useState<Record<string, string>>(() => {
    const roles: Record<string, string> = {};
    for (const a of trendAnalyses) {
      roles[a.champion] = a.detectedRole || (a.availableRoles && a.availableRoles[0]) || 'GLOBAL';
    }
    return roles;
  });

  // レーン一般論アイテムの個別管理（選択ON/OFF、一般論 ↔ チャンピオン固有切り替え、紐付けチャンピオン）
  const [laneInsightItems, setLaneInsightItems] = useState<Array<{
    title: string;
    summary: string;
    included: boolean;
    scope: 'lane_general' | 'champion_specific';
    assignedChampion: string;
  }>>(() =>
    laneGeneralInsights.map((item) => ({
      title: item.title,
      summary: item.summary,
      included: true,
      scope: 'lane_general',
      assignedChampion: currentChampions[0] || '',
    }))
  );

  // チャンピオン追加用入力
  const [champInput, setChampInput] = useState('');

  // レーンガイド統合チェック
  const [sendToLaneChecked, setSendToLaneChecked] = useState(hasLaneGeneral);
  const [laneChoice, setLaneChoice] = useState(detectedLane || 'COMMON');

  // トレンド項目の展開状態管理
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});

  const toggleFieldExpand = (key: string) => {
    setExpandedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleMatchupSelect = (index: number) => {
    setSelectedMatchupIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  // レーン一般論の選択ON/OFF
  const toggleLaneInsightIncluded = (idx: number) => {
    setLaneInsightItems((prev) =>
      prev.map((item, n) => (n === idx ? { ...item, included: !item.included } : item))
    );
  };

  // レーン一般論 ↔ チャンピオン固有のスコープ切り替え
  const toggleLaneInsightScope = (idx: number) => {
    setLaneInsightItems((prev) =>
      prev.map((item, n) => {
        if (n !== idx) return item;
        const newScope = item.scope === 'lane_general' ? 'champion_specific' : 'lane_general';
        return {
          ...item,
          scope: newScope,
          assignedChampion: item.assignedChampion || currentChampions[0] || '',
        };
      })
    );
  };

  // チャンピオン固有項目の割当チャンピオン変更
  const handleAssignChampion = (idx: number, champ: string) => {
    setLaneInsightItems((prev) =>
      prev.map((item, n) => (n === idx ? { ...item, assignedChampion: champ } : item))
    );
  };

  const handleAddChampion = (champ: string) => {
    if (!champ || currentChampions.includes(champ)) return;
    const updated = [...currentChampions, champ];
    setChampInput('');
    if (onReAnalyze) {
      onReAnalyze(updated);
    }
  };

  const handleRemoveChampion = (champ: string) => {
    const updated = currentChampions.filter((c) => c !== champ);
    if (onReAnalyze) {
      onReAnalyze(updated);
    }
  };

  const handleConfirm = () => {
    const approvedMatchups = matchupInsights.filter((_, i) => selectedMatchupIndices.includes(i));

    // 承認されたレーン一般論
    const approvedLaneGeneralInsights = laneInsightItems
      .filter((i) => i.included && i.scope === 'lane_general')
      .map((i) => ({ title: i.title, summary: i.summary }));

    // チャンピオン固有として振り分けられた知見
    const championSpecificInsights: ChampionSpecificInsight[] = laneInsightItems
      .filter((i) => i.included && i.scope === 'champion_specific')
      .map((i) => ({
        champion: i.assignedChampion || currentChampions[0] || 'Unknown',
        title: i.title,
        summary: i.summary,
      }));

    // トレンドデータのオーバーライド（マージ後の値）
    const trendDataOverrides: Record<string, Record<string, string>> = {};
    for (const analysis of trendAnalyses) {
      trendDataOverrides[analysis.champion] = {};
      for (const field of analysis.fieldUpdates) {
        if (field.mergedValue) {
          trendDataOverrides[analysis.champion][field.fieldKey] = field.mergedValue;
        }
      }
    }

    onConfirm({
      sendToLane: sendToLaneChecked && (approvedLaneGeneralInsights.length > 0 || currentChampions.length === 0) ? laneChoice : null,
      approvedMatchups,
      approvedLaneGeneralInsights,
      championSpecificInsights,
      trendDataOverrides,
      championRoles,
      finalChampions: currentChampions,
    });
  };

  const handleConfirmAndNext = () => {
    if (!continuousReview) {
      handleConfirm();
      return;
    }
    const approvedMatchups = matchupInsights.filter((_, i) => selectedMatchupIndices.includes(i));
    const approvedLaneGeneralInsights = laneInsightItems
      .filter((i) => i.included && i.scope === 'lane_general')
      .map((i) => ({ title: i.title, summary: i.summary }));

    const championSpecificInsights: ChampionSpecificInsight[] = laneInsightItems
      .filter((i) => i.included && i.scope === 'champion_specific')
      .map((i) => ({
        champion: i.assignedChampion || currentChampions[0] || 'Unknown',
        title: i.title,
        summary: i.summary,
      }));

    const trendDataOverrides: Record<string, Record<string, string>> = {};
    for (const analysis of trendAnalyses) {
      trendDataOverrides[analysis.champion] = {};
      for (const field of analysis.fieldUpdates) {
        if (field.mergedValue) {
          trendDataOverrides[analysis.champion][field.fieldKey] = field.mergedValue;
        }
      }
    }

    continuousReview.onConfirmAndNext({
      sendToLane: sendToLaneChecked && (approvedLaneGeneralInsights.length > 0 || currentChampions.length === 0) ? laneChoice : null,
      approvedMatchups,
      approvedLaneGeneralInsights,
      championSpecificInsights,
      trendDataOverrides,
      championRoles,
      finalChampions: currentChampions,
    });
  };

  const laneGeneralCount = laneInsightItems.filter((i) => i.included && i.scope === 'lane_general').length;
  const champSpecificCount = laneInsightItems.filter((i) => i.included && i.scope === 'champion_specific').length;
  const canConfirm = currentChampions.length > 0 || (sendToLaneChecked && (laneGeneralCount > 0 || hasLaneGeneral)) || champSpecificCount > 0 || selectedMatchupIndices.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#fcfbf9] border border-stone-200 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
        {/* ヘッダー */}
        <div className="flex items-start sm:items-center justify-between border-b border-stone-200 pb-4 gap-4 flex-col sm:flex-row">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-xl font-black text-stone-900 flex items-center gap-2">
                <BookOpen size={22} className="text-amber-600" />
                <span>辞典統合 ＆ 戦略データ整理プレビュー</span>
              </h3>
              {continuousReview && (
                <span className="bg-amber-100 text-amber-800 border border-amber-300 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  ⚡ 連続レビュー中 (残り {Math.max(0, continuousReview.totalCount - continuousReview.currentIndex)} 件)
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              記事の内容をAIが整理し、チャンピオントレンド各項目・対面メモ・レーンガイドへ最適配分します。
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={saving || reAnalyzing}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-50 transition self-end sm:self-auto"
            title="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        {/* 対象チャンピオン編集バー (プレビュー内での追加・削除・再解析) */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
              🏆 統合対象のチャンピオン ({currentChampions.length}体)
            </span>
            {reAnalyzing && (
              <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1 animate-pulse">
                <RefreshCw size={12} className="animate-spin" /> AI解析を再実行中...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 選択中のチャンピオンタグ */}
            {currentChampions.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-stone-800 shadow-sm"
              >
                {getChampIcon(c) && (
                  <img
                    src={getChampIcon(c)}
                    alt={c}
                    className="w-4 h-4 rounded-md border border-amber-200"
                  />
                )}
                <span>{c}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveChampion(c)}
                  disabled={saving || reAnalyzing}
                  title={`${c} を除外`}
                  className="text-stone-400 hover:text-rose-600 ml-0.5 transition"
                >
                  <X size={13} />
                </button>
              </span>
            ))}

            {/* 新規チャンピオン追加用サジェスト */}
            <div className="w-44">
              <ChampSelect
                value={champInput}
                onChange={setChampInput}
                placeholder="＋チャンプ追加..."
                className="bg-white border-amber-300 focus:border-amber-500 py-1 text-xs"
                onSelect={(champ: string) => handleAddChampion(champ)}
              />
            </div>
          </div>
        </div>

        {/* 1. チャンピオントレンド構造化プレビュー */}
        {hasTrendAnalyses ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-600" />
              <h4 className="text-sm font-extrabold text-stone-900">
                1. チャンピオントレンド統合（構造化項目への整理）
              </h4>
            </div>

            {trendAnalyses.map((analysis) => (
              <div key={analysis.champion} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <div className="flex items-center justify-between w-full flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      {getChampIcon(analysis.champion) && (
                        <img
                          src={getChampIcon(analysis.champion)}
                          alt={analysis.champion}
                          className="w-8 h-8 rounded-lg border border-amber-300 shadow-sm"
                        />
                      )}
                      <div>
                        <span className="text-sm font-black text-stone-900">{analysis.champion}</span>
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md ml-2 font-bold">
                          トレンドデータ更新
                        </span>
                      </div>
                    </div>

                    {/* 送り先レーン選択ドロップダウン */}
                    <div className="flex items-center gap-1.5 bg-amber-50/80 border border-amber-300/80 px-2.5 py-1 rounded-xl">
                      <span className="text-[11px] font-black text-amber-900">🛡️ 送り先レーン:</span>
                      <select
                        value={championRoles[analysis.champion] || analysis.detectedRole || (analysis.availableRoles && analysis.availableRoles[0]) || 'GLOBAL'}
                        onChange={(e) => {
                          const newRole = e.target.value;
                          setChampionRoles((prev) => ({ ...prev, [analysis.champion]: newRole }));
                        }}
                        className="bg-white border border-amber-300 rounded-lg px-2 py-0.5 text-xs font-bold text-stone-900 outline-none"
                      >
                        {(analysis.availableRoles && analysis.availableRoles.length > 0 ? analysis.availableRoles : ['GLOBAL', 'TOP', 'JG', 'MID', 'BOT', 'SUP']).map((r) => (
                          <option key={r} value={r}>
                            {r === 'TOP' ? '⚔️ TOP' : r === 'JG' ? '🌲 JG' : r === 'MID' ? '⚡ MID' : r === 'BOT' ? '🏹 BOT' : r === 'SUP' ? '🛡️ SUP' : r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 整理された主要ポイント */}
                {analysis.summaryPoints && analysis.summaryPoints.length > 0 && (
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3">
                    <p className="text-[11px] font-black text-amber-900 mb-1.5 flex items-center gap-1">
                      <Sparkles size={13} className="text-amber-600" /> 記事から抽出・整理された要点:
                    </p>
                    <ul className="space-y-1">
                      {analysis.summaryPoints.map((pt, i) => (
                        <li key={i} className="text-xs text-stone-700 font-medium flex items-start gap-1.5">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 各フィールドの差分リスト */}
                <div className="space-y-2 pt-1">
                  {analysis.fieldUpdates
                    .filter((f) => f.extractedValue.trim().length > 0)
                    .map((field) => {
                      const IconComp = FIELD_ICONS[field.fieldKey] || BookOpen;
                      const expandKey = `${analysis.champion}_${field.fieldKey}`;
                      const isExpanded = expandedFields[expandKey];

                      return (
                        <div
                          key={field.fieldKey}
                          className="border border-stone-200 rounded-xl bg-stone-50/50 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleFieldExpand(expandKey)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-stone-100/60 transition"
                          >
                            <div className="flex items-center gap-2">
                              <IconComp size={15} className="text-amber-700" />
                              <span className="text-xs font-bold text-stone-800">{field.fieldLabel}</span>
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                  field.isNew
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : 'bg-blue-50 border-blue-200 text-blue-700'
                                }`}
                              >
                                {field.isNew ? '新規追加' : '追記/統合'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-stone-500 font-medium">
                              <span>{isExpanded ? '折りたたむ' : '差分を確認'}</span>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="p-3 pt-0 border-t border-stone-200 bg-white space-y-2 text-xs">
                              {!field.isNew && field.existingValue && (
                                <div>
                                  <p className="text-[10px] font-bold text-stone-400 mb-0.5">現在の内容:</p>
                                  <div className="bg-stone-50 border border-stone-200 rounded-lg p-2 text-stone-600 text-[11px] whitespace-pre-wrap max-h-24 overflow-y-auto">
                                    {field.existingValue}
                                  </div>
                                </div>
                              )}
                              <div>
                                <p className="text-[10px] font-bold text-amber-700 mb-0.5">統合後の内容（提案）:</p>
                                <div className="bg-amber-50/40 border border-amber-200 rounded-lg p-2.5 text-stone-800 text-[11px] whitespace-pre-wrap font-medium leading-relaxed">
                                  {field.mergedValue}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* フォールバック用プレビュー */
          <div className="space-y-3">
            {previews.map((p, idx) => (
              <div key={idx} className="border border-stone-200 rounded-2xl p-4 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">
                    🏆 {p.champion}
                  </span>
                  <span className="text-xs text-stone-500">項目: {p.fieldName}</span>
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-700 whitespace-pre-wrap">
                  {p.mergedExcerpt}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. 対チャンピオン（マッチアップ）情報 */}
        {hasMatchups && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Swords size={16} className="text-rose-600" />
                <h4 className="text-sm font-extrabold text-stone-900">
                  2. 検出された対チャンピオン（マッチアップ）対策 ({matchupInsights.length}件)
                </h4>
              </div>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                調査時に即表示可能
              </span>
            </div>
            <p className="text-xs text-stone-500">
              記事内に対特定チャンピオンへの立ち回り・対策が含まれています。保存すると、パーソナルコーチの試合前警告やマッチアップ検索時に自動表示されます。
            </p>

            <div className="space-y-2.5">
              {matchupInsights.map((m, idx) => {
                const isSelected = selectedMatchupIndices.includes(idx);
                return (
                  <div
                    key={idx}
                    className={`border rounded-2xl p-3.5 transition ${
                      isSelected
                        ? 'border-rose-300 bg-rose-50/40 shadow-sm'
                        : 'border-stone-200 bg-stone-50/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleMatchupSelect(idx)}
                            className="rounded border-rose-300 text-rose-600 focus:ring-rose-400"
                          />
                          <span className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                            🛡️ {m.targetChampion} vs {m.enemyChampion}
                          </span>
                        </label>
                        {getChampIcon(m.enemyChampion) && (
                          <img
                            src={getChampIcon(m.enemyChampion)}
                            alt={m.enemyChampion}
                            className="w-5 h-5 rounded-md border border-stone-200"
                          />
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-stone-500">{m.title}</span>
                    </div>

                    <div className="bg-white border border-rose-200/80 rounded-xl p-2.5 text-xs text-stone-800 leading-relaxed whitespace-pre-wrap">
                      {m.strategy}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. レーン一般論 ＆ チャンピオン固有への振り分け */}
        {laneInsightItems.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-t border-stone-200 pt-4 flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Map size={16} className="text-sky-600" />
                  <h4 className="text-sm font-extrabold text-stone-900">
                    3. 抽出された一般論・戦術知見 ({laneInsightItems.length}件)
                  </h4>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  各項目のチェックを外して除外したり、「チャンピオン固有」に切り替えて対象チャンプの辞典へ直接書き込むことができます。
                </p>
              </div>

              {laneGeneralCount > 0 && (
                <label className="flex items-center gap-1.5 text-xs font-bold text-sky-700 cursor-pointer bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl">
                  <input
                    type="checkbox"
                    checked={sendToLaneChecked}
                    onChange={(e) => setSendToLaneChecked(e.target.checked)}
                  />
                  <span>レーンガイドにも統合する ({laneGeneralCount}件)</span>
                </label>
              )}
            </div>

            {sendToLaneChecked && laneGeneralCount > 0 && (
              <div className="flex items-center gap-2 mb-2 bg-sky-50/50 p-2.5 rounded-xl border border-sky-100">
                <span className="text-xs font-bold text-sky-900">送り先レーン:</span>
                <select
                  value={laneChoice}
                  onChange={(e) => setLaneChoice(e.target.value)}
                  className="bg-white border border-sky-300 rounded-lg px-2.5 py-1 text-xs text-sky-800 outline-none font-medium"
                >
                  {Object.entries(LANE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2.5">
              {laneInsightItems.map((item, idx) => {
                const isLaneGeneral = item.scope === 'lane_general';
                return (
                  <div
                    key={idx}
                    className={`border rounded-2xl p-3.5 transition ${
                      !item.included
                        ? 'border-stone-200 bg-stone-50/50 opacity-40'
                        : isLaneGeneral
                        ? 'border-sky-200 bg-sky-50/30'
                        : 'border-amber-300 bg-amber-50/40 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.included}
                          onChange={() => toggleLaneInsightIncluded(idx)}
                          className="mt-0.5 rounded border-stone-300 text-sky-600 focus:ring-sky-400"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-stone-900 block leading-tight">
                            {item.title}
                          </span>
                        </div>
                      </label>

                      {/* スコープ切り替え＆チャンピオン選択 */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleLaneInsightScope(idx)}
                          disabled={!item.included}
                          title="クリックでレーン一般論 ⇄ チャンピオン固有を切り替え"
                          className={`text-[11px] font-black px-2.5 py-1 rounded-lg border transition disabled:opacity-40 flex items-center gap-1 ${
                            isLaneGeneral
                              ? 'bg-sky-100 border-sky-300 text-sky-800 hover:bg-sky-200'
                              : 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200'
                          }`}
                        >
                          {isLaneGeneral ? (
                            <>
                              <Map size={12} />
                              <span>🌊 レーン一般論</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} />
                              <span>🏆 チャンピオン固有</span>
                            </>
                          )}
                        </button>

                        {!isLaneGeneral && item.included && (
                          <div className="w-36">
                            <ChampSelect
                              value={item.assignedChampion}
                              onChange={(val) => handleAssignChampion(idx, val)}
                              placeholder="チャンプ選択..."
                              className="bg-white border-amber-300 py-0.5 text-xs h-7"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className={`rounded-xl p-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                        item.included ? 'bg-white text-stone-700 border border-stone-200/80' : 'text-stone-400'
                      }`}
                    >
                      {item.summary}
                    </div>

                    {item.included && !isLaneGeneral && item.assignedChampion && (
                      <p className="text-[10px] font-bold text-amber-700 mt-1.5 flex items-center gap-1">
                        🏆 「{item.assignedChampion}」のチャンピオン辞典（基本立ち回り・メモ）へ書き込まれます
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* フッターアクション */}
        <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-stone-200 flex-wrap">
          <div className="text-xs text-stone-500">
            {currentChampions.length === 0 ? (
              sendToLaneChecked ? (
                <span className="text-sky-800 font-bold flex items-center gap-1">
                  <Map size={14} className="text-sky-600" />
                  <span>送り先: <strong>{LANE_LABELS[laneChoice] || laneChoice} レーンガイド</strong></span>
                </span>
              ) : (
                <span className="text-rose-600 font-bold">⚠️ 統合対象のチャンピオンまたは送り先レーンを選択してください</span>
              )
            ) : (
              <span>対象: <strong className="text-stone-800">{currentChampions.join(', ')}</strong></span>
            )}
            {champSpecificCount > 0 && (
              <span className="ml-2 text-amber-700 font-bold">
                （固有知見 {champSpecificCount}件を追加統合）
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving || reAnalyzing}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-stone-500 hover:bg-stone-100 disabled:opacity-50 transition"
            >
              {continuousReview ? '中断して閉じる' : 'キャンセル'}
            </button>

            {continuousReview && (
              <button
                type="button"
                onClick={continuousReview.onSkipNext}
                disabled={saving || reAnalyzing}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1.5 disabled:opacity-50 transition"
                title="この記事は統合せず、次の未処理記事を表示します"
              >
                <span>⏭️ スキップして次へ</span>
              </button>
            )}

            {continuousReview ? (
              <button
                type="button"
                onClick={handleConfirmAndNext}
                disabled={saving || reAnalyzing || !canConfirm}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2 shadow-md shadow-amber-600/20 disabled:opacity-50 transition"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>{saving ? '統合処理中...' : '✨ 確定して次の記事へ'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving || reAnalyzing || !canConfirm}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2 shadow-sm disabled:opacity-50 transition"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>
                  {saving
                    ? '統合処理中...'
                    : currentChampions.length === 0
                      ? `レーン別ガイド (${LANE_LABELS[laneChoice] || laneChoice}) へ統合する`
                      : 'この内容で辞典・対面情報に統合する'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
