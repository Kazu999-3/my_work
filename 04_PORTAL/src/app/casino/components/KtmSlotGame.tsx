'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, Trophy, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { SlotResult, SlotSymbol } from '../../api/bet/slot/route';

interface KtmSlotGameProps {
  userCoins: number;
  onBalanceChange: (newBalance: number) => void;
}

const SYMBOL_ICONS: Record<SlotSymbol, { emoji: string; name: string; color: string }> = {
  gem: { emoji: '💎', name: 'ジェム', color: 'text-cyan-400' },
  baron: { emoji: '👾', name: 'バロン', color: 'text-purple-400' },
  dragon: { emoji: '🐉', name: 'ドラゴン', color: 'text-amber-500' },
  sword: { emoji: '🗡️', name: 'ソード', color: 'text-rose-400' },
  poro: { emoji: '🐹', name: 'ポロ', color: 'text-emerald-400' },
  minion: { emoji: '🧙', name: 'ミニオン', color: 'text-blue-400' },
  potion: { emoji: '🧪', name: 'ポーション', color: 'text-red-400' },
};

const ALL_SYMBOLS: SlotSymbol[] = ['gem', 'baron', 'dragon', 'sword', 'poro', 'minion', 'potion'];

export default function KtmSlotGame({ userCoins, onBalanceChange }: KtmSlotGameProps) {
  const [betAmount, setBetAmount] = useState<number>(100);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [displayReels, setDisplayReels] = useState<[SlotSymbol, SlotSymbol, SlotSymbol]>(['poro', 'gem', 'dragon']);
  const [lastResult, setLastResult] = useState<SlotResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const spinIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleSpin = async () => {
    if (isSpinning) return;
    if (userCoins < betAmount) {
      setErrorMsg(`コインが足りません (所持: ${userCoins}🪙 / 必要: ${betAmount}🪙)`);
      return;
    }

    setErrorMsg(null);
    setLastResult(null);
    setIsSpinning(true);

    // リール回転アニメーション開始（ダミー高速切り替え）
    spinIntervalRef.current = setInterval(() => {
      setDisplayReels([
        ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)],
        ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)],
        ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)],
      ]);
    }, 80);

    try {
      const res = await fetch('/api/bet/slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betAmount }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '通信に失敗しました');
      }

      const result: SlotResult = data.result;

      // 順次リール停止アニメーション（1.2秒後、1.6秒後、2.0秒後に停止）
      setTimeout(() => {
        setDisplayReels((prev) => [result.reels[0], prev[1], prev[2]]);
      }, 1000);

      setTimeout(() => {
        setDisplayReels((prev) => [result.reels[0], result.reels[1], prev[2]]);
      }, 1500);

      setTimeout(() => {
        if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
        setDisplayReels(result.reels);
        setIsSpinning(false);
        setLastResult(result);
        onBalanceChange(result.newBalance);

        // 当たり時の演出
        if (result.payoutMultiplier >= 15) {
          confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
        } else if (result.payoutMultiplier >= 2) {
          confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
        }
      }, 2000);
    } catch (e: any) {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      setIsSpinning(false);
      setErrorMsg(e.message || 'エラーが発生しました');
    }
  };

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, []);

  return (
    <div className="bg-gradient-to-b from-stone-900 via-[#1c1917] to-stone-950 border border-stone-800 rounded-3xl p-5 sm:p-7 text-white shadow-xl space-y-6 max-w-2xl mx-auto">
      {/* タイトルヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-400 p-0.5 shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-stone-900 rounded-[14px] flex items-center justify-center text-2xl">
              🎰
            </div>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500">
              KTM HEXTECH SLOTS
            </h2>
            <p className="text-xs text-stone-400">
              3つの絵柄を揃えて一攫千金！ジェム揃いで最大 **50倍** ジャックポット！
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-stone-800/70 border border-stone-700/60 px-3.5 py-1.5 rounded-xl self-start sm:self-center">
          <span className="text-xs text-stone-400">所持コイン:</span>
          <span className="text-sm font-black text-amber-400 font-mono">
            {userCoins.toLocaleString()} 🪙
          </span>
        </div>
      </div>

      {/* スロットマシン筐体 */}
      <div className="bg-stone-950 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-inner relative overflow-hidden space-y-5">
        {/* 電飾・筐体ヘッダー */}
        <div className="flex items-center justify-between text-[11px] font-black text-amber-400/80 px-1 uppercase tracking-wider">
          <span>● REEL 1</span>
          <span className="animate-pulse text-amber-400 font-bold">★ JACKPOT 50x ★</span>
          <span>● REEL 3</span>
        </div>

        {/* 3リール表示枠 */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 bg-stone-900/90 border border-stone-800 p-3 sm:p-4 rounded-2xl shadow-inner">
          {displayReels.map((symbol, idx) => {
            const sym = SYMBOL_ICONS[symbol] || SYMBOL_ICONS.poro;
            return (
              <div
                key={idx}
                className={`h-28 sm:h-36 rounded-xl bg-gradient-to-b from-stone-950 to-stone-900 border-2 ${
                  isSpinning
                    ? 'border-amber-400/80 shadow-md shadow-amber-500/20 animate-pulse'
                    : lastResult && lastResult.payoutMultiplier > 0
                    ? 'border-emerald-500 shadow-lg shadow-emerald-500/30'
                    : 'border-stone-800'
                } flex flex-col items-center justify-center transition-all`}
              >
                <span className={`text-4xl sm:text-6xl select-none ${isSpinning ? 'scale-110 blur-[0.5px]' : 'scale-100'} transition-transform`}>
                  {sym.emoji}
                </span>
                <span className={`text-[10px] sm:text-xs font-black mt-2 ${sym.color}`}>
                  {sym.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* 結果テキスト表示 */}
        {lastResult && (
          <div
            className={`p-3 rounded-2xl text-center text-xs font-black border transition-all animate-in zoom-in-95 ${
              lastResult.payoutMultiplier >= 15
                ? 'bg-gradient-to-r from-purple-950/80 via-amber-950/80 to-purple-950/80 border-purple-500/80 text-yellow-300 shadow-lg shadow-amber-500/20'
                : lastResult.payoutMultiplier > 0
                ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300'
                : 'bg-stone-900/80 border-stone-800 text-stone-400'
            }`}
          >
            <p className="text-sm sm:text-base">{lastResult.message}</p>
            {lastResult.winCoins > 0 && (
              <p className="text-xs text-amber-400 font-extrabold mt-0.5">
                +{lastResult.winCoins.toLocaleString()} 🪙 獲得！ (手取り: +{lastResult.winCoins - lastResult.betAmount} 🪙)
              </p>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-1.5 justify-center">
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 操作パネル: ベット選択 ＆ スピンボタン */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-stone-400 mr-1">ベット額:</span>
            {[100, 500, 1000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setBetAmount(amt)}
                disabled={isSpinning}
                className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  betAmount === amt
                    ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/30 font-extrabold ring-2 ring-yellow-300'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                } disabled:opacity-50`}
              >
                {amt} 🪙
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSpin}
            disabled={isSpinning || userCoins < betAmount}
            className={`w-full sm:w-44 py-3 sm:py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
              isSpinning
                ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-stone-950 shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.02] active:scale-95'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <RefreshCw size={16} className={isSpinning ? 'animate-spin' : ''} />
            <span>{isSpinning ? 'SPINNING...' : '🎰 スピン！'}</span>
          </button>
        </div>
      </div>

      {/* 配当一覧（ペイアウト表） */}
      <div className="bg-stone-950/60 border border-stone-800/80 rounded-2xl p-4 space-y-2.5 text-xs">
        <h4 className="font-extrabold text-stone-300 flex items-center gap-1.5 text-xs">
          <Trophy size={14} className="text-amber-400" />
          <span>絵柄と配当倍率一覧</span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div className="bg-stone-900/70 p-2 rounded-xl border border-stone-800/80 flex items-center justify-between">
            <span>💎 x3 (ジェム)</span>
            <span className="font-black text-cyan-400 font-mono">50倍 👑</span>
          </div>
          <div className="bg-stone-900/70 p-2 rounded-xl border border-stone-800/80 flex items-center justify-between">
            <span>👾 x3 (バロン)</span>
            <span className="font-black text-purple-400 font-mono">15倍 🔥</span>
          </div>
          <div className="bg-stone-900/70 p-2 rounded-xl border border-stone-800/80 flex items-center justify-between">
            <span>🐉 x3 (ドラゴン)</span>
            <span className="font-black text-amber-400 font-mono">5倍</span>
          </div>
          <div className="bg-stone-900/70 p-2 rounded-xl border border-stone-800/80 flex items-center justify-between">
            <span>🗡️ x3 (ソード)</span>
            <span className="font-black text-rose-400 font-mono">3倍</span>
          </div>
          <div className="bg-stone-900/70 p-2 rounded-xl border border-stone-800/80 flex items-center justify-between">
            <span>🐹 x3 (ポロ)</span>
            <span className="font-black text-emerald-400 font-mono">2倍</span>
          </div>
          <div className="bg-stone-900/70 p-2 rounded-xl border border-stone-800/80 flex items-center justify-between">
            <span>💎 x2 (ジェム2個)</span>
            <span className="font-bold text-cyan-300 font-mono">1.5倍</span>
          </div>
          <div className="bg-stone-900/70 p-2 rounded-xl border border-stone-800/80 flex items-center justify-between col-span-2">
            <span>🐹 x2 (ポロ2個)</span>
            <span className="font-bold text-emerald-300 font-mono">1倍 (元返し)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
