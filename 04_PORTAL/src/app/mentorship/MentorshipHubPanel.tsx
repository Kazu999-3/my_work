'use client';

import React, { useState, useEffect } from 'react';
import { MentorshipProfile } from '../api/mentorship/profiles/route';
import { MentorshipCard } from './MentorshipCard';
import { MentorshipProfileModal } from './MentorshipProfileModal';
import { MentorshipRequestModal } from './MentorshipRequestModal';
import { toast } from '../../components/Toaster';
import { HeartHandshake, Sparkles, Plus, Search, Shield, Award, Users, Swords } from 'lucide-react';

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
  const [myDiscordId, setMyDiscordId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // プロフィール編集・作成モーダル管理
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<MentorshipProfile | null>(null);

  // 申請送信モーダル管理
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [targetRequestProfile, setTargetRequestProfile] = useState<MentorshipProfile | null>(null);

  // プロフィール一覧の取得
  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/mentorship/profiles?status=ALL');
      const data = await res.json();
      if (data.ok) {
        setProfiles(data.profiles || []);
        setMyDiscordId(data.myDiscordId || null);
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
      }
    } catch (err) {
      console.error('Failed to fetch matches:', err);
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchMatches();
  }, []);

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

  // 申請モーダルを開く
  const handleOffer = (targetProfile: MentorshipProfile) => {
    setTargetRequestProfile(targetProfile);
    setIsRequestModalOpen(true);
  };

  // 申請を送信
  const handleSendRequest = async (targetProfileId: string, message: string) => {
    try {
      const res = await fetch('/api/mentorship/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPLY',
          targetProfileId,
          message,
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
        fetchProfiles();
        fetchMatches();
      } else {
        toast.error(data.error || '承諾に失敗しました');
      }
    } catch (err) {
      toast.error('エラーが発生しました');
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

  const myProfile = profiles.find((p) => p.discord_id === myDiscordId);

  // 🎯 AI相性スコアの算出ロジック
  const calculateMatchScore = (target: MentorshipProfile): { score: number; reason: string } => {
    if (!myProfile || target.discord_id === myProfile.discord_id) {
      return { score: 0, reason: '' };
    }

    let score = 50; // ベーススコア
    const reasons: string[] = [];

    // 1. 役割の補完性 (弟子×師匠)
    if (myProfile.role_type !== target.role_type) {
      score += 20;
    }

    // 2. レーン適合度
    const sharedLanes = (myProfile.lanes || []).filter((l) => (target.lanes || []).includes(l));
    if (sharedLanes.length > 0) {
      score += 20;
      reasons.push(`${sharedLanes.join('/')}専`);
    } else {
      // BOT x SUP や MID x JG などのシナジー
      const isDuoSynergy =
        (myProfile.lanes?.includes('BOT') && target.lanes?.includes('SUPPORT')) ||
        (myProfile.lanes?.includes('SUPPORT') && target.lanes?.includes('BOT')) ||
        (myProfile.lanes?.includes('MID') && target.lanes?.includes('JUNGLE')) ||
        (myProfile.lanes?.includes('JUNGLE') && target.lanes?.includes('MID'));
      if (isDuoSynergy) {
        score += 15;
        reasons.push('相性抜群のレーンシナジー');
      }
    }

    // 3. 得意チャンピオンの共通性
    const sharedChamps = (myProfile.champions || []).filter((c) => (target.champions || []).includes(c));
    if (sharedChamps.length > 0) {
      score += 10;
      reasons.push('共通チャンプあり');
    }

    // 4. 指導・学習スタイルのタグ共通性
    const sharedTags = (myProfile.tags || []).filter((t) => (target.tags || []).includes(t));
    if (sharedTags.length > 0) {
      score += Math.min(sharedTags.length * 4, 12);
      if (reasons.length < 2) reasons.push(sharedTags[0]);
    }

    const finalScore = Math.min(Math.max(score, 60), 98);
    const reasonText = reasons.length > 0 ? reasons.join(' ＆ ') : 'プレイスタイルが適合';
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

  // おすすめピックアップ（相性スコア上位2名）
  const recommendedProfiles = myProfile
    ? profiles
        .filter((p) => p.discord_id !== myDiscordId && p.role_type !== myProfile.role_type)
        .map((p) => ({ profile: p, ...calculateMatchScore(p) }))
        .filter((item) => item.score >= 75)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
    : [];

  return (
    <div className="space-y-6">
      {/* ヒーローバナー */}
      <div className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border border-emerald-500/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-800 text-xs font-black border border-emerald-500/30">
              <HeartHandshake size={14} className="text-emerald-600" />
              KTM 師弟マッチング ＆ 自己紹介ハブ
            </div>
            <h2 className="text-xl md:text-2xl font-black text-stone-900">
              弟子入り ＆ メンター自己紹介掲示板
            </h2>
            <p className="text-stone-700 text-xs md:text-sm max-w-2xl font-medium leading-relaxed">
              「もっと上手くなりたい弟子」と「優しく教えたい師匠（メンター）」を結ぶ掲示板です。自己紹介カードを公開してバディを見つけよう！
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingProfile(myProfile || null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus size={15} />
            <span>{myProfile ? '自分のカードを編集' : '自己紹介カードを投稿'}</span>
          </button>
        </div>
      </div>

      {/* タブ切り替えバー */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/90 p-4 rounded-2xl border border-stone-200/90 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('PUPIL')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'PUPIL'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <span>🌱 弟子募集・希望者</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">
              {profiles.filter((p) => p.role_type === 'PUPIL').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MENTOR')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'MENTOR'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <span>👑 師匠（メンター）一覧</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">
              {profiles.filter((p) => p.role_type === 'MENTOR').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MATCHES')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'MATCHES'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <span>🤝 成立した師弟ペア</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">
              {matches.length}
            </span>
          </button>
        </div>

        {/* 検索窓 */}
        {activeTab !== 'MATCHES' && (
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="名前・チャンプ・コメント検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-stone-900 focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}
      </div>

      {/* 📨 あなた宛の未承諾申請（届いているオファー） */}
      {pendingReceived.length > 0 && (
        <div className="p-4 md:p-5 rounded-3xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 border-2 border-amber-400 shadow-md space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl animate-bounce">📨</span>
              <h3 className="text-sm font-black text-stone-900">
                あなた宛の師弟オファーが届いています！（{pendingReceived.length}件）
              </h3>
            </div>
            <span className="text-[10px] font-bold bg-amber-500 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
              承諾待ち
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingReceived.map((req) => {
              const partner = req.mentor_discord_id === myDiscordId ? req.pupil : req.mentor;
              const isPartnerMentor = partner?.role_type === 'MENTOR';
              // notes からメッセージを抽出
              const cleanNotes = (req.notes || '').replace(/\[FROM:[^\]]+\]\s*/, '');

              return (
                <div
                  key={req.id}
                  className="bg-white p-4 rounded-2xl border border-amber-300 shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{isPartnerMentor ? '👨‍🏫' : '🔰'}</span>
                        <span className="text-xs font-black text-stone-900">
                          {partner?.player_name || 'プレイヤー'} さんから
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                        {partner?.current_rank}
                      </span>
                    </div>

                    {cleanNotes && (
                      <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200 text-xs text-stone-800 italic leading-relaxed">
                        「{cleanNotes}」
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => handleRejectRequest(req.id)}
                      className="px-3 py-1.5 text-xs font-bold text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition cursor-pointer"
                    >
                      見送る
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAcceptRequest(req.id)}
                      className="px-4 py-1.5 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>🤝 承諾してペア結成 (+300🪙)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* レーンフィルター */}
      {activeTab !== 'MATCHES' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {LANE_FILTERS.map((lane) => (
            <button
              key={lane.id}
              type="button"
              onClick={() => setLaneFilter(lane.id)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                laneFilter === lane.id
                  ? 'bg-stone-800 text-white'
                  : 'bg-white border border-stone-200 hover:bg-stone-100 text-stone-600'
              }`}
            >
              {lane.label}
            </button>
          ))}
        </div>
      )}

      {/* 🎯 AI相性マッチング・おすすめバディセクション */}
      {activeTab !== 'MATCHES' && (
        myProfile ? (
          recommendedProfiles.length > 0 && (
            <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-400/40 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600 animate-bounce" />
                  <h3 className="text-sm font-black text-stone-900">
                    🎯 あなたと相性抜群のバディ（AI相性分析）
                  </h3>
                </div>
                <span className="text-[10px] font-bold bg-white/90 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                  リアルタイムマッチング
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendedProfiles.map(({ profile: p, score, reason }) => {
                  const isPendingSent = pendingSent.some(
                    (s) => s.mentor_profile_id === p.id || s.pupil_profile_id === p.id
                  );
                  return (
                    <MentorshipCard
                      key={`rec-${p.id}`}
                      profile={p}
                      isMine={false}
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
          <div className="p-4 md:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-400/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl shrink-0 font-bold shadow-2xs">
                💡
              </div>
              <div className="space-y-0.5 text-center sm:text-left">
                <h4 className="text-xs font-black text-stone-900">
                  あなたの自己紹介カードを登録して、AI相性マッチングを体験しよう！
                </h4>
                <p className="text-[11px] text-stone-600 font-medium">
                  得意チャンプや目標を登録すると、あなたにぴったりの師匠・弟子が自動表示されます（初回ボーナス +500コイン🎁）。
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingProfile(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus size={14} />
              <span>カードを登録する</span>
            </button>
          </div>
        )
      )}

      {/* コンテンツ一覧 */}
      {isLoading ? (
        <div className="py-12 text-center text-xs font-bold text-stone-500 animate-pulse">
          自己紹介カードを読み込み中...
        </div>
      ) : activeTab === 'MATCHES' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((match) => (
            <div
              key={match.id}
              className="bg-white rounded-2xl p-5 border border-indigo-200 shadow-xs flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">🤝</span>
                  <span className="text-xs font-black text-indigo-900">師弟ペア成立</span>
                  <span className="text-[10px] text-stone-500 font-mono">
                    {new Date(match.started_at || match.created_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                <div className="text-sm font-black text-stone-900">
                  👑 {match.mentor?.player_name || '師匠'} × 🌱 {match.pupil?.player_name || '弟子'}
                </div>
              </div>
              <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                共闘中 🔥
              </div>
            </div>
          ))}

          {matches.length === 0 && (
            <div className="col-span-full py-12 text-center text-stone-400 text-xs font-bold bg-white rounded-2xl border border-stone-200">
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

            return (
              <MentorshipCard
                key={p.id}
                profile={p}
                isMine={p.discord_id === myDiscordId}
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
            <div className="col-span-full py-12 text-center text-stone-400 text-xs font-bold bg-white rounded-2xl border border-stone-200">
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
    </div>
  );
}
