"use client";

import { Sparkles, Shield, Zap, Target, AlertTriangle, Crosshair, TrendingUp, Eye, CheckCircle2, MapPin, PieChart, Skull, Timer } from 'lucide-react';

// タブ1: 試合展開4分類・5大レーダー・致命的デス・視界・AI診断
// 2026-10-07: app/analyzer/page.tsx（1,939行）から分割。表示内容・動作は分割前と同じ。
export default function OverviewTab({ report, targetTier }: {
  report: any;
  targetTier: string;
}) {
  return (
    <>
            <div className="space-y-6">
              {/* 試合展開4タイプ分類 */}
              {report.sessionAnalytics?.gameOutcomeBreakdown && (
                <div className="rounded-3xl border border-border bg-surface p-5 md:p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 pb-3 gap-2">
                    <div>
                      <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                        <PieChart size={16} className="text-primary-600" />
                        <span>⚖️ 試合展開4タイプ自動分類 (Carry vs ACE Loss Index)</span>
                      </h3>
                      <p className="text-[11px] text-muted-strong font-medium mt-0.5">
                        直近の全試合を「自力勝利」「味方連携」「不運な負け」「防げた負け」の4パターンに客観分類
                      </p>
                    </div>
                    <span className="text-[11px] font-black text-primary-800 bg-primary-100/80 px-2.5 py-1 rounded-xl font-mono self-start sm:self-auto">
                      実戦 {report.sessionAnalytics.gameOutcomeBreakdown.hardCarryWins.count +
                        report.sessionAnalytics.gameOutcomeBreakdown.teamSupportedWins.count +
                        report.sessionAnalytics.gameOutcomeBreakdown.aceLosses.count +
                        report.sessionAnalytics.gameOutcomeBreakdown.throwLosses.count}試合 抽出解析
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
                    {/* 1. ハードキャリー勝利 */}
                    <div className="p-4 rounded-2xl bg-success-50/90 border border-success-edge-soft/90 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-success-950 flex items-center gap-1">
                            👑 ハードキャリー勝利
                          </span>
                          <span className="text-[9.5px] font-black text-success-800 bg-success-200/70 px-1.5 py-0.5 rounded">自力主導</span>
                        </div>
                        <div className="text-2xl font-black text-success-950 font-mono">
                          {report.sessionAnalytics.gameOutcomeBreakdown.hardCarryWins.percent}%{' '}
                          <span className="text-xs font-bold text-success-800">({report.sessionAnalytics.gameOutcomeBreakdown.hardCarryWins.count}戦)</span>
                        </div>
                        <p className="text-[11px] text-success-950 font-medium leading-relaxed">
                          <strong>【どういう試合？】</strong> 自身が高いキル・大ダメージ・CCで試合を動かし、圧倒的なリードを作って自らチームを勝利に導いた試合。
                        </p>
                      </div>
                      <div className="pt-2 border-t border-success-edge-soft/70 text-[10px] text-success-900/80 space-y-0.5">
                        <div>📊 <strong>判定基準:</strong> 勝利 ＋ KDA 5.0以上 または ダメージシェア24%以上</div>
                        <div>💡 <strong>意味:</strong> あなたの勝ちパターン。再現性を高めることが昇格の最短ルート。</div>
                      </div>
                    </div>

                    {/* 2. チーム協調勝利 */}
                    <div className="p-4 rounded-2xl bg-primary-50/90 border border-primary-edge-soft/90 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-primary-950 flex items-center gap-1">
                            🛡️ チーム協調勝利
                          </span>
                          <span className="text-[9.5px] font-black text-primary-800 bg-primary-200/70 px-1.5 py-0.5 rounded">堅実連携</span>
                        </div>
                        <div className="text-2xl font-black text-primary-950 font-mono">
                          {report.sessionAnalytics.gameOutcomeBreakdown.teamSupportedWins.percent}%{' '}
                          <span className="text-xs font-bold text-primary-800">({report.sessionAnalytics.gameOutcomeBreakdown.teamSupportedWins.count}戦)</span>
                        </div>
                        <p className="text-[11px] text-primary-950 font-medium leading-relaxed">
                          <strong>【どういう試合？】</strong> 無理なキルを追わず低デスを維持。視界管理・味方キャリーの防衛（ピール）・オブジェクト確保で手堅く掴んだ勝利。
                        </p>
                      </div>
                      <div className="pt-2 border-t border-primary-edge-soft/70 text-[10px] text-primary-900/80 space-y-0.5">
                        <div>📊 <strong>判定基準:</strong> 勝利 ＋ 安定した低被デス・視界貢献・アシスト中心</div>
                        <div>💡 <strong>意味:</strong> 「自分が育たなくても勝てる」高い安定性とチーム貢献力の証拠。</div>
                      </div>
                    </div>

                    {/* 3. エース敗北 */}
                    <div className="p-4 rounded-2xl bg-primary-50/90 border border-primary-edge-soft/90 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-primary-950 flex items-center gap-1">
                            😭 エース敗北 (味方崩壊)
                          </span>
                          <span className="text-[9.5px] font-black text-primary-800 bg-primary-200/70 px-1.5 py-0.5 rounded">不運・奮闘</span>
                        </div>
                        <div className="text-2xl font-black text-primary-950 font-mono">
                          {report.sessionAnalytics.gameOutcomeBreakdown.aceLosses.percent}%{' '}
                          <span className="text-xs font-bold text-primary-800">({report.sessionAnalytics.gameOutcomeBreakdown.aceLosses.count}戦)</span>
                        </div>
                        <p className="text-[11px] text-primary-950 font-medium leading-relaxed">
                          <strong>【どういう試合？】</strong> 自身は好調（低デス・高KDA）で有利を作っていたが、他レーンの大量崩壊や味方のミスで押し切られた悔しい敗北。
                        </p>
                      </div>
                      <div className="pt-2 border-t border-primary-edge-soft/70 text-[10px] text-primary-900/80 space-y-0.5">
                        <div>📊 <strong>判定基準:</strong> 敗北 ＋ 自身はKDA 3.8以上 ＆ 低被デス（4デス以下）</div>
                        <div>💡 <strong>意味:</strong> あなた自身に大きな非はない「不運な負け」。引きずらず割り切るべき試合。</div>
                      </div>
                    </div>

                    {/* 4. 集団戦・逆転負け */}
                    <div className="p-4 rounded-2xl bg-danger-50/90 border border-danger-edge-soft/90 flex flex-col justify-between space-y-3 shadow-2xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-danger-950 flex items-center gap-1">
                            ⚠️ 集団戦・逆転負け
                          </span>
                          <span className="text-[9.5px] font-black text-danger-800 bg-danger-200/70 px-1.5 py-0.5 rounded">要改善</span>
                        </div>
                        <div className="text-2xl font-black text-danger-950 font-mono">
                          {report.sessionAnalytics.gameOutcomeBreakdown.throwLosses.percent}%{' '}
                          <span className="text-xs font-bold text-danger-800">({report.sessionAnalytics.gameOutcomeBreakdown.throwLosses.count}戦)</span>
                        </div>
                        <p className="text-[11px] text-danger-950 font-medium leading-relaxed">
                          <strong>【どういう試合？】</strong> 自身のデスが嵩んだり、終盤のオブジェクト前や視界のない場所での孤立被キャッチから形勢を逆転されてしまった敗北。
                        </p>
                      </div>
                      <div className="pt-2 border-t border-danger-edge-soft/70 text-[10px] text-danger-900/80 space-y-0.5">
                        <div>📊 <strong>判定基準:</strong> 敗北 ＋ 被デス5回以上 または 終盤の重要局面でのデス</div>
                        <div>💡 <strong>意味:</strong> 最も改善価値の高い「防げた負け筋」。このデスの原因を無くせば即昇格。</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-background border border-border/80 text-xs text-foreground-subtle space-y-1">
                    <div className="font-black text-foreground flex items-center gap-1.5">
                      <span>💡 展開傾向診断:</span>
                    </div>
                    <p className="leading-relaxed font-medium">
                      {report.sessionAnalytics.gameOutcomeBreakdown.dominantOutcomeSummary}
                    </p>
                  </div>
                </div>
              )}

              {/* 2カラムHUDグリッド */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 flex flex-col gap-6">
                  {/* 5大レーダー解析スコアカード */}
                  <div className="rounded-3xl border border-border bg-surface p-5 md:p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-primary-600" />
                        <h3 className="font-black text-sm text-foreground">
                          プレイスタイル 5大レーダー客観解析
                        </h3>
                        {report.sessionAnalytics?.roleConfig && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary-100 text-primary-900 border border-primary-edge">
                            {report.sessionAnalytics.roleConfig.roleIcon} {report.sessionAnalytics.roleConfig.roleName} 特化診断
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-faint">
                        Riot API実測値 ＆ 目標【{targetTier}】基準
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {(() => {
                        const role = (report.summoner?.role || report.sessionAnalytics?.roleConfig?.roleId || 'JUNGLE').toUpperCase();
                        const isSup = role === 'UTILITY' || role === 'SUPPORT' || role === 'SUP';
                        const isJg = role === 'JUNGLE' || role === 'JG';
                        const isMid = role === 'MIDDLE' || role === 'MID';
                        const isBot = role === 'BOTTOM' || role === 'BOT' || role === 'ADC';

                        let radarItems: Array<{
                          label: string;
                          score: number | null;
                          valueText: string;
                          barBg: string;
                          textColor: string;
                          subTextColor: string;
                          icon: any;
                          badge?: string;
                        }> = [];

                        if (isSup) {
                          // サポート特化 5大項目
                          const visionScore = Math.min(100, Math.max(20, Math.round((report.metrics.vision.visionScorePerMin / 2.3) * 75)));
                          radarItems = [
                            {
                              label: '① 視界支配・ピンクワード購入',
                              score: visionScore,
                              valueText: `分間視界 ${report.metrics.vision.visionScorePerMin}/分`,
                              barBg: 'bg-success-500',
                              textColor: 'text-success-700',
                              subTextColor: 'text-success-600',
                              icon: Eye,
                              badge: visionScore < 50 ? '要改善' : undefined,
                            },
                            {
                              label: '② 序盤ローム・他レーン支援力',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-secondary-500',
                              textColor: 'text-secondary-700',
                              subTextColor: 'text-secondary-600',
                              icon: Zap,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '③ 集団戦CC・キャリー防衛 (ピール)',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-600',
                              icon: Shield,
                            },
                            {
                              label: '④ オブジェクト先制視界管理',
                              score: report.metrics.objectives.score,
                              valueText: `ドラゴン・バロン・ヘラルド獲得率 ${report.metrics.objectives.score != null ? `${report.metrics.objectives.score}%` : '未計測'} ／ ${report.sessionAnalytics?.earlyTimelineImpact?.objLabel || 'ドラゴン確保時勝率'}: ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate != null ? `${report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%` : '未計測'}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ 低被デス・生存ポジショニング',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-danger-500',
                              textColor: 'text-danger-700',
                              subTextColor: 'text-danger-600',
                              icon: Crosshair,
                            },
                          ];
                        } else if (isJg) {
                          radarItems = [
                            {
                              label: '① 生存力・被デス回避',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-success-500',
                              textColor: 'text-success-700',
                              subTextColor: 'text-success-600',
                              icon: Shield,
                            },
                            {
                              label: '② ファーム効率 (CS/分)',
                              score: report.metrics.farm.score,
                              valueText: `分間CS ${report.metrics.farm.csPerMin}`,
                              barBg: 'bg-secondary-500',
                              textColor: 'text-secondary-700',
                              subTextColor: 'text-secondary-600',
                              icon: Zap,
                            },
                            {
                              label: '③ 15分キル関与 (KP@15)',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-danger-500',
                              textColor: 'text-danger-700',
                              subTextColor: 'text-danger-600',
                              icon: AlertTriangle,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '④ オブジェクト確保 (Obj Control)',
                              score: report.metrics.objectives.score,
                              valueText: `ドラゴン・バロン・ヘラルド獲得率 ${report.metrics.objectives.score != null ? `${report.metrics.objectives.score}%` : '未計測'} ／ グラブ/ドラゴン優位時勝率 ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate != null ? `${report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%` : '未計測'}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ 集団戦ポジショニング (Teamfight)',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-600',
                              icon: Crosshair,
                            },
                          ];
                        } else if (isMid) {
                          radarItems = [
                            {
                              label: '① 生存力・被ガンク回避',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-success-500',
                              textColor: 'text-success-700',
                              subTextColor: 'text-success-600',
                              icon: Shield,
                            },
                            {
                              label: '② CS精度 ＆ プッシュ主導権',
                              score: report.metrics.farm.score,
                              valueText: `分間CS ${report.metrics.farm.csPerMin}`,
                              barBg: 'bg-secondary-500',
                              textColor: 'text-secondary-700',
                              subTextColor: 'text-secondary-600',
                              icon: Zap,
                            },
                            {
                              label: '③ ローム・サイド介入率 (KP)',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-danger-500',
                              textColor: 'text-danger-700',
                              subTextColor: 'text-danger-600',
                              icon: AlertTriangle,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '④ リバー・オブジェクト主導権',
                              score: report.metrics.objectives.score,
                              valueText: `ドラゴン・バロン・ヘラルド獲得率 ${report.metrics.objectives.score != null ? `${report.metrics.objectives.score}%` : '未計測'} ／ オブジェクト優位時勝率 ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate != null ? `${report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%` : '未計測'}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ 集団戦DPS ＆ KDA',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-600',
                              icon: Crosshair,
                            },
                          ];
                        } else if (isBot) {
                          radarItems = [
                            {
                              label: '① 集団戦ポジショニング・低デス',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-success-500',
                              textColor: 'text-success-700',
                              subTextColor: 'text-success-600',
                              icon: Shield,
                            },
                            {
                              label: '② 分間CS ＆ リソース回収',
                              score: report.metrics.farm.score,
                              valueText: `分間CS ${report.metrics.farm.csPerMin}`,
                              barBg: 'bg-secondary-500',
                              textColor: 'text-secondary-700',
                              subTextColor: 'text-secondary-600',
                              icon: Zap,
                            },
                            {
                              label: '③ 終盤DPS占有 ＆ キル関与 (KP)',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-danger-500',
                              textColor: 'text-danger-700',
                              subTextColor: 'text-danger-600',
                              icon: AlertTriangle,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '④ オブジェクトバースト力',
                              score: report.metrics.objectives.score,
                              valueText: `ドラゴン・バロン・ヘラルド獲得率 ${report.metrics.objectives.score != null ? `${report.metrics.objectives.score}%` : '未計測'} ／ ドラゴン確保時勝率 ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate != null ? `${report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%` : '未計測'}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ KDA ＆ キャリー力',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-600',
                              icon: Crosshair,
                            },
                          ];
                        } else {
                          // TOP
                          radarItems = [
                            {
                              label: '① タイマン生存・被ソロキル回避',
                              score: report.metrics.survival.score,
                              valueText: `平均被デス ${report.metrics.survival.avgDeaths}`,
                              barBg: 'bg-success-500',
                              textColor: 'text-success-700',
                              subTextColor: 'text-success-600',
                              icon: Shield,
                            },
                            {
                              label: '② CS精度 ＆ ウェーブ管理',
                              score: report.metrics.farm.score,
                              valueText: `分間CS ${report.metrics.farm.csPerMin}`,
                              barBg: 'bg-secondary-500',
                              textColor: 'text-secondary-700',
                              subTextColor: 'text-secondary-600',
                              icon: Zap,
                            },
                            {
                              label: '③ TP・集団戦合流力 (KP)',
                              score: report.metrics.combat.score,
                              valueText: `キル関与率 ${report.metrics.combat.kpPercent}%`,
                              barBg: 'bg-danger-500',
                              textColor: 'text-danger-700',
                              subTextColor: 'text-danger-600',
                              icon: AlertTriangle,
                              badge: report.metrics.combat.score < 50 ? '改善余地あり' : undefined,
                            },
                            {
                              label: '④ スプリットプッシュ圧力 ＆ グラブ確保',
                              score: report.metrics.objectives.score,
                              valueText: `ドラゴン・バロン・ヘラルド獲得率 ${report.metrics.objectives.score != null ? `${report.metrics.objectives.score}%` : '未計測'} ／ グラブ確保時勝率 ${report.sessionAnalytics?.earlyTimelineImpact?.voidgrubWinRate != null ? `${report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%` : '未計測'}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-700',
                              icon: Target,
                            },
                            {
                              label: '⑤ フロントライン耐久 ＆ KDA',
                              score: report.metrics.teamfight.score,
                              valueText: `KDA ${report.metrics.teamfight.avgKda}`,
                              barBg: 'bg-primary-500',
                              textColor: 'text-primary-700',
                              subTextColor: 'text-primary-600',
                              icon: Crosshair,
                            },
                          ];
                        }

                        return radarItems.map((item, idx) => {
                          const IconComp = item.icon;
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-xs font-bold">
                                <span className={`${item.textColor} flex items-center gap-1`}>
                                  <IconComp size={13} /> {item.label}
                                  {item.badge && (
                                    <span className="text-[10px] bg-danger-100 text-danger-800 px-1.5 py-0.2 rounded font-black">
                                      {item.badge}
                                    </span>
                                  )}
                                </span>
                                <span className="text-foreground font-black">
                                  {item.score == null ? '—' : `${item.score}点`}{' '}
                                  <span className={`text-[10px] ${item.subTextColor} font-normal`}>
                                    ({item.valueText})
                                  </span>
                                </span>
                              </div>
                              <div className="h-2.5 w-full rounded-full bg-surface-subtle overflow-hidden">
                                <div
                                  className={`h-full ${item.barBg} rounded-full`}
                                  style={{ width: item.score == null ? '0%' : `${Math.min(100, Math.max(5, item.score))}%` }}
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* 致命的デス (Throw) ＆ 序盤タイムライン因果 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.sessionAnalytics?.fatalDeathAnalytics && (
                      <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs space-y-2.5">
                        <div className="text-xs font-black text-foreground flex items-center gap-1.5 border-b border-stone-100 pb-2">
                          <Skull size={14} className="text-danger-600" />
                          <span>致命的デス (Throw) 検知</span>
                        </div>
                        <div className="space-y-1.5 text-xs text-foreground-subtle">
                          <div className="flex justify-between font-bold">
                            <span>Obj直前デス:</span>
                            <span className="font-mono text-foreground">
                              {report.sessionAnalytics.fatalDeathAnalytics.objPreSpawnDeathsCount}回 ({report.sessionAnalytics.fatalDeathAnalytics.objPreSpawnDeathsRate}%)
                            </span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>孤立被キャッチ率:</span>
                            <span className="font-mono text-foreground">
                              {report.sessionAnalytics.fatalDeathAnalytics.isolatedDeathsPercent}%
                            </span>
                          </div>
                          <div className="flex justify-between font-bold pt-1 border-t border-stone-100">
                            <span>スロー危険度:</span>
                            <span className="font-black text-success-700">
                              {report.sessionAnalytics.fatalDeathAnalytics.fatalThrowRating}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {report.sessionAnalytics?.earlyTimelineImpact && (
                      <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs space-y-2.5">
                        <div className="text-xs font-black text-foreground flex items-center gap-1.5 border-b border-stone-100 pb-2">
                          <Timer size={14} className="text-primary-600" />
                          <span>序盤14分 タイムライン因果</span>
                        </div>
                        <div className="space-y-1.5 text-xs text-foreground-subtle">
                          <div className="flex justify-between font-bold">
                            <span>初デス平均時間:</span>
                            <span className="font-mono text-foreground">
                              {report.sessionAnalytics.earlyTimelineImpact.firstDeathAvgMinute}
                            </span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>{report.sessionAnalytics.earlyTimelineImpact.objLabel || '序盤オブジェクト獲得時勝率'}:</span>
                            <span className="font-mono text-success-700">
                              {report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate != null
                                ? `${report.sessionAnalytics.earlyTimelineImpact.voidgrubWinRate}%`
                                : '未計測 (データ不足)'}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-strong pt-1 border-t border-stone-100 font-medium space-y-1">
                            <div>{report.sessionAnalytics.earlyTimelineImpact.plateGoldImpact}</div>
                            <div className="text-[10px] text-faint">
                              ※試合優位チームがオブジェクトを確保しやすい相関を含みます
                            </div>
                          </div>
                          {report.sessionAnalytics.earlyTimelineImpact.roleObjectiveFocus && (
                            <div className="text-[10.5px] text-primary-700 bg-primary-50/70 p-2 rounded-xl font-medium leading-relaxed">
                              🎯 {report.sessionAnalytics.earlyTimelineImpact.roleObjectiveFocus}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 視界客観データ */}
                  <div className="rounded-3xl border border-border bg-surface p-5 md:p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                      <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                        <Eye size={16} className="text-primary-600" />
                        <span>視界・コントロール客観解析 (League of Graphs / Riot API連動)</span>
                      </h3>
                      <span className="text-xs font-black text-primary-700">
                        分間視界 {report.metrics.vision.visionScorePerMin}/分
                      </span>
                    </div>

                    {/* 2026-10-07: 「自陣防衛/敵陣ディープ」のワード比率は計測しておらず視界スコアから作った値だったため削除 */}
                    <p className="text-xs text-muted leading-relaxed font-medium bg-background p-3 rounded-2xl border border-border/60">
                      {report.analysis.visionAnalysis}
                    </p>
                  </div>
                </div>

                {/* 右側 (5カラム): AI総合深層診断・最大の敗因・アクション */}
                <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-4">
                  {/* 3大強み */}
                  <div className="rounded-3xl border border-success-edge-soft bg-success-50/60 p-5 shadow-xs space-y-2.5">
                    <div className="text-xs font-black text-success-950 flex items-center gap-1.5">
                      <span>🌟</span>
                      <span>実測データから導かれた「3大強み」</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-foreground-subtle font-medium">
                      {report.analysis.strengths?.map((s: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 size={13} className="text-success-600 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 最大の敗因・ボトルネック */}
                  <div className="rounded-3xl border border-primary-edge bg-primary-50/80 p-5 shadow-xs space-y-2.5">
                    <div className="text-xs font-black text-primary-950 flex items-center gap-1.5">
                      <span className="p-1 rounded-md bg-primary-200 text-primary-900">⚠️</span>
                      <span>【{targetTier}】到達を阻む最大のボトルネック</span>
                    </div>
                    <p className="text-xs text-foreground-soft leading-relaxed font-medium bg-surface p-3 rounded-2xl border border-primary-edge-soft">
                      {report.analysis.coreBottleNeck}
                    </p>
                  </div>

                  {/* 決定版・次戦の具体的急所アクション */}
                  <div className="rounded-3xl border border-primary-edge bg-primary-50/80 p-5 shadow-xs space-y-3">
                    <div className="text-xs font-black text-primary-950 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-primary-600" />
                      <span>【{targetTier}】昇格への決定版アクション</span>
                    </div>

                    <div className="bg-surface p-3.5 rounded-2xl border border-primary-edge-soft space-y-2">
                      <div className="text-xs font-bold text-foreground leading-relaxed">
                        {report.analysis.actionPlan}
                      </div>

                      {report.analysis.goldenDeepWard && (
                        <div className="pt-2 border-t border-primary-edge-soft text-[11px] text-muted space-y-1">
                          <div className="font-bold text-primary-900 flex items-center gap-1">
                            <MapPin size={12} className="text-primary-600" />
                            <span>推奨: {report.analysis.goldenDeepWard.spot}</span>
                          </div>
                          <div>⏰ {report.analysis.goldenDeepWard.timing}</div>
                          <div className="text-muted-strong">{report.analysis.goldenDeepWard.reason}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
    </>
  );
}
