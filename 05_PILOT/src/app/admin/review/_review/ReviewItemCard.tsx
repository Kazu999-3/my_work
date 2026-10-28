'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  XCircle,
  ExternalLink,
  Eye,
  Compass,
  BookOpen,
  Dna,
  Tv,
  Scissors,
  Swords,
  RotateCcw,
  Loader2,
  Undo2,
  AlertTriangle,
  Lightbulb,
  Zap,
  ListPlus,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from 'lucide-react';
import { LANE_OPTIONS, type ItemEditState, type LaneKey, type ReviewItem } from './types';
import { extractArticleSummary, stripArticleChrome } from '@/lib/articleDensity';
import { detectChampionsFromText } from '@/lib/championDetector';

// 承認待ちの記事カード（スリムアコーディオン設計：デフォルト150px、詳細トグルで事実・本文・編集フォームを展開）
// 2026-10-28: 一覧のスクロール負荷激減・1画面3〜4枚表示・爆速判断（Eキーで詳細開閉）に対応
export default function ReviewItemCard({
  item,
  edit,
  isOpen,
  isSelected,
  isFocused,
  channel,
  busy,
  isDetailsOpen = false,
  onToggleSelect,
  onToggleExpand,
  onToggleDetails,
  setChannel,
  onEdit,
  onApprove,
  onPreview,
  onReject,
  onDecompose,
  onReanalyze,
  onCompare,
  onDiscardReanalysis,
  onReload,
  onCardClick,
  processingAction,
}: {
  item: ReviewItem;
  edit: ItemEditState;
  isOpen: boolean;
  isSelected: boolean;
  isFocused?: boolean;
  channel: string;
  busy: boolean;
  isDetailsOpen?: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onToggleDetails?: () => void;
  setChannel: (v: string) => void;
  onEdit: (patch: Partial<ItemEditState>) => void;
  onApprove?: () => void;
  onPreview: () => void;
  onReject: () => void;
  onDecompose?: () => void;
  onReanalyze?: () => void;
  onCompare?: () => void;
  onDiscardReanalysis?: () => void;
  onReload?: () => void;
  onCardClick?: () => void;
  processingAction?: 'approving' | 'rejecting' | null;
}) {
  const isDraft = item.reanalysis_of != null;
  const task = item.reanalysisTask;
  const taskActive = task && (task.status === 'pending' || task.status === 'running');
  const canReanalyze = !!onReanalyze && !item.is_atomic && /youtu/.test(item.source_url || '') && !taskActive;
  const thin = item.density?.level === 'thin';
  const factCount = item.analysis_meta?.fact_count;
  const summary = useMemo(() => extractArticleSummary(item.content), [item.content]);
  const cleanBody = useMemo(() => stripArticleChrome(item.content), [item.content]);
  const detected = useMemo(() => detectChampionsFromText(item.title, summary), [item.title, summary]);

  // 📺 YouTube動画ID抽出 ＆ プレイリスト（PLPiEXmmDzgcs）連携
  const targetPlaylistId = 'PLPiEXmmDzgcs';
  const youtubeVideoId = useMemo(() => {
    if (!item.source_url) return null;
    const match = item.source_url.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }, [item.source_url]);

  const [isPlaylistAdded, setIsPlaylistAdded] = useState(false);
  const [isPlaylistLoading, setIsPlaylistLoading] = useState(false);

  useEffect(() => {
    if (!youtubeVideoId) return;
    try {
      const saved = localStorage.getItem(`sovereign_pl_${targetPlaylistId}_${youtubeVideoId}`);
      if (saved) setIsPlaylistAdded(true);
    } catch (e) {
      // ignore
    }
  }, [youtubeVideoId]);

  // 1STEP直接追加ハンドラー（画面遷移ゼロ・API直接追加）
  const handleAddToPlaylist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!youtubeVideoId || isPlaylistLoading || isPlaylistAdded) return;
    setIsPlaylistLoading(true);
    try {
      const res = await fetch('/api/youtube/playlist/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: youtubeVideoId, playlistId: targetPlaylistId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'プレイリストへの追加に失敗しました');
        return;
      }
      try {
        localStorage.setItem(`sovereign_pl_${targetPlaylistId}_${youtubeVideoId}`, 'true');
      } catch (_) {}
      setIsPlaylistAdded(true);
    } catch (err: any) {
      alert(`通信エラー: ${err.message}`);
    } finally {
      setIsPlaylistLoading(false);
    }
  };

  return (
    <div
      onClick={onCardClick}
      data-review-card={item.id}
      className={`relative overflow-hidden p-3.5 md:p-4 rounded-2xl border space-y-2.5 transition duration-150 ${
        isFocused
          ? 'ring-2 ring-amber-500/90 border-amber-500/80 bg-zinc-900 shadow-xl shadow-amber-500/10'
          : isSelected
          ? 'border-amber-500/50 bg-amber-950/20'
          : 'border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900/90'
      }`}
    >
      {/* ⏳ 承認・却下実行中の即時オーバーレイ演出 */}
      {processingAction && (
        <div className="absolute inset-0 z-30 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 animate-in fade-in duration-100">
          <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
          <div className="text-xs font-black text-zinc-100 tracking-wide">
            {processingAction === 'approving' ? '⚡ 承認統合を実行中...（教本へ反映中）' : '🗑️ 却下中...（削除しています）'}
          </div>
          <p className="text-[10px] text-zinc-400">完了すると一覧から自動で消去されます</p>
        </div>
      )}

      {/* 1. タイトル ＆ バッジ行 */}
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="mt-1 accent-amber-500 shrink-0 w-4 h-4 cursor-pointer"
          aria-label="選択"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-bold text-white break-words leading-snug">{item.title}</h3>
            {isFocused && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 font-mono tracking-wider animate-pulse">
                FOCUS (A:承認 X:却下 E:詳細)
              </span>
            )}
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                item.is_atomic ? 'text-teal-300 border-teal-800/60 bg-teal-950/40' : 'text-amber-300 border-amber-800/60 bg-amber-950/40'
              }`}
            >
              {item.is_atomic ? '分割知見' : '動画解析'}
            </span>
            {isDraft && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-emerald-300 border-emerald-800/60 bg-emerald-950/40">
                🔁 再解析版{typeof factCount === 'number' ? `（事実 ${factCount}件）` : ''}
              </span>
            )}
            {thin && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-amber-200 border-amber-700/60 bg-amber-950/40"
                title={item.density?.reasons.join('\n')}
              >
                ⚠️ 薄い可能性
              </span>
            )}

            {/* ✂️ 複数チャンピオン対象バッジ */}
            {item.isMultiChampion && (
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded border text-teal-200 border-teal-500/70 bg-teal-950/60 flex items-center gap-1 shadow-sm"
                title={item.multiReason || '複数チャンピオンが検出されました。ナレッジ分解を推奨します'}
              >
                <Scissors className="w-3 h-3 text-teal-400" />
                ✂️ 複数チャンプ ({item.multiReason || '要分解'})
              </span>
            )}

            {/* 🎯 統合先＆対面バッジ */}
            {(() => {
              if (item.isMultiChampion) {
                return (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-teal-300 border-teal-700/60 bg-teal-950/40 flex items-center gap-1">
                    ✂️ 自動分解推奨
                  </span>
                );
              }
              const targetChamp = edit.champion || item.currentChampNamesJa || item.detectedChampionsJa;
              if (targetChamp) {
                return (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-emerald-300 border-emerald-700/60 bg-emerald-950/40 flex items-center gap-1 shadow-sm">
                    🎯 {targetChamp}教本
                  </span>
                );
              }
              return (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-amber-300 border-amber-700/60 bg-amber-950/40 flex items-center gap-1">
                  ❓ 未定（レーン一般）
                </span>
              );
            })()}
            {(edit.enemyChampion || item.enemyChampionJa) && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-rose-300 border-rose-700/60 bg-rose-950/40 flex items-center gap-1 shadow-sm">
                ⚔️ vs {edit.enemyChampion || item.enemyChampionJa}
              </span>
            )}
            {edit.includeLaneGuide && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-blue-300 border-blue-800/60 bg-blue-950/40 flex items-center gap-1">
                🗺️ {edit.lane}
              </span>
            )}
          </div>

          {/* メタ情報行 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
            {item.channel && (
              <button
                type="button"
                onClick={() => setChannel(channel === item.channel ? '' : item.channel)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                  channel === item.channel
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm'
                    : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/80 hover:bg-zinc-700 hover:text-white'
                }`}
                title={channel === item.channel ? 'チャンネル絞り込みを解除' : `「${item.channel}」で絞り込む`}
              >
                <Tv className="w-2.5 h-2.5 text-red-400" />
                {item.channel}
              </button>
            )}

            <span className="text-[11px] text-zinc-400 font-mono">
              📚 {(item.char_count || item.content?.length || 0).toLocaleString()}文字
            </span>

            <span>{new Date(item.created_at).toLocaleDateString('ja-JP')}</span>
            {item.parentTitle && <span>元: {item.parentTitle}</span>}

            {item.source_url && (
              <div className="inline-flex items-center gap-2">
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 font-medium text-[11px]"
                >
                  <ExternalLink className="w-2.5 h-2.5" /> 元動画
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. 再解析の状態 */}
      {(taskActive || task?.status === 'failed' || (thin && !isDraft) || isDraft) && (
        <div className="space-y-1">
          {taskActive && (
            <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-800/50 text-[11px] text-amber-200 flex flex-wrap items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              再解析中（{task!.status === 'pending' ? '順番待ち' : '解析中'}・
              {new Date(task!.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 依頼）。
              {onReload && (
                <button type="button" onClick={onReload} className="underline cursor-pointer">
                  最新を読込
                </button>
              )}
            </div>
          )}
          {task?.status === 'failed' && (
            <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-800/60 text-[11px] text-rose-300 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="break-words">再解析に失敗: {(task.error || '理由不明').split('\n')[0].slice(0, 150)}</span>
            </div>
          )}
          {thin && !isDraft && item.density && item.density.reasons.length > 0 && (
            <p className="text-[11px] text-amber-200/80">⚠️ {item.density.reasons.join(' ／ ')}</p>
          )}
          {isDraft && (
            <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/60 text-[11px] text-emerald-200 flex flex-wrap items-center gap-2">
              <span>元の記事 #{item.reanalysis_of} を作り直した版です。</span>
              {onCompare && (
                <button
                  type="button"
                  onClick={onCompare}
                  className="px-2 py-0.5 rounded-md bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold cursor-pointer text-[10px]"
                >
                  🆚 元の記事と比べる
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. 💡 核心要約（実戦ポイント直出し・目視判断を爆速化） */}
      {summary && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-0.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300">
            <Lightbulb className="w-3 h-3 text-amber-400 shrink-0" />
            <span>💡 核心要約（実戦ポイント）</span>
          </div>
          <p className="text-xs text-amber-100/95 leading-relaxed font-medium line-clamp-2">
            {summary}
          </p>
        </div>
      )}

      {/* 4. アコーディオン展開部（詳細・事実・本文・編集フォーム） */}
      {isDetailsOpen && (
        <div className="pt-2.5 pb-1 border-t border-zinc-800 space-y-3 animate-in fade-in duration-150">
          {/* 字幕から取れた事実 */}
          {Array.isArray(item.analysis_meta?.facts) && item.analysis_meta!.facts!.length > 0 && (
            <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1">
              <div className="text-[11px] font-bold text-zinc-400">
                🧾 字幕から取れた事実（{item.analysis_meta!.facts!.length}件）
              </div>
              <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {item.analysis_meta!.facts!.map((f, i) => {
                  const sec = f.ts ? f.ts.split(':').reduce((acc, v) => acc * 60 + Number(v), 0) : null;
                  const href =
                    sec !== null && item.source_url
                      ? `${item.source_url}${item.source_url.includes('?') ? '&' : '?'}t=${sec}s`
                      : null;
                  return (
                    <li key={i} className="text-[11px] text-zinc-300 leading-relaxed">
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="font-mono text-amber-400 hover:underline mr-1.5">
                          [{f.ts}]
                        </a>
                      ) : (
                        <span className="font-mono text-zinc-600 mr-1.5">[--:--]</span>
                      )}
                      {f.uncertain && <span className="text-rose-300 mr-1" title="聞き間違いの疑いがある固有名詞を含む">要確認</span>}
                      <span>{f.claim}</span>
                      {f.condition && <span className="text-zinc-500">（{f.condition}）</span>}
                      {f.reason && <span className="text-zinc-400"> ← {f.reason}</span>}
                      {f.numbers && <span className="text-emerald-300/80 ml-1">[{f.numbers}]</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 本文プレビュー / 本文全文 */}
          <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-850 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-bold">
              <span>📝 解析本文</span>
              {item.content.length > 200 && (
                <button
                  type="button"
                  onClick={onToggleExpand}
                  className="text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  {isOpen ? '短くたたむ' : '全文を展開'}
                </button>
              )}
            </div>
            <p className={`text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap ${isOpen ? '' : 'line-clamp-3'}`}>
              {isOpen ? item.content : cleanBody || item.content}
            </p>
          </div>

          {/* インライン編集フォーム */}
          <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
            <div className="text-[11px] font-bold text-zinc-400 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>統合パラメータの手動調整</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* チャンピオン入力欄 */}
              <div className="flex flex-col gap-1 min-w-[170px] flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-zinc-400 font-bold">
                  <span>対象チャンピオン</span>
                  {detected.main && edit.champion.trim() !== detected.main.id && (
                    <button
                      type="button"
                      onClick={() => onEdit({ champion: detected.main!.id })}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/40 text-[9px] font-bold cursor-pointer transition shadow-sm"
                    >
                      <span>🎯 {detected.main.nameJa} 適用</span>
                    </button>
                  )}
                </div>
                <input
                  list="roster-champions"
                  value={edit.champion}
                  onChange={(e) => onEdit({ champion: e.target.value })}
                  placeholder="例: ノクターン, シン・ジャオ"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-750 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* 対面相手入力欄 */}
              <div className="flex flex-col gap-1 min-w-[130px] w-40">
                <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-zinc-400 font-bold">
                  <span>対面相手</span>
                  {detected.enemy && edit.enemyChampion.trim() !== detected.enemy.id && (
                    <button
                      type="button"
                      onClick={() => onEdit({ enemyChampion: detected.enemy!.id })}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-[9px] font-bold cursor-pointer transition shadow-sm"
                    >
                      <span>⚔️ {detected.enemy.nameJa} 適用</span>
                    </button>
                  )}
                </div>
                <input
                  list="roster-champions"
                  value={edit.enemyChampion}
                  onChange={(e) => onEdit({ enemyChampion: e.target.value })}
                  placeholder="例: トリンダメア"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-750 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* レーン選択セレクト */}
              <label className="flex flex-col gap-1 text-[10px] text-zinc-400 font-bold w-32">
                <span>統合先レーン</span>
                <select
                  value={edit.lane}
                  onChange={(e) => onEdit({ lane: e.target.value as LaneKey })}
                  className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-750 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {LANE_OPTIONS.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* トグル群 */}
              <div className="flex items-center gap-3 pt-3">
                <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={edit.includeLaneGuide}
                    onChange={(e) => onEdit({ includeLaneGuide: e.target.checked })}
                    className="accent-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span>🗺️ レーンガイド</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={edit.includeFactMerge}
                    onChange={(e) => onEdit({ includeFactMerge: e.target.checked })}
                    className="accent-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span>🧬 項目マージ</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. 常時表示クイックアクションバー（左: 詳細トグル・プレビュー・プレイリスト・却下 / 右: 即時承認・分解） */}
      <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2.5">
        {/* 左側サブ操作群 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 🛠️ 詳細・修正トグルボタン（Eキー対応） */}
          {onToggleDetails && (
            <button
              type="button"
              onClick={onToggleDetails}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-sm ${
                isDetailsOpen
                  ? 'bg-amber-500/20 border-amber-500/70 text-amber-200'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white'
              }`}
              title="詳細な事実リスト・本文・編集フォームを展開 (E)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>詳細・修正 (E)</span>
              {isDetailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
            </button>
          )}

          {/* プレビューボタン */}
          <button
            type="button"
            onClick={() => onPreview()}
            disabled={busy}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50 transition"
            title="統合先をプレビュー確認してから承認 (P)"
          >
            <Eye className="w-3.5 h-3.5" /> プレビュー
          </button>

          {/* 📺 プレイリスト追加ボタン（1STEP直接追加） */}
          {youtubeVideoId && (
            <button
              type="button"
              onClick={handleAddToPlaylist}
              disabled={isPlaylistLoading}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-sm disabled:opacity-50 ${
                isPlaylistAdded
                  ? 'bg-rose-950/40 border-rose-600/60 text-rose-300'
                  : 'bg-zinc-900 border-zinc-800 hover:border-rose-500/50 text-zinc-300 hover:text-white'
              }`}
              title={
                isPlaylistAdded
                  ? 'YouTubeプレイリスト「PLPiEXmmDzgcs」に追加済み'
                  : 'クリックしてYouTubeプレイリスト「PLPiEXmmDzgcs」に直接追加 (1STEP)'
              }
            >
              {isPlaylistLoading ? (
                <Loader2 className="w-3.5 h-3.5 text-rose-400 animate-spin" />
              ) : (
                <ListPlus className={`w-3.5 h-3.5 ${isPlaylistAdded ? 'text-rose-400' : 'text-rose-500'}`} />
              )}
              <span>{isPlaylistLoading ? '追加中...' : isPlaylistAdded ? 'リスト追加済 ✓' : '➕ プレイリスト'}</span>
            </button>
          )}

          {canReanalyze && (
            <button
              type="button"
              onClick={() => onReanalyze!()}
              disabled={busy}
              className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50 transition ${
                thin
                  ? 'bg-amber-950/40 border-amber-600/60 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title="理由や深掘りしたい観点を付けて再解析"
            >
              <RotateCcw className="w-3 h-3" /> 再解析
            </button>
          )}

          {isDraft && onDiscardReanalysis ? (
            <button
              type="button"
              onClick={() => onDiscardReanalysis()}
              disabled={busy}
              className="px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Undo2 className="w-3 h-3" /> 破棄
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onReject()}
              disabled={busy}
              className="px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-rose-900/60 text-zinc-400 hover:text-rose-400 text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50 transition"
              title="却下 (X)"
            >
              <XCircle className="w-3.5 h-3.5" /> 却下
            </button>
          )}
        </div>

        {/* 右側メイン操作（即時承認 または 分解） */}
        <div className="flex items-center gap-2">
          {item.isMultiChampion && onDecompose && !item.is_atomic ? (
            <>
              <button
                type="button"
                onClick={() => onDecompose()}
                disabled={busy}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-purple-600/60 text-purple-300 hover:text-purple-200 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 transition"
                title="モーダルを開いて各チャンピオンの知見を確認・編集してから統合 (D)"
              >
                <Scissors className="w-3.5 h-3.5 text-purple-400" /> 確認して分解 (D)
              </button>
              {onApprove && (
                <button
                  type="button"
                  onClick={() => onApprove()}
                  disabled={busy}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow-md shadow-purple-950/50"
                  title="確認なしで裏で各チャンピオンに自動分解し、教本へ直接統合 (A)"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" /> ⚡ 自動分解して承認 (A)
                </button>
              )}
            </>
          ) : (
            <>
              {onDecompose && !item.is_atomic && (
                <button
                  type="button"
                  onClick={() => onDecompose()}
                  disabled={busy}
                  className="px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="複数知見に分割 (D)"
                >
                  <Scissors className="w-3.5 h-3.5" /> 分解
                </button>
              )}
              {onApprove && (
                <button
                  type="button"
                  onClick={() => onApprove()}
                  disabled={busy}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-emerald-950/40 transition"
                  title="現在の設定で即座に承認して教本へ統合 (A)"
                >
                  <Zap className="w-3.5 h-3.5" /> ⚡ 即時承認（統合） (A)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
