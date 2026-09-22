'use client';

import React, { useState, useEffect } from 'react';
import { toast } from '../../components/Toaster';
import { MentorshipProfile } from '../api/mentorship/profiles/route';
import { getRankBadgeStyle } from '../../lib/mmr';
import { CHAMPION_JA } from '../../components/ChampSelect';
import { Clock, MessageSquare, Send, Sparkles, Trash2, Zap } from 'lucide-react';
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
    <div className={`relative rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between bg-white/95 dark:bg-[#2b2d31] dark:border-[#3f4147] backdrop-blur-sm shadow-md ${
      matchScore && matchScore >= 80
        ? 'ring-2 ring-amber-400 shadow-lg scale-[1.01]'
        : ''
    } ${
      isLightCourse
        ? 'border-sky-400/60 ring-1 ring-sky-300/40 hover:border-sky-500 shadow-sky-900/5 hover:shadow-xl'
        : isMentor
          ? 'border-amber-400/40 hover:border-amber-500 shadow-amber-900/5 hover:shadow-lg'
          : 'border-emerald-400/40 hover:border-emerald-500 shadow-emerald-900/5 hover:shadow-lg'
    }`}>
      {/* 🚀 案1: 1試合・単発・ライトコースのアイキャッチ強調バナー（パッと見でわかるデザイン） */}
      {isLightCourse && (
        <div className="bg-gradient-to-r from-sky-500 via-cyan-500 to-indigo-500 text-white px-3.5 py-1.5 flex items-center justify-between text-xs font-black shadow-inner tracking-tight">
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-yellow-300 animate-pulse fill-yellow-300" />
            <span>
              {is1Match
                ? '🎮 1試合カスタム完結OK！ 気軽なお試し歓迎'
                : isReplay
                  ? '📺 1試合リプレイ添削！ 気軽にアドバイス'
                  : '☕ 3日間お試しバディ！ 初心者・単発歓迎'}
            </span>
          </div>
          <span className="bg-white/20 backdrop-blur-xs text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Light Course
          </span>
        </div>
      )}

      {/* AI相性おすすめリボン */}
      {matchScore !== undefined && matchScore > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-stone-950 px-3 py-1 flex items-center justify-between text-[11px] font-black tracking-tight">
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
                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
            }`}>
              <span>{isMentor ? '👨‍🏫' : '🔰'}</span>
              <span>{isMentor ? '師匠 (Mentor)' : '弟子 (Pupil)'}</span>
            </div>

            {/* コース希望バッジ */}
            {preferredDuration && MENTORSHIP_DURATIONS[preferredDuration] && (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border shadow-2xs ${
                MENTORSHIP_DURATIONS[preferredDuration].badgeColor || 'bg-stone-100 dark:bg-[#1e1f22] text-stone-800 dark:text-stone-200 border-stone-300 dark:border-[#3f4147]'
              }`}>
                {MENTORSHIP_DURATIONS[preferredDuration].shortLabel}
              </span>
            )}

            {/* ⭐ 匿名レビュー評価バッジ */}
            {reviewSummary && reviewSummary.totalReviews > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1 shadow-2xs">
                <span>⭐ {reviewSummary.averageRating}</span>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 font-normal">({reviewSummary.totalReviews}件)</span>
              </span>
            ) : null}

            {/* ステータスバッジ（師匠は受入枠数を表示） */}
            {isMentor ? (
              (profile.active_pupils_count || 0) >= (profile.max_pupils || 3) ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                  <span>🈵</span>
                  <span>弟子枠満員 ({profile.active_pupils_count}/{profile.max_pupils || 3}人)</span>
                </span>
              ) : (profile.active_pupils_count || 0) > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <span>👥</span>
                  <span>弟子枠: {profile.active_pupil_names?.length || profile.active_pupils_count}/{profile.max_pupils || 3}人 (空き{(profile.max_pupils || 3) - (profile.active_pupils_count || 0)}枠)</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 flex items-center gap-1">
                  <span>🟢</span>
                  <span>弟子募集中 (最大{profile.max_pupils || 3}人)</span>
                </span>
              )
            ) : profile.status === 'MATCHED' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                🤝 ペア結成中
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                🟢 募集中
              </span>
            )}
          </div>

          {/* 編集・削除ボタン（本人または管理者の場合） */}
          {(isMine || isAdmin) && (
            <div className="flex items-center gap-1 bg-stone-100 dark:bg-[#1e1f22] p-0.5 rounded-lg border border-stone-200 dark:border-[#3f4147]">
              {isMine && onEdit && (
                <button
                  onClick={() => onEdit(profile)}
                  className="px-2 py-1 text-xs text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-white dark:hover:bg-[#2b2d31] rounded transition cursor-pointer"
                  title="編集"
                >
                  ✏️
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(profile.id)}
                  className="px-2 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition cursor-pointer flex items-center gap-0.5"
                  title={isAdmin && !isMine ? '管理者権限で削除' : '削除'}
                >
                  <span>🗑️</span>
                  {isAdmin && !isMine && <span className="text-[10px] font-black text-rose-700 dark:text-rose-400">管理</span>}
                </button>
              )}
            </div>
          )}
        </div>

        {/* プレイヤー情報 */}
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-xl font-black shrink-0 shadow-2xs ${
            isLightCourse
              ? 'bg-gradient-to-br from-sky-100 to-indigo-100 border-sky-300 text-sky-900'
              : 'bg-gradient-to-br from-amber-100 to-amber-200 border-amber-300/80 text-amber-900'
          }`}>
            {profile.player_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-stone-900 dark:text-stone-100 truncate flex items-center gap-2">
              {profile.player_name}
            </h3>
            <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${rankBadge.bg} ${rankBadge.color} border ${rankBadge.border} shadow-2xs`}>
                {profile.current_rank || 'UNRANKED'}
              </span>
              {profile.target_rank && !isMentor && (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  ➔ 目標: {profile.target_rank}
                </span>
              )}
              {profile.target_rank && isMentor && (
                <span className="text-[11px] text-amber-800 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  👥 歓迎: {profile.target_rank}
                </span>
              )}
            </div>

            {/* 師匠が現在指導中の弟子（兄弟弟子）一覧 */}
            {isMentor && profile.active_pupil_names && profile.active_pupil_names.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 flex items-center gap-0.5">
                  <span>🤝</span>
                  <span>指導中:</span>
                </span>
                {profile.active_pupil_names.map((name, idx) => (
                  <span
                    key={`${name}-${idx}`}
                    className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.2 rounded-md"
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
          <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/20 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 space-y-1">
            <div className="text-[10px] font-black text-amber-950 dark:text-amber-200 flex items-center gap-1">
              <span>✨</span>
              <span>バディからの推薦ポイント:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {reviewSummary.topTags.map((t) => (
                <span
                  key={t.tag}
                  className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#1e1f22] border border-amber-300 dark:border-amber-700 text-[10px] font-bold text-amber-950 dark:text-amber-200 shadow-2xs"
                >
                  {t.tag} <strong className="text-amber-600 dark:text-amber-400">×{t.count}</strong>
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
                className="px-2.5 py-1 bg-stone-100 dark:bg-[#1e1f22] border border-stone-200 dark:border-[#3f4147] rounded-lg text-xs font-bold text-stone-700 dark:text-stone-200"
              >
                {LANE_ICONS[lane] || lane}
              </span>
            ))}
          </div>
        )}

        {/* チャンピオンアイコン一覧 */}
        {profile.champions && profile.champions.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400">
              {isMentor ? '⚔️ 指導可能チャンピオン:' : '🎯 練習中・得意チャンピオン:'}
            </span>
            <div className="flex flex-wrap gap-1.5 items-center">
              {profile.champions.map((champ) => {
                const champName = champ.trim();
                const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${champName}.png`;
                return (
                  <div
                    key={champName}
                    className="flex items-center gap-1.5 px-2 py-1 bg-stone-50 dark:bg-[#1e1f22] border border-stone-200/90 dark:border-[#3f4147] rounded-xl text-xs font-bold text-stone-800 dark:text-stone-200 shadow-2xs"
                  >
                    <img
                      src={iconUrl}
                      alt={champName}
                      className="w-4.5 h-4.5 rounded-md object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span>{CHAMPION_JA[champName]?.ja || champName}</span>
                  </div>
                );
              })}
            </div>
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
                    ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-300 border-sky-300 dark:border-sky-800 font-bold'
                    : isMentor
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 自己紹介文 */}
        {profile.bio && (
          <div className="p-3.5 bg-stone-50/90 dark:bg-[#1e1f22] rounded-2xl border border-stone-200 dark:border-[#3f4147] text-xs text-stone-800 dark:text-stone-100 leading-relaxed whitespace-pre-wrap font-medium">
            {profile.bio}
          </div>
        )}

        {/* 活動時間帯 */}
        {profile.active_hours && (
          <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 bg-stone-100/70 dark:bg-[#1e1f22] p-2 rounded-xl border border-stone-200/60 dark:border-[#3f4147]">
            <Clock size={13} className="text-amber-600 dark:text-amber-400" />
            <span className="font-bold text-stone-500 dark:text-stone-400">活動時間:</span>
            <span className="font-bold text-stone-800 dark:text-stone-100">{profile.active_hours}</span>
          </div>
        )}

        {/* 💬 案4: ワンポイント相談・コメント開閉ボタン */}
        <div className="pt-1">
          <button
            onClick={handleToggleComments}
            className="w-full py-1.5 px-3 rounded-xl bg-stone-100 dark:bg-[#1e1f22] hover:bg-stone-200/80 dark:hover:bg-[#35373c] text-stone-700 dark:text-stone-200 text-xs font-bold transition flex items-center justify-between cursor-pointer border border-stone-200/80 dark:border-[#3f4147]"
          >
            <span className="flex items-center gap-1.5">
              <MessageSquare size={13} className="text-sky-600 dark:text-sky-400" />
              <span>💬 ワンポイント相談 / 応援コメント</span>
            </span>
            <span className="text-[11px] font-semibold bg-white dark:bg-[#2b2d31] text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded-full border border-stone-200 dark:border-[#3f4147]">
              {showComments ? '閉じる ▲' : '見る・書く ▼'}
            </span>
          </button>

          {/* コメントアコーディオン内側 */}
          {showComments && (
            <div className="mt-2.5 p-3 rounded-2xl bg-stone-50/90 dark:bg-[#1e1f22] border border-stone-200 dark:border-[#3f4147] space-y-3 animate-in fade-in duration-200">
              {isLoadingComments ? (
                <div className="text-center py-2 text-xs text-stone-500 font-medium">
                  コメントを読み込み中...
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-2 text-xs text-stone-500 font-medium">
                  まだコメントはありません。気軽に「このチャンプ教えられます！」「1試合だけやりませんか？」と書き込んでみましょう！
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {comments.map((comment) => {
                    const isMyComment = currentUserId === comment.author_id;
                    return (
                      <div
                        key={comment.id}
                        className="p-2.5 rounded-xl bg-white border border-stone-200/80 text-xs space-y-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-stone-900 flex items-center gap-1">
                            <span>💬</span>
                            <span>{comment.author_name}</span>
                            {isMyComment && (
                              <span className="text-[9px] bg-stone-100 text-stone-600 px-1 rounded font-normal">
                                あなた
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1.5 text-stone-400">
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
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                                title="コメントを削除"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-stone-700 leading-relaxed whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* コメント投稿フォーム */}
              <form onSubmit={handlePostComment} className="flex gap-1.5 pt-1">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="質問・アドバイス・一言応援を書く..."
                  maxLength={300}
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-stone-800 placeholder-stone-400"
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim() || isSubmittingComment}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-stone-300 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed shadow-2xs shrink-0"
                >
                  <Send size={12} />
                  <span>送信</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* 下部アクションボタン */}
      <div className="p-3.5 bg-stone-50 border-t border-stone-200/80 flex items-center justify-between gap-2">
        <div className="text-[11px] text-stone-500 font-medium">
          {new Date(profile.updated_at || profile.created_at).toLocaleDateString('ja-JP')} 更新
        </div>

        {isMine ? (
          <span className="text-xs text-stone-500 font-bold">（あなたのカード）</span>
        ) : !isMentor && profile.status === 'MATCHED' ? (
          <span className="text-xs text-purple-700 font-bold bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200">
            🤝 ペア結成中
          </span>
        ) : isMentor && (profile.active_pupils_count || 0) >= (profile.max_pupils || 3) ? (
          <span className="text-xs text-purple-700 font-bold bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200">
            🈵 弟子枠満員 ({profile.max_pupils || 3}人)
          </span>
        ) : isPendingSent ? (
          <span className="text-xs text-amber-800 font-bold bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1">
            ⏳ 申請中（返答待ち）
          </span>
        ) : (
          <button
            onClick={() => onOffer(profile)}
            className={`px-4 py-2 rounded-xl font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer ${
              isMentor
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
            }`}
          >
            {isMentor ? '🙋 弟子入りをお願いする' : '🤝 師匠を引き受ける (+300🪙)'}
          </button>
        )}
      </div>
    </div>
  );
}

