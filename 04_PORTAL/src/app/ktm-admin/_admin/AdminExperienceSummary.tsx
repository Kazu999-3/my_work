"use client";

import { getPlayerExperienceBadge } from "./adminUtils";

// 参加メンバー（Active）の経験層分析サマリー
// 2026-10-07: app/ktm-admin/page.tsx（1,885行）から分割。表示内容・動作は分割前と同じ。
export default function AdminExperienceSummary({ players }: { players: any[] }) {
              const activePlayers = players.filter(p => p.is_active);
              const totalActive = activePlayers.length;
              const newPlayers = activePlayers.filter(p => getPlayerExperienceBadge(p).tier === 'new');
              const lightPlayers = activePlayers.filter(p => getPlayerExperienceBadge(p).tier === 'light');
              const returningPlayers = activePlayers.filter(p => getPlayerExperienceBadge(p).tier === 'returning');
              const regularPlayers = activePlayers.filter(p => getPlayerExperienceBadge(p).tier === 'regular');
              const newLightRatio = totalActive > 0 ? Math.round(((newPlayers.length + lightPlayers.length + returningPlayers.length) / totalActive) * 100) : 0;

  return (
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-success-500/10 via-secondary-500/5 to-transparent border border-success-edge-strong/30 flex flex-col justify-between gap-2 shadow-xs mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔰</span>
                      <div>
                        <h4 className="text-xs font-black text-success-950">参加メンバーの経験層分析</h4>
                        <p className="text-[10px] text-muted">初心者・初参加の方も安心して参加できる環境です</p>
                      </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-success-500 text-stone-950">
                      新規・ライト・復帰層 {newLightRatio}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs pt-1 border-t border-success-edge-strong/20">
                    <span className="inline-flex items-center gap-1 font-bold text-success-900 bg-success-100/80 px-2 py-0.5 rounded-md text-[11px]">
                      🔰 初参加: <strong>{newPlayers.length}名</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-secondary-900 bg-secondary-100/80 px-2 py-0.5 rounded-md text-[11px]">
                      🌱 ライト: <strong>{lightPlayers.length}名</strong>
                    </span>
                    {returningPlayers.length > 0 && (
                      <span className="inline-flex items-center gap-1 font-bold text-primary-900 bg-primary-100/80 px-2 py-0.5 rounded-md text-[11px]">
                        ⏳ 復帰勢: <strong>{returningPlayers.length}名</strong>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 font-bold text-primary-900 bg-primary-100/80 px-2 py-0.5 rounded-md text-[11px]">
                      👑 常連: <strong>{regularPlayers.length}名</strong>
                    </span>
                  </div>
                </div>
  );
}
