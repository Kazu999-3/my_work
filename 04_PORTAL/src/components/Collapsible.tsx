'use client';

import { useState, useRef, ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// 長い一覧(全ログ・AI分析ログ等)をデフォルトで折りたたみ、必要な時だけ開けるようにする
// 汎用ラッパー。titleにはh3/h5などの見出しJSXをそのまま渡す。
export default function Collapsible({
  title,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  // 初回に開かれるまでは子要素をマウントしない(未使用時の不要なfetchを避ける狙いは維持)。
  // ただし一度開いたら以降はアンマウントせずCSSで表示切替のみに変える。以前はopenの
  // 真偽で子要素ごと条件レンダーしていたため、閉じるたびに内部state(検索キーワード等)が
  // 破棄され、再度開くたびにMySoloQDashboard等が再マウント→一覧を再取得していた
  // (2026-08-05発覚)。
  const hasOpenedRef = useRef(defaultOpen || isOpen);
  if (isOpen) hasOpenedRef.current = true;

  const handleToggle = () => {
    const next = !isOpen;
    if (controlledOpen === undefined) {
      setInternalOpen(next);
    }
    if (onToggle) {
      onToggle(next);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex-1 min-w-0">{title}</div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-stone-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
        )}
      </button>
      {hasOpenedRef.current && <div className={isOpen ? 'mt-3' : 'hidden'}>{children}</div>}
    </div>
  );
}
