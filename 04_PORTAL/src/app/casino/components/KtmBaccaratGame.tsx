'use client';

import React, { useState, useRef } from 'react';
import { Sparkles, RefreshCw, Trophy, AlertCircle, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Card, BetTarget, GameResult } from '../../api/bet/baccarat/route';

// ============================================================
// 型定義
// ============================================================
interface BaccaratGameProps {
  userDiscordId?: string;
  userDisplayName?: string;
  userCoins: number;
  onBalanceChange: (newBalance: number) => void;
}

interface BaccaratResponse {
  success: boolean;
  result: GameResult;
  bet: BetTarget;
  isWin: boolean;
  isPush: boolean;
  playerCards: Card[];
  bankerCards: Card[];
  playerScore: number;
  bankerScore: number;
  isNatural: boolean;
  payout: number;
  prevCoins: number;
  remainingCoins: number;
  message: string;
  error?: string;
}

type GamePhase = 'IDLE' | 'DEALING' | 'RESULT';

// ============================================================
// カード表示ヘルパー
// ============================================================
const SUIT_ICONS: Record<string, { icon: string; color: string }> = {
  spades:   { icon: '♠', color: 'text-stone-900' },
  hearts:   { icon: '♥', color: 'text-rose-600' },
  diamonds: { icon: '♦', color: 'text-rose-600' },
  clubs:    { icon: '♣', color: 'text-stone-900' },
};

/** 1枚のカードコンポーネント */
function CardFace({
  card,
  visible,
  delay = 0,
}: {
  card: Card;
  visible: boolean;
  delay?: number;
}) {
  const suit = SUIT_ICONS[card.suit];

  return (
    <div
      className="relative w-14 h-20 md:w-16 md:h-24 transition-all duration-500"
      style={{ transitionDelay: `${delay}ms` }}
    >
      {visible ? (
        <div className="w-full h-full rounded-xl border-2 border-stone-200 bg-white shadow-md flex flex-col justify-between p-1.5 select-none">
          {/* 左上 */}
          <div className={`text-xs font-black leading-none ${suit.color}`}>
            <div>{card.rank}</div>
            <div>{suit.icon}</div>
          </div>
          {/* 中央スーツ */}
          <div className={`text-center text-2xl leading-none ${suit.color}`}>{suit.icon}</div>
          {/* 右下（反転） */}
          <div className={`text-xs font-black leading-none self-end rotate-180 ${suit.color}`}>
            <div>{card.rank}</div>
            <div>{suit.icon}</div>
          </div>
        </div>
      ) : (
        /* カード裏面 */
        <div className="w-full h-full rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-600 to-amber-800 shadow-md flex items-center justify-center">
          <div className="text-amber-200 text-xl font-black">🂠</div>
        </div>
      )}
    </div>
  );
}

