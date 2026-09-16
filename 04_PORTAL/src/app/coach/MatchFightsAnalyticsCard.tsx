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
}

export default function MatchFightsAnalyticsCard({
  controlledMatchId,
  onSelectMatchId,
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
      const url = mId === 'all' ? '/api/lol/match-fights?matchId=all' : `/api/lol/match-fights?matchId=${mId}`;
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
  }, [currentMatchId]);

  const handleSelectMatch = (mId: string) => {
    if (onSelectMatchId) {
      onSelectMatchId(mId);
    } else {
      setInternalMatchId(mId);
    }
  };

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

  const winRate = data.total_fights > 0 ? Math.round((data.victory_fights / data.total_fights) * 100) : 0;
  const recentMatches = data.recent_matches || [];

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs text-stone-900 space-y-4">
      {/* 複数試合セレクターバー */}
      {recentMatches.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin border-b border-stone-100">
          <button
            type="button"
            onClick={() => handleSelectMatch('all')}
            disabled={switching}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 ${
              currentMatchId === 'all'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <span>🌟</span>
            <span>全{recentMatches.length}試合 統合集団戦レビュー</span>
          </button>

          {recentMatches.map((m, idx) => {
            const isSelected = currentMatchId === m.matchId;
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
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                }`}
              >
                <span>#{idx + 1}</span>
                <span>{m.championName}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                  isSelected 
                    ? 'bg-stone-700 text-white' 
                    : m.isWin 
                    ? 'bg-emerald-200 text-emerald-900' 
                    : 'bg-rose-200 text-rose-900'
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
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[10px] font-black uppercase tracking-wider">
              {currentMatchId === 'all' ? 'Multi-Match Deep Analytics' : 'Match Deep Analytics'}
            </span>
            <span className="text-stone-500 text-xs font-mono flex items-center gap-1 font-bold">
              <Clock className="w-3.5 h-3.5 text-stone-400" /> {data.match_duration}
            </span>
          </div>
          <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
            <span>⚔️ {data.champion}</span>
            <span className="text-stone-500 text-xs font-bold">集団戦ディープレビュー（全{data.total_fights}戦）</span>
          </h3>
        </div>

        {/* スタッツバッジ */}
        <div className="flex items-center gap-2">
          <div className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-center">
            <div className="text-[10px] text-stone-500 font-bold">集団戦勝率</div>
            <div className="text-sm font-black text-emerald-600 font-mono">{winRate}%</div>
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-center">
            <div className="text-[10px] text-stone-500 font-bold">
              {currentMatchId === 'all' ? '全試合 交戦総火力' : '交戦総火力'}
            </div>
            <div className="text-sm font-black text-amber-700 font-mono">{data.total_fight_damage.toLocaleString()}</div>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition ml-1 cursor-pointer"
            title={isExpanded ? '折りたたむ' : '展開する'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>


      {/* 切替時ローディング */}
      {switching && (
        <div className="flex items-center justify-center py-6 gap-2 text-xs font-bold text-stone-500">
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
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
              ? 'border-emerald-200 bg-emerald-50/40'
              : isDefeat
              ? 'border-rose-200 bg-rose-50/40'
              : 'border-amber-200 bg-amber-50/40';

            return (
              <div
                key={fight.fight_id}
                className={`border ${borderCol} rounded-xl p-4 transition-all space-y-2.5 shadow-2xs`}
              >
                {/* ファイトタイトル ＆ バッジ */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-stone-200/80 rounded-full flex items-center justify-center font-mono font-bold text-[10px] text-stone-700">
                      #{idx + 1}
                    </span>
                    <span className="font-extrabold text-stone-900 text-sm">{fight.title}</span>
                    <span className="text-stone-500 font-mono text-[11px] font-bold">
                      (味方{fight.ally_kills}K vs 敵{fight.enemy_kills}D)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* ゴールド変動 */}
                    {fight.gold_swing >= 0 ? (
                      <span className="text-emerald-700 font-mono font-bold text-[11px] flex items-center gap-0.5 bg-emerald-100/80 px-2.5 py-0.5 rounded-md border border-emerald-200">
                        <TrendingUp className="w-3 h-3" /> +{fight.gold_swing}G
                      </span>
                    ) : (
                      <span className="text-rose-700 font-mono font-bold text-[11px] flex items-center gap-0.5 bg-rose-100/80 px-2.5 py-0.5 rounded-md border border-rose-200">
                        <TrendingDown className="w-3 h-3" /> {fight.gold_swing}G
                      </span>
                    )}

                    {/* 与ダメージ */}
                    <span className="text-purple-800 font-mono font-bold text-[11px] bg-purple-100/80 px-2.5 py-0.5 rounded-md border border-purple-200 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-purple-600" />
                      {fight.my_damage_dealt.toLocaleString()} dmg
                    </span>

                    {/* 勝敗バッジ */}
                    <span
                      className={`font-black px-2.5 py-0.5 rounded-md text-[11px] border ${
                        isVictory
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : isDefeat
                          ? 'bg-rose-600 text-white border-rose-700'
                          : 'bg-amber-500 text-white border-amber-600'
                      }`}
                    >
                      {fight.result_badge}
                    </span>
                  </div>
                </div>

                {/* サマリー ＆ 要因 */}
                <p className="text-xs text-stone-800 leading-relaxed font-bold">
                  {fight.summary}
                </p>

                <div className="bg-white/90 rounded-xl p-3 border border-stone-200/80 space-y-1.5 text-[11px] shadow-2xs">
                  <div className="flex items-start gap-1.5">
                    <Target className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-stone-800">勝敗要因: </span>
                      <span className="text-stone-600 font-medium">{fight.key_factor}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-indigo-700">プレイ評価: </span>
                      <span className="text-stone-700 font-medium">{fight.feedback}</span>
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

