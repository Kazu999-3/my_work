'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  HeartHandshake, 
  Target, 
  Edit3, 
  Save, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  MessageSquare
} from 'lucide-react';

interface MentorshipProgressCardProps {
  discordId?: string | null;
  playerName: string;
  isCurrentUser: boolean;
}

// ランクのTier順位スコアリング（進捗率計算用）
const TIER_ORDER: Record<string, number> = {
  'IRON': 0,
  'BRONZE': 4,
  'SILVER': 8,
  'GOLD': 12,
  'PLATINUM': 16,
  'EMERALD': 20,
  'DIAMOND': 24,
  'MASTER': 28,
  'GRANDMASTER': 29,
  'CHALLENGER': 30
};

const DIVISION_MAP: Record<string, number> = {
  'IV': 0, '4': 0,
  'III': 1, '3': 1,
  'II': 2, '2': 2,
  'I': 3, '1': 3
};

function getRankScore(rankStr?: string): number {
  if (!rankStr) return 8; // デフォルトSILVER
  const clean = rankStr.toUpperCase().trim();
  for (const [tier, score] of Object.entries(TIER_ORDER)) {
    if (clean.includes(tier)) {
      let divScore = 0;
      for (const [div, dVal] of Object.entries(DIVISION_MAP)) {
        if (clean.includes(div)) {
          divScore = dVal;
          break;
        }
      }
      return score + divScore;
    }
  }
  return 8;
}

