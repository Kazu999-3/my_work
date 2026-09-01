'use client';

import React, { useState, useEffect } from 'react';
import { Coins, Trophy, Flame, Swords, CheckCircle2, TrendingUp, Sparkles, Shield, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface RankingPlayer {
  name: string;
  discordId: string;
  rank: string;
  coins: number;
}

export default function CasinoPage() {
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [userCoins, setUserCoins] = useState<number>(1000);
  const [playerName, setPlayerName] = useState<string>('');
  const [betTeam, setBetTeam] = useState<'BLUE' | 'RED'>('BLUE');
  const [betAmount, setBetAmount] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(true);
  const [betMessage, setBetMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    fetchBetData();
  }, []);

  const fetchBetData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bet');
      if (res.ok) {
        const data = await res.json();
        setRanking(data.ranking || []);
      }
    } catch (e) {
      console.error('Failed to fetch bet data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceBet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      alert('プレイヤー名を入力してください。');
      return;
    }
    if (betAmount <= 0) {
      alert('1コイン以上の賭け金を指定してください。');
      return;
    }

    try {
      setIsSubmitting(true);
      setBetMessage(null);
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: playerName.trim(),
          team: betTeam,
          amount: betAmount,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBetMessage(`🎉 【ベット完了】 ${data.playerName} さんが ${data.team} に ${data.amount}コイン 賭けました！ (残高: ${data.remainingCoins}コイン)`);
        fetchBetData();
      } else {
        alert(data.error || 'ベットに失敗しました。');
      }
    } catch (e: any) {
      alert('エラーが発生しました: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-16 bg-[#eae4d4] text-[#201c2b]">
      {/* ヒーローセクション */}
      <div className="bg-gradient-to-b from-stone-900 via-stone-850 to-stone-900 text-stone-100 py-12 px-6 relative overflow-hidden border-b border-black/10">
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black tracking-wider border border-amber-500/30">
            <Sparkles size={14} />
            KTM Sovereign Casino
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center justify-center gap-3">
            <Coins className="text-amber-400" size={32} />
            勝敗予想ベット ＆ KTM長者番付
          </h1>
          <p className="text-stone-300 text-xs md:text-sm max-w-xl mx-auto font-medium">
            カスタムマッチの勝敗を予想してコインを増やそう！活躍や募集でもコインが手に入ります🔥
          </p>
        </div>
      </div>

      <div className="max-w-[1400px] w-full mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* メイングリッド: ベットフォーム & 長者番付 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 左側: 勝敗ベットフォーム */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                    <Flame size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-stone-900">カスタム勝敗ベット</h2>
                    <p className="text-xs text-stone-500">次のマッチの勝利チームを予想して賭けよう！</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-stone-400">オッズ</span>
                  <div className="text-xs font-black text-amber-600 font-mono">Elo連動（接戦ほど高倍率）</div>
                </div>
              </div>

              {betMessage && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  {betMessage}
                </div>
              )}

              <form onSubmit={handlePlaceBet} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    サモナー名（名簿登録名）
                  </label>
                  <input
                    type="text"
                    placeholder="例: りくや"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    賭けるチームを選択
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setBetTeam('BLUE')}
                      className={`p-4 rounded-2xl border-2 font-black text-xs transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                        betTeam === 'BLUE'
                          ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 shadow-sm'
                          : 'border-stone-200 hover:border-stone-300 text-stone-600'
                      }`}
                    >
                      <span className="text-base">🟦</span>
                      BLUE TEAM
                      <span className="text-[10px] font-mono opacity-80">オッズ: 1.8x〜</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBetTeam('RED')}
                      className={`p-4 rounded-2xl border-2 font-black text-xs transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                        betTeam === 'RED'
                          ? 'border-rose-600 bg-rose-50/80 text-rose-700 shadow-sm'
                          : 'border-stone-200 hover:border-stone-300 text-stone-600'
                      }`}
                    >
                      <span className="text-base">🟥</span>
                      RED TEAM
                      <span className="text-[10px] font-mono opacity-80">オッズ: 1.8x〜</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    賭け金（KTMコイン）
                  </label>
                  <div className="flex gap-2 mb-2">
                    {[100, 300, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBetAmount(amt)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                          betAmount === amt
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-stone-50 border-stone-200 hover:bg-stone-100 text-stone-700'
                        }`}
                      >
                        {amt}コイン
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={betAmount}
                    onChange={(e) => setBetAmount(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white py-3 rounded-xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Coins size={16} />
                  {isSubmitting ? '処理中...' : `${betTeam} チームに ${betAmount}コイン ベットする`}
                </button>
              </form>
            </div>

            {/* コイン獲得ルール */}
            <div className="bg-white rounded-3xl p-6 border border-black/10 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                <TrendingUp className="text-emerald-600" size={18} />
                コイン獲得ルール一覧
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-stone-50 border border-black/5">
                  <div className="font-bold text-stone-900">⚔️ カスタム募集主</div>
                  <div className="text-amber-600 font-black mt-0.5">+200コイン (満員時)</div>
                  <p className="text-[11px] text-stone-500 mt-1">自分で10人カスタムを募集・成立させた時</p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-black/5">
                  <div className="font-bold text-stone-900">🎮 募集参加（全モード）</div>
                  <div className="text-amber-600 font-black mt-0.5">+50〜100コイン</div>
                  <p className="text-[11px] text-stone-500 mt-1">カスタム+100、ノーマル/ARAM+50</p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-black/5">
                  <div className="font-bold text-stone-900">🏆 カスタム勝利</div>
                  <div className="text-amber-600 font-black mt-0.5">+150コイン</div>
                  <p className="text-[11px] text-stone-500 mt-1">対戦で勝利チームになった全員</p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-black/5">
                  <div className="font-bold text-stone-900">👑 MVP ＆ 殊勲賞</div>
                  <div className="text-amber-600 font-black mt-0.5">+200コイン</div>
                  <p className="text-[11px] text-stone-500 mt-1">MVP、最多キル、不沈艦タンク、ベストサポ</p>
                </div>
              </div>
            </div>
          </div>

          {/* 右側: KTM長者番付 (ランキング) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
                  <Trophy className="text-amber-500" size={20} />
                  KTM 長者番付 TOP 10
                </h2>
                <span className="text-xs font-bold text-stone-400">富豪ランキング</span>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-stone-400 font-bold">読み込み中...</div>
              ) : ranking.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400 font-bold">まだデータがありません</div>
              ) : (
                <div className="space-y-2">
                  {ranking.map((p, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                    const isTop3 = i < 3;
                    return (
                      <div
                        key={p.name}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                          isTop3
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-stone-50/70 border-black/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-center font-black text-sm">{medal}</span>
                          <div>
                            <Link
                              href={`/player/${encodeURIComponent(p.name)}`}
                              className="font-black text-stone-900 text-xs hover:text-amber-600 transition-colors flex items-center gap-1"
                            >
                              {p.name}
                              <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                            <span className="text-[10px] font-bold text-stone-400">{p.rank || 'UNRANKED'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-amber-600 font-mono">
                            {(p.coins ?? 1000).toLocaleString()} <span className="text-[10px]">コイン</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
