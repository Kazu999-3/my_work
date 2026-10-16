'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { toast } from '../../../components/Toaster';
import {
  PLINKO_ROWS,
  PLINKO_SLOT_COUNT,
  PLINKO_ALLOWED_BETS,
  PLINKO_PAYOUT_TABLES,
  PLINKO_RISK_LABELS,
  type PlinkoRisk,
} from '../../../lib/plinkoMath';
import type { PlinkoApiResult } from '../../api/bet/plinko/route';

interface KtmPlinkoGameProps {
  userCoins: number;
  onBalanceChange: (newBalance: number) => void;
}

// 落下中の玉オブジェクト
interface PlinkoBall {
  id: string;
  currentStep: number; // 0 〜 PLINKO_ROWS
  progress: number; // 0.0 〜 1.0 (各段の移動進捗)
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetCol: number; // 現在の段における目標列インデックス
  path: number[]; // [0, 1, 0, 1...]
  slotIndex: number; // サーバーが決めた最終ポケット（着弾位置はこれを正とする）
  multiplier: number;
  winCoins: number;
  betAmount: number;
  isJackpot: boolean;
  color: string;
}

// ピンの座標
interface Pin {
  x: number;
  y: number;
  lit: number; // 発光タイマー (0.0 〜 1.0)
}

// ポケットのバウンス
interface SlotBounce {
  scale: number;
  lit: number;
}

