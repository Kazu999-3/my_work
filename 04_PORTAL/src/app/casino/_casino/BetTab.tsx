"use client";

import { Coins, Trophy, Flame, Swords, CheckCircle2, ArrowRight, Gift, Clock } from 'lucide-react';
import Link from 'next/link';
import type { BetStats, RankingPlayer } from './useCasinoData';

const formatTimeLeft = (sec: number) => {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// タブ1: 勝敗予想（投票比率・締め切り・対戦カード・ベットフォーム・長者番付）
// 2026-10-07: app/casino/page.tsx（1,635行）から分割。表示内容・動作は分割前と同じ。
export default function BetTab({ user, betStats, setTipToPlayer, setIsTipModalOpen, loginWithDiscord, activeMatch, betTeam, setBetTeam, betAmount, setBetAmount, betMessage, isSubmitting, timeLeftSeconds, isBetLocked, calculatedOdds, isParticipant, handlePlaceBet, ranking, activePlayerName }: {
  user: any;
  betStats: BetStats;
  setTipToPlayer: (v: string) => void;
  setIsTipModalOpen: (v: boolean) => void;
  loginWithDiscord: (redirect?: string) => void;
  activeMatch: any;
  betTeam: 'BLUE' | 'RED';
  setBetTeam: (t: 'BLUE' | 'RED') => void;
  betAmount: number;
  setBetAmount: (n: number) => void;
  betMessage: string | null;
  isSubmitting: boolean;
  timeLeftSeconds: number | null;
  isBetLocked: boolean;
  calculatedOdds: any;
  isParticipant: boolean;
  handlePlaceBet: (e: React.FormEvent) => void;
  ranking: RankingPlayer[];
  activePlayerName: string;
}) {
  return (
    <>
          <div className="bg-surface rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 border border-primary-edge-soft flex items-center justify-center font-bold">
                  <Flame size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">カスタム勝敗予想</h2>
                  <p className="text-xs text-muted-strong">次のマッチの勝利チームを予想してコインを賭けよう！</p>
                </div>
              </div>
            </div>

            {betMessage && (
              <div className="p-4 rounded-2xl bg-success-50 border border-success-edge-soft text-success-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-success-600" />
                {betMessage}
              </div>
            )}

            {/* 試合受付状況に応じた表示切り替え */}
            {activeMatch ? (
              <div className="space-y-6">
                {/* 📊 リアルタイム投票比率バー */}
                <div className="p-4 rounded-2xl bg-surface/95 text-foreground space-y-2 border border-border shadow-sm">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-primary-600 flex items-center gap-1">
                      <span>🟦 BLUE:</span>
                      <span className="font-mono">{betStats.blueRatio}%</span>
                      <span className="text-[10px] text-muted-strong font-normal">({betStats.blueAmount.toLocaleString()}pt / {betStats.blueCount}人)</span>
                    </span>
                    <span className="text-primary-700 font-mono text-[11px] font-black">
                      総プール: {betStats.totalAmount.toLocaleString()}pt
                    </span>
                    <span className="text-danger-600 flex items-center gap-1">
                      <span className="text-[10px] text-muted-strong font-normal">({betStats.redAmount.toLocaleString()}pt / {betStats.redCount}人)</span>
                      <span className="font-mono">{betStats.redRatio}%</span>
                      <span>:RED 🟥</span>
                    </span>
                  </div>
                  {/* プログレスバー */}
                  <div className="w-full h-3 bg-surface-hover rounded-full overflow-hidden flex border border-border">
                    <div
                      style={{ width: `${betStats.blueRatio}%` }}
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500"
                    ></div>
                    <div
                      style={{ width: `${betStats.redRatio}%` }}
                      className="h-full bg-gradient-to-r from-danger-400 to-danger-600 transition-all duration-500"
                    ></div>
                  </div>
                </div>

                {/* ⏱️ 受付カウントダウン・ステータスバナー */}
                <div className={`p-4 rounded-3xl border-2 flex flex-wrap items-center justify-between gap-3 shadow-xs transition-all ${
                  isBetLocked
                    ? 'bg-surface-subtle border-border text-foreground-subtle'
                    : (timeLeftSeconds !== null && timeLeftSeconds <= 180)
                    ? 'bg-danger-50 border-danger-edge text-danger-950 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                    : 'bg-gradient-to-r from-success-50 via-secondary-50 to-success-50 border-success-edge text-success-950 shadow-[0_0_15px_rgba(16,185,129,0.12)]'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-xs ${
                      isBetLocked
                        ? 'bg-surface-hover text-muted'
                        : (timeLeftSeconds !== null && timeLeftSeconds <= 180)
                        ? 'bg-danger-500 text-white animate-bounce'
                        : 'bg-success-500 text-white'
                    }`}>
                      {isBetLocked ? '🔒' : (timeLeftSeconds !== null && timeLeftSeconds <= 180) ? '🔥' : '⏳'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-black tracking-wider uppercase px-2 py-0.5 rounded-lg ${
                          isBetLocked
                            ? 'bg-stone-300 text-foreground-soft'
                            : (timeLeftSeconds !== null && timeLeftSeconds <= 180)
                            ? 'bg-danger-600 text-white'
                            : 'bg-success-600 text-white'
                        }`}>
                          {isBetLocked ? '締切済み' : (timeLeftSeconds !== null && timeLeftSeconds <= 180) ? '締切直前' : '予想受付中'}
                        </span>
                        <span className="text-xs sm:text-sm font-black text-foreground">
                          {isBetLocked
                            ? '勝敗予想の受付は締め切られました（試合進行中）'
                            : (timeLeftSeconds !== null && timeLeftSeconds <= 180)
                            ? '🔥 まもなく投票締め切り！投票を急いでください！'
                            : 'LIVE MATCH 投票受付中'}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-strong font-medium mt-0.5">
                        {isBetLocked
                          ? '試合終了後に勝敗が記録されると自動で配当コインが精算されます。観戦をお楽しみください！'
                          : '試合開始と同時に受付終了となります。どちらが勝つか予想して投票しよう！'}
                      </div>
                    </div>
                  </div>

                  {/* カウントダウンタイマー表示 */}
                  {!isBetLocked && timeLeftSeconds !== null && (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border shadow-xs ml-auto ${
                      timeLeftSeconds <= 180
                        ? 'bg-danger-100 border-danger-edge text-danger-800 animate-pulse'
                        : 'bg-surface border-success-edge-soft text-success-900'
                    }`}>
                      <Clock size={16} className={timeLeftSeconds <= 180 ? 'text-danger-600' : 'text-success-600'} />
                      <span className="text-xs font-black text-muted">締切目安:</span>
                      <span className={`font-mono text-base sm:text-lg font-black tracking-wider ${
                        timeLeftSeconds <= 180 ? 'text-danger-600' : 'text-foreground'
                      }`}>
                        {formatTimeLeft(timeLeftSeconds)}
                      </span>
                    </div>
                  )}
                </div>

                {/* 対戦カード表示 */}
                <div className="p-5 rounded-3xl bg-surface/95 text-foreground space-y-4 border border-border shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          isBetLocked ? 'bg-stone-400' : (timeLeftSeconds !== null && timeLeftSeconds <= 180) ? 'bg-danger-400' : 'bg-success-400'
                        }`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                          isBetLocked ? 'bg-stone-500' : (timeLeftSeconds !== null && timeLeftSeconds <= 180) ? 'bg-danger-500' : 'bg-success-500'
                        }`}></span>
                      </span>
                      <span className={`text-xs font-black tracking-wider ${
                        isBetLocked ? 'text-muted-strong' : (timeLeftSeconds !== null && timeLeftSeconds <= 180) ? 'text-danger-600' : 'text-success-700'
                      }`}>
                        {isBetLocked ? 'LOCK 試合進行中' : 'LIVE MATCH 受付中'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-primary-700 font-mono">
                      勝率予想: 🟦 {activeMatch.blueWinRate ? `${Math.round(activeMatch.blueWinRate * 100)}%` : '50%'} vs 🟥 {activeMatch.blueWinRate ? `${Math.round((1 - activeMatch.blueWinRate) * 100)}%` : '50%'}
                    </div>
                  </div>

                  {/* 5v5 対戦メンバー */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {/* BLUE TEAM */}
                    <div className="p-3.5 rounded-2xl bg-primary-50/80 border-2 border-primary-edge-soft space-y-2">
                      <div className="flex items-center justify-between border-b border-primary-edge-soft pb-1.5">
                        <span className="text-xs font-black text-primary-700">🟦 BLUE TEAM</span>
                        <span className="text-[10px] font-mono text-primary-600 font-bold">MMR: {activeMatch.teamBlue ? Math.round(activeMatch.teamBlue.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / activeMatch.teamBlue.length) : '-'}</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {(activeMatch.teamBlue || []).map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-foreground-soft truncate">{p.assignedRole || p.role || `P${i+1}`}: {p.name}</span>
                            <span className="text-[9px] text-muted-strong font-mono shrink-0">{p.rank || p.highestRank || ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* RED TEAM */}
                    <div className="p-3.5 rounded-2xl bg-danger-50/80 border-2 border-danger-edge-soft space-y-2">
                      <div className="flex items-center justify-between border-b border-danger-edge-soft pb-1.5">
                        <span className="text-xs font-black text-danger-700">🟥 RED TEAM</span>
                        <span className="text-[10px] font-mono text-danger-600 font-bold">MMR: {activeMatch.teamRed ? Math.round(activeMatch.teamRed.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / activeMatch.teamRed.length) : '-'}</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {(activeMatch.teamRed || []).map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-foreground-soft truncate">{p.assignedRole || p.role || `P${i+1}`}: {p.name}</span>
                            <span className="text-[9px] text-muted-strong font-mono shrink-0">{p.rank || p.highestRank || ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ベットフォーム */}
                {user ? (
                  isParticipant ? (
                    <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-br from-primary-50 via-white to-primary-50 text-foreground border-2 border-primary-edge-soft shadow-md space-y-4 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-primary-100 text-primary-700 border border-primary-edge-soft flex items-center justify-center mx-auto text-2xl">
                        ⚔️
                      </div>
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-black border border-primary-edge-soft">
                          🛡️ 出場選手（プレイヤー）として参加中
                        </div>
                        <h4 className="text-base font-black text-foreground pt-2">
                          あなたは現在このカスタム対戦の選手です
                        </h4>
                        <p className="text-xs text-muted leading-relaxed max-w-md mx-auto">
                          試合の公平性・八百長防止のため、<strong className="text-primary-700">出場選手本人は勝敗予想ベットを行うことができません。</strong><br />
                          勝敗予想は観戦者・コミュニティメンバー限定の機能となります。
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center justify-between text-left text-xs shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">🏆</span>
                          <div>
                            <div className="font-black text-foreground">選手勝利ボーナス</div>
                            <div className="text-[10px] text-muted-strong">試合に勝利すると自動でポイントが付与されます</div>
                          </div>
                        </div>
                        <span className="font-mono font-black text-primary-700 text-sm bg-primary-100 border border-primary-edge px-3 py-1 rounded-xl">
                          +250 pt
                        </span>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handlePlaceBet} className="space-y-5">
                      {isBetLocked ? (
                        <div className="p-4 rounded-2xl bg-primary-500/10 border-2 border-primary-edge-strong/30 text-primary-900 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🔒</span>
                            <div>
                              <div className="font-extrabold text-xs">勝敗予想は締め切られました（試合進行中）</div>
                              <div className="text-[11px] text-muted">試合終了後のコイン精算をお待ちください！</div>
                            </div>
                          </div>
                          <span className="text-[10px] bg-primary-200 text-primary-900 font-bold px-2 py-0.5 rounded-full">LOCK</span>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-black text-foreground-subtle mb-2">
                              👉 どちらのチームが勝つか選んでください:
                            </label>
                            <div className="grid grid-cols-2 gap-2 md:gap-4">
                              <button
                                type="button"
                                onClick={() => setBetTeam('BLUE')}
                                className={`p-3 md:p-5 rounded-2xl md:rounded-3xl border-2 md:border-3 font-black text-xs md:text-sm transition-all flex flex-col items-center gap-1.5 md:gap-2 cursor-pointer ${
                                  betTeam === 'BLUE'
                                    ? 'border-primary-edge-strong bg-primary-50 text-primary-700 shadow-md scale-102'
                                    : 'border-border hover:border-primary-edge-soft text-muted'
                                }`}
                              >
                                <span className="text-xl md:text-2xl">🟦</span>
                                <span className="truncate max-w-full">BLUE TEAM</span>
                                <span className="text-[10px] md:text-xs px-2 md:px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-800 font-mono font-black">
                                  x{calculatedOdds.blue}倍
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setBetTeam('RED')}
                                className={`p-3 md:p-5 rounded-2xl md:rounded-3xl border-2 md:border-3 font-black text-xs md:text-sm transition-all flex flex-col items-center gap-1.5 md:gap-2 cursor-pointer ${
                                  betTeam === 'RED'
                                    ? 'border-danger-edge-strong bg-danger-50 text-danger-700 shadow-md scale-102'
                                    : 'border-border hover:border-danger-edge-soft text-muted'
                                }`}
                              >
                                <span className="text-xl md:text-2xl">🟥</span>
                                <span className="truncate max-w-full">RED TEAM</span>
                                <span className="text-[10px] md:text-xs px-2 md:px-2.5 py-0.5 rounded-full bg-danger-100 text-danger-800 font-mono font-black">
                                  x{calculatedOdds.red}倍
                                </span>
                              </button>
                            </div>
                          </div>

                          {/* 賭け金 & もらえるコイン直感シミュレーター */}
                          <div className="p-4 md:p-5 rounded-2xl md:rounded-3xl bg-primary-50/60 border border-primary-edge-soft/80 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <label className="block text-xs font-black text-foreground-soft">
                                🪙 賭けるコイン数
                              </label>
                              <div className="text-right">
                                <span className="text-[10px] md:text-[11px] text-muted-strong font-bold">勝った場合: </span>
                                <strong className="text-xs md:text-sm font-black text-primary-600 font-mono">
                                  🎯 +{Math.round(betAmount * (betTeam === 'BLUE' ? calculatedOdds.blue : calculatedOdds.red))} コイン
                                </strong>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                              {[50, 100, 300, 500, 1000].map((amt) => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setBetAmount(amt)}
                                  className={`py-2 md:py-2.5 rounded-xl text-[11px] md:text-xs font-black border transition-all cursor-pointer ${
                                    betAmount === amt
                                      ? 'bg-primary-500 text-white border-primary-edge-strong shadow-sm scale-105'
                                      : 'bg-surface hover:bg-primary-100/50 text-foreground-subtle border-border'
                                  }`}
                                >
                                  {amt}
                                </button>
                              ))}
                            </div>
                            <input
                              type="number"
                              min="1"
                              max={user?.coins ?? 0}
                              value={betAmount}
                              onChange={(e) => setBetAmount(Number(e.target.value))}
                              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-black text-foreground focus:outline-none focus:border-primary-edge-strong font-mono"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 hover:from-primary-500 hover:to-primary-400 text-white py-4 rounded-2xl font-black text-base transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transform active:scale-98"
                          >
                            <Coins size={20} />
                            {isSubmitting ? '処理中...' : `🪙 ${betAmount}コイン を ${betTeam} の勝利にベット！`}
                          </button>
                        </>
                      )}
                    </form>
                  )
                ) : (
                  <div className="text-center p-6 bg-background rounded-2xl border border-border">
                    <p className="text-xs text-muted font-bold mb-3">
                      ベットするにはDiscordログインが必要です
                    </p>
                    <button
                      type="button"
                      onClick={() => loginWithDiscord('/casino')}
                      className="px-6 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs transition-all shadow-sm"
                    >
                      Discordでログインしてベットする
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* 試合未決定時の待機パネル */
              <div className="p-8 md:p-12 rounded-3xl bg-background border border-black/5 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-3xl bg-primary-100/80 text-primary-700 flex items-center justify-center mx-auto text-3xl">
                  ☕
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-foreground">
                    現在受付中のカスタム対戦はありません
                  </h3>
                  <p className="text-xs text-muted-strong max-w-md mx-auto leading-relaxed">
                    バランサーでチーム分けが確定されると、ここに自動で5v5対戦カードが出現し、勝敗予想の受付が開始されます🔥
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/balancer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-stone-900 hover:bg-primary-600 text-white font-black text-xs transition-all shadow-md hover:shadow-lg cursor-pointer transform active:scale-95"
                  >
                    <Swords size={16} />
                    バランサーでチーム分けを行う
                    <ArrowRight size={14} />
                  </Link>

                </div>
              </div>
            )}

            {/* 勝敗予想の下に常時表示される長者番付 */}
            <div className="pt-6 border-t border-stone-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                    <Trophy size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">KTM 長者番付 TOP 10</h3>
                    <p className="text-[11px] text-muted-strong">現在のコイン富豪ランキング</p>
                  </div>
                </div>
                <span className="text-[10px] text-primary-700 bg-primary-100/70 font-bold px-2 py-0.5 rounded-full">
                  リアルタイム
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ranking.map((p, idx) => (
                  <div
                    key={`bet-rank-${p.name}`}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      idx === 0
                        ? 'bg-primary-50/80 border-primary-edge font-bold shadow-xs'
                        : idx === 1
                        ? 'bg-background border-border font-bold'
                        : idx === 2
                        ? 'bg-primary-900/5 border-primary-edge-strong/20 font-bold'
                        : 'bg-surface border-black/5 hover:bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 text-center text-xs font-black font-mono">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                      </span>
                      <div>
                        <div className="text-xs font-black text-foreground flex items-center gap-1">
                          {p.name}
                          <span className="text-[8px] px-1 py-0.2 rounded bg-black/5 text-muted-strong font-mono">
                            {p.rank}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-xs font-black text-primary-600 font-mono">
                          🪙 {p.coins != null ? p.coins.toLocaleString() : '—'}
                        </span>
                      </div>
                      {user && p.name !== activePlayerName && (
                        <button
                          type="button"
                          onClick={() => {
                            setTipToPlayer(p.name);
                            setIsTipModalOpen(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-edge-soft text-[10px] font-black transition flex items-center gap-1 cursor-pointer"
                          title={`${p.name} さんにチップを贈る`}
                        >
                          <Gift size={11} />
                          <span>贈る</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
    </>
  );
}
