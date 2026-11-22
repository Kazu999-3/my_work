"use client";

import React from "react";
import { getDownwardOffroleRule, TIER_BAND_THRESHOLD, type TierBandSplitResult } from "../../../lib/balancer/tierBand";
import type { TableSplit } from "./types";

// 定期カスタム 2帯ロビー編成パネル（SPEC 10: MMR 1450 基準）
export default function TableSplitPanel({
  selectedTable,
  setSelectedTable,
  tableSplit,
}: {
  selectedTable: TableSplit | null;
  setSelectedTable: React.Dispatch<React.SetStateAction<TableSplit | null>>;
  tableSplit: TierBandSplitResult;
}) {
  const promotedSet = new Set(tableSplit.promotedIds);
  const supportSet = new Set(tableSplit.downwardSupportIds);

  return (
    <div className="bg-surface border border-primary-edge-soft rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-black text-primary-700">
            🏟️ 帯分けロビー編成（参加 {tableSplit.total}人 / 基準 MMR {TIER_BAND_THRESHOLD}）
          </span>
          <span className="text-[10px] text-muted-strong">
            上位帯不足時は格上許可ONからMMR近い順に自動繰り上げ ／ 格下サポートはオフレーン制限
          </span>
        </div>
        {selectedTable && (
          <button
            type="button"
            onClick={() => setSelectedTable(null)}
            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground-subtle border border-border transition cursor-pointer"
          >
            選択解除（全員対象に戻す）
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[tableSplit.upper, tableSplit.lower].map((t) => {
          const isSelected = selectedTable?.label === t.label;
          const canSelect = t.members.length >= 10;
          return (
            <div
              key={t.label}
              className={`rounded-xl border p-3 transition ${
                isSelected ? "border-primary-edge-strong bg-primary-100/60" : "border-border bg-black/[0.03]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-foreground">
                    {t.label}（{t.members.length}名）
                  </span>
                  {t.promotedIds.length > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-success-500/15 text-success-700 border border-success-edge-soft">
                      ⬆️ 繰り上げ +{t.promotedIds.length}
                    </span>
                  )}
                  {t.downwardSupportIds.length > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary-500/15 text-secondary-700 border border-secondary-edge-soft">
                      🔽 中初級帯サポ +{t.downwardSupportIds.length}
                    </span>
                  )}
                  {t.shortageCount > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-danger-100 text-danger-700 border border-danger-edge">
                      あと{t.shortageCount}人不足
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!canSelect}
                  onClick={() => setSelectedTable(isSelected ? null : { label: t.label, ids: t.ids, band: t.band })}
                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition shrink-0 ${
                    !canSelect
                      ? "bg-surface-subtle text-muted-strong opacity-50 cursor-not-allowed"
                      : isSelected
                      ? "bg-primary-600 text-white cursor-pointer"
                      : "bg-surface-subtle text-foreground-subtle hover:bg-surface-hover cursor-pointer"
                  }`}
                >
                  {isSelected ? "選択中 ✓" : canSelect ? "この帯を選ぶ" : "10人未満"}
                </button>
              </div>

              <div className="text-[10px] text-faint space-y-0.5 max-h-44 overflow-y-auto">
                {t.members.length === 0 ? (
                  <div className="text-muted-strong py-2 text-center">該当する参加者がいません</div>
                ) : (
                  t.members.map((m: any) => {
                    const isPromoted = promotedSet.has(m.id) && t.band === "UPPER";
                    const isSupporter = supportSet.has(m.id) && t.band === "LOWER";
                    const strict = isSupporter && getDownwardOffroleRule(m.mmr) === "STRICT_OFFROLE";
                    return (
                      <div key={m.id} className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="truncate text-foreground-soft font-medium">{m.name}</span>
                          {isPromoted && (
                            <span className="text-[9px] font-bold px-1 rounded bg-success-500/15 text-success-700 shrink-0">
                              ⬆️ 繰上
                            </span>
                          )}
                          {isSupporter && (
                            <span
                              className="text-[9px] font-bold px-1 rounded bg-secondary-500/15 text-secondary-700 shrink-0"
                              title={strict ? "メイン・サブ除外（完全オフレーン）" : "メイン除外（オフレーン）"}
                            >
                              {strict ? "🔽 完全オフレーン" : "🔽 オフレーン"}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-muted-strong shrink-0">{m.mmr || 1200}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
