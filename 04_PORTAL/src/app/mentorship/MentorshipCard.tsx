'use client';

import React from 'react';
import { MentorshipProfile } from '../api/mentorship/profiles/route';
import { getKtmRank, RANKS } from '../../lib/mmr';
import { CHAMPION_JA } from '../../components/ChampSelect';
import { Clock, Shield, Sparkles, UserCheck } from 'lucide-react';

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
    <div className={`relative rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between bg-white/95 backdrop-blur-sm ${
      isMentor
        ? 'border-amber-400/40 hover:border-amber-500 shadow-md shadow-amber-900/5 hover:shadow-lg'
        : 'border-emerald-400/40 hover:border-emerald-500 shadow-md shadow-emerald-900/5 hover:shadow-lg'
    }`}>
      {/* 上部ヘッダーバッジ */}
      <div className="p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* 役職バッジ */}
            <div className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1.5 ${
              isMentor
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
            }`}>
              <span>{isMentor ? '👨‍🏫' : '🔰'}</span>
              <span>{isMentor ? '師匠 (Mentor)' : '弟子 (Pupil)'}</span>
            </div>

            {/* ステータスバッジ */}
            {profile.status === 'MATCHED' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                🤝 ペア結成中
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                🟢 募集中
              </span>
            )}
          </div>

          {/* 編集・削除ボタン（自分の場合） */}
          {isMine && (
            <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
              {onEdit && (
                <button
                  onClick={() => onEdit(profile)}
                  className="px-2 py-1 text-xs text-stone-600 hover:text-stone-900 hover:bg-white rounded transition cursor-pointer"
                  title="編集"
                >
                  ✏️
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(profile.id)}
                  className="px-2 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-white rounded transition cursor-pointer"
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300/80 flex items-center justify-center text-xl font-black text-amber-900 shrink-0 shadow-2xs">
            {profile.player_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-stone-900 truncate flex items-center gap-2">
              {profile.player_name}
            </h3>
            <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${rankInfo.bg} ${rankInfo.color} border border-current/20 shadow-2xs`}>
                {rankInfo.name} ({profile.current_rank})
              </span>
              {profile.target_rank && !isMentor && (
                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  ➔ 目標: {profile.target_rank}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* レーンピル一覧 */}
        {profile.lanes && profile.lanes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {profile.lanes.map((lane) => (
              <span
                key={lane}
                className="px-2.5 py-1 bg-stone-100 border border-stone-200 rounded-lg text-xs font-bold text-stone-700"
              >
                {LANE_ICONS[lane] || lane}
              </span>
            ))}
          </div>
        )}

        {/* チャンピオンアイコン一覧 */}
        {profile.champions && profile.champions.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-stone-500">
              {isMentor ? '⚔️ 指導可能チャンピオン:' : '🎯 練習中・得意チャンピオン:'}
            </span>
            <div className="flex flex-wrap gap-1.5 items-center">
              {profile.champions.map((champ) => {
                const champName = champ.trim();
                const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${champName}.png`;
                return (
                  <div
                    key={champName}
                    className="flex items-center gap-1.5 px-2 py-1 bg-stone-50 border border-stone-200/90 rounded-xl text-xs font-bold text-stone-800 shadow-2xs"
                  >
                    <img
                      src={iconUrl}
                      alt={champName}
                      className="w-4.5 h-4.5 rounded-md object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span>{CHAMPION_JA[champName]?.ja || champName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* タグ一覧（悩み / 得意分野） */}
        {profile.tags && profile.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {profile.tags.map((tag) => (
              <span
                key={tag}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                  isMentor
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                }`}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 自己紹介文 */}
        {profile.bio && (
          <div className="p-3.5 bg-stone-50/90 rounded-2xl border border-stone-200 text-xs text-stone-800 leading-relaxed whitespace-pre-wrap font-medium">
            {profile.bio}
          </div>
        )}

        {/* 活動時間帯 */}
        {profile.active_hours && (
          <div className="flex items-center gap-1.5 text-xs text-stone-600 bg-stone-100/70 p-2 rounded-xl border border-stone-200/60">
            <Clock size={13} className="text-amber-600" />
            <span className="font-bold text-stone-500">活動時間:</span>
            <span className="font-bold text-stone-800">{profile.active_hours}</span>
          </div>
        )}
      </div>

      {/* 下部アクションボタン */}
      <div className="p-3.5 bg-stone-50 border-t border-stone-200/80 flex items-center justify-between gap-2">
        <div className="text-[11px] text-stone-500 font-medium">
          {new Date(profile.updated_at || profile.created_at).toLocaleDateString('ja-JP')} 更新
        </div>

        {isMine ? (
          <span className="text-xs text-stone-500 font-bold">（あなたのカード）</span>
        ) : profile.status === 'MATCHED' ? (
          <span className="text-xs text-purple-700 font-bold">ペア結成中</span>
        ) : (
          <button
            onClick={() => onOffer(profile)}
            className={`px-4 py-2 rounded-xl font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer ${
              isMentor
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
            }`}
          >
            {isMentor ? '🙋 弟子入りをお願いする' : '🤝 師匠を引き受ける (+300🪙)'}
          </button>
        )}
      </div>
    </div>
  );
}
