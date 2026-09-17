'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Coins, X } from 'lucide-react';

export interface OmikujiData {
  tier: '大大吉' | '大吉' | '中吉' | '小吉';
  coins: number;
  icon: string;
  comment: string;
}

interface OmikujiModalProps {
  isOpen: boolean;
  onClose: () => void;
  omikujiData: OmikujiData | null;
  onClaimFinished?: () => void;
}

const TIER_STYLES: Record<string, { bg: string; text: string; glow: string; badge: string }> = {
  大大吉: {
    bg: 'from-amber-400 via-orange-500 to-rose-500',
    text: 'text-amber-500',
    glow: 'shadow-amber-500/50 ring-4 ring-amber-400',
    badge: '👑 超絶神引き！',
  },
  大吉: {
    bg: 'from-amber-500 to-yellow-400',
    text: 'text-amber-500',
    glow: 'shadow-yellow-500/40 ring-2 ring-yellow-400',
    badge: '🌟 大幸運！',
  },
  中吉: {
    bg: 'from-emerald-500 to-teal-400',
    text: 'text-emerald-500',
    glow: 'shadow-emerald-500/30 ring-2 ring-emerald-400',
    badge: '🎯 好調！',
  },
  小吉: {
    bg: 'from-sky-500 to-indigo-400',
    text: 'text-sky-500',
    glow: 'shadow-sky-500/30 ring-2 ring-sky-400',
    badge: '🍀 堅実運！',
  },
};

const SLOT_ICONS = ['👑', '🌟', '🎯', '🍀', '💎', '🪙', '🔥', '⚔️'];

export default function OmikujiModal({ isOpen, onClose, omikujiData, onClaimFinished }: OmikujiModalProps) {
  const [isSpinning, setIsSpinning] = useState(true);
  const [displayIcon, setDisplayIcon] = useState('🎰');

  useEffect(() => {
    if (!isOpen) return;

    setIsSpinning(true);
    let count = 0;
    const maxCount = 18;
    const interval = setInterval(() => {
      count++;
      setDisplayIcon(SLOT_ICONS[Math.floor(Math.random() * SLOT_ICONS.length)]);

      if (count >= maxCount) {
        clearInterval(interval);
        setIsSpinning(false);
        // 結果確定時に紙吹雪演出
        try {
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.55 },
            colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#e11d48'],
          });
        } catch {}
      }
    }, 80);

    return () => clearInterval(interval);
  }, [isOpen, omikujiData]);

  if (!isOpen || !omikujiData) return null;

  const style = TIER_STYLES[omikujiData.tier] || TIER_STYLES['小吉'];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#fdfcf9] dark:bg-[#2b2d31] border-2 border-amber-400/60 shadow-2xl p-6 text-center space-y-5 overflow-hidden">
        
        {/* 背景の光彩演出 */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-b from-amber-400/20 to-transparent rounded-full blur-2xl pointer-events-none" />

        {/* 閉じるボタン */}
        {!isSpinning && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#35373c] transition"
          >
            <X size={18} />
          </button>
        )}

        {/* ヘッダー */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black">
            <Sparkles size={13} className="animate-spin" />
            <span>KTM デイリーおみくじ</span>
          </div>
          <h3 className="text-xl font-black text-stone-900 dark:text-white">
            {isSpinning ? '運命の抽選中...' : `本日の運勢は【${omikujiData.tier}】！`}
          </h3>
        </div>

        {/* ルーレット / 結果スロットカード */}
        <div className="relative py-4">
          <div
            className={`w-28 h-28 mx-auto rounded-3xl flex items-center justify-center text-5xl shadow-xl transition-all duration-300 ${
              isSpinning
                ? 'bg-gradient-to-br from-stone-100 to-stone-200 dark:from-[#1e1f22] dark:to-[#35373c] animate-bounce-short border-2 border-stone-300 dark:border-[#3f4147]'
                : `bg-gradient-to-br ${style.bg} ${style.glow} text-white scale-110`
            }`}
          >
            {isSpinning ? displayIcon : omikujiData.icon}
          </div>

          {!isSpinning && (
            <div className="mt-3">
              <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-black bg-white/90 dark:bg-[#1e1f22] text-stone-900 dark:text-white shadow-sm border border-stone-200 dark:border-[#3f4147]">
                {style.badge}
              </span>
            </div>
          )}
        </div>

        {/* 獲得コインとコメント */}
        {!isSpinning && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center gap-2">
              <Coins className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-bold text-stone-700 dark:text-stone-300">獲得:</span>
              <strong className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                +{omikujiData.coins}
              </strong>
              <span className="text-xs font-bold text-stone-600 dark:text-stone-300">コイン</span>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 font-medium px-2 leading-relaxed">
              {omikujiData.comment}
            </p>
          </div>
        )}

        {/* 完了ボタン */}
        <button
          type="button"
          disabled={isSpinning}
          onClick={() => {
            onClose();
            if (onClaimFinished) onClaimFinished();
          }}
          className={`w-full py-3 px-4 rounded-2xl font-black text-xs transition flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
            isSpinning
              ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-stone-950 font-black scale-100 hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          <span>{isSpinning ? 'おみくじを開封中...' : 'コインを受け取って閉じる ✨'}</span>
        </button>
      </div>
    </div>
  );
}
