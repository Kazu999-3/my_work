'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertTriangle, ClipboardCheck, Compass, RotateCcw } from 'lucide-react';
import AdminNavHeader from '@/components/AdminNavHeader';
import ReviewControlBar from './_review/ReviewControlBar';
import ReviewItemCard from './_review/ReviewItemCard';
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
  const [qualityCounts, setQualityCounts] = useState<{ thin?: number; reanalyzed?: number; multi?: number; determined?: number; unknown?: number; approve?: number; check?: number; skip?: number }>({});
  const [reanalyzeItems, setReanalyzeItems] = useState<ReviewItem[] | null>(null);
  const [compareItem, setCompareItem] = useState<ReviewItem | null>(null);
  const [edits, setEdits] = useState<Record<number, ItemEditState>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<number>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [processingMap, setProcessingMap] = useState<Record<number, "approving" | "rejecting">>({});
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
      qs.set('t', String(Date.now())); // キャッシュバイパスで常に最新の承認状態を取得

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

  const requestReanalysis = async (targetItems: ReviewItem[], req: ReanalyzeRequest) => {
    const ids = targetItems.map((i) => i.id);
    const result = await post({ action: 'reanalyze', ids, ...req });
    if (result.ok) {
      setReanalyzeItems(null);
      setCompareItem(null);
      // 依頼完了した記事を選択解除
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      load({ silent: true });
    }
  };

  const startBatchReanalysis = () => {
    const selectedIds = Array.from(selected);
    const targets = items.filter(
      (i) => selectedIds.includes(i.id) && !i.is_atomic && /youtu/.test(i.source_url || '')
    );
    if (targets.length === 0) {
      showMessage('再解析できるYouTube動画の記事が選択されていません', 'error');
      return;
    }
    setReanalyzeItems(targets);
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

  // 1件承認（楽観的UI更新で即座に一覧から消去して二重承認を根絶）
  const approveOne = async (item: ReviewItem | null) => {
    if (!item) return;
    setModalError(null);
    const edit = edits[item.id] || defaultEdit(item);
    const isPreviewing = previewModalItem?.id === item.id;

    // ⚡ 楽観的消去: ユーザーの操作感（Vibe）最優先で0秒消去
    removeFromList([item.id]);
    if (isPreviewing) setPreviewModalItem(null);

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

    // ✂️ 複数チャンプ記事の場合、中身確認不要の自動分解＆教本直接統合を実行（2026-10-28）
    const isAutoDecompose = !isPreviewing && item.isMultiChampion && !item.is_atomic;

    const result = await post(
      isAutoDecompose
        ? { id: item.id, action: 'decompose_auto' }
        : {
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
          }
    );

    if (!result.ok) {
      showMessage(`「${item.title}」の承認に失敗しました: ${result.error}`, 'error');
      // 失敗時のみ一覧を再同期して復元
      load({ silent: true });
    } else if (result.message) {
      showMessage(result.message, 'success');
    }
  };

  // 1件却下（楽観的UI更新）
  const rejectOne = async (item: ReviewItem) => {
    if (!confirm(`「${item.title}」を却下して削除しますか？`)) return;
    removeFromList([item.id]);
    if (previewModalItem?.id === item.id) setPreviewModalItem(null);
    const result = await post({ id: item.id, action: 'reject' });
    if (!result.ok) {
      showMessage(`却下に失敗しました: ${result.error}`, 'error');
      load({ silent: true });
    }
  };

  // 一括承認・却下（楽観的UI更新）
  const batch = async (action: 'approve' | 'reject') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(action === 'approve'
      ? `選択した${ids.length}件を承認して統合しますか？（複数チャンプ記事は自動分解、その他は教本・レーンガイドへ自動分配されます）`
      : `選択した${ids.length}件を却下して削除しますか？`)) return;
    
    // ⚡ 0秒楽観的消去
    removeFromList(ids);

    if (action === 'reject') {
      const result = await post({ ids, action });
      if (!result.ok) {
        showMessage(`一括却下に失敗しました: ${result.error}`, 'error');
        load({ silent: true });
      }
      return;
    }

    // approve の場合: 複数チャンプ記事は decompose_auto、通常記事は approve
    const multiItems = items.filter((i) => ids.includes(i.id) && i.isMultiChampion && !i.is_atomic);
    const standardIds = ids.filter((id) => !multiItems.some((m) => m.id === id));

    const promises: Promise<any>[] = [];
    if (standardIds.length > 0) {
      promises.push(post({ ids: standardIds, action: 'approve' }));
    }
    for (const m of multiItems) {
      promises.push(post({ id: m.id, action: 'decompose_auto' }));
    }

    const results = await Promise.allSettled(promises);
    const hasError = results.some((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.ok));
    if (hasError) {
      showMessage('一部の記事の統合に失敗しました。最新状態を再読込します', 'error');
      load({ silent: true });
    } else {
      showMessage(`選択した${ids.length}件をすべて教本へ統合しました！${multiItems.length > 0 ? `（うち${multiItems.length}件を自動分解）` : ''}`, 'success');
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
      const rawText = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(rawText);
      } catch {
        throw new Error(`サーバーエラー (${res.status}): ${rawText.slice(0, 150)}`);
      }
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
      const rawText = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(rawText);
      } catch {
        throw new Error(`サーバーエラー (${res.status}): ${rawText.slice(0, 150)}`);
      }
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
          return;
        }
        throw new Error(json.error || '分割知見の保存に失敗しました');
      }
      const parentId = decomposeModalItem.id;
      const count = selectedInsights.length;
      // 親記事を画面の一覧から即座に除外（分解完了扱い）
      removeFromList([parentId]);
      showMessage(json.message || `⚡ 元記事(ID:${parentId})を完了とし、${count}件の知見を教本へ直接統合しました！`, 'success');
      setDecomposeModalItem(null);
      // 未承認一覧の件数再取得
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
      if (previewModalItem || decomposeModalItem || reanalyzeItems || compareItem) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setPreviewModalItem(null);
          setDecomposeModalItem(null);
          setReanalyzeItems(null);
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

      // E: 詳細・修正アコーディオンの開閉トグル
      if (key === 'e') {
        e.preventDefault();
        setExpandedDetails((prev) => toggle(prev, currentItem.id));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, focusedIndex, previewModalItem, decomposeModalItem, reanalyzeItems, compareItem, edits]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <AdminNavHeader
          title="生成記事の承認 ＆ 教本統合"
          subtitle="YouTube解析で抽出された知見を審査し、各チャンピオン辞典およびレーン教本へ統合します。"
          action={
            <Link
              href="/lane-guides"
              target="_blank"
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>レーン攻略バイブル ↗</span>
            </Link>
          }
        />

        {/* メッセージ */}
        {message && (
          <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400' : 'bg-rose-950/30 border-rose-800/60 text-rose-400'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {message.text}
          </div>
        )}

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
                <span className="font-mono bg-zinc-800 px-1 py-0.2 rounded text-amber-300">E</span>
                <span>詳細</span>
              </div>
            </div>

            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => batch('approve')} disabled={busy} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 選択分を一括承認（複数チャンプ自動分解連動）
                </button>
                <button
                  onClick={startBatchReanalysis}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg bg-amber-600/30 border border-amber-500/60 hover:bg-amber-600/50 text-amber-200 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="選択した記事のうち、YouTube動画の記事をまとめて再解析します"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> 選択分を一括再解析
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
              isDetailsOpen={expandedDetails.has(item.id)}
              isSelected={selected.has(item.id)}
              isFocused={focusedIndex === idx}
              channel={channel}
              busy={busy}
              onCardClick={() => setFocusedIndex(idx)}
              onToggleSelect={() => setSelected((s) => toggle(s, item.id))}
              onToggleExpand={() => setExpanded((s) => toggle(s, item.id))}
              onToggleDetails={() => setExpandedDetails((s) => toggle(s, item.id))}
              setChannel={setChannel}
              onEdit={(patch) => updateEditField(item.id, patch)}
              onApprove={() => approveOne(item)}
              onPreview={() => openPreview(item)}
              onReject={() => rejectOne(item)}
              onDecompose={() => openDecompose(item)}
              onReanalyze={() => setReanalyzeItems([item])}
              onCompare={() => setCompareItem(item)}
              onDiscardReanalysis={() => discardReanalysis(item)}
              onReload={() => load({ silent: true })}
              processingAction={processingMap[item.id] || null}
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
        {reanalyzeItems && reanalyzeItems.length > 0 && (
          <ReanalyzeModal
            items={reanalyzeItems}
            busy={busy}
            onClose={() => setReanalyzeItems(null)}
            onSubmit={(req) => requestReanalysis(reanalyzeItems, req)}
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
            onReanalyzeAgain={() => { setReanalyzeItems([compareItem]); setCompareItem(null); }}
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
