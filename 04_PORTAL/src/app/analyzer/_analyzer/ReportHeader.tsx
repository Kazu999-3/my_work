"use client";


// 総合カルテのヘッダー
// 2026-10-07: app/analyzer/page.tsx（1,939行）から分割。表示内容・動作は分割前と同じ。
export default function ReportHeader({ report, targetTier }: {
  report: any;
  targetTier: string;
}) {
  return (
    <>
          {/* 1. 総合カルテヘッダーバナー */}
          <div className="rounded-3xl border border-border bg-surface p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-500 text-white flex items-center justify-center text-2xl font-black shadow-sm shrink-0">
                👑
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-foreground">
                    {report.summoner.name}#{report.summoner.tag}
                  </h2>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-surface-subtle text-foreground-subtle border border-border">
                    現在: {report.summoner.tier}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-success-100 text-success-900 border border-success-edge">
                    目標: <strong>{targetTier}</strong>
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-900 border border-primary-edge-soft">
                    {(() => {
                      const r = (report.summoner.role || '').toUpperCase();
                      if (r === 'UTILITY' || r === 'SUPPORT') return 'SUPPORT (サポート)';
                      if (r === 'MIDDLE' || r === 'MID') return 'MID (ミッド)';
                      if (r === 'BOTTOM' || r === 'ADC') return 'ADC (ボット)';
                      if (r === 'TOP') return 'TOP (トップ)';
                      return 'JUNGLE (ジャングル)';
                    })()} メイン
                  </span>
                  {report.summoner.sampleMatchesCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-subtle text-muted border border-border">
                      SoloQ実測 {report.summoner.sampleMatchesCount}試合連動
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-success-700 flex items-center gap-2 mt-1">
                  <span>
                    タイプ:{' '}
                    <strong>
                      {report.analysis?.styleTypeName ||
                        report.sessionAnalytics?.playstyleMbti?.typeName ||
                        (report.summoner?.role === 'UTILITY'
                          ? '視界制圧＆味方ピール支援型'
                          : 'ファームスケーリング＆セーフティ型')}
                    </strong>
                  </span>
                  <span className="text-[10px] px-2 py-0.2 rounded bg-success-100 text-success-900 border border-success-edge">
                    {report.analysis?.styleBadge ||
                      (report.summoner?.role === 'UTILITY' ? '視界スコア Sランク' : '安定度 Sランク')}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] text-faint font-mono">
                統合データソース: Riot API / your.gg / League of Graphs
              </div>
              <div className="text-xs font-bold text-muted mt-0.5">
                目標ランク逆算解析完了 (リアルタイム)
              </div>
            </div>
          </div>

    </>
  );
}
