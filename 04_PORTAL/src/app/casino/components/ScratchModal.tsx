'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Coins, X } from 'lucide-react';

export interface ScratchResultData {
  price: number;
  prize: number;
  tier: string;
  icon: string;
  remainingCoins: number;
  netChange: number;
}

interface ScratchModalProps {
  isOpen: boolean;
  onClose: () => void;
  resultData: ScratchResultData | null;
  onFinished?: () => void;
}

export default function ScratchModal({ isOpen, onClose, resultData, onFinished }: ScratchModalProps) {
  const [isScratching, setIsScratching] = useState(true);
  const [scratchedCount, setScratchedCount] = useState(0);

  useEffect(() => {
    if (!isOpen || !resultData) return;

    setIsScratching(true);
    setScratchedCount(0);

    const timer1 = setTimeout(() => setScratchedCount(1), 300);
    const timer2 = setTimeout(() => setScratchedCount(2), 650);
    const timer3 = setTimeout(() => {
      setScratchedCount(3);
      setIsScratching(false);

      if (resultData.prize >= 300) {
        try {
          confetti({
            particleCount: resultData.prize >= 1000 ? 120 : 60,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#f59e0b', '#ec4899', '#3b82f6', '#10b981'],
          });
        } catch {}
      }
      onFinished?.();
    }, 1100);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isOpen, resultData]);

  if (!isOpen || !resultData) return null;

  const isWin = resultData.prize >= 300;
  const isJackpot = resultData.prize >= 1000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-surface border-2 border-primary-edge shadow-2xl p-6 text-center space-y-6 overflow-hidden">
        {/* 背景の装飾グロー */}
        <div
          className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-30 ${
            isJackpot ? 'bg-primary-500' : isWin ? 'bg-secondary-500' : 'bg-stone-500'
          }`}
        />

        <button
          onClick={onClose}
          disabled={isScratching}
          className="absolute top-4 right-4 p-2 rounded-full text-muted hover:text-foreground hover:bg-black/10 transition-colors disabled:opacity-30"
        >
          <X size={18} />
        </button>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-edge-strong/30 text-primary-900 text-xs font-black">
            <Sparkles size={13} className="text-primary-600 animate-pulse" />
            <span>🥠 闇のスクラッチくじ</span>
          </div>
          <h3 className="text-xl font-black text-foreground">
            {isScratching ? '銀色の膜を削っています...' : resultData.tier}
          </h3>
        </div>

        {/* スクラッチ削り窓（3マス） */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-black/10 border border-black/10">
          {[0, 1, 2].map((idx) => {
            const isRevealed = scratchedCount > idx;
            return (
              <div
                key={idx}
                className={`h-24 rounded-xl flex flex-col items-center justify-center transition-all duration-300 font-black ${
                  isRevealed
                    ? 'bg-gradient-to-br from-stone-900 to-black text-white scale-100 shadow-inner'
                    : 'bg-stone-400 border border-stone-300 text-stone-600 scale-95 shadow-md animate-pulse'
                }`}
              >
                {isRevealed ? (
                  <div className="space-y-1 animate-in zoom-in-75 duration-200">
                    <span className="text-2xl">{resultData.icon}</span>
                    <p className="text-[10px] text-primary-400 font-mono">+{resultData.prize}🪙</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs">🪙</span>
                    <span className="text-[9px] uppercase tracking-wider font-mono">SCRATCH</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 判定結果 */}
        <div className="space-y-2 min-h-[60px] flex flex-col items-center justify-center">
          {isScratching ? (
            <p className="text-xs text-muted font-bold animate-pulse">
              銀の膜を削っています... 結果まで少々お待ちください！
            </p>
          ) : (
            <div className="animate-in fade-in zoom-in duration-300 space-y-1">
              <div className="text-3xl font-black font-mono text-primary-600 flex items-center justify-center gap-1.5">
                <Coins size={24} className="text-primary-500" />
                <span>+{resultData.prize.toLocaleString()} 🪙</span>
              </div>
              <p className="text-xs text-muted-strong font-bold">
                {resultData.netChange > 0
                  ? `🎉 おめでとうございます！ 純増 +${resultData.netChange.toLocaleString()}コインの利益！`
                  : resultData.netChange === 0
                  ? '⚖️ トントン！元金回収成功！'
                  : `🍃 残念！参加賞として ${resultData.prize}コイン を獲得しました。`}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          disabled={isScratching}
          className={`w-full py-3 rounded-2xl font-black text-sm transition-all shadow-md ${
            isScratching
              ? 'bg-black/10 text-faint cursor-not-allowed'
              : 'bg-stone-900 hover:bg-primary-600 text-white cursor-pointer'
          }`}
        >
          {isScratching ? '削り中...' : '閉じる'}
        </button>
      </div>
    </div>
  );
}
