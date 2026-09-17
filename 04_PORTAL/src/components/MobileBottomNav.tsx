'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Crown, 
  Swords, 
  Coins, 
  Trophy, 
  User 
} from 'lucide-react';

export default function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/',
      label: 'ホーム',
      icon: Crown,
      active: pathname === '/',
    },
    {
      href: '/balancer',
      label: 'バランサー',
      icon: Swords,
      active: pathname.startsWith('/balancer'),
    },
    {
      href: '/casino',
      label: '勝敗予想',
      icon: Coins,
      active: pathname.startsWith('/casino'),
    },
    {
      href: '/leaderboard',
      label: '順位表',
      icon: Trophy,
      active: pathname.startsWith('/leaderboard'),
    },
    {
      href: '/mypage',
      label: 'マイカルテ',
      icon: User,
      active: pathname.startsWith('/mypage') || pathname.startsWith('/player'),
    },
  ];

  return (
    <nav 
      aria-label="モバイル下部ナビゲーション" 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1e1f22]/95 backdrop-blur-md border-t border-stone-200/90 dark:border-stone-800/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.active;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-200 cursor-pointer relative ${
                isActive
                  ? 'text-amber-600 dark:text-amber-400 font-black'
                  : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon 
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'
                  }`} 
                />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full" />
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${
                isActive ? 'font-black scale-102' : 'font-bold'
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
