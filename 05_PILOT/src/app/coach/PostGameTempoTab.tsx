'use client';

import React, { useState, useEffect } from 'react';
import {
  Search, RefreshCw, AlertTriangle, User, Rewind, Home, Shield, Info, TrendingDown,
} from 'lucide-react';
import { getChampIcon } from '@/lib/ddragonClient';
import type { PostgameTempoReport, BuildAuditCheck, MinuteRow } from '@/lib/postgameTempo';

interface RecentMatch {
  matchId: string;
  championName: string;
  opponentChampion: string | null;
  position: string;
  isWin: boolean;
  kdaStr: string;
  durationMin: number;
}

const signed = (n: number | null) => (n === null ? '—' : n > 0 ? `+${n}` : `${n}`);
const diffColor = (n: number | null) =>
  n === null || n === 0 ? 'text-slate-400' : n > 0 ? 'text-emerald-400' : 'text-rose-400';

const CAUSE_LABEL: Record<MinuteRow['cause'], { label: string; cls: string }> = {
  death: { label: 'デス起因', cls: 'bg-rose-950/40 text-rose-300 border-rose-800/60' },
  recall: { label: '帰還起因', cls: 'bg-amber-950/40 text-amber-300 border-amber-800/60' },
  lane: { label: 'レーン/ファーム', cls: 'bg-teal-950/40 text-teal-300 border-teal-800/60' },
};

const STATUS_STYLE: Record<BuildAuditCheck['status'], { label: string; cls: string }> = {
  good: { label: '良好', cls: 'bg-emerald-950/30 text-emerald-400 border-emerald-800/60' },
  ok: { label: '許容', cls: 'bg-amber-950/30 text-amber-400 border-amber-800/60' },
  warn: { label: '要改善', cls: 'bg-rose-950/30 text-rose-400 border-rose-800/60' },
  na: { label: '判定対象外', cls: 'bg-slate-900 text-slate-400 border-slate-700' },
};

