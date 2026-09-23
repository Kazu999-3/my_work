"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from '../../components/Toaster';
import { Coins, Trophy, Flame, Swords, CheckCircle2, TrendingUp, Sparkles, Shield, ArrowRight, ShoppingBag, Heart, Gift, Target, Dices, Ticket, LogIn, LogOut, UserCheck, Send, MessageSquare, Timer, Clock, AlertTriangle, Info } from 'lucide-react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { supabase } from '../../lib/supabaseClient';
import { calculateBetOdds } from '../../lib/betOdds';
import OmikujiModal, { OmikujiData } from './components/OmikujiModal';
import KtmSlotGame from './components/KtmSlotGame';
import PoroCrashGame from './components/PoroCrashGame';
import KtmBaccaratGame from './components/KtmBaccaratGame';

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
    badge: '1等キャリーオーバー制',
    desc: '【毎週日曜22:00抽選】🥇1等: ジャックポット総取り(8%抽選・キャリーオーバー制) / 🥈2等: 1,000コイン確約当選 / 🥉3等: 参加賞(1口30コイン還元)！'
  }
];

export default function CasinoPage() {
  const { user, loginWithDiscord, logout, refreshUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<'bet' | 'slot' | 'crash' | 'baccarat' | 'shop'>('bet');
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
  const [lastRescueMonth, setLastRescueMonth] = useState<string | null>(null);

  // 🎰 おみくじモーダル用ステート
  const [isOmikujiOpen, setIsOmikujiOpen] = useState<boolean>(false);
  const [omikujiData, setOmikujiData] = useState<OmikujiData | null>(null);

  // 🔥 予想的中連勝ストリーク
  const [userStreak, setUserStreak] = useState<number>(0);
  const [userMaxStreak, setUserMaxStreak] = useState<number>(0);
  
  // 🪙 チップ送金モーダル用ステート
  const [isTipModalOpen, setIsTipModalOpen] = useState<boolean>(false);
  const [tipToPlayer, setTipToPlayer] = useState<string>('');
  const [tipAmount, setTipAmount] = useState<number>(100);
  const [tipMessage, setTipMessage] = useState<string>('');
  const [isTipSubmitting, setIsTipSubmitting] = useState<boolean>(false);
  const [allPlayersList, setAllPlayersList] = useState<Array<{ name: string; rank: string }>>([]);
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

  // ⏱️ 勝敗予想締め切りカウントダウン（試合確定から15分 = 900秒）
  const BET_DEADLINE_MINUTES = 15;
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!activeMatch?.createdAt) {
      setTimeLeftSeconds(null);
      return;
    }

    const calculateRemaining = () => {
      const matchCreatedAtMs = new Date(activeMatch.createdAt).getTime();
      const deadlineMs = matchCreatedAtMs + BET_DEADLINE_MINUTES * 60 * 1000;
      const remainingMs = deadlineMs - Date.now();
      return Math.max(0, Math.floor(remainingMs / 1000));
    };

    setTimeLeftSeconds(calculateRemaining());

    const timer = setInterval(() => {
      const remaining = calculateRemaining();
      setTimeLeftSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeMatch?.createdAt]);

  const formatTimeLeft = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isBetLocked = useMemo(() => {
    if (!activeMatch) return true;
    if (activeMatch.isLocked || activeMatch.status === 'IN_PROGRESS') return true;
    if (timeLeftSeconds !== null && timeLeftSeconds <= 0) return true;
    return false;
  }, [activeMatch, timeLeftSeconds]);

  useEffect(() => {
    fetchBetData();
    fetchActiveMatch();
    fetchPlayersList();
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

  const fetchPlayersList = async () => {
    try {
      const res = await fetch('/api/players/list');
      if (res.ok) {
        const data = await res.json();
        const players = (data.players || []).map((p: any) => ({
          name: p.name,
          rank: p.highest_rank || p.rank || 'GOLD'
        }));
        setAllPlayersList(players);
      }
    } catch (e) {
      console.error('Failed to fetch players list:', e);
    }
  };

  const handleSendTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('チップを贈るにはDiscordログインが必要です。');
      return;
    }
    if (!tipToPlayer.trim()) {
      toast.error('チップを贈る相手を選択または入力してください。');
      return;
    }
    if (tipAmount <= 0) {
      toast.error('1コイン以上のチップを指定してください。');
      return;
    }

    try {
      setIsTipSubmitting(true);
      const res = await fetch('/api/bet/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromDiscordId: user.discordId,
          fromName: activePlayerName || user.username,
          toName: tipToPlayer.trim(),
          amount: tipAmount,
          message: tipMessage.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        triggerCelebration();
        // data.message はチップに添えたメッセージ本文（デフォルト「ナイスプレイ！」）であり
        // 送金結果ではないため、送金完了を示す文言として組み立てて表示する。
        toast.success(`✅ ${data.to} さんに ${data.amount}コイン を送りました！`);
        setIsTipModalOpen(false);
        setTipMessage('');
        fetchBetData();
        refreshUser();
      } else {
        toast.error(data.error || 'チップの送信に失敗しました。');
      }
    } catch (e: any) {
      toast.error('エラーが発生しました: ' + e.message);
    } finally {
      setIsTipSubmitting(false);
    }
  };

  // リアルタイム動的オッズ（パリミュチュエル方式：投票比率に反比例）
  // ⚠️ ここでの算出はあくまで「表示用の見積もり」。実際に適用されるオッズは
  // サーバーが POST /api/bet の中で再計算した値（レスポンスの data.odds）である。
  const calculatedOdds = useMemo(
    () => calculateBetOdds(betStats?.blueAmount ?? 0, betStats?.redAmount ?? 0),
    [betStats]
  );

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
        if (data.lastRescueMonth) setLastRescueMonth(data.lastRescueMonth);
        if (data.userStreak !== undefined) setUserStreak(Number(data.userStreak) || 0);
        if (data.userMaxStreak !== undefined) setUserMaxStreak(Number(data.userMaxStreak) || 0);
      }
    } catch (e) {
      console.error('Failed to fetch bet data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimBonus = async (type: 'daily' | 'rescue') => {
    if (!user) {
      toast.error('ボーナスを受け取るにはDiscordでログインしてください。');
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
        if (type === 'daily' && data.omikuji) {
          setOmikujiData(data.omikuji);
          setIsOmikujiOpen(true);
        } else {
          triggerCelebration();
          toast.success(data.message);
        }
        fetchBetData();
        refreshUser();
      } else {
        toast.error(data.error || '受取に失敗しました。');
      }
    } catch (e: any) {
      toast.error('エラー: ' + e.message);
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
        toast.success(data.message);
        fetchInventory();
      } else {
        toast.error(data.error || '発動宣言に失敗しました。');
      }
    } catch (e: any) {
      toast.error('エラー: ' + e.message);
    }
  };

  const handlePlaceBet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlayerName.trim() && !user?.discordId) {
      toast.error('Discordでログインするか、お名前を選択してください。');
      return;
    }
    if (isBetLocked) {
      toast.error('勝敗予想の受付はすでに締め切られています。試合終了をお待ちください。');
      return;
    }
    if (betAmount <= 0) {
      toast.error('1コイン以上の賭け金を指定してください。');
      return;
    }

    try {
      setIsSubmitting(true);
      setBetMessage(null);
      // オッズはサーバー側で再計算される。ここでは送らない（改ざん防止）。
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: user?.discordId,
          playerName: activePlayerName.trim() || user?.username,
          team: betTeam,
          amount: betAmount,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        triggerCelebration();
        setBetMessage(`🎉 【ベット完了】 ${data.playerName} さんが ${data.team} に ${data.amount}コイン 賭けました！ (確定オッズ: x${data.odds}倍 / 残高: ${data.remainingCoins}コイン)`);
        fetchBetData();
        refreshUser();
      } else {
        toast.error(data.error || 'ベットに失敗しました。');
      }
    } catch (e: any) {
      toast.error('エラーが発生しました: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBuyItem = async (itemId: string, itemName: string, price: number, quantity: number = 1) => {
    if (!user) {
      if (confirm('アイテムを購入するにはDiscordアカウントでログインが必要です。ログイン画面へ移動しますか？')) {
        loginWithDiscord('/casino');
      }
      return;
    }
    const totalPrice = price * quantity;
    const confirmMsg = quantity > 1
      ? `「${itemName}」を ${quantity}口（合計: ${totalPrice.toLocaleString()}コイン）でまとめ買いしますか？`
      : `「${itemName}」を ${price}コイン で購入しますか？`;

    if (!confirm(confirmMsg)) {
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
          quantity,
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
        toast.error(data.error || '購入に失敗しました。');
      }
    } catch (e: any) {
      toast.error('エラー: ' + e.message);
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
        toast.success('🎮 模擬カスタム対戦を生成しました！勝敗予想の受付を開始します🔥');
      } else {
        toast.error('模擬対戦の生成に失敗しました。');
      }
    } catch (e: any) {
      toast.error('エラー: ' + e.message);
    }
  };

  return (
    <div className="min-h-screen pb-16 bg-[#eae4d4] text-[#201c2b]">
      {/* ヒーローセクション */}
      <div className="bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 text-stone-900 py-10 px-6 relative overflow-hidden border-b border-amber-500/30">
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-900 text-xs font-black tracking-wider border border-amber-500/30">
            <Sparkles size={14} className="text-amber-600" />
            KTM Sovereign Casino & Shop
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-stone-900 flex items-center justify-center gap-3">
            <Coins className="text-amber-600" size={32} />
            勝敗予想 ＆ KTMショップ ＆ 長者番付
          </h1>
          <p className="text-stone-700 text-xs md:text-sm max-w-xl mx-auto font-medium">
            勝敗予想でコインを増やし、特権チケットやバラエティ権と交換しよう🔥
          </p>

          <Link
            href="/casino/rules"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/70 hover:bg-white border border-stone-300 text-stone-700 hover:text-stone-900 text-xs font-black transition-colors"
          >
            <Info size={13} />
            ルール ＆ 確率一覧を見る
          </Link>

          {/* ジャックポット金庫バナー */}
          <div className="mt-4 inline-flex flex-col items-center justify-center gap-1.5 px-4 md:px-6 py-2.5 rounded-2xl bg-amber-100/90 border-2 border-amber-400/60 text-amber-950 text-xs font-black text-center max-w-full shadow-sm">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-base animate-bounce">💎</span>
              <span>サーバー共有ジャックポット金庫:</span>
              <span className="text-amber-700 font-mono text-base font-black">
                {(betStats.jackpot?.amount ?? 12800).toLocaleString()} コイン
              </span>
              <span className="text-[10px] text-amber-800 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                🔥 ペンタキルで総取り！
              </span>
            </div>
            {betStats.jackpot?.lastWinner && (
              <div className="text-[10px] text-stone-600 font-medium">
                👑 直近の総取り当選者: <strong className="text-amber-700">{betStats.jackpot.lastWinner}</strong> さん（+{betStats.jackpot.lastPayout.toLocaleString()}🪙）
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] w-full mx-auto px-4 md:px-8 py-8 space-y-6">

        {/* 4大カジノ機能タブナビゲーション */}
        <div className="flex items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-stone-200/80 text-stone-700 max-w-xl mx-auto shadow-sm border border-stone-300 overflow-x-auto scrollbar-none">
          {[
            { id: 'bet', label: '🎯 勝敗予想' },
            { id: 'slot', label: '🎰 KTMスロット' },
            { id: 'crash', label: '🚀 ポロ・クラッシュ' },
            { id: 'baccarat', label: '🃏 バカラ' },
            { id: 'shop', label: '🛒 ショップ' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center ${
                activeTab === tab.id
                  ? 'bg-white text-stone-900 shadow-sm scale-102 border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
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
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-stone-950 font-black text-xs shadow transition flex items-center gap-1.5 cursor-pointer transform active:scale-95"
                  title="1日1回おみくじを引いてボーナスを獲得します（最大+300pt）"
                >
                  <span className="text-sm">🎰</span>
                  <span>デイリーおみくじ (最大+300pt)</span>
                </button>

                {(user.coins ?? 1000) < 100 && (
                  (() => {
                    const currentMonthStr = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit' }).format(new Date()).replace(/\//g, '-');
                    const isRescueClaimedThisMonth = lastRescueMonth === currentMonthStr;
                    return isRescueClaimedThisMonth ? (
                      <div className="px-3 py-1.5 rounded-xl bg-stone-200 text-stone-500 font-bold text-xs flex items-center gap-1.5 cursor-not-allowed" title="破産救済保険は月1回までです（今月分は受取済み）">
                        <span className="text-sm">🔒</span>
                        <span>破産救済 (今月受取済)</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleClaimBonus('rescue')}
                        className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs shadow transition flex items-center gap-1.5 cursor-pointer animate-bounce"
                        title="所持コインが100枚未満のときの救済措置（※月1回限定）"
                      >
                        <span className="text-sm">💸</span>
                        <span>破産救済保険 (+300pt / 月1回)</span>
                      </button>
                    );
                  })()
                )}

                <button
                  type="button"
                  onClick={() => {
                    setTipToPlayer('');
                    setIsTipModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
                  title="フレンドや活躍したプレイヤーにコインをチップとして贈ります"
                >
                  <Gift size={14} />
                  <span>チップを贈る</span>
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="text-xs text-stone-700 hover:text-stone-950 font-black px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white border border-amber-400 shadow-2xs transition"
                >
                  ログアウト
                </button>
              </div>
            </div>

            {/* 🔥 勝敗予想 連勝ストリークバナー */}
            <div className="pt-3 border-t border-amber-500/20 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-black ${
                  userStreak >= 5
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white animate-pulse shadow-md'
                    : userStreak >= 3
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40'
                      : userStreak >= 1
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                        : 'bg-stone-200/60 dark:bg-[#1e1f22] text-stone-500 dark:text-stone-400'
                }`}>
                  <Flame size={14} className={userStreak > 0 ? 'text-amber-400 animate-bounce' : ''} />
                  <span>{userStreak > 0 ? `🔥 予想 ${userStreak} 連勝中！` : '連勝ストリーク: 0戦'}</span>
                </div>

                {userStreak > 0 && (
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    次回的中: <strong>{userStreak >= 4 ? '+20%' : userStreak >= 2 ? '+10%' : '+5%'}</strong> 配当ボーナス！
                  </span>
                )}
              </div>

              <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                <span>👑 自己ベスト:</span>
                <strong className="text-amber-600 dark:text-amber-400">{userMaxStreak}連勝</strong>
                <span className="text-[10px] text-stone-400 dark:text-stone-500 font-normal">（2連勝:+5% / 3連勝:+10% / 5連勝:+20%）</span>
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
                      {item.id === 'lottery_ticket' ? (
                        <div className="w-full py-1.5 px-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 font-bold text-[11px] flex items-center justify-center gap-1">
                          <span>⏳</span>
                          <span>日曜22:00 自動抽選エントリー中</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAnnounceTicket(item)}
                          className="w-full py-1.5 px-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-[11px] transition shadow flex items-center justify-center gap-1 cursor-pointer"
                          title="次回のカスタム試合でこの特権を発動することをDiscordに宣言します"
                        >
                          <span>📣</span>
                          <span>Discordで発動宣言する</span>
                        </button>
                      )}
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
                <div className="p-4 rounded-2xl bg-white/95 text-stone-900 space-y-2 border border-stone-200 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-indigo-600 flex items-center gap-1">
                      <span>🟦 BLUE:</span>
                      <span className="font-mono">{betStats.blueRatio}%</span>
                      <span className="text-[10px] text-stone-500 font-normal">({betStats.blueAmount.toLocaleString()}pt / {betStats.blueCount}人)</span>
                    </span>
                    <span className="text-amber-700 font-mono text-[11px] font-black">
                      総プール: {betStats.totalAmount.toLocaleString()}pt
                    </span>
                    <span className="text-rose-600 flex items-center gap-1">
                      <span className="text-[10px] text-stone-500 font-normal">({betStats.redAmount.toLocaleString()}pt / {betStats.redCount}人)</span>
                      <span className="font-mono">{betStats.redRatio}%</span>
                      <span>:RED 🟥</span>
                    </span>
                  </div>
                  {/* プログレスバー */}
                  <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden flex border border-stone-300">
                    <div
                      style={{ width: `${betStats.blueRatio}%` }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-500"
                    ></div>
                    <div
                      style={{ width: `${betStats.redRatio}%` }}
                      className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-500"
                    ></div>
                  </div>
                </div>

                {/* ⏱️ 受付カウントダウン・ステータスバナー */}
                <div className={`p-4 rounded-3xl border-2 flex flex-wrap items-center justify-between gap-3 shadow-xs transition-all ${
                  isBetLocked
                    ? 'bg-stone-100 border-stone-300 text-stone-700'
                    : (timeLeftSeconds !== null && timeLeftSeconds <= 180)
                    ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                    : 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-300 text-emerald-950 shadow-[0_0_15px_rgba(16,185,129,0.12)]'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-xs ${
                      isBetLocked
                        ? 'bg-stone-200 text-stone-600'
                        : (timeLeftSeconds !== null && timeLeftSeconds <= 180)
                        ? 'bg-rose-500 text-white animate-bounce'
                        : 'bg-emerald-500 text-white'
                    }`}>
                      {isBetLocked ? '🔒' : (timeLeftSeconds !== null && timeLeftSeconds <= 180) ? '🔥' : '⏳'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-black tracking-wider uppercase px-2 py-0.5 rounded-lg ${
                          isBetLocked
                            ? 'bg-stone-300 text-stone-800'
                            : (timeLeftSeconds !== null && timeLeftSeconds <= 180)
                            ? 'bg-rose-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}>
                          {isBetLocked ? '締切済み' : (timeLeftSeconds !== null && timeLeftSeconds <= 180) ? '締切直前' : '予想受付中'}
                        </span>
                        <span className="text-xs sm:text-sm font-black text-stone-900">
                          {isBetLocked
                            ? '勝敗予想の受付は締め切られました（試合進行中）'
                            : (timeLeftSeconds !== null && timeLeftSeconds <= 180)
                            ? '🔥 まもなく投票締め切り！投票を急いでください！'
                            : 'LIVE MATCH 投票受付中'}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500 font-medium mt-0.5">
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
                        ? 'bg-rose-100 border-rose-300 text-rose-800 animate-pulse'
                        : 'bg-white border-emerald-200 text-emerald-900'
                    }`}>
                      <Clock size={16} className={timeLeftSeconds <= 180 ? 'text-rose-600' : 'text-emerald-600'} />
                      <span className="text-xs font-black text-stone-600">締切目安:</span>
                      <span className={`font-mono text-base sm:text-lg font-black tracking-wider ${
                        timeLeftSeconds <= 180 ? 'text-rose-600' : 'text-stone-900'
                      }`}>
                        {formatTimeLeft(timeLeftSeconds)}
                      </span>
                    </div>
                  )}
                </div>

                {/* 対戦カード表示 */}
                <div className="p-5 rounded-3xl bg-white/95 text-stone-900 space-y-4 border border-stone-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          isBetLocked ? 'bg-stone-400' : (timeLeftSeconds !== null && timeLeftSeconds <= 180) ? 'bg-rose-400' : 'bg-emerald-400'
                        }`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                          isBetLocked ? 'bg-stone-500' : (timeLeftSeconds !== null && timeLeftSeconds <= 180) ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}></span>
                      </span>
                      <span className={`text-xs font-black tracking-wider ${
                        isBetLocked ? 'text-stone-500' : (timeLeftSeconds !== null && timeLeftSeconds <= 180) ? 'text-rose-600' : 'text-emerald-700'
                      }`}>
                        {isBetLocked ? 'LOCK 試合進行中' : 'LIVE MATCH 受付中'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-amber-700 font-mono">
                      勝率予想: 🟦 {activeMatch.blueWinRate ? `${Math.round(activeMatch.blueWinRate * 100)}%` : '50%'} vs 🟥 {activeMatch.blueWinRate ? `${Math.round((1 - activeMatch.blueWinRate) * 100)}%` : '50%'}
                    </div>
                  </div>

                  {/* 5v5 対戦メンバー */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {/* BLUE TEAM */}
                    <div className="p-3.5 rounded-2xl bg-indigo-50/80 border-2 border-indigo-200 space-y-2">
                      <div className="flex items-center justify-between border-b border-indigo-200 pb-1.5">
                        <span className="text-xs font-black text-indigo-700">🟦 BLUE TEAM</span>
                        <span className="text-[10px] font-mono text-indigo-600 font-bold">MMR: {activeMatch.teamBlue ? Math.round(activeMatch.teamBlue.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / activeMatch.teamBlue.length) : '-'}</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {(activeMatch.teamBlue || []).map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-stone-800 truncate">{p.assignedRole || p.role || `P${i+1}`}: {p.name}</span>
                            <span className="text-[9px] text-stone-500 font-mono shrink-0">{p.rank || p.highestRank || ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* RED TEAM */}
                    <div className="p-3.5 rounded-2xl bg-rose-50/80 border-2 border-rose-200 space-y-2">
                      <div className="flex items-center justify-between border-b border-rose-200 pb-1.5">
                        <span className="text-xs font-black text-rose-700">🟥 RED TEAM</span>
                        <span className="text-[10px] font-mono text-rose-600 font-bold">MMR: {activeMatch.teamRed ? Math.round(activeMatch.teamRed.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / activeMatch.teamRed.length) : '-'}</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {(activeMatch.teamRed || []).map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-stone-800 truncate">{p.assignedRole || p.role || `P${i+1}`}: {p.name}</span>
                            <span className="text-[9px] text-stone-500 font-mono shrink-0">{p.rank || p.highestRank || ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ベットフォーム */}
                {user ? (
                  isParticipant ? (
                    <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-indigo-50 text-stone-900 border-2 border-indigo-200 shadow-md space-y-4 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center mx-auto text-2xl">
                        ⚔️
                      </div>
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-black border border-indigo-200">
                          🛡️ 出場選手（プレイヤー）として参加中
                        </div>
                        <h4 className="text-base font-black text-stone-900 pt-2">
                          あなたは現在このカスタム対戦の選手です
                        </h4>
                        <p className="text-xs text-stone-600 leading-relaxed max-w-md mx-auto">
                          試合の公平性・八百長防止のため、<strong className="text-indigo-700">出場選手本人は勝敗予想ベットを行うことができません。</strong><br />
                          勝敗予想は観戦者・コミュニティメンバー限定の機能となります。
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-white border border-stone-200 flex items-center justify-between text-left text-xs shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">🏆</span>
                          <div>
                            <div className="font-black text-stone-900">選手勝利ボーナス</div>
                            <div className="text-[10px] text-stone-500">試合に勝利すると自動でポイントが付与されます</div>
                          </div>
                        </div>
                        <span className="font-mono font-black text-amber-700 text-sm bg-amber-100 border border-amber-300 px-3 py-1 rounded-xl">
                          +250 pt
                        </span>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handlePlaceBet} className="space-y-5">
                      {isBetLocked ? (
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

                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
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
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-xs font-black text-amber-600 font-mono">
                          🪙 {(p.coins ?? 1000).toLocaleString()}
                        </span>
                      </div>
                      {user && p.name !== activePlayerName && (
                        <button
                          type="button"
                          onClick={() => {
                            setTipToPlayer(p.name);
                            setIsTipModalOpen(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-black transition flex items-center gap-1 cursor-pointer"
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
        )}

        {/* タブ2: 🎰 KTMスロット */}
        {activeTab === 'slot' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <KtmSlotGame
              userCoins={user?.coins ?? 1000}
              onBalanceChange={(newBalance) => {
                fetchBetData();
                refreshUser();
              }}
            />
          </div>
        )}

        {/* タブ3: 🚀 ポロ・クラッシュ */}
        {activeTab === 'crash' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <PoroCrashGame
              userCoins={user?.coins ?? 1000}
              onBalanceChange={(newBalance) => {
                fetchBetData();
                refreshUser();
              }}
            />
          </div>
        )}

        {/* タブ4: 🃏 バカラ */}
        {activeTab === 'baccarat' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-5 md:p-7 border border-black/10 shadow-sm">
              <KtmBaccaratGame
                userDiscordId={user?.discordId}
                userDisplayName={user?.displayName || user?.username}
                userCoins={user?.coins ?? 1000}
                onBalanceChange={(newBalance) => {
                  fetchBetData();
                  refreshUser();
                }}
              />
            </div>
          </div>
        )}

        {/* タブ5: 🛒 KTMショップ */}
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

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-stone-200">
                    <span className="text-sm font-black text-amber-600 font-mono">
                      🪙 {item.price.toLocaleString()} {item.id === 'lottery_ticket' ? '/ 1口' : ''}
                    </span>
                    {item.id === 'lottery_ticket' ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleBuyItem(item.id, item.name, item.price, 1)}
                          className="px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-amber-600 text-white text-[11px] font-black transition-colors cursor-pointer shadow-xs"
                          title="1口購入"
                        >
                          1口
                        </button>
                        <button
                          onClick={() => handleBuyItem(item.id, item.name, item.price, 5)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 text-[11px] font-black transition-colors cursor-pointer shadow-xs"
                          title="5口まとめ買い (500コイン)"
                        >
                          5口
                        </button>
                        <button
                          onClick={() => handleBuyItem(item.id, item.name, item.price, 10)}
                          className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[11px] font-black transition-colors cursor-pointer shadow-xs"
                          title="10口まとめ買い (1,000コイン)"
                        >
                          10口
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleBuyItem(item.id, item.name, item.price, 1)}
                        className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-amber-600 text-white text-xs font-black transition-colors cursor-pointer shadow-sm"
                      >
                        交換する
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🪙 コインの貯め方ガイド（5大ルート一覧） */}
        <div className="bg-white/95 text-stone-800 rounded-3xl p-6 md:p-8 border border-stone-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center text-xl font-bold">
              🪙
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-stone-900">コインを自動で貯める 5つの方法</h3>
              <p className="text-xs text-stone-500">試合に出る人も、観戦する人も全員がコインを獲得できます！</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-700">① 初回ログイン</span>
                <span className="text-xs font-mono font-black text-emerald-600">+1,000 pt</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Discordで初めてログインすると、全員に初期所持金として自動付与！
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-700">② 試合に参加</span>
                <span className="text-xs font-mono font-black text-emerald-600">+100 pt</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                カスタム試合に参加するだけで、勝敗に関係なく全員に参加賞を付与！
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-700">③ 試合に勝利</span>
                <span className="text-xs font-mono font-black text-emerald-600">+150 pt (計250)</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                試合に勝利したチームのメンバー全員に勝利ボーナスを追加付与！
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-700">④ 募集を主催</span>
                <span className="text-xs font-mono font-black text-emerald-600">+200 pt</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Discordで `/recruit` を打って募集を立てた主催者に感謝ボーナス！
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5 sm:col-span-2 lg:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-700">⑤ 勝敗予想が的中</span>
                <span className="text-xs font-mono font-black text-amber-600">賭け金 × 2倍 配当</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                カスタムの勝利チームを予想して的中すると、賭けたコインがザクザク倍増して戻ってきます！
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* 🪙 チップ送金モーダル */}
      {isTipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-stone-200 space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center font-bold">
                  <Gift size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">コインをチップとして贈る</h3>
                  <p className="text-[11px] text-stone-500">ナイスプレイや日頃の感謝を込めてコインをプレゼント！</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTipModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center text-sm font-black transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendTip} className="space-y-4">
              {/* 相手選択 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-stone-700">
                  🎁 送信先プレイヤー
                </label>
                <div className="flex gap-2">
                  <select
                    value={tipToPlayer}
                    onChange={(e) => setTipToPlayer(e.target.value)}
                    className="flex-1 bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 focus:outline-none focus:border-purple-500"
                  >
                    <option value="">-- プレイヤー一覧から選択 --</option>
                    {allPlayersList
                      .filter((p) => p.name !== activePlayerName)
                      .map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} ({p.rank})
                        </option>
                      ))}
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="または直接名前を入力..."
                  value={tipToPlayer}
                  onChange={(e) => setTipToPlayer(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* 金額選択 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-stone-700">
                    🪙 チップ金額 (コイン)
                  </label>
                  <span className="text-[10px] text-stone-500 font-bold">
                    所持: {(user?.coins ?? 1000).toLocaleString()}pt
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[50, 100, 300, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTipAmount(amt)}
                      className={`py-1.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                        tipAmount === amt
                          ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                          : 'bg-stone-50 hover:bg-purple-50 text-stone-700 border-stone-200'
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
                  value={tipAmount}
                  onChange={(e) => setTipAmount(Number(e.target.value))}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm font-black text-stone-900 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              {/* メッセージ */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-stone-700 flex items-center gap-1">
                  <MessageSquare size={13} />
                  <span>応援メッセージ（任意 / Discordに公開通知）</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="ナイスキャリーでした！ / いつもカスタムありがとう！"
                  value={tipMessage}
                  onChange={(e) => setTipMessage(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsTipModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-black text-xs transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isTipSubmitting || !tipToPlayer.trim() || tipAmount <= 0}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send size={14} />
                  <span>{isTipSubmitting ? '送信中...' : `🪙 ${tipAmount}コインを贈る`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🎰 デイリーおみくじ演出モーダル */}
      <OmikujiModal
        isOpen={isOmikujiOpen}
        onClose={() => setIsOmikujiOpen(false)}
        omikujiData={omikujiData}
        onClaimFinished={() => {
          fetchBetData();
          refreshUser();
        }}
      />
    </div>
  );
}
