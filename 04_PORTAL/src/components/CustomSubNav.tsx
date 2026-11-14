"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Swords, FileEdit, History, Sparkles } from 'lucide-react';

// カスタムまわりの4画面（チーム分け／試合記録／過去の試合／お祭りピック）を上で切り替える
const ITEMS = [
  { href: '/balancer', label: 'チーム分け', icon: Swords },
  { href: '/balancer/record', label: '試合記録', icon: FileEdit },
  { href: '/history', label: '過去の試合', icon: History },
  { href: '/festival/pick', label: 'お祭りピック', icon: Sparkles },
];

export default function CustomSubNav() {
  const pathname = usePathname() || '';
  return (
    <nav className="flex gap-1 p-1 bg-surface-subtle border border-border rounded-2xl overflow-x-auto" aria-label="カスタムの画面">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        // 前方一致保護: /balancer は完全一致、それ以外は前方一致でアクティブ判定
        const active = href === '/balancer'
          ? pathname === '/balancer'
          : (pathname === href || pathname.startsWith(`${href}/`));
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
