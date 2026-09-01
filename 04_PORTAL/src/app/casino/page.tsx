"use client";

import React, { useState, useEffect } from 'react';
import { Coins, Trophy, Flame, Swords, CheckCircle2, TrendingUp, Sparkles, Shield, ArrowRight, ShoppingBag, Heart, Gift, Target, Dices, Ticket, LogIn, LogOut, UserCheck } from 'lucide-react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { useCurrentUser } from '../../hooks/useCurrentUser';

interface RankingPlayer {
  name: string;
  discordId: string;
  rank: string;
  coins: number;
}

const SHOP_ITEMS = [
  {
    id: 'champ_protect',
    name: '🛡️ チャンピオンプロテクト権 (マイチャンプ保護)',
    price: 800,
    icon: '🛡️',
    badge: 'BAN保護',
    desc: '相手チームからのBANを1体絶対に阻止し、自分の得意チャンピオンを必ず使える権利！'
  },
  {
    id: 'ban_free',
    name: '🚫 全員BAN禁止マッチ権 (自由ピック対決)',
    price: 800,
    icon: '🚫',
    badge: 'ドラフト',
    desc: '次の試合で両チームのBAN枠を全撤廃し、お互い好きなチャンピオンを完全自由に使って対決！'
  },
  {
    id: 'bounty_target',
    name: '🎯 賞金首ターゲット指定権',
    price: 500,
    icon: '🎯',
    badge: '懸賞金',
    desc: '次の試合で「相手の〇〇選手を最初に倒した人に懸賞金」を掛けて試合を白熱させる！'
  },
  {
    id: 'handicap_lv1',
    name: '🎗️ Lv.1 軽度ハンデ縛り (得意BAN/フラッシュ禁止)',
    price: 300,
    icon: '🎗️',
    badge: 'ハンデ',
    desc: '2ランク格上の相手に「得意チャンプ1体BAN」または「フラッシュ禁止」を発動！実効MMR -150'
  },
  {
    id: 'handicap_lv2',
    name: '🎗️ Lv.2 中度ハンデ縛り (サモスペ/アイテム制限)',
    price: 600,
    icon: '🎗️',
    badge: 'ハンデ',
    desc: '2ランク格上の相手に「サモスペ1枠固定」または「特定アイテム禁止」を発動！実効MMR -300（1ランクダウン）'
  },
  {
    id: 'handicap_lv3',
    name: '🎗️ Lv.3 重度ハンデ縛り (アイテム縛り/ブーツ禁止)',
    price: 1200,
    icon: '🎗️',
    badge: 'ハンデ',
    desc: '2ランク格上の相手に「ランダムビルド縛り」または「ブーツ禁止」を発動！実効MMR -500（2ランクダウンで互角化）'
  },
  {
    id: 'ultimate_bravery',
    name: '🎲 全員ランダムビルド対決権',
    price: 1000,
    icon: '🎲',
    badge: 'お祭りルール',
    desc: '10人全員がランダム抽選のアイテムビルドで戦う爆笑お祭りマッチを開催できる！'
  },
  {
    id: 'side_pick',
    name: '🟦 サイド選択権 (BLUE / RED指定)',
    price: 1000,
    icon: '🟦',
    badge: 'ドラフト',
    desc: 'ドラフトで勝率の高いBLUEサイド、またはREDサイドを自チームで確定選択！'
  },
  {
    id: 'lottery_ticket',
    name: '🎟️ 週末メガ宝くじ (1口)',
    price: 100,
    icon: '🎟️',
    badge: '定期抽選',
    desc: '毎週日曜22:00に抽選！当選者にジャックポット総取り（数万コイン）のチャンス！'
  }
];

