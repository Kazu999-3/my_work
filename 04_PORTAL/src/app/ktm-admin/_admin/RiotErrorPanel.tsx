"use client";

import { RefreshCw, AlertTriangle } from "lucide-react";
import type { RiotSyncError } from "./useRosterSync";

// Riot API 同期エラー修正パネル（Riot ID を直して個別に再同期）
// 2026-10-07: app/ktm-admin/page.tsx（1,885行）から分割。表示内容・動作は分割前と同じ。
export default function RiotErrorPanel({ riotSyncErrors, reSyncingPlayerId, onClose, onResolve }: {
  riotSyncErrors: RiotSyncError[];
  reSyncingPlayerId: number | null;
  onClose: () => void;
  onResolve: (playerId: number, newIgn: string) => void;
}) {
  return (
              <div className="bg-primary-100 border border-primary-edge-soft rounded-xl p-5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary-500"></div>
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-lg font-bold text-primary-700 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-primary-500 animate-pulse" />
                    Riot API 同期エラー修正パネル ({riotSyncErrors.length}件)
                  </h2>
                  <button 
                    onClick={onClose} 
                    className="text-muted-strong hover:text-foreground text-xs bg-surface border border-border rounded px-2 py-1 transition"
                  >
                    パネルを閉じる
                  </button>
                </div>
                <p className="text-faint text-xs mb-4">
                  Riot APIとの同期中に「Riot IDが存在しない」「PUUIDが見つからない」等のエラーが発生しました。<br />
                  正しい Riot ID (Name#TAG 形式) に修正して「保存して再同期」を押してください。
                </p>

                <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2">
                  {riotSyncErrors.map((errorPlayer) => (
                    <div key={errorPlayer.id} className="bg-surface/60 border border-border rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs hover:border-primary-edge-soft transition">
                      <div className="space-y-1">
                        <span className="font-bold text-foreground text-sm">{errorPlayer.name}</span>
                        <div className="text-danger-700 text-[11px] font-mono flex items-center gap-1">
                          <span>❌ {errorPlayer.error}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex-1 md:flex-none">
                          <input
                            type="text"
                            placeholder="Name#TAG"
                            defaultValue={errorPlayer.ign}
                            id={`error-ign-${errorPlayer.id}`}
                            className="w-full md:w-48 bg-background border border-border text-foreground rounded px-2 py-1.5 outline-none focus:border-primary-edge-strong placeholder-stone-600 font-mono text-xs"
                          />
                        </div>
                        <button
                          onClick={() => {
                            const inputEl = document.getElementById(`error-ign-${errorPlayer.id}`) as HTMLInputElement;
                            if (inputEl) {
                              onResolve(errorPlayer.id, inputEl.value);
                            }
                          }}
                          disabled={reSyncingPlayerId === errorPlayer.id}
                          className="px-4 py-1.5 bg-primary-600 hover:bg-primary-500 text-black font-bold rounded transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                        >
                          {reSyncingPlayerId === errorPlayer.id ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              同期中...
                            </>
                          ) : (
                            "保存して再同期"
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
  );
}
