"use client";

import { useEffect, useState } from 'react';
import { isLuckyDay, LUCKY_DAYS } from '../../../lib/luckyDay';

// 🍀 ラッキーデー（毎月 7・17・27 日）の告知。日付判定は表示後にブラウザで行う
// （サーバー描画との日付ずれで表示が食い違わないように）。2026-10-17
export default function LuckyDayBanner() {
  const [lucky, setLucky] = useState(false);
  useEffect(() => { setLucky(isLuckyDay()); }, []);
  if (!lucky) return null;
  return (
    <div className="max-w-4xl mx-auto rounded-2xl border border-success-edge bg-success-100/70 dark:bg-emerald-950/30 px-4 py-3 text-center">
      <p className="text-sm font-black text-success-700 dark:text-emerald-400">
        🍀 本日はラッキーデー！ カジノの払い戻しが +3%、デイリーおみくじの報酬が 2 倍です
      </p>
      <p className="text-[11px] text-muted-strong mt-0.5">毎月 {LUCKY_DAYS.join('・')} 日に開催（日本時間）</p>
    </div>
  );
}