export default function CasinoPage() {
  const { user, loginWithDiscord, logout, refreshUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<'bet' | 'shop' | 'tip' | 'ranking'>('bet');
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [activeMatch, setActiveMatch] = useState<any | null>(null);
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
    fetchActiveMatch();
    const interval = setInterval(fetchActiveMatch, 15000); // 15秒ごとに最新試合をチェック
    return () => clearInterval(interval);
  }, []);

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#3b82f6', '#ec4899', '#10b981'],
      });
    } catch {}
  };

  const fetchActiveMatch = async () => {
    try {
      const res = await fetch('/api/balancer/pending');
      if (res.ok) {
        const data = await res.json();
        setActiveMatch(data.activeMatch || null);
      }
    } catch (e) {
      console.error('Failed to fetch active match:', e);
    }
  };

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
        triggerCelebration();
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
        triggerCelebration();
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
        triggerCelebration();
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
            勝敗予想 ＆ KTMショップ ＆ 長者番付
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

      <div className="max-w-[1200px] w-full mx-auto px-4 md:px-8 py-8 space-y-6">
        
        {/* 4大機能タブナビゲーション */}
        <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-stone-900 text-white max-w-xl mx-auto shadow-lg overflow-x-auto">
          {[
            { id: 'bet', label: '🎯 勝敗予想', desc: '試合予想' },
            { id: 'shop', label: '🛒 KTMショップ', desc: '特権交換' },
            { id: 'tip', label: '🤝 チップ送信', desc: '推し応援' },
            { id: 'ranking', label: '🏆 長者番付', desc: 'コイン順位' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-stone-950 shadow-md scale-102'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ユーザー認証状態ヘッダー（ログイン時は全タブで常時表示） */}
        {user ? (
          <div className="p-4 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-between flex-wrap gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <img
                src={user.avatar}
                alt={user.displayName}
                className="w-12 h-12 rounded-2xl border-2 border-amber-500 shadow-sm"
              />
              <div>
                <div className="text-sm font-black text-stone-900 flex items-center gap-2">
                  {user.displayName}
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-bold border border-amber-300">
                    {user.rank}
                  </span>
                </div>
                <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5 mt-0.5">
                  <span>🪙 あなたの残高:</span>
                  <strong className="font-mono text-base text-amber-600">{(user.coins ?? 1000).toLocaleString()}</strong>
                  <span>コイン</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="text-xs text-stone-500 hover:text-stone-800 underline font-bold px-3 py-1.5 rounded-xl hover:bg-black/5"
            >
              ログアウト
            </button>
          </div>
        ) : (
          <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-950 via-stone-900 to-indigo-950 border border-indigo-500/30 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl text-center md:text-left">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/40 flex items-center justify-center text-2xl shrink-0">
                🎮
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  Discordアカウントで1秒ログイン
                </h3>
                <p className="text-xs text-stone-300 mt-0.5">
                  ログインすると、手入力不要でワンタップ勝敗ベットやアイテム購入が楽しめます！
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loginWithDiscord('/casino')}
              className="w-full md:w-auto py-2.5 px-6 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <LogIn size={16} />
              Discordでログイン
            </button>
          </div>
        )}

        {/* タブ1: 🎯 勝敗予想 */}
        {activeTab === 'bet' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                  <Flame size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-stone-900">カスタム勝敗予想</h2>
                  <p className="text-xs text-stone-500">次のマッチの勝利チームを予想してコインを賭けよう！</p>
                </div>
              </div>
            </div>

            {betMessage && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                {betMessage}
              </div>
            )}

            {/* 試合受付状況に応じた表示切り替え */}
            {activeMatch ? (
              <div className="space-y-6">
                {/* 対戦カード表示 */}
                <div className="p-5 rounded-3xl bg-stone-900 text-white space-y-4 border border-stone-800 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                      </span>
                      <span className="text-xs font-black text-rose-400 tracking-wider">LIVE MATCH 受付中</span>
                    </div>
                    <div className="text-xs font-bold text-amber-300 font-mono">
                      勝率予想: 🟦 {activeMatch.blueWinRate ? `${Math.round(activeMatch.blueWinRate * 100)}%` : '50%'} vs 🟥 {activeMatch.blueWinRate ? `${Math.round((1 - activeMatch.blueWinRate) * 100)}%` : '50%'}
                    </div>
                  </div>

                  {/* 5v5 対戦メンバー */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {/* BLUE TEAM */}
                    <div className="p-3.5 rounded-2xl bg-indigo-950/60 border-2 border-indigo-500/40 space-y-2">
                      <div className="flex items-center justify-between border-b border-indigo-500/20 pb-1.5">
                        <span className="text-xs font-black text-indigo-400">🟦 BLUE TEAM</span>
                        <span className="text-[10px] font-mono text-indigo-300">MMR: {activeMatch.teamBlue ? Math.round(activeMatch.teamBlue.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / activeMatch.teamBlue.length) : '-'}</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {(activeMatch.teamBlue || []).map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-stone-200 truncate">{p.assignedRole || p.role || `P${i+1}`}: {p.name}</span>
                            <span className="text-[9px] text-stone-400 font-mono shrink-0">{p.rank || p.highestRank || ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* RED TEAM */}
                    <div className="p-3.5 rounded-2xl bg-rose-950/60 border-2 border-rose-500/40 space-y-2">
                      <div className="flex items-center justify-between border-b border-rose-500/20 pb-1.5">
                        <span className="text-xs font-black text-rose-400">🟥 RED TEAM</span>
                        <span className="text-[10px] font-mono text-rose-300">MMR: {activeMatch.teamRed ? Math.round(activeMatch.teamRed.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / activeMatch.teamRed.length) : '-'}</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {(activeMatch.teamRed || []).map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-stone-200 truncate">{p.assignedRole || p.role || `P${i+1}`}: {p.name}</span>
                            <span className="text-[9px] text-stone-400 font-mono shrink-0">{p.rank || p.highestRank || ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ベットフォーム */}
                {user ? (
                  <form onSubmit={handlePlaceBet} className="space-y-5">
                    <div>
                      <label className="block text-xs font-black text-stone-700 mb-2">
                        👉 どちらのチームが勝つか選んでください:
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setBetTeam('BLUE')}
                          className={`p-5 rounded-3xl border-3 font-black text-sm transition-all flex flex-col items-center gap-2 cursor-pointer ${
                            betTeam === 'BLUE'
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md scale-102'
                              : 'border-stone-200 hover:border-indigo-200 text-stone-600'
                          }`}
                        >
                          <span className="text-2xl">🟦</span>
                          <span>BLUE TEAM の勝ち！</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono font-black">
                            オッズ: 1.85倍
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setBetTeam('RED')}
                          className={`p-5 rounded-3xl border-3 font-black text-sm transition-all flex flex-col items-center gap-2 cursor-pointer ${
                            betTeam === 'RED'
                              ? 'border-rose-600 bg-rose-50 text-rose-700 shadow-md scale-102'
                              : 'border-stone-200 hover:border-rose-200 text-stone-600'
                          }`}
                        >
                          <span className="text-2xl">🟥</span>
                          <span>RED TEAM の勝ち！</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono font-black">
                            オッズ: 1.95倍
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* 賭け金 & もらえるコイン直感シミュレーター */}
                    <div className="p-5 rounded-3xl bg-amber-50/60 border border-amber-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-black text-stone-800">
                          🪙 賭けるコイン数
                        </label>
                        {/* 🎯 もらえるコイン直感表示 */}
                        <div className="text-right">
                          <span className="text-[11px] text-stone-500 font-bold">勝った場合の手取り: </span>
                          <strong className="text-sm font-black text-amber-600 font-mono">
                            🎯 +{Math.round(betAmount * (betTeam === 'BLUE' ? 1.85 : 1.95))} コインGET！
                          </strong>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {[50, 100, 300, 500, 1000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setBetAmount(amt)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                              betAmount === amt
                                ? 'bg-amber-500 text-white border-amber-600 shadow-sm scale-105'
                                : 'bg-white hover:bg-amber-100/50 text-stone-700 border-stone-200'
                            }`}
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min="1"
                        max={user?.coins ?? 1000}
                        value={betAmount}
                        onChange={(e) => setBetAmount(Number(e.target.value))}
                        className="w-full bg-white border border-stone-300 rounded-xl px-4 py-2.5 text-sm font-black text-stone-900 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-white py-4 rounded-2xl font-black text-base transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transform active:scale-98"
                    >
                      <Coins size={20} />
                      {isSubmitting ? '処理中...' : `🪙 ${betAmount}コイン を ${betTeam} の勝利にベット！`}
                    </button>
                  </form>
                ) : (
                  <div className="text-center p-6 bg-stone-50 rounded-2xl border border-stone-200">
                    <p className="text-xs text-stone-600 font-bold mb-3">
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
              <div className="p-8 md:p-12 rounded-3xl bg-stone-50 border border-black/5 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-3xl bg-amber-100/80 text-amber-700 flex items-center justify-center mx-auto text-3xl">
                  ☕
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-stone-900">
                    現在受付中のカスタム対戦はありません
                  </h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                    バランサーでチーム分けが確定されると、ここに自動で5v5対戦カードが出現し、勝敗ベットの投票が開始されます🔥
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/balancer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-stone-900 hover:bg-amber-600 text-white font-black text-xs transition-all shadow-md hover:shadow-lg cursor-pointer transform active:scale-95"
                  >
                    <Swords size={16} />
                    バランサーでチーム分けを行う
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* タブ2: 🛒 KTMショップ */}
        {activeTab === 'shop' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-stone-900">KTMショップ ＆ 特権アイテム交換所</h2>
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
                  className="p-5 rounded-3xl bg-stone-50 border-2 border-stone-200/80 hover:border-amber-400 transition-all flex flex-col justify-between space-y-4 group shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl">{item.icon}</span>
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black">
                        {item.badge}
                      </span>
                    </div>
                    <h3 className="font-black text-stone-900 text-sm group-hover:text-amber-700 transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-stone-200">
                    <span className="text-sm font-black text-amber-600 font-mono">
                      🪙 {item.price.toLocaleString()}
                    </span>
                    <button
                      onClick={() => handleBuyItem(item.id, item.name, item.price)}
                      className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-amber-600 text-white text-xs font-black transition-colors cursor-pointer shadow-sm"
                    >
                      交換する
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* タブ3: 🤝 投げ銭 (チップ) 送金 */}
        {activeTab === 'tip' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Heart size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-stone-900">推しプレイヤー・仲間へチップを送る</h3>
                <p className="text-xs text-stone-500">ナイスプレイやキャリーへ感謝のコインをプレゼント！</p>
              </div>
            </div>

            <form onSubmit={handleSendTip} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1.5">送り先メンバー</label>
                  <select
                    value={tipTo}
                    onChange={(e) => setTipTo(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none"
                    required
                  >
                    <option value="">選択してください...</option>
                    {ranking
                      .filter((p) => p.name !== user?.displayName)
                      .map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} ({p.rank || 'UNRANKED'})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1.5">チップ額 (コイン)</label>
                  <input
                    type="number"
                    min="10"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1.5">応援メッセージ</label>
                <input
                  type="text"
                  placeholder="例: 今日のウルト最高でした！"
                  value={tipMessageText}
                  onChange={(e) => setTipMessageText(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!user}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3.5 rounded-2xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Gift size={16} />
                🪙 {tipAmount}コイン を {tipTo || '仲間'} にプレゼント！
              </button>
            </form>
          </div>
        )}

        {/* タブ4: 🏆 長者番付 (ランキング) */}
        {activeTab === 'ranking' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Trophy size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-stone-900">KTM 長者番付 TOP 10</h3>
                  <p className="text-xs text-stone-500">カスタムベットで最もコインを稼いだ富豪たち！</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {ranking.map((p, idx) => (
                <div
                  key={p.name}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    idx === 0
                      ? 'bg-amber-50/80 border-amber-300 font-bold shadow-xs'
                      : idx === 1
                      ? 'bg-stone-50 border-stone-300 font-bold'
                      : idx === 2
                      ? 'bg-amber-900/5 border-amber-700/20 font-bold'
                      : 'bg-white border-black/5 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm font-black font-mono">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                    </span>
                    <div>
                      <div className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                        {p.name}
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/5 text-stone-600 font-mono">
                          {p.rank}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-amber-600 font-mono">
                      🪙 {(p.coins ?? 1000).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
