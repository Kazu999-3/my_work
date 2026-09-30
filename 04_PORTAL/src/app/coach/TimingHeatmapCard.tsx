'use client';

import { useState, useEffect, useCallback } from 'react';
import { Spinner } from '../../components/Feedback';

// ============================================================
// 曜日×時間帯 勝率ヒートマップ
//
// 経緯: 2026-09-17のコーチページ大規模スリム化(04497961)で、page.tsx内にあった
// TimingHeatmapTab が1,646行の削除に含まれて消えた。一方でサーバー側の
// /api/soloq/heatmap と /api/soloq/history-sync は残り、呼び出し元0件の状態で
// 取り残されていた(2026-09-30の調査で判明)。ユーザー要望により復活させる。
//
// 復活時の変更点:
//  - page.tsx への直書きから独立コンポーネントへ分離（またスリム化で消えないように）
//  - 配色を ui-conventions.md の暖色パレットへ（indigo→amber、red→rose、
//    ヒートマップの段階も emerald→amber→rose の暖色系グラデーションに）
//  - **データの新しさを表示**。今回、履歴が 2026-08-17 で6週間止まっていたのに
//    誰も気づけなかった。同期は手動ボタンでしか走らないため、最新試合日と
//    「古い」警告を常に画面へ出す。
// ============================================================

const HEATMAP_DAYS = ['日', '月', '火', '水', '木', '金', '土'];

// これ以上更新が無ければ「古い」として警告する日数。
// ソロQは毎日回すものではないので2週間を目安にする。
const STALE_WARN_DAYS = 14;

type Cell = { day: number; hour: number; games: number; wins: number; winRate: number };

