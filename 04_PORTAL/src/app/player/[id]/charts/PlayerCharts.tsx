'use client';

/**
 * プレイヤー詳細ページのチャート群。
 *
 * ★ 2026-09-22 分離の背景:
 * recharts は約500KBあり、これを import している player/[id] の初回JSは実測1,325KBと
 * 他ページ(684〜820KB)の倍近くあった。recharts は既にNext.jsがページ単位で
 * コード分割しており他ページには影響しないが、このページ自体は重いままだった。
 * チャートを別モジュールへ切り出し next/dynamic で遅延読込することで、
 * 初回表示に必要なJSから recharts を外す。
 */

import Image from 'next/image';
import { getChampIcon } from '../../../../lib/ddragonClient';
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine, Area, CartesianGrid,
  Line, ComposedChart, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

// page.tsx と同じ配色（切り出しに伴い複製。片方だけ変えないこと）
const LANE_COLORS: Record<string, string> = {
  TOP: '#fb923c', JG: '#4ade80', MID: '#f87171', ADC: '#60a5fa', SUP: '#5eead4',
};

export function HextechRadarChart({ data, playerName }: { data: any[]; playerName: string }) {
  const player = { name: playerName };
  const hextechRadarData = data;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={hextechRadarData}>
        <PolarGrid stroke="rgba(0, 0, 0, 0.08)" />
        <PolarAngleAxis dataKey="subject" stroke="#6b7280" tick={{ fill: '#374151', fontSize: 11, fontWeight: 'bold' }} />
        <PolarRadiusAxis angle={30} domain={[0, 5]} stroke="none" />
        <Radar name={player.name} dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.4} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function MiniMmrChart({ pts, lane }: { pts: any[]; lane: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={pts} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
        <XAxis dataKey="game" tick={{ fill: '#6b7280', fontSize: 8 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 8 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} domain={['dataMin - 20', 'dataMax + 20']} width={40} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-white border border-black/10 rounded-lg p-2 text-[10px] shadow-xl">
                <div className="font-bold text-stone-900">
                  {d.champion}{d.opponentChampion ? <span className="text-rose-600"> vs {d.opponentChampion}</span> : ''}
                </div>
                {d.opponentName && <div className="text-gray-500">対面: {d.opponentName}</div>}
                <div className={d.isWin ? 'text-emerald-600' : 'text-rose-600'}>{d.isWin ? 'WIN' : 'LOSE'}</div>
                <div className="text-stone-700">MMR {d.mmr} <span className={d.mmrDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>({d.mmrDelta > 0 ? '+' : ''}{d.mmrDelta})</span></div>
                <div className="text-gray-500">{d.date}</div>
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="mmr"
          stroke={LANE_COLORS[lane]}
          strokeWidth={2}
          dot={(props: any) => {
            const { cx, cy, payload } = props;
            return <circle key={`d-${payload.game}`} cx={cx} cy={cy} r={3} fill={payload.isWin ? '#10b981' : '#f43f5e'} stroke={LANE_COLORS[lane]} strokeWidth={1} />;
          }}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function MainMmrChart({
  mmrChartData, lane, activeLane, visibleTierBounds, currentLaneMmr,
}: {
  mmrChartData: any[];
  lane: string;
  activeLane: string;
  visibleTierBounds: any[];
  currentLaneMmr: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={mmrChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="mmrGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
        <XAxis
          dataKey="game"
          tick={{ fill: '#6b7280', fontSize: 10 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
          tickLine={false}
          label={{ value: '試合', position: 'insideBottomRight', offset: -5, fill: '#6b7280', fontSize: 9 }}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 10 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
          tickLine={false}
          domain={['dataMin - 30', 'dataMax + 30']}
          label={{ value: 'MMR', angle: -90, position: 'insideLeft', offset: 20, fill: '#6b7280', fontSize: 9 }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const d = payload[0].payload;
            const laneLabels: Record<string, string> = { TOTAL: '総合', ALL: '全レーン', TOP: 'TOP', JG: 'JG', MID: 'MID', ADC: 'ADC', SUP: 'SUP' };
            return (
              <div className="bg-white border border-black/10 backdrop-blur-xl rounded-xl p-3 shadow-2xl text-xs min-w-[170px]">
                <div className="flex items-center gap-2 mb-1">
                  <Image
                    src={getChampIcon(d.champion)}
                    alt={d.champion}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <span className="font-bold text-stone-900">{d.champion}</span>
                  {d.opponentChampion && (
                    <>
                      <span className="text-[9px] font-black text-gray-500 italic">VS</span>
                      <Image
                        src={getChampIcon(d.opponentChampion)}
                        alt={d.opponentChampion}
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-full border border-rose-500/40"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <span className="font-bold text-rose-600">{d.opponentChampion}</span>
                    </>
                  )}
                </div>
                {d.opponentName && (
                  <div className="text-[9px] text-gray-500 mb-1">対面: {d.opponentName}</div>
                )}
                {/* M-03: MMR変動の内訳 */}
                {d.breakdown && d.role === activeLane && (
                  <div className="text-[9px] text-gray-400 mb-1 bg-black/5 rounded px-1.5 py-1">
                    内訳: 勝敗{d.breakdown.base > 0 ? '+' : ''}{d.breakdown.base} / 相手{d.breakdown.elo >= 0 ? '+' : ''}{d.breakdown.elo} / KDA+{d.breakdown.kda}
                    {d.breakdown.wrAdjust !== 0 && ` / 勝率補正${d.breakdown.wrAdjust}`}
                    {d.breakdown.dampener < 1 && ` / ×${d.breakdown.dampener}`}
                    {d.breakdown.placement && ' / 🔰×1.5'}
                  </div>
                )}
                <div className="flex justify-between items-center mt-1">
                  <span className={`font-black text-[10px] ${d.isWin ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {d.isWin ? 'WIN' : 'LOSE'} ({d.role})
                  </span>
                  <span className={`text-[9px] px-1.5 rounded font-bold bg-cyan-100 text-cyan-700 border border-cyan-200`}>
                    {laneLabels[activeLane]}
                  </span>
                </div>
                <div className="text-stone-700 mt-2 pt-2 border-t border-black/10 space-y-1">
                  <div>
                    MMR: <span className="font-bold text-stone-900">{d.mmr}</span>
                    <span className={`ml-2 font-bold ${d.mmrDelta > 0 && d.role === activeLane ? 'text-emerald-600' : d.mmrDelta < 0 && d.role === activeLane ? 'text-rose-600' : 'text-gray-500'}`}>
                      ({d.mmrDelta > 0 ? '+' : ''}{d.mmrDelta})
                    </span>
                  </div>
                  {d.allMmr && (
                    <div className="text-[9px] text-gray-500 grid grid-cols-2 gap-x-2 gap-y-0.5 pt-1.5 border-t border-black/10 mt-1">
                      <div>総合: {d.allMmr.TOTAL}</div>
                      <div>TOP: {d.allMmr.TOP}</div>
                      <div>JG: {d.allMmr.JG}</div>
                      <div>MID: {d.allMmr.MID}</div>
                      <div>ADC: {d.allMmr.ADC}</div>
                      <div>SUP: {d.allMmr.SUP}</div>
                    </div>
                  )}
                </div>
                <div className="text-gray-500 text-[9px] mt-2 text-right">{d.date}</div>
              </div>
            );
          }}
        />
        {/* ティア境界線（#49）: 表示範囲に入るKTMティアの下限を薄く引く */}
        {visibleTierBounds.map((t) => (
          <ReferenceLine
            key={t.name}
            y={t.min}
            stroke="#a78bfa"
            strokeDasharray="2 4"
            strokeOpacity={0.25}
            label={{ value: t.name, position: 'left', fill: '#a78bfa', fontSize: 8, opacity: 0.6 }}
          />
        ))}
        <ReferenceLine
          y={currentLaneMmr}
          stroke="#06b6d4"
          strokeDasharray="6 4"
          strokeOpacity={0.5}
          label={{ value: `現在 ${currentLaneMmr}`, position: 'right', fill: '#06b6d4', fontSize: 10 }}
        />
        <Area
          type="monotone"
          dataKey="mmr"
          stroke="#06b6d4"
          strokeWidth={2.5}
          fill="url(#mmrGradient)"
          dot={(props: any) => {
            const { cx, cy, payload } = props;
            // 大勝/大敗(MMR変動±30以上)は大きめ＆リング付きで強調（#49）
            const big = payload.bigSwing;
            return (
              <circle
                key={`dot-${payload.game}`}
                cx={cx}
                cy={cy}
                r={big ? 6.5 : 4.5}
                fill={payload.isWin ? '#10b981' : '#f43f5e'}
                stroke={big ? '#fff' : (payload.isWin ? '#047857' : '#be123c')}
                strokeWidth={big ? 2 : 1.5}
              />
            );
          }}
          activeDot={{ r: 6, stroke: '#06b6d4', strokeWidth: 2 }}
        />
        {/* 5戦移動平均線（#49）: 調子の波を滑らかに可視化 */}
        <Line
          type="monotone"
          dataKey="ma"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function WinRateChart({ mmrChartData }: { mmrChartData: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <ComposedChart data={mmrChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
        <XAxis dataKey="game" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} tickLine={false} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} tickLine={false} unit="%" />
        <Tooltip
          contentStyle={{ background: 'rgba(10,11,16,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }}
          formatter={((v: any, name: any) => [`${v}%`, name === 'recentRate' ? '直近10戦' : '通算']) as any}
          labelFormatter={(l: any) => `${l}試合目`}
        />
        <ReferenceLine y={50} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
        <Line type="monotone" dataKey="recentRate" stroke="#34d399" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="winRate" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
