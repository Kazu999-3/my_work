'use client';

import { Rewind, Home, Shield, Info, TrendingDown } from 'lucide-react';
import type { PostgameTempoReport, BuildAuditCheck, MinuteRow } from '@/lib/postgameTempo';

// 15分テンポ逆再生・帰還テンポ・ビルド監査（lib/postgameTempo.ts の実測値）。
// 2026-10-06: 独立タブ「試合後: テンポ」を「試合後: 詳細分析」へ統合。試合の選択と
// データ取得は PostGameDeepAnalyticsDashboard が行い、ここは受け取った report を描画するだけ。

const signed = (n: number | null) => (n === null ? '—' : n > 0 ? `+${n}` : `${n}`);
const diffColor = (n: number | null) =>
  n === null || n === 0 ? 'text-stone-400' : n > 0 ? 'text-emerald-400' : 'text-rose-400';

const CAUSE_LABEL: Record<MinuteRow['cause'], { label: string; cls: string }> = {
  death: { label: 'デス起因', cls: 'bg-rose-950/40 text-rose-300 border-rose-800/60' },
  recall: { label: '帰還起因', cls: 'bg-amber-950/40 text-amber-300 border-amber-800/60' },
  lane: { label: 'レーン/ファーム', cls: 'bg-teal-950/40 text-teal-300 border-teal-800/60' },
};

const STATUS_STYLE: Record<BuildAuditCheck['status'], { label: string; cls: string }> = {
  good: { label: '良好', cls: 'bg-emerald-950/30 text-emerald-400 border-emerald-800/60' },
  ok: { label: '許容', cls: 'bg-amber-950/30 text-amber-400 border-amber-800/60' },
  warn: { label: '要改善', cls: 'bg-rose-950/30 text-rose-400 border-rose-800/60' },
  na: { label: '判定対象外', cls: 'bg-stone-900 text-stone-400 border-stone-700' },
};

