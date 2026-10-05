'use client';

import { useState } from 'react';
import { Swords, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

// 集団戦レビュー（2026-10-05 見直し）。タイムラインに記録された事実だけを表示する。
// 旧版の推定ダメージ・ゴールド変動・原因を断定する定型文は根拠が無いため削除した（API側コメント参照）。
// 2026-10-06: データは詳細分析(postgame-deep-analytics)が同じ試合詳細・タイムラインから計算して渡す。
// 以前はこの部品が /api/lol/match-fights を別に呼び、Riot API の回数制限(2分100回)を余計に消費していた。

interface FightData {
  fight_id: number;
  time_str: string;
  result: 'WON' | 'LOST' | 'EVEN';
  ally_kills: number;
  enemy_kills: number;
  ally_objectives: string[];
  enemy_objectives: string[];
  involved: boolean;
  my_kills: number;
  my_assists: number;
  my_died: boolean;
}

export interface FightsData {
  champion: string;
  fights: FightData[];
  won: number;
  lost: number;
  even: number;
}

interface MatchFightsAnalyticsCardProps {
  data: FightsData | null;
  rules: { fight_gap_sec: number; objective_attach_sec: number };
  /** data が無い時に表示する理由（タイムライン取得失敗など） */
  error?: string | null;
}

const RESULT_STYLE = {
  WON: { label: '優勢', box: 'border-emerald-800/60 bg-emerald-950/30', badge: 'bg-emerald-600' },
  LOST: { label: '劣勢', box: 'border-rose-800/60 bg-rose-950/30', badge: 'bg-rose-600' },
  EVEN: { label: '互角', box: 'border-stone-700/60 bg-stone-900/60', badge: 'bg-stone-600' },
} as const;

export default function MatchFightsAnalyticsCard({ data: raw, rules, error }: MatchFightsAnalyticsCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!raw) {
    return (
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-4 flex items-center gap-2 text-xs text-stone-400">
        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
        <span>集団戦レビュー: {error || 'データがありません'}</span>
      </div>
    );
  }
  const data = {
    champion: raw.champion,
    fights: raw.fights,
    total_fights: raw.fights.length,
    won_fights: raw.won,
    lost_fights: raw.lost,
    even_fights: raw.even,
    involved_fights: raw.fights.filter((f) => f.involved).length,
    rules,
  };

  return (
    <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-5 text-stone-100 space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-stone-800 pb-3 flex-wrap">
        <h3 className="text-base font-extrabold text-stone-100 flex items-center gap-2">
          <Swords className="w-4 h-4 text-amber-400" />
          <span>集団戦レビュー</span>
          <span className="text-stone-400 text-xs font-bold">{data.champion}・{data.total_fights}件</span>
        </h3>
        <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono font-bold">
          <span className="px-2 py-1 rounded-lg bg-stone-950 border border-stone-800">
            <span className="text-emerald-400">優勢{data.won_fights}</span>
            <span className="text-stone-500"> / </span>
            <span className="text-rose-400">劣勢{data.lost_fights}</span>
            <span className="text-stone-500"> / </span>
            <span className="text-stone-300">互角{data.even_fights}</span>
          </span>
          <span className="px-2 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-300">
            自分が関与 {data.involved_fights}/{data.total_fights}
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 transition cursor-pointer"
            title={isExpanded ? '折りたたむ' : '展開する'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {data.fights.length === 0 ? (
            <p className="text-xs text-stone-400">この試合には条件に合う交戦がありませんでした。</p>
          ) : (
            <div className="space-y-2">
              {data.fights.map((f) => {
                const st = RESULT_STYLE[f.result];
                const myParts = [
                  f.my_kills > 0 && `${f.my_kills}キル`,
                  f.my_assists > 0 && `${f.my_assists}アシスト`,
                  f.my_died && 'デス',
                ].filter(Boolean);
                return (
                  <div key={f.fight_id} className={`border ${st.box} rounded-xl p-3 space-y-1.5`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-stone-100">{f.time_str}</span>
                        <span className="font-mono text-[11px] text-stone-300">
                          味方 <span className="text-emerald-400 font-bold">{f.ally_kills}</span> キル / 敵 <span className="text-rose-400 font-bold">{f.enemy_kills}</span> キル
                        </span>
                      </div>
                      <span className={`font-black px-2 py-0.5 rounded-md text-[11px] text-white ${st.badge}`}>{st.label}</span>
                    </div>
                    {(f.ally_objectives.length > 0 || f.enemy_objectives.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                        {f.ally_objectives.map((o) => (
                          <span key={`a-${o}`} className="px-1.5 py-0.5 rounded bg-emerald-950/30 text-emerald-400 border border-emerald-800/60">味方獲得: {o}</span>
                        ))}
                        {f.enemy_objectives.map((o) => (
                          <span key={`e-${o}`} className="px-1.5 py-0.5 rounded bg-rose-950/30 text-rose-400 border border-rose-800/60">敵獲得: {o}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-stone-400">
                      自分: {f.involved ? myParts.join('・') : '関与なし'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-stone-500">
            キル同士の間隔が{data.rules.fight_gap_sec}秒以内なら同じ交戦、前後{data.rules.objective_attach_sec}秒以内のドラゴン・バロン等はその交戦に含めています。
            優勢/劣勢はキル差（同数ならオブジェクト数）で判定。2キル以上・オブジェクト絡み・自分が関与した交戦のみ表示。
          </p>
        </>
      )}
    </div>
  );
}
