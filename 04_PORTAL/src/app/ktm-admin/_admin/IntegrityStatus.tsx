"use client";

import { Info } from "lucide-react";

// MMR整合性ステータス（現在値と過去の対戦履歴から計算した期待値のズレ）
// 2026-10-07: app/ktm-admin/page.tsx（1,885行）から分割。表示内容・動作は分割前と同じ。
export default function IntegrityStatus({ integrityData, onRebuild }: { integrityData: any; onRebuild: () => void }) {
  return (
              <div className={`p-4 rounded-xl border ${
                integrityData.hasDiscrepancy 
                  ? 'bg-primary-100 border-primary-edge-soft text-primary-700' 
                  : 'bg-success-100 border-success-edge-soft text-success-700'
              }`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${integrityData.hasDiscrepancy ? 'bg-primary-100 text-primary-700' : 'bg-success-100 text-success-700'}`}>
                      <Info className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">MMR整合性ステータス</h4>
                      <p className="text-xs text-faint mt-0.5">
                        {integrityData.hasDiscrepancy 
                          ? `⚠️ ${integrityData.discrepancyCount}名のプレイヤーのMMRに過去の対戦履歴（累積値）とのズレが発生しています。Rebuildを実行して再計算してください。` 
                          : '✅ すべてのプレイヤーのMMRは過去の対戦履歴と完全に一致しています。'
                        }
                      </p>
                    </div>
                  </div>
                  {integrityData.hasDiscrepancy && (
                    <button
                      onClick={onRebuild}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-black font-black text-xs rounded-lg transition shadow-md shadow-primary-900/20"
                    >
                      🔄 Rebuildを実行
                    </button>
                  )}
                </div>
                {integrityData.hasDiscrepancy && (
                  <div className="mt-3 pt-3 border-t border-primary-edge-soft text-[10px] text-primary-700 max-h-24 overflow-y-auto space-y-1 font-mono">
                    {integrityData.discrepancies.map((d: any) => (
                      <div key={d.name}>
                        • {d.name}: 現在値と期待値にズレがあります (差分: TOP: {d.diff.TOP}, JG: {d.diff.JG}, MID: {d.diff.MID}, ADC: {d.diff.ADC}, SUP: {d.diff.SUP}, 総合: {d.diff.TOTAL})
                      </div>
                    ))}
                  </div>
                )}
              </div>
  );
}
