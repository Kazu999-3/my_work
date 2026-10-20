"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Swords, History, Sparkles } from 'lucide-react';

// カスタムまわりの3画面（チーム分け／過去の試合／お祭りピック）を上で切り替える（2026-10-20 ページ整理）。
// 以前は「過去の試合」がチーム分け画面のボタンからしか開けず、お祭りピックはメニューから探す必要があった。
const ITEMS = [
  { href: '/balancer', label: 'チーム分け', icon: Swords },
  { href: '/history', label: '過去の試合', icon: History },
  { href: '/festival/pick', label: 'お祭りピック', icon: Sparkles },
];

export default function CustomSubNav() {
  const pathname = usePathname() || '';
  return (
    <nav className="flex gap-1 p-1 bg-surface-subtle border border-border rounded-2xl overflow-x-auto" aria-label="カスタムの画面">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition ${
              active ? 'bg-surface text-foreground shadow-xs font-black' : 'text-muted hover:text-foreground hover:bg-surface-hover/60'
            }`}
          >
            <Icon className="h-4 w-4 text-primary-500" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
