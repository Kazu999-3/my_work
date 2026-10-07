'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Zap, Shield, Sparkles, AlertTriangle, CheckCircle2, Swords, Eye, Compass, Target, Clock, BookOpen
} from 'lucide-react';
import { getChampIcon } from '@/lib/ddragonClient';
import EarlyJunglePathingCard from './EarlyJunglePathingCard';

interface Phase {
  phase: string;
  title: string;
  action: string;
  win_trigger: string;
  badge: string;
}

interface RejectedIntel {
  weaknesses: string | null;
  counter_champions: string | null;
  is_enemy_counter: boolean;
  matchup_memo: string | null;
  source_patch: string | null;
  confidence: string | null;
}

interface BlueprintResponse {
  success: boolean;
  my_champion: string;
  enemy_champion: string;
  jungle_clear?: { my: number | null; enemy: number | null };
  blueprint: {
    phases: Phase[];
    phases_are_generic?: boolean;
  };
  rejected_intel?: RejectedIntel;
}

export default function MatchupBlueprintCard({
  myChampion: initialMyChampion = 'JarvanIV',
  enemyChampion: initialEnemyChampion = 'LeeSin',
  onMyChampionChange,
  onEnemyChampionChange,
}: {
  myChampion?: string;
  enemyChampion?: string;
  onMyChampionChange?: (champ: string) => void;
  onEnemyChampionChange?: (champ: string) => void;
}) {
  const [myChamp, setMyChamp] = useState(initialMyChampion);
  const [enemyChamp, setEnemyChamp] = useState(initialEnemyChampion);
  const [data, setData] = useState<BlueprintResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialMyChampion) setMyChamp(initialMyChampion);
  }, [initialMyChampion]);

  useEffect(() => {
    if (initialEnemyChampion) setEnemyChamp(initialEnemyChampion);
  }, [initialEnemyChampion]);

  const handleMyChange = (val: string) => {
    setMyChamp(val);
    if (onMyChampionChange) onMyChampionChange(val);
  };

  const handleEnemyChange = (val: string) => {
    setEnemyChamp(val);
    if (onEnemyChampionChange) onEnemyChampionChange(val);
  };

  useEffect(() => {
    if (!enemyChamp) return;
    setLoading(true);
    fetch(`/api/lol/matchup-blueprint?my=${encodeURIComponent(myChamp)}&enemy=${encodeURIComponent(enemyChamp)}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [myChamp, enemyChamp]);

  if (loading && !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-pulse space-y-4">
        <div className="h-6 bg-slate-800 rounded w-1/3"></div>
        <div className="h-20 bg-slate-950 rounded-xl"></div>
        <div className="h-32 bg-slate-950 rounded-xl"></div>
      </div>
    );
  }

  const blueprint: { phases: Phase[]; phases_are_generic?: boolean } = data?.blueprint || { phases: [] };
  const rejected = data?.rejected_intel;

  return (
    <div className="space-y-6">
      
      {/* 1. 対面セレクター ＆ キルライン判定バナー */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-center sm:justify-start">
            {/* 自分 */}
            <div className="flex items-center gap-2">
              <img
                src={getChampIcon(myChamp)}
                alt={myChamp}
                className="w-10 h-10 rounded-xl object-cover border-2 border-indigo-500 shadow"
              />
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">自チャンプ</span>
                  {myChamp && (
                    <Link
                      href={`/?c=${encodeURIComponent(myChamp)}`}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5"
                      title={`${myChamp}の辞典を開く`}
                    >
                      👑 辞典
                    </Link>
                  )}
                </div>
                <input
                  type="text"
                  value={myChamp}
                  onChange={(e) => handleMyChange(e.target.value)}
                  placeholder="自チャンピオン"
                  className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-bold text-indigo-300 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="text-slate-600 font-black text-lg px-1">VS</div>

            {/* 敵 */}
            <div className="flex items-center gap-2">
              <img
                src={getChampIcon(enemyChamp)}
                alt={enemyChamp}
                className="w-10 h-10 rounded-xl object-cover border-2 border-rose-500 shadow"
              />
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">対面相手</span>
                  {enemyChamp && (
                    <Link
                      href={`/?c=${encodeURIComponent(enemyChamp)}`}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5"
                      title={`${enemyChamp}の辞典を開く`}
                    >
                      👑 辞典
                    </Link>
                  )}
                </div>
                <input
                  type="text"
                  value={enemyChamp}
                  onChange={(e) => handleEnemyChange(e.target.value)}
                  placeholder="敵チャンピオン"
                  className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-bold text-rose-300 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {myChamp && enemyChamp && (
              <Link
                href={`/?c=${encodeURIComponent(myChamp)}&enemy=${encodeURIComponent(enemyChamp)}`}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold transition"
                title="チャンピオン辞典でこの対面のスキル詳細・直接比較を開く"
              >
                <BookOpen size={14} />
                <span>👑 辞典でVS直接比較</span>
              </Link>
            )}

          </div>
        </div>

      </div>

      {/* 2. 3段階フェーズ別 戦術手順書 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              ⚔️ 3段階レーン戦術手順書（{enemyChamp} 対策）
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            {blueprint.phases_are_generic ? '一般的な流れ（この対面専用の手順は未登録）' : '時系列アクション'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {blueprint.phases.map((p, idx) => (
            <div
              key={p.phase}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 hover:border-indigo-800/60 transition-colors flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-900/40">
                    {p.phase}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {p.badge}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white leading-snug">{p.title}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">{p.action}</p>
              </div>

              <div className="pt-2 border-t border-slate-900 text-[10px] text-emerald-400 font-medium flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span><strong>成功基準:</strong> {p.win_trigger}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 初動ジャングルルート予測 */}
      <EarlyJunglePathingCard myChampion={myChamp} enemyChampion={enemyChamp} myFastestClearSec={data?.jungle_clear?.my ?? null} enemyFastestClearSec={data?.jungle_clear?.enemy ?? null} />

      {/* 4. 実戦の罠・没理由・苦手な相手（champion_facts連動） */}
      {rejected && (rejected.weaknesses || rejected.counter_champions || rejected.matchup_memo) && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <Shield className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-black text-white tracking-wide">
              🛡️ 実戦の罠・自陣弱み ＆ 対面特化メモ
            </h3>
            {rejected.source_patch && (
              <span className="text-[10px] font-mono text-slate-500 ml-auto">
                Patch {rejected.source_patch}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {rejected.weaknesses && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="font-bold text-amber-400 flex items-center gap-1.5 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" /> {myChamp} の主な弱み・隙
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed whitespace-pre-wrap">
                  {rejected.weaknesses}
                </p>
              </div>
            )}

            {rejected.counter_champions && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="font-bold text-rose-400 flex items-center gap-1.5 text-[11px]">
                  <Target className="w-3.5 h-3.5" /> 苦手なカウンターチャンピオン
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {rejected.counter_champions}
                </p>
                {rejected.is_enemy_counter && (
                  <div className="mt-2 p-2 rounded bg-rose-950/80 border border-rose-800 text-rose-200 text-[10px] font-bold">
                    ⚠️ 警戒: 対面の {enemyChamp} は相性的に不利な相手として登録されています！
                  </div>
                )}
              </div>
            )}
          </div>

          {rejected.matchup_memo && (
            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/60 space-y-1 text-xs">
              <span className="font-bold text-indigo-300 flex items-center gap-1.5 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                対面特化メモ（Matchup Sentinel SSoT）
              </span>
              <p className="text-slate-200 text-[11px] leading-relaxed whitespace-pre-wrap">
                {rejected.matchup_memo}
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
