'use client';

import React, { useState, useEffect } from 'react';
import { toast } from '../../components/Toaster';
import { MentorshipProfile } from '../api/mentorship/profiles/route';
import { getRankBadgeStyle } from '../../lib/mmr';
import { CHAMPION_JA } from '../../lib/championConstants';
import { getChampIcon } from '../../lib/ddragonClient';
import { Clock, Sparkles, Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface MentorshipCardProps {
  profile: MentorshipProfile;
  isMine: boolean;
  isAdmin?: boolean;
  currentUserId?: string | null;
  currentUserName?: string | null;
  onOffer: (profile: MentorshipProfile) => void;
  onEdit?: (profile: MentorshipProfile) => void;
  onDelete?: (profileId: string) => void;
  matchScore?: number;
  matchReason?: string;
  isPendingSent?: boolean;
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
  isAdmin,
  currentUserId,
  currentUserName,
  onOffer,
  onEdit,
  onDelete,
  matchScore,
  matchReason,
  isPendingSent,
}: MentorshipCardProps) {
  const isMentor = profile.role_type === 'MENTOR';
  const rankBadge = getRankBadgeStyle(profile.current_rank);
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  return (
    <div className={`relative rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between bg-surface/95 dark:bg-surface dark:border-border backdrop-blur-sm shadow-md ${
      matchScore && matchScore >= 80
        ? 'ring-2 ring-primary-400 shadow-lg scale-[1.01]'
        : ''
    } ${
      isMentor
        ? 'border-primary-edge/40 hover:border-primary-edge-strong shadow-primary-900/5 hover:shadow-lg'
        : 'border-success-edge/40 hover:border-success-edge-strong shadow-success-900/5 hover:shadow-lg'
    }`}>
      {/* AI相性おすすめリボン */}
      {matchScore !== undefined && matchScore > 0 && (
        <div className="bg-gradient-to-r from-primary-500 via-primary-500 to-primary-500 text-stone-950 px-3 py-1 flex items-center justify-between text-[11px] font-black tracking-tight">
          <span className="flex items-center gap-1">
            <Sparkles size={13} className="text-stone-950 animate-bounce" />
            <span>AI相性スコア: <strong>{matchScore}%</strong></span>
          </span>
          {matchReason && <span className="opacity-90 font-bold truncate max-w-[200px]">{matchReason}</span>}
        </div>
      )}

      {/* 上部ヘッダーバッジ */}
      <div className="p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 役職バッジ */}
            <div className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1.5 ${
              isMentor
                ? 'bg-primary-100 dark:bg-primary-950/50 text-primary-900 dark:text-primary-300 border border-primary-edge dark:border-primary-edge-strong'
                : 'bg-success-100 dark:bg-success-950/50 text-success-900 dark:text-success-300 border border-success-edge dark:border-success-edge-strong'
            }`}>
              <span>{isMentor ? '🧑‍🏫' : '🙋‍♂️'}</span>
              <span>{isMentor ? '教えるよ (先輩)' : '教えてほしい (後輩)'}</span>
            </div>
            {/* ステータスバッジ */}
            {isMentor ? (
              (profile.active_pupils_count || 0) >= (profile.max_pupils || 2) ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-100 dark:bg-primary-950/50 text-primary-800 dark:text-primary-300 border border-primary-edge-soft dark:border-primary-edge-strong flex items-center gap-1">
                  <span>🈵</span>
                  <span>相談枠満員 ({profile.active_pupils_count}/{profile.max_pupils || 2}人)</span>
                </span>
              ) : (profile.active_pupils_count || 0) > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success-100 dark:bg-success-950/50 text-success-800 dark:text-success-300 border border-success-edge dark:border-success-edge-strong flex items-center gap-1">
                  <span>👥</span>
                  <span>相談中: {profile.active_pupils_count}/{profile.max_pupils || 2}人</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success-50 dark:bg-success-950/50 text-success-700 dark:text-success-300 border border-success-edge-soft dark:border-success-edge-strong flex items-center gap-1">
                  <span>🟢</span>
                  <span>相談受付中</span>
                </span>
              )
            ) : profile.status === 'MATCHED' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-100 dark:bg-primary-950/50 text-primary-800 dark:text-primary-300 border border-primary-edge-soft dark:border-primary-edge-strong">
                🤝 相談ペア結成中
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-50 dark:bg-success-950/50 text-success-700 dark:text-success-300 border border-success-edge-soft dark:border-success-edge-strong">
                🟢 募集中
              </span>
            )}
          </div>

          {/* 編集・削除ボタン（本人または管理者の場合） */}
          {(isMine || isAdmin) && (
            <div className="flex items-center gap-1 bg-surface-subtle dark:bg-background p-0.5 rounded-lg border border-border dark:border-border shrink-0 whitespace-nowrap">
              {(isMine || isAdmin) && onEdit && (
                <button
                  onClick={() => onEdit(profile)}
                  className="px-2 py-1 text-xs text-muted hover:text-foreground dark:hover:text-white hover:bg-surface rounded transition cursor-pointer flex items-center gap-0.5"
                  title={isAdmin && !isMine ? '管理者権限で代理編集（メンテ）' : '編集'}
                >
                  <span>✏️</span>
                  {isAdmin && !isMine && (
                    <span className="text-[10px] font-black text-primary-700 dark:text-primary-400">メンテ</span>
                  )}
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(profile.id)}
                  className="px-2 py-1 text-xs text-danger-600 hover:text-danger-800 hover:bg-danger-50 dark:hover:bg-danger-950/30 rounded transition cursor-pointer flex items-center gap-0.5"
                  title={isAdmin && !isMine ? '管理者権限で削除' : '削除'}
                >
                  <span>🗑️</span>
                  {isAdmin && !isMine && <span className="text-[10px] font-black text-danger-700 dark:text-danger-400">管理</span>}
                </button>
              )}
            </div>
          )}
        </div>

        {/* プレイヤー情報 */}
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-xl font-black shrink-0 shadow-2xs ${
            isMentor
              ? 'bg-gradient-to-br from-primary-100 to-primary-200 border-primary-edge/80 text-primary-900'
              : 'bg-gradient-to-br from-success-100 to-success-200 border-success-edge/80 text-success-900'
          }`}>
            {profile.player_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-foreground dark:text-stone-100 truncate flex items-center gap-2">
              <span>{profile.player_name}</span>
              {isMentor && (profile.tier === 'regular' || profile.tier === 'experienced') && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-secondary-100 dark:bg-secondary-950/40 text-secondary-900 dark:text-secondary-300 border border-secondary-edge shrink-0">
                  {profile.tier === 'regular' ? '👑 常連' : '🎖️ 経験者'}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${rankBadge.bg} ${rankBadge.color} border ${rankBadge.border} shadow-2xs`}>
                {profile.current_rank || 'UNRANKED'}
              </span>
            </div>

            {/* 師匠が現在指導中の弟子（兄弟弟子）一覧 */}
            {isMentor && profile.active_pupil_names && profile.active_pupil_names.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-muted-strong flex items-center gap-0.5">
                  <span>🤝</span>
                  <span>指導中:</span>
                </span>
                {profile.active_pupil_names.map((name, idx) => (
                  <span
                    key={`${name}-${idx}`}
                    className="text-[10px] font-bold bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-edge-soft dark:border-primary-edge-strong px-1.5 py-0.2 rounded-md"
                  >
                    🌱 {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* レーンピル一覧 */}
        {profile.lanes && profile.lanes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {profile.lanes.map((lane) => (
              <span
                key={lane}
                className="px-2.5 py-1 bg-surface-subtle dark:bg-background border border-border rounded-lg text-xs font-bold text-foreground-subtle dark:text-stone-200"
              >
                {LANE_ICONS[lane] || lane}
              </span>
            ))}
          </div>
        )}

        {/* チャンピオンアイコン一覧 (シンプル化: 最大4体 + getChampIcon) */}
        {profile.champions && profile.champions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[11px] font-bold text-muted-strong shrink-0">
              {isMentor ? '⚔️ 得意・教えられる:' : '🎯 相談したい:'}
            </span>
            {profile.champions.slice(0, 4).map((champ) => {
              const champName = champ.trim();
              return (
                <div
                  key={champName}
                  className="flex items-center gap-1 px-2 py-0.5 bg-background border border-border/90 dark:border-border rounded-lg text-xs font-bold text-foreground-soft dark:text-stone-200 shadow-2xs"
                >
                  <img
                    src={getChampIcon(champName)}
                    alt={champName}
                    className="w-4 h-4 rounded-md object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span>{CHAMPION_JA[champName]?.ja || champName}</span>
                </div>
              );
            })}
            {profile.champions.length > 4 && (
              <span className="text-[10px] text-muted-strong font-bold bg-surface-subtle px-1.5 py-0.5 rounded-md border border-border">
                +{profile.champions.length - 4}
              </span>
            )}
          </div>
        )}

        {/* コミュニケーションスタイル ＆ 相談テーマ */}
        {profile.tags && profile.tags.length > 0 && (() => {
          const styleTags: { raw: string; label: string; icon: string }[] = [];
          const otherTags: string[] = [];

          profile.tags.forEach((tag) => {
            if (tag.includes('VC') || tag.includes('通話')) {
              styleTags.push({ raw: tag, label: 'VC通話', icon: '🎙️' });
            } else if (tag.includes('聞き専')) {
              styleTags.push({ raw: tag, label: '聞き専OK', icon: '🎧' });
            } else if (tag.includes('テキスト')) {
              styleTags.push({ raw: tag, label: 'テキスト', icon: '💬' });
            } else if (tag.includes('画面共有')) {
              styleTags.push({ raw: tag, label: '画面共有', icon: '📺' });
            } else {
              const isJunk = [
                '優しく丁寧に教えます', 'チャンピオン使い方講座', 'ノーマル/カスタム同伴プレイ',
                '1on1マッチアップ特訓', '初心者大歓迎', 'ゴールド以下歓迎', '全ランク・初心者歓迎',
                'エメラルド以下歓迎', 'プラチナ以下歓迎', '1試合カスタム歓迎', 'リプレイ添削歓迎',
                '3日間お試し歓迎', '単発指導OK', 'エンゲージ・仕掛け判断の指導', 'ピール・キャリー保護の指導',
                '集団戦フォーカス優先度', 'ガンク警戒・ディープワード', 'オブジェクト周りの陣形・マクロ',
                'ジャングルルート・ガンク判断', 'サポートローム・視界支配', 'リプレイ添削・ミスの言語化',
                '対面マッチアップ勝ち方・トレード', 'トレード・キルライン見極め', '単発相談OK',
                'オブジェクト戦の陣形・視界', 'タワーダイブ・シージ・防衛', 'サポートのローム基準',
                'キー配置・カメラ操作見直し', 'ウェーブ管理・フリーズ', 'ローム・寄りの判断',
                '有利な試合の終わらせ方', 'リプレイ自己分析のコツ', '画面共有ライブコーチング',
                '画面共有ライブ指導', 'VC指導対応', 'VC可能', 'テキストのみ', '1試合カスタム', 'リプレイ添削', '3日間お試し', '2週間育成', '1ヶ月特訓'
              ].includes(tag);
              if (!isJunk) {
                otherTags.push(tag);
              }
            }
          });

          // 重複除外したユニークスタイル
          const uniqueStyles = Array.from(new Map(styleTags.map(s => [s.label, s])).values());

          return (
            <div className="space-y-1.5">
              {/* スタイル一覧バッジ */}
              {uniqueStyles.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-muted-strong">やり方:</span>
                  {uniqueStyles.map((st) => (
                    <span
                      key={st.label}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-secondary-50 dark:bg-secondary-950/40 text-secondary-900 dark:text-secondary-300 border border-secondary-edge dark:border-secondary-edge-strong shadow-2xs"
                    >
                      <span>{st.icon}</span>
                      <span>{st.label}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* テーマタグ一覧（最大4件 + 残り件数） */}
              {otherTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {otherTags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                        isMentor
                          ? 'bg-primary-50/70 dark:bg-primary-950/30 text-primary-900 dark:text-primary-300 border-primary-edge-soft dark:border-primary-edge-strong'
                          : 'bg-success-50/70 dark:bg-success-950/30 text-success-900 dark:text-success-300 border-success-edge-soft dark:border-success-edge-strong'
                      }`}
                    >
                      #{tag}
                    </span>
                  ))}
                  {otherTags.length > 4 && (
                    <span className="text-[10px] text-muted font-bold bg-surface-subtle px-1.5 py-0.5 rounded-md border border-border">
                      +{otherTags.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* 自己紹介文 (シンプル化: 2行折りたたみ) */}
        {profile.bio && (
          <div className="p-3 bg-background/90 dark:bg-background rounded-2xl border border-border text-xs text-foreground-soft dark:text-stone-100 leading-relaxed font-medium">
            <p className={`whitespace-pre-wrap ${!isBioExpanded ? 'line-clamp-2' : ''}`}>
              {profile.bio}
            </p>
            {profile.bio.length > 80 && (
              <button
                type="button"
                onClick={() => setIsBioExpanded(!isBioExpanded)}
                className="mt-1 text-[11px] text-primary-700 dark:text-primary-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <span>{isBioExpanded ? '閉じる ▲' : '続きを読む ▼'}</span>
              </button>
            )}
          </div>
        )}

        {/* 活動時間帯 */}
        {profile.active_hours && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Clock size={12} className="text-primary-600 dark:text-primary-400" />
            <span className="font-bold text-muted-strong">活動時間:</span>
            <span className="font-semibold text-foreground-soft dark:text-stone-100">{profile.active_hours}</span>
          </div>
        )}
      </div>

      {/* 下部アクションバー */}
      <div className="p-3 bg-background border-t border-border/80 flex items-center justify-end gap-2">

        {isMine ? (
          <span className="text-xs text-muted-strong font-bold">（あなたのカード）</span>
        ) : !isMentor && profile.status === 'MATCHED' ? (
          <span className="text-xs text-primary-700 font-bold bg-primary-50 px-2.5 py-1 rounded-xl border border-primary-edge-soft">
            🤝 相談ペア結成中
          </span>
        ) : isMentor && (profile.active_pupils_count || 0) >= (profile.max_pupils || 2) ? (
          <span className="text-xs text-primary-700 font-bold bg-primary-50 px-2.5 py-1 rounded-xl border border-primary-edge-soft">
            🈵 相談枠満員 ({profile.max_pupils || 2}人)
          </span>
        ) : isPendingSent ? (
          <span className="text-xs text-primary-800 font-bold bg-primary-50 px-3 py-1.5 rounded-xl border border-primary-edge-soft flex items-center gap-1">
            ⏳ 申請中（返答待ち）
          </span>
        ) : (
          <button
            onClick={() => onOffer(profile)}
            className={`px-4 py-2 rounded-xl font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer ${
              isMentor
                ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-900/20'
                : 'bg-success-600 hover:bg-success-500 text-white shadow-success-900/20'
            }`}
          >
            {isMentor ? '💬 相談してみる' : '🤝 相談に乗る (初回+300🪙)'}
          </button>
        )}
      </div>
    </div>
  );
}

