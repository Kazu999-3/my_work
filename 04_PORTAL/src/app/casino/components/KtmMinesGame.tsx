'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Eye, Loader2, RotateCcw, Trophy, Undo2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { MinesPublicState } from '../../api/bet/mines/route';
import {
  MINES_ALLOWED_BETS,
  MINES_ALLOWED_MINE_COUNTS,
  MINES_GRID_SIZE,
  MINES_MAX_PAYOUT,
  maxRevealCount,
  multiplierTable,
} from '../../../lib/minesMath';

interface KtmMinesGameProps {
  userCoins: number;
  onBalanceChange: (newBalance: number) => void;
}

type Busy = null | 'start' | 'cashout' | number;

/** キノコの数ごとの手ざわりを一言で表したラベル */
const MINE_COUNT_LABELS: Record<number, { label: string; hint: string }> = {
  1: { label: '🌱 かんたん', hint: '踏む確率 4%・じっくり伸ばす' },
  3: { label: '🌿 ふつう', hint: '踏む確率 12%・バランス型' },
  5: { label: '🔥 むずかしい', hint: '踏む確率 20%・短期決戦' },
  10: { label: '💀 無謀', hint: '踏む確率 40%・一撃狙い' },
};

export default function KtmMinesGame({ userCoins, onBalanceChange }: KtmMinesGameProps) {
  const [betAmount, setBetAmount] = useState<number>(100);
  const [mineCount, setMineCount] = useState<number>(3);
  const [state, setState] = useState<MinesPublicState | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTable, setShowTable] = useState<boolean>(false);
  const [restoring, setRestoring] = useState<boolean>(true);

  const isPlaying = state?.status === 'pending';
  const isFinished = state?.status === 'lost' || state?.status === 'settled';

  const call = useCallback(async (payload: Record<string, any>) => {
    const res = await fetch('/api/bet/mines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || '通信に失敗しました');
    }
    return data;
  }, []);

  /**
   * 画面を開いたときに、中断していたラウンドがあれば復帰する。
   * これが無いとリロードした瞬間に「ベットしたコインだけ消えた」ように見えてしまう。
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await call({ action: 'STATE' });
        if (cancelled) return;
        if (data.state) {
          setState(data.state);
          setBetAmount(data.state.betAmount);
          setMineCount(data.state.mineCount);
        }
      } catch {
        // 未ログイン時などは復帰できなくて当然なので、ここでは何も出さない
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [call]);

  const handleStart = async () => {
    if (busy) return;
    if (userCoins < betAmount) {
      setErrorMsg(`コインが足りません (所持: ${userCoins}🪙 / 必要: ${betAmount}🪙)`);
      return;
    }
    setErrorMsg(null);
    setBusy('start');
    try {
      const data = await call({ action: 'START', betAmount, mineCount });
      setState(data.state);
      onBalanceChange(data.state.balance);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleReveal = async (tileIndex: number) => {
    if (busy || !state || state.status !== 'pending') return;
    if (state.revealed.includes(tileIndex)) return;
    setErrorMsg(null);
    setBusy(tileIndex);
    try {
      const data = await call({ action: 'REVEAL', gameId: state.gameId, tileIndex });
      const next: MinesPublicState = data.state;
      setState(next);
      if (next.status === 'settled') {
        onBalanceChange(next.balance);
        celebrate(next.multiplier);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleCashout = async () => {
    if (busy || !state || state.status !== 'pending') return;
    setErrorMsg(null);
    setBusy('cashout');
    try {
      const data = await call({ action: 'CASHOUT', gameId: state.gameId });
      setState(data.state);
      onBalanceChange(data.state.balance);
      celebrate(data.state.multiplier);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  const celebrate = (multiplier: number) => {
    if (multiplier >= 20) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
    } else if (multiplier >= 2) {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
    }
  };

  const handleReset = () => {
    setState(null);
    setErrorMsg(null);
  };

  // 開始前のプレビュー（選択中の設定で何マスまで伸ばせるか）
  const previewMax = useMemo(() => maxRevealCount(mineCount, betAmount), [mineCount, betAmount]);
  const previewTable = useMemo(() => multiplierTable(mineCount, betAmount), [mineCount, betAmount]);

  const activeMineCount = state?.mineCount ?? mineCount;
  const activeBet = state?.betAmount ?? betAmount;
  const activeMax = state?.maxReveal ?? previewMax;
  const revealedCount = state?.revealCount ?? 0;

  return (
    <div className="bg-gradient-to-b from-stone-900 via-[#1c1917] to-stone-950 border border-stone-800 rounded-3xl p-5 sm:p-7 text-white shadow-xl space-y-6 max-w-2xl mx-auto">
      {/* タイトルヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-700 to-emerald-400 p-0.5 shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-stone-900 rounded-[14px] flex items-center justify-center text-2xl">
              🌿
            </div>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-emerald-400 to-teal-500">
              ブッシュ・スカウト
            </h2>
            <p className="text-xs text-stone-400">
              キノコを避けてブッシュにワードを刺す。1マスごとに倍率アップ、いつでも引き返せます。
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

      {/* 設定パネル（ラウンド中は変更不可） */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-stone-400 mr-1 w-full sm:w-auto">🍄 キノコの数:</span>
          {MINES_ALLOWED_MINE_COUNTS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMineCount(m)}
              disabled={isPlaying || !!busy}
              title={MINE_COUNT_LABELS[m]?.hint}
              className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeMineCount === m
                  ? 'bg-emerald-500 text-stone-950 shadow-md shadow-emerald-500/30 ring-2 ring-emerald-300'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {m}個
            </button>
          ))}
          <span className="text-[11px] text-stone-500 ml-1">
            {MINE_COUNT_LABELS[activeMineCount]?.label} / {MINE_COUNT_LABELS[activeMineCount]?.hint}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-stone-400 mr-1 w-full sm:w-auto">🪙 ベット額:</span>
          {MINES_ALLOWED_BETS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setBetAmount(amt)}
              disabled={isPlaying || !!busy}
              className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeBet === amt
                  ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/30 ring-2 ring-yellow-300'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {amt} 🪙
            </button>
          ))}
          <span className="text-[11px] text-stone-500 ml-1">
            最大 {activeMax}マス / 最高 {previewTable[previewTable.length - 1]?.multiplier ?? 0}倍
          </span>
        </div>
      </div>

      {/* 盤面 */}
      <div className="bg-stone-950 border-2 border-emerald-500/30 rounded-3xl p-4 sm:p-6 shadow-inner space-y-4">
        {/* 進行状況バー */}
        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider px-1">
          <span className="text-emerald-400/80">
            ● {revealedCount} / {activeMax} マス
          </span>
          <span className="text-stone-400">
            {isPlaying && state
              ? state.nextMultiplier
                ? `次の1マスで ${state.nextMultiplier}倍`
                : '上限マスに到達'
              : `キノコ ${activeMineCount}個`}
          </span>
        </div>

        {/* 5×5 グリッド */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
          {Array.from({ length: MINES_GRID_SIZE }, (_, i) => {
            const opened = state?.revealed.includes(i) ?? false;
            const isMine = state?.minePositions?.includes(i) ?? false;
            const isHit = state?.hitTile === i;
            const isLoadingTile = busy === i;
            const clickable = isPlaying && !opened && !busy;

            let face = '🌿';
            let tone = 'bg-stone-900 border-stone-800 hover:border-emerald-600/60 hover:bg-stone-800';

            if (opened && !isMine) {
              face = '👁️';
              tone = 'bg-emerald-950/60 border-emerald-700/70';
            }
            if (isHit) {
              face = '🍄';
              tone = 'bg-rose-950/70 border-rose-600 shadow-lg shadow-rose-900/40';
            } else if (isFinished && isMine) {
              // 決着後に、踏まなかったキノコの位置も開示する
              face = '🍄';
              tone = 'bg-stone-900 border-rose-900/60 opacity-70';
            }

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleReveal(i)}
                disabled={!clickable}
                className={`aspect-square rounded-xl border-2 flex items-center justify-center text-xl sm:text-3xl transition-all ${tone} ${
                  clickable ? 'cursor-pointer active:scale-95' : 'cursor-default'
                } disabled:cursor-default`}
              >
                {isLoadingTile ? (
                  <Loader2 size={18} className="animate-spin text-emerald-400" />
                ) : (
                  <span className="select-none">{face}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 現在の倍率・払い戻し表示 */}
        {isPlaying && state && (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-3 text-center">
              <div className="text-[10px] text-stone-400 font-bold">現在の倍率</div>
              <div className="text-xl font-black font-mono text-emerald-400">
                {state.multiplier > 0 ? `${state.multiplier}倍` : '—'}
              </div>
            </div>
            <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-3 text-center">
              <div className="text-[10px] text-stone-400 font-bold">引き返すともらえる額</div>
              <div className="text-xl font-black font-mono text-amber-400">
                {state.payout > 0 ? `${state.payout.toLocaleString()}🪙` : '—'}
              </div>
            </div>
          </div>
        )}

        {/* 結果メッセージ */}
        {state && (
          <div
            className={`p-3 rounded-2xl text-center text-xs font-black border ${
              state.status === 'settled'
                ? 'bg-emerald-950/70 border-emerald-700/70 text-emerald-300'
                : state.status === 'lost'
                ? 'bg-rose-950/60 border-rose-800/70 text-rose-300'
                : 'bg-stone-900/80 border-stone-800 text-stone-300'
            }`}
          >
            <p className="text-sm">{state.message}</p>
            {state.status === 'settled' && (
              <p className="text-[11px] text-amber-400 font-extrabold mt-1">
                払い戻し +{state.payout.toLocaleString()}🪙 （手取り {state.payout - state.betAmount >= 0 ? '+' : ''}
                {(state.payout - state.betAmount).toLocaleString()}🪙）
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

        {/* 操作ボタン */}
        <div className="pt-1">
          {restoring ? (
            <div className="w-full py-3.5 rounded-2xl bg-stone-800 text-stone-400 text-xs font-black flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span>進行中のラウンドを確認しています…</span>
            </div>
          ) : isPlaying ? (
            <button
              type="button"
              onClick={handleCashout}
              disabled={!!busy || revealedCount === 0}
              className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-stone-950 shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {busy === 'cashout' ? <Loader2 size={16} className="animate-spin" /> : <Undo2 size={16} />}
              <span>
                {revealedCount === 0
                  ? 'まず1マス開けよう'
                  : `引き返す（+${(state?.payout ?? 0).toLocaleString()}🪙）`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={isFinished ? handleReset : handleStart}
              disabled={!!busy || (!isFinished && userCoins < betAmount)}
              className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-stone-950 shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {busy === 'start' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isFinished ? (
                <RotateCcw size={16} />
              ) : (
                <Eye size={16} />
              )}
              <span>{isFinished ? 'もう1ラウンド' : `${betAmount}🪙 で偵察を始める`}</span>
            </button>
          )}
        </div>
      </div>

      {/* 倍率表 */}
      <div className="bg-stone-950/60 border border-stone-800/80 rounded-2xl p-4 space-y-2.5 text-xs">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="w-full font-extrabold text-stone-300 flex items-center justify-between gap-1.5 text-xs cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Trophy size={14} className="text-amber-400" />
            <span>
              倍率表（キノコ{activeMineCount}個 / ベット{activeBet}🪙）
            </span>
          </span>
          <span className="text-stone-500">{showTable ? '閉じる ▲' : '開く ▼'}</span>
        </button>

        {showTable && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-[11px] pt-1">
            {multiplierTable(activeMineCount, activeBet).map((row) => (
              <div
                key={row.revealCount}
                className={`p-1.5 rounded-lg border flex items-center justify-between gap-1 ${
                  revealedCount === row.revealCount
                    ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                    : 'bg-stone-900/70 border-stone-800/80 text-stone-300'
                }`}
              >
                <span className="text-stone-500">{row.revealCount}</span>
                <span className="font-black font-mono">{row.multiplier}倍</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-stone-500 leading-relaxed pt-1 border-t border-stone-800/80">
          還元率95%。どのマス数で引き返しても期待値は同じなので、「何マスまで開けるのが得か」という正解はありません。
          1ラウンドの払い戻しは {MINES_MAX_PAYOUT.toLocaleString()}🪙 が上限で、到達すると自動で引き返します
          （ベット額が小さいほど高い倍率まで伸ばせます）。キノコの位置はラウンド開始時にサーバー側で確定し、
          決着するまで誰にも見えません。
        </p>
      </div>
    </div>
  );
}
