'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
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
  Crown,
  MoreHorizontal,
  HelpCircle,
} from 'lucide-react';
import { LANE_OPTIONS, type ItemEditState, type LaneKey, type ReviewItem } from './types';
import { estimateFactCategories } from './factRouting';
import { extractArticleSummary, stripArticleChrome } from '@/lib/articleDensity';
import { detectChampionsFromText } from '@/lib/championDetector';
import { calculateFreshness } from '@/lib/patchFreshness';

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
  const freshness = useMemo(() => calculateFreshness(item.title, item.content, item.created_at), [item.title, item.content, item.created_at]);
  const estimatedFactCategories = useMemo(() => {
    return estimateFactCategories(`${item.title} ${item.content || ''}`);
  }, [item.title, item.content]);

  // 📺 YouTube動画ID抽出 ＆ プレイリスト（PLPiEXmmDzgcs）連携
  const targetPlaylistId = 'PLPiEXmmDzgcs';
  const youtubeVideoId = useMemo(() => {
    if (!item.source_url) return null;
    const match = item.source_url.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }, [item.source_url]);

  const [isPlaylistAdded, setIsPlaylistAdded] = useState(false);
  const [isPlaylistLoading, setIsPlaylistLoading] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

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
          ? 'ring-2 ring-amber-400 border-amber-400/90 border-l-4 border-l-amber-400 bg-zinc-900 shadow-xl shadow-amber-500/15'
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
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 font-mono tracking-wider animate-pulse flex items-center gap-1">
                <span>FOCUS</span>
                <span className="opacity-75">[A:承認 X:却下 E:詳細]</span>
              </span>
            )}

            {/* 👑 AI太鼓判バッジ（即承認推奨 / 要確認 / 見送り候補） */}
            {item.density?.triage === 'approve' && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/80 bg-emerald-950/80 text-emerald-300 flex items-center gap-1 shadow-sm">
                <Crown className="w-3 h-3 text-emerald-400" />
                <span>👑 即承認推奨</span>
              </span>
            )}
            {item.density?.triage === 'check' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-600/70 bg-amber-950/70 text-amber-300 flex items-center gap-1">
                <span>👀 要確認</span>
              </span>
            )}
            {item.density?.triage === 'skip' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-600/70 bg-rose-950/70 text-rose-300 flex items-center gap-1">
                <span>⚠️ 見送り候補</span>
              </span>
            )}

            {/* 🕒 パッチ鮮度バッジ（ジョージぱぱ原則） */}
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shadow-sm flex items-center gap-1 ${
                freshness.freshness === 'fresh'
                  ? 'bg-emerald-950/60 border-emerald-600/70 text-emerald-300'
                  : freshness.freshness === 'moderate'
                  ? 'bg-amber-950/60 border-amber-600/70 text-amber-300'
                  : 'bg-rose-950/60 border-rose-600/70 text-rose-300'
              }`}
              title={`公開: ${freshness.publishedAt || '不明'} (${freshness.daysAgo}日前) / 推定パッチ: ${freshness.estimatedPatch}`}
            >
              {freshness.freshness === 'fresh' ? '🔥' : freshness.freshness === 'moderate' ? '⏳' : '⚠️'}
              <span>{freshness.label}</span>
              <span className="opacity-75 font-mono text-[9px]">{freshness.estimatedPatch}</span>
            </span>
            {freshness.isOldPatch && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/60 font-bold flex items-center gap-0.5 shadow-sm">
                <span>⚠️ 旧パッチ</span>
              </span>
            )}
            {/* 動画種別バッジ（控えめなタグ表示） */}
            {item.is_atomic ? (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border text-zinc-400 border-zinc-800 bg-zinc-950/40">
                ✂️ 分割知見
              </span>
            ) : item.isShortVideo ? (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border text-pink-300/80 border-pink-900/40 bg-pink-950/20">
                ⚡ Shorts
              </span>
            ) : (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border text-zinc-400 border-zinc-800 bg-zinc-950/40">
                🎬 通常動画
              </span>
            )}
            {/* 🚀 再解析ステータス（控えめ表示） */}
            {(() => {
              const status = item.reanalysisStatus || (isDraft ? 'reanalyzed' : taskActive ? 'running' : 'unreanalyzed');
              const isShort = item.isShortVideo;

              if (status === 'reanalyzed') {
                if (thin) {
                  return (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded border text-rose-300/90 border-rose-900/50 bg-rose-950/30 flex items-center gap-1"
                      title={isShort
                        ? `【Shorts再解析済】ショート動画ですが事実が抽出できませんでした。\n${item.density?.reasons.join('\n') || ''}`
                        : `【長尺動画・再解析済だが事実少】長尺動画に対して字幕から取れた事実が少なめです。\n${item.density?.reasons.join('\n') || ''}`}
                    >
                      ⚠️ 再解析済({factCount ?? 0}件)
                    </span>
                  );
                }
                return (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border text-emerald-300/90 border-emerald-900/50 bg-emerald-950/30">
                    🔁 再解析済
                  </span>
                );
              }
              if (status === 'running') {
                return (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border text-sky-300/90 border-sky-900/50 bg-sky-950/30 flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    再解析中
                  </span>
                );
              }
              if (status === 'failed') {
                return (
                  <span
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded border text-zinc-400 border-zinc-800 bg-zinc-900/50"
                    title={item.reanalysisTask?.error || '実況音声なし等の理由で再解析が失敗しました'}
                  >
                    ❌ 再解析不可
                  </span>
                );
              }
              return null;
            })()}

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
          </div>

          {/* 🧭 インライン統合ルーティング（教本統合先のみスリム表示） */}
          {(() => {
            const targetChamp = edit.champion || item.currentChampNamesJa || item.detectedChampionsJa;
            return (
              <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-850 text-xs mt-1">
                <span className="font-bold text-zinc-500 text-[10px] flex items-center gap-1">
                  <Compass className="w-3 h-3 text-amber-400" />
                  <span>統合先:</span>
                </span>

                {/* 1. チャンピオン教本 */}
                {item.isMultiChampion ? (
                  <span className="px-2 py-0.5 rounded-md font-bold bg-teal-950/70 border border-teal-500/50 text-teal-300 flex items-center gap-1 text-[11px]">
                    ✂️ 各チャンピオンへ自動分解
                  </span>
                ) : targetChamp ? (
                  <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 flex items-center gap-1 text-[11px]">
                    🎯 {targetChamp}教本
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md font-bold bg-amber-950/60 border border-amber-600/50 text-amber-300 text-[11px]">
                    ❓ レーン共通マクロ
                  </span>
                )}

                {/* 2. 対面DB */}
                {(edit.enemyChampion || item.enemyChampionJa) && (
                  <span className="px-2 py-0.5 rounded-md font-bold bg-rose-950/70 border border-rose-500/50 text-rose-300 flex items-center gap-1 text-[11px]">
                    ⚔️ vs {edit.enemyChampion || item.enemyChampionJa}
                  </span>
                )}

                {/* 3. レーン攻略バイブル */}
                {edit.includeLaneGuide ? (
                  <span className="px-2 py-0.5 rounded-md font-bold bg-blue-950/70 border border-blue-500/50 text-blue-300 flex items-center gap-1 text-[11px]">
                    🗺️ {edit.lane} 攻略バイブル
                  </span>
                ) : null}
              </div>
            );
          })()}

          {/* メタ情報行（文字数・日付のみ常時表示） */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 pt-0.5">
            <span className="font-mono text-zinc-400">
              📚 {(item.char_count || item.content?.length || 0).toLocaleString()}文字
            </span>
            <span>登録: {new Date(item.created_at).toLocaleDateString('ja-JP')}</span>
          </div>
        </div>
      </div>

      {/* 2. 再解析の処理中／エラー表示（進行中のみ表示） */}
      {(taskActive || task?.status === 'failed') && (
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
            (() => {
              const err = task.error || '';
              const isRetryable = err.includes('タイムアウト') || err.includes('時間制限') || err.includes('429') || err.includes('過負荷') || err.includes('利用上限') || err.includes('待機中');
              if (isRetryable) {
                return (
                  <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-800/50 text-[11px] text-amber-200 flex flex-wrap items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>裏の解析キューで待機中（{err.split('\n')[0].slice(0, 100)}）</span>
                    {onReload && (
                      <button type="button" onClick={onReload} className="underline cursor-pointer ml-auto">
                        最新を読込
                      </button>
                    )}
                  </div>
                );
              }
              return (
                <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-800/60 text-[11px] text-rose-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="break-words">再解析に失敗: {(err || '理由不明').split('\n')[0].slice(0, 150)}</span>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* 3. 詳細・修正アコーディオン展開部（実戦エッセンス・辞典マージ・元動画リンク・本文・編集フォーム） */}
      {isDetailsOpen && (
        <div className="pt-2.5 pb-1 border-t border-zinc-800 space-y-3 animate-in fade-in duration-150">
          {/* ソース・チャンネル・元動画・元記事メタ情報バー */}
          <div className="p-2 rounded-xl bg-zinc-950/70 border border-zinc-850 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
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
              {item.parentTitle && <span className="text-[11px] text-zinc-400">元: {item.parentTitle}</span>}
              {isDraft && (
                <span className="text-[11px] text-emerald-300">
                  元記事 #{item.reanalysis_of} の再解析版
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isDraft && onCompare && (
                <button
                  type="button"
                  onClick={onCompare}
                  className="px-2 py-0.5 rounded-md bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold cursor-pointer text-[10px]"
                >
                  🆚 元の記事と比べる
                </button>
              )}
              {item.source_url && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 font-medium text-[11px] bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800"
                >
                  <ExternalLink className="w-2.5 h-2.5" /> 元動画を開く ↗
                </a>
              )}
            </div>
          </div>

          {/* 薄い判定の理由案内（詳細内） */}
          {thin && item.density && item.density.reasons.length > 0 && (
            <div className="p-2 rounded-lg bg-amber-950/25 border border-amber-800/40 text-[11px] text-amber-200/90 flex items-start gap-1.5">
              <span className="shrink-0">{item.isShortVideo ? '⚡' : '⚠️'}</span>
              <span>{item.density.reasons.join(' ／ ')}</span>
            </div>
          )}

          {/* 💡 核心エッセンス要約 ＆ 上位事実箇条書き */}
          {(summary || (item.analysis_meta?.facts && item.analysis_meta.facts.length > 0)) && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>💡 実戦エッセンス（要約）</span>
                </span>
                {item.analysis_meta?.facts && item.analysis_meta.facts.length > 0 && (
                  <span className="text-[9px] font-mono text-amber-400/80">
                    字幕事実 {item.analysis_meta.facts.length}件抽出済
                  </span>
                )}
              </div>

              {item.analysis_meta?.facts && item.analysis_meta.facts.length > 0 ? (
                <ul className="space-y-1 text-xs text-amber-100/95 font-medium">
                  {item.analysis_meta.facts.slice(0, 3).map((f, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-amber-400 font-mono text-[10px] shrink-0 mt-0.5 bg-amber-950/60 px-1 rounded border border-amber-600/40">
                        {f.ts || '•'}
                      </span>
                      <span className="line-clamp-2">
                        {f.claim}
                        {f.numbers && <span className="text-emerald-300 ml-1 font-mono">[{f.numbers}]</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-amber-100/95 leading-relaxed font-medium">
                  {summary}
                </p>
              )}
            </div>
          )}

          {/* 🧬 辞典(facts)マージ推定カテゴリ内訳 */}
          {estimatedFactCategories.length > 0 && (
            <div className="p-2 rounded-xl bg-zinc-950/60 border border-zinc-800 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-zinc-400 font-bold flex items-center gap-1 mr-1">
                <Dna className="w-3 h-3 text-amber-400" />
                <span>辞典マージ対象:</span>
              </span>
              {estimatedFactCategories.map((cat) => (
                <span key={cat.key} className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-900 text-amber-300 border border-zinc-700/80">
                  {cat.label}
                </span>
              ))}
            </div>
          )}

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
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-sm ${
                isDetailsOpen
                  ? 'bg-amber-500/20 border-amber-500/70 text-amber-200'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white'
              }`}
              title="詳細な事実リスト・本文・編集フォームを展開 (E)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>詳細・修正</span>
              <kbd className="px-1 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-[9px] font-mono font-bold text-amber-300">E</kbd>
              {isDetailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
            </button>
          )}

          {/* プレビューボタン */}
          <button
            type="button"
            onClick={() => onPreview()}
            disabled={busy}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
            title="統合先をプレビュー確認してから承認 (P)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>プレビュー</span>
            <kbd className="px-1 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-[9px] font-mono font-bold text-zinc-300">P</kbd>
          </button>

          {/* 却下／破棄ボタン */}
          {isDraft && onDiscardReanalysis ? (
            <button
              type="button"
              onClick={() => onDiscardReanalysis()}
              disabled={busy}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-amber-800/60 text-zinc-400 hover:text-amber-300 text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50 transition"
              title="再解析の破棄: この再解析下書きを取り消し、元の記事に戻します (X)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>破棄</span>
              <kbd className="px-1 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-[9px] font-mono font-bold text-amber-300">X</kbd>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onReject()}
              disabled={busy}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-rose-900/60 text-zinc-400 hover:text-rose-400 text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
              title="却下: この記事を不採用として審査一覧から削除します (X)"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>却下</span>
              <kbd className="px-1 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-[9px] font-mono font-bold text-rose-300">X</kbd>
            </button>
          )}

          {/* ⋯ その他メニュー（低頻度操作：プレイリスト追加・再解析・手動分解） */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className="px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-medium flex items-center gap-1 cursor-pointer transition"
              title="その他の操作（プレイリスト追加・再解析・知見の確認分解）"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              <span>その他</span>
            </button>

            {showMoreMenu && (
              <div className="absolute left-0 bottom-full mb-1.5 z-30 w-52 rounded-xl bg-zinc-900/95 backdrop-blur-md border border-zinc-750 shadow-2xl p-1.5 space-y-1 text-xs animate-in fade-in duration-100">
                {/* 📺 プレイリスト追加 */}
                {youtubeVideoId && (
                  <button
                    type="button"
                    onClick={(e) => {
                      handleAddToPlaylist(e);
                      setShowMoreMenu(false);
                    }}
                    disabled={isPlaylistLoading}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-medium flex items-center gap-2 cursor-pointer transition ${
                      isPlaylistAdded
                        ? 'bg-rose-950/40 text-rose-300'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <ListPlus className={`w-3.5 h-3.5 ${isPlaylistAdded ? 'text-rose-400' : 'text-rose-500'}`} />
                    <span>{isPlaylistLoading ? '追加中...' : isPlaylistAdded ? 'プレイリスト追加済 ✓' : 'プレイリストに追加'}</span>
                  </button>
                )}

                {/* 🔁 再解析 */}
                {canReanalyze && (
                  <button
                    type="button"
                    onClick={() => {
                      onReanalyze!();
                      setShowMoreMenu(false);
                    }}
                    disabled={busy}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-medium flex items-center gap-2 text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer transition disabled:opacity-50"
                    title="字幕からAIで事実・数値を再抽出し直す"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>再解析を依頼</span>
                  </button>
                )}

                {/* ✂️ 確認して分解 */}
                {onDecompose && !item.is_atomic && (
                  <button
                    type="button"
                    onClick={() => {
                      onDecompose();
                      setShowMoreMenu(false);
                    }}
                    disabled={busy}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-medium flex items-center gap-2 text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer transition disabled:opacity-50"
                    title="動画から複数チャンプの知見を取り出して個別に確認統合する (D)"
                  >
                    <Scissors className="w-3.5 h-3.5 text-purple-400" />
                    <span className="flex items-center justify-between flex-1">
                      <span>確認して分解</span>
                      <kbd className="px-1 py-0.2 rounded bg-zinc-800 text-[9px] font-mono font-bold text-purple-300">D</kbd>
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 右側メイン操作（即時承認 または 自動分解） */}
        <div className="flex items-center gap-2">
          {item.isMultiChampion ? (
            onApprove && (
              <button
                type="button"
                onClick={() => onApprove()}
                disabled={busy}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow-md shadow-purple-950/50"
                title="確認なしで裏で各チャンピオンに自動分解し、教本へ直接統合 (A)"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>⚡ 自動分解して承認</span>
                <kbd className="px-1.5 py-0.5 rounded bg-amber-400 text-zinc-950 text-[10px] font-mono font-black shadow-xs">A</kbd>
              </button>
            )
          ) : (
            onApprove && (
              <button
                type="button"
                onClick={() => onApprove()}
                disabled={busy}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md transition active:scale-95 ${
                  item.density?.triage === 'approve'
                    ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-950/60 ring-1 ring-emerald-400/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                }`}
                title="プレビューなしで現在の統合ルートへ即座に教本マージ (A)"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span className="tracking-wide">⚡ 即時承認（教本統合）</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-950/80 border border-emerald-400/50 text-emerald-300 text-[10px] font-mono font-black shadow-xs">A</kbd>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
