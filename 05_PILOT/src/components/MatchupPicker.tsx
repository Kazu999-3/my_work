'use client';

import React, { useState, useMemo } from 'react';
import { Shield, AlertTriangle, Zap, CheckCircle2, XCircle, HelpCircle, ArrowRight, Swords } from 'lucide-react';
import { JG_MATCHUP_PROFILES, EnemyJgProfile, MatchupAdvice } from '../data/jg_matchups';

interface MatchupPickerProps {
  onSelectMyChampion: (champId: string) => void;
  favorites: string[];
}

export const MatchupPicker: React.FC<MatchupPickerProps> = ({
  onSelectMyChampion,
  favorites,
}) => {
  const [selectedEnemyId, setSelectedEnemyId] = useState<string>('LeeSin');

  const enemyProfile: EnemyJgProfile | undefined = JG_MATCHUP_PROFILES[selectedEnemyId];

  // 全JGリスト
  const enemyList = useMemo(() => {
    return Object.values(JG_MATCHUP_PROFILES);
  }, []);

  // おすすめピックを評価順（有利 ➔ 五分 ➔ 不利）にソート。お気に入りに入っているキャラは優先
  const sortedAdvice = useMemo(() => {
    if (!enemyProfile) return [];
    return [...enemyProfile.adviceList].sort((a, b) => {
      const isFavA = favorites.includes(a.myChampId) ? 1 : 0;
      const isFavB = favorites.includes(b.myChampId) ? 1 : 0;
      if (isFavA !== isFavB) return isFavB - isFavA; // お気に入りを先頭へ

      const scoreMap: Record<string, number> = { favored: 2, even: 1, unfavored: 0 };
      return scoreMap[b.rating] - scoreMap[a.rating];
    });
  }, [enemyProfile, favorites]);

  const getDangerBadge = (danger: 'S' | 'A' | 'B' | 'C') => {
    switch (danger) {
      case 'S':
        return <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[11px] font-black">危険度 S (初動超凶暴)</span>;
      case 'A':
        return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[11px] font-black">危険度 A (要警戒)</span>;
      case 'B':
        return <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[11px] font-black">危険度 B (標準)</span>;
      case 'C':
        return <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-black">危険度 C (序盤虚弱)</span>;
    }
  };

  const getRatingBadge = (rating: 'favored' | 'even' | 'unfavored') => {
    switch (rating) {
      case 'favored':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-black">
            <CheckCircle2 className="w-3.5 h-3.5" />
            有利 (Hard Counter)
          </span>
        );
      case 'even':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-black">
            <HelpCircle className="w-3.5 h-3.5" />
            五分 (Skill Matchup)
          </span>
        );
      case 'unfavored':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-black">
            <XCircle className="w-3.5 h-3.5" />
            不利 (Disadvantage)
          </span>
        );
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-6 shadow-2xl backdrop-blur-md">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-100 flex items-center gap-2">
                🎯 対面相性チェッカー (Matchup Picker)
              </h2>
              <p className="text-xs text-zinc-400">
                相手JGを選択すると、プール内での相性判定と「誰を当てるべきか」を瞬時に逆引きします
              </p>
            </div>
          </div>
        </div>

        {/* 敵JG選択ドロップダウン（スマホ等用） */}
        <div className="w-full sm:w-auto flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-400 shrink-0">相手JG:</span>
          <select
            value={selectedEnemyId}
            onChange={(e) => setSelectedEnemyId(e.target.value)}
            className="w-full sm:w-48 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-100 focus:outline-none focus:border-rose-500"
          >
            {enemyList.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 敵JGアイコンクイックセレクター */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">主要JGからクイック選択:</span>
        <div className="flex flex-wrap gap-2">
          {enemyList.map((e) => {
            const isSelected = e.id === selectedEnemyId;
            return (
              <button
                key={e.id}
                onClick={() => setSelectedEnemyId(e.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-400 scale-105'
                    : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/50'
                }`}
              >
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${e.id}.png`}
                  alt={e.name}
                  className="w-5 h-5 rounded-full object-cover"
                  onError={(ev) => {
                    (ev.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span>{e.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 選択された敵JGのプロファイル */}
      {enemyProfile && (
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={`https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${enemyProfile.id}.png`}
                alt={enemyProfile.name}
                className="w-12 h-12 rounded-2xl border-2 border-rose-500/60 object-cover shadow-md"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-zinc-100">{enemyProfile.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-bold border border-zinc-700">
                    {enemyProfile.archetype}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {getDangerBadge(enemyProfile.dangerLevel)}
                  <span className="text-xs text-zinc-400 font-medium">
                    インベード警戒: <strong className="text-zinc-200">{enemyProfile.invadeRisk}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800 px-3 py-2 rounded-xl text-xs space-y-0.5">
              <span className="text-zinc-400 font-bold block">初動スタイル:</span>
              <span className="text-amber-300 font-bold">{enemyProfile.clearStyle}</span>
            </div>
          </div>

          <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-rose-300 block">対面対策の鉄則（相手を腐らせる方法）:</span>
              <p className="text-zinc-300 leading-relaxed">{enemyProfile.coreWeakness}</p>
            </div>
          </div>
        </div>
      )}

      {/* あなたのおすすめピック一覧 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-black text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            持ちキャラ・おすすめカウンター候補 ({sortedAdvice.length}体)
          </h3>
          <span className="text-[11px] text-zinc-500">※カードクリックで詳細ガイドへ切り替え</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedAdvice.map((advice) => {
            const isFav = favorites.includes(advice.myChampId);
            return (
              <div
                key={advice.myChampId}
                onClick={() => onSelectMyChampion(advice.myChampId)}
                className={`group p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  advice.rating === 'favored'
                    ? 'bg-emerald-950/15 border-emerald-800/40 hover:border-emerald-500/80 hover:bg-emerald-950/30'
                    : advice.rating === 'even'
                    ? 'bg-amber-950/15 border-amber-800/40 hover:border-amber-500/80 hover:bg-amber-950/30'
                    : 'bg-rose-950/15 border-rose-800/40 hover:border-rose-500/80 hover:bg-rose-950/30'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={`https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${advice.myChampId}.png`}
                        alt={advice.myChampName}
                        className="w-9 h-9 rounded-xl border border-zinc-700 object-cover group-hover:scale-105 transition"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-zinc-100 group-hover:text-amber-300 transition">
                            {advice.myChampName}
                          </span>
                          {isFav && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/40">
                              ★ マイプール
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-400">{advice.myChampId}</span>
                      </div>
                    </div>
                    {getRatingBadge(advice.rating)}
                  </div>

                  {/* 一言要約 */}
                  <div className="text-xs font-bold text-zinc-200 group-hover:text-white transition">
                    『{advice.headline}』
                  </div>

                  {/* 実戦の鉄則 */}
                  <div className="bg-zinc-950/60 rounded-lg p-2.5 text-[11px] text-zinc-300 leading-relaxed border border-zinc-800/60">
                    <span className="font-bold text-zinc-400 block mb-0.5">勝ち筋・キラーアクション:</span>
                    {advice.keyRule}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">
                    有利スパイク: <strong className="text-zinc-300">{advice.powerSpikeAdvantage.toUpperCase()}</strong>
                  </span>
                  <span className="text-amber-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    ガイドを見る <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
