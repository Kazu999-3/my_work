"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getChampIcon } from "@/lib/ddragonClient";
import { Shield, Swords, Coins, Eye, Activity, Sparkles, Clock, Target } from "lucide-react";

interface LiveGameData {
  inGame: boolean;
  gameTimeSec?: number;
  activePlayer?: {
    championName: string;
    summonerName: string;
    level: number;
    currentGold: number;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    wardScore: number;
  };
  allPlayers?: Array<{
    championName: string;
    team: string;
    position: string;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    items: number[];
  }>;
}

export default function OverlayPage() {
  const [data, setData] = useState<LiveGameData>({ inGame: false });
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const res = await fetch('/api/overlay/live-client-data');
        if (res.ok) {
          const json = await res.json();
          if (mounted) {
            setData(json);
            setLastUpdated(Date.now());
          }
        }
      } catch (err) {
        if (mounted) setData({ inGame: false });
      }
    };

    poll();
    const timer = setInterval(poll, 1000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const formatTime = (sec?: number) => {
    if (!sec) return '00:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ゲーム未起動時の待機画面
  if (!data.inGame) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-transparent select-none">
        <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-black/75 px-4 py-2 text-xs font-semibold text-zinc-300 shadow-2xl backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <span>Sovereign HUD: LoL試合待機中 (127.0.0.1:2999)</span>
        </div>
      </div>
    );
  }

  const me = data.activePlayer;
  const gameMin = Math.max(1, (data.gameTimeSec || 0) / 60);
  const csPerMin = me ? (me.cs / gameMin).toFixed(1) : '0.0';

  // 対面の特定（同じpositionの敵チームプレイヤー）
  const myTeam = data.allPlayers?.find((p) => p.championName === me?.championName)?.team;
  const myPos = data.allPlayers?.find((p) => p.championName === me?.championName)?.position;
  const enemy = data.allPlayers?.find((p) => p.team !== myTeam && p.position === myPos && myPos !== 'NONE');
  const csDiff = enemy && me ? me.cs - enemy.cs : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent select-none font-sans p-4 pointer-events-none">
      {/* 画面上部: リアルタイムタクティカルバー */}
      <div className="mx-auto flex w-fit items-center gap-4 rounded-2xl border border-white/15 bg-black/80 px-5 py-2.5 shadow-2xl backdrop-blur-xl">
        {/* チャンピオン & レベル */}
        {me && (
          <div className="flex items-center gap-2.5 border-r border-white/10 pr-4">
            <div className="relative">
              <Image
                src={getChampIcon(me.championName)}
                alt={me.championName}
                width={36}
                height={36}
                className="h-9 w-9 rounded-xl border border-white/20 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 rounded-full bg-rose-600 px-1 text-[9px] font-black text-white">
                {me.level}
              </span>
            </div>
            <div>
              <div className="text-xs font-black text-zinc-100">{me.championName}</div>
              <div className="text-[10px] font-mono font-bold text-rose-400">
                {me.kills} / <span className="text-zinc-400">{me.deaths}</span> / {me.assists}
              </div>
            </div>
          </div>
        )}

        {/* 試合時間 */}
        <div className="flex items-center gap-1.5 border-r border-white/10 pr-4 text-xs font-mono font-black text-zinc-200">
          <Clock className="h-3.5 w-3.5 text-zinc-400" />
          <span>{formatTime(data.gameTimeSec)}</span>
        </div>

        {/* CS ＆ 分間CS */}
        {me && (
          <div className="flex items-center gap-3 border-r border-white/10 pr-4 text-xs font-mono">
            <div>
              <div className="text-[10px] font-bold uppercase text-zinc-400">CS / 分</div>
              <div className="font-black text-emerald-400">{me.cs} <span className="text-[10px] text-zinc-300">({csPerMin})</span></div>
            </div>

            {/* 対面CS差 */}
            {csDiff !== null && (
              <div className="pl-1">
                <div className="text-[10px] font-bold uppercase text-zinc-400">対面差</div>
                <div className={`font-black ${csDiff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {csDiff >= 0 ? `+${csDiff}` : csDiff} CS
                </div>
              </div>
            )}
          </div>
        )}

        {/* 所持ゴールド */}
        {me && (
          <div className="flex items-center gap-1.5 text-xs font-mono font-black text-amber-400">
            <Coins className="h-4 w-4" />
            <span>{me.currentGold.toLocaleString()} G</span>
          </div>
        )}
      </div>

      {/* 画面右上: オブジェクト・警告フロートカード */}
      <div className="absolute top-4 right-4 space-y-2">
        <div className="rounded-xl border border-white/10 bg-black/75 p-3 shadow-xl backdrop-blur-lg w-56">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 border-b border-white/10 pb-1.5">
            <span className="flex items-center gap-1 text-rose-400">
              <Target className="h-3.5 w-3.5" /> 戦術ガイド
            </span>
            <span className="text-[9px] font-mono text-zinc-500">Live Client</span>
          </div>
          <div className="mt-2 space-y-1.5 text-xs text-zinc-200">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">視界スコア:</span>
              <span className="font-mono font-bold text-sky-400">{me?.wardScore || 0} pt</span>
            </div>
            {data.gameTimeSec && data.gameTimeSec < 600 && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-1.5 text-[10px] text-rose-300">
                ⚠️ 序盤フェーズ: ガンク・初手ワード切れに注意
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
