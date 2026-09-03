'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Swords, Trophy, AlertTriangle, ArrowLeft, Flame, Shield, Target, TrendingUp, TrendingDown, Clock } from 'lucide-react';

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

export default function MatchAnalyticsPage() {
  const [data, setData] = useState<MatchAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen bg-[#0d0b14] text-slate-200 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-slate-400">ファイト別アナリティクスを解析中...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0d0b14] text-slate-200 p-8">
        <p>データの読み込みに失敗しました。</p>
      </div>
    );
  }

  const winRate = Math.round((data.victory_fights / data.total_fights) * 100);

  return (
    <div className="min-h-screen bg-[#0d0b14] text-slate-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* ヘッダーナビ */}
        <div className="flex items-center justify-between">
          <Link
            href="/history"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 試合履歴へ戻る
          </Link>
          <div className="text-xs font-mono text-slate-500">
            Sovereign Deep Analytics v2.0
          </div>
        </div>

        {/* 試合サマリーヘッダーカード */}
        <div className="bg-gradient-to-r from-[#181424] via-[#1a162b] to-[#141220] border border-amber-500/30 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md text-xs font-bold uppercase tracking-wider">
                  Match Analytics
                </span>
                <span className="text-slate-400 text-sm flex items-center gap-1.5 font-mono">
                  <Clock className="w-3.5 h-3.5" /> 試合時間: {data.match_duration}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <span>⚔️ {data.champion}</span>
                <span className="text-slate-500 text-lg font-normal">集団戦ディープレビュー</span>
              </h1>
            </div>

            {/* スタッツバッジグリッド */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-black/30 border border-white/10 rounded-xl p-3 text-center min-w-[100px]">
                <div className="text-xs text-slate-400 font-semibold mb-1">集団戦勝率</div>
                <div className="text-xl font-bold text-emerald-400 font-mono">{winRate}%</div>
                <div className="text-[10px] text-slate-500">{data.victory_fights}勝 {data.defeat_fights}敗</div>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-xl p-3 text-center min-w-[100px]">
                <div className="text-xs text-slate-400 font-semibold mb-1">総交戦ダメージ</div>
                <div className="text-xl font-bold text-amber-400 font-mono">{data.total_fight_damage.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500">dmg</div>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-xl p-3 text-center min-w-[100px]">
                <div className="text-xs text-slate-400 font-semibold mb-1">総ファイト数</div>
                <div className="text-xl font-bold text-purple-400 font-mono">{data.total_fights}</div>
                <div className="text-[10px] text-slate-500">回</div>
              </div>
            </div>
          </div>
        </div>

        {/* タイムラインセクション */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-lg">
            <Swords className="w-5 h-5 text-amber-400" />
            <span>集団戦タイムライン ＆ 勝敗要因レビュー</span>
          </div>

          <div className="space-y-4">
            {data.fights.map((fight, idx) => {
              const isVictory = fight.result === 'VICTORY';
              const isDefeat = fight.result === 'DEFEAT';
              const borderCol = isVictory
                ? 'border-emerald-500/40 hover:border-emerald-400'
                : isDefeat
                ? 'border-red-500/40 hover:border-red-400'
                : 'border-amber-500/40 hover:border-amber-400';

              const bgCol = isVictory
                ? 'bg-gradient-to-br from-[#121b16] to-[#0f1416]'
                : isDefeat
                ? 'bg-gradient-to-br from-[#1e1114] to-[#140e11]'
                : 'bg-gradient-to-br from-[#18161c] to-[#121016]';

              return (
                <div
                  key={fight.fight_id}
                  className={`border ${borderCol} ${bgCol} rounded-xl p-5 md:p-6 transition-all duration-200 shadow-lg`}
                >
                  {/* カード上部: タイトル / 勝敗バッジ / 獲得オブジェクト */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center font-mono font-bold text-xs text-slate-300">
                        #{idx + 1}
                      </span>
                      <div>
                        <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                          {fight.title}
                        </h2>
                        <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                          <span>味方 {fight.ally_kills} キル</span>
                          <span>vs</span>
                          <span>敵 {fight.enemy_kills} キル</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* ゴールドスイング */}
                      <div className="flex items-center gap-1 text-xs font-mono font-bold">
                        {fight.gold_swing >= 0 ? (
                          <span className="text-emerald-400 flex items-center gap-0.5 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                            <TrendingUp className="w-3.5 h-3.5" /> +{fight.gold_swing.toLocaleString()}G
                          </span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-0.5 bg-red-500/10 px-2.5 py-1 rounded-md border border-red-500/20">
                            <TrendingDown className="w-3.5 h-3.5" /> {fight.gold_swing.toLocaleString()}G
                          </span>
                        )}
                      </div>

                      {/* 与ダメージ */}
                      <div className="text-xs font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-1 rounded-md flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-purple-400" />
                        {fight.my_damage_dealt.toLocaleString()} dmg
                      </div>

                      {/* 結果バッジ */}
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-md border ${
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

                  {/* カード中央: サマリー ＆ 要因分析 */}
                  <div className="pt-4 space-y-3">
                    <p className="text-sm font-semibold text-slate-200">
                      {fight.summary}
                    </p>

                    <div className="bg-black/30 rounded-lg p-3 border border-white/5 space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <Target className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-300">勝敗要因: </span>
                          <span className="text-slate-400">{fight.key_factor}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Shield className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-sky-300">プレイ評価: </span>
                          <span className="text-slate-300 font-medium">{fight.feedback}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
