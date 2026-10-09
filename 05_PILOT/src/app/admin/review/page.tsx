'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertTriangle, ClipboardCheck, Compass } from 'lucide-react';
import ReviewControlBar from './_review/ReviewControlBar';
import ReviewItemCard from './_review/ReviewItemCard';
import PreviewModal from './_review/PreviewModal';
import DecomposeModal from './_review/DecomposeModal';
import type { DecomposedInsight } from '@/lib/knowledgeDecompose';
import { buildFactOverrides, initialSelections, routedLinesBlock, type RoutedLaneLine } from './_review/factRouting';
import {
  defaultEdit,
  type ItemEditState, type LaneKey, type LineDestination, type PreviewResult, type ReviewItem, type RosterChampion,
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
  const [edits, setEdits] = useState<Record<number, ItemEditState>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (type) qs.set('type', type);
      if (channel) qs.set('channel', channel);
      if (lane && lane !== 'ALL') qs.set('lane', lane);
      if (searchQuery.trim()) qs.set('q', searchQuery.trim());
      if (sort) qs.set('sort', sort);

      const res = await fetch(`/api/knowledge/review?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '取得に失敗しました');

      const loadedItems: ReviewItem[] = json.items || [];
      setItems(loadedItems);
      setTotal(json.total || 0);
      setTotalAll(json.totalAll ?? json.total ?? 0);
      if (json.channels) setChannels(json.channels);
      if (json.laneCounts) setLaneCounts(json.laneCounts);
      if (json.roster?.length) setRoster(json.roster);
      setSelected(new Set());

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
      setEdits(initialEdits);
    } catch (e: any) {
      showMessage(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [type, channel, lane, searchQuery, sort]);

  useEffect(() => { load(); }, [load]);

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
    setItems((prev) => prev.filter((i) => !s.has(i.id)));
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
    if (result.ok) removeFromList(ids);
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
      showMessage(json.message || `${selectedInsights.length}件の分割知見を登録しました`, 'success');
      setDecomposeModalItem(null);
      // 未承認一覧を再読み込み
      load();
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* ヘッダーバー */}
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-amber-400" /> 生成記事の承認 ＆ 完全プレビュー統合
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              動画解析記事を承認します。複数チャンピオン教本への追記・レーンガイドへのマージに加え、
              各項目（強み・弱み・スパイク等）のAI差分マージと編集履歴の完全追従に対応しています。
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
            <Link href="/lane-guides" target="_blank" className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold">
              <Compass className="w-3.5 h-3.5" /> レーン攻略バイブル
            </Link>
            <Link href="/admin/youtube" className="text-xs text-slate-400 hover:text-white">
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

        <ReviewControlBar
          type={type} setType={setType} channel={channel} setChannel={setChannel} channels={channels}
          totalAll={totalAll} total={total} sort={sort} setSort={setSort} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          lane={lane} setLane={setLane} laneCounts={laneCounts} loading={loading} onReload={load}
        />

        {/* 一括操作バー */}
        {items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900/50 rounded-xl border border-slate-800">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-amber-500"
                checked={selected.size === items.length && items.length > 0}
                onChange={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}
              />
              表示中を全選択（{selected.size}/{items.length}）
            </label>
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
          {loading && items.length === 0 && <p className="text-xs text-slate-500 text-center py-10">読み込み中...</p>}
          {!loading && items.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-12 bg-slate-900/40 border border-slate-800 rounded-xl">承認待ちの記事はありません</p>
          )}

          {items.map((item) => (
            <ReviewItemCard
              key={item.id}
              item={item}
              edit={edits[item.id] || defaultEdit(item)}
              isOpen={expanded.has(item.id)}
              isSelected={selected.has(item.id)}
              channel={channel}
              busy={busy}
              onToggleSelect={() => setSelected((s) => toggle(s, item.id))}
              onToggleExpand={() => setExpanded((s) => toggle(s, item.id))}
              setChannel={setChannel}
              onEdit={(patch) => updateEditField(item.id, patch)}
              onPreview={() => openPreview(item)}
              onReject={() => rejectOne(item)}
              onDecompose={() => openDecompose(item)}
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