export default function TimingHeatmapCard() {
  const [loading, setLoading] = useState(true);
  const [cells, setCells] = useState<Cell[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [newestMatch, setNewestMatch] = useState<string | null>(null);
  const [oldestMatch, setOldestMatch] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ processed: number; synced: number } | null>(null);

  // ブラウザネイティブのtitle属性ツールチップは表示までのディレイが長く、
  // overflow-x-autoのテーブル内では途切れる/出ないことがあり、スマホのタップでは
  // そもそも発火しない。カーソルを合わせる(またはタップする)と即座に見える
  // 専用の詳細表示に置き換える。
  const [activeCell, setActiveCell] = useState<{ day: number; hour: number } | null>(null);

  const fetchHeatmap = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/soloq/heatmap', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '取得に失敗しました');
      setCells(data.cells || []);
      setTotalGames(data.totalGames || 0);
      setNewestMatch(data.newestMatch || null);
      setOldestMatch(data.oldestMatch || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHeatmap(); }, [fetchHeatmap]);

  // 同期の進捗(offset)をlocalStorageに永続化する。以前はブラウザのローカル変数のみで
  // 保持しており、途中でタブを閉じる/離脱すると次回は300件のID一覧取得を毎回最初から
  // やり直し、Riot API呼び出しが無駄になっていた(2026-08-05発覚)。
  const SYNC_OFFSET_KEY = 'soloq_history_sync_offset';

  const readSavedOffset = () => {
    // プライベートモード等でlocalStorageが例外を投げても同期自体は続行できるようにする。
    try {
      return Number(localStorage.getItem(SYNC_OFFSET_KEY) || 0) || 0;
    } catch {
      return 0;
    }
  };
  const writeSavedOffset = (v: number | null) => {
    try {
      if (v === null) localStorage.removeItem(SYNC_OFFSET_KEY);
      else localStorage.setItem(SYNC_OFFSET_KEY, String(v));
    } catch {
      /* 保存できなくても同期は進む（次回が最初からになるだけ） */
    }
  };

  const runSync = async () => {
    const savedOffset = readSavedOffset();
    const confirmMsg = savedOffset > 0
      ? `前回の続き(${savedOffset}件目)からソロQ履歴の同期を再開しますか？(試合数によっては数分かかります)`
      : '直近300試合のソロQ履歴をRiot APIから取得して同期しますか？(試合数によっては数分かかります)';
    if (!confirm(confirmMsg)) return;
    setSyncing(true);
    setSyncProgress({ processed: savedOffset, synced: 0 });
    try {
      let offset = savedOffset;
      let totalProcessed = savedOffset;
      let totalSynced = 0;
      while (true) {
        const res = await fetch('/api/soloq/history-sync', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '同期エラーが発生しました');

        totalProcessed += data.processed || 0;
        totalSynced += data.synced || 0;
        setSyncProgress({ processed: totalProcessed, synced: totalSynced });

        if (data.done || data.nextOffset === null) {
          writeSavedOffset(null);
          break;
        }
        offset = data.nextOffset;
        // 完走前でも直近の到達点を都度保存しておく。ここで保存しないと、この後の
        // チャンクが失敗/中断した場合に今回分の進捗ごと失われてしまう。
        writeSavedOffset(offset);
        // レート制限で中断した直後は即リトライしても再度弾かれやすいため、少し待ってから再開する。
        if (data.rateLimited) await new Promise((r) => setTimeout(r, 3000));
      }
      await fetchHeatmap();
    } catch (e: any) {
      // 進捗(localStorage)はここでは消さない。次回起動時に続きから再開できるように残す。
      setError('同期失敗: ' + e.message + '（次回は続きから再開します）');
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const cellMap = new Map<string, Cell>();
  cells.forEach((c) => cellMap.set(`${c.day}-${c.hour}`, c));

  // 十分な試合数(3件以上)があるセルの中から最良/最悪を判定
  const qualified = cells.filter((c) => c.games >= 3);
  const best = qualified.length > 0 ? [...qualified].sort((a, b) => b.winRate - a.winRate)[0] : null;
  const worst = qualified.length > 0 ? [...qualified].sort((a, b) => a.winRate - b.winRate)[0] : null;

  // 勝率の段階は暖色系（良い=エメラルド → 普通=琥珀 → 悪い=ローズ）。
  // ui-conventions.md の成功=emerald / 警告=rose に合わせ、中間を amber で埋める。
  const cellColor = (winRate: number, games: number) => {
    if (games === 0) return 'bg-black/[0.03]';
    if (games < 3) return 'bg-surface-subtle';
    if (winRate >= 60) return 'bg-emerald-500';
    if (winRate >= 55) return 'bg-emerald-300';
    if (winRate >= 45) return 'bg-amber-200';
    if (winRate >= 40) return 'bg-amber-400';
    return 'bg-rose-400';
  };

  const daysSinceNewest = newestMatch
    ? Math.floor((Date.now() - new Date(newestMatch).getTime()) / 86400000)
    : null;
  const isStale = daysSinceNewest !== null && daysSinceNewest >= STALE_WARN_DAYS;
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        同期したソロQ試合の開始時刻(JST)から、曜日×時間帯ごとの勝率を集計します。
      </p>

      {/* データの新しさ。手動同期しか走らないため、古いまま気づかない状態を防ぐ。 */}
      {!loading && totalGames > 0 && (
        <div
          className={`rounded-xl border px-3.5 py-2 text-xs ${
            isStale
              ? 'bg-rose-950/30 text-rose-400 border-rose-800/60'
              : 'bg-surface-subtle dark:bg-stone-800/60 text-muted border-border dark:border-stone-700/60'
          }`}
        >
          <span className="font-bold">
            {isStale ? `⚠️ データが${daysSinceNewest}日前で止まっています` : `✅ 最新 ${daysSinceNewest}日前まで反映済み`}
          </span>
          <span className="ml-2 opacity-80">
            {totalGames}試合 / {fmt(oldestMatch)} 〜 {fmt(newestMatch)}
          </span>
          {isStale && (
            <span className="block mt-1 opacity-90">
              下のボタンで同期すると最新まで取り込めます（毎日の自動同期も有効ですが、失敗が続くと止まります）。
            </span>
          )}
        </div>
      )}

      <button
        onClick={runSync}
        disabled={syncing}
        className="w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50 cursor-pointer"
      >
        {syncing
          ? `同期中... (${syncProgress?.processed || 0}件処理 / ${syncProgress?.synced || 0}件新規保存)`
          : totalGames > 0 ? `🔄 履歴を再同期 (現在${totalGames}試合分)` : '🔄 直近300試合を同期'}
      </button>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">❌ {error}</p>}

      {loading ? (
        <Spinner />
      ) : totalGames === 0 ? (
        <p className="text-sm text-muted-strong py-6 text-center">まだ同期されたデータがありません。上のボタンで同期してください。</p>
      ) : (
        <div className="space-y-3">
          {(best || worst) && (
            <div className="grid grid-cols-2 gap-2">
              {best && (
                <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-3">
                  <div className="text-[10px] font-bold text-emerald-400">👍 最も勝率が良い時間帯</div>
                  <div className="text-sm font-bold text-stone-100">{HEATMAP_DAYS[best.day]}曜 {best.hour}時台</div>
                  <div className="text-xs text-faint">{best.winRate}% ({best.wins}/{best.games}勝)</div>
                </div>
              )}
              {worst && (
                <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 p-3">
                  <div className="text-[10px] font-bold text-rose-400">👎 最も勝率が悪い時間帯</div>
                  <div className="text-sm font-bold text-stone-100">{HEATMAP_DAYS[worst.day]}曜 {worst.hour}時台</div>
                  <div className="text-xs text-faint">{worst.winRate}% ({worst.wins}/{worst.games}勝)</div>
                </div>
              )}
            </div>
          )}

          <div className="min-h-10 rounded-xl border border-border dark:border-stone-700/60 bg-surface dark:bg-stone-900/60 px-3.5 py-2 text-xs flex items-center justify-between gap-2 shadow-xs">
            {activeCell ? (() => {
              const c = cellMap.get(`${activeCell.day}-${activeCell.hour}`);
              const games = c?.games || 0;
              const isGood = games >= 3 && (c?.winRate || 0) >= 55;
              const isBad = games >= 3 && (c?.winRate || 0) < 45;
              return (
                <div className="flex items-center justify-between w-full flex-wrap gap-2">
                  <span className="font-bold text-foreground dark:text-stone-100">
                    {HEATMAP_DAYS[activeCell.day]}曜 {activeCell.hour}時台:{' '}
                    {games > 0 ? (
                      <span className="font-extrabold text-foreground-subtle">{c!.winRate}% ({c!.wins}/{games}勝)</span>
                    ) : (
                      <span className="font-normal text-faint">データなし</span>
                    )}
                  </span>
                  {isGood && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-950/30 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                      <span>🌟</span> 勝ち時（推奨時間帯）
                    </span>
                  )}
                  {isBad && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-950/30 text-rose-400 border border-rose-800/60 flex items-center gap-1">
                      <span>⚠️</span> 要警戒（勝率低下傾向）
                    </span>
                  )}
                </div>
              );
            })() : (
              <span className="text-faint">マスにカーソルを合わせる（スマホはタップ）と詳細がここに表示されます</span>
            )}
          </div>

          {/* 24列を画面幅に押し込むと375px幅で1セル約13pxになり、指でタップできない。
              ui-conventions.md の「スマホで見切れないよう横スクロールを必ず設定」に従い、
              最小幅を確保して横スクロールさせる（2026-09-30修正。復活時の見落とし）。 */}
          <div className="w-full overflow-x-auto -mx-1 px-1">
            <div className="min-w-[560px]">
            {/* 時間ヘッダー */}
            <div className="grid grid-cols-[1.25rem_repeat(24,1fr)] gap-px text-[9px] text-faint text-center mb-1">
              <div className="w-5"></div>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="leading-none">
                  {h % 3 === 0 ? <span className="scale-75 inline-block origin-center font-mono">{h}</span> : ''}
                </div>
              ))}
            </div>

            {/* 曜日ごとの行 */}
            <div className="space-y-0.5" onMouseLeave={() => setActiveCell(null)}>
              {HEATMAP_DAYS.map((dayLabel, day) => (
                <div key={day} className="grid grid-cols-[1.25rem_repeat(24,1fr)] gap-px items-center">
                  <div className="text-[10px] font-bold text-muted-strong text-center leading-none pr-0.5">
                    {dayLabel}
                  </div>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const c = cellMap.get(`${day}-${hour}`);
                    const games = c?.games || 0;
                    const winRate = c?.winRate ?? 0;
                    const isActive = activeCell?.day === day && activeCell?.hour === hour;
                    return (
                      <button
                        type="button"
                        key={hour}
                        onMouseEnter={() => setActiveCell({ day, hour })}
                        onClick={() => setActiveCell(isActive ? null : { day, hour })}
                        className={`aspect-square w-full rounded-[2px] cursor-pointer transition-all ${cellColor(winRate, games)} ${
                          isActive ? 'ring-2 ring-offset-1 ring-amber-500 scale-125 z-10 relative' : 'hover:scale-110'
                        }`}
                        title={`${dayLabel}曜 ${hour}時: ${games > 0 ? `${winRate}% (${c!.wins}/${games}勝)` : 'データなし'}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            </div>
          </div>
          <p className="text-[10px] text-faint">※ グレーは3試合未満のためサンプル不足。マスを選択・タップすると詳細が表示されます（横スクロールできます）。</p>
        </div>
      )}
    </div>
  );
}
