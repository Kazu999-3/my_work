'use client';

import React, { useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';

// 辞典の合成（dict_synthesizer）を手動で起動する（旧ポータル /admin/knowledge の動画キュー管理にあったボタンの移植）。2026-10-20
// 普段は動画の取り込みが終わるたびに自動で走る（youtube_absorber.py）。急いで辞典へ反映したい時だけ使う。
export default function DictSynthPanel() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const trigger = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/tasks/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_type: 'dict_synthesizer' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '起動に失敗しました');
      setMessage({ text: data.message, ok: true });
    } catch (e: any) {
      setMessage({ text: e.message, ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-400" /> 辞典の合成
        </div>
        <p className="text-[11px] text-zinc-400 mt-1">
          動画の取り込みが終わるたびに自動で走ります。すぐ辞典へ反映したい時だけ押してください。
        </p>
        {message && (
          <p className={`text-[11px] mt-1.5 ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</p>
        )}
      </div>
      <button
        type="button"
        onClick={trigger}
        disabled={busy}
        className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        辞典の合成を起動
      </button>
    </div>
  );
}
