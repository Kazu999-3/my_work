'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertTriangle, ClipboardCheck, Compass } from 'lucide-react';
import ReviewControlBar from './_review/ReviewControlBar';
import ReviewItemCard from './_review/ReviewItemCard';
import BibleProgressHeader, { type BibleStats } from './_review/BibleProgressHeader';
import PreviewModal from './_review/PreviewModal';
import DecomposeModal from './_review/DecomposeModal';
import ReanalyzeModal from './_review/ReanalyzeModal';
import CompareModal from './_review/CompareModal';
import { useVisiblePolling } from '@/lib/useVisiblePolling';
import type { DecomposedInsight } from '@/lib/knowledgeDecompose';
import { buildFactOverrides, initialSelections, routedLinesBlock, type RoutedLaneLine } from './_review/factRouting';
import {
  defaultEdit,
  type ItemEditState, type LaneKey, type LineDestination, type PreviewResult, type ReanalyzeRequest, type ReviewItem, type RosterChampion,
} from './_review/types';

// 生成記事の承認画面。状態と通信だけをここに置き、表示は _review/ の部品が持つ。
// 2026-10-07: 1,691行から分割（表示・動作は分割前と同じ。一括操作の失敗時に一覧から消えていた不具合のみ修正）。
export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [roster, setRoster] = useState<RosterChampion[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<'' | 'video' | 'atomic'>('');
  const [channel, setChannel] = useState<string>('');
  const [lane, setLane] = useState<LaneKey | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sort, setSort] = useState<string>('created_asc');
  const [channels, setChannels] = useState<{ name: string; count: number }[]>([]);
  const [laneCounts, setLaneCounts] = useState<Record<string, number>>({});
  // 2026-10-19: 薄い可能性・再解析版、2026-10-26: チャンプ確定・未定の絞り込み
  const [quality, setQuality] = useState<string>('');
  const [qualityCounts, setQualityCounts] = useState<{ thin?: number; reanalyzed?: number; determined?: number; unknown?: number; approve?: number; check?: number; skip?: number }>({});
  const [reanalyzeItem, setReanalyzeItem] = useState<ReviewItem | null>(null);
  const [compareItem, setCompareItem] = useState<ReviewItem | null>(null);
  const [edits, setEdits] = useState<Record<number, ItemEditState>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [bibleStats, setBibleStats] = useState<BibleStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 統合プレビューモーダル用ステート
  const [previewModalItem, setPreviewModalItem] = useState<ReviewItem | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTab, setPreviewTab] = useState<'facts' | 'strategy' | 'lane' | 'matchup'>('strategy');
  const [selectedFactFields, setSelectedFactFields] = useState<Record<string, boolean>>({});
  // 文単位の宛先管理: `${champId}::${diffKey}::${lineIdx}` -> 'champion' | 'lane' | 'skip'
  const [lineDestinations, setLineDestinations] = useState<Record<string, LineDestination>>({});
  const [editedLaneSectionText, setEditedLaneSectionText] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);

  // ✂️ ナレッジ分解モーダル用ステート
  const [decomposeModalItem, setDecomposeModalItem] = useState<ReviewItem | null>(null);
  const [decomposeInsights, setDecomposeInsights] = useState<DecomposedInsight[]>([]);
  const [decomposeLoading, setDecomposeLoading] = useState(false);
  const [decomposeError, setDecomposeError] = useState<string | null>(null);

  const showMessage = (text: string, t: 'success' | 'error') => {
    setMessage({ text, type: t });
    setTimeout(() => setMessage(null), 7000);
  };

  // silent: 再解析の完了待ちの自動更新。読み込み表示を出さず、編集中の内容と選択は残す
  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (type) qs.set('type', type);
      if (channel) qs.set('channel', channel);
      if (lane && lane !== 'ALL') qs.set('lane', lane);
      if (searchQuery.trim()) qs.set('q', searchQuery.trim());
      if (sort) qs.set('sort', sort);
      if (quality) qs.set('quality', quality);

      const res = await fetch(`/api/knowledge/review?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '取得に失敗しました');

      const loadedItems: ReviewItem[] = json.items || [];
      setItems(loadedItems);
      setTotal(json.total || 0);
      setTotalAll(json.totalAll ?? json.total ?? 0);
      if (json.channels) setChannels(json.channels);
      if (json.laneCounts) setLaneCounts(json.laneCounts);
      if (json.qualityCounts) setQualityCounts(json.qualityCounts);
      if (json.bibleStats) setBibleStats(json.bibleStats);
      if (json.roster?.length) setRoster(json.roster);
      if (!opts.silent) setSelected(new Set());

      // 各アイテムの初期編集ステートを自動判定値から構築
      const initialEdits: Record<number, ItemEditState> = {};
      for (const item of loadedItems) {
        initialEdits[item.id] = {
          champion: item.currentChampNamesJa || item.detectedChampionsJa || (item.isLaneGeneral ? '' : item.champion || ''),
          enemyChampion: item.enemyChampionJa || item.enemyChampion || '',
          title: item.title || '',
          content: item.content || '',
          lane: item.detectedLane || 'COMMON',
          includeLaneGuide: item.isLaneMacro,
          includeFactMerge: true, // デフォルトで項目マージも実行
        };
      }
      // 自動更新では、すでに編集中の記事の入力を上書きしない（新しく届いた記事だけ初期値を入れる）
      setEdits((prev) => (opts.silent ? { ...initialEdits, ...prev } : initialEdits));
    } catch (e: any) {
      if (!opts.silent) showMessage(e.message, 'error');
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, [type, channel, lane, searchQuery, sort, quality]);

  useEffect(() => { load(); }, [load]);

  // 再解析の依頼中は1分おきに一覧を更新し、新しい版が届いたら入れ替える（画面が見えている時だけ）
  const hasActiveReanalysis = items.some((i) => i.reanalysisTask && ['pending', 'running'].includes(i.reanalysisTask.status));
  useVisiblePolling(() => { load({ silent: true }); }, 60_000, hasActiveReanalysis);

  const requestReanalysis = async (item: ReviewItem, req: ReanalyzeRequest) => {
    const result = await post({ action: 'reanalyze', id: item.id, ...req });
    if (result.ok) {
      setReanalyzeItem(null);
      setCompareItem(null);
      load({ silent: true });
    }
  };

  const discardReanalysis = async (item: ReviewItem) => {
    if (!confirm('この再解析版は使わず、元の記事に戻しますか？（再解析版は履歴として残ります）')) return;
    const result = await post({ action: 'discard_reanalysis', id: item.id });
    if (result.ok) {
      setCompareItem(null);
      load({ silent: true });
    }
  };

  const post = async (payload: Record<string, any>): Promise<{ ok: boolean; message?: string; error?: string }> => {
    setBusy(true);
    try {
      const res = await fetch('/api/knowledge/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          const errText = 'ログインセッションが切れました。ログイン画面へ移動します...';
          showMessage(errText, 'error');
          setTimeout(() => {
            window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
          }, 1200);
          return { ok: false, error: errText };
        }
        const errText = json.error || '処理に失敗しました';
        showMessage(errText, 'error');
        return { ok: false, error: errText };
      }
      showMessage(json.message, 'success');
      return { ok: true, message: json.message };
    } catch (e: any) {
      const errText = e.message || '通信エラーが発生しました';
      showMessage(errText, 'error');
      return { ok: false, error: errText };
    } finally {
      setBusy(false);
    }
  };

  const removeFromList = (ids: number[]) => {
    const s = new Set(ids);
    setItems((prev) => {
      const nextItems = prev.filter((i) => !s.has(i.id));
      setFocusedIndex((cur) => (nextItems.length === 0 ? -1 : Math.min(cur, nextItems.length - 1)));
      return nextItems;
    });
    setTotal((t) => Math.max(0, t - ids.length));
    setSelected((prev) => new Set(Array.from(prev).filter((id) => !s.has(id))));
  };

  // 1件承認（編集内容＋二系統統合＋項目マージパラメータを送信）
  const approveOne = async (item: ReviewItem | null) => {
    if (!item) return;
    setModalError(null);
    const edit = edits[item.id] || defaultEdit(item);
    const isPreviewing = previewModalItem?.id === item.id;

    // モーダルでプレビュー表示中の場合、各行（文）の宛先（辞典/レーン/スキップ）に応じてテキストを合成
    let customFactOverrides: Record<string, Record<string, string>> | undefined;
    let routedToLaneLines: RoutedLaneLine[] = [];
    if (isPreviewing && previewData?.factPreviews) {
      ({ customFactOverrides, routedToLaneLines } = buildFactOverrides(previewData, selectedFactFields, lineDestinations));
    }

    // レーンガイドへ振り分けられた文があれば、レーンガイドテキスト末尾へ合流（その場合はレーンガイド統合を自動でON）
    let finalLaneSectionText = (isPreviewing && editedLaneSectionText) ? editedLaneSectionText : undefined;
    let shouldIncludeLaneGuide = edit.includeLaneGuide;
    if (routedToLaneLines.length > 0) {
      shouldIncludeLaneGuide = true;
      finalLaneSectionText = (finalLaneSectionText || (previewData?.laneGuidePreview?.sectionText || '')) + routedLinesBlock(routedToLaneLines);
    }

    const result = await post({
      id: item.id,
      action: 'approve',
      champion: edit.champion,
      enemyChampion: edit.enemyChampion,
      title: edit.title,
      content: edit.content,
      lane: edit.lane,
      includeLaneGuide: shouldIncludeLaneGuide,
      includeFactMerge: edit.includeFactMerge,
      customLaneSectionText: finalLaneSectionText,
      customFactOverrides,
    });
    if (result.ok) {
      removeFromList([item.id]);
      setBibleStats((prev) => {
        if (!prev) return prev;
        const targetChamp = edit.champion || item.currentChampNamesJa || item.detectedChampionsJa;
        return {
          ...prev,
          totalApproved: prev.totalApproved + 1,
          todayApproved: prev.todayApproved + 1,
          totalPending: Math.max(0, prev.totalPending - 1),
          topChampions: prev.topChampions.map((c) =>
            (c.nameJa === targetChamp || c.champion === targetChamp) ? { ...c, count: c.count + 1 } : c
          ),
        };
      });
      if (isPreviewing) setPreviewModalItem(null);
    } else {
      setModalError(result.error || '承認統合に失敗しました');
    }
  };

  // 1件却下
  const rejectOne = async (item: ReviewItem) => {
    if (!confirm(`「${item.title}」を却下して削除しますか？`)) return;
    const result = await post({ id: item.id, action: 'reject' });
    if (result.ok) {
      removeFromList([item.id]);
      if (previewModalItem?.id === item.id) setPreviewModalItem(null);
    }
  };

  // 一括承認・却下
  const batch = async (action: 'approve' | 'reject') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(action === 'approve'
      ? `選択した${ids.length}件を承認して統合しますか？（AIが判定した複数チャンプ・レーンガイド・各項目へ自動分配されます）`
      : `選択した${ids.length}件を却下して削除しますか？`)) return;
    // ★ 2026-10-07: post() は常にオブジェクトを返すため、以前の `if (await post(...))` は失敗しても一覧から消していた
    const result = await post({ ids, action });
    if (result.ok) {
      removeFromList(ids);
      if (action === 'approve') {
        setBibleStats((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            totalApproved: prev.totalApproved + ids.length,
            todayApproved: prev.todayApproved + ids.length,
            totalPending: Math.max(0, prev.totalPending - ids.length),
          };
        });
      }
    }
  };

  // プレビューの読み込み
  const openPreview = async (item: ReviewItem) => {
    setPreviewModalItem(item);
    setPreviewLoading(true);
    setPreviewData(null);
    setModalError(null);
    try {
      const edit = edits[item.id] || defaultEdit(item);
      const res = await fetch('/api/knowledge/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          title: edit.title,
          content: edit.content,
          champion: edit.champion,
          enemyChampion: edit.enemyChampion,
          lane: edit.lane,
          includeLaneGuide: edit.includeLaneGuide,
          includeFactMerge: edit.includeFactMerge,
          source_url: item.source_url,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
          return;
        }
        throw new Error(json.error || 'プレビューの生成に失敗しました');
      }
      setPreviewData(json);
      setEditedLaneSectionText(json.laneGuidePreview?.sectionText || '');

      // 各フィールドの選択ステート初期化（更新がある項目はデフォルトでチェックON）
      const init = initialSelections(Array.isArray(json.factPreviews) ? json.factPreviews : []);
      setSelectedFactFields(init.fields);
      setLineDestinations(init.lines);

      // 初期タブの決定（対面記事指定時は対面優先、それ以外は教本優先）
      if (json.matchupPreviews?.length > 0 && edit.enemyChampion) {
        setPreviewTab('matchup');
      } else if (json.championPreviews?.length > 0) {
        setPreviewTab('strategy');
      } else if (json.laneGuidePreview) {
        setPreviewTab('lane');
      } else {
        setPreviewTab('facts');
      }
    } catch (e: any) {
      showMessage(e.message, 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  // ✂️ ナレッジ分解プレビューの読み込み
  const openDecompose = async (item: ReviewItem) => {
    setDecomposeModalItem(item);
    setDecomposeLoading(true);
    setDecomposeError(null);
    setDecomposeInsights([]);
    try {
      const res = await fetch('/api/knowledge/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decompose_preview',
          id: item.id,
          title: item.title,
          content: item.content,
          source_url: item.source_url,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
          return;
        }
        throw new Error(json.error || 'ナレッジ分解に失敗しました');
      }
      setDecomposeInsights(json.insights || []);
    } catch (e: any) {
      setDecomposeError(e.message || 'ナレッジ分解中にエラーが発生しました');
    } finally {
      setDecomposeLoading(false);
    }
  };

  // ✂️ 分割知見の保存実行
  const saveDecomposed = async (selectedInsights: DecomposedInsight[]) => {
    if (!decomposeModalItem || selectedInsights.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch('/api/knowledge/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decompose_save',
          parentId: decomposeModalItem.id,
          insights: selectedInsights,
          source_url: decomposeModalItem.source_url,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
          return;
        }
        throw new Error(json.error || '分割知見の保存に失敗しました');
      }
      const parentId = decomposeModalItem.id;
      // 親記事を画面の一覧から即座に除外（分解完了扱い）
      removeFromList([parentId]);
      showMessage(json.message || `元記事(ID:${parentId})を完了とし、${selectedInsights.length}件の分割知見を登録しました`, 'success');
      setDecomposeModalItem(null);
      // 分割知見を一覧へ反映するためバックグラウンド更新
      load({ silent: true });
    } catch (e: any) {
      setDecomposeError(e.message || '保存中にエラーが発生しました');
    } finally {
      setBusy(false);
    }
  };

  const updateEditField = (id: number, patch: Partial<ItemEditState>) => {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { champion: '', title: '', content: '', lane: 'COMMON', includeLaneGuide: false, includeFactMerge: true }),
        ...patch,
      },
    }));
  };

  const toggle = (set: Set<number>, id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  // ⌨️ キーボードショートカット (J/K:移動 A:即時承認 X:却下 D:分解 P:プレビュー Esc:モーダル閉じる)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // フォーム入力中（input, textarea, select）はキー操作を安全にスキップ
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toUpperCase();
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
      if (isInput) return;

      // モーダルが開いている時の Esc キー操作
      if (previewModalItem || decomposeModalItem || reanalyzeItem || compareItem) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setPreviewModalItem(null);
          setDecomposeModalItem(null);
          setReanalyzeItem(null);
          setCompareItem(null);
        }
        return;
      }

      if (items.length === 0) return;

      const key = e.key.toLowerCase();

      // J / ArrowDown: 次のカードへフォーカス
      if (key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < items.length - 1 ? prev + 1 : 0;
          const targetId = items[next]?.id;
          const el = document.querySelector(`[data-review-card="${targetId}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return next;
        });
        return;
      }

      // K / ArrowUp: 前のカードへフォーカス
      if (key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : items.length - 1;
          const targetId = items[next]?.id;
          const el = document.querySelector(`[data-review-card="${targetId}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return next;
        });
        return;
      }

      // 現在フォーカスされているアイテムの取得
      const currentItem = focusedIndex >= 0 && focusedIndex < items.length ? items[focusedIndex] : null;
      if (!currentItem) return;

      // A: 即時承認（統合）
      if (key === 'a') {
        e.preventDefault();
        approveOne(currentItem);
        return;
      }

      // X: 却下
      if (key === 'x') {
        e.preventDefault();
        rejectOne(currentItem);
        return;
      }

      // D: ナレッジ分解
      if (key === 'd') {
        e.preventDefault();
        if (!currentItem.is_atomic) {
          openDecompose(currentItem);
        }
        return;
      }

      // P: プレビュー確認
      if (key === 'p') {
        e.preventDefault();
        openPreview(currentItem);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, focusedIndex, previewModalItem, decomposeModalItem, reanalyzeItem, compareItem, edits]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* ヘッダーバー */}
        <div className="border-b border-zinc-800 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-amber-400" /> 生成記事の承認 ＆ 完全プレビュー統合
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              動画解析記事を承認します。複数チャンピオン教本への追記・レーンガイドへのマージに加え、
              各項目（強み・弱み・スパイク等）のAI差分マージと編集履歴の完全追従に対応しています。
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
            <Link href="/lane-guides" target="_blank" className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold">
              <Compass className="w-3.5 h-3.5" /> レーン攻略バイブル
            </Link>
            <Link href="/admin/youtube" className="text-xs text-zinc-400 hover:text-white">
              ← 動画解析
            </Link>
          </div>
        </div>

        {/* メッセージ */}
        {message && (
          <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400' : 'bg-rose-950/30 border-rose-800/60 text-rose-400'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {message.text}
          </div>
        )}

        {/* 📚 教本インテリジェンス蓄積進捗 ＆ 獲得ダッシュボード */}
        <BibleProgressHeader
          stats={bibleStats}
          onSelectChampion={(champNameJa) => setSearchQuery(champNameJa)}
          activeSearchQuery={searchQuery}
        />

        <ReviewControlBar
          type={type} setType={setType} channel={channel} setChannel={setChannel} channels={channels}
          totalAll={totalAll} total={total} sort={sort} setSort={setSort} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          lane={lane} setLane={setLane} laneCounts={laneCounts} loading={loading} onReload={() => load()}
          quality={quality} setQuality={setQuality} qualityCounts={qualityCounts}
        />

        {/* 一括操作バー ＆ キーボードショートカットガイド */}
        {items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-amber-500"
                  checked={selected.size === items.length && items.length > 0}
                  onChange={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}
                />
                表示中を全選択（{selected.size}/{items.length}）
              </label>

              {/* ⌨️ キーボードショートカット案内バッジ */}
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-400 bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 font-bold">⌨️ ショートカット:</span>
                <span className="font-mono bg-zinc-800 px-1 py-0.2 rounded text-amber-400">J/K</span>
                <span>移動</span>
                <span className="font-mono bg-zinc-800 px-1 py-0.2 rounded text-emerald-400">A</span>
                <span>即時承認</span>
                <span className="font-mono bg-zinc-800 px-1 py-0.2 rounded text-rose-400">X</span>
                <span>却下</span>
                <span className="font-mono bg-zinc-800 px-1 py-0.2 rounded text-teal-400">D</span>
                <span>分解</span>
                <span className="font-mono bg-zinc-800 px-1 py-0.2 rounded text-zinc-300">P</span>
                <span>プレビュー</span>
              </div>
            </div>

            {selected.size > 0 && (
              <div className="flex gap-2">
                <button onClick={() => batch('approve')} disabled={busy} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 選択分を一括承認（二系統＋項目自動マージ）
                </button>
                <button onClick={() => batch('reject')} disabled={busy} className="px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-400 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50">
                  <XCircle className="w-3.5 h-3.5" /> 選択分を却下
                </button>
              </div>
            )}
          </div>
        )}

        <datalist id="roster-champions">
          {roster.map((c) => <option key={c.id} value={c.name}>{c.id}</option>)}
        </datalist>

        {/* 記事カード一覧 */}
        <div className="space-y-4">
          {loading && items.length === 0 && <p className="text-xs text-zinc-500 text-center py-10">読み込み中...</p>}
          {!loading && items.length === 0 && (
            <p className="text-xs text-zinc-500 text-center py-12 bg-zinc-900/40 border border-zinc-800 rounded-xl">承認待ちの記事はありません</p>
          )}

          {items.map((item, idx) => (
            <ReviewItemCard
              key={item.id}
              item={item}
              edit={edits[item.id] || defaultEdit(item)}
              isOpen={expanded.has(item.id)}
              isSelected={selected.has(item.id)}
              isFocused={focusedIndex === idx}
              channel={channel}
              busy={busy}
              onCardClick={() => setFocusedIndex(idx)}
              onToggleSelect={() => setSelected((s) => toggle(s, item.id))}
              onToggleExpand={() => setExpanded((s) => toggle(s, item.id))}
              setChannel={setChannel}
              onEdit={(patch) => updateEditField(item.id, patch)}
              onApprove={() => approveOne(item)}
              onPreview={() => openPreview(item)}
              onReject={() => rejectOne(item)}
              onDecompose={() => openDecompose(item)}
              onReanalyze={() => setReanalyzeItem(item)}
              onCompare={() => setCompareItem(item)}
              onDiscardReanalysis={() => discardReanalysis(item)}
              onReload={() => load({ silent: true })}
            />
          ))}
        </div>

        {/* 👁️ 統合先プレビュー＆修正モーダル */}
        {previewModalItem && (
          <PreviewModal
            edit={edits[previewModalItem.id]}
            previewData={previewData}
            previewLoading={previewLoading}
            previewTab={previewTab}
            setPreviewTab={setPreviewTab}
            modalError={modalError}
            busy={busy}
            selectedFactFields={selectedFactFields}
            setSelectedFactFields={setSelectedFactFields}
            lineDestinations={lineDestinations}
            setLineDestinations={setLineDestinations}
            editedLaneSectionText={editedLaneSectionText}
            setEditedLaneSectionText={setEditedLaneSectionText}
            onClose={() => setPreviewModalItem(null)}
            onEdit={(patch) => updateEditField(previewModalItem.id, patch)}
            onRecalculate={() => openPreview(previewModalItem)}
            onApprove={() => approveOne(previewModalItem)}
          />
        )}

        {/* 🔁 再解析の依頼 */}
        {reanalyzeItem && (
          <ReanalyzeModal
            item={reanalyzeItem}
            busy={busy}
            onClose={() => setReanalyzeItem(null)}
            onSubmit={(req) => requestReanalysis(reanalyzeItem, req)}
          />
        )}

        {/* 🆚 再解析版と元の記事の比較 */}
        {compareItem && (
          <CompareModal
            item={compareItem}
            busy={busy}
            onClose={() => setCompareItem(null)}
            onAdopt={() => { const it = compareItem; setCompareItem(null); openPreview(it); }}
            onDiscard={() => discardReanalysis(compareItem)}
            onReanalyzeAgain={() => { setReanalyzeItem(compareItem); setCompareItem(null); }}
          />
        )}

        {/* ✂️ 複数チャンピオンへのナレッジ分解モーダル */}
        {decomposeModalItem && (
          <DecomposeModal
            parentTitle={decomposeModalItem.title}
            parentId={decomposeModalItem.id}
            sourceUrl={decomposeModalItem.source_url}
            loading={decomposeLoading}
            insights={decomposeInsights}
            error={decomposeError}
            busy={busy}
            onClose={() => setDecomposeModalItem(null)}
            onSave={(selectedInsights) => saveDecomposed(selectedInsights)}
            onRetry={() => openDecompose(decomposeModalItem)}
          />
        )}
      </div>
    </div>
  );
}
