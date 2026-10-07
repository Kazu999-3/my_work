"use client";

import { Sparkles, Flame, Coins, AlertOctagon, ShieldAlert } from 'lucide-react';

// タブ4: プレイスタイル特性タイプ診断
// 2026-10-07: app/analyzer/page.tsx（1,939行）から分割。表示内容・動作は分割前と同じ。
export default function PsychologyTab({ report }: {
  report: any;
}) {
  return (
    <>
            <div className="space-y-6">
              <div className="rounded-3xl border border-primary-edge bg-gradient-to-br from-primary-50/90 via-white to-primary-50/80 p-6 md:p-8 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-primary-edge-soft gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center text-2xl font-black shadow-md shrink-0">
                      🧬
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-900 border border-primary-edge-soft font-mono">
                          TYPE: {report.sessionAnalytics.playstyleMbti.typeCode}
                        </span>
                        <h3 className="text-lg md:text-xl font-black text-foreground">
                          {report.sessionAnalytics.playstyleMbti.typeName}
                        </h3>
                      </div>
                      <p className="text-xs text-primary-900 font-bold mt-1">
                        {report.sessionAnalytics.playstyleMbti.tagline}
                      </p>
                      <p className="text-[10px] text-muted-strong font-medium mt-0.5">
                        ※LoLの実測スタッツ（KDA・CS・被デス・視界）から算出した独自の4軸プレイスタイル分類です（各軸の％は独自の計算式による目安で、統計的に検証した値ではありません）
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-faint font-bold">意思決定スタッツ分類</span>
                    <div className="text-xs font-black text-primary-700">深層パーソナリティ判定完了</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-surface border border-primary-edge-soft space-y-1.5 shadow-2xs">
                    <div className="flex justify-between text-xs font-bold text-foreground-soft">
                      <span>🛡️ セーフティ計算型 ({report.sessionAnalytics.playstyleMbti.axes.safetyVsRisk.safetyPercent}%)</span>
                      <span className="text-faint">ハイリスク型 ({report.sessionAnalytics.playstyleMbti.axes.safetyVsRisk.riskPercent}%)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-surface-subtle overflow-hidden flex">
                      <div className="h-full bg-primary-600" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.safetyVsRisk.safetyPercent}%` }} />
                      <div className="h-full bg-danger-400" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.safetyVsRisk.riskPercent}%` }} />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface border border-primary-edge-soft space-y-1.5 shadow-2xs">
                    <div className="flex justify-between text-xs font-bold text-foreground-soft">
                      <span>🌾 自己スケール重視 ({report.sessionAnalytics.playstyleMbti.axes.scaleVsEnabler.scalePercent}%)</span>
                      <span className="text-faint">献身サポート ({report.sessionAnalytics.playstyleMbti.axes.scaleVsEnabler.enablerPercent}%)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-surface-subtle overflow-hidden flex">
                      <div className="h-full bg-primary-500" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.scaleVsEnabler.scalePercent}%` }} />
                      <div className="h-full bg-success-400" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.scaleVsEnabler.enablerPercent}%` }} />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface border border-primary-edge-soft space-y-1.5 shadow-2xs">
                    <div className="flex justify-between text-xs font-bold text-foreground-soft">
                      <span>🏰 自陣テリトリー防衛 ({report.sessionAnalytics.playstyleMbti.axes.guardianVsInvader.guardianPercent}%)</span>
                      <span className="text-faint">敵陣侵略 ({report.sessionAnalytics.playstyleMbti.axes.guardianVsInvader.invaderPercent}%)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-surface-subtle overflow-hidden flex">
                      <div className="h-full bg-success-600" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.guardianVsInvader.guardianPercent}%` }} />
                      <div className="h-full bg-danger-500" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.guardianVsInvader.invaderPercent}%` }} />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface border border-primary-edge-soft space-y-1.5 shadow-2xs">
                    <div className="flex justify-between text-xs font-bold text-foreground-soft">
                      <span>🧠 慎重観察型 ({report.sessionAnalytics.playstyleMbti.axes.deliberateVsReflex.deliberatePercent}%)</span>
                      <span className="text-faint">直感即断型 ({report.sessionAnalytics.playstyleMbti.axes.deliberateVsReflex.reflexPercent}%)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-surface-subtle overflow-hidden flex">
                      <div className="h-full bg-primary-600" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.deliberateVsReflex.deliberatePercent}%` }} />
                      <div className="h-full bg-primary-400" style={{ width: `${report.sessionAnalytics.playstyleMbti.axes.deliberateVsReflex.reflexPercent}%` }} />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-foreground-subtle leading-relaxed font-medium bg-surface/90 p-4 rounded-2xl border border-primary-edge-soft">
                  {report.sessionAnalytics.playstyleMbti.personalityAnalysis}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {report.sessionAnalytics.tiltTriggerMatrix && (
                  <div className="rounded-3xl border border-danger-edge-soft bg-danger-50/60 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-danger-edge-soft pb-3">
                      <h4 className="font-black text-xs text-danger-950 flex items-center gap-1.5">
                        <Flame size={15} className="text-danger-600" />
                        <span>メンタル耐久度 ＆ ティルト誘発トリガー</span>
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs text-foreground-soft">
                      <div className="p-3 bg-surface rounded-2xl border border-danger-edge-soft space-y-1">
                        <div className="text-[10px] text-faint font-bold">自陣インベード荒らし耐性</div>
                        <div className="font-bold text-foreground">{report.sessionAnalytics.tiltTriggerMatrix.invadeResistanceRating}</div>
                      </div>
                      <div className="p-3 bg-surface rounded-2xl border border-danger-edge-soft space-y-1">
                        <div className="text-[10px] text-faint font-bold">味方序盤崩壊時のメンタル</div>
                        <div className="font-bold text-foreground">{report.sessionAnalytics.tiltTriggerMatrix.teammateDeathResistance}</div>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted leading-relaxed font-medium">
                      💡 {report.sessionAnalytics.tiltTriggerMatrix.tiltInsight}
                    </p>
                  </div>
                )}

                {report.sessionAnalytics.goldEfficiency && (
                  <div className="rounded-3xl border border-primary-edge-soft bg-primary-50/60 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-primary-edge-soft pb-3">
                      <h4 className="font-black text-xs text-primary-950 flex items-center gap-1.5">
                        <Coins size={15} className="text-primary-600" />
                        <span>銭勘定 ＆ ゴールド変換効率 (Gold-to-Impact)</span>
                      </h4>
                      <span className="text-xs font-black text-primary-900">
                        {report.sessionAnalytics.goldEfficiency.damagePerGoldRating}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-foreground-soft">
                      <div className="p-3 bg-surface rounded-2xl border border-primary-edge-soft space-y-1">
                        <div className="text-[10px] text-faint font-bold">ゴールド死蔵率 (リコール遅延)</div>
                        <div className="font-bold text-foreground">{report.sessionAnalytics.goldEfficiency.goldStashRating}</div>
                      </div>
                    </div>

                    <p className="text-[11px] text-foreground-subtle leading-relaxed font-medium bg-surface p-3 rounded-2xl border border-primary-edge-soft/80">
                      {report.sessionAnalytics.goldEfficiency.efficiencyVerdict}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {report.sessionAnalytics.adversityBehavior && (
                  <div className="rounded-3xl border border-border bg-surface p-6 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                      <h4 className="font-black text-xs text-foreground flex items-center gap-1.5">
                        <ShieldAlert size={15} className="text-primary-600" />
                        <span>逆境・ビハインド時の人間性</span>
                      </h4>
                      <span className="text-xs font-black text-primary-700" title="レーン戦終了時にゴールド・経験値で対面に負けていた試合の勝率（Riotの試合データ）">
                        {report.sessionAnalytics.adversityBehavior.behindComebackWinRate != null
                          ? `レーン負け試合の勝率 ${report.sessionAnalytics.adversityBehavior.behindComebackWinRate}%（${report.sessionAnalytics.adversityBehavior.behindGames}試合）`
                          : 'レーン負け試合の記録なし'}
                      </span>
                    </div>

                    <div className="p-3.5 bg-primary-50/60 rounded-2xl border border-primary-edge-soft space-y-1">
                      <div className="text-xs font-black text-primary-950">
                        行動タイプ: {report.sessionAnalytics.adversityBehavior.archetype}
                      </div>
                      <p className="text-xs text-foreground-subtle leading-relaxed font-medium">
                        {report.sessionAnalytics.adversityBehavior.behaviorVerdict}
                      </p>
                    </div>

                    <p className="text-xs text-muted leading-relaxed font-medium">
                      🎯 <strong>逆転の鍵:</strong> {report.sessionAnalytics.adversityBehavior.recommendedMindset}
                    </p>
                  </div>
                )}

                {report.sessionAnalytics.cognitiveBiases && (
                  <div className="rounded-3xl border border-primary-edge-soft bg-primary-50/60 p-6 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-primary-edge-soft pb-3">
                      <h4 className="font-black text-xs text-primary-950 flex items-center gap-1.5">
                        <AlertOctagon size={15} className="text-primary-600" />
                        <span>無意識の悪癖・認知バイアス特定</span>
                      </h4>
                    </div>

                    {/* 2026-10-07: 実測値の条件に当てはまった時だけ表示（以前はロールだけで一律の文を出していた） */}
                    <div className="space-y-2 text-xs">
                      {report.sessionAnalytics.cognitiveBiases.recallHabitBias && (
                        <div className="p-3 bg-surface rounded-2xl border border-primary-edge-soft">
                          <div className="font-bold text-foreground">{report.sessionAnalytics.cognitiveBiases.recallHabitBias}</div>
                        </div>
                      )}
                      {report.sessionAnalytics.cognitiveBiases.mapAttentionBias && (
                        <div className="p-3 bg-surface rounded-2xl border border-primary-edge-soft">
                          <div className="font-bold text-foreground">{report.sessionAnalytics.cognitiveBiases.mapAttentionBias}</div>
                        </div>
                      )}
                      {!report.sessionAnalytics.cognitiveBiases.recallHabitBias && !report.sessionAnalytics.cognitiveBiases.mapAttentionBias && (
                        <div className="p-3 bg-surface rounded-2xl border border-primary-edge-soft text-muted-strong font-medium">
                          実測値（デス数・キル関与率・視界・即キュー）から、目立つ偏りは見つかりませんでした。
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 bg-surface rounded-2xl border border-primary-edge-soft space-y-1">
                      <div className="text-xs font-black text-primary-950 flex items-center gap-1">
                        <Sparkles size={13} className="text-primary-600" />
                        <span>矯正処方箋:</span>
                      </div>
                      <p className="text-xs text-foreground-soft leading-relaxed font-bold">
                        {report.sessionAnalytics.cognitiveBiases.actionPrescription}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
    </>
  );
}
