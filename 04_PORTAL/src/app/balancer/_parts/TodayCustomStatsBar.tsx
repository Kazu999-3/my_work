"use client";

import React, { useEffect, useState } from "react";
import { Trophy, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import type { TodayPlayerStat } from "../../../lib/balancer/todayStats";

interface TodayStatsResponse {
  ok: boolean;
  dateLabel?: string;
  totalMatches?: number;
  stats?: TodayPlayerStat[];
}

export default function TodayCustomStatsBar({ currentUserName }: { currentUserName?: string | null }) {
  const [data, setData] = useState<TodayStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const fetchTodayStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/balancer/today-stats", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // 失敗時は非表示フォールバック
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayStats();
  }, []);

  if (loading && !data) return null;
  if (!data || !data.ok) return null;

  const stats = data.stats || [];
  const totalMatches = data.totalMatches || 0;
  const myStat = currentUserName
    ? stats.find((s) => s.name.toLowerCase() === currentUserName.toLowerCase())
    : undefined;

  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-2xs space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-black text-foreground">
            <Trophy className="w-3.5 h-3.5 text-primary-600" />
            本日のカスタム戦績
          </span>
          <span className="text-[10px] font-bold text-muted-strong bg-surface-subtle px-2 py-0.5 rounded-full border border-border">
            {data.dateLabel} (5:00〜) ・ {totalMatches}戦
          </span>
          {myStat && (
            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-900 border border-primary-edge">
              あなた: {myStat.games}戦 {myStat.wins}勝{myStat.losses}敗 ({myStat.winRate}%)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={fetchTodayStats}
            disabled={loading}
            className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-surface-subtle transition cursor-pointer"
            title="本日の戦績を更新"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {stats.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground-subtle border border-border transition cursor-pointer"
            >
              {expanded ? (
                <>
                  閉じる <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  全員 ({stats.length}名) <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {totalMatches === 0 ? (
        <p className="text-[11px] text-muted-strong">
          本日の定期カスタム試合はまだ記録されていません。
        </p>
      ) : (
        expanded && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {stats.map((s) => {
              const isMe = currentUserName && s.name.toLowerCase() === currentUserName.toLowerCase();
              const highWr = s.winRate >= 60;
              const lowWr = s.winRate <= 40;
              return (
                <div
                  key={s.name}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] ${
                    isMe
                      ? "bg-primary-100/80 border-primary-edge-strong text-primary-950 font-black"
                      : "bg-surface-subtle border-border text-foreground-soft font-bold"
                  }`}
                >
                  <span className="truncate max-w-[110px]">{s.name}</span>
                  <span className="font-mono text-[10px] text-muted-strong">
                    {s.wins}勝{s.losses}敗
                  </span>
                  <span
                    className={`font-mono font-black text-[10px] ${
                      highWr ? "text-success-700" : lowWr ? "text-danger-700" : "text-foreground"
                    }`}
                  >
                    {s.winRate}%
                  </span>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
