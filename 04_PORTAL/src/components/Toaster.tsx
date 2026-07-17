"use client";

import { useEffect, useState } from 'react';

// ============================================================
// グローバルトースト (課題#39): Provider不要でどこからでも呼べる。
//   import { toast } from '../components/Toaster';
//   toast.success('保存しました'); toast.error('失敗'); toast.info('...');
// <Toaster/> は layout に1つ置く。CustomEventで通知を受け取り描画する。
// ============================================================

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; type: ToastType; message: string; }

const EVENT = 'ktm-toast';
let seq = 0;

function emit(type: ToastType, message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id: ++seq, type, message } }));
}

export const toast = {
  success: (m: string) => emit('success', m),
  error: (m: string) => emit('error', m),
  info: (m: string) => emit('info', m),
};

const STYLE: Record<ToastType, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
};
const ICON: Record<ToastType, string> = { success: '✅', error: '❌', info: 'ℹ️' };

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent).detail as ToastItem;
      setItems((prev) => [...prev, detail]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== detail.id));
      }, 4000);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-[90vw]">
      {items.map((t) => (
        <div key={t.id}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur animate-in ${STYLE[t.type]}`}>
          <span>{ICON[t.type]}</span>
          <span className="break-words">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
