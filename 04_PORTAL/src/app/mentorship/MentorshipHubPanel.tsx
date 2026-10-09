'use client';

import React, { useState, useEffect } from 'react';
import { MentorshipProfile } from '../api/mentorship/profiles/route';
import { MentorshipCard } from './MentorshipCard';
import { MentorshipProfileModal } from './MentorshipProfileModal';
import { MentorshipRequestModal } from './MentorshipRequestModal';
import { MentorshipKickoffModal } from './MentorshipKickoffModal';
import { MentorshipGuidelinesModal } from './MentorshipGuidelinesModal';
import { MentorshipReviewModal } from './MentorshipReviewModal';
import { SecretMatchmakerModal, formatOfferDate } from './SecretMatchmakerModal';
import { MentorshipReviewSummary } from '../api/mentorship/reviews/route';
import { toast } from '../../components/Toaster';
import { HeartHandshake, Sparkles, Plus, Search, Shield, Award, Users, Swords, BookOpen, MessageSquare, Rocket, Leaf, Star, ExternalLink, RefreshCw } from 'lucide-react';


const LANE_FILTERS = [
  { id: 'ALL', label: '🌐 全て' },
  { id: 'TOP', label: '🛡️ TOP' },
  { id: 'JUNGLE', label: '🌲 JG' },
  { id: 'MID', label: '⚡ MID' },
  { id: 'BOT', label: '🏹 BOT' },
  { id: 'SUPPORT', label: '💖 SUP' },
];

