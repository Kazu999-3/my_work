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

interface RecentMatchItem {
  matchId: string;
  championName: string;
  isWin: boolean;
  kdaStr: string;
  damage: number;
  gameDurationStr: string;
  gameStartTimestamp: number;
}

interface MatchAnalyticsResponse {
  success: boolean;
  selected_match_id?: string;
  recent_matches?: RecentMatchItem[];
  champion: string;
  match_duration: string;
  total_fights: number;
  victory_fights: number;
  defeat_fights: number;
  total_fight_damage: number;
  fights: FightData[];
}

interface MatchFightsAnalyticsCardProps {
  controlledMatchId?: string;
  onSelectMatchId?: (mId: string) => void;
  summonerName?: string;
  puuid?: string;
}

export default function MatchFightsAnalyticsCard({
  controlledMatchId,
  onSelectMatchId,
  summonerName,
  puuid,
}: MatchFightsAnalyticsCardProps = {}) {
  const [data, setData] = useState<MatchAnalyticsResponse | null>(null);
  const [internalMatchId, setInternalMatchId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const currentMatchId = controlledMatchId !== undefined ? controlledMatchId : internalMatchId;

  const fetchFights = async (mId: string) => {
    try {
      setSwitching(true);
      const params = new URLSearchParams();
      params.set('matchId', mId || 'all');
      if (summonerName) params.set('summoner', summonerName);
      if (puuid) params.set('puuid', puuid);

      const url = `/api/lol/match-fights?${params.toString()}`;
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setSwitching(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFights(currentMatchId || 'all');
  }, [currentMatchId, summonerName, puuid]);

  const handleSelectMatch = (mId: string) => {
    if (onSelectMatchId) {
      onSelectMatchId(mId);
    } else {
      setInternalMatchId(mId);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <div className="w-4 h-4 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          <span>最新の集団戦ディープアナリティクスを読み込み中...</span>
        </div>
      </div>
    );
  }

  if (!data || !data.fights || data.fights.length === 0) {
    return null;
  }

  const winRate = data.total_fights > 0 ? Math.round((data.victory_fights / data.total_fights) * 100) : 0;
  const recentMatches = data.recent_matches || [];

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xs text-slate-100 space-y-4">
      {/* 複数試合セレクターバー */}
      {recentMatches.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin border-b border-stone-100">
          {recentMatches.map((m, idx) => {
            const isSelected = currentMatchId === m.matchId || (!currentMatchId && idx === 0);
            return (
              <button
                key={m.matchId}
                type="button"
                onClick={() => handleSelectMatch(m.matchId)}
                disabled={switching}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                  isSelected
                    ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                    : m.isWin
                    ? 'bg-emerald-950/30 text-emerald-300 border-emerald-800/60 hover:bg-emerald-950/30'
                    : 'bg-rose-950/30 text-rose-300 border-rose-800/60 hover:bg-rose-950/30'
                }`}
              >
                <span>#{idx + 1}</span>
                <span>{m.championName}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                  isSelected 
                    ? 'bg-stone-700 text-white' 
                    : m.isWin 
                    ? 'bg-emerald-950/30 text-emerald-300' 
                    : 'bg-rose-950/30 text-rose-300'
                }`}>
                  {m.isWin ? 'WIN' : 'LOSE'}
                </span>
                <span className="font-mono text-[11px] opacity-80">{m.kdaStr}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ヘッダー行 */}
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-amber-950/30 text-amber-300 border border-amber-800/60 rounded-md text-[10px] font-black uppercase tracking-wider">
              Fight Review
            </span>
            <span className="text-slate-400 text-xs font-mono flex items-center gap-1 font-bold">
              <Clock className="w-3.5 h-3.5 text-slate-500" /> {data.match_duration}
            </span>
          </div>
          <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
            <span>⚔️ {data.champion}</span>
            <span className="text-slate-400 text-xs font-bold">集団戦ディープレビュー（全{data.total_fights}戦）</span>
          </h3>
        </div>

        {/* スタッツバッジ */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-center">
            <div className="text-[10px] text-slate-400 font-bold">集団戦勝率</div>
            <div className="text-sm font-black text-emerald-400 font-mono">{winRate}%</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-center">
            <div className="text-[10px] text-slate-400 font-bold">交戦総火力</div>
            <div className="text-sm font-black text-amber-300 font-mono">{data.total_fight_damage.toLocaleString()}</div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 transition ml-1 cursor-pointer"
            title={isExpanded ? '折りたたむ' : '展開する'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>


      {/* 切替時ローディング */}
      {switching && (
        <div className="flex items-center justify-center py-6 gap-2 text-xs font-bold text-slate-400">
          <div className="w-4 h-4 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          <span>試合データを解析中...</span>
        </div>
      )}

      {/* ファイト一覧（展開時） */}
      {!switching && isExpanded && (
        <div className="space-y-3">
          {data.fights.map((fight, idx) => {
            const isVictory = fight.result === 'VICTORY';
            const isDefeat = fight.result === 'DEFEAT';
            const borderCol = isVictory
              ? 'border-emerald-800/60 bg-emerald-950/30'
              : isDefeat
              ? 'border-rose-800/60 bg-rose-950/30'
              : 'border-amber-800/60 bg-amber-950/30';

            return (
              <div
                key={fight.fight_id}
                className={`border ${borderCol} rounded-xl p-4 transition-all space-y-2.5 shadow-2xs`}
              >
                {/* ファイトタイトル ＆ バッジ */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center font-mono font-bold text-[10px] text-slate-300">
                      #{idx + 1}
                    </span>
                    <span className="font-extrabold text-slate-100 text-sm">{fight.title}</span>
                    <span className="text-slate-400 font-mono text-[11px] font-bold">
                      (味方{fight.ally_kills}K vs 敵{fight.enemy_kills}D)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* ゴールド変動 */}
                    {fight.gold_swing >= 0 ? (
                      <span className="text-emerald-300 font-mono font-bold text-[11px] flex items-center gap-0.5 bg-emerald-950/30 px-2.5 py-0.5 rounded-md border border-emerald-800/60">
                        <TrendingUp className="w-3 h-3" /> +{fight.gold_swing}G
                      </span>
                    ) : (
                      <span className="text-rose-300 font-mono font-bold text-[11px] flex items-center gap-0.5 bg-rose-950/30 px-2.5 py-0.5 rounded-md border border-rose-800/60">
                        <TrendingDown className="w-3 h-3" /> {fight.gold_swing}G
                      </span>
                    )}

                    {/* 与ダメージ */}
                    <span className="text-amber-300 font-mono font-bold text-[11px] bg-amber-950/30 px-2.5 py-0.5 rounded-md border border-amber-800/60 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-400" />
                      {fight.my_damage_dealt.toLocaleString()} dmg
                    </span>

                    {/* 勝敗バッジ */}
                    <span
                      className={`font-black px-2.5 py-0.5 rounded-md text-[11px] border ${
                        isVictory
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : isDefeat
                          ? 'bg-rose-600 text-white border-rose-700'
                          : 'bg-amber-500 text-white border-amber-700'
                      }`}
                    >
                      {fight.result_badge}
                    </span>
                  </div>
                </div>

                {/* サマリー ＆ 要因 */}
                <p className="text-xs text-slate-200 leading-relaxed font-bold">
                  {fight.summary}
                </p>

                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 space-y-1.5 text-[11px] shadow-2xs">
                  <div className="flex items-start gap-1.5">
                    <Target className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-slate-200">勝敗要因: </span>
                      <span className="text-slate-400 font-medium">{fight.key_factor}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-amber-300">プレイ評価: </span>
                      <span className="text-slate-300 font-medium">{fight.feedback}</span>
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

