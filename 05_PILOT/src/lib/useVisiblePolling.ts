"use client";

import { useEffect, useRef } from 'react';

/**
 * 画面が表に出ている間だけ、一定間隔で fn を呼ぶ（2026-10-19）。
 * 裏に隠れている間は止め、表に戻った時にすぐ1回呼ぶ。最初の表示時にも1回呼ぶ。
 *
 * 以前はサイドバー等の setInterval がタブを開きっぱなしにしている間ずっと API を呼び続けており
 * （タスク状況は15秒おき＝1日5,760回）、Vercel 無料枠の Fluid Active CPU（月4時間）を使い切る原因になっていた。
 */
export function useVisiblePolling(fn: () => void, intervalMs: number, enabled = true) {
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => fnRef.current(), intervalMs);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fnRef.current();
        start();
      } else {
        stop();
      }
    };
    fnRef.current();
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled]);
}
