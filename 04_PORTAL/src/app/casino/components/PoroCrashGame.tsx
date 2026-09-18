'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Rocket, ShieldAlert, Zap, TrendingUp, AlertCircle, History } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PoroCrashGameProps {
  userCoins: number;
  onBalanceChange: (newBalance: number) => void;
}

type GameState = 'IDLE' | 'FLYING' | 'CRASHED' | 'CASHED_OUT';

export default function PoroCrashGame({ userCoins, onBalanceChange }: PoroCrashGameProps) {
  const [betAmount, setBetAmount] = useState<number>(100);
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [gameToken, setGameToken] = useState<string | null>(null);
  const [crashHistory, setCrashHistory] = useState<number[]>([1.84, 1.25, 4.12, 1.05, 12.4]);
  const [finalMultiplier, setFinalMultiplier] = useState<number>(1.0);
  const [winCoins, setWinCoins] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const secretCrashPointRef = useRef<number>(2.0); // サーバーから取得したクラッシュ限界値

  // ゲーム開始（発射）
  const handleLaunch = async () => {
    if (gameState === 'FLYING') return;
    if (userCoins < betAmount) {
      setErrorMsg(`コインが足りません (所持: ${userCoins}🪙 / 必要: ${betAmount}🪙)`);
      return;
    }

    setErrorMsg(null);
    setGameState('FLYING');
    setMultiplier(1.0);
    setWinCoins(0);

    try {
      const res = await fetch('/api/bet/crash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START', betAmount }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '発射に失敗しました');
      }

      setGameToken(data.gameToken);
      onBalanceChange(data.newBalance);

      // サーバー側トークンからクラッシュポイントを検証用APIで取得（クライアントの爆発演出用）
      const verifyRes = await fetch('/api/bet/crash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'VERIFY_CRASH', gameToken: data.gameToken }),
      });
      const vData = await verifyRes.json();
      secretCrashPointRef.current = vData.crashPoint || 1.5;

      // カウントアップ・上昇アニメーション開始
      startTimeRef.current = performance.now();
      runFlightAnimation();
    } catch (e: any) {
      setGameState('IDLE');
      setErrorMsg(e.message || 'エラーが発生しました');
    }
  };

  // 飛行アニメーションループ
  const runFlightAnimation = () => {
    const loop = (now: number) => {
      const elapsed = (now - startTimeRef.current) / 1000; // 秒数
      // 指数関数的カーブで倍率計算 (0秒=1.0x, 2秒=1.5x, 5秒=3.0x, 10秒=10x)
      const current = Math.floor(Math.pow(Math.E, elapsed * 0.22) * 100) / 100;

      const crashLimit = secretCrashPointRef.current;

      if (current >= crashLimit) {
        // 💥 クラッシュ（爆発）！
        setMultiplier(crashLimit);
        setFinalMultiplier(crashLimit);
        setGameState('CRASHED');
        setCrashHistory((prev) => [crashLimit, ...prev.slice(0, 5)]);
        return;
      }

      setMultiplier(current);
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  };

  // 利確（キャッシュアウト）
  const handleCashout = async () => {
    if (gameState !== 'FLYING' || !gameToken) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const claimMult = multiplier;

    try {
      const res = await fetch('/api/bet/crash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CASHOUT',
          gameToken,
          claimedMultiplier: claimMult,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setGameState('CASHED_OUT');
        setFinalMultiplier(data.multiplier);
        setWinCoins(data.winCoins);
        onBalanceChange(data.newBalance);

        if (data.multiplier >= 5.0) {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
        } else {
          confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
        }
      } else {
        setGameState('CRASHED');
        setFinalMultiplier(data.actualCrash || claimMult);
      }
    } catch {
      setGameState('CRASHED');
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // ロケットのY軸位置（倍率に応じた高さ）
  const progressHeight = Math.min(85, (multiplier - 1.0) * 18);

  return (
    <div className="bg-gradient-to-b from-stone-900 via-[#1c1917] to-stone-950 border border-stone-800 rounded-3xl p-5 sm:p-7 text-white shadow-xl space-y-6 max-w-2xl mx-auto">
      {/* タイトルヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-stone-900 rounded-[14px] flex items-center justify-center text-2xl">
              🚀
            </div>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-teal-300 to-emerald-400">
              PORO ROCKET CRASH
            </h2>
            <p className="text-xs text-stone-400">
              ポロのロケットが空へ上昇！爆発する前に脱出して倍率コインを獲得せよ！
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

      {/* 直近のクラッシュ履歴バー */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono scrollbar-none">
        <span className="text-stone-500 flex items-center gap-1 shrink-0 mr-1">
          <History size={12} /> 履歴:
        </span>
        {crashHistory.map((h, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 rounded-lg border font-bold shrink-0 ${
              h >= 5.0
                ? 'bg-purple-950/70 border-purple-500/60 text-purple-300'
                : h >= 2.0
                ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300'
                : 'bg-stone-800/70 border-stone-700 text-stone-400'
            }`}
          >
            {h.toFixed(2)}x
          </span>
        ))}
      </div>

      {/* フライト画面（夜空・大気圏） */}
      <div className="h-64 sm:h-72 bg-gradient-to-b from-indigo-950/40 via-stone-950 to-stone-900 border-2 border-stone-800 rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between shadow-inner">
        {/* 背景の星屑 */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

        {/* 倍率大表示 */}
        <div className="relative z-10 text-center pt-2">
          {gameState === 'CRASHED' ? (
            <div className="animate-bounce">
              <span className="text-4xl sm:text-6xl font-black font-mono text-rose-500 drop-shadow-md">
                💥 {finalMultiplier.toFixed(2)}x
              </span>
              <p className="text-xs font-bold text-rose-400 mt-1">CRASHED! ロケット爆発！</p>
            </div>
          ) : gameState === 'CASHED_OUT' ? (
            <div className="animate-in zoom-in-95">
              <span className="text-4xl sm:text-6xl font-black font-mono text-emerald-400 drop-shadow-md">
                🎉 {finalMultiplier.toFixed(2)}x
              </span>
              <p className="text-xs font-bold text-emerald-300 mt-1">
                +{winCoins.toLocaleString()} 🪙 利確成功！お見事！
              </p>
            </div>
          ) : (
            <div>
              <span
                className={`text-5xl sm:text-7xl font-black font-mono transition-colors drop-shadow-md ${
                  multiplier >= 5.0
                    ? 'text-purple-400'
                    : multiplier >= 2.0
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {multiplier.toFixed(2)}x
              </span>
              <p className="text-xs font-bold text-stone-400 mt-1">
                {gameState === 'FLYING' ? '🚀 上昇中！爆発前に利確せよ！' : '待機中... ベットして発射！'}
              </p>
            </div>
          )}
        </div>

        {/* 上昇するポロ・ロケット */}
        <div className="relative z-10 w-full h-24">
          <div
            className="absolute left-1/2 -translate-x-1/2 transition-all duration-100 flex flex-col items-center"
            style={{
              bottom: `${progressHeight}%`,
            }}
          >
            {gameState === 'CRASHED' ? (
              <span className="text-4xl animate-ping">💥</span>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-4xl select-none animate-pulse">🐹🚀</span>
                {gameState === 'FLYING' && (
                  <span className="text-xs font-mono font-black text-yellow-400 animate-bounce">
                    🔥
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 下部地面ライン */}
        <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-stone-500 border-t border-stone-800/80 pt-1">
          <span>地面 (1.00x)</span>
          <span>大気圏突破 (10.00x+)</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-1.5 justify-center">
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 操作パネル: ベット選択 ＆ 発射/利確ボタン */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-stone-400 mr-1">ベット額:</span>
          {[50, 100, 300, 500, 1000].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setBetAmount(amt)}
              disabled={gameState === 'FLYING'}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                betAmount === amt
                  ? 'bg-emerald-500 text-stone-950 shadow-md shadow-emerald-500/30 font-extrabold ring-2 ring-teal-300'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
              } disabled:opacity-50`}
            >
              {amt} 🪙
            </button>
          ))}
        </div>

        {/* アクションボタン */}
        {gameState === 'FLYING' ? (
          <button
            type="button"
            onClick={handleCashout}
            className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-wider bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-stone-950 shadow-lg shadow-emerald-500/40 animate-pulse hover:scale-[1.01] active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>💰 {(betAmount * multiplier).toFixed(0)} 🪙 で今すぐ利確！ ({multiplier.toFixed(2)}x)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLaunch}
            disabled={userCoins < betAmount}
            className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-wider bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 hover:from-teal-400 hover:to-emerald-400 text-stone-950 shadow-lg shadow-teal-500/30 hover:scale-[1.01] active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Rocket size={18} />
            <span>🚀 {betAmount} 🪙 でロケット発射！</span>
          </button>
        )}
      </div>

      {/* ゲームルール */}
      <div className="bg-stone-950/60 border border-stone-800/80 rounded-2xl p-4 text-xs space-y-1.5 text-stone-400 leading-relaxed">
        <h4 className="font-extrabold text-stone-300 flex items-center gap-1.5 text-xs">
          <Zap size={13} className="text-yellow-400" />
          <span>ポロ・チキンレースの掟</span>
        </h4>
        <p>
          • ロケットは発射後、徐々に倍率を上げながら宇宙へ上昇します。<br />
          • **ロケットが爆発する前に「利確」ボタンを押せば、現在の倍率 × ベット額のコインを獲得！**<br />
          • 爆発してしまったらベット額は全額没収。どこまで粘れるかの究極の心理戦です！
        </p>
      </div>
    </div>
  );
}
