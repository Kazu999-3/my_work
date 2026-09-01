"use client";

import React, { useState, useEffect } from 'react';
import { Coins, Trophy, Flame, Swords, CheckCircle2, TrendingUp, Sparkles, Shield, ArrowRight, ShoppingBag, Heart, Gift, Target, Dices, Ticket, LogIn, LogOut, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useCurrentUser } from '../../hooks/useCurrentUser';

interface RankingPlayer {
  name: string;
  discordId: string;
  rank: string;
  coins: number;
}

const SHOP_ITEMS = [
  {
    id: 'first_role_pass',
    name: '📍 第一希望レーン確約チケット',
    price: 1500,
    icon: '📍',
    badge: '人気',
    desc: '次のカスタムで絶対にオフロールにならず第一希望でプレイできる権利！'
  },
  {
    id: 'bounty_target',
    name: '🎯 賞金首ターゲット指定権',
    price: 500,
    icon: '🎯',
    badge: '白熱',
    desc: '次の試合で「相手の〇〇選手を最初に倒した人に懸賞金」を掛けて試合を白熱させる！'
  },
  {
    id: 'handicap_lv1',
    name: '🎗️ Lv.1 軽度ハンデ縛り (得意BAN/フラッシュ禁止)',
    price: 300,
    icon: '🎗️',
    badge: '格差対策',
    desc: '2ランク格上の相手に「得意チャンプ1体BAN」または「フラッシュ禁止」を発動！実効MMR -150'
  },
  {
    id: 'handicap_lv2',
    name: '🎗️ Lv.2 中度ハンデ縛り (サモスペ/アイテム制限)',
    price: 600,
    icon: '🎗️',
    badge: 'おすすめ',
    desc: '2ランク格上の相手に「サモスペ1枠固定」または「特定アイテム禁止」を発動！実効MMR -300（1ランクダウン）'
  },
  {
    id: 'handicap_lv3',
    name: '🎗️ Lv.3 重度ハンデ縛り (ブレイバリー/ブーツ禁止)',
    price: 1200,
    icon: '🎗️',
    badge: '完全均衡',
    desc: '2ランク格上の相手に「ランダムビルド縛り」または「ブーツ禁止」を発動！実効MMR -500（2ランクダウンで互角化）'
  },
  {
    id: 'ultimate_bravery',
    name: '🎲 全員アルティメット・ブレイバリー発動権',
    price: 1000,
    icon: '🎲',
    badge: 'お祭り',
    desc: '10人全員がランダム抽選ビルドで戦う爆笑お祭りマッチを開催できる！'
  },
  {
    id: 'side_pick',
    name: '🟦 サイド選択権 (BLUE / RED指定)',
    price: 1000,
    icon: '🟦',
    badge: '有利',
    desc: 'ドラフトで勝率の高いBLUEサイド、またはREDサイドを自チームで確定選択！'
  },
  {
    id: 'lottery_ticket',
    name: '🎟️ 週末メガ宝くじ (1口)',
    price: 100,
    icon: '🎟️',
    badge: '一攫千金',
    desc: '毎週日曜22:00に抽選！当選者にジャックポット総取り（数万コイン）のチャンス！'
  }
];

