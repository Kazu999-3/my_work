'use client';

import React, { useState, useEffect } from 'react';
import { MentorshipProfile } from '@/app/api/mentorship/profiles/route';
import { MentorshipCard } from './MentorshipCard';
import { MentorshipProfileModal } from './MentorshipProfileModal';
import { toast } from '@/components/Toaster';

const LANE_FILTERS = [
  { id: 'ALL', label: '🌐 全レーン' },
  { id: 'TOP', label: '🛡️ TOP' },
  { id: 'JUNGLE', label: '🌲 JG' },
  { id: 'MID', label: '⚡ MID' },
  { id: 'BOT', label: '🏹 BOT' },
  { id: 'SUPPORT', label: '💖 SUP' },
];

export default function MentorshipPage() {
  const [activeTab, setActiveTab] = useState<'PUPIL' | 'MENTOR' | 'MATCHES'>('PUPIL');
  const [laneFilter, setLaneFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<MentorshipProfile[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [myDiscordId, setMyDiscordId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // モーダル管理
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<MentorshipProfile | null>(null);

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

  // マッチ一覧の取得
  const fetchMatches = async () => {
    try {
      const res = await fetch('/api/mentorship/matches');
      const data = await res.json();
      if (data.ok) {
        setMatches(data.matches || []);
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
        toast.success('🪪 自己紹介カードを公開・更新しました！');
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
      toast.error('削除エラー');
    }
  };

  // オファー送信 / マッチング成立
  const handleOffer = async (targetProfile: MentorshipProfile) => {
    const isTargetPupil = targetProfile.role_type === 'PUPIL';
    const actionText = isTargetPupil
      ? `【${targetProfile.player_name}】さんの師匠を引き受けますか？ (+300🪙)`
      : `【${targetProfile.player_name}】さんに弟子入りを申し込みますか？ (+300🪙)`;

    if (!confirm(actionText)) return;

    try {
      const res = await fetch('/api/mentorship/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetProfileId: targetProfile.id,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('🎉 師弟コンビが成立しました！ ボーナス+300🪙が付与されました');
        fetchProfiles();
        fetchMatches();
      } else {
        toast.error(data.error || 'マッチングに失敗しました');
      }
    } catch (err) {
      toast.error('マッチング処理エラー');
    }
  };

  // フィルタリング処理
  const filteredProfiles = profiles.filter((p) => {
    // タブフィルター
    if (activeTab === 'PUPIL' && p.role_type !== 'PUPIL') return false;
    if (activeTab === 'MENTOR' && p.role_type !== 'MENTOR') return false;

    // レーンフィルター
    if (laneFilter !== 'ALL' && (!p.lanes || !p.lanes.includes(laneFilter))) return false;

    // 検索クエリ
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const nameMatch = p.player_name.toLowerCase().includes(query);
      const bioMatch = p.bio?.toLowerCase().includes(query);
      const tagMatch = p.tags?.some((t) => t.toLowerCase().includes(query));
      const champMatch = p.champions?.some((c) => c.toLowerCase().includes(query));
      return nameMatch || bioMatch || tagMatch || champMatch;
    }

    return true;
  });

  const myProfile = profiles.find((p) => myDiscordId && p.discord_id === myDiscordId);

  return (
    <div className="min-h-screen bg-[#1c1917] text-stone-100 p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. ページヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900/90 border border-amber-500/30 p-6 rounded-3xl shadow-xl shadow-amber-950/20 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-widest">
            <span>⚔️ KTM Mentorship Program</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-stone-100 mt-1 flex items-center gap-2">
            <span>🎓 師弟自己紹介掲示板</span>
          </h1>
          <p className="text-xs md:text-sm text-stone-400 mt-1.5 leading-relaxed">
            得意レーンやチャンピオンを教え合えるバディを見つけよう！自己紹介カードを作ってオファーを送ると、お互いに <strong className="text-amber-400">+300🪙</strong> 獲得。
          </p>
        </div>

        <button
          onClick={() => {
            setEditingProfile(myProfile || null);
            setIsModalOpen(true);
          }}
          className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black rounded-2xl shadow-lg shadow-amber-950/40 transition flex items-center justify-center gap-2 shrink-0 text-sm"
        >
          <span>🪪</span>
          <span>{myProfile ? '自分のカードを編集' : '自己紹介カードを作成'}</span>
        </button>
      </div>

      {/* 2. タブバー ＆ フィルター */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
          {/* メインタブ */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('PUPIL')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black transition flex items-center gap-1.5 ${
                activeTab === 'PUPIL'
                  ? 'bg-emerald-500 text-stone-950 shadow-md shadow-emerald-950/40'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              <span>🔰 弟子一覧 (教えてほしい)</span>
              <span className="px-1.5 py-0.5 rounded-full bg-stone-950/40 text-[11px]">
                {profiles.filter((p) => p.role_type === 'PUPIL').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('MENTOR')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black transition flex items-center gap-1.5 ${
                activeTab === 'MENTOR'
                  ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/40'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              <span>👨‍🏫 師匠一覧 (教えられる)</span>
              <span className="px-1.5 py-0.5 rounded-full bg-stone-950/40 text-[11px]">
                {profiles.filter((p) => p.role_type === 'MENTOR').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('MATCHES')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black transition flex items-center gap-1.5 ${
                activeTab === 'MATCHES'
                  ? 'bg-purple-500 text-stone-950 shadow-md shadow-purple-950/40'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              <span>🤝 成立ペア ({matches.length})</span>
            </button>
          </div>

          {/* 検索バー */}
          {activeTab !== 'MATCHES' && (
            <div className="w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="名前・チャンプ・タグで検索..."
                className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-200 focus:border-amber-500 focus:outline-hidden"
              />
            </div>
          )}
        </div>

        {/* レーンピルフィルター */}
        {activeTab !== 'MATCHES' && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-bold text-stone-400 mr-1">レーン絞り込み:</span>
            {LANE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setLaneFilter(f.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  laneFilter === f.id
                    ? 'bg-stone-200 text-stone-950'
                    : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. コンテンツエリア */}
      {isLoading ? (
        <div className="text-center py-20 text-stone-500 text-sm">
          ⏳ 自己紹介カードを読み込み中...
        </div>
      ) : activeTab === 'MATCHES' ? (
        /* 成立ペア一覧 */
        <div className="space-y-3">
          {matches.length === 0 ? (
            <div className="text-center py-16 bg-stone-900/40 rounded-2xl border border-stone-800 text-stone-400 text-sm">
              現在成立している師弟ペアはまだありません。気になる相手にオファーを送ってみましょう！
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="bg-stone-900/90 border border-purple-500/40 rounded-2xl p-5 space-y-3 shadow-lg shadow-purple-950/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-black">
                      🤝 師弟ペア結成
                    </span>
                    <span className="text-[10px] text-stone-500">
                      {new Date(m.started_at).toLocaleDateString('ja-JP')} 成立
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 p-3 bg-stone-950/70 rounded-xl border border-stone-800">
                    <div className="text-left">
                      <div className="text-[10px] text-amber-400 font-bold">👨‍🏫 師匠</div>
                      <div className="text-sm font-bold text-stone-200">
                        {m.mentor?.player_name || '師匠プレイヤー'}
                      </div>
                    </div>
                    <div className="text-lg">🤝</div>
                    <div className="text-right">
                      <div className="text-[10px] text-emerald-400 font-bold">🔰 弟子</div>
                      <div className="text-sm font-bold text-stone-200">
                        {m.pupil?.player_name || '弟子プレイヤー'}
                      </div>
                    </div>
                  </div>

                  {m.notes && (
                    <div className="text-xs text-stone-400 italic bg-stone-950/40 p-2 rounded-lg">
                      "{m.notes}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* カードグリッド表示 */
        <div>
          {filteredProfiles.length === 0 ? (
            <div className="text-center py-16 bg-stone-900/40 rounded-2xl border border-stone-800 text-stone-400 text-sm space-y-2">
              <div>現在表示できる自己紹介カードがありません。</div>
              <div className="text-xs text-stone-500">
                右上の「自己紹介カードを作成」から最初のカードを投稿してみましょう！
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProfiles.map((profile) => (
                <MentorshipCard
                  key={profile.id}
                  profile={profile}
                  isMine={Boolean(myDiscordId && profile.discord_id === myDiscordId)}
                  onOffer={handleOffer}
                  onEdit={(p) => {
                    setEditingProfile(p);
                    setIsModalOpen(true);
                  }}
                  onDelete={handleDeleteProfile}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. プロフィール登録・編集モーダル */}
      <MentorshipProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProfile}
        initialProfile={editingProfile}
      />
    </div>
  );
}
