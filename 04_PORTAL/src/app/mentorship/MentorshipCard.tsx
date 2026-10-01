'use client';

import React, { useState, useEffect } from 'react';
import { toast } from '../../components/Toaster';
import { MentorshipProfile } from '../api/mentorship/profiles/route';
import { getRankBadgeStyle } from '../../lib/mmr';
import { CHAMPION_JA } from '../../components/ChampSelect';
import { getChampIcon } from '../../lib/ddragonClient';
import { Clock, MessageSquare, Send, Sparkles, Trash2, Zap, X, ChevronDown, ChevronUp } from 'lucide-react';
import { MentorshipReviewSummary } from '../api/mentorship/reviews/route';
import { MENTORSHIP_DURATIONS } from '../../lib/mentorshipConstants';

export interface MentorshipComment {
  id: string;
  profile_id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string | null;
  content: string;
  created_at: string;
}

interface MentorshipCardProps {
  profile: MentorshipProfile;
  isMine: boolean;
  isAdmin?: boolean;
  currentUserId?: string | null;
  currentUserName?: string | null;
  reviewSummary?: MentorshipReviewSummary | null;
  onOffer: (profile: MentorshipProfile) => void;
  onEdit?: (profile: MentorshipProfile) => void;
  onDelete?: (profileId: string) => void;
  matchScore?: number;
  matchReason?: string;
  isPendingSent?: boolean;
}

const LANE_ICONS: Record<string, string> = {
  TOP: '🛡️ TOP',
  JUNGLE: '🌲 JG',
  MID: '⚡ MID',
  BOT: '🏹 BOT',
  SUPPORT: '💖 SUP',
};

