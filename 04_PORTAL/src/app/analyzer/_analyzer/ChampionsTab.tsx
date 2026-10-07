"use client";

import { Sparkles, Zap, AlertTriangle, CheckCircle2, Swords, Puzzle, Lightbulb } from 'lucide-react';

// タブ2: 上位チャンピオン深掘り・プール穴診断
// 2026-10-07: app/analyzer/page.tsx（1,939行）から分割。表示内容・動作は分割前と同じ。
export default function ChampionsTab({ report, selectedChampion, setSelectedChampId }: {
  report: any;
  selectedChampion: any;
  setSelectedChampId: (v: string) => void;
}) {
  return (
    <>
            <div className="space-y-6">
              {/* チャンピオンピル選択バー */}
              <div className="flex items-center gap-2 flex-wrap">
                {report.championProfiles?.map((champ: any) => (
                  <button
                    key={champ.id}
                    type="button"
                    onClick={() => setSelectedChampId(champ.id)}
                    className={`px-4 py-2 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-2 border ${
                      selectedChampion.id === champ.id
                        ? 'bg-primary-600 text-white border-primary-edge-strong shadow-xs'
                        : 'bg-surface text-foreground-subtle hover:bg-background border-border'
                    }`}
                  >
                    <span>{champ.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        selectedChampion.id === champ.id
                          ? 'bg-primary-800/80 text-white'
                          : 'bg-surface-subtle text-muted'
                      }`}
                    >
                      {champ.gamesCount}戦 勝率 {champ.winRate}% (KDA {champ.kda})
                    </span>
                  </button>
                ))}
              </div>

              {/* チャンピオン詳細カード */}
              <div className="rounded-3xl border border-border bg-surface p-6 md:p-8 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-foreground">{selectedChampion.name}</h3>
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-900 border border-primary-edge-soft">
                        {selectedChampion.powerRating}
                      </span>
                    </div>
                    <p className="text-xs text-muted-strong font-medium mt-0.5">
                      実戦サンプル: {selectedChampion.gamesCount}試合 | 分間CS: {selectedChampion.csPerMin} | 平均K/D/A:{' '}
                      {selectedChampion.avgKills} / {selectedChampion.avgDeaths} / {selectedChampion.avgAssists}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-faint font-bold">勝率 / KDA</div>
                      <div className="text-lg font-black text-foreground font-mono">
                        {selectedChampion.winRate}%{' '}
                        <span className="text-xs font-normal text-muted-strong">({selectedChampion.kda})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. パワースパイク分析 */}
                <div className="space-y-3">
                  <h4 className="font-black text-xs text-foreground flex items-center gap-1.5">
                    <Zap size={14} className="text-primary-600" />
                    <span>⚡ パワースパイク ＆ 立ち回り時間軸</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-background border border-border/80 space-y-1">
                      <div className="text-[11px] font-black text-muted-strong">序盤 (Lv1〜5)</div>
                      <p className="text-xs text-foreground-soft font-medium leading-relaxed">
                        {selectedChampion.powerSpikes.earlyLvl1to5}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-primary-50/80 border border-primary-edge-soft space-y-1">
                      <div className="text-[11px] font-black text-primary-900">中盤 (1〜2コア完成時)</div>
                      <p className="text-xs text-foreground font-bold leading-relaxed">
                        {selectedChampion.powerSpikes.mid1to2Core}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-primary-50/80 border border-primary-edge-soft space-y-1">
                      <div className="text-[11px] font-black text-primary-900">終盤 (3コア以降 / 集団戦)</div>
                      <p className="text-xs text-foreground font-medium leading-relaxed">
                        {selectedChampion.powerSpikes.late3CorePlus}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. 得意・天敵 相性マトリクス */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-3">
                    <h4 className="font-black text-xs text-success-900 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-success-600" />
                      <span>カモにできる相手 (有利マッチアップ)</span>
                    </h4>
                    <div className="space-y-2">
                      {(!selectedChampion.favoredMatchups || selectedChampion.favoredMatchups.length === 0) && (
                        <p className="text-[11px] text-muted-strong font-medium p-3 rounded-2xl bg-background border border-border">
                          このチャンピオンの有利マッチアップはまだ登録されていません。
                        </p>
                      )}
                      {selectedChampion.favoredMatchups?.map((fav: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-success-50/60 border border-success-edge-soft space-y-1"
                        >
                          <div className="flex justify-between items-center text-xs font-black text-success-950">
                            <span>vs {fav.enemy}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-success-100/80 text-success-800 font-bold border border-success-edge-soft/60">
                              有利相性
                            </span>
                          </div>
                          <p className="text-xs text-foreground-subtle font-medium leading-relaxed">{fav.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-black text-xs text-danger-900 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-danger-600" />
                      <span>天敵・警戒マッチアップ ＆ 対処法</span>
                    </h4>
                    <div className="space-y-2">
                      {(!selectedChampion.hardMatchups || selectedChampion.hardMatchups.length === 0) && (
                        <p className="text-[11px] text-muted-strong font-medium p-3 rounded-2xl bg-background border border-border">
                          このチャンピオンの天敵マッチアップはまだ登録されていません。
                        </p>
                      )}
                      {selectedChampion.hardMatchups?.map((hard: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-danger-50/60 border border-danger-edge-soft space-y-1"
                        >
                          <div className="flex justify-between items-center text-xs font-black text-danger-950">
                            <span>vs {hard.enemy}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-danger-100/80 text-danger-800 font-bold border border-danger-edge-soft/60">
                              要警戒
                            </span>
                          </div>
                          <p className="text-xs text-foreground-subtle font-medium leading-relaxed">
                            <strong className="text-danger-900">対策:</strong> {hard.counterPlay}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. 勝利時 vs 敗北時の客観スタッツ差分 */}
                <div className="p-5 rounded-3xl bg-background border border-border space-y-3">
                  <h4 className="font-black text-xs text-foreground flex items-center gap-1.5">
                    <Swords size={14} className="text-foreground-subtle" />
                    <span>勝利時 vs 敗北時のスタッツ差分（勝敗を分ける境界線）</span>
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-surface rounded-2xl border border-border/80">
                      <div className="text-[10px] text-faint font-bold">15分CS差</div>
                      <div className="font-black text-foreground mt-0.5">
                        {selectedChampion.winVsLossDiffs?.cs15Diff}
                      </div>
                    </div>
                    <div className="p-3 bg-surface rounded-2xl border border-border/80">
                      <div className="text-[10px] text-faint font-bold">平均被デス</div>
                      <div className="font-black text-foreground mt-0.5">
                        {selectedChampion.winVsLossDiffs?.deathsDiff}
                      </div>
                    </div>
                    <div className="p-3 bg-surface rounded-2xl border border-border/80">
                      <div className="text-[10px] text-faint font-bold">視界・コントロール</div>
                      <div className="font-black text-foreground mt-0.5">
                        {selectedChampion.winVsLossDiffs?.visionDiff}
                      </div>
                    </div>
                    <div className="p-3 bg-surface rounded-2xl border border-border/80">
                      <div className="text-[10px] text-faint font-bold">第1コア完成時間</div>
                      <div className="font-black text-foreground mt-0.5">
                        {selectedChampion.winVsLossDiffs?.firstCoreTime}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. AI戦術ガイド */}
                <div className="p-4 rounded-2xl bg-primary-50/70 border border-primary-edge-soft flex items-start gap-2.5">
                  <Sparkles size={16} className="text-primary-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-primary-950 font-medium leading-relaxed">
                    <strong className="font-black">専属AI戦術指南:</strong> {selectedChampion.aiTacticsGuide}
                  </div>
                </div>
              </div>

              {/* 🧩 チャンピオン手持ちプール穴診断 */}
              {report.sessionAnalytics?.championPoolDiagnosis && (
                <div className="rounded-3xl border border-primary-edge-soft bg-surface p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-primary-edge-soft pb-3">
                    <h3 className="font-black text-sm text-primary-950 flex items-center gap-2">
                      <Puzzle size={16} className="text-primary-600" />
                      <span>🧩 チャンピオン手持ちプール穴診断 ＆ AI補完処方箋</span>
                    </h3>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-900 border border-primary-edge-soft">
                      {report.sessionAnalytics.championPoolDiagnosis.poolArchetype}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-foreground-subtle">
                      <span>手持ちプールの属性バランス:</span>
                      <span>
                        AP {report.sessionAnalytics.championPoolDiagnosis.apRatioPercent}% / AD{' '}
                        {report.sessionAnalytics.championPoolDiagnosis.adRatioPercent}% / タンク{' '}
                        {report.sessionAnalytics.championPoolDiagnosis.tankRatioPercent}%
                      </span>
                    </div>
                    <div className="h-3.5 w-full rounded-full bg-surface-subtle flex overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-primary-500"
                        style={{ width: `${report.sessionAnalytics.championPoolDiagnosis.apRatioPercent}%` }}
                        title={`AP比率: ${report.sessionAnalytics.championPoolDiagnosis.apRatioPercent}%`}
                      />
                      <div
                        className="h-full bg-primary-500"
                        style={{ width: `${report.sessionAnalytics.championPoolDiagnosis.adRatioPercent}%` }}
                        title={`AD比率: ${report.sessionAnalytics.championPoolDiagnosis.adRatioPercent}%`}
                      />
                      <div
                        className="h-full bg-success-500"
                        style={{ width: `${report.sessionAnalytics.championPoolDiagnosis.tankRatioPercent}%` }}
                        title={`タンク比率: ${report.sessionAnalytics.championPoolDiagnosis.tankRatioPercent}%`}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-primary-50/70 border border-primary-edge-soft space-y-3">
                    <div className="text-xs font-bold text-primary-950 flex items-center gap-1.5">
                      <Lightbulb size={15} className="text-primary-600 shrink-0" />
                      <span>
                        <strong>不足しているピース:</strong> {report.sessionAnalytics.championPoolDiagnosis.missingPiece}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {report.sessionAnalytics.championPoolDiagnosis.recommendedAdditions?.map((rec: any, idx: number) => (
                        <div key={idx} className="p-3.5 bg-surface rounded-2xl border border-primary-edge-soft/80 space-y-1 shadow-2xs">
                          <div className="text-xs font-black text-foreground">{rec.championName}</div>
                          <div className="text-[10px] font-bold text-primary-700">{rec.archetype}</div>
                          <p className="text-[11px] text-muted font-medium leading-relaxed pt-1 border-t border-stone-100">
                            {rec.synergyReason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
    </>
  );
}