export default function MentorshipProgressCard({
  discordId,
  playerName,
  isCurrentUser,
}: MentorshipProgressCardProps) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editTargetRank, setEditTargetRank] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [creatingThreadMatchId, setCreatingThreadMatchId] = useState<string | null>(null);

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
        window.open(data.threadUrl, '_blank');
        setMatches((prev) =>
          prev.map((m) =>
            m.id === matchId
              ? { ...m, meta: { ...m.meta, threadUrl: data.threadUrl } }
              : m
          )
        );
      } else {
        alert(data.error || 'スレッド作成に失敗しました');
      }
    } catch {
      alert('通信エラーが発生しました');
    } finally {
      setCreatingThreadMatchId(null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchMatches = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/mentorship/matches');
        const data = await res.json();
        if (isMounted && data.ok && Array.isArray(data.matches)) {
          // 本人または対象ユーザーが関わっているアクティブなマッチを抽出
          const userMatches = data.matches.filter((m: any) => {
            const isMentor = (discordId && m.mentor_discord_id === discordId) || (m.mentor?.player_name === playerName);
            const isPupil = (discordId && m.pupil_discord_id === discordId) || (m.pupil?.player_name === playerName);
            return (isMentor || isPupil) && m.status === 'ACTIVE';
          });
          setMatches(userMatches);
        }
      } catch (err) {
        console.warn('[MentorshipProgressCard] fetch error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMatches();
    return () => {
      isMounted = false;
    };
  }, [discordId, playerName]);

  const handleStartEdit = (match: any) => {
    setEditingMatchId(match.id);
    setEditNotes(match.meta?.progressNotes || '');
    setEditTargetRank(match.meta?.targetRank || match.pupil?.target_rank || 'GOLD IV');
  };

  const handleSaveProgress = async (matchId: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/mentorship/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_PROGRESS',
          matchId,
          progressNotes: editNotes,
          targetRank: editTargetRank,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMatches((prev) =>
          prev.map((m) =>
            m.id === matchId
              ? {
                  ...m,
                  meta: {
                    ...m.meta,
                    progressNotes: editNotes,
                    targetRank: editTargetRank,
                  },
                }
              : m
          )
        );
        setEditingMatchId(null);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(data.error || '更新に失敗しました');
      }
    } catch {
      alert('通信エラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return null;
  }

  // 師弟関係がない場合（本人のみ案内バナーを表示）
  if (matches.length === 0) {
    if (!isCurrentUser) return null;
    return (
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/30 rounded-3xl p-5 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm md:text-base text-stone-900 dark:text-stone-100">
                  師弟ハブで共闘パートナーを探しませんか？
                </span>
                <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  募集中
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                目標ランク到達に向けた1対1のコーチングや、気軽にデュオ・反省会ができる師匠・弟子とマッチングできます。
              </p>
            </div>
          </div>
          <Link
            href="/mentorship"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-sm hover:scale-105 shrink-0"
          >
            <span>師弟掲示板を見る</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {saveSuccess && (
        <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>指導メモ・目標ランクの進捗を更新しました！</span>
        </div>
      )}

      {matches.map((match) => {
        const isUserMentor = (discordId && match.mentor_discord_id === discordId) || (match.mentor?.player_name === playerName);
        const partner = isUserMentor ? match.pupil : match.mentor;
        const partnerRole = isUserMentor ? '弟子' : '師匠';

        const pupilCurrentRank = match.pupil?.current_rank || 'SILVER IV';
        const targetRank = match.meta?.targetRank || match.pupil?.target_rank || 'GOLD IV';

        // ランク進捗計算
        const currentScore = getRankScore(pupilCurrentRank);
        const targetScore = getRankScore(targetRank);
        const minScore = Math.max(0, currentScore - 4);
        const maxScore = Math.max(targetScore, currentScore + 1);
        const progressPct = Math.min(100, Math.max(10, Math.round(((currentScore - minScore) / (maxScore - minScore)) * 100)));
        const diffDivisions = Math.max(0, targetScore - currentScore);

        const isEditing = editingMatchId === match.id;

        return (
          <div
            key={match.id}
            className="bg-white dark:bg-[#202225] border border-stone-200 dark:border-stone-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-5"
          >
            {/* ヘッダー: 役職 ＆ パートナー情報 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {isUserMentor ? '👑 師匠として指導中' : '🌱 弟子として修行中'}
                    </span>
                    <span className="text-xs text-stone-400 dark:text-stone-500 font-bold">
                      {match.meta?.durationLabel || '2週間育成コース'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-stone-500 dark:text-stone-400">パートナー ({partnerRole}):</span>
                    <span className="text-sm font-black text-stone-900 dark:text-stone-100">
                      {partner?.player_name || 'メンバー'}
                    </span>
                    {partner?.current_rank && (
                      <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 ml-1 px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800">
                        {partner.current_rank}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 期間カウントダウン & 専用チャットボタン */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-stone-500 dark:text-stone-400 self-end sm:self-center">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  <span>
                    残り <strong className="text-emerald-600 dark:text-emerald-400">{Math.max(0, match.remainingDays || 0)}</strong> 日
                  </span>
                </div>

                {match.meta?.threadUrl ? (
                  <a
                    href={match.meta.threadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs transition cursor-pointer"
                    title="Discordの専用指導スレッド（🎓コーチング・質問）を開く"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>専用チャット</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCreateThread(match.id)}
                    disabled={creatingThreadMatchId === match.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer disabled:opacity-50"
                    title="Discord (🎓コーチング・質問) に専用指導チャットを作成"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{creatingThreadMatchId === match.id ? '作成中...' : 'チャット作成'}</span>
                  </button>
                )}

                <Link
                  href="/mentorship"
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-bold"
                >
                  掲示板 ➔
                </Link>
              </div>
            </div>

            {/* 目標ランク進捗バー */}
            <div className="bg-stone-50 dark:bg-stone-900/50 border border-stone-200/80 dark:border-stone-800/80 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-extrabold text-stone-800 dark:text-stone-200">
                  <Target className="w-4 h-4 text-rose-500" />
                  <span>目標ランクへの成長ステップ</span>
                </div>
                <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                  {diffDivisions === 0 ? (
                    <span className="flex items-center gap-1 text-emerald-500">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      目標ランク達成！🎉
                    </span>
                  ) : (
                    <span>目標まであと {diffDivisions} ディビジョン 🔥</span>
                  )}
                </div>
              </div>

              {/* 進捗ゲージ */}
              <div className="space-y-1.5">
                <div className="w-full bg-stone-200 dark:bg-stone-800 h-3 rounded-full overflow-hidden p-0.5 border border-stone-300 dark:border-stone-700/60">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-bold text-stone-500 dark:text-stone-400 px-0.5">
                  <span>現在: {pupilCurrentRank}</span>
                  <span className="text-amber-600 dark:text-amber-400 font-extrabold">
                    🎯 目標: {targetRank}
                  </span>
                </div>
              </div>
            </div>

            {/* 指導メモ ＆ 反省ノート */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-stone-800 dark:text-stone-200">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                  <span>指導メモ ＆ 今週の練習テーマ</span>
                </div>
                {isCurrentUser && !isEditing && (
                  <button
                    type="button"
                    onClick={() => handleStartEdit(match)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>メモを編集</span>
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3 bg-stone-50 dark:bg-stone-900/60 p-3.5 rounded-2xl border border-amber-500/30">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1">
                      目標ランク
                    </label>
                    <input
                      type="text"
                      value={editTargetRank}
                      onChange={(e) => setEditTargetRank(e.target.value)}
                      placeholder="例: GOLD IV, EMERALD IV"
                      className="w-full text-xs font-bold px-3 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1">
                      指導メモ / 今週のフォーカス / 気付き
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      placeholder="例: Lv3ガンク合わせのショートトレード意識。2デスしたらウェーブをフリーズしてJGを待つ。"
                      className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingMatchId(null)}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800 transition cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveProgress(match.id)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black transition shadow-sm cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? '保存中...' : '保存する'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-stone-50 dark:bg-stone-900/30 border border-stone-200/60 dark:border-stone-800/60 rounded-2xl p-3.5 text-xs text-stone-700 dark:text-stone-300 leading-relaxed min-h-[48px] flex items-center">
                  {match.meta?.progressNotes ? (
                    <p className="whitespace-pre-wrap">{match.meta.progressNotes}</p>
                  ) : (
                    <p className="text-stone-400 dark:text-stone-500 italic text-[11px]">
                      まだ指導メモは登録されていません。「メモを編集」から今週の目標や反省を記録しましょう。
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
