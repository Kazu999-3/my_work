'use client';

import React from 'react';
import { MentorshipProfile } from '../api/mentorship/profiles/route';
import { getKtmRank, RANKS } from '../../lib/mmr';

interface MentorshipCardProps {
  profile: MentorshipProfile;
  isMine: boolean;
  onOffer: (profile: MentorshipProfile) => void;
  onEdit?: (profile: MentorshipProfile) => void;
  onDelete?: (profileId: string) => void;
}

const LANE_ICONS: Record<string, string> = {
  TOP: '🛡️ TOP',
  JUNGLE: '🌲 JG',
  MID: '⚡ MID',
  BOT: '🏹 BOT',
  SUPPORT: '💖 SUP',
};

export function MentorshipCard({
  profile,
  isMine,
  onOffer,
  onEdit,
  onDelete,
}: MentorshipCardProps) {
  const isMentor = profile.role_type === 'MENTOR';
  const rankKey = (profile.current_rank || 'UNRANKED').toUpperCase().split(' ')[0];
  const mmr = RANKS[rankKey] || 1200;
  const rankInfo = getKtmRank(mmr);

  return (
    <div className={`relative rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
      isMentor
        ? 'bg-stone-900/90 border-amber-500/40 hover:border-amber-400 shadow-lg shadow-amber-950/20'
        : 'bg-stone-900/90 border-emerald-500/40 hover:border-emerald-400 shadow-lg shadow-emerald-950/20'
    }`}>
      {/* 上部ヘッダーバッジ */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {/* 役職バッジ */}
            <div className={`px-2.5 py-1 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1 ${
              isMentor
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {isMentor ? '👨‍🏫 師匠 (Mentor)' : '🔰 弟子 (Pupil)'}
            </div>

            {/* ステータスバッジ */}
            {profile.status === 'MATCHED' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                🤝 ペア結成中
              </span>
            )}
          </div>

          {/* 編集・削除ボタン（自分の場合） */}
          {isMine && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <button
                  onClick={() => onEdit(profile)}
                  className="px-2 py-1 text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded transition"
                  title="編集"
                >
                  ✏️
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(profile.id)}
                  className="px-2 py-1 text-xs text-rose-400 hover:text-rose-200 hover:bg-stone-800 rounded transition"
                  title="削除"
                >
                  🗑️
                </button>
              )}
            </div>
          )}
        </div>

        {/* プレイヤー情報 */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-xl font-black text-amber-400 shrink-0">
            {profile.player_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-stone-100 truncate flex items-center gap-2">
              {profile.player_name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-stone-400 mt-0.5">
              <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${rankInfo.bg} ${rankInfo.color} border border-current/20`}>
                {rankInfo.name}
              </span>
              {profile.target_rank && !isMentor && (
                <span className="text-[11px] text-emerald-400 font-bold">
                  ➔ 目標: {profile.target_rank}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* レーンピル一覧 */}
        {profile.lanes && profile.lanes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {profile.lanes.map((lane) => (
              <span
                key={lane}
                className="px-2 py-0.5 bg-stone-800/80 border border-stone-700 rounded-md text-[11px] font-bold text-stone-300"
              >
                {LANE_ICONS[lane] || lane}
              </span>
            ))}
          </div>
        )}

        {/* チャンピオンアイコン一覧 */}
        {profile.champions && profile.champions.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-stone-400">
              {isMentor ? '⚔️ 指導可能チャンピオン:' : '🎯 練習中チャンピオン:'}
            </span>
            <div className="flex flex-wrap gap-1.5 items-center">
              {profile.champions.map((champ) => {
                const champName = champ.trim();
                const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${champName}.png`;
                return (
                  <div
                    key={champName}
                    className="flex items-center gap-1 px-2 py-0.5 bg-stone-800/60 border border-stone-700/80 rounded-lg text-xs text-stone-300"
                  >
                    <img
                      src={iconUrl}
                      alt={champName}
                      className="w-4 h-4 rounded object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span>{champName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* タグ一覧（悩み / 得意分野） */}
        {profile.tags && profile.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {profile.tags.map((tag) => (
              <span
                key={tag}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                  isMentor
                    ? 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                }`}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 自己紹介文 */}
        {profile.bio && (
          <div className="p-2.5 bg-stone-950/60 rounded-xl border border-stone-800/80 text-xs text-stone-300 leading-relaxed">
            {profile.bio}
          </div>
        )}

        {/* 活動時間帯 */}
        {profile.active_hours && (
          <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
            <span>🕒 活動時間:</span>
            <span className="font-semibold text-stone-300">{profile.active_hours}</span>
          </div>
        )}
      </div>

      {/* 下部アクションボタン */}
      <div className="p-3 bg-stone-950/80 border-t border-stone-800 flex items-center justify-between gap-2">
        <div className="text-[10px] text-stone-500 font-mono">
          {new Date(profile.updated_at || profile.created_at).toLocaleDateString('ja-JP')}更新
        </div>

        {isMine ? (
          <span className="text-xs text-stone-400 font-bold">（あなたのカード）</span>
        ) : profile.status === 'MATCHED' ? (
          <span className="text-xs text-purple-400 font-bold">ペア結成中</span>
        ) : (
          <button
            onClick={() => onOffer(profile)}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 ${
              isMentor
                ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-900/30'
                : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-emerald-900/30'
            }`}
          >
            {isMentor ? '🙋 弟子入りをお願いする' : '🤝 師匠を引き受ける (+300🪙)'}
          </button>
        )}
      </div>
    </div>
  );
}