export function MentorshipCard({
  profile,
  isMine,
  isAdmin,
  currentUserId,
  currentUserName,
  reviewSummary,
  onOffer,
  onEdit,
  onDelete,
  matchScore,
  matchReason,
  isPendingSent,
}: MentorshipCardProps) {
  const isMentor = profile.role_type === 'MENTOR';
  const rankBadge = getRankBadgeStyle(profile.current_rank);


  // コメント機能用のステート
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<MentorshipComment[]>([]);
  const [commentsCount, setCommentsCount] = useState<number>(0);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  // ライトコース（1試合、リプレイ、3日間）判定
  const preferredDuration = (profile as any).preferred_duration;
  const is1Match = preferredDuration === '1_MATCH' || profile.tags?.some(t => t.includes('1試合') || t.includes('カスタム') || t.includes('単発'));
  const isReplay = preferredDuration === 'REPLAY' || profile.tags?.some(t => t.includes('リプレイ') || t.includes('添削'));
  const is3Days = preferredDuration === '3_DAYS' || profile.tags?.some(t => t.includes('3日') || t.includes('お試し'));
  const isLightCourse = is1Match || isReplay || is3Days;

  // コメント一覧の取得
  const loadComments = async () => {
    setIsLoadingComments(true);
    try {
      const res = await fetch(`/api/mentorship/comments?profileId=${profile.id}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
        setCommentsCount(data.comments ? data.comments.length : 0);
      }
    } catch (e) {
      console.error('Failed to load comments:', e);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleToggleComments = () => {
    if (!showComments && comments.length === 0) {
      loadComments();
    }
    setShowComments(!showComments);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch('/api/mentorship/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: profile.id,
          content: commentInput.trim(),
        }),
      });

      if (res.ok) {
        setCommentInput('');
        loadComments();
      } else {
        const err = await res.json();
        toast.error(`コメント投稿に失敗しました: ${err.error || '不明なエラー'}`);
      }
    } catch (e) {
      console.error('Failed to post comment:', e);
      toast.error('通信エラーが発生しました');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('このコメントを削除しますか？')) return;
    try {
      const res = await fetch(`/api/mentorship/comments?id=${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        setCommentsCount(prev => Math.max(0, prev - 1));
      } else {
        toast.error('コメント削除に失敗しました');
      }
    } catch (e) {
      console.error('Failed to delete comment:', e);
    }
  };

  return (
    <div className={`relative rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between bg-surface/95 dark:bg-[#2b2d31] dark:border-[#3f4147] backdrop-blur-sm shadow-md ${
      matchScore && matchScore >= 80
        ? 'ring-2 ring-primary-400 shadow-lg scale-[1.01]'
        : ''
    } ${
      isLightCourse
        ? 'border-secondary-edge/60 ring-1 ring-secondary-300/40 hover:border-secondary-edge-strong shadow-secondary-900/5 hover:shadow-xl'
        : isMentor
          ? 'border-primary-edge/40 hover:border-primary-edge-strong shadow-primary-900/5 hover:shadow-lg'
          : 'border-success-edge/40 hover:border-success-edge-strong shadow-success-900/5 hover:shadow-lg'
    }`}>
      {/* 🚀 案1: 1試合・単発・ライトコースのアイキャッチ強調バナー（パッと見でわかるデザイン） */}
      {isLightCourse && (
        <div className="bg-gradient-to-r from-secondary-500 via-secondary-500 to-primary-500 text-white px-3.5 py-1.5 flex items-center justify-between text-xs font-black shadow-inner tracking-tight">
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-primary-300 animate-pulse fill-primary-300" />
            <span>
              {is1Match
                ? '🎮 1試合カスタム完結OK！ 気軽なお試し歓迎'
                : isReplay
                  ? '📺 1試合リプレイ添削！ 気軽にアドバイス'
                  : '☕ 3日間お試しバディ！ 初心者・単発歓迎'}
            </span>
          </div>
          <span className="bg-surface/20 backdrop-blur-xs text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Light Course
          </span>
        </div>
      )}

      {/* AI相性おすすめリボン */}
      {matchScore !== undefined && matchScore > 0 && (
        <div className="bg-gradient-to-r from-primary-500 via-primary-500 to-primary-500 text-stone-950 px-3 py-1 flex items-center justify-between text-[11px] font-black tracking-tight">
          <span className="flex items-center gap-1">
            <Sparkles size={13} className="text-stone-950 animate-bounce" />
            <span>AI相性スコア: <strong>{matchScore}%</strong></span>
          </span>
          {matchReason && <span className="opacity-90 font-bold truncate max-w-[200px]">{matchReason}</span>}
        </div>
      )}

      {/* 上部ヘッダーバッジ */}
      <div className="p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 役職バッジ */}
            <div className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1.5 ${
              isMentor
                ? 'bg-primary-100 dark:bg-primary-950/50 text-primary-900 dark:text-primary-300 border border-primary-edge dark:border-primary-edge-strong'
                : 'bg-success-100 dark:bg-success-950/50 text-success-900 dark:text-success-300 border border-success-edge dark:border-success-edge-strong'
            }`}>
              <span>{isMentor ? '👨‍🏫' : '🔰'}</span>
              <span>{isMentor ? '師匠 (Mentor)' : '弟子 (Pupil)'}</span>
            </div>

            {/* コース希望バッジ */}
            {preferredDuration && MENTORSHIP_DURATIONS[preferredDuration] && (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border shadow-2xs ${
                MENTORSHIP_DURATIONS[preferredDuration].badgeColor || 'bg-surface-subtle dark:bg-[#1e1f22] text-foreground-soft dark:text-stone-200 border-border dark:border-[#3f4147]'
              }`}>
                {MENTORSHIP_DURATIONS[preferredDuration].shortLabel}
              </span>
            )}

            {/* ⭐ 匿名レビュー評価バッジ */}
            {reviewSummary && reviewSummary.totalReviews > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-primary-50 dark:bg-primary-950/40 text-primary-900 dark:text-primary-300 border border-primary-edge dark:border-primary-edge-strong flex items-center gap-1 shadow-2xs">
                <span>⭐ {reviewSummary.averageRating}</span>
                <span className="text-[10px] text-muted-strong font-normal">({reviewSummary.totalReviews}件)</span>
              </span>
            ) : null}

            {/* ステータスバッジ（師匠は受入枠数を表示） */}
            {isMentor ? (
              (profile.active_pupils_count || 0) >= (profile.max_pupils || 3) ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-100 dark:bg-primary-950/50 text-primary-800 dark:text-primary-300 border border-primary-edge-soft dark:border-primary-edge-strong flex items-center gap-1">
                  <span>🈵</span>
                  <span>弟子枠満員 ({profile.active_pupils_count}/{profile.max_pupils || 3}人)</span>
                </span>
              ) : (profile.active_pupils_count || 0) > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success-100 dark:bg-success-950/50 text-success-800 dark:text-success-300 border border-success-edge dark:border-success-edge-strong flex items-center gap-1">
                  <span>👥</span>
                  <span>弟子枠: {profile.active_pupil_names?.length || profile.active_pupils_count}/{profile.max_pupils || 3}人 (空き{(profile.max_pupils || 3) - (profile.active_pupils_count || 0)}枠)</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success-50 dark:bg-success-950/50 text-success-700 dark:text-success-300 border border-success-edge-soft dark:border-success-edge-strong flex items-center gap-1">
                  <span>🟢</span>
                  <span>弟子募集中 (最大{profile.max_pupils || 3}人)</span>
                </span>
              )
            ) : profile.status === 'MATCHED' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-100 dark:bg-primary-950/50 text-primary-800 dark:text-primary-300 border border-primary-edge-soft dark:border-primary-edge-strong">
                🤝 ペア結成中
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-50 dark:bg-success-950/50 text-success-700 dark:text-success-300 border border-success-edge-soft dark:border-success-edge-strong">
                🟢 募集中
              </span>
            )}
          </div>

          {/* 編集・削除ボタン（本人または管理者の場合） */}
          {(isMine || isAdmin) && (
            <div className="flex items-center gap-1 bg-surface-subtle dark:bg-[#1e1f22] p-0.5 rounded-lg border border-border dark:border-[#3f4147]">
              {isMine && onEdit && (
                <button
                  onClick={() => onEdit(profile)}
                  className="px-2 py-1 text-xs text-muted hover:text-foreground dark:hover:text-white hover:bg-surface dark:hover:bg-[#2b2d31] rounded transition cursor-pointer"
                  title="編集"
                >
                  ✏️
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(profile.id)}
                  className="px-2 py-1 text-xs text-danger-600 hover:text-danger-800 hover:bg-danger-50 dark:hover:bg-danger-950/30 rounded transition cursor-pointer flex items-center gap-0.5"
                  title={isAdmin && !isMine ? '管理者権限で削除' : '削除'}
                >
                  <span>🗑️</span>
                  {isAdmin && !isMine && <span className="text-[10px] font-black text-danger-700 dark:text-danger-400">管理</span>}
                </button>
              )}
            </div>
          )}
        </div>

        {/* プレイヤー情報 */}
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-xl font-black shrink-0 shadow-2xs ${
            isLightCourse
              ? 'bg-gradient-to-br from-secondary-100 to-primary-100 border-secondary-edge text-secondary-900'
              : 'bg-gradient-to-br from-primary-100 to-primary-200 border-primary-edge/80 text-primary-900'
          }`}>
            {profile.player_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-foreground dark:text-stone-100 truncate flex items-center gap-2">
              {profile.player_name}
            </h3>
            <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${rankBadge.bg} ${rankBadge.color} border ${rankBadge.border} shadow-2xs`}>
                {profile.current_rank || 'UNRANKED'}
              </span>
              {profile.target_rank && !isMentor && (
                <span className="text-[11px] text-success-700 dark:text-success-300 font-bold bg-success-50 dark:bg-success-950/40 px-1.5 py-0.5 rounded border border-success-edge-soft dark:border-success-edge-strong">
                  ➔ 目標: {profile.target_rank}
                </span>
              )}
              {profile.target_rank && isMentor && (
                <span className="text-[11px] text-primary-800 dark:text-primary-300 font-bold bg-primary-50 dark:bg-primary-950/40 px-1.5 py-0.5 rounded border border-primary-edge-soft dark:border-primary-edge-strong">
                  👥 歓迎: {profile.target_rank}
                </span>
              )}
            </div>

            {/* 師匠が現在指導中の弟子（兄弟弟子）一覧 */}
            {isMentor && profile.active_pupil_names && profile.active_pupil_names.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-muted-strong flex items-center gap-0.5">
                  <span>🤝</span>
                  <span>指導中:</span>
                </span>
                {profile.active_pupil_names.map((name, idx) => (
                  <span
                    key={`${name}-${idx}`}
                    className="text-[10px] font-bold bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-edge-soft dark:border-primary-edge-strong px-1.5 py-0.2 rounded-md"
                  >
                    🌱 {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 🌟 匿名レビュー上位推薦タグ */}
        {reviewSummary && reviewSummary.topTags && reviewSummary.topTags.length > 0 && (
          <div className="p-2.5 bg-primary-50/70 dark:bg-primary-950/20 rounded-2xl border border-primary-edge-soft/80 dark:border-primary-edge-strong/40 space-y-1">
            <div className="text-[10px] font-black text-primary-950 dark:text-primary-200 flex items-center gap-1">
              <span>✨</span>
              <span>バディからの推薦ポイント:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {reviewSummary.topTags.map((t) => (
                <span
                  key={t.tag}
                  className="px-2 py-0.5 rounded-lg bg-surface dark:bg-[#1e1f22] border border-primary-edge dark:border-primary-edge-strong text-[10px] font-bold text-primary-950 dark:text-primary-200 shadow-2xs"
                >
                  {t.tag} <strong className="text-primary-600 dark:text-primary-400">×{t.count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* レーンピル一覧 */}
        {profile.lanes && profile.lanes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {profile.lanes.map((lane) => (
              <span
                key={lane}
                className="px-2.5 py-1 bg-surface-subtle dark:bg-[#1e1f22] border border-border dark:border-[#3f4147] rounded-lg text-xs font-bold text-foreground-subtle dark:text-stone-200"
              >
                {LANE_ICONS[lane] || lane}
              </span>
            ))}
          </div>
        )}

        {/* チャンピオンアイコン一覧 (シンプル化: 最大4体 + getChampIcon) */}
        {profile.champions && profile.champions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[11px] font-bold text-muted-strong shrink-0">
              {isMentor ? '⚔️ 指導可能:' : '🎯 練習中:'}
            </span>
            {profile.champions.slice(0, 4).map((champ) => {
              const champName = champ.trim();
              return (
                <div
                  key={champName}
                  className="flex items-center gap-1 px-2 py-0.5 bg-background dark:bg-[#1e1f22] border border-border/90 dark:border-[#3f4147] rounded-lg text-xs font-bold text-foreground-soft dark:text-stone-200 shadow-2xs"
                >
                  <img
                    src={getChampIcon(champName)}
                    alt={champName}
                    className="w-4 h-4 rounded-md object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span>{CHAMPION_JA[champName]?.ja || champName}</span>
                </div>
              );
            })}
            {profile.champions.length > 4 && (
              <span className="text-[10px] text-muted-strong font-bold bg-surface-subtle px-1.5 py-0.5 rounded-md border border-border">
                +{profile.champions.length - 4}
              </span>
            )}
          </div>
        )}

        {/* タグ一覧（悩み / 得意分野） */}
        {profile.tags && profile.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {profile.tags.map((tag) => (
              <span
                key={tag}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                  tag.includes('1試合') || tag.includes('リプレイ') || tag.includes('お試し')
                    ? 'bg-secondary-50 dark:bg-secondary-950/40 text-secondary-900 dark:text-secondary-300 border-secondary-edge dark:border-secondary-edge-strong font-bold'
                    : isMentor
                      ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-900 dark:text-primary-300 border-primary-edge-soft dark:border-primary-edge-strong'
                      : 'bg-success-50 dark:bg-success-950/40 text-success-900 dark:text-success-300 border-success-edge-soft dark:border-success-edge-strong'
                }`}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 自己紹介文 (シンプル化: 2行折りたたみ) */}
        {profile.bio && (
          <div className="p-3 bg-background/90 dark:bg-[#1e1f22] rounded-2xl border border-border dark:border-[#3f4147] text-xs text-foreground-soft dark:text-stone-100 leading-relaxed font-medium">
            <p className={`whitespace-pre-wrap ${!isBioExpanded ? 'line-clamp-2' : ''}`}>
              {profile.bio}
            </p>
            {profile.bio.length > 80 && (
              <button
                type="button"
                onClick={() => setIsBioExpanded(!isBioExpanded)}
                className="mt-1 text-[11px] text-primary-700 dark:text-primary-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <span>{isBioExpanded ? '閉じる ▲' : '続きを読む ▼'}</span>
              </button>
            )}
          </div>
        )}

        {/* 活動時間帯 */}
        {profile.active_hours && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Clock size={12} className="text-primary-600 dark:text-primary-400" />
            <span className="font-bold text-muted-strong">活動時間:</span>
            <span className="font-semibold text-foreground-soft dark:text-stone-100">{profile.active_hours}</span>
          </div>
        )}
      </div>

      {/* 下部アクションバー (シンプル化: コメントボタン ＋ オファーボタン) */}
      <div className="p-3 bg-background border-t border-border/80 flex items-center justify-between gap-2">
        {/* 💬 コメント開閉ボタン (モーダル起動) */}
        <button
          type="button"
          onClick={handleToggleComments}
          className="px-2.5 py-1.5 rounded-xl bg-surface-subtle hover:bg-surface-hover text-foreground-subtle dark:text-stone-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-border"
        >
          <MessageSquare size={13} className="text-secondary-600 dark:text-secondary-400" />
          <span>コメント</span>
          {commentsCount > 0 && (
            <span className="bg-secondary-100 dark:bg-secondary-950 text-secondary-800 dark:text-secondary-300 text-[10px] px-1.5 py-0.2 rounded-full font-black">
              {commentsCount}
            </span>
          )}
        </button>

        {isMine ? (
          <span className="text-xs text-muted-strong font-bold">（あなたのカード）</span>
        ) : !isMentor && profile.status === 'MATCHED' ? (
          <span className="text-xs text-primary-700 font-bold bg-primary-50 px-2.5 py-1 rounded-xl border border-primary-edge-soft">
            🤝 ペア結成中
          </span>
        ) : isMentor && (profile.active_pupils_count || 0) >= (profile.max_pupils || 3) ? (
          <span className="text-xs text-primary-700 font-bold bg-primary-50 px-2.5 py-1 rounded-xl border border-primary-edge-soft">
            🈵 弟子枠満員 ({profile.max_pupils || 3}人)
          </span>
        ) : isPendingSent ? (
          <span className="text-xs text-primary-800 font-bold bg-primary-50 px-3 py-1.5 rounded-xl border border-primary-edge-soft flex items-center gap-1">
            ⏳ 申請中（返答待ち）
          </span>
        ) : (
          <button
            onClick={() => onOffer(profile)}
            className={`px-4 py-2 rounded-xl font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer ${
              isMentor
                ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-900/20'
                : 'bg-success-600 hover:bg-success-500 text-white shadow-success-900/20'
            }`}
          >
            {isMentor ? '🙋 弟子入りをお願いする' : '🤝 師匠を引き受ける (+300🪙)'}
          </button>
        )}
      </div>

      {/* 💬 コメントモーダル (シンプル化: カード本体から独立) */}
      {showComments && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowComments(false)}
        >
          <div
            className="bg-surface dark:bg-[#2b2d31] border border-border dark:border-[#3f4147] rounded-3xl p-5 max-w-lg w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between border-b border-border/80 dark:border-[#3f4147] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-secondary-600 dark:text-secondary-400" />
                <h3 className="font-black text-sm text-foreground dark:text-white">
                  {profile.player_name} さんへのワンポイント相談・コメント
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowComments(false)}
                className="text-faint hover:text-foreground dark:hover:text-white p-1 rounded-lg hover:bg-surface-subtle transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* コメント一覧 */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[120px]">
              {isLoadingComments ? (
                <div className="text-center py-8 text-xs text-muted-strong font-medium">
                  コメントを読み込み中...
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-strong font-medium">
                  まだコメントはありません。気軽に「このチャンプ教えられます！」「1試合だけやりませんか？」と書き込んでみましょう！
                </div>
              ) : (
                comments.map((comment) => {
                  const isMyComment = currentUserId === comment.author_id;
                  return (
                    <div
                      key={comment.id}
                      className="p-3 rounded-2xl bg-surface-subtle dark:bg-[#1e1f22] border border-border/80 dark:border-[#3f4147] text-xs space-y-1 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-foreground dark:text-white flex items-center gap-1">
                          <span>💬</span>
                          <span>{comment.author_name}</span>
                          {isMyComment && (
                            <span className="text-[9px] bg-primary-100 dark:bg-primary-950 text-primary-800 dark:text-primary-300 px-1.5 py-0.2 rounded font-normal">
                              あなた
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2 text-faint">
                          <span>
                            {new Date(comment.created_at).toLocaleDateString('ja-JP', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {(isMyComment || isAdmin) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-danger-500 hover:text-danger-700 p-0.5 cursor-pointer"
                              title="コメントを削除"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-foreground-soft dark:text-stone-200 leading-relaxed whitespace-pre-wrap font-medium">
                        {comment.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* コメント投稿フォーム */}
            <form onSubmit={handlePostComment} className="flex gap-2 pt-2 border-t border-border/80 dark:border-[#3f4147] shrink-0">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="質問・アドバイス・一言応援を書く..."
                maxLength={300}
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-border dark:border-[#3f4147] bg-surface dark:bg-[#1e1f22] focus:outline-none focus:ring-2 focus:ring-secondary-500 text-foreground dark:text-white placeholder-stone-400"
              />
              <button
                type="submit"
                disabled={!commentInput.trim() || isSubmittingComment}
                className="px-4 py-2 bg-secondary-600 hover:bg-secondary-500 disabled:bg-stone-300 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-2xs shrink-0"
              >
                <Send size={13} />
                <span>送信</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

