'use client';

import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Coins, X, CheckCircle2 } from 'lucide-react';

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
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !resultData) {
      confettiFiredRef.current = false;
      return;
    }

    // 2等以上なら自動で祝賀紙吹雪
    if (!confettiFiredRef.current && resultData.prize >= 250) {
      confettiFiredRef.current = true;
      try {
        confetti({
          particleCount: resultData.prize >= 800 ? 120 : 60,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#ec4899', '#3b82f6', '#10b981'],
        });
      } catch {}
    }
  }, [isOpen, resultData]);

  if (!isOpen || !resultData) return null;

  const isWin = resultData.prize >= 250;
  const isJackpot = resultData.prize >= 800;

  const handleClose = () => {
    onClose();
    if (onFinished) onFinished();
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
      <div className="relative w-full max-w-sm rounded-3xl bg-surface border-2 border-primary-edge shadow-2xl p-6 text-center space-y-5 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {/* 背景の装飾グロー */}
        <div
          className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-30 ${
            isJackpot ? 'bg-primary-500' : isWin ? 'bg-secondary-500' : 'bg-stone-500'
          }`}
        />

        {/* 閉じるボタン（常時クリック可能） */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full text-muted hover:text-foreground hover:bg-black/10 transition-colors cursor-pointer z-10"
          title="閉じる"
        >
          <X size={18} />
        </button>

        {/* ヘッダー情報 */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-edge-strong/30 text-primary-900 text-xs font-black">
            <Sparkles size={13} className="text-primary-600 animate-pulse" />
            <span>🥠 闇のスクラッチくじ結果</span>
          </div>
          <h3 className="text-xl font-black text-foreground animate-in zoom-in-95 duration-200">
            {resultData.tier}
          </h3>
        </div>

        {/* スクラッチ開封マス（3マス） - CSSアニメーションで瞬時に美しく開示 */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-black/10 border border-black/10">
          {[0, 1, 2].map((idx) => {
            return (
              <div
                key={idx}
                style={{ animationDelay: `${idx * 150}ms` }}
                className="h-24 rounded-xl flex flex-col items-center justify-center bg-gradient-to-br from-stone-900 via-stone-850 to-black text-white shadow-lg border border-white/10 animate-in zoom-in-50 duration-300"
              >
                <div className="space-y-1 flex flex-col items-center justify-center">
                  <span className="text-3xl filter drop-shadow-md">{resultData.icon}</span>
                  <p className="text-[11px] text-primary-400 font-mono font-black">+{resultData.prize}🪙</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 判定結果と獲得コイン表示 */}
        <div className="space-y-2 py-1 flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="text-3xl font-black font-mono text-primary-600 flex items-center justify-center gap-1.5">
            <Coins size={24} className="text-primary-500" />
            <span>+{resultData.prize.toLocaleString()} 🪙</span>
          </div>
          <p className="text-xs text-muted-strong font-bold leading-relaxed px-2">
            {resultData.netChange > 0
              ? `🎉 おめでとうございます！ 純増 +${resultData.netChange.toLocaleString()}コイン の利益獲得！`
              : resultData.netChange === 0
              ? '⚖️ トントン！元金全額回収成功！'
              : `🍃 参加賞として ${resultData.prize}コイン を獲得しました！`}
          </p>
        </div>

        {/* 完了ボタン（即座に確実に閉じる） */}
        <button
          type="button"
          onClick={handleClose}
          className="w-full py-3.5 px-4 rounded-2xl font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white active:scale-[0.99]"
        >
          <CheckCircle2 size={16} />
          <span>コインを受け取って閉じる ✨</span>
        </button>
      </div>
    </div>
  );
}
