"use client";

import { ReactNode } from 'react';
import { Loader2, Inbox, AlertTriangle, RefreshCw } from 'lucide-react';

// ============================================================
// 共通フィードバックUI（#59 ローディング統一 / #60 空状態・エラー統一）
//
// 各ページがバラバラに書いていた「読込中…」「データなし」「エラー」表示を
// このファイルの共通コンポーネントに寄せることで、見た目と体験を統一する。
// ============================================================

// --- スケルトン（読み込み中のプレースホルダ） ---
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className}`} />;
}

// 行リスト用のスケルトン（テーブル/一覧ページ向け）
export function SkeletonList({ rows = 6, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-[#0f111a] p-4">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

// --- スピナー（中央寄せの読み込み表示） ---
export function Spinner({ label = "読み込み中...", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 text-gray-400 ${className}`}>
      <Loader2 className="animate-spin text-[#c89b3c]" size={28} />
      {label && <p className="text-xs font-bold tracking-wide">{label}</p>}
    </div>
  );
}

// --- 空状態 ---
export function EmptyState({
  title = "データがありません",
  message,
  icon,
  action,
}: {
  title?: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-gray-500">
        {icon || <Inbox size={26} />}
      </div>
      <p className="text-sm font-bold text-gray-300">{title}</p>
      {message && <p className="max-w-sm text-xs leading-relaxed text-gray-500">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// --- エラー状態（任意で再試行ボタン付き） ---
export function ErrorState({
  title = "読み込みに失敗しました",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
        <AlertTriangle size={26} />
      </div>
      <p className="text-sm font-bold text-rose-300">{title}</p>
      {message && <p className="max-w-sm text-xs leading-relaxed text-gray-500">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-gray-200 transition-all hover:bg-white/10"
        >
          <RefreshCw size={13} /> 再試行
        </button>
      )}
    </div>
  );
}
