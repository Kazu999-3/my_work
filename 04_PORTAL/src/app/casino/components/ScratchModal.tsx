'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Coins, X, FastForward } from 'lucide-react';

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

  // onFinished を ref で保持し、親の再レンダリングによる useEffect ループ／タイマー中断を防止
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  const hasRevealedRef = useRef(false);

  const reveal = useCallback(() => {
    if (hasRevealedRef.current) return;
    hasRevealedRef.current = true;
    setScratchedCount(3);
    setIsScratching(false);

    if (resultData && resultData.prize >= 250) {
      try {
        confetti({
          particleCount: resultData.prize >= 800 ? 120 : 60,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#ec4899', '#3b82f6', '#10b981'],
        });
      } catch {}
    }
    onFinishedRef.current?.();
  }, [resultData]);

  useEffect(() => {
    if (!isOpen || !resultData) return;

    hasRevealedRef.current = false;
    setIsScratching(true);
    setScratchedCount(0);

    const timer1 = setTimeout(() => setScratchedCount(1), 300);
    const timer2 = setTimeout(() => setScratchedCount(2), 650);
    const timer3 = setTimeout(() => {
      reveal();
    }, 1000);

    // 安全策: 万一ブラウザ遅延やバックグラウンド移行時でも最大1.5秒で確実に結果確定
    const safetyTimer = setTimeout(() => {
      reveal();
    }, 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(safetyTimer);
    };
  }, [isOpen, resultData, reveal]);

  if (!isOpen || !resultData) return null;

  const isWin = resultData.prize >= 250; // 2等以上（2026-10-17 当選額変更に合わせた）
  const isJackpot = resultData.prize >= 800; // 1等以上

  const handleClose = () => {
    if (isScratching) {
      reveal();
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-surface border-2 border-primary-edge shadow-2xl p-6 text-center space-y-6 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {/* 背景の装飾グロー */}
        <div
          className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-30 ${
            isJackpot ? 'bg-primary-500' : isWin ? 'bg-secondary-500' : 'bg-stone-500'
          }`}
        />

        {/* 閉じるボタン（削り中でも安全に押下可能） */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full text-muted hover:text-foreground hover:bg-black/10 transition-colors cursor-pointer z-10"
          title="閉じる"
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

        {/* スクラッチ削り窓（3マス - タップで即時開封可能） */}
        <div
          onClick={isScratching ? reveal : undefined}
          className={`grid grid-cols-3 gap-2 p-3 rounded-2xl bg-black/10 border border-black/10 transition-colors ${
            isScratching ? 'cursor-pointer hover:bg-black/15' : ''
          }`}
          title={isScratching ? 'クリックで即時開封！' : undefined}
        >
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
              銀の膜を削っています...（タップで即スキップ可）
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

        {/* アクションボタン: 削り中はスキップ、完了後は閉じる */}
        <button
          type="button"
          onClick={isScratching ? reveal : handleClose}
          className={`w-full py-3 rounded-2xl font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
            isScratching
              ? 'bg-primary-500/15 hover:bg-primary-500/25 text-primary-900 dark:text-primary-200 border border-primary-edge-soft'
              : 'bg-stone-900 hover:bg-primary-600 text-white'
          }`}
        >
          {isScratching ? (
            <>
              <FastForward size={16} />
              <span>タップして結果を見る</span>
            </>
          ) : (
            <span>コインを受け取って閉じる ✨</span>
          )}
        </button>
      </div>
    </div>
  );
}
