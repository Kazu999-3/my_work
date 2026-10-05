'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, XCircle, RefreshCw, ExternalLink, AlertTriangle,
  ClipboardCheck, Eye, Layers, Compass, BookOpen, Edit3, Dna, Sparkles, Check
} from 'lucide-react';

type LaneKey = 'JG' | 'TOP' | 'MID' | 'ADC' | 'SUP' | 'COMMON';

interface ReviewItem {
  id: number;
  title: string;
  content: string;
  champion: string | null;
  currentChampNamesJa?: string;
  is_atomic: boolean;
  source_url: string | null;
  created_at: string;
  parentTitle: string | null;
  isLaneGeneral: boolean;
  tags?: string[];
  detectedLane: LaneKey;
  laneLabel: string;
  isLaneMacro: boolean;
  macroReason: string;
  detectedChampions: string[];
  detectedChampionsJa: string;
}

interface RosterChampion { id: string; name: string }

interface ItemEditState {
  champion: string;
  title: string;
  content: string;
  lane: LaneKey;
  includeLaneGuide: boolean;
  includeFactMerge: boolean;
}

interface FactFieldDiff {
  key: string;
  label: string;
  before: string;
  after: string;
  isChanged: boolean;
}

interface ChampionFactPreview {
  champion: string;
  championNameJa: string;
  diffs: FactFieldDiff[];
  addedHighlights: string[];
  error?: string;
}

interface PreviewResult {
  championPreviews: {
    id: string;
    name: string;
    matchupId: string;
    sectionText: string;
  }[];
  factPreviews?: ChampionFactPreview[];
  laneGuidePreview: {
    lane: LaneKey;
    laneLabel: string;
    sectionText: string;
    /** AI抽出の失敗理由（2026-10-06）。全文の流用はせず、空欄のまま承認すると承認時に再抽出を試みる */
    error?: string | null;
  } | null;
}