export default function MentorshipHubPanel() {
  const [activeTab, setActiveTab] = useState<'PUPIL' | 'MENTOR' | 'MATCHES'>('PUPIL');
  const [laneFilter, setLaneFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<MentorshipProfile[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [pendingReceived, setPendingReceived] = useState<any[]>([]);
  const [pendingSent, setPendingSent] = useState<any[]>([]);
  const [reviewSummaries, setReviewSummaries] = useState<Record<string, MentorshipReviewSummary>>({});
  const [myDiscordId, setMyDiscordId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // プロフィール編集・作成モーダル管理
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<MentorshipProfile | null>(null);

  // 申請送信モーダル管理
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [targetRequestProfile, setTargetRequestProfile] = useState<MentorshipProfile | null>(null);

  // 🚀 キックオフガイドモーダル管理
  const [isKickoffModalOpen, setIsKickoffModalOpen] = useState(false);
  const [selectedKickoffMatch, setSelectedKickoffMatch] = useState<any | null>(null);

  // 📜 師弟心得モーダル管理
  const [isGuidelinesModalOpen, setIsGuidelinesModalOpen] = useState(false);

  // ⭐ 匿名レビューモーダル管理
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedReviewMatch, setSelectedReviewMatch] = useState<any | null>(null);

  // 🤖 シークレットお見合い便モーダル管理
  const [isSecretMatchmakerOpen, setIsSecretMatchmakerOpen] = useState(false);
  const [myProposals, setMyProposals] = useState<any[]>([]);
  const [isRespondingProposal, setIsRespondingProposal] = useState(false);

  // 💬 Discord同期ステート
  const [isSyncingDiscord, setIsSyncingDiscord] = useState(false);

  // 🤝 承諾処理中ステート（二重クリック・多重送信完全防止）
  const [acceptingMatchId, setAcceptingMatchId] = useState<string | null>(null);
  // 🎓 フォーラム専用スレッド作成中ステート
  const [creatingThreadMatchId, setCreatingThreadMatchId] = useState<string | null>(null);
  // 👑 先輩資格ステート（常連・経験者判定）
  const [canBeMentor, setCanBeMentor] = useState(true);
  const [userTier, setUserTier] = useState<any>(null);

  // お見合い回答処理（承諾 / 個別見送り / 全て見送り）
  const handleRespondProposal = async (decision: 'ACCEPT' | 'DECLINE' | 'DECLINE_ALL', targetMatchId?: string) => {
    if (decision === 'DECLINE') {
      if (!confirm('このお見合いを見送りますか？\n※見送っても相手には一切通知されません。')) return;
    } else if (decision === 'DECLINE_ALL') {
      if (!confirm('今回届いたお見合い便をすべて見送りますか？\n※見送っても相手には一切通知されません。')) return;
    }

    const matchIdToUse = targetMatchId || (myProposals.length === 1 ? myProposals[0].matchId : undefined);
    if (decision !== 'DECLINE_ALL' && !matchIdToUse) return;

    setIsRespondingProposal(true);
    try {
      const res = await fetch('/api/mentorship/matchmaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESPOND_OFFER',
          matchId: matchIdToUse,
          decision,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (decision === 'DECLINE' || decision === 'DECLINE_ALL') {
          toast.success('見送りを記録しました（相手には通知されません）');
        } else if (data.isBothAccepted) {
          toast.success('🎉 お見合い成立！双方が話してみたいを選びました！');
          if (data.threadUrl) window.open(data.threadUrl, '_blank');
        } else {
          toast.success('👍 「話してみたい」を記録しました！先輩へリクエストを届けました');
        }
        setMyProposals([]);
        fetchMatches();
        fetchMyProposal();
      } else {
        toast.error(data.error || '処理に失敗しました');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    } finally {
      setIsRespondingProposal(false);
    }
  };

  // 専用Discordスレッドの作成
  const handleCreateThread = async (matchId: string) => {
    setCreatingThreadMatchId(matchId);
    try {
      const res = await fetch('/api/mentorship/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_THREAD',
          matchId,
        }),
      });
      const data = await res.json();
      if (data.ok && data.threadUrl) {
        toast.success('🎓 専用指導チャット（フォーラムスレッド）を作成しました！');
        window.open(data.threadUrl, '_blank');
        fetchMatches();
      } else {
        toast.error(data.error || 'スレッド作成に失敗しました');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    } finally {
      setCreatingThreadMatchId(null);
    }
  };

  // Discord募集板の即時同期
  const handleSyncDiscord = async () => {
    setIsSyncingDiscord(true);
    try {
      const res = await fetch('/api/mentorship/sync-discord', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        toast.success('💬 Discordの師弟募集板を最新状態に同期しました！');
      } else {
        toast.error(data.error || 'Discord同期に失敗しました');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    } finally {
      setIsSyncingDiscord(false);
    }
  };


  // プロフィール一覧の取得
  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/mentorship/profiles?status=ALL');
      const data = await res.json();
      if (data.ok) {
        setProfiles(data.profiles || []);
        setMyDiscordId(data.myDiscordId || null);
        if (data.isAdmin !== undefined) {
          setIsAdmin(Boolean(data.isAdmin));
        }
        if (data.canBeMentor !== undefined) {
          setCanBeMentor(Boolean(data.canBeMentor));
        }
        if (data.userTier !== undefined) {
          setUserTier(data.userTier);
        }
      }
    } catch (err) {
      console.error('Failed to fetch mentorship profiles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // マッチ一覧 & 申請一覧の取得
  const fetchMatches = async () => {
    try {
      const res = await fetch('/api/mentorship/matches');
      const data = await res.json();
      if (data.ok) {
        setMatches(data.matches || []);
        setPendingReceived(data.pendingReceived || []);
        setPendingSent(data.pendingSent || []);
        if (data.isAdmin !== undefined) {
          setIsAdmin(Boolean(data.isAdmin));
        }
      }
    } catch (err) {
      console.error('Failed to fetch matches:', err);
    }
  };

  // 匿名レビュー集計の取得
  const fetchReviewSummaries = async () => {
    try {
      const res = await fetch('/api/mentorship/reviews');
      const data = await res.json();
      if (data.ok) {
        setReviewSummaries(data.summaries || {});
      }
    } catch (err) {
      console.error('Failed to fetch review summaries:', err);
    }
  };

  // 自分宛てのお見合いオファー取得
  const fetchMyProposal = async () => {
    try {
      const res = await fetch('/api/mentorship/matchmaker');
      const data = await res.json();
      if (data.ok) {
        if (Array.isArray(data.myProposals) && data.myProposals.length > 0) {
          setMyProposals(data.myProposals);
        } else if (data.myProposal) {
          setMyProposals([data.myProposal]);
        } else {
          setMyProposals([]);
        }
      }
    } catch (err) {
      // ログイン前等の場合はスキップ
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchMatches();
    fetchReviewSummaries();
    fetchMyProposal();
  }, []);

  // 🛠️ 管理者専用: 任意の師弟マッチ・申請を強制削除
  const handleAdminDeleteMatch = async (matchId: string) => {
    if (!confirm('【管理者操作】この師弟マッチ（または申請）をデータベースから完全に削除しますか？\n進行中の場合は両者のカードがOPENに戻ります。')) {
      return;
    }
    try {
      const res = await fetch(`/api/mentorship/matches?id=${matchId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('🛠️ 【管理者権限】マッチ/申請を強制削除しました');
        fetchProfiles();
        fetchMatches();
      } else {
        toast.error(data.error || '削除に失敗しました');
      }
    } catch (err) {
      toast.error('エラーが発生しました');
    }
  };

  // プロフィールの保存
  const handleSaveProfile = async (profileData: Partial<MentorshipProfile>) => {
    try {
      const res = await fetch('/api/mentorship/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.isFirstTimeBonus) {
          // 紙吹雪＆初回ボーナス祝勝トースト
          try {
            const confetti = (await import('canvas-confetti')).default;
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
            });
          } catch (_) {}
          toast.success(`🎉 初回作成ボーナス +${data.bonusCoins || 500}コインを獲得しました！カードを公開しました。`);
        } else {
          toast.success('🪪 自己紹介カードを公開・更新しました！');
        }
        fetchProfiles();
      } else {
        toast.error(data.error || '保存に失敗しました');
      }
    } catch (err) {
      toast.error('エラーが発生しました');
    }
  };

  // プロフィールの削除
  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('この自己紹介カードを削除しますか？')) return;
    try {
      const res = await fetch(`/api/mentorship/profiles?id=${profileId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('カードを削除しました');
        fetchProfiles();
      } else {
        toast.error(data.error || '削除に失敗しました');
      }
    } catch (err) {
      toast.error('エラーが発生しました');
    }
  };

  // 申請モーダルを開く または 弟子カードの場合は師匠引き受け
  const handleOffer = async (targetProfile: MentorshipProfile) => {
    // 弟子カードに対して「師匠を引き受ける」を押した場合
    if (targetProfile.role_type === 'PUPIL') {
      if (
        !confirm(
          `🎉 ${targetProfile.player_name} さんの指導を引き受けますか？\n（あなたの師匠登録が自動完了し、師弟ペアが即時成立します！+300🪙）`
        )
      ) {
        return;
      }

      // ⚠️ 2026-09-29 追加: 引き受け時のひとことを送れるようにした。
      // **サーバー側(CLAIM_MENTOR)は元から `message` を受け取る実装だったのに、
      // 画面からは一度も渡していなかった**ため、マッチのメッセージが全員
      // 「指導を引き受けました！よろしくお願いします！」の決め打ちになっていた。
      // さらに師匠プロフィールが自動作成される場合の bio も決め打ちで、
      // **立候補した師匠全員が同じ自己紹介文**になり、弟子側は「どんな人が
      // 引き受けてくれたのか」が全く分からない状態だった（師弟マッチングの要が機能していない）。
      // 弟子からの申請(APPLY)は最初からメッセージを書けたので、非対称でもあった。
      // 空欄でもこれまで通り成立する（必須にはしない）。
      const claimMessage = prompt(
        `${targetProfile.player_name} さんへのひとこと（任意）\n` +
          `指導方針や得意分野を書くと、相手が安心できます。\n` +
          `例: 「JGのルート設計を中心に見ます。週末の夜なら通話できます」`,
        ''
      );
      // prompt のキャンセル(null)は「引き受け自体をやめる」と解釈する
      if (claimMessage === null) return;

      try {
        const res = await fetch('/api/mentorship/matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'CLAIM_MENTOR',
            targetProfileId: targetProfile.id,
            message: claimMessage.trim(),
          }),
        });
        const data = await res.json();
        if (data.ok) {
          toast.success(data.message || '🎉 師弟ペアが成立しました！');
          if (data.threadUrl) {
            window.open(data.threadUrl, '_blank');
          }
          fetchMatches();
          fetchProfiles();
        } else {
          toast.error(data.error || '師匠引き受けに失敗しました');
        }
      } catch (err) {
        toast.error('通信エラーが発生しました');
      }
      return;
    }

    setTargetRequestProfile(targetProfile);
    setIsRequestModalOpen(true);
  };

  // 申請を送信
  const handleSendRequest = async (
    targetProfileId: string,
    message: string,
    durationKey: string = '14_DAYS',
    autoRenew: boolean = true,
    // ⚠️ 2026-09-30 追加: サーバーは commStyle を受け取りDBにも保存していたが、
    // UIから送っていなかったため全員 'VC_ACTIVE'(通話歓迎)で固定されていた。
    commStyle: string = 'VC_ACTIVE'
  ) => {
    try {
      const res = await fetch('/api/mentorship/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPLY',
          targetProfileId,
          message,
          durationKey,
          autoRenew,
          commStyle,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || '申請を送信しました！');
        fetchMatches();
      } else {
        toast.error(data.error || '申請の送信に失敗しました');
      }
    } catch (err) {
      toast.error('エラーが発生しました');
    }
  };

  // 届いた申請を承諾
  const handleAcceptRequest = async (matchId: string) => {
    if (acceptingMatchId) return; // 二重クリック・連打完全防止
    setAcceptingMatchId(matchId);
    try {
      const res = await fetch('/api/mentorship/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ACCEPT',
          matchId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        // 紙吹雪エフェクト
        try {
          const confetti = (await import('canvas-confetti')).default;
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.5 },
          });
        } catch (_) {}

        toast.success(`🎉 師弟ペアが成立しました！(+300コイン獲得)`);
        await fetchProfiles();
        await fetchMatches();

        // 成立したマッチを取得してキックオフガイドを自動表示
        const currentMatch = matches.find((m) => m.id === matchId);
        if (currentMatch) {
          setSelectedKickoffMatch(currentMatch);
          setIsKickoffModalOpen(true);
        }
      } else {
        toast.error(data.error || '承諾に失敗しました');
      }
    } catch (err) {
      toast.error('エラーが発生しました');
    } finally {
      setAcceptingMatchId(null);
    }
  };

  // 届いた申請を辞退
  const handleRejectRequest = async (matchId: string) => {
    if (!confirm('この申請を見送りますか？')) return;
    try {
      const res = await fetch('/api/mentorship/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT',
          matchId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('申請を見送りました');
        fetchMatches();
      } else {
        toast.error(data.error || '処理に失敗しました');
      }
    } catch (err) {
      toast.error('エラーが発生しました');
    }
  };

  // ⚡ 期間をそのまま実行（期間延長）
  const handleExtendMatch = async (matchId: string, days: number = 14) => {
    try {
      const res = await fetch('/api/mentorship/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'EXTEND',
          matchId,
          extendDays: days,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || `師弟期間を ${days} 日間延長しました！`);
        fetchMatches();
      } else {
        toast.error(data.error || '期間延長に失敗しました');
      }
    } catch (err) {
      toast.error('エラーが発生しました');
    }
  };

  // 🎓 目標達成・卒業完了手続き
  const handleCompleteMatch = async (matchId: string) => {
    if (!confirm('この師弟ペアの活動を目標達成として卒業完了にしますか？\n両者に卒業ボーナス（+200コイン）が付与され、新たな募集が可能になります。')) {
      return;
    }
    try {
      const res = await fetch('/api/mentorship/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COMPLETE',
          matchId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        try {
          const confetti = (await import('canvas-confetti')).default;
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.5 },
          });
        } catch (_) {}

        toast.success(data.message || '🎓 相談完了しました！(+200コイン獲得)');
        fetchProfiles();
        fetchMatches();
      } else {
        toast.error(data.error || '卒業手続きに失敗しました');
      }
    } catch (err) {
      toast.error('エラーが発生しました');
    }
  };

  // 🍃 円満解散（活動終了・リセット）
  const handleCancelMatch = async (matchId: string) => {
    const reasonPrompt = prompt(
      '円満解散（活動終了）を行いますか？\nお互いのカードが再公開され、ペナルティなく新しい相手を探せます。\n\n理由を選択/入力してください:',
      '🗓️ スケジュール・活動時間の都合'
    );
    if (!reasonPrompt) return;

    try {
      const res = await fetch('/api/mentorship/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CANCEL',
          matchId,
          reason: reasonPrompt,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || '🍃 相談ペアを円満解散しました。');
        fetchProfiles();
        fetchMatches();
      } else {
        toast.error(data.error || '解散処理に失敗しました');
      }
    } catch (err) {
      toast.error('エラーが発生しました');
    }
  };

  // 💬 Discord 連絡案内トースト
  const handleContactDiscord = (partnerName: string) => {
    navigator.clipboard.writeText(`@${partnerName}`).catch(() => {});
    toast.success(`💬 「@${partnerName}」をコピーしました！Discordでメンションして挨拶しましょう。`);
  };


  // 自分の弟子カード & 師匠カードの個別取得（1ユーザーが両方持てる）
  const myPupilProfile = profiles.find((p) => p.discord_id === myDiscordId && p.role_type === 'PUPIL');
  const myMentorProfile = profiles.find((p) => p.discord_id === myDiscordId && p.role_type === 'MENTOR');
  const currentTabMyProfile = activeTab === 'PUPIL' ? myPupilProfile : activeTab === 'MENTOR' ? myMentorProfile : (myPupilProfile || myMentorProfile);

  // ランクの強さ序列定義
  const RANK_ORDER: Record<string, number> = {
    IRON: 1,
    BRONZE: 2,
    SILVER: 3,
    GOLD: 4,
    PLATINUM: 5,
    EMERALD: 6,
    DIAMOND: 7,
    MASTER: 8,
    GRANDMASTER: 9,
    CHALLENGER: 10,
    UNRANKED: 2,
  };

  // 🎯 AI相性スコアの厳格算出ロジック（ベース0点・適正条件が揃わないと高スコアにならない超厳格査定）
  const calculateMatchScore = (target: MentorshipProfile): { score: number; reason: string } => {
    const baseMyProfile = target.role_type === 'MENTOR' ? myPupilProfile : myMentorProfile;
    if (!baseMyProfile || target.discord_id === baseMyProfile.discord_id) {
      return { score: 0, reason: '' };
    }

    // 役割が同じ同士（弟子×弟子、師匠×師匠）はマッチ不可
    if (baseMyProfile.role_type === target.role_type) {
      return { score: 0, reason: '' };
    }

    let score = 0; // 厳格化: 0点スタート
    const reasons: string[] = [];

    const mentorProf = target.role_type === 'MENTOR' ? target : baseMyProfile;
    const pupilProf = target.role_type === 'PUPIL' ? target : baseMyProfile;

    // 1. ランク適性・実力差の厳格判定（配点: 最大35点 / 逆転時は -40点）
    const mentorRankKey = (mentorProf.current_rank || 'UNRANKED').toUpperCase().split(' ')[0];
    const pupilRankKey = (pupilProf.current_rank || 'UNRANKED').toUpperCase().split(' ')[0];
    const mentorTier = RANK_ORDER[mentorRankKey] || 3;
    const pupilTier = RANK_ORDER[pupilRankKey] || 3;

    if (mentorTier > pupilTier) {
      const tierDiff = mentorTier - pupilTier;
      if (tierDiff >= 1 && tierDiff <= 3) {
        // 最も成長効果が高い適正ランク差（1〜3ティア上）
        score += 35;
        reasons.push('最適な実力差（1〜3ティア上）');
      } else if (tierDiff >= 4) {
        // 実力差が開きすぎている場合
        score += 15;
        reasons.push('ハイレベル師匠');
      }
    } else if (mentorTier === pupilTier) {
      score += 5; // 同格（切磋琢磨）
    } else {
      // 弟子の方が師匠より高ランクの場合は大幅減点
      score -= 40;
    }

    // 師匠側の歓迎帯域の照合（配点: 最大10点）
    const welcomeText = mentorProf.target_rank || '';
    if (
      (welcomeText.includes('シルバー') && pupilTier <= 3) ||
      (welcomeText.includes('ゴールド') && pupilTier <= 4) ||
      (welcomeText.includes('プラチナ') && pupilTier <= 5) ||
      (welcomeText.includes('エメラルド') && pupilTier <= 6)
    ) {
      score += 10;
      reasons.push('募集対象ランク帯合致');
    } else if (welcomeText.includes('全ランク') || welcomeText.includes('初心者歓迎')) {
      score += 5;
    }

    // 2. レーン適合度（配点: 最大35点 / 完全不一致は -10点）
    const sharedLanes = (baseMyProfile.lanes || []).filter((l: string) => (target.lanes || []).includes(l));
    if (sharedLanes.length > 0) {
      score += 35;
      reasons.push(`同レーン（${sharedLanes.join('/')}）専攻`);
    } else {
      // BOT x SUP や MID x JG などのシナジー
      const isDuoSynergy =
        (baseMyProfile.lanes?.includes('BOT') && target.lanes?.includes('SUPPORT')) ||
        (baseMyProfile.lanes?.includes('SUPPORT') && target.lanes?.includes('BOT')) ||
        (baseMyProfile.lanes?.includes('MID') && target.lanes?.includes('JUNGLE')) ||
        (baseMyProfile.lanes?.includes('JUNGLE') && target.lanes?.includes('MID'));
      if (isDuoSynergy) {
        score += 15;
        reasons.push('連携レーンシナジー');
      } else {
        // レーンに全く関係性がない場合は減点
        score -= 10;
      }
    }

    // 3. 得意・練習中チャンピオンの合致（配点: 最大25点）
    const sharedChamps = (baseMyProfile.champions || []).filter((c: string) => (target.champions || []).includes(c));
    if (sharedChamps.length >= 2) {
      score += 25;
      reasons.push(`得意チャンプ複数合致(${sharedChamps.slice(0, 2).join(', ')})`);
    } else if (sharedChamps.length === 1) {
      score += 15;
      reasons.push(`「${sharedChamps[0]}」指導可能`);
    }

    // 4. 指導・学習スタイルのタグ共通性（配点: 最大12点）
    const sharedTags = (baseMyProfile.tags || []).filter((t: string) => (target.tags || []).includes(t));
    if (sharedTags.length > 0) {
      score += Math.min(sharedTags.length * 4, 12);
      if (reasons.length < 2) reasons.push(sharedTags[0]);
    }

    // 5. 活動時間帯の親和性（配点: 最大10点）
    if (baseMyProfile.active_hours && target.active_hours) {
      const myHours = baseMyProfile.active_hours.toLowerCase();
      const targetHours = target.active_hours.toLowerCase();
      const timeMatch =
        (myHours.includes('平日') && targetHours.includes('平日')) ||
        (myHours.includes('休日') && targetHours.includes('休日')) ||
        (myHours.includes('夜') && targetHours.includes('夜')) ||
        (myHours.includes('昼') && targetHours.includes('昼'));
      if (timeMatch) {
        score += 10;
        if (reasons.length < 3) reasons.push('活動時間帯一致');
      }
    }

    // 厳格なスコア範囲補正（最小5%〜最大99%）
    const finalScore = Math.min(Math.max(score, 5), 99);
    const reasonText = reasons.length > 0 ? reasons.slice(0, 2).join(' ＆ ') : '条件が一部のみ合致';
    return { score: finalScore, reason: reasonText };
  };

  // フィルタリング処理
  const filteredProfiles = profiles.filter((p) => {
    if (activeTab !== 'MATCHES' && p.role_type !== activeTab) return false;
    if (laneFilter !== 'ALL' && !(p.lanes || []).includes(laneFilter)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.player_name || '').toLowerCase().includes(q);
      const matchBio = (p.bio || '').toLowerCase().includes(q);
      const matchChampions = p.champions && p.champions.some((c) => c.toLowerCase().includes(q));
      const matchTags = p.tags && p.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchName && !matchBio && !matchChampions && !matchTags) return false;
    }
    return true;
  });

  // おすすめピックアップ（厳格化: 80点以上の真の相性抜群のみ抽出）
  const baseProfileForRecommendation = activeTab === 'PUPIL' ? myPupilProfile : activeTab === 'MENTOR' ? myMentorProfile : null;
  const recommendedProfiles = baseProfileForRecommendation
    ? profiles
        .filter((p) => p.discord_id !== myDiscordId && p.role_type !== baseProfileForRecommendation.role_type)
        .map((p) => ({ profile: p, ...calculateMatchScore(p) }))
        .filter((item) => item.score >= 80)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
    : [];

  return (
    <div className="space-y-6">
      {/* ヒーローバナー */}
      <div className="bg-gradient-to-r from-success-500/15 via-secondary-500/10 to-success-500/15 border border-success-edge-strong/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-success-500/20 text-success-800 text-xs font-black border border-success-edge-strong/30">
              <HeartHandshake size={14} className="text-success-600" />
              🎒 気軽に質問・相談できるコミュニティ企画
            </div>
            <h2 className="text-xl md:text-2xl font-black text-foreground">
              🎒 教えて先輩！ 掲示板
            </h2>
            <p className="text-foreground-subtle text-xs md:text-sm max-w-2xl font-medium leading-relaxed">
              「ちょっと誰かにコツを聞いてみたい」後輩と、「得意なチャンプやレーンのコツをシェアしたい」先輩をつなぐ掲示板です。自己紹介カードを登録して、気軽に先輩・後輩と相談を始めましょう！
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="https://discord.com/channels/1485636149379858567/1550159520687325205"
              target="_blank"
              rel="noopener noreferrer"
              title="Discordの相談募集チャンネルを新しいタブで開きます"
              className="px-3 py-2.5 rounded-xl bg-[#5865F2]/10 hover:bg-[#5865F2]/20 text-[#5865F2] font-bold text-xs transition border border-[#5865F2]/30 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <ExternalLink size={13} />
              <span>💬 Discord募集板</span>
            </a>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setIsSecretMatchmakerOpen(true)}
                  className="px-3 py-2.5 rounded-xl bg-secondary-500/15 hover:bg-secondary-500/25 text-secondary-700 font-bold text-xs transition border border-secondary-500/30 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="未登録メンバーを含むお見合い候補を自動算出し、双方向案内をテスト送信します"
                >
                  <Sparkles size={13} className="text-secondary-600" />
                  <span>🤖 お見合い便 (MVP)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncDiscord}
                  disabled={isSyncingDiscord}
                  className="px-2.5 py-2.5 rounded-xl bg-surface-subtle hover:bg-surface-hover text-foreground-subtle font-bold text-xs transition border border-border flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="Discordの常駐ダッシュボードを即座に再同期します"
                >
                  <RefreshCw size={13} className={isSyncingDiscord ? 'animate-spin text-primary-600' : ''} />
                  <span className="hidden sm:inline">Discord同期</span>
                </button>
              </>
            )}

            <button
              type="button"
              title="相談のガイドライン（褒めて伸ばす / 1試合1課題 など）を表示します"
              onClick={() => setIsGuidelinesModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-surface border border-border hover:bg-surface-subtle text-foreground-subtle font-bold text-xs transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen size={14} className="text-primary-600" />
              <span>📜 相談の心得</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingProfile(currentTabMyProfile || null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-success-600 hover:bg-success-500 text-white font-black text-xs transition shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus size={15} />
              <span>
                {activeTab === 'PUPIL'
                  ? myPupilProfile
                    ? '🙋‍♂️ 自分のカードを編集'
                    : '🙋‍♂️ 後輩としてカードを作成'
                  : activeTab === 'MENTOR'
                  ? myMentorProfile
                    ? '🧑‍🏫 自分のカードを編集'
                    : '🧑‍🏫 先輩としてカードを作成'
                  : (myPupilProfile || myMentorProfile)
                  ? '自分のカードを編集'
                  : 'カードを投稿'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 🎒 届いたお見合い便バナー（ダブルオプトイン・まとめ便対応） */}
      {myProposals.length > 0 && (
        <div className="bg-gradient-to-r from-secondary-500/15 via-success-500/10 to-secondary-500/15 border-2 border-secondary-500/30 rounded-3xl p-5 md:p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-secondary-500/20 text-secondary-800 text-xs font-black">
                  <Sparkles size={13} className="text-secondary-600" />
                  {myProposals.length > 1
                    ? `あなたへのお見合い便が届いています！（${myProposals.length}名の先輩をご紹介）`
                    : 'あなたへのお見合い便が届いています！'}
                </div>
                {myProposals[0]?.proposedAt && (() => {
                  const dateInfo = formatOfferDate(myProposals[0].proposedAt);
                  if (!dateInfo) return null;
                  return (
                    <span className="text-[11px] font-bold text-foreground-subtle px-2 py-0.5 rounded-md bg-surface border border-border/60">
                      📨 {dateInfo.text} 受信 ({dateInfo.relative})
                    </span>
                  );
                })()}
              </div>
              <h3 className="text-base md:text-lg font-black text-foreground">
                {myProposals.length > 1
                  ? '相性の良い先輩がピックアップされました！気になる先輩を選んでみてください✨'
                  : `${myProposals[0].isMentor ? '後輩候補' : 'おすすめの先輩'}：${myProposals[0].partnerName} さん`}
              </h3>
            </div>

            {myProposals.length > 1 && (
              <button
                type="button"
                onClick={() => handleRespondProposal('DECLINE_ALL')}
                disabled={isRespondingProposal}
                className="px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-subtle text-foreground-subtle font-bold text-xs transition border border-border cursor-pointer self-start sm:self-auto disabled:opacity-50"
              >
                🍃 今回はすべて見送る
              </button>
            )}
          </div>

          {/* 先輩候補カードリスト */}
          {myProposals.length === 1 ? (
            /* 単一ペア表示 */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface/80 p-4 rounded-2xl border border-border/60">
              <div className="space-y-1.5">
                <div className="text-sm font-black text-foreground">
                  🛡️ 担当: <span className="text-secondary-600 font-bold">{myProposals[0].lane}</span>
                  <span className="text-xs text-foreground-subtle ml-2">
                    相性スコア: <span className="text-secondary-600 font-black">{myProposals[0].matchScore}%</span>
                  </span>
                </div>
                {myProposals[0].reasons && myProposals[0].reasons.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-foreground-subtle">
                    {myProposals[0].reasons.map((r: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-surface-subtle text-foreground-subtle border border-border/60">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleRespondProposal('ACCEPT', myProposals[0].matchId)}
                  disabled={isRespondingProposal}
                  className="px-4 py-2.5 rounded-xl bg-success-600 hover:bg-success-500 text-white font-black text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <HeartHandshake size={14} />
                  <span>🤝 ちょっと話してみたい</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRespondProposal('DECLINE', myProposals[0].matchId)}
                  disabled={isRespondingProposal}
                  className="px-3 py-2.5 rounded-xl bg-surface hover:bg-surface-subtle text-foreground-subtle font-bold text-xs transition border border-border cursor-pointer disabled:opacity-50"
                >
                  <span>🍃 今回は見送る</span>
                </button>
              </div>
            </div>
          ) : (
            /* まとめ便（複数候補カードグリッド） */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {myProposals.map((p: any) => (
                <div
                  key={p.matchId}
                  className="bg-surface/90 border border-border/80 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-2xs hover:border-secondary-500/50 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-sm text-foreground">
                        {p.partnerName} 先輩
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-secondary-500/15 text-secondary-800 text-[11px] font-black">
                        ★ {p.matchScore}%
                      </span>
                    </div>
                    <div className="text-xs text-foreground-subtle">
                      🛡️ レーン: <strong className="text-foreground">{p.lane}</strong>
                    </div>
                    {p.reasons && p.reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 text-[11px] text-foreground-subtle pt-1">
                        {p.reasons.map((r: string, i: number) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border/50">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/50 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRespondProposal('ACCEPT', p.matchId)}
                      disabled={isRespondingProposal}
                      className="flex-1 py-2 rounded-xl bg-success-600 hover:bg-success-500 text-white font-black text-xs transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <HeartHandshake size={13} />
                      <span>🤝 話してみたい</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespondProposal('DECLINE', p.matchId)}
                      disabled={isRespondingProposal}
                      className="px-2.5 py-2 rounded-xl bg-surface-subtle hover:bg-surface-hover text-foreground-subtle font-bold text-xs transition border border-border/60 cursor-pointer disabled:opacity-50"
                      title="この先輩を見送る"
                    >
                      <span>🍃</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-border/50 flex items-center gap-2 text-xs text-emerald-800 font-medium">
            <Shield size={14} className="text-emerald-600 shrink-0" />
            <span>
              <strong>🔒 安心ルール:</strong> 「今回は見送る」を選んでも、相手には一切通知されません。双方が「話してみたい」を選んだ時だけ専用チャットが開きます。
            </span>
          </div>
        </div>
      )}

      {/* タブ切り替えバー */}
      <div className="space-y-3 bg-surface/90 p-4 rounded-2xl border border-border/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              title="教えてほしい人のカード一覧に切り替えます"
              onClick={() => setActiveTab('PUPIL')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'PUPIL'
                  ? 'bg-success-600 text-white shadow-xs'
                  : 'bg-surface-subtle hover:bg-surface-hover text-foreground-subtle'
              }`}
            >
              <span>🙋‍♂️ 教えて！ (後輩)</span>
              <span className="text-[10px] bg-surface/20 px-1.5 py-0.2 rounded-full">
                {profiles.filter((p) => p.role_type === 'PUPIL').length}
              </span>
            </button>

            <button
              type="button"
              title="教えるよ！という先輩のカード一覧に切り替えます"
              onClick={() => setActiveTab('MENTOR')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'MENTOR'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface-subtle hover:bg-surface-hover text-foreground-subtle'
              }`}
            >
              <span>🧑‍🏫 教えるよ！ (先輩)</span>
              <span className="text-[10px] bg-surface/20 px-1.5 py-0.2 rounded-full">
                {profiles.filter((p) => p.role_type === 'MENTOR').length}
              </span>
            </button>

            <button
              type="button"
              title="成立済みの相談ペアと現在の活動状況を表示します"
              onClick={() => setActiveTab('MATCHES')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'MATCHES'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface-subtle hover:bg-surface-hover text-foreground-subtle'
              }`}
            >
              <span>🤝 相談ペア・活動状況</span>
              <span className="text-[10px] bg-surface/20 px-1.5 py-0.2 rounded-full">
                {matches.length}
              </span>
            </button>
          </div>

          {/* 検索窓 */}
          {activeTab !== 'MATCHES' && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-faint w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="名前・チャンプ・コメント検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-success-edge-strong"
              />
            </div>
          )}
        </div>

        {/* 🎯 レーン別クイックフィルターピル ＆ 単発お試しフィルター */}
        {activeTab !== 'MATCHES' && (
          <div className="flex items-center justify-between gap-2 overflow-x-auto pt-1 border-t border-surface-subtle scrollbar-none flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="text-[11px] font-bold text-faint shrink-0 mr-1">レーン:</span>
              {LANE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setLaneFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition shrink-0 cursor-pointer ${
                    laneFilter === f.id
                      ? 'bg-stone-900 text-white dark:bg-primary-600 shadow-xs'
                      : 'bg-surface-subtle hover:bg-surface-hover text-muted'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 📨 あなた宛の未承諾申請（届いているオファー） */}
      {pendingReceived.length > 0 && (
        <div className="p-4 md:p-5 rounded-3xl bg-gradient-to-r from-primary-500/20 via-primary-500/15 to-primary-500/20 border-2 border-primary-edge shadow-md space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl animate-bounce">📨</span>
              <h3 className="text-sm font-black text-foreground">
                あなた宛の師弟オファーが届いています！（{pendingReceived.length}件）
              </h3>
            </div>
            <span className="text-[10px] font-bold bg-primary-500 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
              承諾待ち
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingReceived.map((req) => {
              const partner = req.mentor_discord_id === myDiscordId ? req.pupil : req.mentor;
              const isPartnerMentor = partner?.role_type === 'MENTOR';
              const cleanNotes = req.meta?.message || (req.notes || '').replace(/\[FROM:[^\]]+\]\s*/, '');
              const durationLabel = req.meta?.durationLabel || '2週間育成コース';

              return (
                <div
                  key={req.id}
                  className="bg-surface p-4 rounded-2xl border border-primary-edge shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{isPartnerMentor ? '👨‍🏫' : '🔰'}</span>
                        <span className="text-xs font-black text-foreground">
                          {partner?.player_name || 'プレイヤー'} さんから
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-muted bg-surface-subtle px-2 py-0.5 rounded-md">
                        {partner?.current_rank}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded-lg bg-primary-100 text-primary-900 font-bold border border-primary-edge-soft">
                        ⏱️ 希望期間: {durationLabel}
                      </span>
                      {req.meta?.autoRenew && (
                        <span className="px-2 py-0.5 rounded-lg bg-success-100 text-success-800 font-bold border border-success-edge-soft">
                          ⚡ 満了時そのまま継続
                        </span>
                      )}
                    </div>

                    {cleanNotes && (
                      <div className="p-2.5 bg-primary-50/60 rounded-xl border border-primary-edge-soft text-xs text-foreground-soft italic leading-relaxed">
                        「{cleanNotes}」
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-surface-subtle">
                    <button
                      type="button"
                      disabled={Boolean(acceptingMatchId)}
                      onClick={() => handleRejectRequest(req.id)}
                      className="px-3 py-1.5 text-xs font-bold text-muted-strong hover:text-foreground-soft hover:bg-surface-subtle rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      見送る
                    </button>
                    <button
                      type="button"
                      title="このオファーを承諾してペアを結成します。双方に+300コインが付与されます"
                      disabled={Boolean(acceptingMatchId)}
                      onClick={() => handleAcceptRequest(req.id)}
                      className={`px-4 py-1.5 rounded-xl font-black text-xs transition flex items-center gap-1.5 ${
                        acceptingMatchId === req.id
                          ? 'bg-stone-400 text-white cursor-not-allowed'
                          : 'bg-success-600 hover:bg-success-500 text-white shadow-sm cursor-pointer disabled:opacity-50'
                      }`}
                    >
                      {acceptingMatchId === req.id ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>成立処理中...</span>
                        </>
                      ) : (
                        <span>🤝 承諾してペア結成 (+300🪙)</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}



      {/* 🎯 AI相性マッチング・おすすめバディセクション */}
      {activeTab !== 'MATCHES' && (
        baseProfileForRecommendation ? (
          recommendedProfiles.length > 0 && (
            <div className="p-5 rounded-3xl bg-gradient-to-r from-primary-500/15 via-primary-500/10 to-primary-500/15 border-2 border-primary-edge/40 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary-600 animate-bounce" />
                  <h3 className="text-sm font-black text-foreground dark:text-stone-100">
                    🎯 あなたと相性抜群のバディ（AI相性分析）
                  </h3>
                </div>
                <span className="text-[10px] font-bold bg-surface/90 dark:bg-surface text-primary-900 dark:text-primary-300 border border-primary-edge dark:border-primary-edge-strong px-2 py-0.5 rounded-full">
                  リアルタイムマッチング
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendedProfiles.map(({ profile: p, score, reason }) => {
                  const isPendingSent = pendingSent.some(
                    (s) => s.mentor_profile_id === p.id || s.pupil_profile_id === p.id
                  );
                  const revKey = `${p.discord_id}_${p.role_type}`;
                  return (
                    <MentorshipCard
                      key={`rec-${p.id}`}
                      profile={p}
                      isMine={p.discord_id === myDiscordId}
                      isAdmin={isAdmin}
                      currentUserId={myDiscordId}
                      reviewSummary={reviewSummaries[revKey] || null}
                      matchScore={score}
                      matchReason={reason}
                      isPendingSent={isPendingSent}
                      onOffer={handleOffer}
                      onEdit={() => {
                        setEditingProfile(p);
                        setIsModalOpen(true);
                      }}
                      onDelete={() => handleDeleteProfile(p.id)}
                    />
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <div className="p-4 md:p-5 rounded-3xl bg-gradient-to-r from-success-500/10 via-secondary-500/10 to-success-500/10 border border-success-edge/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-success-100 text-success-800 flex items-center justify-center text-xl shrink-0 font-bold shadow-2xs">
                💡
              </div>
              <div className="space-y-0.5 text-center sm:text-left">
                <h4 className="text-xs font-black text-foreground">
                  {activeTab === 'PUPIL'
                    ? '弟子としての自己紹介カードを登録して、相性の良い師匠を探そう！'
                    : '師匠としての自己紹介カードを登録して、教えたい弟子を募集しよう！'}
                </h4>
                <p className="text-[11px] text-muted font-medium">
                  得意チャンプや目標を登録すると、あなたにぴったりのバディが自動表示されます（初回ボーナス +500コイン🎁）。
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (activeTab === 'MENTOR' && !canBeMentor) {
                  alert(
                    `先輩カードを登録できるのは、定期カスタムに15戦以上参加した「👑 常連」または「🎖️ 経験者」メンバー限定です。\n（現在のステータス: ${userTier?.label || 'ライト層'} / 通算${userTier?.totalGames || 0}戦）\nまずは「弟子カード」を登録して相談したり、定期カスタムへの参加経験を重ねましょう！`
                  );
                  return;
                }
                setEditingProfile(null);
                setIsModalOpen(true);
              }}
              className={`px-4 py-2 rounded-xl text-white font-black text-xs transition shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                activeTab === 'MENTOR' && !canBeMentor
                  ? 'bg-stone-500 hover:bg-stone-600'
                  : 'bg-success-600 hover:bg-success-500'
              }`}
            >
              <Plus size={14} />
              <span>
                {activeTab === 'PUPIL'
                  ? '弟子カードを登録'
                  : !canBeMentor
                  ? '師匠カード（👑常連・経験者限定）'
                  : '師匠カードを登録'}
              </span>
            </button>
          </div>
        )
      )}

      {/* コンテンツ一覧 */}
      {isLoading ? (
        <div className="py-12 text-center text-xs font-bold text-muted-strong animate-pulse">
          自己紹介カードを読み込み中...
        </div>
      ) : activeTab === 'MATCHES' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((match) => {
            const isMyMatch =
              match.mentor_discord_id === myDiscordId || match.pupil_discord_id === myDiscordId;
            const isCompleted = match.status === 'COMPLETED';
            const isExpired = match.isExpired;
            const durationLabel = match.meta?.durationLabel || '2週間育成コース';
            const remainingDays = match.remainingDays;

            return (
              <div
                key={match.id}
                className={`rounded-2xl p-5 border shadow-xs flex flex-col justify-between gap-3.5 transition ${
                  isCompleted
                    ? 'bg-background/80 border-border opacity-90'
                    : isExpired
                    ? 'bg-primary-50/70 border-primary-edge ring-2 ring-primary-400/50'
                    : isMyMatch
                    ? 'bg-gradient-to-br from-primary-50/90 to-white border-primary-edge'
                    : 'bg-surface border-primary-edge-soft'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{isCompleted ? '🎓' : isExpired ? '⏳' : '🤝'}</span>
                      <span className="text-xs font-black text-foreground">
                        {isCompleted ? '完了した相談ペア' : isExpired ? '期間満了（延長・完了待ち）' : '活動中の相談ペア'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* ステータスバッジ */}
                      {isCompleted ? (
                        <span className="text-[11px] font-bold text-muted bg-surface-hover px-2.5 py-0.5 rounded-full">
                          🎓 卒業完了
                        </span>
                      ) : isExpired ? (
                        <span className="text-[11px] font-black text-primary-800 bg-primary-200 px-2.5 py-0.5 rounded-full animate-pulse">
                          ⚠️ 期間満了
                        </span>
                      ) : (
                        <span className="text-[11px] font-black text-success-800 bg-success-100 px-2.5 py-0.5 rounded-full">
                          🔥 残り {remainingDays} 日
                        </span>
                      )}

                      {/* 🛠️ 管理者専用: ペア強制削除ボタン */}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleAdminDeleteMatch(match.id)}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-danger-100 hover:bg-danger-200 text-danger-800 border border-danger-edge transition cursor-pointer"
                          title="管理者権限でこの相談ペアを強制解散・削除します"
                        >
                          🗑️ 管理者削除
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ペア名 */}
                  <div className="text-sm font-black text-foreground flex items-center gap-2">
                    <span>🧑‍🏫 {match.mentor?.player_name || '先輩'} (先輩)</span>
                    <span className="text-faint">×</span>
                    <span>🙋‍♂️ {match.pupil?.player_name || '後輩'} (後輩)</span>
                  </div>

                  {/* 期間情報 */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded-lg bg-surface-subtle text-foreground-subtle font-bold">
                      {durationLabel}
                    </span>
                    <span className="text-muted-strong font-medium">
                      開始: {new Date(match.started_at || match.created_at).toLocaleDateString('ja-JP')}
                    </span>
                    {match.meta?.autoRenew && !isCompleted && (
                      <span className="text-success-700 font-bold text-[10px]">
                        (自動継続ON)
                      </span>
                    )}
                  </div>

                  {match.meta?.threadUrl && (
                    <div className="pt-0.5">
                      <a
                        href={match.meta.threadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-edge-soft transition"
                      >
                        <MessageSquare size={12} className="text-primary-600" />
                        <span>💬 相談専用スレッドを開く ➔</span>
                      </a>
                    </div>
                  )}

                  {/* 🌱 成長カルテ（中間チェックイン） */}
                  {match.meta?.checkins && match.meta.checkins.length > 0 && (
                    <div className="mt-2 p-3 rounded-2xl bg-success-500/10 border border-success-edge/30 space-y-2 text-xs">
                      <div className="flex items-center justify-between font-black text-foreground">
                        <span className="flex items-center gap-1.5 text-success-800">
                          <Sparkles size={13} className="text-success-600" />
                          <span>🌱 成長カルテ（中間チェックイン）</span>
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          match.meta.checkins[0].status === 'COMPLETED'
                            ? 'bg-success-200 text-success-900'
                            : 'bg-primary-100 text-primary-800 animate-pulse'
                        }`}>
                          {match.meta.checkins[0].status === 'COMPLETED' ? '✅ カルテ完成' : '⏳ 入力受付中'}
                        </span>
                      </div>

                      {match.meta.checkins[0].pupilFeedback && (
                        <div className="bg-surface/70 rounded-xl p-2 space-y-0.5 border border-border/50 text-[11px]">
                          <div className="font-bold text-success-800 flex items-center gap-1">
                            <span>🌱 弟子の実感:</span>
                            <span>{'⭐'.repeat(match.meta.checkins[0].pupilFeedback.rating || 5)}</span>
                          </div>
                          <p className="text-foreground font-medium pl-1">{match.meta.checkins[0].pupilFeedback.growthNote}</p>
                          {match.meta.checkins[0].pupilFeedback.challenges && (
                            <p className="text-muted text-[10px] pl-1">🎯 次の課題: {match.meta.checkins[0].pupilFeedback.challenges}</p>
                          )}
                        </div>
                      )}

                      {match.meta.checkins[0].mentorFeedback && (
                        <div className="bg-surface/70 rounded-xl p-2 space-y-0.5 border border-border/50 text-[11px]">
                          <div className="font-bold text-primary-800">👑 師匠のアドバイス:</div>
                          <p className="text-foreground font-medium pl-1">{match.meta.checkins[0].mentorFeedback.advice}</p>
                          {match.meta.checkins[0].mentorFeedback.praise && (
                            <p className="text-muted text-[10px] pl-1">✨ 褒めポイント: {match.meta.checkins[0].mentorFeedback.praise}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 自分のペアである場合のアクション（レビュー送信 / 期間延長 / 卒業完了 / キックオフ / Discord連絡 / 円満解散） */}
                {isMyMatch && (
                  <div className="pt-2.5 border-t border-border/80 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* ⭐ 匿名レビューボタン */}
                        <button
                          type="button"
                          title="相手に星評価と推薦タグを匿名で送ります。送信で+100コイン"
                          onClick={() => {
                            setSelectedReviewMatch(match);
                            setIsReviewModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-xl font-black text-xs bg-primary-50 hover:bg-primary-100 text-primary-900 transition flex items-center gap-1 cursor-pointer border border-primary-edge shadow-2xs"
                        >
                          <Star size={13} className="text-primary-600 fill-primary-400" />
                          <span>⭐ フィードバックを送る (+100🪙)</span>
                        </button>

                        {!isCompleted && (
                          <>
                            <button
                              type="button"
                              title="ペア成立後にやること（挨拶→目標決め→1戦）の3ステップを表示します"
                              onClick={() => {
                                setSelectedKickoffMatch(match);
                                setIsKickoffModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-surface-subtle hover:bg-surface-hover text-foreground-soft transition flex items-center gap-1 cursor-pointer border border-border"
                            >
                              <Rocket size={13} className="text-success-600" />
                              <span>🚀 ガイド</span>
                            </button>

                            {match.meta?.threadUrl ? (
                              <a
                                href={match.meta.threadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-xl font-black text-xs bg-primary-600 hover:bg-primary-500 text-white transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Discordの専用指導スレッドを開く"
                              >
                                <MessageSquare size={13} />
                                <span>💬 専用チャット</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCreateThread(match.id)}
                                disabled={creatingThreadMatchId === match.id}
                                className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-primary-50 hover:bg-primary-100 text-primary-800 transition flex items-center gap-1 cursor-pointer border border-primary-edge-soft disabled:opacity-50"
                                title="Discord (🎓コーチング・質問) に専用指導スレッドを作成"
                              >
                                <MessageSquare size={13} className="text-primary-600" />
                                <span>{creatingThreadMatchId === match.id ? '作成中...' : '💬 チャット作成'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                const partner = match.mentor_discord_id === myDiscordId ? match.pupil : match.mentor;
                                handleContactDiscord(partner?.player_name || '相手');
                              }}
                              className="px-2 py-1.5 rounded-xl font-bold text-xs bg-surface-subtle hover:bg-surface-hover text-foreground-subtle transition flex items-center gap-1 cursor-pointer border border-border"
                              title="相手のDiscord名を表示"
                            >
                              <span>DM</span>
                            </button>
                          </>
                        )}
                      </div>

                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleCancelMatch(match.id)}
                          className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-surface-subtle hover:bg-danger-50 text-muted-strong hover:text-danger-700 transition flex items-center gap-1 cursor-pointer"
                          title="お互いに合意の上でペナルティなく解散・再募集に戻します"
                        >
                          <Leaf size={12} />
                          <span>🍃 円満解散</span>
                        </button>
                      )}
                    </div>

                    {!isCompleted && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleExtendMatch(match.id, 14)}
                          className="px-3 py-1.5 rounded-xl font-black text-xs bg-primary-600 hover:bg-primary-500 text-white shadow-xs transition flex items-center gap-1 cursor-pointer"
                          title="現在の期間をさらに14日間そのまま延長します"
                        >
                          <span>⚡ そのまま実行（+14日延長）</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompleteMatch(match.id)}
                          className="px-3 py-1.5 rounded-xl font-black text-xs bg-success-600 hover:bg-success-500 text-white shadow-xs transition flex items-center gap-1 cursor-pointer"
                          title="目標達成として円満卒業し、両者に+200コインを付与します"
                        >
                          <span>🎓 卒業・完了 (+200🪙)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {matches.length === 0 && (
            <div className="col-span-full py-12 text-center text-faint text-xs font-bold bg-surface rounded-2xl border border-border">
              まだ成立した師弟ペアはありません。掲示板で相手を探してみましょう！
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProfiles.map((p) => {
            const matchInfo = calculateMatchScore(p);
            const isPendingSent = pendingSent.some(
              (s) => s.mentor_profile_id === p.id || s.pupil_profile_id === p.id
            );
            const revKey = `${p.discord_id}_${p.role_type}`;

            return (
              <MentorshipCard
                key={p.id}
                profile={p}
                isMine={p.discord_id === myDiscordId}
                isAdmin={isAdmin}
                currentUserId={myDiscordId}
                reviewSummary={reviewSummaries[revKey] || null}
                matchScore={matchInfo.score}
                matchReason={matchInfo.reason}
                isPendingSent={isPendingSent}
                onOffer={handleOffer}
                onEdit={() => {
                  setEditingProfile(p);
                  setIsModalOpen(true);
                }}
                onDelete={() => handleDeleteProfile(p.id)}
              />
            );
          })}

          {filteredProfiles.length === 0 && (
            <div className="col-span-full py-12 text-center text-faint text-xs font-bold bg-surface rounded-2xl border border-border">
              該当する自己紹介カードが見つかりませんでした。
            </div>
          )}
        </div>
      )}

      {/* 自己紹介作成・編集モーダル */}
      <MentorshipProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialProfile={editingProfile}
        defaultRole={activeTab === 'MENTOR' ? 'MENTOR' : 'PUPIL'}
        myProfiles={{
          PUPIL: myPupilProfile,
          MENTOR: myMentorProfile,
        }}
        canBeMentor={canBeMentor}
        userTier={userTier}
        onSave={handleSaveProfile}
      />

      {/* 申請送信モーダル */}
      <MentorshipRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => {
          setIsRequestModalOpen(false);
          setTargetRequestProfile(null);
        }}
        targetProfile={targetRequestProfile}
        onSubmit={handleSendRequest}
      />

      {/* 🚀 キックオフガイドモーダル */}
      <MentorshipKickoffModal
        isOpen={isKickoffModalOpen}
        onClose={() => {
          setIsKickoffModalOpen(false);
          setSelectedKickoffMatch(null);
        }}
        match={selectedKickoffMatch}
      />

      {/* 📜 師弟心得モーダル */}
      <MentorshipGuidelinesModal
        isOpen={isGuidelinesModalOpen}
        onClose={() => setIsGuidelinesModalOpen(false)}
      />

      {/* ⭐ 匿名レビューモーダル */}
      <MentorshipReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedReviewMatch(null);
        }}
        match={selectedReviewMatch}
        myDiscordId={myDiscordId}
        onSubmitted={() => fetchReviewSummaries()}
      />

      {/* 🤖 シークレットお見合い便モーダル */}
      <SecretMatchmakerModal
        isOpen={isSecretMatchmakerOpen}
        onClose={() => setIsSecretMatchmakerOpen(false)}
      />
    </div>
  );
}


