'use client';

import { useEffect, useState } from 'react';
import { Swords, Trophy, Flame, Shield, Target, TrendingUp, TrendingDown, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface FightData {
  fight_id: number;
  time_str: string;
  title: string;
  result: string;
  result_badge: string;
  ally_kills: number;
  enemy_kills: number;
  objectives: string[];
  my_damage_dealt: number;
  gold_swing: number;
  summary: string;
  key_factor: string;
  feedback: string;
}

interface MatchAnalyticsResponse {
  success: boolean;
  champion: string;
  match_duration: string;
  total_fights: number;
  victory_fights: number;
  defeat_fights: number;
  total_fight_damage: number;
  fights: FightData[];
}

export default function MatchFightsAnalyticsCard() {
  const [data, setData] = useState<MatchAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    fetch('/api/lol/match-fights')
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-stone-500">
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>最新の集団戦ディープアナリティクスを読み込み中...</span>
        </div>
      </div>
    );
  }

  if (!data || !data.fights || data.fights.length === 0) {
    return null;
  }

  const winRate = Math.round((data.victory_fights / data.total_fights) * 100);

  return (
    <div className="bg-gradient-to-br from-[#181424] via-[#1a162b] to-[#12101c] border border-amber-500/40 rounded-2xl p-5 md:p-6 shadow-lg text-slate-100 relative overflow-hidden space-y-5">
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* ヘッダー行 */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[10px] font-bold uppercase tracking-wider">
              Deep Analytics
            </span>
            <span className="text-slate-400 text-xs font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" /> {data.match_duration}
            </span>
          </div>
          <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
            <span>⚔️ {data.champion}</span>
            <span className="text-slate-400 text-sm font-normal">集団戦ディープレビュー（全{data.total_fights}戦）</span>
          </h3>
        </div>

        {/* スタッツバッジ */}
        <div className="flex items-center gap-2">
          <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-center">
            <div className="text-[10px] text-slate-400 font-bold">勝率</div>
            <div className="text-sm font-extrabold text-emerald-400 font-mono">{winRate}%</div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-center">
            <div className="text-[10px] text-slate-400 font-bold">交戦火力</div>
            <div className="text-sm font-extrabold text-amber-400 font-mono">{data.total_fight_damage.toLocaleString()}</div>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition ml-1"
            title={isExpanded ? '折りたたむ' : '展開する'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ファイト一覧（展開時） */}
      {isExpanded && (
        <div className="space-y-3 relative z-10">
          {data.fights.map((fight, idx) => {
            const isVictory = fight.result === 'VICTORY';
            const isDefeat = fight.result === 'DEFEAT';
            const borderCol = isVictory
              ? 'border-emerald-500/30 bg-emerald-950/20'
              : isDefeat
              ? 'border-red-500/30 bg-red-950/20'
              : 'border-amber-500/30 bg-amber-950/20';

            return (
              <div
                key={fight.fight_id}
                className={`border ${borderCol} rounded-xl p-4 transition-all duration-150 space-y-2.5`}
              >
                {/* ファイトタイトル ＆ バッジ */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center font-mono font-bold text-[10px] text-slate-300">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-white text-sm">{fight.title}</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      ({fight.ally_kills}K vs {fight.enemy_kills}D)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* ゴールド変動 */}
                    {fight.gold_swing >= 0 ? (
                      <span className="text-emerald-400 font-mono font-bold text-[11px] flex items-center gap-0.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <TrendingUp className="w-3 h-3" /> +{fight.gold_swing}G
                      </span>
                    ) : (
                      <span className="text-red-400 font-mono font-bold text-[11px] flex items-center gap-0.5 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                        <TrendingDown className="w-3 h-3" /> {fight.gold_swing}G
                      </span>
                    )}

                    {/* 与ダメージ */}
                    <span className="text-purple-300 font-mono font-bold text-[11px] bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-purple-400" />
                      {fight.my_damage_dealt.toLocaleString()} dmg
                    </span>

                    {/* 勝敗バッジ */}
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] border ${
                        isVictory
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : isDefeat
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {fight.result_badge}
                    </span>
                  </div>
                </div>

                {/* サマリー ＆ 要因 */}
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {fight.summary}
                </p>

                <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-1.5">
                    <Target className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-300">勝敗要因: </span>
                      <span className="text-slate-400">{fight.key_factor}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sky-300">プレイ評価: </span>
                      <span className="text-slate-300">{fight.feedback}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
