'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Heart, Award, Shield, Check, MessageSquare, AlertTriangle, Send, Star, Trophy } from 'lucide-react';
import { toast } from '../../components/Toaster';

interface PlayerReputationCardProps {
  playerName: string;
  isMe: boolean;
  currentUser: any;
}

const KUDOS_TAGS = [
  { id: 'carry', label: '👑 キャリー力・頼れるエース', icon: '👑', color: 'bg-amber-50 text-amber-900 border-amber-300' },
  { id: 'manner', label: '💖 ナイスマナー・雰囲気◎（絶対に煽らない）', icon: '💖', color: 'bg-rose-50 text-rose-900 border-rose-300' },
  { id: 'peel', label: '🛡️ ナイスサポート・献身的なピール', icon: '🛡️', color: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
  { id: 'shotcall', label: '🗣️ 的確な指示・ピン出し', icon: '🗣️', color: 'bg-sky-50 text-sky-900 border-sky-300' },
  { id: 'mentor', label: '🔰 初心者・新規に優しい', icon: '🔰', color: 'bg-teal-50 text-teal-900 border-teal-300' },
  { id: 'engage', label: '⚡ 神エンゲージ・仕掛けの鬼', icon: '⚡', color: 'bg-indigo-50 text-indigo-900 border-indigo-300' },
  { id: 'snipe', label: '🎯 スナイパー・神スキルショット', icon: '🎯', color: 'bg-purple-50 text-purple-900 border-purple-300' },
  { id: 'clutch', label: '🔥 勝負強さ・クラッチプレイ', icon: '🔥', color: 'bg-orange-50 text-orange-900 border-orange-300' },
];

export default function PlayerReputationCard({
  playerName,
  isMe,
  currentUser,
}: PlayerReputationCardProps) {
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [totalKudos, setTotalKudos] = useState(0);
  const [canSendToday, setCanSendToday] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // 送信モーダル管理
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isReport, setIsReport] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReputation = async () => {
    try {
      const res = await fetch(`/api/player/reputation?playerName=${encodeURIComponent(playerName)}`);
      const data = await res.json();
      if (data.ok) {
        setTagCounts(data.tagCounts || {});
        setTotalKudos(data.totalKudos || 0);
        setCanSendToday(Boolean(data.canSendToday));
      }
    } catch (err) {
      console.error('Failed to fetch reputation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (playerName) {
      fetchReputation();
    }
  }, [playerName]);

  const toggleTag = (label: string) => {
    if (selectedTags.includes(label)) {
      setSelectedTags(selectedTags.filter((t) => t !== label));
    } else {
      if (selectedTags.length >= 3) {
        toast.info('称賛タグは1回につき最大3つまで選択できます。');
        return;
      }
      setSelectedTags([...selectedTags, label]);
    }
  };

  const handleSendKudos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReport && selectedTags.length === 0) {
      toast.error('称賛タグを1つ以上選択してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/player/reputation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPlayerName: playerName,
          tags: selectedTags,
          message,
          isReport,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (!isReport) {
          try {
            const confetti = (await import('canvas-confetti')).default;
            confetti({
              particleCount: 70,
              spread: 60,
              origin: { y: 0.6 },
            });
          } catch (_) {}
        }
        toast.success(data.message || '🌟 評判を送信しました！');
        setIsModalOpen(false);
        setSelectedTags([]);
        setMessage('');
        setIsReport(false);
        fetchReputation();
      } else {
        toast.error(data.error || '送信に失敗しました');
      }
    } catch (err) {
      toast.error('通信エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-4 relative overflow-hidden">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-300 flex items-center justify-center text-xl shadow-2xs">
            🌟
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-stone-900">
                KTM 栄誉 ＆ メンバーからの評判
              </h3>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full">
                通算称賛 {totalKudos} 回
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">
              カスタムやノーマルで一緒にプレイしたメンバーから匿名で贈られた栄誉バッジです
            </p>
          </div>
        </div>

        {/* 称賛ボタン（他人のページの場合のみ表示） */}
        {!isMe && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 ${
              canSendToday
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 shadow-amber-500/20 hover:scale-102 active:scale-98 animate-pulse'
                : 'bg-stone-100 text-stone-500 border border-stone-200 hover:bg-stone-200'
            }`}
          >
            <Sparkles size={14} className={canSendToday ? 'text-stone-950' : 'text-stone-400'} />
            <span>{canSendToday ? '🌟 匿名で称賛を贈る (+50🪙)' : '本日送信済み（明日また送れます）'}</span>
          </button>
        )}
      </div>

      {/* 獲得タグ一覧 */}
      {isLoading ? (
        <div className="py-6 text-center text-xs text-stone-400 font-bold animate-pulse">
          評判データを読み込み中...
        </div>
      ) : Object.keys(tagCounts).length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {KUDOS_TAGS.map((kudo) => {
            const count = tagCounts[kudo.label] || 0;
            if (count === 0) return null;
            return (
              <div
                key={kudo.id}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-2 shadow-2xs ${kudo.color}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{kudo.icon}</span>
                  <span className="text-xs font-black truncate">{kudo.label.split('・')[0]}</span>
                </div>
                <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-white/90 border border-current/20 shadow-2xs shrink-0">
                  ×{count}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 text-center text-xs text-stone-500 font-medium">
          まだメンバーからの称賛タグはありません。一緒にカスタムやノーマルをプレイして栄誉を集めましょう！
        </div>
      )}

      {/* 称賛送信モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white border border-stone-300 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-stone-900 animate-in fade-in zoom-in-95 duration-200">
            
            {/* モーダルヘッダー */}
            <div className="p-4 md:px-6 md:py-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center text-xl shadow-xs font-black">
                  🌟
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">
                    {playerName} さんへ匿名評判を贈る
                  </h3>
                  <p className="text-[11px] text-stone-600 font-medium">
                    完全匿名で送信されます（1日1回・+50コイン獲得🎁）
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-900 flex items-center justify-center font-bold text-sm transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* モーダルボディ */}
            <form onSubmit={handleSendKudos} className="p-4 md:p-6 space-y-5 text-sm">
              
              {/* 管理者通報トグル */}
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                    <Shield size={14} className="text-indigo-600" />
                    <span>送信モード</span>
                  </div>
                  <div className="text-[11px] text-stone-500 font-medium">
                    {isReport ? '⚠️ 管理者直通の相談・通報として非公開送信' : '🌟 公開称賛バッジとして送信'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsReport(!isReport)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                    isReport
                      ? 'bg-rose-100 text-rose-900 border-rose-300'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                  }`}
                >
                  {isReport ? '🛡️ 管理者への通報中' : '称賛モード'}
                </button>
              </div>

              {/* 称賛タグ選択 (称賛モード時のみ) */}
              {!isReport && (
                <div className="space-y-2">
                  <label className="block text-xs font-black text-stone-700 flex items-center justify-between">
                    <span>称賛タグを選択（最大3つ）</span>
                    <span className="text-[10px] text-stone-500 font-bold">{selectedTags.length}/3 選択中</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {KUDOS_TAGS.map((kudo) => {
                      const isSelected = selectedTags.includes(kudo.label);
                      return (
                        <button
                          key={kudo.id}
                          type="button"
                          onClick={() => toggleTag(kudo.label)}
                          className={`p-2.5 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-2xs font-black'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          <span className="truncate">{kudo.label}</span>
                          {isSelected && <Check size={14} className="shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* メッセージ入力欄 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-stone-700">
                  {isReport ? '管理者への報告内容（理由・状況など）' : '匿名メッセージ・感謝の言葉（任意）'}
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    isReport
                      ? '管理者のみに届く相談・通報内容をご記入ください...'
                      : '「キャリーありがとう！」「また組もう！」など温かいメッセージをどうぞ（相手には匿名で届きます）...'
                  }
                  className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-3 text-stone-900 text-xs focus:border-amber-500 focus:bg-white focus:outline-hidden leading-relaxed font-medium"
                />
              </div>

              {/* アクション */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-black transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 rounded-xl font-black text-xs text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    isReport
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  <Send size={13} />
                  <span>
                    {isSubmitting
                      ? '送信中...'
                      : isReport
                      ? '管理者へ通報を送信'
                      : '匿名で称賛を贈る (+50🪙)'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
