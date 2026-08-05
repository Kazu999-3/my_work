'use client';

import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// 長い一覧(全ログ・AI分析ログ等)をデフォルトで折りたたみ、必要な時だけ開けるようにする
// 汎用ラッパー。titleにはh3/h5などの見出しJSXをそのまま渡す。
export default function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex-1 min-w-0">{title}</div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-stone-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
        )}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