export default function PostGameTempoSections({ report }: { report: PostgameTempoReport }) {
  const lossMinutes = new Set(report.replay.lossSegments.map((s) => s.minute));
  const hasOpp = !!report.opponentChampion;

  return (
    <div className="space-y-5">
          {!hasOpp && (
            <div className="p-3 rounded-xl bg-stone-900/60 border border-stone-800 text-[11px] text-stone-400 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              同じポジションの敵が特定できなかったため、テンポ逆再生の対面差分は表示していません。
            </div>
          )}

          {/* 1. テンポ逆再生 */}
          <section className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-4">
            <h4 className="text-xs font-black text-stone-100 uppercase tracking-wider flex items-center gap-2">
              <Rewind className="w-4 h-4 text-amber-400" /> 15分テンポ逆再生（{report.analyzedUntilMin}分 → 1分）
            </h4>

            {hasOpp && (
              <>
                {/* 差分の内訳 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {report.replay.breakdown.map((b) => (
                    <div key={b.cause} className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                      <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${CAUSE_LABEL[b.cause].cls}`}>
                        {CAUSE_LABEL[b.cause].label}（{b.minutes}分間）
                      </span>
                      <div className="flex items-baseline gap-3 text-xs">
                        <span className="text-stone-400">CS差 <b className={`font-mono ${diffColor(b.csDiff)}`}>{signed(b.csDiff)}</b></span>
                        <span className="text-stone-400">G差 <b className={`font-mono ${diffColor(b.goldDiff)}`}>{signed(b.goldDiff)}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 leading-relaxed">
                  各分の「対面との差の増減」を、その分と直前1分に自分のデス/帰還があったかで3つに振り分けて合計しています。
                </p>

                {/* ロス区間 */}
                <div className="space-y-2">
                  <h5 className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5" /> テンポロス区間（悪化が大きい順）
                  </h5>
                  {report.replay.lossSegments.length === 0 ? (
                    <p className="text-[11px] text-stone-400">
                      1分間でゴールド差{report.thresholds.LOSS_GOLD_PER_MIN}以下・CS差{report.thresholds.LOSS_CS_PER_MIN}以下に悪化した区間はありませんでした。
                    </p>
                  ) : (
                    report.replay.lossSegments.map((s) => (
                      <div key={s.minute} className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/50 text-xs space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-stone-100 font-mono">{s.minute - 1}:00〜{s.minute}:00</span>
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${CAUSE_LABEL[s.cause].cls}`}>{CAUSE_LABEL[s.cause].label}</span>
                          <span className="text-stone-400">CS差 <b className={`font-mono ${diffColor(s.dCsDiff)}`}>{signed(s.dCsDiff)}</b></span>
                          <span className="text-stone-400">G差 <b className={`font-mono ${diffColor(s.dGoldDiff)}`}>{signed(s.dGoldDiff)}</b></span>
                        </div>
                        {s.events.length > 0 && <div className="text-[11px] text-stone-300">{s.events.join(' / ')}</div>}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* 分単位の逆再生 */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[560px]">
                <thead>
                  <tr className="bg-stone-950/70 text-stone-400 border-b border-stone-800 text-[11px]">
                    <th className="py-2 px-2">分</th>
                    <th className="py-2 px-2">CS 自分/対面</th>
                    <th className="py-2 px-2">CS差増減</th>
                    <th className="py-2 px-2">G差増減</th>
                    <th className="py-2 px-2">区分</th>
                    <th className="py-2 px-2">出来事</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60">
                  {[...report.replay.rows].reverse().map((r) => (
                    <tr key={r.minute} className={lossMinutes.has(r.minute) ? 'bg-rose-950/20' : ''}>
                      <td className="py-2 px-2 font-mono font-bold text-stone-100">{r.minute}</td>
                      <td className="py-2 px-2 font-mono text-stone-300">{r.myCs}{r.oppCs !== null ? ` / ${r.oppCs}` : ''}</td>
                      <td className={`py-2 px-2 font-mono ${diffColor(r.dCsDiff)}`}>{signed(r.dCsDiff)}</td>
                      <td className={`py-2 px-2 font-mono ${diffColor(r.dGoldDiff)}`}>{signed(r.dGoldDiff)}</td>
                      <td className="py-2 px-2">
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${CAUSE_LABEL[r.cause].cls}`}>{CAUSE_LABEL[r.cause].label}</span>
                      </td>
                      <td className="py-2 px-2 text-[11px] text-stone-300">{r.events.join(' / ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 2. 帰還テンポ */}
          <section className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-3">
            <h4 className="text-xs font-black text-stone-100 uppercase tracking-wider flex items-center gap-2">
              <Home className="w-4 h-4 text-teal-400" /> 帰還ごとのテンポ（15分まで）
            </h4>
            {report.recalls.length === 0 ? (
              <p className="text-[11px] text-stone-400">15分までに購入を伴う帰還はありませんでした。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[560px]">
                  <thead>
                    <tr className="bg-stone-950/70 text-stone-400 border-b border-stone-800 text-[11px]">
                      <th className="py-2 px-2">購入時刻</th>
                      <th className="py-2 px-2">所持金</th>
                      <th className="py-2 px-2">購入アイテム</th>
                      <th className="py-2 px-2">前後2分のCS差</th>
                      <th className="py-2 px-2">前後2分のG差</th>
                      <th className="py-2 px-2">対面</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60">
                    {report.recalls.map((r) => (
                      <tr key={r.startMs}>
                        <td className="py-2 px-2 font-mono text-stone-100 whitespace-nowrap">
                          {r.timeStr}
                          {r.kind === 'death' && <span className="ml-1 text-[10px] text-rose-400">デス後</span>}
                        </td>
                        <td className="py-2 px-2 font-mono text-amber-300 whitespace-nowrap">
                          {r.goldBefore !== null ? `${r.goldBefore}G` : '—'}
                          <span className="ml-1 text-[10px] text-stone-500">({r.goldBeforeAtMin}:00時点)</span>
                        </td>
                        <td className="py-2 px-2 text-[11px] text-stone-300">{r.items.join('・')}</td>
                        <td className={`py-2 px-2 font-mono ${diffColor(r.relCs)}`}>{signed(r.relCs)}</td>
                        <td className={`py-2 px-2 font-mono ${diffColor(r.relGold)}`}>{signed(r.relGold)}</td>
                        <td className="py-2 px-2 text-[11px] text-stone-400 whitespace-nowrap">
                          {r.opponentAlsoBacked ? '同時期に帰還' : '帰還なし'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[10px] text-stone-500 leading-relaxed">
              Riot APIには帰還イベントが無いため、アイテム購入のまとまりを帰還とみなしています（何も買わない帰還は検出できません）。
              「前後2分」は購入時刻を含む分から2分間の、対面との差の増減です。所持金は直前の分のスナップショットです。
            </p>
          </section>

          {/* 3. ビルド監査 */}
          <section className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-3">
            <h4 className="text-xs font-black text-stone-100 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" /> ビルド監査（Build Audit）
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                ['👟 靴の購入タイミングと属性', report.buildAudit.boots],
                ['🩸 重傷（回復阻害）', report.buildAudit.grievousWounds],
              ] as const).map(([title, check]) => (
                <div key={title} className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-stone-100">{title}</span>
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${STATUS_STYLE[check.status].cls}`}>
                      {STATUS_STYLE[check.status].label}
                    </span>
                  </div>
                  <p className="text-xs text-stone-200 leading-relaxed">{check.verdict}</p>
                  {check.details.length > 0 && (
                    <ul className="text-[11px] text-stone-400 space-y-0.5 list-disc pl-4">
                      {check.details.map((d) => <li key={d}>{d}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-stone-500 leading-relaxed">
              判定の目安: 上位靴は{report.thresholds.BOOTS_T2_TARGET_MIN}分台まで（サポート{report.thresholds.BOOTS_T2_TARGET_MIN_SUPPORT}分台）、
              防御靴は購入時点で敵ダメージの{Math.round(report.thresholds.DAMAGE_SKEW_RATIO * 100)}%以上が逆属性なら不一致、
              重傷はチーム最初の購入が{report.thresholds.GW_EARLY_MIN}分台までなら早期・{report.thresholds.GW_STANDARD_MIN}分台までなら標準。
              回復量は試合終了時点の値です。いずれも公式の基準ではなく、このツールの目安です。
            </p>
          </section>
    </div>
  );
}
