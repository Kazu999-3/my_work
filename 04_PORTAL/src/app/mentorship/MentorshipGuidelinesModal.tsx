'use client';

import React from 'react';
import { MENTORSHIP_GUIDELINES } from '../../lib/mentorshipConstants';
import { X, ShieldCheck, Heart, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface MentorshipGuidelinesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MentorshipGuidelinesModal({
  isOpen,
  onClose,
}: MentorshipGuidelinesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-foreground animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="p-5 bg-gradient-to-r from-primary-500/15 via-primary-500/10 to-primary-500/15 border-b border-primary-edge-soft flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary-100 border border-primary-edge flex items-center justify-center text-xl shadow-2xs">
              📜
            </div>
            <div>
              <h2 className="text-base font-black text-foreground flex items-center gap-1.5">
                <span>KTM 師弟の心得 ＆ ガイドライン</span>
              </h2>
              <p className="text-xs text-muted font-bold">
                お互いが楽しく・気持ちよく上達するための安心ルール
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

        {/* ボディ */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* 基本スタンス */}
          <div className="p-3.5 bg-primary-50/70 border border-primary-edge-soft rounded-2xl text-xs text-foreground-soft leading-relaxed font-medium">
            🌟 KTMの師弟制度は「褒めて伸ばす」「一緒に楽しむ」文化を最優先にしています。勝敗やレートに関係なく、楽しく上達できるバディ関係を育みましょう。
          </div>

          {/* 師匠の心得 */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black text-primary-900">
              <span className="p-1 rounded-lg bg-primary-100 border border-primary-edge">👨‍🏫</span>
              <span>師匠（メンター）の心得</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-background border border-border space-y-2">
              {MENTORSHIP_GUIDELINES.mentor.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-foreground-subtle">
                  <CheckCircle2 size={14} className="text-success-600 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 弟子の心得 */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black text-success-900">
              <span className="p-1 rounded-lg bg-success-100 border border-success-edge">🌱</span>
              <span>弟子（生徒）の心得</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-background border border-border space-y-2">
              {MENTORSHIP_GUIDELINES.pupil.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-foreground-subtle">
                  <CheckCircle2 size={14} className="text-success-600 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 円満解散について */}
          <div className="p-3.5 bg-surface-subtle rounded-2xl border border-border space-y-1 text-xs text-foreground-subtle">
            <div className="font-black text-foreground flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-muted" />
              <span>🍃 スケジュールが合わなくなったときは？</span>
            </div>
            <p className="text-[11px] text-muted font-medium leading-relaxed">
              リアル都合やモチベーションの変化などで活動継続が難しくなった場合は、いつでも気兼ねなく「円満解散（活動終了）」ボタンを押してリセットできます。ペナルティ等は一切ありません。
            </p>
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 bg-background border-t border-surface-subtle flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-black text-xs transition shadow-sm cursor-pointer"
          >
            理解しました
          </button>
        </div>
      </div>
    </div>
  );
}
