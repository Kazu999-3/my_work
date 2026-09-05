"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Coins, Trophy, Flame, Swords, CheckCircle2, TrendingUp, Sparkles, Shield, ArrowRight, ShoppingBag, Heart, Gift, Target, Dices, Ticket, LogIn, LogOut, UserCheck } from 'lucide-react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { supabase } from '../../lib/supabaseClient';

interface RankingPlayer {
  name: string;
  discordId: string;
  rank: string;
  coins: number;
}

const SHOP_ITEMS = [
  {
    id: 'force_champ_pick',
    name: '👑 下剋上キャラ指定権 (高レート使用キャラ強制)',
    price: 500,
    icon: '👑',
    badge: '下剋上 (MMR -400)',
    desc: '低レート側が、相手の高レートプレイヤーが使うチャンピオンを1体強制指定！苦手キャラを押し付けて下剋上を起こそう！ (対象実効MMR -400補正)'
  },
  {
    id: 'lane_heavy_ban',
    name: '🚫 特定レーン複数BAN権 (レーン集中封鎖)',
    price: 400,
    icon: '🚫',
    badge: 'ドラフト (MMR -200)',
    desc: 'あらかじめ特定のレーン（TOPやMIDなど）の使用禁止キャラを事前に複数体指定して徹底封鎖！ (対象実効MMR -200補正)'
  },
  {
    id: 'force_enemy_roles',
    name: '🔀 相手ロール強制配置権 (ポジション指定)',
    price: 500,
    icon: '🔀',
    badge: 'お祭り (戦績ノーカウント)',
    desc: 'チーム分け確定後、相手チームの誰がどのレーン（TOP/JG/MID/ADC/SUP）を担当するかをこちらが勝手に指定！ ※お祭りマッチのため公式戦績・MMR変動には反映されません（完全保護）。'
  },
  {
    id: 'all_offmeta_match',
    name: '🤡 完全オフメタカスタム開催権',
    price: 400,
    icon: '🤡',
    badge: 'お祭り (戦績ノーカウント)',
    desc: '通常のメタピックは全面禁止！10人全員が普段絶対に見られない未開拓オフメタ構成で戦う爆笑マッチ！ ※お祭りマッチのため公式戦績・MMR変動には反映されません（完全保護）。'
  },
  {
    id: 'all_random_match',
    name: '🎲 キャラランダムカスタム開催権 (ALL RANDOM)',
    price: 400,
    icon: '🎲',
    badge: 'お祭り (戦績ノーカウント)',
    desc: '10人全員がランダム抽選されたチャンピオンで戦う完全運ゲーお祭り対決！ ※お祭りマッチのため公式戦績・MMR変動には反映されません（完全保護）。'
  },
  {
    id: 'ultimate_bravery',
    name: '🎲 全員ランダムビルド対決権',
    price: 300,
    icon: '🎲',
    badge: 'お祭り (戦績ノーカウント)',
    desc: '10人全員がランダム抽選のアイテムビルドで戦う爆笑お祭りマッチ！ ※お祭りマッチのため公式戦績・MMR変動には反映されません（完全保護）。'
  },
  {
    id: 'champ_protect',
    name: '🛡️ チャンピオンプロテクト権 (マイチャンプ保護)',
    price: 500,
    icon: '🛡️',
    badge: 'BAN保護 (MMR +150)',
    desc: '相手チームからのBANを1体絶対に阻止し、自分の得意チャンピオンを必ず使える権利！ (使用者実効MMR +150補正)'
  },
  {
    id: 'ban_free',
    name: '🚫 全員BAN禁止マッチ権 (自由ピック対決)',
    price: 400,
    icon: '🚫',
    badge: 'ドラフト',
    desc: '次の試合で両チームのBAN枠を全撤廃し、お互い好きなチャンピオンを完全自由に使って対決！'
  },
  {
    id: 'bounty_target',
    name: '🎯 賞金首ターゲット指定権',
    price: 300,
    icon: '🎯',
    badge: '懸賞金',
    desc: '次の試合で「相手の〇〇選手を最初に倒した人に懸賞金」を掛けて試合を白熱させる！'
  },
  {
    id: 'side_pick',
    name: '🟦 サイド選択権 (BLUE / RED指定)',
    price: 500,
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
  const [activeTab, setActiveTab] = useState<'bet' | 'shop'>('bet');
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [activeMatch, setActiveMatch] = useState<any | null>(null);
  const [betTeam, setBetTeam] = useState<'BLUE' | 'RED'>('BLUE');
  const [betAmount, setBetAmount] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(true);
  const [betMessage, setBetMessage] = useState<string | null>(null);
  const [shopMessage, setShopMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [inventory, setInventory] = useState<Array<{ id: string; name: string; icon: string; boughtAt: string }>>([]);
  const [lastClaimDate, setLastClaimDate] = useState<string | null>(null);
  const [betStats, setBetStats] = useState<{
    blueAmount: number;
    redAmount: number;
    blueCount: number;
    redCount: number;
    totalAmount: number;
    blueRatio: number;
    redRatio: number;
    jackpot?: {
      amount: number;
      lastWinner: string | null;
      lastPayout: number;
      lastWonAt: string | null;
    };
  }>({
    blueAmount: 0,
    redAmount: 0,
    blueCount: 0,
    redCount: 0,
    totalAmount: 0,
    blueRatio: 50,
    redRatio: 50,
    jackpot: {
      amount: 12800,
      lastWinner: null,
      lastPayout: 0,
      lastWonAt: null
    }
  });

  // 実効プレイヤー名（ログインユーザー優先）
  const activePlayerName = user?.displayName || '';

  useEffect(() => {
    fetchBetData();
    fetchActiveMatch();
    if (user?.discordId || user?.displayName) {
      fetchInventory();
    }

    // 10秒ごとのフォールバックポーリング
    const interval = setInterval(() => {
      fetchActiveMatch();
      fetchBetData();
    }, 10000);

    // 🎲 Supabase Realtime による試合確定・ベット受付の即時同期
    let channel: any = null;
    try {
      channel = supabase
        .channel('realtime-casino')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'edge_tasks' }, () => {
          fetchActiveMatch();
          fetchBetData();
        })
        .subscribe();
    } catch (rErr) {
      console.warn('[casino] Realtime subscription warning:', rErr);
    }

    return () => {
      clearInterval(interval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  const fetchInventory = async () => {
    try {
      const params = new URLSearchParams();
      if (user?.discordId) params.append('discordId', user.discordId);
      if (user?.displayName) params.append('name', user.displayName);
      const res = await fetch(`/api/bet/shop?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInventory(data.inventory || []);
      }
    } catch (e) {
      console.error('Failed to fetch inventory:', e);
    }
  };

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

  // リアルタイム動的オッズ（パリミュチュエル方式：投票比率に反比例）
  const calculatedOdds = useMemo(() => {
    if (!betStats || (betStats.blueAmount === 0 && betStats.redAmount === 0)) {
      return { blue: 1.85, red: 1.95 };
    }
    const total = betStats.blueAmount + betStats.redAmount;
    const blueRatio = betStats.blueAmount > 0 ? betStats.blueAmount / total : 0.5;
    const redRatio = betStats.redAmount > 0 ? betStats.redAmount / total : 0.5;

    // オッズ = (0.95 / 比率)
    const rawBlue = 0.95 / Math.max(blueRatio, 0.05);
    const rawRed = 0.95 / Math.max(redRatio, 0.05);

    const blueOdds = Number(Math.min(10.0, Math.max(1.15, rawBlue)).toFixed(2));
    const redOdds = Number(Math.min(10.0, Math.max(1.15, rawRed)).toFixed(2));

    return { blue: blueOdds, red: redOdds };
  }, [betStats]);

  // ⚔️ 現在のログインユーザーがこの試合の出場選手（BLUE / RED）かどうかを判定
  const isParticipant = useMemo(() => {
    if (!activeMatch || !user) return false;
    const matchPlayers = [...(activeMatch.teamBlue || []), ...(activeMatch.teamRed || [])];
    const userIdentifiers = [
      user.displayName?.toLowerCase().trim(),
      user.username?.toLowerCase().trim(),
      user.discordId?.trim()
    ].filter(Boolean);

    return matchPlayers.some((p: any) => {
      const pName = (p.name || '').toLowerCase().trim();
      const pDiscordId = p.discordId || p.discord_id;
      return userIdentifiers.some(id => id === pName || (pDiscordId && id === pDiscordId));
    });
  }, [activeMatch, user]);

  const fetchBetData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (user?.discordId) params.append('discordId', user.discordId);
      if (user?.displayName) params.append('name', user.displayName);
      const res = await fetch(`/api/bet?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRanking(data.ranking || []);
        if (data.betStats) {
          setBetStats({
            ...data.betStats,
            jackpot: data.jackpot || data.betStats.jackpot,
          });
        }
        if (data.lastClaimDate) setLastClaimDate(data.lastClaimDate);
      }
    } catch (e) {
      console.error('Failed to fetch bet data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimBonus = async (type: 'daily' | 'rescue') => {
    if (!user) {
      alert('ボーナスを受け取るにはDiscordでログインしてください。');
      return;
    }
    try {
      const res = await fetch('/api/bet', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: user.discordId,
          playerName: user.displayName || user.username,
          type
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerCelebration();
        alert(data.message);
        fetchBetData();
        refreshUser();
      } else {
        alert(data.error || '受取に失敗しました。');
      }
    } catch (e: any) {
      alert('エラー: ' + e.message);
    }
  };

  const handleAnnounceTicket = async (item: any) => {
    if (!confirm(`「${item.name}」を次回試合で発動することをDiscordに宣言しますか？`)) {
      return;
    }
    try {
      const res = await fetch('/api/bet/shop/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: user?.discordId,
          playerName: activePlayerName || user?.username,
          itemId: item.id,
          itemName: item.name,
          itemIcon: item.icon,
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerCelebration();
        alert(data.message);
        fetchInventory();
      } else {
        alert(data.error || '発動宣言に失敗しました。');
      }
    } catch (e: any) {
      alert('エラー: ' + e.message);
    }
  };

  const handlePlaceBet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlayerName.trim() && !user?.discordId) {
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
      const currentOdds = betTeam === 'BLUE' ? calculatedOdds.blue : calculatedOdds.red;
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: user?.discordId,
          playerName: activePlayerName.trim() || user?.username,
          team: betTeam,
          amount: betAmount,
          odds: currentOdds,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        triggerCelebration();
        setBetMessage(`🎉 【ベット完了】 ${data.playerName} さんが ${data.team} に ${data.amount}コイン 賭けました！ (オッズ: x${currentOdds}倍 / 残高: ${data.remainingCoins}コイン)`);
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
          discordId: user.discordId,
          playerName: activePlayerName.trim() || user.username,
          itemId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        triggerCelebration();
        setShopMessage(data.message);
        fetchBetData();
        fetchInventory();
        refreshUser();
      } else {
        alert(data.error || '購入に失敗しました。');
      }
    } catch (e: any) {
      alert('エラー: ' + e.message);
    }
  };

  const handleCreateMockMatch = async () => {
    try {
      const mockResult = {
        teamBlue: [
          { name: 'かずき', role: 'TOP', rank: 'DIAMOND', mmr: 2100 },
          { name: 'Player_Jg', role: 'JG', rank: 'EMERALD', mmr: 1750 },
          { name: 'Player_Mid', role: 'MID', rank: 'PLATINUM', mmr: 1550 },
          { name: 'Player_Adc', role: 'ADC', rank: 'GOLD', mmr: 1350 },
          { name: 'Player_Sup', role: 'SUP', rank: 'GOLD', mmr: 1300 },
        ],
        teamRed: [
          { name: 'Rival_Top', role: 'TOP', rank: 'DIAMOND', mmr: 2050 },
          { name: 'Rival_Jg', role: 'JG', rank: 'EMERALD', mmr: 1800 },
          { name: 'Rival_Mid', role: 'MID', rank: 'PLATINUM', mmr: 1600 },
          { name: 'Rival_Adc', role: 'ADC', rank: 'PLATINUM', mmr: 1500 },
          { name: 'Rival_Sup', role: 'SUP', rank: 'SILVER', mmr: 1100 },
        ],
        blueWinRate: 0.52,
        isExhibition: false,
      };

      const res = await fetch('/api/balancer/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balanceResult: mockResult }),
      });

      if (res.ok) {
        triggerCelebration();
        fetchActiveMatch();
        alert('🎮 模擬カスタム対戦を生成しました！勝敗予想の受付を開始します🔥');
      } else {
        alert('模擬対戦の生成に失敗しました。');
      }
    } catch (e: any) {
      alert('エラー: ' + e.message);
    }
  };

  return (
    <div className="min-h-screen pb-16 bg-[#eae4d4] text-[#201c2b]">
      {/* ヒーローセクション */}
      <div className="bg-gradient-to-b from-stone-900 via-stone-850 to-stone-900 text-stone-100 py-10 px-6 relative overflow-hidden border-b border-black/10">
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black tracking-wider border border-amber-500/30">
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
          <div className="mt-4 inline-flex flex-col items-center justify-center gap-1.5 px-4 md:px-6 py-2.5 rounded-2xl bg-amber-950/80 border-2 border-amber-500/40 text-amber-200 text-xs font-black text-center max-w-full shadow-lg">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-base animate-bounce">💎</span>
              <span>サーバー共有ジャックポット金庫:</span>
              <span className="text-amber-400 font-mono text-base font-black">
                {(betStats.jackpot?.amount ?? 12800).toLocaleString()} コイン
              </span>
              <span className="text-[10px] text-amber-300/80 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                🔥 ペンタキルで総取り！
              </span>
            </div>
            {betStats.jackpot?.lastWinner && (
              <div className="text-[10px] text-stone-400 font-medium">
                👑 直近の総取り当選者: <strong className="text-amber-300">{betStats.jackpot.lastWinner}</strong> さん（+{betStats.jackpot.lastPayout.toLocaleString()}🪙）
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] w-full mx-auto px-4 md:px-8 py-8 space-y-6">

        {/* 2大機能タブナビゲーション */}
        <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-stone-900 text-white max-w-sm mx-auto shadow-lg">
          {[
            { id: 'bet', label: '🎯 勝敗予想', desc: '試合予想 ＆ 長者番付' },
            { id: 'shop', label: '🛒 KTMショップ', desc: '特権交換' },
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
          <div className="p-5 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 space-y-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-4">
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

              {/* ボーナス獲得アクション群 */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleClaimBonus('daily')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
                  title="1日1回ログインボーナスを受け取ります"
                >
                  <span className="text-sm">🎁</span>
                  <span>デイリーボーナス (+100pt)</span>
                </button>

                {(user.coins ?? 1000) < 100 && (
                  <button
                    type="button"
                    onClick={() => handleClaimBonus('rescue')}
                    className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs shadow transition flex items-center gap-1.5 cursor-pointer animate-bounce"
                    title="所持コインが100枚未満のときの救済措置"
                  >
                    <span className="text-sm">💸</span>
                    <span>破産救済保険 (+300pt)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={logout}
                  className="text-xs text-stone-700 hover:text-stone-950 font-black px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white border border-amber-400 shadow-2xs transition"
                >
                  ログアウト
                </button>
              </div>
            </div>

            {/* 🎒 所持特権チケット（インベントリ） ＆ 発動宣言ボタン */}
            <div className="pt-3 border-t border-amber-500/20">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-950 mb-2">
                <span>🎒 あなたの所持特権チケット:</span>
                <span className="text-[11px] font-normal text-stone-600">({inventory.length}枚保有中)</span>
              </div>
              {inventory.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {inventory.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-white border border-amber-400 text-stone-900 text-xs font-bold flex flex-col justify-between gap-2 shadow-sm"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{item.icon}</span>
                        <span className="truncate">{item.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAnnounceTicket(item)}
                        className="w-full py-1.5 px-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-[11px] transition shadow flex items-center justify-center gap-1 cursor-pointer"
                        title="次回のカスタム試合でこの特権を発動することをDiscordに宣言します"
                      >
                        <span>📣</span>
                        <span>Discordで発動宣言する</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500 italic">
                  現在保有している特権チケットはありません。「🛒 KTMショップ」からお好みの特権を交換できます！
                </p>
              )}
            </div>
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
                  ログインすると、毎日のボーナス受取やワンタップ勝敗ベット、特権アイテム発動が楽しめます！
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
                {/* 📊 リアルタイム投票比率バー */}
                <div className="p-4 rounded-2xl bg-stone-900 text-white space-y-2 border border-stone-800 shadow-md">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-indigo-400 flex items-center gap-1">
                      <span>🟦 BLUE:</span>
                      <span className="font-mono">{betStats.blueRatio}%</span>
                      <span className="text-[10px] text-stone-400 font-normal">({betStats.blueAmount.toLocaleString()}pt / {betStats.blueCount}人)</span>
                    </span>
                    <span className="text-amber-400 font-mono text-[11px]">
                      総プール: {betStats.totalAmount.toLocaleString()}pt
                    </span>
                    <span className="text-rose-400 flex items-center gap-1">
                      <span className="text-[10px] text-stone-400 font-normal">({betStats.redAmount.toLocaleString()}pt / {betStats.redCount}人)</span>
                      <span className="font-mono">{betStats.redRatio}%</span>
                      <span>:RED 🟥</span>
                    </span>
                  </div>
                  {/* プログレスバー */}
                  <div className="w-full h-3 bg-stone-800 rounded-full overflow-hidden flex border border-stone-700">
                    <div
                      style={{ width: `${betStats.blueRatio}%` }}
                      className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-500"
                    ></div>
                    <div
                      style={{ width: `${betStats.redRatio}%` }}
                      className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-500"
                    ></div>
                  </div>
                </div>

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
                  isParticipant ? (
                    <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-br from-indigo-950/90 via-slate-900 to-indigo-950 text-white border-2 border-indigo-500/30 shadow-xl space-y-4 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto text-2xl">
                        ⚔️
                      </div>
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-black border border-indigo-500/30">
                          🛡️ 出場選手（プレイヤー）として参加中
                        </div>
                        <h4 className="text-base font-black text-white pt-2">
                          あなたは現在このカスタム対戦の選手です
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
                          試合の公平性・八百長防止のため、<strong className="text-indigo-300">出場選手本人は勝敗予想ベットを行うことができません。</strong><br />
                          勝敗予想は観戦者・コミュニティメンバー限定の機能となります。
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-left text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">🏆</span>
                          <div>
                            <div className="font-black text-white">選手勝利ボーナス</div>
                            <div className="text-[10px] text-slate-400">試合に勝利すると自動でポイントが付与されます</div>
                          </div>
                        </div>
                        <span className="font-mono font-black text-amber-400 text-sm bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-xl">
                          +250 pt
                        </span>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handlePlaceBet} className="space-y-5">
                      {activeMatch.status === 'IN_PROGRESS' || activeMatch.isLocked ? (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🔒</span>
                            <div>
                              <div className="font-extrabold text-xs">勝敗予想は締め切られました（試合進行中）</div>
                              <div className="text-[11px] text-stone-600">試合終了後のコイン精算をお待ちください！</div>
                            </div>
                          </div>
                          <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">LOCK</span>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-black text-stone-700 mb-2">
                              👉 どちらのチームが勝つか選んでください:
                            </label>
                            <div className="grid grid-cols-2 gap-2 md:gap-4">
                              <button
                                type="button"
                                onClick={() => setBetTeam('BLUE')}
                                className={`p-3 md:p-5 rounded-2xl md:rounded-3xl border-2 md:border-3 font-black text-xs md:text-sm transition-all flex flex-col items-center gap-1.5 md:gap-2 cursor-pointer ${
                                  betTeam === 'BLUE'
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md scale-102'
                                    : 'border-stone-200 hover:border-indigo-200 text-stone-600'
                                }`}
                              >
                                <span className="text-xl md:text-2xl">🟦</span>
                                <span className="truncate max-w-full">BLUE TEAM</span>
                                <span className="text-[10px] md:text-xs px-2 md:px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono font-black">
                                  x{calculatedOdds.blue}倍
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setBetTeam('RED')}
                                className={`p-3 md:p-5 rounded-2xl md:rounded-3xl border-2 md:border-3 font-black text-xs md:text-sm transition-all flex flex-col items-center gap-1.5 md:gap-2 cursor-pointer ${
                                  betTeam === 'RED'
                                    ? 'border-rose-600 bg-rose-50 text-rose-700 shadow-md scale-102'
                                    : 'border-stone-200 hover:border-rose-200 text-stone-600'
                                }`}
                              >
                                <span className="text-xl md:text-2xl">🟥</span>
                                <span className="truncate max-w-full">RED TEAM</span>
                                <span className="text-[10px] md:text-xs px-2 md:px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono font-black">
                                  x{calculatedOdds.red}倍
                                </span>
                              </button>
                            </div>
                          </div>

                          {/* 賭け金 & もらえるコイン直感シミュレーター */}
                          <div className="p-4 md:p-5 rounded-2xl md:rounded-3xl bg-amber-50/60 border border-amber-200/80 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <label className="block text-xs font-black text-stone-800">
                                🪙 賭けるコイン数
                              </label>
                              <div className="text-right">
                                <span className="text-[10px] md:text-[11px] text-stone-500 font-bold">勝った場合: </span>
                                <strong className="text-xs md:text-sm font-black text-amber-600 font-mono">
                                  🎯 +{Math.round(betAmount * (betTeam === 'BLUE' ? calculatedOdds.blue : calculatedOdds.red))} コイン
                                </strong>
                              </div>
                            </div>

                            <div className="grid grid-cols-5 gap-1.5">
                              {[50, 100, 300, 500, 1000].map((amt) => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setBetAmount(amt)}
                                  className={`py-2 md:py-2.5 rounded-xl text-[11px] md:text-xs font-black border transition-all cursor-pointer ${
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
                        </>
                      )}
                    </form>
                  )
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
                    バランサーでチーム分けが確定されると、ここに自動で5v5対戦カードが出現し、勝敗予想の受付が開始されます🔥
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/balancer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-stone-900 hover:bg-amber-600 text-white font-black text-xs transition-all shadow-md hover:shadow-lg cursor-pointer transform active:scale-95"
                  >
                    <Swords size={16} />
                    バランサーでチーム分けを行う
                    <ArrowRight size={14} />
                  </Link>

                  <button
                    type="button"
                    onClick={handleCreateMockMatch}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs transition-all shadow-md hover:shadow-lg cursor-pointer transform active:scale-95"
                  >
                    <Dices size={16} />
                    🎮 模擬カスタム対戦を生成して今すぐベットを試す
                  </button>
                </div>
              </div>
            )}

            {/* 勝敗予想の下に常時表示される長者番付 */}
            <div className="pt-6 border-t border-stone-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Trophy size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-stone-900">KTM 長者番付 TOP 10</h3>
                    <p className="text-[11px] text-stone-500">現在のコイン富豪ランキング</p>
                  </div>
                </div>
                <span className="text-[10px] text-amber-700 bg-amber-100/70 font-bold px-2 py-0.5 rounded-full">
                  リアルタイム
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ranking.map((p, idx) => (
                  <div
                    key={`bet-rank-${p.name}`}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      idx === 0
                        ? 'bg-amber-50/80 border-amber-300 font-bold shadow-xs'
                        : idx === 1
                        ? 'bg-stone-50 border-stone-300 font-bold'
                        : idx === 2
                        ? 'bg-amber-900/5 border-amber-700/20 font-bold'
                        : 'bg-white border-black/5 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 text-center text-xs font-black font-mono">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                      </span>
                      <div>
                        <div className="text-xs font-black text-stone-900 flex items-center gap-1">
                          {p.name}
                          <span className="text-[8px] px-1 py-0.2 rounded bg-black/5 text-stone-500 font-mono">
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

        {/* 🪙 コインの貯め方ガイド（5大ルート一覧） */}
        <div className="bg-stone-900 text-stone-100 rounded-3xl p-6 md:p-8 border border-white/10 shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xl font-bold">
              🪙
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-white">コインを自動で貯める 5つの方法</h3>
              <p className="text-xs text-stone-400">試合に出る人も、観戦する人も全員がコインを獲得できます！</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400">① 初回ログイン</span>
                <span className="text-xs font-mono font-black text-emerald-400">+1,000 pt</span>
              </div>
              <p className="text-[11px] text-stone-300 leading-relaxed">
                Discordで初めてログインすると、全員に初期所持金として自動付与！
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400">② 試合に参加</span>
                <span className="text-xs font-mono font-black text-emerald-400">+100 pt</span>
              </div>
              <p className="text-[11px] text-stone-300 leading-relaxed">
                カスタム試合に参加するだけで、勝敗に関係なく全員に参加賞を付与！
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400">③ 試合に勝利</span>
                <span className="text-xs font-mono font-black text-emerald-400">+150 pt (計250)</span>
              </div>
              <p className="text-[11px] text-stone-300 leading-relaxed">
                試合に勝利したチームのメンバー全員に勝利ボーナスを追加付与！
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400">④ 募集を主催</span>
                <span className="text-xs font-mono font-black text-emerald-400">+200 pt</span>
              </div>
              <p className="text-[11px] text-stone-300 leading-relaxed">
                Discordで `/recruit` を打って募集を立てた主催者に感謝ボーナス！
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5 sm:col-span-2 lg:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400">⑤ 勝敗予想が的中</span>
                <span className="text-xs font-mono font-black text-amber-300">賭け金 × 2倍 配当</span>
              </div>
              <p className="text-[11px] text-stone-300 leading-relaxed">
                カスタムの勝利チームを予想して的中すると、賭けたコインがザクザク倍増して戻ってきます！
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
