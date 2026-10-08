'use client';

import React, { useState } from 'react';
import { MentorshipProfile } from '../api/mentorship/profiles/route';
import { MENTORSHIP_DURATIONS, COMMUNICATION_STYLES } from '../../lib/mentorshipConstants';
import { Send, X, Clock, RefreshCw } from 'lucide-react';

interface MentorshipRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetProfile: MentorshipProfile | null;
  onSubmit: (targetProfileId: string, message: string, durationKey: string, autoRenew: boolean, commStyle: string) => Promise<void>;
}

const TEMPLATE_MESSAGES_FOR_MENTOR = [
  '初めまして！ウェーブ管理や集団戦の立ち位置をご指導いただきたいです。よろしくお願いします！',
  '得意チャンピオンの立ち回りやリプレイ添削をお願いしたいです！VC可能です。',
  '楽しくカスタムやノーマルで一緒にプレイしながら教えていただけると嬉しいです！',
];

const TEMPLATE_MESSAGES_FOR_PUPIL = [
  '初めまして！プロフィールを拝見してぜひ力になりたいと思いました。楽しく上達しましょう！',
  '得意なレーン戦のコツや集団戦の立ち回りを優しく教えます！よろしくお願いします。',
];

export function MentorshipRequestModal({
  isOpen,
  onClose,
  targetProfile,
  onSubmit,
}: MentorshipRequestModalProps) {
  const [message, setMessage] = useState('');
  const [durationKey, setDurationKey] = useState('14_DAYS');
  const [autoRenew, setAutoRenew] = useState(true);
  // ⚠️ 2026-09-30 追加: サーバーは commStyle を10箇所で扱いDBにも保存していたが、
  // UIから一度も送っておらず**全員 'VC_ACTIVE'(通話歓迎)で固定**されていた。
  // 「通話は苦手だからテキストで教わりたい」人が意思表示できず、師弟の相性を左右する
  // 情報が失われていた（選択肢 COMMUNICATION_STYLES は定義だけで参照0件だった）。
  const [commStyle, setCommStyle] = useState('VC_ACTIVE');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !targetProfile) return null;

  const isTargetMentor = targetProfile.role_type === 'MENTOR';
  const templates = isTargetMentor ? TEMPLATE_MESSAGES_FOR_MENTOR : TEMPLATE_MESSAGES_FOR_PUPIL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(targetProfile.id, message, durationKey, autoRenew, commStyle);
      setMessage('');
      onClose();
    } catch (err) {
      console.error('Request submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-foreground animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className={`p-5 flex items-center justify-between border-b shrink-0 ${
          isTargetMentor ? 'bg-primary-50/70 border-primary-edge-soft' : 'bg-success-50/70 border-success-edge-soft'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-2xs ${
              isTargetMentor ? 'bg-primary-100 border border-primary-edge' : 'bg-success-100 border border-success-edge'
            }`}>
              {isTargetMentor ? '💬' : '🤝'}
            </div>
            <div>
              <h2 className="text-base font-black text-foreground">
                {isTargetMentor ? '先輩に相談してみる' : '相談に乗るよ！の声をかける'}
              </h2>
              <p className="text-xs text-muted-strong font-bold">
                相手が承認するとDiscordに専用の相談スレッドが作られます (+300🪙)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-faint hover:text-foreground-subtle p-1 rounded-full transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* 相手のプロフィール概要 */}
          <div className="p-3.5 bg-background rounded-2xl border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-foreground-soft flex items-center gap-1.5">
                <span>👤 お相手:</span>
                <span className="text-sm font-black text-foreground">{targetProfile.player_name}</span>
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-surface-hover/80 text-foreground-soft">
                {targetProfile.current_rank}
              </span>
            </div>

            {targetProfile.lanes && targetProfile.lanes.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted font-bold">
                <span>レーン:</span>
                <span className="text-foreground">{targetProfile.lanes.join(', ')}</span>
              </div>
            )}
          </div>

          {/* 相談期間の目安 (2週間) */}
          <div className="p-3 bg-secondary-50/70 border border-secondary-edge-soft rounded-2xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-black text-secondary-900">
              <Clock size={14} className="text-secondary-600" />
              <span>相談期間の目安: 約2週間</span>
              <span className="text-[10px] text-secondary-700 bg-surface px-1.5 py-0.2 rounded border border-secondary-edge font-bold ml-auto">
                自然消滅防止Botつき
              </span>
            </div>
            <p className="text-[11px] text-secondary-800 leading-relaxed font-medium">
              2週間経つとDiscord Botから継続・完了の確認通知が届きます。いつでも気軽に終了・延長が可能です。
            </p>
          </div>

          {/* 希望するやりとりの形 */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-foreground-subtle">
              希望する通話・やりとりの形
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {Object.entries(COMMUNICATION_STYLES).map(([key, item]) => {
                const isSelected = commStyle === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCommStyle(key)}
                    className={`p-2.5 rounded-2xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-primary-100 border-primary-edge ring-2 ring-primary-300'
                        : 'bg-surface border-border hover:border-border'
                    }`}
                  >
                    <div className="text-xs font-black text-foreground">{item.label}</div>
                    <div className="text-[10px] text-muted-strong font-medium leading-tight mt-0.5">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ひと言メッセージ入力 */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-foreground-subtle flex items-center justify-between">
              <span>ひと言メッセージ（意気込みや教えてほしいこと）</span>
              <span className="text-[11px] text-faint font-normal">例文から選択可能</span>
            </label>

            {/* 定型文ボタン */}
            <div className="space-y-1.5">
              {templates.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setMessage(tmpl)}
                  className="w-full text-left p-2 rounded-xl bg-surface-subtle hover:bg-surface-hover/80 border border-border text-[11px] text-foreground-subtle hover:text-foreground font-medium transition cursor-pointer leading-snug"
                >
                  💬 {tmpl}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="メッセージを入力してください（上の例文をクリックしても入力できます）..."
              className="w-full bg-background border border-border rounded-2xl p-3 text-foreground text-xs focus:border-primary-edge-strong focus:bg-surface focus:outline-hidden font-medium leading-relaxed"
            />
          </div>

          {/* フッターアクション */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-subtle shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-muted hover:text-foreground rounded-xl transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl font-black text-xs text-white shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                isTargetMentor
                  ? 'bg-primary-600 hover:bg-primary-500 shadow-primary-900/20'
                  : 'bg-success-600 hover:bg-success-500 shadow-success-900/20'
              }`}
            >
              <Send size={13} />
              <span>{isSubmitting ? '送信中...' : isTargetMentor ? '💬 相談をお願いする' : '🤝 相談に乗る！'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

