"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RefreshCw, Terminal, ChevronDown, ChevronUp, Link, Copy, Check, Download, Loader2, CheckCircle2, AlertTriangle, XCircle, Trash2 } from "lucide-react";

// 管理画面「道筋（試作）」タブ（2026-10-21、ユーザー要望）。
// リプレイのミニマップから読み取った10人の秒単位の移動経路を、地図に線で重ねる。
// 読み取りは PC のスクリプト（scripts/replay_paths.py）が行い、replay_paths 表に保存したものを /api/replay-paths で読む。
// 読み取りの仕組み上、アイコンが重なって見失った区間は「最後に見えた場所」に留まるので、見失ってから5秒を超えた区間は点線にしている。

type Player = {
  participantId: number;
  teamId: number;
  championName: string;
  riotId: string;
  position: string;
  points: [number, number, number, number][]; // [秒, x, y, 見失ってからの秒数]
};
type PathData = {
  matchId: string;
  gameVersion: string;
  durationSec: number;
  coveredSec: number;
  quality?: any;
  players: Player[];
};
type MatchRow = { match_id: string; game_version: string | null; duration_sec: number | null; covered_sec: number | null; quality: any; created_at: string };

const MAP_W = 14870;
const MAP_H = 14980;
const SIZE = 512;
const LOST_DASH = 5; // 見失ってからこの秒数を超えたら点線
// 前の点からの距離が「その秒数で動ける距離」を超える所は線でつながない（デス→泉・リコール・読み取りの飛び）。
// 移動速度は速くても 600 前後なので、ダッシュ・ブリンクの分を足して 1秒あたり 900 + 余裕 400 とする
const reachable = (dt: number, dist: number) => dt <= 5 && dist <= 900 * dt + 400;
const POS_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const POS_LABEL: Record<string, string> = { TOP: "TOP", JUNGLE: "JG", MIDDLE: "MID", BOTTOM: "ADC", UTILITY: "SUP" };
// 線の色: 青チームは teal 系、赤チームは rose/amber 系。同じチーム内はレーン順に色を変えて見分ける
const TEAM_COLORS: Record<number, string[]> = {
  100: ["#5eead4", "#2dd4bf", "#a3e635", "#34d399", "#e7e5e4"],
  200: ["#fb7185", "#f43f5e", "#fbbf24", "#fb923c", "#fda4af"],
};

const toX = (x: number) => (x / MAP_W) * SIZE;
const toY = (y: number) => SIZE - (y / MAP_H) * SIZE;
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const ddragonPatch = (v: string | null | undefined) => {
  const m = (v || "").match(/^(\d+)\.(\d+)/);
  return m ? `${m[1]}.${m[2]}.1` : "16.20.1";
};

/** 見えていた区間（実線）と見失っていた区間（点線）に分けた SVG のパス */
function buildPaths(points: Player["points"], from: number, to: number) {
  let solid = "";
  let dashed = "";
  let prev: Player["points"][number] | null = null;
  for (const p of points) {
    if (p[0] < from || p[0] > to) continue;
    if (prev && reachable(p[0] - prev[0], Math.hypot(p[1] - prev[1], p[2] - prev[2]))) {
      const seg = `M${toX(prev[1]).toFixed(1)},${toY(prev[2]).toFixed(1)}L${toX(p[1]).toFixed(1)},${toY(p[2]).toFixed(1)}`;
      if (p[3] > LOST_DASH) dashed += seg;
      else solid += seg;
    }
    prev = p;
  }
  return { solid, dashed };
}

/** 時刻 t にいた場所（直前の点） */
function positionAt(points: Player["points"], t: number) {
  let lo = 0;
  let hi = points.length - 1;
  if (hi < 0 || points[0][0] > t) return null;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid][0] <= t) lo = mid;
    else hi = mid - 1;
  }
  return points[lo];
}

type ReplayPathsPanelProps = {
  isAdmin?: boolean;
  viewKey?: string;
  onKeyError?: () => void;
};

