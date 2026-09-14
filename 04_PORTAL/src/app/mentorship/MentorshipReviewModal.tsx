'use client';

import React, { useState } from 'react';
import { Star, Check, Sparkles, HeartHandshake, Shield, MessageSquare } from 'lucide-react';
import { toast } from '../../components/Toaster';

interface MentorshipReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: any | null;
  myDiscordId: string | null;
  onSubmitted?: () => void;
}

const REVIEW_TAGS_PUPIL_TO_MENTOR = [
  '教え方が丁寧でわかりやすい',
  'ダメ出しせず褒めて伸ばしてくれる',
  '質問に熱心に答えてくれた',
  '時間厳守で信頼できる',
  'リプレイ添削が的確',
  '雰囲気が良くて楽しかった',
  'また教えてもらいたい',
];

const REVIEW_TAGS_MENTOR_TO_PUPIL = [
  '素直でアドバイスの吸収が早い',
  '意欲が高く練習熱心',
  '挨拶やコミュニケーションが丁寧',
  '時間通りに参加してくれた',
  '1戦ごとに成長が見られた',
  '楽しく指導できた',
  'また一緒にプレイしたい',
];

export function MentorshipReviewModal({
  isOpen,
  onClose,
  match,
  myDiscordId,
  onSubmitted,
}: MentorshipReviewModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !match) return null;

  const isMyMentor = match.mentor_discord_id === myDiscordId;
  const partner = isMyMentor ? match.pupil : match.mentor;
  const partnerRoleLabel = isMyMentor ? '弟子' : '師匠';
  const availableTags = isMyMentor ? REVIEW_TAGS_MENTOR_TO_PUPIL : REVIEW_TAGS_PUPIL_TO_MENTOR;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/mentorship/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          rating,
          tags: selectedTags,
          feedbackComment: comment,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        // 紙吹雪エフェクト
        try {
          const confetti = (await import('canvas-confetti')).default;
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
          });
        } catch (_) {}

        toast.success(data.message || '⭐ 匿名評価を送信しました！(+100🪙獲得)');
        if (onSubmitted) onSubmitted();
        onClose();
      } else {
        toast.error(data.error || '評価の送信に失敗しました');
      }
    } catch (err) {
      toast.error('通信エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-stone-900/50 backdrop-blur-xs">
      <div className="bg-white border border-stone-300 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-stone-900 animate-in fade-in zoom-in-95 duration-200">
        
        {/* ヘッダー */}
        <div className="p-4 md:px-6 md:py-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center text-xl shadow-xs font-black">
              ⭐
            </div>
            <div>
              <h2 className="text-base font-black text-stone-900 flex items-center gap-1.5">
                師弟の匿名評価 ＆ 感謝フィードバック
              </h2>
              <p className="text-[11px] text-stone-600 font-medium">
                完全匿名で集約され、相手の自己紹介カードの信頼指標に反映されます
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-900 flex items-center justify-center font-bold text-sm transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* ボディ */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5 text-sm">
          
          {/* 相手情報バナー */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{isMyMentor ? '🌱' : '👑'}</span>
              <div>
                <div className="text-xs font-black text-stone-900">
                  {partner?.player_name || 'お相手'} さん（{partnerRoleLabel}）への評価
                </div>
                <div className="text-[10px] text-stone-500 font-medium">
                  🔒 あなたの個人名やDiscord IDは相手に公開されません
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
              +100🪙 付与
            </span>
          </div>

          {/* 1. 星評価 (1〜5) */}
          <div className="space-y-2 text-center py-2 bg-amber-50/50 rounded-2xl border border-amber-200/80">
            <label className="block text-xs font-black text-stone-800">
              総合満足度を選んでください
            </label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1.5 transition hover:scale-125 cursor-pointer"
                >
                  <Star
                    size={28}
                    className={`${
                      star <= rating
                        ? 'text-amber-500 fill-amber-400 drop-shadow-xs'
                        : 'text-stone-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="text-xs font-bold text-amber-800">
              {rating === 5 && '🌟 大変満足（最高のバディでした！）'}
              {rating === 4 && '✨ 満足（とても助かりました）'}
              {rating === 3 && '👍 普通（問題なく活動できました）'}
              {rating === 2 && '💭 やや物足りなかった'}
              {rating === 1 && '⚠️ 改善を望む'}
            </div>
          </div>

          {/* 2. 称賛・推薦タグ (タップ選択) */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-stone-700 flex items-center justify-between">
              <span>良かったポイント（複数選択可）</span>
              <span className="text-[10px] text-stone-500 font-bold">{selectedTags.length}個選択中</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-2xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. 感謝コメント・フィードバック */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-stone-700">
              感謝のメッセージ・フィードバック（任意）
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="一緒にプレイした感想や感謝の言葉をご記入ください（個人を特定できない形式で集約されます）..."
              className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-3 text-stone-900 text-xs focus:border-amber-500 focus:bg-white focus:outline-hidden leading-relaxed font-medium"
            />
          </div>

          {/* フッターアクション */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-black transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={14} />
              <span>{isSubmitting ? '送信中...' : '匿名評価を送信 (+100🪙)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