export default function KtmPlinkoGame({ userCoins, onBalanceChange }: KtmPlinkoGameProps) {
  const [betAmount, setBetAmount] = useState<number>(100);
  const [risk, setRisk] = useState<PlinkoRisk>('medium');
  const [isDropping, setIsDropping] = useState<boolean>(false);
  const [recentWins, setRecentWins] = useState<Array<{ mult: number; coins: number; isJackpot: boolean }>>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<PlinkoBall[]>([]);
  const pinsRef = useRef<Pin[][]>([]);
  const slotBouncesRef = useRef<SlotBounce[]>(Array.from({ length: PLINKO_SLOT_COUNT }, () => ({ scale: 1, lit: 0 })));
  const animFrameIdRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Web Audio SE（外部ファイル不要・遅延ゼロ）
  const playBounceSound = useCallback((freq = 700) => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state === 'suspended') {
        ctx?.resume();
        return;
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {}
  }, []);

  const playWinSound = useCallback((isJackpot: boolean) => {
    try {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const freqs = isJackpot ? [523, 659, 784, 1046] : [440, 554, 659];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, ctx.currentTime + idx * 0.07);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.07);
        osc.stop(ctx.currentTime + idx * 0.07 + 0.2);
      });
    } catch {}
  }, []);

  // Canvas初期化＆ピン座標計算
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = 440;
    const height = 480;
    canvas.width = width * 2; // Retina用 2x
    canvas.height = height * 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const startY = 40;
    const rowHeight = 36;
    const pins: Pin[][] = [];

    for (let r = 0; r < PLINKO_ROWS; r++) {
      const pinCount = r + 3;
      const spacing = 32;
      const rowWidth = (pinCount - 1) * spacing;
      const startX = (width - rowWidth) / 2;
      const rowPins: Pin[] = [];
      for (let c = 0; c < pinCount; c++) {
        rowPins.push({
          x: startX + c * spacing,
          y: startY + r * rowHeight,
          lit: 0,
        });
      }
      pins.push(rowPins);
    }
    pinsRef.current = pins;
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  // アニメーションループ (60fps Canvas描画)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;
      ctx.save();
      ctx.scale(2, 2); // Retinaスケール

      const width = 440;
      const height = 480;

      // 背景クリア (ダークネオンカジノ調)
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, width, height);

      // グリッド背景の装飾
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // ピンの描画
      const pins = pinsRef.current;
      for (let r = 0; r < pins.length; r++) {
        for (let c = 0; c < pins[r].length; c++) {
          const pin = pins[r][c];
          if (pin.lit > 0) {
            // ピン発光エフェクト
            ctx.beginPath();
            ctx.arc(pin.x, pin.y, 6 + pin.lit * 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(245, 158, 11, ${pin.lit * 0.8})`;
            ctx.fill();
            pin.lit = Math.max(0, pin.lit - 0.06);
          }

          ctx.beginPath();
          ctx.arc(pin.x, pin.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = pin.lit > 0 ? '#fbbf24' : '#78716c';
          ctx.fill();
        }
      }

      // 最下部ポケット (スロット) の描画
      const currentTable = PLINKO_PAYOUT_TABLES[risk];
      const slotY = 415;
      const slotWidth = 32;
      const slotSpacing = 4;
      const totalSlotsWidth = PLINKO_SLOT_COUNT * slotWidth + (PLINKO_SLOT_COUNT - 1) * slotSpacing;
      const slotStartX = (width - totalSlotsWidth) / 2;

      for (let s = 0; s < PLINKO_SLOT_COUNT; s++) {
        const mult = currentTable[s];
        const sx = slotStartX + s * (slotWidth + slotSpacing);
        const sb = slotBouncesRef.current[s] || { scale: 1, lit: 0 };

        // 倍率ごとの色分け
        let bgGrad = '#292524';
        let textCol = '#a8a29e';
        let borderCol = '#44403c';

        if (mult >= 20.0) {
          bgGrad = sb.lit > 0 ? '#ef4444' : '#7f1d1d';
          textCol = '#fef2f2';
          borderCol = '#dc2626';
        } else if (mult >= 4.0) {
          bgGrad = sb.lit > 0 ? '#f59e0b' : '#78350f';
          textCol = '#fffbeb';
          borderCol = '#d97706';
        } else if (mult >= 1.2) {
          bgGrad = sb.lit > 0 ? '#14b8a6' : '#134e4a';
          textCol = '#f0fdfa';
          borderCol = '#0d9488';
        } else {
          bgGrad = sb.lit > 0 ? '#44403c' : '#292524';
          textCol = '#d6d3d1';
          borderCol = '#57534e';
        }

        ctx.save();
        ctx.translate(sx + slotWidth / 2, slotY + 16);
        ctx.scale(sb.scale, sb.scale);

        // ポケット枠
        ctx.fillStyle = bgGrad;
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-slotWidth / 2, -14, slotWidth, 28, 6);
        ctx.fill();
        ctx.stroke();

        // 倍率テキスト
        ctx.fillStyle = textCol;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${mult}x`, 0, 0);

        ctx.restore();

        // ポケットのバウンス減衰
        if (sb.scale > 1) sb.scale = Math.max(1, sb.scale - 0.05);
        if (sb.lit > 0) sb.lit = Math.max(0, sb.lit - 0.05);
      }

      // ボール（爆弾）の更新＆描画
      const balls = ballsRef.current;
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];

        // 各段の移動進捗
        b.progress += 0.07; // 落下速度
        if (b.progress >= 1.0) {
          b.progress = 0;
          b.currentStep++;

          // ピン衝突判定。段 s-1 → s の移動には path[s-1] を使う（path[0]〜path[8] で最下段まで、
          // 最後の path[9] は最下段からポケットへの1回）。
          // 2026-10-16: 以前は path[b.currentStep] を使っていたため path[0] が一度も反映されず、
          // 1段目が「左」の落下（全体の半分）で、見た目のポケットがサーバー結果より1つ右にずれていた。
          if (b.currentStep < PLINKO_ROWS) {
            const nextChoice = b.path[b.currentStep - 1] || 0;
            b.targetCol += nextChoice;

            const targetPin = pins[b.currentStep]?.[b.targetCol];
            if (targetPin) {
              targetPin.lit = 1.0;
              playBounceSound(600 + b.currentStep * 40);
            }
          }
        }

        // 座標計算
        if (b.currentStep < PLINKO_ROWS) {
          const toRow = b.currentStep;
          // 投下直後（段0）は上空から頂点のピンへ、それ以降は直前の段のピンから
          const fromPin = toRow === 0
            ? { x: width / 2, y: 15 }
            : pins[toRow - 1]?.[Math.max(0, b.targetCol - (b.path[toRow - 1] || 0))] || { x: width / 2, y: 15 };
          const toPin = pins[toRow]?.[b.targetCol] || { x: width / 2, y: 40 + toRow * 36 };

          // 放物線状のバウンド移動
          const t = b.progress;
          const bounceArc = Math.sin(t * Math.PI) * 6;
          b.x = fromPin.x + (toPin.x - fromPin.x) * t;
          b.y = fromPin.y + (toPin.y - fromPin.y) * t - bounceArc;
        } else {
          // 最下部ポケットへ吸い込まれる
          const lastPin = pins[PLINKO_ROWS - 1]?.[b.targetCol] || { x: width / 2, y: 380 };
          // 着弾ポケットはサーバーの slotIndex を正とする（= 最下段の列 - 1 + path[9] と一致する）
          const landingSlot = Math.min(PLINKO_SLOT_COUNT - 1, Math.max(0, b.slotIndex));
          const targetSlotX = slotStartX + landingSlot * (slotWidth + slotSpacing) + slotWidth / 2;
          const t = Math.min(1.0, b.progress * 1.5);

          b.x = lastPin.x + (targetSlotX - lastPin.x) * t;
          b.y = lastPin.y + (slotY + 12 - lastPin.y) * t;

          // 着弾！
          if (t >= 1.0) {
            const sb = slotBouncesRef.current[landingSlot];
            if (sb) {
              sb.scale = 1.35;
              sb.lit = 1.0;
            }

            playWinSound(b.isJackpot);

            if (b.isJackpot) {
              try {
                confetti({
                  particleCount: 70,
                  spread: 60,
                  origin: { y: 0.7 },
                  colors: ['#ef4444', '#f59e0b', '#14b8a6', '#ec4899'],
                });
              } catch {}
              toast.success(`💥 【JACKPOT】${b.multiplier}倍直撃！ (+${b.winCoins}🪙)`);
            } else if (b.multiplier >= 1.0) {
              toast.success(`🎉 ${b.multiplier}倍！ (+${b.winCoins}🪙)`);
            }

            setRecentWins((prev) => [{ mult: b.multiplier, coins: b.winCoins, isJackpot: b.isJackpot }, ...prev.slice(0, 7)]);
            balls.splice(i, 1);
            continue;
          }
        }

        // 爆弾本体の描画 (ジグス風・火花エフェクト)
        ctx.save();
        // 炎の残光
        ctx.beginPath();
        ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = b.isJackpot ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.3)';
        ctx.fill();

        // 黒い球体
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#451a03';
        ctx.fill();
        ctx.strokeStyle = b.isJackpot ? '#ef4444' : '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 導火線の火花
        ctx.beginPath();
        ctx.arc(b.x + 2, b.y - 4, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);
    return () => {
      running = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [risk, playBounceSound, playWinSound]);

  // ドロップ実行
  const handleDrop = async () => {
    if (userCoins < betAmount) {
      toast.error(`コインが不足しています (所持: ${userCoins}🪙 / 必要: ${betAmount}🪙)`);
      return;
    }

    setIsDropping(true);
    // 即時残高を仮引きして連打できるようにする
    onBalanceChange(userCoins - betAmount);

    try {
      const res = await fetch('/api/bet/plinko', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betAmount, risk }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        // 失敗時は差し戻し
        onBalanceChange(userCoins);
        toast.error(data.error || '通信に失敗しました');
        return;
      }

      const r: PlinkoApiResult = data.result;
      onBalanceChange(r.newBalance);

      // 落下するボールを登録
      const newBall: PlinkoBall = {
        id: Math.random().toString(36).slice(2),
        currentStep: 0,
        progress: 0,
        x: 220,
        y: 15,
        vx: 0,
        vy: 0,
        targetCol: 1, // 頂点ピン(3本)の中央
        path: r.path,
        slotIndex: r.slotIndex,
        multiplier: r.multiplier,
        winCoins: r.winCoins,
        betAmount: r.betAmount,
        isJackpot: r.isJackpot,
        color: r.isJackpot ? '#ef4444' : '#f59e0b',
      };

      ballsRef.current.push(newBall);
    } catch (err: any) {
      onBalanceChange(userCoins);
      toast.error(err.message || 'エラーが発生しました');
    } finally {
      setIsDropping(false);
    }
  };

  const riskMeta = PLINKO_RISK_LABELS[risk];

  return (
    <div className="bg-surface/90 dark:bg-stone-900/90 border border-border/80 rounded-2xl p-4 md:p-6 shadow-xl backdrop-blur-md space-y-5 max-w-2xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💣</span>
          <div>
            <h3 className="text-base font-black text-foreground flex items-center gap-1.5">
              <span>ジグスのバウンド爆弾</span>
              <span className="text-[10px] bg-red-950/60 text-red-300 border border-red-800/80 px-2 py-0.5 rounded-full font-bold">
                Plinko
              </span>
            </h3>
            <p className="text-[11px] text-muted-strong">
              ピンに跳ねる爆弾の行方を見届けろ！端っこポケットで一攫千金（最大75倍）
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-muted-strong block">所持コイン</span>
          <span className="text-sm font-black text-amber-500 font-mono">{userCoins.toLocaleString()} 🪙</span>
        </div>
      </div>

      {/* ゲームエリア (Canvas) */}
      <div className="flex justify-center bg-stone-950 rounded-2xl p-2 border border-stone-800 shadow-inner overflow-hidden">
        <canvas ref={canvasRef} className="rounded-xl shadow-2xl max-w-full h-auto cursor-pointer" onClick={handleDrop} />
      </div>

      {/* 直近の当たり履歴 */}
      {recentWins.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
          <span className="text-[10px] font-bold text-muted-strong shrink-0">直近:</span>
          {recentWins.map((w, idx) => (
            <span
              key={idx}
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                w.mult >= 20.0
                  ? 'bg-rose-950/50 text-rose-300 border-rose-800'
                  : w.mult >= 4.0
                  ? 'bg-amber-950/50 text-amber-300 border-amber-800'
                  : w.mult >= 1.0
                  ? 'bg-teal-950/50 text-teal-300 border-teal-800'
                  : 'bg-stone-800/50 text-stone-400 border-stone-700'
              }`}
            >
              {w.mult}x (+{w.coins})
            </span>
          ))}
        </div>
      )}

      {/* コントロールパネル */}
      <div className="space-y-4 pt-1">
        {/* リスク選択 */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-foreground">リスク設定 (脳汁調節)</span>
            <span className="text-[10px] text-amber-500 font-bold">最高配当: {riskMeta.maxPayout}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['low', 'medium', 'high'] as PlinkoRisk[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRisk(r)}
                className={`p-2 rounded-xl border text-center transition cursor-pointer flex flex-col gap-0.5 ${
                  risk === r
                    ? 'bg-primary-600 text-white border-primary-500 shadow-md font-black'
                    : 'bg-surface-subtle border-border text-muted-strong hover:text-foreground font-bold'
                }`}
              >
                <span className="text-xs">{PLINKO_RISK_LABELS[r].label}</span>
                <span className="text-[9px] opacity-80 truncate">{PLINKO_RISK_LABELS[r].maxPayout}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-strong text-center">{riskMeta.desc}</p>
        </div>

        {/* ベット額選択 */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-foreground block">ベット額 (コイン)</span>
          <div className="grid grid-cols-5 gap-1.5">
            {PLINKO_ALLOWED_BETS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setBetAmount(amt)}
                className={`py-2 rounded-xl border text-xs font-mono font-bold transition cursor-pointer ${
                  betAmount === amt
                    ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md font-black'
                    : 'bg-surface-subtle border-border text-muted-strong hover:text-foreground'
                }`}
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        {/* ドロップボタン (連打可能) */}
        <button
          type="button"
          onClick={handleDrop}
          disabled={userCoins < betAmount}
          className={`w-full py-3.5 rounded-xl font-black text-sm tracking-wider uppercase transition shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
            userCoins < betAmount
              ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-red-600 via-amber-600 to-red-600 hover:from-red-500 hover:to-amber-500 text-white shadow-red-900/30 active:scale-98'
          }`}
        >
          <span>💣 爆弾を投下する！</span>
          <span className="text-xs font-mono opacity-90 font-normal">(-{betAmount}🪙 / 連打OK)</span>
        </button>
      </div>
    </div>
  );
}