function normalizeMatchId(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (/^JP_\d+$/i.test(s)) return s.replace(/^JP_/i, 'JP1_');
  if (/^\d+$/.test(s)) return `JP1_${s}`;
  return s;
}

export default function ReplayPathsPanel({ isAdmin: propIsAdmin, viewKey, onKeyError }: ReplayPathsPanelProps = {}) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<PathData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<number, boolean>>({});
  const [soloMode, setSoloMode] = useState(false);
  const [range, setRange] = useState<[number, number]>([0, 180]);
  const [trail, setTrail] = useState(0); // 0 = 範囲の最初から全部、>0 = 終わりから◯秒だけ
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 権限と共有キー
  const [serverIsAdmin, setServerIsAdmin] = useState(false);
  const [currentViewKey, setCurrentViewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isAdmin = propIsAdmin ?? serverIsAdmin;

  // リプレイ取り込み依頼（Supabaseキュー連携）
  const [showImportForm, setShowImportForm] = useState(false);
  const [importMatchId, setImportMatchId] = useState("");
  const [importMinutes, setImportMinutes] = useState(0); // 0 = 全編
  const [isQueueing, setIsQueueing] = useState(false);
  const [queueMsg, setQueueMsg] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);

  // コマンド生成（手動実行用）
  const [showManualCmd, setShowManualCmd] = useState(false);
  const [cmdCopied, setCmdCopied] = useState(false);

  const cleanMatchId = normalizeMatchId(importMatchId);
  const generatedCommand = `d:\\my_work\\.venv\\Scripts\\python.exe d:\\my_work\\scripts\\replay_paths.py ${cleanMatchId || '<試合ID>'}${importMinutes > 0 ? ` --minutes ${importMinutes}` : ''} --upload`;

  // 現在処理中のタスクがあるか？
  const activeTask = useMemo(() => {
    return matches.find((m) => {
      const st = m.quality?.status;
      return st && ["pending", "capturing", "tracking", "uploading"].includes(st);
    });
  }, [matches]);

  // 直近で失敗したタスクがあるか？
  const failedTask = useMemo(() => {
    return matches.find((m) => m.quality?.status === "failed");
  }, [matches]);

  // 処理中タスクがある場合は3秒おきに自動更新
  useEffect(() => {
    if (!activeTask) return;
    const timer = setInterval(() => {
      loadList();
    }, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTask]);

  const handleQueueImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchIdToQueue = normalizeMatchId(importMatchId);
    if (!matchIdToQueue) return;
    setIsQueueing(true);
    setQueueError(null);
    setQueueMsg(null);

    // 楽観的UI更新: 押した瞬間に即座に進捗バーを表示する
    const optimisticRow: MatchRow = {
      match_id: matchIdToQueue,
      game_version: null,
      duration_sec: null,
      covered_sec: null,
      created_at: new Date().toISOString(),
      quality: {
        status: "pending",
        message: "取り込み依頼を受付ました。PCの待機ワーカーが自動で撮影を開始します...",
      },
    };
    setMatches((prev) => [optimisticRow, ...prev.filter((m) => m.match_id !== matchIdToQueue)]);

    try {
      const res = await fetch("/api/admin/replay-paths/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ matchId: matchIdToQueue, minutes: importMinutes }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "依頼の登録に失敗しました");
      setQueueMsg(j.message);
      loadList();
    } catch (err: any) {
      setQueueError(err.message);
      loadList();
    } finally {
      setIsQueueing(false);
    }
  };

  const handleCancelTask = async (matchId: string) => {
    if (!confirm(`試合 ${matchId} の取り込み依頼を取り消しますか？`)) return;
    try {
      await fetch(`/api/admin/replay-paths/queue?matchId=${encodeURIComponent(matchId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      loadList();
    } catch (e: any) {
      alert(`取り消しに失敗しました: ${e.message}`);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm(`試合 ${matchId} の移動経路データを完全に削除しますか？\n※この操作は取り消せません。`)) return;
    try {
      const res = await fetch(`/api/admin/replay-paths/queue?matchId=${encodeURIComponent(matchId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "削除に失敗しました");
      if (selected === matchId) {
        setSelected(null);
        setData(null);
      }
      loadList();
    } catch (e: any) {
      alert(`削除に失敗しました: ${e.message}`);
    }
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(generatedCommand);
    setCmdCopied(true);
    setTimeout(() => setCmdCopied(false), 2500);
  };

  const handleCopyShareUrl = () => {
    const key = currentViewKey || viewKey || 'ktm-scout-secret';
    const url = `${window.location.origin}/replay-paths?key=${encodeURIComponent(key)}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const loadList = async () => {
    setError(null);
    try {
      const keyParam = viewKey ? `?key=${encodeURIComponent(viewKey)}` : "";
      const res = await fetch(`/api/replay-paths${keyParam}`, { credentials: "include", cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        if (res.status === 401 && onKeyError) onKeyError();
        throw new Error(j.error || `取得に失敗しました（${res.status}）`);
      }
      setMatches(j.matches || []);
      if (j.isAdmin) setServerIsAdmin(true);
      if (j.viewKey) setCurrentViewKey(j.viewKey);
      if (!selected && j.matches?.length) {
        const completedMatch = j.matches.find((m: MatchRow) => m.duration_sec && m.duration_sec > 0);
        setSelected(completedMatch ? completedMatch.match_id : j.matches[0].match_id);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setPlaying(false);
    const keyParam = viewKey ? `&key=${encodeURIComponent(viewKey)}` : "";
    fetch(`/api/replay-paths?matchId=${encodeURIComponent(selected)}${keyParam}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `取得に失敗しました（${res.status}）`);
        const d = j as PathData;
        if (!d || !d.players || !Array.isArray(d.players)) {
          setData(null);
          return;
        }
        d.players.sort((a, b) => a.teamId - b.teamId || POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position));
        setData(d);
        setVisible(Object.fromEntries(d.players.map((p) => [p.participantId, true])));
        setRange([0, Math.min(180, d.coveredSec || 0)]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected, viewKey]);

  // 再生: 終わりの時刻を進める（試合の1秒 = 画面の1/8秒）
  useEffect(() => {
    if (!playing || !data) return;
    timer.current = setInterval(() => {
      setRange(([a, b]) => {
        const nb = Math.min(data.coveredSec, b + 1);
        if (nb >= data.coveredSec) setPlaying(false);
        return [a, nb];
      });
    }, 125);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, data]);

  const colorOf = useMemo(() => {
    const m: Record<number, string> = {};
    if (!data) return m;
    for (const team of [100, 200]) {
      data.players.filter((p) => p.teamId === team).forEach((p, i) => (m[p.participantId] = TEAM_COLORS[team][i % 5]));
    }
    return m;
  }, [data]);

  const from = trail > 0 ? Math.max(range[0], range[1] - trail) : range[0];
  const to = range[1];
  const shown = data ? data.players.filter((p) => visible[p.participantId]) : [];
  const patch = ddragonPatch(data?.gameVersion);
  const maxSec = data?.coveredSec || 0;

  const clickPlayer = (pid: number) => {
    if (soloMode) {
      setVisible(Object.fromEntries((data?.players || []).map((p) => [p.participantId, p.participantId === pid])));
    } else {
      setVisible((v) => ({ ...v, [pid]: !v[pid] }));
    }
  };
  const showTeam = (team: number | null) =>
    setVisible(Object.fromEntries((data?.players || []).map((p) => [p.participantId, team === null || p.teamId === team])));

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-lg font-black text-foreground">🗺️ リプレイの道筋（試作）</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleCopyShareUrl}
                  className="text-xs px-2.5 py-1 rounded-lg border border-teal-500/30 text-teal-700 bg-teal-500/5 hover:bg-teal-500/10 cursor-pointer flex items-center gap-1 font-bold"
                  title="合言葉付きの閲覧専用URLをクリップボードにコピー"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <Link className="h-3.5 w-3.5" />}
                  {copied ? "リンクをコピー完了！" : "共有URLをコピー"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportForm((v) => !v)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-primary-edge-strong text-primary-700 bg-primary-500/5 hover:bg-primary-500/10 cursor-pointer flex items-center gap-1 font-bold"
                >
                  <Download className="h-3.5 w-3.5" /> 新しい試合を取り込む
                </button>
              </>
            )}
            <button type="button" onClick={loadList} className="text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-black/5 cursor-pointer flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> 一覧を更新
            </button>
          </div>
        </div>

        {/* 取り込みフォーム（ポータル完結型キュー連携） */}
        {showImportForm && (
          <div className="p-3.5 rounded-xl border border-primary-edge-soft bg-primary-500/5 space-y-3 mt-2">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Download className="h-4 w-4 text-primary-600" /> ポータルからリプレイを取り込む
            </div>
            <p className="text-[11px] text-muted-strong leading-relaxed">
              LoLクライアントでリプレイをDLした状態で試合IDを入力し、「取り込み開始」を押してください。
              <br />
              <span className="text-primary-700 font-bold">※デスクトップの「KTMリプレイ待機ワーカー常駐.bat」を起動（最小化でOK）しておくと、ポータルからの指示を検知して自動で撮影・解析が走ります。</span>
            </p>
            <form onSubmit={handleQueueImport} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="試合ID（例: JP1_608209265）"
                value={importMatchId}
                onChange={(e) => setImportMatchId(e.target.value)}
                disabled={isQueueing}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-mono w-56 focus:outline-none focus:border-primary-500"
              />
              <select
                value={importMinutes}
                onChange={(e) => setImportMinutes(Number(e.target.value))}
                disabled={isQueueing}
                className="px-2 py-1.5 rounded-lg border border-border bg-surface text-xs"
              >
                <option value={0}>試合終了まで（全編）</option>
                <option value={10}>序盤10分だけ（高速）</option>
                <option value={15}>15分まで</option>
              </select>
              <button
                type="submit"
                disabled={isQueueing || !importMatchId.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                {isQueueing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {isQueueing ? "登録中..." : "取り込み開始"}
              </button>
            </form>

            {queueMsg && (
              <div className="text-xs text-teal-800 bg-teal-500/10 border border-teal-500/30 p-2.5 rounded-lg flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                <span>{queueMsg}</span>
              </div>
            )}
            {queueError && (
              <div className="text-xs text-danger-700 bg-danger-100 border border-danger-edge-soft p-2.5 rounded-lg flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{queueError}</span>
              </div>
            )}

            {/* 手動コマンド実行の折りたたみ */}
            <div className="pt-1 border-t border-border/50">
              <button
                type="button"
                onClick={() => setShowManualCmd((v) => !v)}
                className="text-[11px] text-muted-strong hover:text-foreground flex items-center gap-1 cursor-pointer"
              >
                <Terminal className="h-3 w-3" />
                <span>手動コマンド（PowerShell）で実行したい場合はこちら</span>
                {showManualCmd ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showManualCmd && (
                <div className="mt-2 p-2.5 rounded-lg bg-surface border border-border space-y-2">
                  <div className="p-2 rounded bg-black/80 text-emerald-400 font-mono text-[11px] break-all select-all flex items-center justify-between gap-2">
                    <span>{generatedCommand}</span>
                    <button
                      type="button"
                      onClick={handleCopyCommand}
                      className="shrink-0 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      {cmdCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {cmdCopied ? "コピー済" : "コピー"}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-strong">
                    ※デスクトップの「リプレイ道筋取り込み.bat」をダブルクリックしても実行できます。
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 現在処理中のタスク進捗バナー */}
        {activeTask && (
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2 mt-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-amber-600 shrink-0" />
              <div>
                <span className="font-bold font-mono">[{activeTask.match_id}]</span>{" "}
                <span>{activeTask.quality?.message || "手元PCで処理中..."}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCancelTask(activeTask.match_id)}
              className="text-[11px] text-muted-strong hover:text-danger-600 flex items-center gap-0.5 cursor-pointer shrink-0"
            >
              <XCircle className="h-3.5 w-3.5" /> 取り消し
            </button>
          </div>
        )}

        {/* 失敗したタスクの通知バナー */}
        {!activeTask && failedTask && (
          <div className="p-3 rounded-xl border border-danger-500/30 bg-danger-500/10 text-danger-900 dark:text-danger-200 text-xs flex items-center justify-between gap-2 mt-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-danger-600 shrink-0" />
              <div>
                <span className="font-bold font-mono">[{failedTask.match_id}]</span>{" "}
                <span>取り込みに失敗しました: {failedTask.quality?.error || failedTask.quality?.message || "不明なエラー"}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCancelTask(failedTask.match_id)}
              className="text-[11px] text-muted-strong hover:text-danger-600 flex items-center gap-0.5 cursor-pointer shrink-0"
              title="この失敗レコードを削除して再試行できるようにする"
            >
              <XCircle className="h-3.5 w-3.5" /> 閉じる
            </button>
          </div>
        )}
        <p className="text-[11px] text-muted-strong leading-relaxed">
          リプレイのミニマップを PC で読み取った、10人の秒単位の動きです。Riot API の1分ごとの位置を起点に追いかけているので、毎分ちょうどの位置は正確で、その間は読み取りです。
          アイコンが重なって見えなかった区間は点線（その間は最後に見えた場所に留まっています）。
        </p>
        {matches.length === 0 && !error && <div className="text-sm text-muted-strong">まだ読み取った試合がありません。</div>}
        {matches.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {matches.map((m) => {
              const q = m.quality?.heldOut?.["間の分の正解"];
              const st = m.quality?.status;
              const isProcessing = st && ["pending", "capturing", "tracking", "uploading"].includes(st);
              return (
                <div
                  key={m.match_id}
                  className={`group relative shrink-0 text-left rounded-lg border text-[11px] flex items-stretch transition ${
                    selected === m.match_id ? "border-primary-edge-strong bg-primary-500/10 text-foreground" : "border-border hover:bg-black/5 text-muted-strong"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(m.match_id)}
                    className="px-2.5 py-1.5 cursor-pointer text-left flex-1"
                  >
                    <div className="font-mono font-bold flex items-center gap-1">
                      {isProcessing && <Loader2 className="h-3 w-3 animate-spin text-amber-500" />}
                      <span>{m.match_id}</span>
                    </div>
                    <div>
                      {isProcessing ? (
                        <span className="text-amber-600 font-bold">処理中...</span>
                      ) : (
                        <>
                          {Math.round((m.covered_sec || 0) / 60)}分ぶん / 全{Math.round((m.duration_sec || 0) / 60)}分
                          {q ? ` / 精度 ${Math.round(q.within500 * 100)}%` : ""}
                        </>
                      )}
                    </div>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMatch(m.match_id);
                      }}
                      className="px-1.5 text-muted-strong/40 hover:text-danger-600 hover:bg-danger-500/10 rounded-r-lg transition flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100"
                      title={`試合 ${m.match_id} を削除`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {error && <div className="p-3 rounded-lg border bg-danger-100 text-danger-700 border-danger-edge-soft text-sm">{error}</div>}
      </div>

      {loading && <div className="text-sm text-muted-strong">読み込み中…</div>}

      {!loading && selected && !data && (
        <div className="p-8 rounded-2xl border border-border bg-surface text-center space-y-3">
          <p className="text-sm font-bold text-foreground">この試合の移動経路データは現在準備中、または取り込み処理中です</p>
          <p className="text-xs text-muted-strong">取り込みが完了すると、自動的にここにサモナーズリフトの軌跡が表示されます。</p>
          {isAdmin && (
            <div>
              <button
                type="button"
                onClick={() => handleDeleteMatch(selected)}
                className="text-xs px-3 py-1.5 rounded-lg border border-danger-500/30 text-danger-700 bg-danger-500/5 hover:bg-danger-500/10 cursor-pointer inline-flex items-center gap-1 font-bold"
              >
                <Trash2 className="h-3.5 w-3.5 text-danger-600" /> この未完了レコードを削除する
              </button>
            </div>
          )}
        </div>
      )}

      {data && !loading && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,512px)_1fr]">
          <div className="space-y-2">
            <div className="relative w-full max-w-[512px] aspect-square rounded-xl overflow-hidden border border-border bg-stone-900">
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 w-full h-full">
                <image href={`https://ddragon.leagueoflegends.com/cdn/${patch}/img/map/map11.png`} x={0} y={0} width={SIZE} height={SIZE} opacity={0.55} />
                {shown.map((p) => {
                  const { solid, dashed } = buildPaths(p.points, from, to);
                  const c = colorOf[p.participantId];
                  return (
                    <g key={p.participantId}>
                      <path d={dashed} fill="none" stroke={c} strokeWidth={1.5} strokeOpacity={0.6} strokeDasharray="3 3" />
                      <path d={solid} fill="none" stroke={c} strokeWidth={2.2} strokeOpacity={0.9} strokeLinecap="round" />
                    </g>
                  );
                })}
                {/* 終わりの時刻にいた場所に顔を出す */}
                {shown.map((p) => {
                  const pos = positionAt(p.points, to);
                  if (!pos || pos[0] < from) return null;
                  const cx = toX(pos[1]);
                  const cy = toY(pos[2]);
                  const ring = p.teamId === 100 ? "#2dd4bf" : "#f43f5e";
                  return (
                    <g key={`m${p.participantId}`}>
                      <clipPath id={`clip${p.participantId}`}>
                        <circle cx={cx} cy={cy} r={11} />
                      </clipPath>
                      <image
                        href={`https://ddragon.leagueoflegends.com/cdn/${patch}/img/champion/${p.championName}.png`}
                        x={cx - 11}
                        y={cy - 11}
                        width={22}
                        height={22}
                        clipPath={`url(#clip${p.participantId})`}
                      />
                      <circle cx={cx} cy={cy} r={11} fill="none" stroke={ring} strokeWidth={2} strokeDasharray={pos[3] > LOST_DASH ? "3 2" : undefined}>
                        <title>{`${p.championName}（${p.riotId}）${pos[3] > LOST_DASH ? ` ・${Math.round(pos[3])}秒前から見失い中` : ""}`}</title>
                      </circle>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="text-[11px] text-faint">
              実線 = 見えていた区間 / 点線 = アイコンが重なるなどで見失っていた区間。デス・リコールや、読み取りが飛んだ所（その秒数で動けない距離）は線でつないでいません。
            </div>
          </div>

          <div className="space-y-4">
            {/* 時間 */}
            <div className="bg-surface border border-border rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-black text-foreground">
                  時間: {fmt(from)} 〜 {fmt(to)}
                </div>
                <div className="flex items-center gap-1.5">
                  {isAdmin && selected && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMatch(selected)}
                      className="text-xs px-2 py-1 rounded-lg border border-danger-500/30 text-danger-700 bg-danger-500/5 hover:bg-danger-500/10 cursor-pointer flex items-center gap-1 font-bold"
                      title={`試合 ${selected} の移動経路データを完全に削除`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger-600" /> 削除
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!playing && range[1] >= maxSec) setRange([range[0], range[0]]);
                      setPlaying((v) => !v);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-primary-edge-strong text-primary-700 bg-primary-500/5 hover:bg-primary-500/10 cursor-pointer flex items-center gap-1 font-bold"
                  >
                    {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {playing ? "止める" : "再生"}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    [0, 180, "序盤 0〜3分"],
                    [0, 480, "〜8分"],
                    [0, 900, "〜15分"],
                    [0, maxSec, "全部"],
                  ] as const
                ).map(([a, b, l]) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setRange([a, Math.min(b, maxSec)]);
                    }}
                    className="text-[11px] px-2 py-0.5 rounded border border-border hover:bg-black/5 cursor-pointer"
                  >
                    {l}
                  </button>
                ))}
              </div>
              <label className="block text-[11px] text-muted-strong">
                始まり {fmt(range[0])}
                <input type="range" min={0} max={maxSec} value={range[0]} onChange={(e) => setRange([Math.min(Number(e.target.value), range[1]), range[1]])} className="w-full accent-amber-500" />
              </label>
              <label className="block text-[11px] text-muted-strong">
                終わり {fmt(range[1])}
                <input type="range" min={0} max={maxSec} value={range[1]} onChange={(e) => setRange([range[0], Math.max(Number(e.target.value), range[0])])} className="w-full accent-amber-500" />
              </label>
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-strong">
                線の長さ:
                {[
                  [0, "範囲の全部"],
                  [30, "直近30秒"],
                  [60, "直近60秒"],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTrail(v as number)}
                    className={`px-2 py-0.5 rounded border cursor-pointer ${trail === v ? "border-primary-edge-strong bg-primary-500/10 text-foreground" : "border-border hover:bg-black/5"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* 表示する人 */}
            <div className="bg-surface border border-border rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-black text-foreground">表示する人</div>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-strong cursor-pointer">
                  <input type="checkbox" checked={soloMode} onChange={(e) => setSoloMode(e.target.checked)} className="accent-amber-500" />
                  押した1人だけにする
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => showTeam(null)} className="text-[11px] px-2 py-0.5 rounded border border-border hover:bg-black/5 cursor-pointer">
                  全員
                </button>
                <button type="button" onClick={() => showTeam(100)} className="text-[11px] px-2 py-0.5 rounded border border-border hover:bg-black/5 cursor-pointer">
                  青チームだけ
                </button>
                <button type="button" onClick={() => showTeam(200)} className="text-[11px] px-2 py-0.5 rounded border border-border hover:bg-black/5 cursor-pointer">
                  赤チームだけ
                </button>
                <button
                  type="button"
                  onClick={() => setVisible(Object.fromEntries((data.players || []).map((p) => [p.participantId, p.position === "JUNGLE"])))}
                  className="text-[11px] px-2 py-0.5 rounded border border-border hover:bg-black/5 cursor-pointer"
                >
                  JG 2人だけ
                </button>
              </div>
              {[100, 200].map((team) => (
                <div key={team} className="space-y-1">
                  <div className={`text-[11px] font-bold ${team === 100 ? "text-teal-600" : "text-rose-600"}`}>{team === 100 ? "青チーム" : "赤チーム"}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1">
                    {data.players
                      .filter((p) => p.teamId === team)
                      .map((p) => (
                        <button
                          key={p.participantId}
                          type="button"
                          onClick={() => clickPlayer(p.participantId)}
                          className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-left text-xs cursor-pointer ${
                            visible[p.participantId] ? "border-border bg-black/5 text-foreground" : "border-border/50 text-faint"
                          }`}
                        >
                          <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: visible[p.participantId] ? colorOf[p.participantId] : "transparent", border: `2px solid ${colorOf[p.participantId]}` }} />
                          <span className="font-mono text-[10px] text-muted-strong w-7 shrink-0">{POS_LABEL[p.position] || "-"}</span>
                          <span className="font-bold truncate">{p.championName}</span>
                          <span className="text-[10px] text-faint truncate">{p.riotId}</span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