// initialMatchId: ソロQ試合後の通知（/coach?tab=postgame&matchId=...）から開いた時に、その試合を自動で解析する
export default function PostGameTempoTab({ initialMatchId }: { initialMatchId?: string | null }) {
  const [summonerInput, setSummonerInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<PostgameTempoReport | null>(null);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('coach_riot_id');
    } catch {}
    if (saved) {
      setSummonerInput(saved);
      // 保存済みRiot IDがある時だけ自動解析する（未保存なら入力→解析ボタンの通常フロー）
      if (initialMatchId) load(initialMatchId, saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMatchId]);

  const load = async (matchId?: string, riotId: string = summonerInput) => {
    if (!riotId.trim()) return;
    setLoading(true);
    setError('');
    try {
      localStorage.setItem('coach_riot_id', riotId);
    } catch {}

    const [gameName, tagLine] = riotId.trim().split('#');
    const qs = new URLSearchParams({ gameName: gameName || '', tagLine: tagLine || 'JP1' });
    if (matchId) qs.set('matchId', matchId);

    try {
      const res = await fetch(`/api/coach/postgame-tempo?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '解析に失敗しました');
      setReport(data.report);
      setRecentMatches(data.recentMatches || []);
    } catch (err: any) {
      setError(err.message || '通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const lossMinutes = new Set(report?.replay.lossSegments.map((s) => s.minute) || []);
  const hasOpp = !!report?.opponentChampion;

  return (
    <div className="space-y-6">
      {/* 検索バー */}
      <form
        onSubmit={(e) => { e.preventDefault(); load(); }}
        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row gap-3 items-center"
      >
        <div className="relative flex-1 w-full">
          <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Riot ID を入力 (例: Kazurin#4036)"
            value={summonerInput}
            onChange={(e) => setSummonerInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !summonerInput.trim()}
          className="w-full sm:w-auto px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-bold text-white transition-colors shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span>直近ランク戦を解析</span>
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 試合セレクター */}
      {recentMatches.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {recentMatches.map((m) => {
            const active = report?.matchId === m.matchId;
            return (
              <button
                key={m.matchId}
                onClick={() => load(m.matchId)}
                disabled={loading}
                className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-60 ${
                  active ? 'bg-amber-500/10 border-amber-500/60 text-white' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <img src={getChampIcon(m.championName)} alt={m.championName} className="w-6 h-6 rounded-md" />
                <span className={m.isWin ? 'text-emerald-400' : 'text-rose-400'}>{m.isWin ? '勝' : '敗'}</span>
                <span>vs {m.opponentChampion || '?'}</span>
                <span className="font-mono text-slate-500">{m.kdaStr}</span>
              </button>
            );
          })}
        </div>
      )}

      {report && (
        <div className="space-y-5">
          {/* 試合ヘッダー */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <img src={getChampIcon(report.myChampion)} alt={report.myChampion} className="w-12 h-12 rounded-xl" />
              <div className="min-w-0">
                <h3 className="text-base font-black text-white flex flex-wrap items-center gap-2">
                  <span>{report.myChampion}</span>
                  <span className="text-slate-500 text-xs">vs</span>
                  <span>{report.opponentChampion || '対面特定不可'}</span>
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                  <span className={report.isWin ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{report.isWin ? '勝利' : '敗北'}</span>
                  <span>• {report.position}</span>
                  <span>• {report.durationStr}</span>
                  <span>• KDA {report.kdaStr}</span>
                </div>
              </div>
            </div>
            {hasOpp && (
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                {([
                  ['CS差', report.replay.final.csDiff],
                  ['ゴールド差', report.replay.final.goldDiff],
                  ['XP差', report.replay.final.xpDiff],
                ] as const).map(([label, v]) => (
                  <div key={label} className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-slate-500">{label}@{report.analyzedUntilMin}分</div>
                    <div className={`text-sm font-black font-mono ${diffColor(v)}`}>{signed(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!hasOpp && (
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              同じポジションの敵が特定できなかったため、対面との差分は表示していません。
            </div>
          )}

          {/* 1. テンポ逆再生 */}
          <section className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Rewind className="w-4 h-4 text-amber-400" /> 15分テンポ逆再生（{report.analyzedUntilMin}分 → 1分）
            </h4>

            {hasOpp && (
              <>
                {/* 差分の内訳 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {report.replay.breakdown.map((b) => (
                    <div key={b.cause} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${CAUSE_LABEL[b.cause].cls}`}>
                        {CAUSE_LABEL[b.cause].label}（{b.minutes}分間）
                      </span>
                      <div className="flex items-baseline gap-3 text-xs">
                        <span className="text-slate-400">CS差 <b className={`font-mono ${diffColor(b.csDiff)}`}>{signed(b.csDiff)}</b></span>
                        <span className="text-slate-400">G差 <b className={`font-mono ${diffColor(b.goldDiff)}`}>{signed(b.goldDiff)}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  各分の「対面との差の増減」を、その分と直前1分に自分のデス/帰還があったかで3つに振り分けて合計しています。
                </p>

                {/* ロス区間 */}
                <div className="space-y-2">
                  <h5 className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5" /> テンポロス区間（悪化が大きい順）
                  </h5>
                  {report.replay.lossSegments.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      1分間でゴールド差{report.thresholds.LOSS_GOLD_PER_MIN}以下・CS差{report.thresholds.LOSS_CS_PER_MIN}以下に悪化した区間はありませんでした。
                    </p>
                  ) : (
                    report.replay.lossSegments.map((s) => (
                      <div key={s.minute} className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/50 text-xs space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-white font-mono">{s.minute - 1}:00〜{s.minute}:00</span>
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${CAUSE_LABEL[s.cause].cls}`}>{CAUSE_LABEL[s.cause].label}</span>
                          <span className="text-slate-400">CS差 <b className={`font-mono ${diffColor(s.dCsDiff)}`}>{signed(s.dCsDiff)}</b></span>
                          <span className="text-slate-400">G差 <b className={`font-mono ${diffColor(s.dGoldDiff)}`}>{signed(s.dGoldDiff)}</b></span>
                        </div>
                        {s.events.length > 0 && <div className="text-[11px] text-slate-300">{s.events.join(' / ')}</div>}
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
                  <tr className="bg-slate-950/70 text-slate-400 border-b border-slate-800 text-[11px]">
                    <th className="py-2 px-2">分</th>
                    <th className="py-2 px-2">CS 自分/対面</th>
                    <th className="py-2 px-2">CS差増減</th>
                    <th className="py-2 px-2">G差増減</th>
                    <th className="py-2 px-2">区分</th>
                    <th className="py-2 px-2">出来事</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {[...report.replay.rows].reverse().map((r) => (
                    <tr key={r.minute} className={lossMinutes.has(r.minute) ? 'bg-rose-950/20' : ''}>
                      <td className="py-2 px-2 font-mono font-bold text-white">{r.minute}</td>
                      <td className="py-2 px-2 font-mono text-slate-300">{r.myCs}{r.oppCs !== null ? ` / ${r.oppCs}` : ''}</td>
                      <td className={`py-2 px-2 font-mono ${diffColor(r.dCsDiff)}`}>{signed(r.dCsDiff)}</td>
                      <td className={`py-2 px-2 font-mono ${diffColor(r.dGoldDiff)}`}>{signed(r.dGoldDiff)}</td>
                      <td className="py-2 px-2">
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${CAUSE_LABEL[r.cause].cls}`}>{CAUSE_LABEL[r.cause].label}</span>
                      </td>
                      <td className="py-2 px-2 text-[11px] text-slate-300">{r.events.join(' / ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 2. 帰還テンポ */}
          <section className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Home className="w-4 h-4 text-teal-400" /> 帰還ごとのテンポ（15分まで）
            </h4>
            {report.recalls.length === 0 ? (
              <p className="text-[11px] text-slate-400">15分までに購入を伴う帰還はありませんでした。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[560px]">
                  <thead>
                    <tr className="bg-slate-950/70 text-slate-400 border-b border-slate-800 text-[11px]">
                      <th className="py-2 px-2">購入時刻</th>
                      <th className="py-2 px-2">所持金</th>
                      <th className="py-2 px-2">購入アイテム</th>
                      <th className="py-2 px-2">前後2分のCS差</th>
                      <th className="py-2 px-2">前後2分のG差</th>
                      <th className="py-2 px-2">対面</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {report.recalls.map((r) => (
                      <tr key={r.startMs}>
                        <td className="py-2 px-2 font-mono text-white whitespace-nowrap">
                          {r.timeStr}
                          {r.kind === 'death' && <span className="ml-1 text-[10px] text-rose-400">デス後</span>}
                        </td>
                        <td className="py-2 px-2 font-mono text-amber-300 whitespace-nowrap">
                          {r.goldBefore !== null ? `${r.goldBefore}G` : '—'}
                          <span className="ml-1 text-[10px] text-slate-500">({r.goldBeforeAtMin}:00時点)</span>
                        </td>
                        <td className="py-2 px-2 text-[11px] text-slate-300">{r.items.join('・')}</td>
                        <td className={`py-2 px-2 font-mono ${diffColor(r.relCs)}`}>{signed(r.relCs)}</td>
                        <td className={`py-2 px-2 font-mono ${diffColor(r.relGold)}`}>{signed(r.relGold)}</td>
                        <td className="py-2 px-2 text-[11px] text-slate-400 whitespace-nowrap">
                          {r.opponentAlsoBacked ? '同時期に帰還' : '帰還なし'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Riot APIには帰還イベントが無いため、アイテム購入のまとまりを帰還とみなしています（何も買わない帰還は検出できません）。
              「前後2分」は購入時刻を含む分から2分間の、対面との差の増減です。所持金は直前の分のスナップショットです。
            </p>
          </section>

          {/* 3. ビルド監査 */}
          <section className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" /> ビルド監査（Build Audit）
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                ['👟 靴の購入タイミングと属性', report.buildAudit.boots],
                ['🩸 重傷（回復阻害）', report.buildAudit.grievousWounds],
              ] as const).map(([title, check]) => (
                <div key={title} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{title}</span>
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${STATUS_STYLE[check.status].cls}`}>
                      {STATUS_STYLE[check.status].label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{check.verdict}</p>
                  {check.details.length > 0 && (
                    <ul className="text-[11px] text-slate-400 space-y-0.5 list-disc pl-4">
                      {check.details.map((d) => <li key={d}>{d}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              判定の目安: 上位靴は{report.thresholds.BOOTS_T2_TARGET_MIN}分台まで（サポート{report.thresholds.BOOTS_T2_TARGET_MIN_SUPPORT}分台）、
              防御靴は購入時点で敵ダメージの{Math.round(report.thresholds.DAMAGE_SKEW_RATIO * 100)}%以上が逆属性なら不一致、
              重傷はチーム最初の購入が{report.thresholds.GW_EARLY_MIN}分台までなら早期・{report.thresholds.GW_STANDARD_MIN}分台までなら標準。
              回復量は試合終了時点の値です。いずれも公式の基準ではなく、このツールの目安です。
            </p>
          </section>
        </div>
      )}

      {!report && !loading && !error && (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800/60 rounded-2xl text-slate-500 text-xs space-y-2">
          <Rewind className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <p className="font-bold text-slate-400">Riot ID を入力して直近のランク戦を解析してください</p>
          <p className="text-[11px] text-slate-500">15分までのCS・ゴールド差を1分ずつ遡り、どこでテンポを失ったか（デス/帰還/レーン）と靴・重傷の購入判断を、試合のタイムラインの実測値だけで表示します</p>
        </div>
      )}
    </div>
  );
}
