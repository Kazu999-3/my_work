"use client";

import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, RefreshCw, X, BookOpen, Map, Swords, Sparkles, ShieldAlert, ChevronDown, ChevronUp, Zap, Target, Layers, Plus, FileText, ExternalLink, Trash, Archive } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getChampIcon } from '../../../lib/ddragonClient';
import ChampSelect from '../../../components/ChampSelect';
import { detectChampionsFromText } from '../../../lib/championDetection';

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
  articleTitle = '',
  articleContent = '',
  sourceUrl = '',
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
  articleTitle?: string;
  articleContent?: string;
  sourceUrl?: string;
  saving: boolean;
  reAnalyzing?: boolean;
  continuousReview?: {
    currentIndex: number;
    totalCount: number;
    onSkipNext: () => void;
    onMoveToArchiveAndNext?: () => void;
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

  // レーンガイド統合チェック（チャンピオン未設定なら自動でON）
  const [sendToLaneChecked, setSendToLaneChecked] = useState(currentChampions.length === 0 || hasLaneGeneral);
  const [laneChoice, setLaneChoice] = useState(detectedLane || 'COMMON');

  // 連続レビュー時など、記事やpropsが切り替わったときに各stateを最新のpropsと同期する
  useEffect(() => {
    setSelectedMatchupIndices(matchupInsights.map((_, i) => i));

    const roles: Record<string, string> = {};
    for (const a of trendAnalyses) {
      roles[a.champion] = a.detectedRole || (a.availableRoles && a.availableRoles[0]) || 'GLOBAL';
    }
    setChampionRoles(roles);

    setLaneInsightItems(
      laneGeneralInsights.map((item) => ({
        title: item.title,
        summary: item.summary,
        included: true,
        scope: 'lane_general',
        assignedChampion: currentChampions[0] || '',
      }))
    );

    // チャンピオンが0件（マクロ記事）の場合は常にレーンガイド統合をONにする
    setSendToLaneChecked(currentChampions.length === 0 || laneGeneralInsights.length > 0);
    setLaneChoice(detectedLane || 'COMMON');
    setExpandedFields({});
  }, [laneGeneralInsights, matchupInsights, trendAnalyses, detectedLane, currentChampions]);

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

  const [showSourceArticle, setShowSourceArticle] = useState(false);

  // 本文・タイトルから登場するチャンピオン候補を検出（現在選択中以外のもの）
  const detectedSuggestions = useMemo(() => {
    return detectChampionsFromText(articleTitle, articleContent, currentChampions);
  }, [articleTitle, articleContent, currentChampions]);

  const handleClearAllChampions = () => {
    if (onReAnalyze) {
      onReAnalyze([]);
    }
  };

  const laneGeneralCount = laneInsightItems.filter((i) => i.included && i.scope === 'lane_general').length;
  const champSpecificCount = laneInsightItems.filter((i) => i.included && i.scope === 'champion_specific').length;
  // チャンピオンがいる場合、またはレーンガイド送り先が選択されている場合は常に確定可能
  const canConfirm =
    currentChampions.length > 0 ||
    (sendToLaneChecked && !!laneChoice) ||
    laneGeneralCount > 0 ||
    hasLaneGeneral ||
    champSpecificCount > 0 ||
    selectedMatchupIndices.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#fcfbf9] dark:bg-[#2b2d31] border border-border rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
        {/* ヘッダー */}
        <div className="flex items-start sm:items-center justify-between border-b border-border pb-4 gap-4 flex-col sm:flex-row">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                <BookOpen size={22} className="text-primary-600" />
                <span>辞典統合 ＆ 戦略データ整理プレビュー</span>
              </h3>
              {continuousReview && (
                <span className="bg-primary-100 text-primary-800 border border-primary-edge text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  ⚡ 連続レビュー中 (残り {Math.max(0, continuousReview.totalCount - continuousReview.currentIndex)} 件)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-strong mt-1">
              記事の内容をAIが整理し、チャンピオントレンド各項目・対面メモ・レーンガイドへ最適配分します。
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={saving || reAnalyzing}
            className="text-faint hover:text-foreground-subtle p-1.5 rounded-lg hover:bg-surface-subtle disabled:opacity-50 transition self-end sm:self-auto"
            title="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        {/* 📄 元記事の即座確認アコーディオン */}
        <div className="bg-surface-subtle/80 border border-border rounded-2xl overflow-hidden transition-all">
          <div
            onClick={() => setShowSourceArticle(v => !v)}
            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-surface-hover/50 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
              <FileText size={16} className="text-primary-700 shrink-0" />
              <span className="text-xs font-black text-foreground truncate">
                元記事: {articleTitle || '無題'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] font-bold text-primary-700 bg-surface border border-primary-edge hover:bg-primary-50 px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm transition"
                  title="元動画・記事を開く"
                >
                  <span>元ソース</span>
                  <ExternalLink size={11} />
                </a>
              )}
              <span className="text-faint text-xs flex items-center gap-0.5 font-bold">
                {showSourceArticle ? '閉じる' : '全文を見る'}
                <ChevronDown size={14} className={`transition-transform duration-200 ${showSourceArticle ? 'rotate-180' : 'rotate-0'}`} />
              </span>
            </div>
          </div>

          {showSourceArticle && (
            <div className="p-4 border-t border-border bg-surface max-h-[300px] overflow-y-auto text-xs leading-relaxed text-foreground-subtle prose prose-stone max-w-none">
              {articleContent ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{articleContent}</ReactMarkdown>
              ) : (
                <p className="text-faint italic">本文がありません</p>
              )}
            </div>
          )}
        </div>

        {/* 対象チャンピオン編集バー (プレビュー内での追加・削除・再解析) */}
        <div className="bg-primary-50/70 border border-primary-edge-soft/90 rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black text-primary-950 flex items-center gap-1.5">
              🏆 統合対象のチャンピオン ({currentChampions.length}体)
            </span>
            <div className="flex items-center gap-2">
              {reAnalyzing && (
                <span className="text-[11px] font-bold text-primary-700 flex items-center gap-1 animate-pulse">
                  <RefreshCw size={12} className="animate-spin" /> AI再解析中...
                </span>
              )}
              {currentChampions.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllChampions}
                  disabled={saving || reAnalyzing}
                  className="text-[11px] font-bold text-danger-700 hover:text-danger-800 bg-danger-50 hover:bg-danger-100 border border-danger-edge-soft px-2 py-0.5 rounded-lg transition flex items-center gap-1"
                  title="チャンピオンを全解除してレーン一般論のみにします"
                >
                  <Trash size={11} />
                  <span>チャンプ全解除（一般論のみ）</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 選択中のチャンピオンタグ */}
            {currentChampions.length > 0 ? (
              currentChampions.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-primary-edge rounded-lg text-xs font-bold text-foreground-soft shadow-sm"
                >
                  {getChampIcon(c) && (
                    <img
                      src={getChampIcon(c)}
                      alt={c}
                      className="w-4 h-4 rounded-md border border-primary-edge-soft"
                    />
                  )}
                  <span>{c}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChampion(c)}
                    disabled={saving || reAnalyzing}
                    title={`${c} を除外`}
                    className="text-faint hover:text-danger-600 ml-0.5 transition"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))
            ) : (
              <div className="flex items-center gap-2 flex-wrap w-full bg-surface/90 border border-primary-edge/80 p-2.5 rounded-xl">
                <span className="text-xs font-black text-primary-950 flex items-center gap-1">
                  <Map size={14} className="text-primary-600" />
                  <span>送り先レーンガイド:</span>
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { key: 'COMMON', label: '🌐 全体/共通' },
                    { key: 'TOP', label: '⚔️ TOP' },
                    { key: 'JG', label: '🌲 JG' },
                    { key: 'MID', label: '⚡ MID' },
                    { key: 'ADC', label: '🏹 BOT' },
                    { key: 'SUP', label: '🛡️ SUP' },
                  ].map((l) => (
                    <button
                      key={l.key}
                      type="button"
                      onClick={() => {
                        setLaneChoice(l.key);
                        setSendToLaneChecked(true);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border ${
                        laneChoice === l.key
                          ? 'bg-primary-600 border-primary-edge-strong text-white shadow-xs'
                          : 'bg-background border-border text-foreground-subtle hover:bg-primary-50 hover:border-primary-edge'
                      }`}
                    >
                      <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 新規チャンピオン追加用サジェスト */}
            <div className="w-48 pt-1">
              <ChampSelect
                value={champInput}
                onChange={setChampInput}
                placeholder="＋チャンプを追加して辞典へ..."
                className="bg-surface border-primary-edge focus:border-primary-edge-strong py-1 text-xs"
                onSelect={(champ: string) => handleAddChampion(champ)}
              />
            </div>
          </div>

          {/* 💡 本文・タイトルから検出された候補チャンピオン */}
          {detectedSuggestions.length > 0 && (
            <div className="pt-2 border-t border-primary-edge-soft/60 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-primary-900 flex items-center gap-1">
                <Sparkles size={12} className="text-primary-600" />
                <span>本文から検出された候補:</span>
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {detectedSuggestions.slice(0, 6).map((s) => (
                  <button
                    key={s.champion}
                    type="button"
                    onClick={() => handleAddChampion(s.champion)}
                    disabled={saving || reAnalyzing}
                    className="text-[11px] font-bold bg-surface hover:bg-primary-100 border border-primary-edge text-foreground-soft px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs hover:border-primary-edge transition"
                    title={`${s.matchedAlias} (${s.count}回出現) を対象に追加して再解析`}
                  >
                    <span>＋ {s.matchedAlias}</span>
                    <span className="text-[9px] text-primary-700 bg-primary-100 px-1 rounded font-mono">
                      {s.count}回{s.inTitle ? '・題' : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 1. チャンピオントレンド構造化プレビュー */}
        {hasTrendAnalyses ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary-600" />
              <h4 className="text-sm font-extrabold text-foreground">
                1. チャンピオントレンド統合（構造化項目への整理）
              </h4>
            </div>

            {trendAnalyses.map((analysis) => (
              <div key={analysis.champion} className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <div className="flex items-center justify-between w-full flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      {getChampIcon(analysis.champion) && (
                        <img
                          src={getChampIcon(analysis.champion)}
                          alt={analysis.champion}
                          className="w-8 h-8 rounded-lg border border-primary-edge shadow-sm"
                        />
                      )}
                      <div>
                        <span className="text-sm font-black text-foreground">{analysis.champion}</span>
                        <span className="text-[10px] text-primary-700 bg-primary-50 border border-primary-edge-soft px-2 py-0.5 rounded-md ml-2 font-bold">
                          トレンドデータ更新
                        </span>
                      </div>
                    </div>

                    {/* 送り先レーン選択エリア（全レーン選択可能＋クイック切り替え） */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-primary-50/90 border border-primary-edge px-2.5 py-1 rounded-xl shadow-xs">
                        <span className="text-[11px] font-black text-primary-900">🛡️ 送り先レーン:</span>
                        <select
                          value={championRoles[analysis.champion] || analysis.detectedRole || (analysis.availableRoles && analysis.availableRoles[0]) || 'GLOBAL'}
                          onChange={(e) => {
                            const newRole = e.target.value;
                            setChampionRoles((prev) => ({ ...prev, [analysis.champion]: newRole }));
                          }}
                          className="bg-surface border border-primary-edge rounded-lg px-2 py-0.5 text-xs font-bold text-foreground outline-none cursor-pointer"
                        >
                          {[
                            { key: 'TOP', label: '⚔️ TOP（トップ）' },
                            { key: 'JG', label: '🌲 JG（ジャングル）' },
                            { key: 'MID', label: '⚡ MID（ミッド）' },
                            { key: 'BOT', label: '🏹 BOT（ボット/ADC）' },
                            { key: 'SUP', label: '🛡️ SUP（サポート）' },
                            { key: 'GLOBAL', label: '🌐 全レーン共通 (GLOBAL)' },
                          ].map((r) => {
                            const isRecommended = (analysis.availableRoles || []).includes(r.key);
                            return (
                              <option key={r.key} value={r.key}>
                                {r.label} {isRecommended ? ' ★推奨' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* クイックレーン切り替えバッジ */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {['TOP', 'JG', 'MID', 'BOT', 'SUP', 'GLOBAL'].map((roleKey) => {
                          const currentRole = championRoles[analysis.champion] || analysis.detectedRole || (analysis.availableRoles && analysis.availableRoles[0]) || 'GLOBAL';
                          const isSelected = currentRole === roleKey;
                          const isRecommended = (analysis.availableRoles || []).includes(roleKey);
                          const roleLabel = roleKey === 'TOP' ? 'TOP' : roleKey === 'JG' ? 'JG' : roleKey === 'MID' ? 'MID' : roleKey === 'BOT' ? 'BOT' : roleKey === 'SUP' ? 'SUP' : '共通';

                          return (
                            <button
                              key={roleKey}
                              type="button"
                              onClick={() => setChampionRoles((prev) => ({ ...prev, [analysis.champion]: roleKey }))}
                              disabled={saving || reAnalyzing}
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition flex items-center gap-0.5 border ${
                                isSelected
                                  ? 'bg-primary-600 border-primary-edge-strong text-white shadow-xs'
                                  : isRecommended
                                    ? 'bg-surface border-primary-edge text-primary-900 hover:bg-primary-100'
                                    : 'bg-surface-subtle/80 border-border text-muted-strong hover:bg-surface-hover/80 hover:text-foreground-soft'
                              }`}
                              title={isRecommended ? '推奨レーン' : 'このレーンとして統合'}
                            >
                              <span>{roleLabel}</span>
                              {isRecommended && !isSelected && <span className="text-[9px] text-primary-600">★</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 整理された主要ポイント */}
                {analysis.summaryPoints && analysis.summaryPoints.length > 0 && (
                  <div className="bg-primary-50/60 border border-primary-edge-soft/80 rounded-xl p-3">
                    <p className="text-[11px] font-black text-primary-900 mb-1.5 flex items-center gap-1">
                      <Sparkles size={13} className="text-primary-600" /> 記事から抽出・整理された要点:
                    </p>
                    <ul className="space-y-1">
                      {analysis.summaryPoints.map((pt, i) => (
                        <li key={i} className="text-xs text-foreground-subtle font-medium flex items-start gap-1.5">
                          <span className="text-primary-500 font-bold">•</span>
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
                          className="border border-border rounded-xl bg-background/50 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleFieldExpand(expandKey)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-subtle/60 transition"
                          >
                            <div className="flex items-center gap-2">
                              <IconComp size={15} className="text-primary-700" />
                              <span className="text-xs font-bold text-foreground-soft">{field.fieldLabel}</span>
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                  field.isNew
                                    ? 'bg-success-50 border-success-edge-soft text-success-700'
                                    : 'bg-secondary-50 border-secondary-edge-soft text-secondary-700'
                                }`}
                              >
                                {field.isNew ? '新規追加' : '追記/統合'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-muted-strong font-medium">
                              <span>{isExpanded ? '折りたたむ' : '差分を確認'}</span>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="p-3 pt-0 border-t border-border bg-surface space-y-2 text-xs">
                              {!field.isNew && field.existingValue && (
                                <div>
                                  <p className="text-[10px] font-bold text-faint mb-0.5">現在の内容:</p>
                                  <div className="bg-background border border-border rounded-lg p-2 text-muted text-[11px] whitespace-pre-wrap max-h-24 overflow-y-auto">
                                    {field.existingValue}
                                  </div>
                                </div>
                              )}
                              <div>
                                <p className="text-[10px] font-bold text-primary-700 mb-0.5">統合後の内容（提案）:</p>
                                <div className="bg-primary-50/40 border border-primary-edge-soft rounded-lg p-2.5 text-foreground-soft text-[11px] whitespace-pre-wrap font-medium leading-relaxed">
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
              <div key={idx} className="border border-border rounded-2xl p-4 bg-surface">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-primary-100 text-primary-800">
                    🏆 {p.champion}
                  </span>
                  <span className="text-xs text-muted-strong">項目: {p.fieldName}</span>
                </div>
                <div className="bg-background border border-border rounded-xl p-3 text-xs text-foreground-subtle whitespace-pre-wrap">
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
                <Swords size={16} className="text-danger-600" />
                <h4 className="text-sm font-extrabold text-foreground">
                  2. 検出された対チャンピオン（マッチアップ）対策 ({matchupInsights.length}件)
                </h4>
              </div>
              <span className="text-[10px] font-bold text-danger-600 bg-danger-50 border border-danger-edge-soft px-2 py-0.5 rounded-full">
                調査時に即表示可能
              </span>
            </div>
            <p className="text-xs text-muted-strong">
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
                        ? 'border-danger-edge bg-danger-50/40 shadow-sm'
                        : 'border-border bg-background/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleMatchupSelect(idx)}
                            className="rounded border-danger-edge text-danger-600 focus:ring-danger-400"
                          />
                          <span className="text-xs font-black text-danger-950 flex items-center gap-1.5">
                            🛡️ {m.targetChampion} vs {m.enemyChampion}
                          </span>
                        </label>
                        {getChampIcon(m.enemyChampion) && (
                          <img
                            src={getChampIcon(m.enemyChampion)}
                            alt={m.enemyChampion}
                            className="w-5 h-5 rounded-md border border-border"
                          />
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-muted-strong">{m.title}</span>
                    </div>

                    <div className="bg-surface border border-danger-edge-soft/80 rounded-xl p-2.5 text-xs text-foreground-soft leading-relaxed whitespace-pre-wrap">
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
            <div className="flex items-center justify-between border-t border-border pt-4 flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Map size={16} className="text-secondary-600" />
                  <h4 className="text-sm font-extrabold text-foreground">
                    3. 抽出された一般論・戦術知見 ({laneInsightItems.length}件)
                  </h4>
                </div>
                <p className="text-xs text-muted-strong mt-0.5">
                  各項目のチェックを外して除外したり、「チャンピオン固有」に切り替えて対象チャンプの辞典へ直接書き込むことができます。
                </p>
              </div>

              {laneGeneralCount > 0 && (
                <label className="flex items-center gap-1.5 text-xs font-bold text-secondary-700 cursor-pointer bg-secondary-50 border border-secondary-edge-soft px-3 py-1.5 rounded-xl">
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
              <div className="flex items-center gap-2 mb-2 bg-secondary-50/50 p-2.5 rounded-xl border border-secondary-edge-soft">
                <span className="text-xs font-bold text-secondary-900">送り先レーン:</span>
                <select
                  value={laneChoice}
                  onChange={(e) => setLaneChoice(e.target.value)}
                  className="bg-surface border border-secondary-edge rounded-lg px-2.5 py-1 text-xs text-secondary-800 outline-none font-medium"
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
                        ? 'border-border bg-background/50 opacity-40'
                        : isLaneGeneral
                        ? 'border-secondary-edge-soft bg-secondary-50/30'
                        : 'border-primary-edge bg-primary-50/40 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.included}
                          onChange={() => toggleLaneInsightIncluded(idx)}
                          className="mt-0.5 rounded border-border text-secondary-600 focus:ring-secondary-400"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-foreground block leading-tight">
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
                              ? 'bg-secondary-100 border-secondary-edge text-secondary-800 hover:bg-secondary-200'
                              : 'bg-primary-100 border-primary-edge text-primary-900 hover:bg-primary-200'
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
                              className="bg-surface border-primary-edge py-0.5 text-xs h-7"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className={`rounded-xl p-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                        item.included ? 'bg-surface text-foreground-subtle border border-border/80' : 'text-faint'
                      }`}
                    >
                      {item.summary}
                    </div>

                    {item.included && !isLaneGeneral && item.assignedChampion && (
                      <p className="text-[10px] font-bold text-primary-700 mt-1.5 flex items-center gap-1">
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
        <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-border flex-wrap">
          <div className="text-xs text-muted-strong">
            {currentChampions.length === 0 ? (
              sendToLaneChecked ? (
                <span className="text-secondary-800 font-bold flex items-center gap-1">
                  <Map size={14} className="text-secondary-600" />
                  <span>送り先: <strong>{LANE_LABELS[laneChoice] || laneChoice} レーンガイド</strong></span>
                </span>
              ) : (
                <span className="text-danger-600 font-bold">⚠️ 統合対象のチャンピオンまたは送り先レーンを選択してください</span>
              )
            ) : (
              <span>対象: <strong className="text-foreground-soft">{currentChampions.join(', ')}</strong></span>
            )}
            {champSpecificCount > 0 && (
              <span className="ml-2 text-primary-700 font-bold">
                （固有知見 {champSpecificCount}件を追加統合）
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving || reAnalyzing}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-muted-strong hover:bg-surface-subtle disabled:opacity-50 transition"
            >
              {continuousReview ? '中断して閉じる' : 'キャンセル'}
            </button>

            {continuousReview && (
              <>
                <button
                  type="button"
                  onClick={continuousReview.onSkipNext}
                  disabled={saving || reAnalyzing}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-surface-subtle hover:bg-surface-hover text-muted flex items-center gap-1.5 disabled:opacity-50 transition"
                  title="この記事は統合せず、スキップして次の記事を表示します"
                >
                  <span>⏭️ スキップ</span>
                </button>

                {continuousReview.onMoveToArchiveAndNext && (
                  <button
                    type="button"
                    onClick={continuousReview.onMoveToArchiveAndNext}
                    disabled={saving || reAnalyzing}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-danger-50 hover:bg-danger-100 border border-danger-edge-soft text-danger-700 flex items-center gap-1.5 disabled:opacity-50 transition"
                    title="この記事を辞典等へ統合せず、そのまま移動済み（アーカイブ）へ移して次へ進みます"
                  >
                    <Archive size={13} />
                    <span>📦 統合せずに移動済みへ</span>
                  </button>
                )}
              </>
            )}

            {continuousReview ? (
              <button
                type="button"
                onClick={handleConfirmAndNext}
                disabled={saving || reAnalyzing || !canConfirm}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-2 shadow-md shadow-primary-600/20 disabled:opacity-50 transition"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>{saving ? '統合処理中...' : '✨ 確定して次の記事へ'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving || reAnalyzing || !canConfirm}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-2 shadow-sm disabled:opacity-50 transition"
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
