"use client";

import React, { useState, useMemo } from 'react';
import { toast } from '../../components/Toaster';
import confetti from 'canvas-confetti';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { calculateBetOdds } from '../../lib/betOdds';
import OmikujiModal, { OmikujiData } from './components/OmikujiModal';
import KtmSlotGame from './components/KtmSlotGame';
import KtmBaccaratGame from './components/KtmBaccaratGame';
import KtmMinesGame from './components/KtmMinesGame';
import { useCasinoData } from './_casino/useCasinoData';
import type { CasinoTab } from './_casino/types';
import CasinoHero from './_casino/CasinoHero';
import CasinoTabNav from './_casino/CasinoTabNav';
import UserStatusPanel from './_casino/UserStatusPanel';
import BetTab from './_casino/BetTab';
import ShopTab from './_casino/ShopTab';
import CoinGuide from './_casino/CoinGuide';
import TipModal from './_casino/TipModal';

// カジノ（勝敗予想・ゲーム・ショップ・長者番付）。データ取得は _casino/useCasinoData、表示は _casino/ の部品が持ち、
// ここはフォームの状態と操作（チップ・ボーナス受取・発動宣言・ベット・購入）だけを担う。
// 2026-10-07: 1,635行から分割（表示・動作は分割前と同じ）。ボタンの無かった模擬対戦の生成処理を削除、
// ジャックポットの仮の初期値（12,800）を削除。
export default function CasinoPage() {
  const { user, loginWithDiscord, logout, refreshUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<CasinoTab>('bet');
  const {
    ranking, activeMatch, loading, inventory, lastRescueMonth, userStreak, userMaxStreak, allPlayersList, betStats,
    timeLeftSeconds, isBetLocked, fetchBetData, fetchInventory,
  } = useCasinoData(user);

  const [betTeam, setBetTeam] = useState<'BLUE' | 'RED'>('BLUE');
  const [betAmount, setBetAmount] = useState<number>(100);
  const [betMessage, setBetMessage] = useState<string | null>(null);
  const [shopMessage, setShopMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 🎰 おみくじモーダル用ステート
  const [isOmikujiOpen, setIsOmikujiOpen] = useState<boolean>(false);
  const [omikujiData, setOmikujiData] = useState<OmikujiData | null>(null);

  // 🪙 チップ送金モーダル用ステート
  const [isTipModalOpen, setIsTipModalOpen] = useState<boolean>(false);
  const [tipToPlayer, setTipToPlayer] = useState<string>('');
  const [tipAmount, setTipAmount] = useState<number>(100);
  const [tipMessage, setTipMessage] = useState<string>('');
  const [isTipSubmitting, setIsTipSubmitting] = useState<boolean>(false);

  // 実効プレイヤー名（ログインユーザー優先）
  const activePlayerName = user?.displayName || '';

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

  return (
    <div className="min-h-screen pb-16 bg-[#eae4d4] dark:bg-[#1e1f22] text-[#201c2b] dark:text-[#f2f3f5]">
      <CasinoHero betStats={betStats} />

      <div className="max-w-[1200px] w-full mx-auto px-4 md:px-8 py-8 space-y-6">
        <CasinoTabNav activeTab={activeTab} setActiveTab={setActiveTab} />

        <UserStatusPanel
          user={user} lastRescueMonth={lastRescueMonth} userStreak={userStreak} userMaxStreak={userMaxStreak} inventory={inventory}
          handleClaimBonus={handleClaimBonus} setTipToPlayer={setTipToPlayer} setIsTipModalOpen={setIsTipModalOpen} logout={logout}
          handleAnnounceTicket={handleAnnounceTicket} loginWithDiscord={loginWithDiscord}
        />

        {activeTab === 'bet' && (
          <BetTab
            user={user} betStats={betStats} setTipToPlayer={setTipToPlayer} setIsTipModalOpen={setIsTipModalOpen} loginWithDiscord={loginWithDiscord}
            activeMatch={activeMatch} betTeam={betTeam} setBetTeam={setBetTeam} betAmount={betAmount} setBetAmount={setBetAmount}
            betMessage={betMessage} isSubmitting={isSubmitting} timeLeftSeconds={timeLeftSeconds} isBetLocked={isBetLocked}
            calculatedOdds={calculatedOdds} isParticipant={isParticipant} handlePlaceBet={handlePlaceBet} ranking={ranking}
            activePlayerName={activePlayerName}
          />
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


        {/* タブ3: 🌿 ブッシュ・スカウト */}
        {activeTab === 'mines' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <KtmMinesGame
              userCoins={user?.coins ?? 1000}
              onBalanceChange={() => {
                fetchBetData();
                refreshUser();
              }}
            />
          </div>
        )}

        {/* タブ4: 🃏 バカラ */}
        {activeTab === 'baccarat' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-surface rounded-3xl p-5 md:p-7 border border-black/10 shadow-sm">
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

        {activeTab === 'shop' && <ShopTab shopMessage={shopMessage} handleBuyItem={handleBuyItem} />}

        <CoinGuide />
      </div>

      {isTipModalOpen && (
        <TipModal
          user={user} setTipToPlayer={setTipToPlayer} setIsTipModalOpen={setIsTipModalOpen} activePlayerName={activePlayerName}
          tipToPlayer={tipToPlayer} tipAmount={tipAmount} setTipAmount={setTipAmount} tipMessage={tipMessage} setTipMessage={setTipMessage}
          isTipSubmitting={isTipSubmitting} allPlayersList={allPlayersList} handleSendTip={handleSendTip}
        />
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