/** カードの列（PLAYER or BANKER） */
function CardRow({
  label,
  cards,
  score,
  visibleCount,
  accent,
}: {
  label: string;
  cards: Card[];
  score: number;
  visibleCount: number;
  accent: string; // tailwind テキスト色クラス
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`text-xs font-black tracking-widest ${accent}`}>{label}</div>
      <div className="flex gap-2 justify-center min-h-[6rem]">
        {cards.map((card, i) => (
          <CardFace
            key={i}
            card={card}
            visible={i < visibleCount}
            delay={i * 300}
          />
        ))}
        {/* 3枚目スロット（まだカードがない場合は空欄） */}
        {cards.length < 3 && visibleCount >= 2 && (
          <div className="w-14 h-20 md:w-16 md:h-24 rounded-xl border-2 border-dashed border-stone-300 opacity-30" />
        )}
      </div>
      <div className={`text-2xl font-black tabular-nums ${accent}`}>{score}</div>
    </div>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function KtmBaccaratGame({
  userDiscordId,
  userDisplayName,
  userCoins,
  onBalanceChange,
}: BaccaratGameProps) {
  const [phase, setPhase] = useState<GamePhase>('IDLE');
  const [selectedBet, setSelectedBet] = useState<BetTarget>('PLAYER');
  const [betAmount, setBetAmount] = useState<number>(100);
  const [lastResult, setLastResult] = useState<BaccaratResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // アニメーション用の「現在何枚見えているか」
  const [playerVisible, setPlayerVisible] = useState(0);
  const [bankerVisible, setBankerVisible] = useState(0);

  const dealTimersRef = useRef<NodeJS.Timeout[]>([]);

  // ============================================================
  // クイックベットボタン用ヘルパー
  // ============================================================
  const QUICK_BETS = [10, 100, 500, 1000];

  // ============================================================
  // ゲーム実行
  // ============================================================
  const handleDeal = async () => {
    if (phase !== 'IDLE') return;
    if (!userDiscordId && !userDisplayName) {
      setErrorMsg('Discordログインが必要です。');
      return;
    }
    if (userCoins < betAmount) {
      setErrorMsg(`コインが足りません（所持: ${userCoins}🪙 / 必要: ${betAmount}🪙）`);
      return;
    }
    if (betAmount < 10) {
      setErrorMsg('最低10コイン以上でベットしてください。');
      return;
    }

    setErrorMsg(null);
    setLastResult(null);
    setPhase('DEALING');
    setPlayerVisible(0);
    setBankerVisible(0);

    try {
      const res = await fetch('/api/bet/baccarat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: userDiscordId,
          playerName: userDisplayName,
          bet: selectedBet,
          amount: betAmount,
        }),
      });

      const data: BaccaratResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '通信に失敗しました');
      }

      // タイマーをクリア
      dealTimersRef.current.forEach(clearTimeout);
      dealTimersRef.current = [];

      // ── カードを1枚ずつ順番に表示するアニメーション ──
      // 配る順: PLAYER1 → BANKER1 → PLAYER2 → BANKER2 → (PLAYER3) → (BANKER3)
      const schedule = (fn: () => void, ms: number) => {
        const t = setTimeout(fn, ms);
        dealTimersRef.current.push(t);
      };

      schedule(() => setPlayerVisible(1), 300);
      schedule(() => setBankerVisible(1), 700);
      schedule(() => setPlayerVisible(2), 1100);
      schedule(() => setBankerVisible(2), 1500);

      let finalDelay = 1800;
      if (data.playerCards.length === 3) {
        schedule(() => setPlayerVisible(3), 2000);
        finalDelay = 2300;
      }
      if (data.bankerCards.length === 3) {
        schedule(() => setBankerVisible(3), finalDelay);
        finalDelay += 500;
      }

      // 結果表示
      schedule(() => {
        setPhase('RESULT');
        setLastResult(data);
        onBalanceChange(data.remainingCoins);
        if (data.isWin) {
          confetti({
            particleCount: data.bet === 'TIE' ? 150 : 80,
            spread: 70,
            origin: { y: 0.5 },
            colors: ['#f59e0b', '#3b82f6', '#ec4899', '#10b981'],
          });
        }
      }, finalDelay + 300);
    } catch (e: any) {
      setErrorMsg(e.message || 'エラーが発生しました');
      setPhase('IDLE');
    }
  };

  const handleReset = () => {
    dealTimersRef.current.forEach(clearTimeout);
    setPhase('IDLE');
    setLastResult(null);
    setPlayerVisible(0);
    setBankerVisible(0);
  };

  // ============================================================
  // 表示データ
  // ============================================================
  const displayPlayerCards: Card[] = lastResult?.playerCards ?? [];
  const displayBankerCards: Card[] = lastResult?.bankerCards ?? [];
  const displayPlayerScore = lastResult?.playerScore ?? 0;
  const displayBankerScore = lastResult?.bankerScore ?? 0;

  const BET_CONFIGS: { id: BetTarget; label: string; subLabel: string; odds: string; accent: string; bg: string; selectedBg: string }[] = [
    { id: 'PLAYER', label: 'PLAYER', subLabel: 'プレイヤー', odds: '×1.95', accent: 'text-blue-700', bg: 'bg-blue-50 border-blue-300', selectedBg: 'bg-blue-600 border-blue-700 text-white' },
    { id: 'TIE',    label: 'TIE',    subLabel: 'タイ',       odds: '×8.0',  accent: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', selectedBg: 'bg-emerald-600 border-emerald-700 text-white' },
    { id: 'BANKER', label: 'BANKER', subLabel: 'バンカー',   odds: '×1.95', accent: 'text-rose-700', bg: 'bg-rose-50 border-rose-300', selectedBg: 'bg-rose-600 border-rose-700 text-white' },
  ];

  // 結果アクセント
  const resultAccent = lastResult
    ? lastResult.isPush
      ? 'bg-stone-100 border-stone-400 text-stone-700'
      : lastResult.isWin
        ? 'bg-amber-100 border-amber-500 text-amber-900'
        : 'bg-rose-100 border-rose-400 text-rose-900'
    : '';

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-900 text-xs font-black border border-amber-500/30">
          <Sparkles size={12} className="text-amber-600" />
          KTM Sovereign Baccarat
        </div>
        <p className="text-xs text-stone-500 font-medium">本格8デッキ / PLAYER・BANKER×1.95倍 / TIE×8.0倍</p>
      </div>

      {/* エラー表示 */}
      {errorMsg && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-100 border border-rose-400 text-rose-800 text-xs font-bold">
          <AlertCircle size={14} />
          {errorMsg}
        </div>
      )}

      {/* ── カードテーブル ── */}
      <div className="rounded-3xl overflow-hidden border-2 border-stone-300 bg-gradient-to-b from-emerald-800 to-emerald-900 shadow-lg">
        {/* フェルト面 */}
        <div className="p-6 flex items-center justify-around gap-4">
          {/* BANKER側 */}
          <CardRow
            label="BANKER"
            cards={displayBankerCards}
            score={displayBankerScore}
            visibleCount={bankerVisible}
            accent="text-rose-300"
          />

          {/* 中央スコアボード */}
          <div className="flex flex-col items-center gap-2 text-white">
            <div className="text-4xl">🃏</div>
            {phase === 'RESULT' && lastResult && (
              <div className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 text-center min-w-[70px] ${resultAccent}`}>
                {lastResult.isPush
                  ? '🤝 PUSH'
                  : lastResult.result === 'TIE'
                    ? '🤝 TIE'
                    : lastResult.result === 'PLAYER'
                      ? '🔵 PLAYER'
                      : '🔴 BANKER'}
              </div>
            )}
            {lastResult?.isNatural && (
              <div className="text-xs font-black text-amber-300 animate-pulse">⚡ NATURAL!</div>
            )}
          </div>

          {/* PLAYER側 */}
          <CardRow
            label="PLAYER"
            cards={displayPlayerCards}
            score={displayPlayerScore}
            visibleCount={playerVisible}
            accent="text-blue-300"
          />
        </div>
      </div>

      {/* ── 結果バナー ── */}
      {phase === 'RESULT' && lastResult && (
        <div className={`px-4 py-3 rounded-2xl border-2 text-sm font-black text-center ${resultAccent}`}>
          {lastResult.message}
          {lastResult.isPush && (
            <div className="text-xs font-normal mt-0.5 opacity-70">掛け金 {betAmount.toLocaleString()}コインは返還されます</div>
          )}
        </div>
      )}

      {/* ── ベット選択 ── */}
      <div className="grid grid-cols-3 gap-2">
        {BET_CONFIGS.map(cfg => (
          <button
            key={cfg.id}
            type="button"
            onClick={() => phase === 'IDLE' && setSelectedBet(cfg.id)}
            disabled={phase !== 'IDLE'}
            className={`py-3 px-2 rounded-2xl border-2 text-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              selectedBet === cfg.id
                ? cfg.selectedBg + ' shadow-md scale-105'
                : cfg.bg + ' ' + cfg.accent + ' hover:scale-102'
            }`}
          >
            <div className="text-sm font-black">{cfg.label}</div>
            <div className="text-[10px] font-bold opacity-80">{cfg.subLabel}</div>
            <div className="text-xs font-black mt-0.5">{cfg.odds}</div>
          </button>
        ))}
      </div>

      {/* ── 金額入力 ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-black text-stone-700 whitespace-nowrap">ベット額:</label>
          <input
            type="number"
            value={betAmount}
            min={10}
            max={userCoins}
            onChange={e => setBetAmount(Math.max(10, Math.floor(Number(e.target.value))))}
            disabled={phase !== 'IDLE'}
            className="flex-1 px-3 py-2 rounded-xl border-2 border-stone-300 bg-white text-stone-900 font-black text-sm text-right focus:border-amber-500 focus:outline-none disabled:opacity-50"
          />
          <span className="text-xs text-stone-500 font-bold whitespace-nowrap">🪙</span>
        </div>

        {/* クイックベットボタン */}
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_BETS.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => setBetAmount(Math.min(q, userCoins))}
              disabled={phase !== 'IDLE' || userCoins < q}
              className="px-2.5 py-1 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 font-black text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {q.toLocaleString()}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBetAmount(userCoins)}
            disabled={phase !== 'IDLE'}
            className="px-2.5 py-1 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-900 font-black text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            MAX
          </button>
        </div>
      </div>

      {/* ── アクションボタン ── */}
      {phase === 'IDLE' || phase === 'DEALING' ? (
        <button
          type="button"
          onClick={handleDeal}
          disabled={phase === 'DEALING'}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-stone-950 font-black text-base shadow-md transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
        >
          {phase === 'DEALING' ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              ディーリング中...
            </>
          ) : (
            <>
              <Zap size={18} />
              DEAL（{betAmount.toLocaleString()}🪙 ベット）
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleReset}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-stone-600 to-stone-700 hover:from-stone-700 hover:to-stone-800 text-white font-black text-base shadow-md transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
        >
          <RefreshCw size={18} />
          もう一度プレイ
        </button>
      )}

      {/* 残高表示 */}
      <div className="text-center text-xs font-bold text-stone-500">
        💰 現在の残高:{' '}
        <strong className="text-amber-700 font-mono text-sm">
          {(lastResult ? lastResult.remainingCoins : userCoins).toLocaleString()}
        </strong>{' '}
        コイン
      </div>

      {/* ルール説明 */}
      <div className="p-3 rounded-2xl bg-stone-100 border border-stone-200 text-[10px] text-stone-500 font-medium leading-relaxed">
        <strong className="text-stone-700">🃏 バカラ基本ルール:</strong> PLAYER・BANKERに各2枚配り、合計の下一桁（9が最高）が大きい方が勝ち。
        0〜5点の場合は3枚目をドロー（本格ルール準拠）。8・9点は「ナチュラル」で即勝負。TIEは引き分け（PLAYER/BANKERはプッシュ＝掛け金返還）。
      </div>
    </div>
  );
}
