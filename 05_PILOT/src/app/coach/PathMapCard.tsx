'use client';

import React, { useMemo, useState } from 'react';
import type { PathMapReport, PathPoint, PathTrack } from '@/lib/pathMap';

// 試合後の「道筋マップ」（2026-10-20）。自分と敵JGの位置をミニマップの上に線で描く。
// 位置は1分ごと（Riot API の上限）＋キル・デス・オブジェクトの瞬間の場所。1分の間は直線でつないでいるだけなので、
// 壁を抜けて見える線は「その1分の間にここからここへ動いた」という意味で読む。

const MAP_W = 14870;
const MAP_H = 14980;
const SIZE = 512;

const COLORS: Record<PathTrack['key'], { line: string; dot: string; text: string }> = {
  me: { line: '#f59e0b', dot: '#fbbf24', text: 'text-amber-300' },
  enemyJg: { line: '#f43f5e', dot: '#fb7185', text: 'text-rose-300' },
};

const KIND_MARK: Record<PathPoint['kind'], string> = {
  frame: '',
  kill: '⚔',
  death: '✖',
  assist: '＋',
  objective: '★',
};

const toX = (x: number) => (x / MAP_W) * SIZE;
const toY = (y: number) => SIZE - (y / MAP_H) * SIZE;
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

export default function PathMapCard({ report, patch }: { report: PathMapReport; patch?: string | null }) {
  const maxMin = Math.max(1, Math.ceil(report.durationSec / 60));
  // 序盤の動きが一番の見どころなので、最初は 0〜8分を表示する
  const [range, setRange] = useState<[number, number]>([0, Math.min(8, maxMin)]);
  const [visible, setVisible] = useState<Record<string, boolean>>({ me: true, enemyJg: true });
  const mapUrl = `https://ddragon.leagueoflegends.com/cdn/${patch || '16.19.1'}/img/map/map11.png`;

  const shown = useMemo(
    () =>
      report.tracks
        .filter((tr) => visible[tr.key])
        .map((tr) => ({ ...tr, points: tr.points.filter((p) => p.t >= range[0] * 60 && p.t <= range[1] * 60) })),
    [report, visible, range],
  );

  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-950/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-black text-stone-100">🗺️ 道筋マップ</h4>
        <div className="flex gap-1.5">
          {report.tracks.map((tr) => (
            <button
              key={tr.key}
              type="button"
              onClick={() => setVisible((v) => ({ ...v, [tr.key]: !v[tr.key] }))}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                visible[tr.key] ? 'bg-stone-800 border-stone-600 ' + COLORS[tr.key].text : 'bg-stone-950 border-stone-800 text-stone-500'
              }`}
            >
              ● {tr.label}（{tr.champion}）
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-stone-400">
          <span>表示する時間: {range[0]}分 〜 {range[1]}分</span>
          <span className="flex gap-1">
            {([[0, Math.min(8, maxMin), '序盤'], [0, Math.min(15, maxMin), '〜15分'], [0, maxMin, '全部']] as const).map(([a, b, l]) => (
              <button key={l} type="button" onClick={() => setRange([a, b])} className="px-2 py-0.5 rounded border border-stone-700 hover:bg-stone-800 cursor-pointer">
                {l}
              </button>
            ))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={maxMin} value={range[0]} onChange={(e) => setRange([Math.min(Number(e.target.value), range[1]), range[1]])} className="flex-1 accent-amber-500" aria-label="開始" />
          <input type="range" min={0} max={maxMin} value={range[1]} onChange={(e) => setRange([range[0], Math.max(Number(e.target.value), range[0])])} className="flex-1 accent-amber-500" aria-label="終了" />
        </div>
      </div>

      <div className="relative w-full max-w-[512px] mx-auto aspect-square rounded-xl overflow-hidden border border-stone-800 bg-stone-900">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 w-full h-full">
          <image href={mapUrl} x={0} y={0} width={SIZE} height={SIZE} opacity={0.75} />
          {shown.map((tr) => {
            const c = COLORS[tr.key];
            const d = tr.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`).join(' ');
            return (
              <g key={tr.key}>
                <path d={d} fill="none" stroke={c.line} strokeWidth={2.5} strokeOpacity={0.85} strokeLinejoin="round" />
                {tr.points.map((p, i) => (
                  <g key={i}>
                    <circle cx={toX(p.x)} cy={toY(p.y)} r={p.kind === 'frame' ? 4 : 6} fill={p.kind === 'death' ? '#111' : c.dot} stroke={c.line} strokeWidth={1.5}>
                      <title>{`${fmt(p.t)} ${tr.label}${p.label ? `: ${p.label}` : ''}`}</title>
                    </circle>
                    {p.kind === 'frame' ? (
                      <text x={toX(p.x) + 6} y={toY(p.y) - 6} fontSize={11} fontWeight={700} fill={c.dot} stroke="#000" strokeWidth={2.5} paintOrder="stroke">
                        {Math.round(p.t / 60)}
                      </text>
                    ) : (
                      <text x={toX(p.x)} y={toY(p.y) + 4} fontSize={10} textAnchor="middle" fill="#fff">{KIND_MARK[p.kind]}</text>
                    )}
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-[11px] text-stone-500 leading-relaxed">
        数字はその分の位置（Riot API は1分ごとの位置しか出さないため、間は直線でつないでいます）。⚔キル・✖デス・＋アシスト・★オブジェクトはその瞬間の場所です。点を押すと時刻が出ます。
      </p>

      {/* 出来事の一覧（時刻順） */}
      <div className="grid gap-1 sm:grid-cols-2">
        {shown.map((tr) => (
          <div key={tr.key} className="space-y-0.5">
            <div className={`text-[11px] font-bold ${COLORS[tr.key].text}`}>{tr.label}（{tr.champion}）の出来事</div>
            {tr.points.filter((p) => p.kind !== 'frame').length === 0 && <div className="text-[11px] text-stone-500">この時間帯にはありません</div>}
            {tr.points.filter((p) => p.kind !== 'frame').map((p, i) => (
              <div key={i} className="text-[11px] text-stone-300">
                <span className="font-mono text-stone-500 mr-1.5">{fmt(p.t)}</span>{KIND_MARK[p.kind]} {p.label}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
