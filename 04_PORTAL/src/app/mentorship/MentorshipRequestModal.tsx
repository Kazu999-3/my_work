'use client';

import React, { useState } from 'react';
import { MentorshipProfile } from '../api/mentorship/profiles/route';
import { MENTORSHIP_DURATIONS } from '../../lib/mentorshipConstants';
import { Send, X, Clock, RefreshCw } from 'lucide-react';

interface MentorshipRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetProfile: MentorshipProfile | null;
  onSubmit: (targetProfileId: string, message: string, durationKey: string, autoRenew: boolean) => Promise<void>;
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !targetProfile) return null;

  const isTargetMentor = targetProfile.role_type === 'MENTOR';
  const templates = isTargetMentor ? TEMPLATE_MESSAGES_FOR_MENTOR : TEMPLATE_MESSAGES_FOR_PUPIL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(targetProfile.id, message, durationKey, autoRenew);
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
      <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-stone-900 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className={`p-5 flex items-center justify-between border-b shrink-0 ${
          isTargetMentor ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/70 border-emerald-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-2xs ${
              isTargetMentor ? 'bg-amber-100 border border-amber-300' : 'bg-emerald-100 border border-emerald-300'
            }`}>
              {isTargetMentor ? '🙋' : '🤝'}
            </div>
            <div>
              <h2 className="text-base font-black text-stone-900">
                {isTargetMentor ? '弟子入りを申請する' : '師匠オファーを送る'}
              </h2>
              <p className="text-xs text-stone-500 font-bold">
                相手が承認すると正式に師弟ペアが結成されます (+300🪙)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 rounded-full transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* 相手のプロフィール概要 */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-stone-800 flex items-center gap-1.5">
                <span>👤 申請相手:</span>
                <span className="text-sm font-black text-stone-900">{targetProfile.player_name}</span>
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-stone-200/80 text-stone-800">
                {targetProfile.current_rank}
              </span>
            </div>

            {targetProfile.lanes && targetProfile.lanes.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-stone-600 font-bold">
                <span>レーン:</span>
                <span className="text-stone-900">{targetProfile.lanes.join(', ')}</span>
              </div>
            )}
          </div>

          {/* 期間設定 (Duration) */}
          <div className="space-y-2.5">
            <label className="block text-xs font-black text-stone-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-amber-600" />
                <span>希望するペア活動・指導の期間</span>
              </span>
              <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                1試合だけでも大歓迎！
              </span>
            </label>

            {/* 気軽な1回・お試しコース */}
            <div className="space-y-1">
              <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">✨ 気軽な1回・お試しコース</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                {Object.entries(MENTORSHIP_DURATIONS)
                  .filter(([_, item]) => item.isLight)
                  .map(([key, item]) => {
                    const isSelected = durationKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setDurationKey(key)}
                        className={`p-2.5 rounded-xl text-left border text-xs font-bold transition flex flex-col justify-between gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-br from-sky-50 to-amber-50 border-sky-400 text-stone-900 shadow-2xs ring-2 ring-sky-300'
                            : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-sky-50/50 hover:border-sky-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold">{item.shortLabel}</span>
                          {isSelected && <span className="text-sky-600 text-xs font-black">✓</span>}
                        </div>
                        <span className="text-[10px] text-stone-500 font-medium leading-tight">{item.label.split('（')[0]}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* しっかり継続コース */}
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">🔥 しっかり継続コース</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {Object.entries(MENTORSHIP_DURATIONS)
                  .filter(([_, item]) => !item.isLight)
                  .map(([key, item]) => {
                    const isSelected = durationKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setDurationKey(key)}
                        className={`p-2 rounded-xl text-left border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-2xs'
                            : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        <span>{item.label}</span>
                        {isSelected && <span className="text-amber-600 text-xs">✓</span>}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>


          {/* 期間切れ後の自動継続（そのまま実行）設定 */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-stone-900">
                <RefreshCw size={13} className="text-emerald-600" />
                <span>期間満了時の設定</span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium">
                {autoRenew ? '期間終了後もワンクリックまたは自動でそのまま継続します' : '期間終了時に卒業手続きまたは延長を選択します'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoRenew(!autoRenew)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer border shrink-0 ${
                autoRenew
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                  : 'bg-stone-200 border-stone-300 text-stone-600'
              }`}
            >
              {autoRenew ? '⚡ そのまま継続' : '🎓 終了時に相談'}
            </button>
          </div>

          {/* ひと言メッセージ入力 */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-stone-700 flex items-center justify-between">
              <span>ひと言メッセージ（意気込みや教えてほしいこと）</span>
              <span className="text-[11px] text-stone-400 font-normal">例文から選択可能</span>
            </label>

            {/* 定型文ボタン */}
            <div className="space-y-1.5">
              {templates.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setMessage(tmpl)}
                  className="w-full text-left p-2 rounded-xl bg-stone-100 hover:bg-stone-200/80 border border-stone-200 text-[11px] text-stone-700 hover:text-stone-900 font-medium transition cursor-pointer leading-snug"
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
              className="w-full bg-stone-50 border border-stone-300 rounded-2xl p-3 text-stone-900 text-xs focus:border-amber-500 focus:bg-white focus:outline-hidden font-medium leading-relaxed"
            />
          </div>

          {/* フッターアクション */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 rounded-xl transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl font-black text-xs text-white shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                isTargetMentor
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
              }`}
            >
              <Send size={13} />
              <span>{isSubmitting ? '送信中...' : '申請を送信する'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