export default function CasinoPage() {
  const { user, loginWithDiscord, logout, refreshUser } = useCurrentUser();
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [betTeam, setBetTeam] = useState<'BLUE' | 'RED'>('BLUE');
  const [betAmount, setBetAmount] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(true);
  const [betMessage, setBetMessage] = useState<string | null>(null);
  const [shopMessage, setShopMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 実効プレイヤー名（ログインユーザー優先）
  const activePlayerName = user?.displayName || '';

  // チップ送金用
  const [tipTo, setTipTo] = useState<string>('');
  const [tipAmount, setTipAmount] = useState<number>(100);
  const [tipMessageText, setTipMessageText] = useState<string>('ナイスキャリー！');

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
    if (!activePlayerName.trim()) {
      alert('Discordでログインするか、お名前を選択してください。');
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
          playerName: activePlayerName.trim(),
          team: betTeam,
          amount: betAmount,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBetMessage(`🎉 【ベット完了】 ${data.playerName} さんが ${data.team} に ${data.amount}コイン 賭けました！ (残高: ${data.remainingCoins}コイン)`);
        fetchBetData();
        refreshUser();
      } else {
        alert(data.error || 'ベットに失敗しました。');
      }
    } catch (e: any) {
      alert('エラーが発生しました: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBuyItem = async (itemId: string, itemName: string, price: number) => {
    if (!user) {
      if (confirm('アイテムを購入するにはDiscordアカウントでログインが必要です。ログイン画面へ移動しますか？')) {
        loginWithDiscord('/casino');
      }
      return;
    }
    if (!confirm(`「${itemName}」を ${price}コイン で購入しますか？`)) {
      return;
    }

    try {
      const res = await fetch('/api/bet/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: activePlayerName.trim(),
          itemId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShopMessage(data.message);
        fetchBetData();
        refreshUser();
      } else {
        alert(data.error || '購入に失敗しました。');
      }
    } catch (e: any) {
      alert('エラー: ' + e.message);
    }
  };

  const handleSendTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlayerName.trim()) {
      alert('Discordでログインするか、あなたの名前を選択してください。');
      return;
    }
    if (!tipTo.trim()) {
      alert('チップを送る相手のサモナー名を選択または入力してください。');
      return;
    }

    try {
      const res = await fetch('/api/bet/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromName: activePlayerName.trim(),
          toName: tipTo.trim(),
          amount: tipAmount,
          message: tipMessageText.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.announcement);
        fetchBetData();
        refreshUser();
      } else {
        alert(data.error || 'チップ送信に失敗しました。');
      }
    } catch (e: any) {
      alert('エラー: ' + e.message);
    }
  };

  return (
    <div className="min-h-screen pb-16 bg-[#eae4d4] text-[#201c2b]">
      {/* ヒーローセクション */}
      <div className="bg-gradient-to-b from-stone-900 via-stone-850 to-stone-900 text-stone-100 py-12 px-6 relative overflow-hidden border-b border-black/10">
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black tracking-wider border border-amber-500/30">
            <Sparkles size={14} />
            KTM Sovereign Casino & Shop
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center justify-center gap-3">
            <Coins className="text-amber-400" size={32} />
            勝敗ベット ＆ KTMショップ ＆ 長者番付
          </h1>
          <p className="text-stone-300 text-xs md:text-sm max-w-xl mx-auto font-medium">
            勝敗予想でコインを増やし、特権チケットやバラエティ権と交換しよう🔥
          </p>

          {/* ジャックポット金庫バナー */}
          <div className="mt-4 inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-amber-950/80 border border-amber-500/40 text-amber-200 text-xs font-black">
            <span className="text-base">💎</span>
            サーバー共有ジャックポット金庫: <span className="text-amber-400 font-mono text-sm">12,800 コイン</span>
            <span className="text-[10px] text-stone-400 font-normal">（ペンタキル達成で総取り！）</span>
          </div>
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

              {/* ユーザー認証状態カード */}
              {user ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatar}
                      alt={user.displayName}
                      className="w-11 h-11 rounded-full border-2 border-amber-500/40 shadow-xs"
                    />
                    <div>
                      <div className="text-sm font-black text-stone-900 flex items-center gap-2">
                        {user.displayName}
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-bold border border-amber-300">
                          {user.rank}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-amber-700 flex items-center gap-1 mt-0.5">
                        <span>🪙 所持残高:</span>
                        <strong className="font-mono text-sm">{(user.coins ?? 1000).toLocaleString()}</strong>
                        <span>コイン</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="text-xs text-stone-500 hover:text-stone-800 underline font-bold px-2 py-1"
                  >
                    ログアウト
                  </button>
                </div>
              ) : (
                <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-950 via-stone-900 to-indigo-950 border border-indigo-500/30 text-white space-y-5 text-center shadow-2xl">
                  <div className="w-14 h-14 rounded-2xl bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/40 flex items-center justify-center mx-auto text-3xl">
                    🎮
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">
                      Discordアカウントでログイン
                    </h3>
                    <p className="text-xs text-stone-300 mt-1 max-w-sm mx-auto leading-relaxed">
                      Discordでログインすると、あなたのアカウント残高から名前手入力なしでワンタップ勝敗ベットやアイテム購入ができます🔥
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loginWithDiscord('/casino')}
                    className="w-full max-w-xs mx-auto py-3.5 px-6 rounded-2xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-sm transition-all shadow-lg hover:shadow-indigo-500/20 flex items-center justify-center gap-2.5 cursor-pointer transform active:scale-95"
                  >
                    <LogIn size={20} />
                    Discordアカウントでログインする
                  </button>
                </div>
              )}

              {user && (
                <form onSubmit={handlePlaceBet} className="space-y-4">
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
              )}
            </div>

            {/* 🤝 仲間への投げ銭 (チップ) 送金 */}
            {user && (
              <div className="bg-white rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-stone-100 pb-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <Heart size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-stone-900">推しプレイヤー・仲間へチップを送る</h3>
                    <p className="text-xs text-stone-500">ナイスプレイやキャリーへ感謝のコインをプレゼント！</p>
                  </div>
                </div>

                <form onSubmit={handleSendTip} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">送り先メンバー</label>
                      <select
                        value={tipTo}
                        onChange={(e) => setTipTo(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                        required
                      >
                        <option value="">選択してください...</option>
                        {ranking
                          .filter((p) => p.name !== user.displayName)
                          .map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name} ({p.rank || 'UNRANKED'})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">チップ額 (コイン)</label>
                      <input
                        type="number"
                        min="10"
                        value={tipAmount}
                        onChange={(e) => setTipAmount(Number(e.target.value))}
                        className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">メッセージ</label>
                    <input
                      type="text"
                      placeholder="例: 今日のウルト最高でした！"
                      value={tipMessageText}
                      onChange={(e) => setTipMessageText(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-xl font-black text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Gift size={15} />
                    {tipTo || '相手'} に {tipAmount}コイン をチップする
                  </button>
                </form>
              </div>
            )}
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
                  <p className="text-[11px] text-stone-500 mt-1">10人カスタムを募集・成立させた時</p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-black/5">
                  <div className="font-bold text-stone-900">👥 他モード募集主</div>
                  <div className="text-amber-600 font-black mt-0.5">+100コイン (満員時)</div>
                  <p className="text-[11px] text-stone-500 mt-1">ノーマル/ARAM/Flex成立時</p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-black/5">
                  <div className="font-bold text-stone-900">🎮 募集参加（全モード）</div>
                  <div className="text-amber-600 font-black mt-0.5">+50〜100コイン</div>
                  <p className="text-[11px] text-stone-500 mt-1">カスタム+100、他モード+50</p>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-black/5">
                  <div className="font-bold text-stone-900">🏆 勝利 ＆ MVP賞</div>
                  <div className="text-amber-600 font-black mt-0.5">+150〜200コイン</div>
                  <p className="text-[11px] text-stone-500 mt-1">勝利+150、MVP・最多キル等+200</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 🛒 KTMショップ・交換所セクション */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center font-bold">
                <ShoppingBag size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-stone-900">🛒 KTMショップ ＆ 特権アイテム交換所</h2>
                <p className="text-xs text-stone-500">貯めたコインでカスタム特権チケットやバラエティ権をGET！</p>
              </div>
            </div>
          </div>

          {shopMessage && (
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-indigo-600" />
              {shopMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SHOP_ITEMS.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-stone-50 border border-black/5 flex flex-col justify-between hover:border-amber-300 transition-all group space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="font-black text-stone-900 text-xs group-hover:text-amber-700 transition-colors">
                    {item.name}
                  </h3>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-black/5">
                  <span className="text-xs font-black text-amber-600 font-mono">
                    {item.price.toLocaleString()} コイン
                  </span>
                  <button
                    onClick={() => handleBuyItem(item.id, item.name, item.price)}
                    className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-amber-600 text-white text-[11px] font-bold transition-colors cursor-pointer shadow-sm"
                  >
                    購入する
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
