'use client';

import Image from 'next/image';
import { getChampIcon } from '../../../../lib/ddragonClient';
import { ROLES, type PlayerStat, type PlayerPoolItem, type ChampionItem, type Role } from './types';

interface TeamStatsTableProps {
  team: 'BLUE' | 'RED';
  indices: number[];
  stats: PlayerStat[];
  playersPool: PlayerPoolItem[];
  championsList: ChampionItem[];
  onStatChange: (index: number, field: keyof PlayerStat, value: string) => void;
  onOpenChampSelector: (team: 'BLUE' | 'RED', role: Role, slotIndex: number) => void;
}

export default function TeamStatsTable({
  team,
  indices,
  stats,
  playersPool,
  championsList,
  onStatChange,
  onOpenChampSelector,
}: TeamStatsTableProps) {
  const isBlue = team === 'BLUE';
  const titleColor = isBlue ? 'text-secondary-700' : 'text-danger-700';
  const focusBorder = isBlue ? 'focus:border-secondary-edge-strong' : 'focus:border-danger-edge-strong';
  const hoverBorder = isBlue ? 'hover:border-secondary-edge-strong' : 'hover:border-danger-edge-strong';

  return (
    <div>
      <h4 className={`font-bold ${titleColor} mb-4 text-xl tracking-wider`}>
        {isBlue ? '🟦 BLUE TEAM' : '🟥 RED TEAM'}
      </h4>
      <div className="space-y-3">
        {indices.map((index) => {
          const s = stats[index];
          if (!s) return null;
          const uid = `${team}-slot-${index}`;

          return (
            <div key={uid} className="flex flex-col bg-surface/70 p-3 rounded-lg border border-border gap-2">
              <div className="flex flex-wrap items-center gap-2 w-full">
                {/* ロール選択 */}
                <select
                  value={s.currentRole}
                  onChange={(e) => onStatChange(index, 'currentRole', e.target.value)}
                  className={`w-16 bg-surface border border-border rounded px-1.5 py-1 text-foreground outline-none ${focusBorder} text-xs font-bold`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                {/* プレイヤー名選択 */}
                <select
                  value={s.name}
                  onChange={(e) => onStatChange(index, 'name', e.target.value)}
                  className={`w-28 bg-surface border border-border rounded px-2 py-1.5 text-foreground outline-none ${focusBorder} text-sm`}
                >
                  <option value="">選択...</option>
                  {playersPool.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {/* チャンピオン選択ボタン */}
                <button
                  onClick={() => onOpenChampSelector(team, s.currentRole, index)}
                  type="button"
                  className={`w-32 bg-surface border border-border ${hoverBorder} rounded px-2 py-1.5 text-muted-strong hover:text-foreground text-xs flex items-center justify-between gap-1 transition shrink-0 cursor-pointer`}
                >
                  <span className="truncate">
                    {s.champion_name
                      ? championsList.find((c) => c.id === s.champion_name)?.name || 'チャンプ'
                      : 'チャンプ選択'}
                  </span>
                  {s.champion_name && (
                    <Image
                      src={getChampIcon(s.champion_name)}
                      width={20}
                      height={20}
                      className="w-5 h-5 rounded-full border border-border shrink-0 object-cover"
                      alt={s.champion_name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                </button>

                {/* KDA & ペンタキル入力 */}
                <div className="flex-1 min-w-0 flex flex-wrap gap-1.5 justify-end items-end">
                  <label className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] font-bold text-muted-strong">キル</span>
                    <input
                      type="number"
                      value={s.kills}
                      onChange={(e) => onStatChange(index, 'kills', e.target.value)}
                      className="w-11 bg-surface border border-border text-foreground text-center rounded py-1 text-sm"
                      placeholder="0"
                    />
                  </label>
                  <span className="text-muted-strong pb-1.5 text-xs">/</span>
                  <label className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] font-bold text-danger-600">デス</span>
                    <input
                      type="number"
                      value={s.deaths}
                      onChange={(e) => onStatChange(index, 'deaths', e.target.value)}
                      className="w-11 bg-surface border border-danger-edge-soft text-danger-700 text-center rounded py-1 text-sm"
                      placeholder="0"
                    />
                  </label>
                  <span className="text-muted-strong pb-1.5 text-xs">/</span>
                  <label className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] font-bold text-muted-strong">アシスト</span>
                    <input
                      type="number"
                      value={s.assists}
                      onChange={(e) => onStatChange(index, 'assists', e.target.value)}
                      className="w-11 bg-surface border border-border text-foreground text-center rounded py-1 text-sm"
                      placeholder="0"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = s.penta_kills || 0;
                      const next = cur >= 2 ? 0 : cur + 1;
                      onStatChange(index, 'penta_kills', String(next));
                    }}
                    className={`ml-1 px-2 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                      (s.penta_kills || 0) > 0
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                        : 'bg-black/5 text-muted-strong hover:text-foreground border border-border'
                    }`}
                    title="ペンタキル達成回数（タップで0→1→2と切り替え・ジャックポット総取り対象）"
                  >
                    💎 ペンタ:{(s.penta_kills || 0) > 0 ? `${s.penta_kills}` : '0'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