const LANE_OPTIONS: { key: LaneKey; label: string; icon: string }[] = [
  { key: 'COMMON', label: '🌐 共通マクロ', icon: '🌐' },
  { key: 'TOP', label: '⚔️ TOP', icon: '⚔️' },
  { key: 'JG', label: '🌲 JG', icon: '🌲' },
  { key: 'MID', label: '⚡ MID', icon: '⚡' },
  { key: 'ADC', label: '🏹 ADC/BOT', icon: '🏹' },
  { key: 'SUP', label: '🛡️ SUP', icon: '🛡️' },
];

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [roster, setRoster] = useState<RosterChampion[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<'' | 'video' | 'atomic'>('');
  const [edits, setEdits] = useState<Record<number, ItemEditState>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 統合プレビューモーダル用ステート
  const [previewModalItem, setPreviewModalItem] = useState<ReviewItem | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTab, setPreviewTab] = useState<'facts' | 'strategy' | 'lane'>('strategy');
  const [editedLaneSectionText, setEditedLaneSectionText] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);

  const showMessage = (text: string, t: 'success' | 'error') => {
    setMessage({ text, type: t });
    setTimeout(() => setMessage(null), 7000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (type) qs.set('type', type);
      const res = await fetch(`/api/knowledge/review?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '取得に失敗しました');

      const loadedItems: ReviewItem[] = json.items || [];
      setItems(loadedItems);
      setTotal(json.total || 0);
      if (json.roster?.length) setRoster(json.roster);
      setSelected(new Set());

      // 各アイテムの初期編集ステートを自動判定値から構築
      const initialEdits: Record<number, ItemEditState> = {};
      for (const item of loadedItems) {
        initialEdits[item.id] = {
          champion: item.currentChampNamesJa || item.detectedChampionsJa || (item.isLaneGeneral ? '' : item.champion || ''),
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
  }, [type]);

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

    const edit = edits[item.id] || {
      champion: item.currentChampNamesJa || '',
      title: item.title,
      content: item.content,
      lane: item.detectedLane,
      includeLaneGuide: item.isLaneMacro,
      includeFactMerge: true,
    };

    const payload = {
      id: item.id,
      action: 'approve',
      champion: edit.champion,
      title: edit.title,
      content: edit.content,
      lane: edit.lane,
      includeLaneGuide: edit.includeLaneGuide,
      includeFactMerge: edit.includeFactMerge,
      customLaneSectionText: (previewModalItem?.id === item.id && editedLaneSectionText) ? editedLaneSectionText : undefined,
    };

    const result = await post(payload);
    if (result.ok) {
      removeFromList([item.id]);
      if (previewModalItem?.id === item.id) {
        setPreviewModalItem(null);
      }
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
      if (previewModalItem?.id === item.id) {
        setPreviewModalItem(null);
      }
    }
  };

  // 一括承認・却下
  const batch = async (action: 'approve' | 'reject') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(action === 'approve'
      ? `選択した${ids.length}件を承認して統合しますか？（AIが判定した複数チャンプ・レーンガイド・各項目へ自動分配されます）`
      : `選択した${ids.length}件を却下して削除しますか？`)) return;
    if (await post({ ids, action })) removeFromList(ids);
  };

  // プレビューの読み込み
  const openPreview = async (item: ReviewItem) => {
    setPreviewModalItem(item);
    setPreviewLoading(true);
    setPreviewData(null);
    setModalError(null);
    try {
      const edit = edits[item.id] || {
        champion: item.currentChampNamesJa || '',
        title: item.title,
        content: item.content,
        lane: item.detectedLane,
        includeLaneGuide: item.isLaneMacro,
        includeFactMerge: true,
      };

      const res = await fetch('/api/knowledge/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          title: edit.title,
          content: edit.content,
          champion: edit.champion,
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

      // 初期タブの決定（教本優先、無ければレーン）
      if (json.championPreviews?.length > 0) {
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

  const updateEditField = (id: number, patch: Partial<ItemEditState>) => {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {
          champion: '',
          title: '',
          content: '',
          lane: 'COMMON',
          includeLaneGuide: false,
          includeFactMerge: true,
        }),
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
          <div className="flex items-center gap-3">
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

        {/* コントロールバー */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {([['', 'すべて'], ['video', '動画解析の記事'], ['atomic', '分割知見']] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setType(k)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                  type === k ? 'bg-amber-500/10 border-amber-500/60 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {l}
              </button>
            ))}
            <span className="text-xs text-slate-400">承認待ち <b className="text-amber-300 font-mono">{total}</b>件</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={load} disabled={loading} className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-1 cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 最新に更新
            </button>
          </div>
        </div>

        {/* 一括操作バー */}
        {items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900/50 rounded-xl border border-slate-800">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-amber-500"
                checked={selected.size === items.length}
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

          {items.map((item) => {
            const edit = edits[item.id] || {
              champion: item.currentChampNamesJa || '',
              title: item.title,
              content: item.content,
              lane: item.detectedLane,
              includeLaneGuide: item.isLaneMacro,
              includeFactMerge: true,
            };
            const isOpen = expanded.has(item.id);

            return (
              <div
                key={item.id}
                className={`p-4 md:p-5 rounded-2xl border space-y-3 transition ${
                  selected.has(item.id) ? 'bg-amber-500/5 border-amber-500/40' : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                {/* タイトル ＆ メタデータ行 */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => setSelected((s) => toggle(s, item.id))}
                    className="mt-1 accent-amber-500 shrink-0"
                    aria-label="選択"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white break-words">{item.title}</h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        item.is_atomic ? 'text-teal-300 border-teal-800/60 bg-teal-950/40' : 'text-amber-300 border-amber-800/60 bg-amber-950/40'
                      }`}>
                        {item.is_atomic ? '分割知見' : '動画解析'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      <span>{new Date(item.created_at).toLocaleDateString('ja-JP')} 生成</span>
                      {item.parentTitle && <span>元記事: {item.parentTitle}</span>}
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 font-medium">
                          <ExternalLink className="w-3 h-3" /> 元動画
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* 🤖 自動判定＆統合先プレビューバッジ */}
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">統合予定:</span>
                    {/* チャンピオン教本バッジ */}
                    {edit.champion.trim() ? (
                      <span className="px-2 py-0.5 rounded-md bg-blue-950/60 border border-blue-800/70 text-blue-300 text-[11px] font-bold flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> 教本: {edit.champion}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 text-[11px]">
                        教本: なし（一般論）
                      </span>
                    )}

                    {/* レーンガイドバッジ */}
                    {edit.includeLaneGuide ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800/70 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                        <Compass className="w-3 h-3" /> レーンガイド: {edit.lane}（第8章）
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-500 text-[11px]">
                        レーンガイド: なし
                      </span>
                    )}

                    {/* 各項目マージバッジ */}
                    {edit.champion.trim() && edit.includeFactMerge && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-800/70 text-purple-300 text-[11px] font-bold flex items-center gap-1">
                        <Dna className="w-3 h-3" /> 項目マージ: ON
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => openPreview(item)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-bold flex items-center gap-1 border border-amber-500/30 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> 統合プレビュー＆修正
                  </button>
                </div>

                {/* 本文プレビュー */}
                <p className={`text-xs text-slate-300 leading-relaxed whitespace-pre-wrap ${isOpen ? '' : 'line-clamp-4'}`}>
                  {item.content}
                </p>
                {item.content.length > 250 && (
                  <button onClick={() => setExpanded((s) => toggle(s, item.id))} className="text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer">
                    {isOpen ? '折りたたむ' : '本文全文を表示'}
                  </button>
                )}

                {/* 🛠️ インライン編集＆承認コントローラー */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 flex-1">
                    {/* チャンピオン入力欄 */}
                    <label className="flex flex-col gap-1 text-[10px] text-slate-400 font-bold min-w-[200px] flex-1">
                      <span>対象チャンピオン（カンマ区切りで複数可 / 空欄＝一般論）</span>
                      <input
                        list="roster-champions"
                        value={edit.champion}
                        onChange={(e) => updateEditField(item.id, { champion: e.target.value })}
                        placeholder="例: ノクターン, シン・ジャオ"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </label>

                    {/* レーン選択セレクト */}
                    <label className="flex flex-col gap-1 text-[10px] text-slate-400 font-bold w-36">
                      <span>統合先レーン</span>
                      <select
                        value={edit.lane}
                        onChange={(e) => updateEditField(item.id, { lane: e.target.value as LaneKey })}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        {LANE_OPTIONS.map((l) => (
                          <option key={l.key} value={l.key}>{l.label}</option>
                        ))}
                      </select>
                    </label>

                    {/* トグル群 */}
                    <div className="flex items-center gap-3 pt-4">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={edit.includeLaneGuide}
                          onChange={(e) => updateEditField(item.id, { includeLaneGuide: e.target.checked })}
                          className="accent-amber-500 w-4 h-4"
                        />
                        <span>🗺️ レーンガイド</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={edit.includeFactMerge}
                          onChange={(e) => updateEditField(item.id, { includeFactMerge: e.target.checked })}
                          className="accent-amber-500 w-4 h-4"
                        />
                        <span>🧬 項目マージ</span>
                      </label>
                    </div>
                  </div>

                  {/* アクションボタン */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => rejectOne(item)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/30 border border-rose-800/60 text-rose-400 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> 却下
                    </button>
                    <button
                      onClick={() => openPreview(item)}
                      disabled={busy}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                      title="統合先をプレビュー確認してから承認を実行します"
                    >
                      <Eye className="w-3.5 h-3.5" /> プレビューして承認統合
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 👁️ 統合先プレビュー＆修正モーダル */}
        {previewModalItem && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
            <div className="bg-[#141418] border border-zinc-700/80 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
              {/* モーダルヘッダー */}
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-amber-400" />
                  <div>
                    <h2 className="text-sm font-black text-white">実際の統合文面プレビュー ＆ 内容の修正</h2>
                    <p className="text-[11px] text-zinc-400">
                      実際に各データベースに書き込まれる完全な文面です。確認・手直しの上で承認統合を実行できます。
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewModalItem(null)}
                  className="text-zinc-400 hover:text-white text-sm font-bold p-1 cursor-pointer"
                >
                  ✕ 閉じる
                </button>
              </div>

              {/* モーダルコンテンツ */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
                {modalError && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs flex items-start gap-2 shadow-sm animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-rose-300 font-bold">承認・統合エラー</strong>
                      <span>{modalError}</span>
                    </div>
                  </div>
                )}

                {previewLoading ? (
                  <div className="py-20 text-center text-amber-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>AIによる各項目マージと統合文面を生成中...</span>
                  </div>
                ) : (
                  <>
                    {/* タイトル・本文の微調整フォーム */}
                    <div className="space-y-3 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                        <Edit3 className="w-3.5 h-3.5" /> 記事情報の調整（統合前に修正できます）
                      </span>
                      <label className="block space-y-1">
                        <span className="text-[10px] text-zinc-400 font-bold">記事タイトル</span>
                        <input
                          type="text"
                          value={edits[previewModalItem.id]?.title || ''}
                          onChange={(e) => updateEditField(previewModalItem.id, { title: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                        />
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="block space-y-1">
                          <span className="text-[10px] text-zinc-400 font-bold">対象チャンピオン（カンマ区切り）</span>
                          <input
                            list="roster-champions"
                            value={edits[previewModalItem.id]?.champion || ''}
                            onChange={(e) => updateEditField(previewModalItem.id, { champion: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] text-zinc-400 font-bold">統合先レーン</span>
                          <select
                            value={edits[previewModalItem.id]?.lane || 'COMMON'}
                            onChange={(e) => updateEditField(previewModalItem.id, { lane: e.target.value as LaneKey })}
                            className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                          >
                            {LANE_OPTIONS.map((l) => (
                              <option key={l.key} value={l.key}>{l.label}</option>
                            ))}
                          </select>
                        </label>
                        <div className="flex items-center gap-3 pt-3">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={edits[previewModalItem.id]?.includeLaneGuide || false}
                              onChange={(e) => updateEditField(previewModalItem.id, { includeLaneGuide: e.target.checked })}
                              className="accent-amber-500 w-4 h-4"
                            />
                            <span>レーンガイド</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={edits[previewModalItem.id]?.includeFactMerge ?? true}
                              onChange={(e) => updateEditField(previewModalItem.id, { includeFactMerge: e.target.checked })}
                              className="accent-amber-500 w-4 h-4"
                            />
                            <span>項目マージ</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => openPreview(previewModalItem)}
                          className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold cursor-pointer"
                        >
                          プレビューを再計算
                        </button>
                      </div>
                    </div>

                    {/* プレビュー表示タブバー */}
                    <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                      <button
                        onClick={() => setPreviewTab('strategy')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          previewTab === 'strategy'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-white bg-zinc-900'
                        }`}
                      >
                        <BookOpen size={13} />
                        <span>📖 チャンピオン教本プレビュー</span>
                        <span className="text-[10px] opacity-80">({previewData?.championPreviews?.length || 0}体)</span>
                      </button>

                      {edits[previewModalItem.id]?.includeFactMerge && (
                        <button
                          onClick={() => setPreviewTab('facts')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            previewTab === 'facts'
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'text-zinc-400 hover:text-white bg-zinc-900'
                          }`}
                        >
                          <Dna size={13} />
                          <span>🧬 各項目マージ差分プレビュー</span>
                          <span className="text-[10px] opacity-80">({previewData?.factPreviews?.length || 0}体)</span>
                        </button>
                      )}

                      <button
                        onClick={() => setPreviewTab('lane')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          previewTab === 'lane'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-white bg-zinc-900'
                        }`}
                      >
                        <Compass size={13} />
                        <span>🗺️ レーンガイドプレビュー</span>
                        {previewData?.laneGuidePreview && <span className="text-[10px] opacity-80">(ON)</span>}
                      </button>
                    </div>

                    {/* 1. チャンピオン教本プレビュー */}
                    {previewTab === 'strategy' && (
                      <div className="space-y-3">
                        <div className="text-[11px] text-zinc-400">
                          マスター教本（`matchup_sentinel`）の末尾に、以下の節見出しとともに追記されます。
                        </div>
                        {previewData?.championPreviews && previewData.championPreviews.length > 0 ? (
                          previewData.championPreviews.map((cp) => (
                            <div key={cp.id} className="p-4 rounded-xl bg-zinc-950 border border-blue-900/50 space-y-2">
                              <div className="flex items-center justify-between text-xs text-blue-300 font-bold border-b border-zinc-800 pb-2">
                                <span className="flex items-center gap-1.5">
                                  <BookOpen size={14} />
                                  <span>対象: {cp.name}（ID: {cp.id}）</span>
                                </span>
                                <span className="font-mono text-[10px] text-zinc-500">{cp.matchupId}</span>
                              </div>
                              <div className="p-3 bg-[#111115] rounded-lg border border-zinc-800/80 max-h-72 overflow-y-auto font-sans leading-relaxed text-zinc-200 text-xs whitespace-pre-wrap select-text">
                                {cp.sectionText}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="p-4 rounded-xl bg-zinc-950 text-zinc-500 text-xs border border-zinc-800">
                            対象チャンピオンが指定されていないため、チャンピオン教本への追記は行われません（ライブラリに残ります）。
                          </p>
                        )}
                      </div>
                    )}

                    {/* 2. 各項目マージ差分プレビュー */}
                    {previewTab === 'facts' && (
                      <div className="space-y-3">
                        <div className="text-[11px] text-zinc-400">
                          AI（Gemini）が記事から抽出した「強み・弱み・スパイク等」の新知見です。既存記述を残したまま安全に追記マージされます。
                        </div>
                        {previewData?.factPreviews && previewData.factPreviews.length > 0 ? (
                          previewData.factPreviews.map((fp) => (
                            <div key={fp.champion} className="p-4 rounded-xl bg-zinc-950 border border-purple-900/50 space-y-3">
                              <div className="flex items-center justify-between text-xs text-purple-300 font-bold border-b border-zinc-800 pb-2">
                                <span className="flex items-center gap-1.5">
                                  <Dna size={14} />
                                  <span>{fp.championNameJa}（{fp.champion}）の各項目マージ予定</span>
                                </span>
                              </div>

                              {/* AI生成の失敗（設定漏れ等）は知見と混ぜずにエラーとして出す */}
                              {fp.error && (
                                <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/60 text-[11px] text-rose-400">
                                  <span className="font-bold">AIによる項目マージ案を作れませんでした。既存の内容は変更されません。</span>
                                  <span className="block text-rose-300/80 mt-0.5">理由: {fp.error}</span>
                                </div>
                              )}

                              {/* ハイライト */}
                              {fp.addedHighlights.length > 0 && (
                                <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-800/40 text-[11px] text-purple-200 space-y-1">
                                  <span className="font-bold flex items-center gap-1 text-purple-300">
                                    <Sparkles size={12} /> 今回新たに追記される知見:
                                  </span>
                                  <ul className="list-disc list-inside space-y-0.5 pl-1 text-zinc-300">
                                    {fp.addedHighlights.map((h, i) => <li key={i}>{h}</li>)}
                                  </ul>
                                </div>
                              )}

                              {/* 各フィールド差分 */}
                              <div className="space-y-2">
                                {fp.diffs.map((diff) => (
                                  <div key={diff.key} className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-amber-300 text-[11px]">{diff.label}</span>
                                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                        diff.isChanged ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-zinc-500'
                                      }`}>
                                        {diff.isChanged ? '更新あり' : '変更なし（既存維持）'}
                                      </span>
                                    </div>
                                    <div className="p-2 rounded bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto font-sans">
                                      {diff.after}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="p-4 rounded-xl bg-zinc-950 text-zinc-500 text-xs border border-zinc-800">
                            対象チャンピオンが指定されていないか、項目マージがオフになっています。
                          </p>
                        )}
                      </div>
                    )}

                    {/* 3. レーンガイドプレビュー */}
                    {previewTab === 'lane' && (
                      <div className="space-y-3">
                        <div className="text-[11px] text-zinc-400">
                          AI（Gemini）が記事から抽出した本質的なマクロ・立ち回り知見です。攻略バイブル（`lane_guides`）の第8章に追記されます。必要に応じて文面を直接編集してから承認できます。
                        </div>
                        {previewData?.laneGuidePreview ? (
                          <div className="p-4 rounded-xl bg-zinc-950 border border-emerald-900/50 space-y-3">
                            <div className="flex items-center justify-between text-xs text-emerald-300 font-bold border-b border-zinc-800 pb-2">
                              <span className="flex items-center gap-1.5">
                                <Compass size={14} />
                                <span>統合先: {previewData.laneGuidePreview.laneLabel}</span>
                              </span>
                              <span className="text-[10px] text-zinc-400">✏️ この文面を直接手直し可能</span>
                            </div>
                            {previewData.laneGuidePreview.error && (
                              <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/60 text-[11px] text-rose-400">
                                <span className="font-bold">AIによる知見の抽出に失敗しました。記事の全文は統合しません。</span>
                                <span className="block text-rose-300/80 mt-0.5">理由: {previewData.laneGuidePreview.error}</span>
                                <span className="block text-zinc-400 mt-0.5">少し待ってプレビューを開き直すか、下の欄に統合したい文面を書いてから承認してください（空欄のまま承認すると、承認時にもう一度AI抽出を試み、失敗したらエラーを表示します）。</span>
                              </div>
                            )}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-400">統合するマクロ知見（Markdown形式で編集可能）</label>
                              <textarea
                                value={editedLaneSectionText}
                                onChange={(e) => setEditedLaneSectionText(e.target.value)}
                                rows={12}
                                className="w-full p-3 bg-[#111115] rounded-lg border border-zinc-800 text-zinc-200 text-xs font-mono leading-relaxed focus:border-emerald-500 focus:outline-none resize-y"
                                placeholder="レーンガイドに統合する知見文面..."
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="p-4 rounded-xl bg-zinc-950 text-zinc-500 text-xs border border-zinc-800">
                            「レーンガイドへも統合」がオフのため、レーンガイドへの追記は行われません。
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* モーダルフッター */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between gap-3">
                <button
                  onClick={() => setPreviewModalItem(null)}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer transition disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => previewModalItem && approveOne(previewModalItem)}
                  disabled={busy || previewLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition"
                >
                  {busy ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                      <span>二系統統合 ＆ AI差分マージを実行中...</span>
                    </>
                  ) : previewLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                      <span>プレビュー生成中...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>この完全な文面で承認して統合を実行</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
