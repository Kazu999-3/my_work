"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getChampIcon } from "@/lib/ddragonClient";
import { Shield, Swords, Coins, Eye, Activity, Clock, Target, Minimize2, Maximize2, Compass, Zap } from "lucide-react";
import type { HabitRadarSummary } from "@/lib/habitRadar";
import { calculateLanePriority, MacroPriorityReport } from "@/lib/lanePriorityCalculator";

// 対面の癖は /api/lol/habit-radar（対面の直近試合のタイムライン実測）から、試合ごとに1回だけ取る。
// 2026-10-16: 以前は全対面に同じ固定時刻（2:48・5:15）を出していた。実測が無い時は何も推測しない。
type HabitState =
  | { status: 'idle' | 'loading' | 'none' }
  | { status: 'ready'; radar: HabitRadarSummary };

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
    level?: number;
    isDead?: boolean;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    items: number[];
  }>;
  enemyPlayer?: {
    championName: string;
    riotId: string | null;
  } | null;
}

export default function OverlayPage() {
  const [data, setData] = useState<LiveGameData>({ inGame: false });
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [compact, setCompact] = useState<boolean>(false);

  // M キーでミニモード/通常モードをトグル切替
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setCompact((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      // 画面が非表示（裏タブ）の時はCPUとネットワークを節約するためスキップ
      if (typeof document !== 'undefined' && document.hidden) return;
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

    // 💓 HUD起動中の生存シグナル送信（初回 + 10秒おき）
    const sendHeartbeat = async () => {
      try {
        await fetch('/api/overlay/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inGame: !!data?.inGame }),
        });
      } catch {}
    };
    sendHeartbeat();
    const hbTimer = setInterval(sendHeartbeat, 10000);

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        poll();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      mounted = false;
      clearInterval(timer);
      clearInterval(hbTimer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, []);

  // 対面が決まったら、その人の直近試合の実測（初手ワード・1stリコール）を1回だけ取得する
  const enemyRiotId = data.inGame ? data.enemyPlayer?.riotId || null : null;
  const [habit, setHabit] = useState<HabitState>({ status: 'idle' });
  useEffect(() => {
    if (!enemyRiotId) {
      setHabit({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setHabit({ status: 'loading' });
    fetch(`/api/lol/habit-radar?riotId=${encodeURIComponent(enemyRiotId)}&count=5`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const radar: HabitRadarSummary | undefined = json?.radar;
        setHabit(radar && radar.sampleGames > 0 ? { status: 'ready', radar } : { status: 'none' });
      })
      .catch(() => {
        if (!cancelled) setHabit({ status: 'none' });
      });
    return () => {
      cancelled = true;
    };
  }, [enemyRiotId]);

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
        <div className="flex items-center gap-2.5 rounded-full border border-white/20 bg-black/85 px-4 py-2 text-xs font-semibold text-zinc-200 shadow-2xl backdrop-blur-md ring-1 ring-black/80 [text-shadow:_0_1px_3px_rgb(0_0_0_/_90%)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">KTM HUD: LoL試合待機中 (127.0.0.1:2999)</span>
        </div>
      </div>
    );
  }

  const me = data.activePlayer;
  const gameMin = Math.max(1, (data.gameTimeSec || 0) / 60);
  const csPerMin = me ? (me.cs / gameMin).toFixed(1) : '0.0';

  // 対面の特定（同じpositionの敵チームプレイヤー）
  const myTeam = data.allPlayers?.find((p) => p.championName === me?.championName)?.team || 'ORDER';
  const myPos = data.allPlayers?.find((p) => p.championName === me?.championName)?.position;
  const enemy = data.allPlayers?.find((p) => p.team !== myTeam && p.position === myPos && myPos !== 'NONE');
  const csDiff = enemy && me ? me.cs - enemy.cs : null;

  // 🌲 JG向け: 全レーン主導権 (Lane Prio) ＆ パワースパイク計算
  const prioReport: MacroPriorityReport | null =
    data.inGame && data.allPlayers && data.allPlayers.length > 0
      ? calculateLanePriority(data.allPlayers as any, myTeam, data.gameTimeSec || 0)
      : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent select-none font-sans p-4 pointer-events-none">
      {/* 画面上部: リアルタイムタクティカルバー（超高コントラストHUD） */}
      <div className="mx-auto flex w-fit items-center gap-4 rounded-2xl border border-white/20 bg-black/90 px-5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.85)] ring-1 ring-black/90 backdrop-blur-xl">
        {/* チャンピオン & レベル */}
        {me && (
          <div className="flex items-center gap-2.5 border-r border-white/15 pr-4">
            <div className="relative">
              <Image
                src={getChampIcon(me.championName)}
                alt={me.championName}
                width={36}
                height={36}
                className="h-9 w-9 rounded-xl border border-white/30 shadow-lg"
              />
              <span className="absolute -bottom-1 -right-1 rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-md ring-1 ring-black/80">
                {me.level}
              </span>
            </div>
            <div>
              <div className="text-xs font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] [text-shadow:_0_1px_2px_rgb(0_0_0_/_90%)]">{me.championName}</div>
              <div className="text-[10px] font-mono font-bold text-rose-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                <span className="text-rose-300 font-black">{me.kills}</span> / <span className="text-zinc-300">{me.deaths}</span> / <span className="text-rose-300 font-black">{me.assists}</span>
              </div>
            </div>
          </div>
        )}

        {/* 試合時間 */}
        <div className="flex items-center gap-1.5 border-r border-white/15 pr-4 text-xs font-mono font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
          <Clock className="h-3.5 w-3.5 text-zinc-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
          <span className="tracking-wider">{formatTime(data.gameTimeSec)}</span>
        </div>

        {/* CS ＆ 分間CS */}
        {me && (
          <div className="flex items-center gap-3 border-r border-white/15 pr-4 text-xs font-mono">
            <div>
              <div className="text-[10px] font-bold uppercase text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">CS / 分</div>
              <div className="font-black text-emerald-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] [text-shadow:_0_1px_2px_rgb(0_0_0_/_90%)]">
                {me.cs} <span className="text-[10px] text-zinc-200 font-bold">({csPerMin})</span>
              </div>
            </div>

            {/* 対面CS差 */}
            {csDiff !== null && (
              <div className="pl-1">
                <div className="text-[10px] font-bold uppercase text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">対面差</div>
                <div className={`font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] [text-shadow:_0_1px_2px_rgb(0_0_0_/_90%)] ${
                  csDiff >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}>
                  {csDiff >= 0 ? `+${csDiff}` : csDiff} CS
                </div>
              </div>
            )}
          </div>
        )}

        {/* 所持ゴールド */}
        {me && (
          <div className="flex items-center gap-1.5 text-xs font-mono font-black text-amber-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] [text-shadow:_0_1px_2px_rgb(0_0_0_/_90%)]">
            <Coins className="h-4 w-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
            <span className="tracking-wide">{me.currentGold.toLocaleString()} G</span>
          </div>
        )}
      </div>

      {/* 画面左上: 全レーン主導権 (Prio) ＆ パワースパイク HUD */}
      {prioReport && (
        <div className="absolute top-4 left-4 space-y-2 pointer-events-auto w-64">
          <div className="rounded-2xl border border-white/20 bg-black/90 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.85)] ring-1 ring-black/90 backdrop-blur-xl space-y-2">
            <div className="flex items-center justify-between border-b border-white/15 pb-1.5 text-xs font-black text-zinc-200">
              <span className="flex items-center gap-1.5 text-cyan-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                <Compass className="h-3.5 w-3.5" /> レーン主導権 (Prio)
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">JGレーダー</span>
            </div>

            <div className="space-y-1.5">
              {prioReport.lanes.map((l) => {
                const isAlly = l.prio === 'ally_prio';
                const isEnemy = l.prio === 'enemy_prio';
                const prioColor = isAlly
                  ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40'
                  : isEnemy
                  ? 'text-rose-400 bg-rose-950/60 border-rose-500/40'
                  : 'text-zinc-300 bg-zinc-900/60 border-white/10';
                const prioText = isAlly ? '味方Prio' : isEnemy ? '敵プッシュ' : '互角';

                return (
                  <div key={l.lane} className="flex items-center justify-between p-1.5 rounded-lg border border-white/10 bg-white/5 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-black text-[10px] text-zinc-400 w-7">{l.laneLabel}</span>
                      <span className="font-bold text-white truncate max-w-[70px]" title={l.allyChamp}>{l.allyChamp}</span>
                      {l.spike && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono font-bold flex items-center gap-0.5 animate-pulse">
                          <Zap className="h-2.5 w-2.5" /> {l.spike}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-zinc-300">
                        {l.csDiff >= 0 ? `+${l.csDiff}` : l.csDiff} CS
                      </span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${prioColor}`}>
                        {prioText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg bg-cyan-950/40 border border-cyan-500/30 p-2 text-[10px] text-cyan-200 shadow-md">
              <span className="font-bold text-cyan-300">🧭 JG方針:</span> {prioReport.overallAdvice}
            </div>
          </div>
        </div>
      )}

      {/* 画面右上: 対面の癖 (Habit Radar) ＆ 戦術タイマー */}
      <div className="absolute top-4 right-4 space-y-2 pointer-events-auto">
        {compact ? (
          /* 🚀 コンパクト・ミニモード（極小ピル型常駐表示） */
          <div
            onClick={() => setCompact(false)}
            className="cursor-pointer group rounded-full border border-rose-500/50 bg-black/90 px-3 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.85)] ring-1 ring-black/90 backdrop-blur-xl flex items-center gap-2 hover:border-rose-400 transition"
            title="クリックまたは [M] キーで詳細展開"
          >
            <span className="flex items-center gap-1 text-[11px] font-black text-rose-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              <Eye className="h-3.5 w-3.5" />
              {enemy ? `vs ${enemy.championName}` : '対面癖'}
            </span>

            {/* 最優先の直近カウントダウンまたは定石秒数 */}
            {data.gameTimeSec !== undefined && data.gameTimeSec < 600 ? (
              habit.status === 'ready' && habit.radar.earlyWard.averageTimeSec > data.gameTimeSec ? (
                <span className="font-mono text-[10px] font-black text-teal-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-500/40">
                  👁️ ワード {formatTime(habit.radar.earlyWard.averageTimeSec - data.gameTimeSec)}
                </span>
              ) : habit.status === 'ready' && habit.radar.firstRecall.averageTimeSec > data.gameTimeSec ? (
                <span className="font-mono text-[10px] font-black text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/40">
                  🛒 リコール {formatTime(habit.radar.firstRecall.averageTimeSec - data.gameTimeSec)}
                </span>
              ) : data.gameTimeSec < 165 ? (
                <span className="font-mono text-[10px] font-black text-teal-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-500/40">
                  🛡️ 川ワード {formatTime(165 - data.gameTimeSec)}
                </span>
              ) : data.gameTimeSec < 300 ? (
                <span className="font-mono text-[10px] font-black text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/40">
                  🛒 帰還目安 {formatTime(300 - data.gameTimeSec)}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-indigo-300">⚔️ Lv6戦術帯</span>
              )
            ) : (
              <span className="font-mono text-[10px] font-bold text-teal-300">👁️ {me?.wardScore || 0}pt</span>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCompact(false);
              }}
              className="text-zinc-400 group-hover:text-white p-0.5 cursor-pointer"
              title="詳細を展開 [M]"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          </div>
        ) : (
          /* 通常モード（詳細パネル） */
          <div className="rounded-xl border border-rose-500/40 bg-black/90 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.85)] ring-1 ring-black/90 backdrop-blur-xl w-64 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-200 border-b border-white/15 pb-1.5">
              <span className="flex items-center gap-1.5 text-rose-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                <Eye className="h-3.5 w-3.5" /> 対面の癖 (Habit Radar)
              </span>
              <div className="flex items-center gap-1.5">
                {enemy && (
                  <span className="text-[10px] font-mono text-zinc-300 font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    vs {enemy.championName}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setCompact(true)}
                  className="text-zinc-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition cursor-pointer"
                  title="ミニモードに最小化 [M]"
                >
                  <Minimize2 className="h-3 w-3" />
                </button>
              </div>
            </div>

          {/* リアルタイムカウントダウン（対面の直近試合の実測平均が取れた時だけ） */}
          {data.gameTimeSec !== undefined && data.gameTimeSec < 600 ? (
            habit.status === 'ready' ? (
              <div className="space-y-2">
                {/* 1. 初手ワードの平均設置時刻 */}
                {habit.radar.earlyWard.placementRate > 0 && habit.radar.earlyWard.averageTimeSec > 0 && (
                  data.gameTimeSec < habit.radar.earlyWard.averageTimeSec ? (
                    <div className="rounded-lg bg-teal-950/60 border border-teal-500/40 p-2 shadow-md">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-teal-200 font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">👁️ 初手ワード平均 {habit.radar.earlyWard.averageTimeFormatted}:</span>
                        <span className="font-mono font-black text-teal-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                          あと {formatTime(habit.radar.earlyWard.averageTimeSec - data.gameTimeSec)}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-zinc-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                        よく置く場所: {habit.radar.earlyWard.dominantArea}（設置率 {Math.round(habit.radar.earlyWard.placementRate * 100)}%）
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-black/60 border border-white/15 p-2 text-[10px] text-zinc-300 shadow-md">
                      👁️ 初手ワードの平均設置時刻（{habit.radar.earlyWard.averageTimeFormatted}）を過ぎました。よく置く場所: {habit.radar.earlyWard.dominantArea}
                    </div>
                  )
                )}

                {/* 2. 1stリコールの平均時刻 */}
                {habit.radar.firstRecall.averageTimeSec > 0 &&
                  data.gameTimeSec < habit.radar.firstRecall.averageTimeSec + 30 && (
                  <div className="rounded-lg bg-amber-950/60 border border-amber-500/40 p-2 shadow-md">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-amber-200 font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">🛒 1stリコール平均 {habit.radar.firstRecall.averageTimeFormatted}:</span>
                      <span className="font-mono font-black text-amber-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                        {data.gameTimeSec < habit.radar.firstRecall.averageTimeSec
                          ? `あと ${formatTime(habit.radar.firstRecall.averageTimeSec - data.gameTimeSec)}`
                          : 'そろそろ'}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                      平均 Lv{habit.radar.firstRecall.averageLevel} で帰還
                    </div>
                  </div>
                )}

                <div className="text-[9px] text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  対面の直近{habit.radar.sampleGames}試合の実測（{habit.radar.analyzedChampion}）
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {habit.status === 'loading' ? (
                  <div className="text-[10px] text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    対面の直近試合を集計中…
                  </div>
                ) : (
                  <>
                    {/* 定石フォールバックタイマー */}
                    {data.gameTimeSec < 165 ? (
                      <div className="rounded-lg bg-teal-950/50 border border-teal-500/30 p-2 shadow-md">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-teal-200 font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                            🛡️ 定石川ワード目安 02:45:
                          </span>
                          <span className="font-mono font-black text-teal-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                            あと {formatTime(165 - data.gameTimeSec)}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-zinc-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                          相手JGのLv3ガンク警戒。川・トライブッシュを確保
                        </div>
                      </div>
                    ) : data.gameTimeSec < 240 ? (
                      <div className="rounded-lg bg-rose-950/50 border border-rose-500/30 p-2 shadow-md">
                        <div className="text-[11px] font-bold text-rose-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                          ⚠️ JG Lv3ガンク警戒帯 (02:45〜04:00)
                        </div>
                        <div className="mt-1 text-[10px] text-zinc-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                          無理なプッシュは避け、敵JGの写り込みを確認
                        </div>
                      </div>
                    ) : data.gameTimeSec < 300 ? (
                      <div className="rounded-lg bg-amber-950/50 border border-amber-500/30 p-2 shadow-md">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-amber-200 font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                            🛒 定石1stリコール目安 05:00:
                          </span>
                          <span className="font-mono font-black text-amber-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                            あと {formatTime(300 - data.gameTimeSec)}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-zinc-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                          キャノンウェーブ押し切り後の帰還・1300G/1100G目標
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-indigo-950/50 border border-indigo-500/30 p-2 shadow-md">
                        <div className="text-[11px] font-bold text-indigo-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                          ⚔️ 1stリコール・Lv6 パワースパイク期
                        </div>
                        <div className="mt-1 text-[10px] text-zinc-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                          対面の装備更新とウルト習得に注意してダメージトレード
                        </div>
                      </div>
                    )}
                    <div className="text-[9px] text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                      定石ガイド（対面の実測データなし）
                    </div>
                  </>
                )}
              </div>
            )
          ) : (
            <div className="text-[11px] text-zinc-300 space-y-1">
              <div className="flex justify-between">
                <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">視界スコア:</span>
                <span className="font-mono text-teal-300 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">{me?.wardScore || 0} pt</span>
              </div>
              <div className="text-[10px] text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                10分経過: 中盤マクロ・オブジェクト主導権重視
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);
}
