"use client";

import { Clock, Flame, Award, Activity } from 'lucide-react';

// タブ3: 時間帯別・連戦疲労・即キュー判定・プレイルール
// 2026-10-07: app/analyzer/page.tsx（1,939行）から分割。表示内容・動作は分割前と同じ。
export default function SessionTab({ report }: {
  report: any;
}) {
  return (
    <>
            <div className="space-y-6">
              {/* 1. 時間帯別パフォーマンス */}
              <div className="rounded-3xl border border-border bg-surface p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-surface-subtle pb-3">
                  <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                    <Clock size={16} className="text-primary-600" />
                    <span>時間帯別勝率カーブ ＆ 集中力ピーク (実測タイムスタンプ集計)</span>
                  </h3>
                  <span className="text-[10px] font-bold text-faint">JST実測ログ</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {report.sessionAnalytics.timeOfDayPerformance?.map((slot: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-5 rounded-3xl border space-y-2 ${
                        !slot.hasData
                          ? 'bg-background border-border opacity-70'
                          : slot.winRate >= 60
                          ? 'bg-success-50/70 border-success-edge'
                          : slot.winRate <= 45
                          ? 'bg-danger-50/70 border-danger-edge'
                          : 'bg-background border-border'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-black text-foreground">{slot.label}</div>
                          <div className="text-[11px] font-mono text-muted-strong font-bold mt-0.5">
                            {slot.timeSlot}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-lg font-black text-foreground">
                            {slot.hasData ? `${slot.winRate}%` : '0試合'}
                          </div>
                          <div className="text-[10px] text-muted-strong">
                            {slot.hasData ? `KDA ${slot.kda} (${slot.gamesCount}戦)` : '直近履歴なし'}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-foreground-subtle font-medium leading-relaxed pt-2 border-t border-border/50">
                        {slot.insight}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. 連戦疲労度 ＆ 即キューティルト判定 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 rounded-3xl border border-border bg-surface p-6 shadow-xs space-y-4">
                  <div className="border-b border-surface-subtle pb-3">
                    <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                      <Activity size={16} className="text-primary-600" />
                      <span>連続試合数による疲労度・勝率低下分析 (実測セッション)</span>
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {report.sessionAnalytics.sessionFatigueImpact?.map((f: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border space-y-1.5 ${
                          f.hasData ? 'bg-background border-border/80' : 'bg-background/60 border-dashed border-border opacity-60'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-foreground font-black">
                            {f.gameNumberInSession} - {f.label}
                          </span>
                          <span className="font-mono text-foreground-soft font-black">
                            {f.hasData ? (
                              <>
                                勝率 {f.winRate}%{' '}
                                <span className="text-[10px] text-faint font-normal">
                                  (平均 {f.avgDeaths}デス / {f.gamesCount}戦)
                                </span>
                              </>
                            ) : (
                              <span className="text-faint font-normal">0試合 (連戦なし・健全)</span>
                            )}
                          </span>
                        </div>
                        {f.hasData && (
                          <div className="h-2 w-full rounded-full bg-surface-hover overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                f.winRate >= 60
                                  ? 'bg-success-500'
                                  : f.winRate >= 50
                                  ? 'bg-primary-500'
                                  : 'bg-danger-500'
                              }`}
                              style={{ width: `${f.winRate}%` }}
                            />
                          </div>
                        )}
                        <div className="flex justify-between items-center text-[11px]">
                          <span className={f.hasData ? (f.focusScore >= 80 ? 'text-success-700 font-black' : f.focusScore >= 60 ? 'text-primary-700 font-bold' : 'text-danger-700 font-bold') : 'text-faint'}>
                            {f.hasData ? `集中力スコア: ${f.focusScore}点` : '直近データなし'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            !f.hasData
                              ? 'bg-surface-subtle text-muted-strong'
                              : f.focusScore >= 80
                              ? 'bg-success-100 text-success-800 border border-success-edge'
                              : f.focusScore >= 60
                              ? 'bg-primary-100 text-primary-800 border border-primary-edge'
                              : 'bg-danger-100 text-danger-800 border border-danger-edge'
                          }`}>
                            状態: {f.fatigueLevel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-3xl border border-primary-edge-soft bg-primary-50/60 p-6 shadow-xs space-y-4">
                  <div className="border-b border-primary-edge-soft/70 pb-3">
                    <h3 className="font-black text-sm text-primary-950 flex items-center gap-2">
                      <Flame size={16} className="text-danger-600" />
                      <span>即キュー・ティルト判定 (実測インターバル)</span>
                    </h3>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface border border-primary-edge-soft space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-foreground-subtle">負け直後 5分以内即キュー</div>
                      <div className="text-sm font-black font-mono">
                        {report.sessionAnalytics.requeueTiltStats.immediateRequeueGames > 0 ? (
                          <span className={
                            report.sessionAnalytics.requeueTiltStats.immediateRequeueWinRate >= 55
                              ? 'text-success-600'
                              : report.sessionAnalytics.requeueTiltStats.immediateRequeueWinRate >= 45
                              ? 'text-primary-600'
                              : 'text-danger-600'
                          }>
                            勝率 {report.sessionAnalytics.requeueTiltStats.immediateRequeueWinRate}%{' '}
                            <span className="text-[10px] text-faint font-normal">
                              ({report.sessionAnalytics.requeueTiltStats.immediateRequeueGames}試合)
                            </span>
                          </span>
                        ) : (
                          <span className="text-success-700 text-xs font-bold">0試合 (即キューなし・良好)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-foreground-subtle">5分以上休憩後のマッチ</div>
                      <div className="text-sm font-black font-mono">
                        {report.sessionAnalytics.requeueTiltStats.restedRequeueGames > 0 ? (
                          <span className={
                            report.sessionAnalytics.requeueTiltStats.restedRequeueWinRate >= 55
                              ? 'text-success-600'
                              : report.sessionAnalytics.requeueTiltStats.restedRequeueWinRate >= 45
                              ? 'text-primary-600'
                              : 'text-danger-600'
                          }>
                            勝率 {report.sessionAnalytics.requeueTiltStats.restedRequeueWinRate}%{' '}
                            <span className="text-[10px] text-faint font-normal">
                              ({report.sessionAnalytics.requeueTiltStats.restedRequeueGames}試合)
                            </span>
                          </span>
                        ) : (
                          <span className="text-faint text-xs font-normal">0試合</span>
                        )}
                      </div>
                    </div>
                    {report.sessionAnalytics.requeueTiltStats.tiltWinRateDropPercent > 0 && (
                      <div className="pt-2 border-t border-surface-subtle flex items-center justify-between text-xs font-black">
                        <span className="text-primary-900">ティルトによる勝率低下</span>
                        <span className="text-danger-600 bg-danger-100 px-2 py-0.5 rounded font-mono">
                          -{report.sessionAnalytics.requeueTiltStats.tiltWinRateDropPercent}% ドロップ
                        </span>
                      </div>
                    )}
                    {report.sessionAnalytics.requeueTiltStats.tiltWinRateDropPercent < 0 && (
                      <div className="pt-2 border-t border-surface-subtle flex items-center justify-between text-xs font-black">
                        <span className="text-primary-900">即キュー時の勢い維持</span>
                        <span className="text-success-700 bg-success-100 px-2 py-0.5 rounded font-mono">
                          +{Math.abs(report.sessionAnalytics.requeueTiltStats.tiltWinRateDropPercent)}% 勝率アップ
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-foreground-subtle leading-relaxed font-medium bg-surface/70 p-3 rounded-xl border border-primary-edge-soft/50">
                    💡 <strong>実測インサイト:</strong>{' '}
                    {report.sessionAnalytics.requeueTiltStats.insight ||
                      (report.sessionAnalytics.requeueTiltStats.immediateRequeueGames < 3
                        ? `直近の即キューは${report.sessionAnalytics.requeueTiltStats.immediateRequeueGames}試合のみとサンプル数が少なく、感情的な連戦を自制できています。`
                        : '敗北後は感情に流されず、冷静にセッションを管理できています。')}
                  </p>
                </div>
              </div>

              {/* 3. 黄金プレイルール */}
              <div className="rounded-3xl border border-primary-edge-soft bg-primary-50/70 p-6 shadow-xs space-y-4">
                <h3 className="font-black text-sm text-primary-950 flex items-center gap-2">
                  <Award size={16} className="text-primary-600" />
                  <span>実測データに基づく黄金プレイルール 3箇条</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {report.sessionAnalytics.goldenSessionRules?.map((rule: string, idx: number) => (
                    <div key={idx} className="p-4 bg-surface rounded-2xl border border-primary-edge-soft space-y-1 shadow-2xs">
                      <div className="text-xs font-bold text-foreground-soft leading-relaxed">{rule}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
    </>
  );
}
