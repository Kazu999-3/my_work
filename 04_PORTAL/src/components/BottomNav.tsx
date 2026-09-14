"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coins, Swords, Trophy, BookOpen, User, ShieldCheck } from 'lucide-react';
import { useCurrentUser } from '../hooks/useCurrentUser';

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user && (user.isAdmin || user.discordId === '697220229964759130' || user.displayName?.includes('かずき'))) {
      setIsAdmin(true);
      return;
    }
    // サーバー認証の確認
    fetch("/api/auth/verify", { method: "POST", credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) setIsAdmin(true);
      })
      .catch(() => {});
  }, [user]);

  const navItems = [
    {
      label: '勝敗ベット',
      href: '/casino',
      icon: Coins,
      badge: '人気🔥',
    },
    {
      label: 'チーム分け',
      href: '/balancer',
      icon: Swords,
    },
    {
      label: '長者番付',
      href: '/leaderboard',
      icon: Trophy,
    },
    {
      label: '使い方',
      href: '/guide',
      icon: BookOpen,
    },
    ...(isAdmin
      ? [
          {
            label: '管理運用',
            href: '/admin/dashboard',
            icon: ShieldCheck,
            badge: 'ADMIN',
          },
        ]
      : [
          {
            label: 'マイ戦績',
            href: user ? `/player/${user.displayName || user.username}` : '/casino',
            icon: User,
          },
        ]),
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#1e1f22]/95 backdrop-blur-md border-t border-stone-200 dark:border-[#3f4147] px-2 py-1.5 shadow-2xl safe-area-bottom">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href.startsWith('/player') && pathname.startsWith('/player'));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
                isActive
                  ? 'text-amber-600 dark:text-amber-400 font-black scale-105'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 font-medium'
              }`}
            >
              {item.badge && !isActive && (
                <span className="absolute -top-1 right-0 text-[8px] bg-rose-500 text-white font-black px-1 rounded-full animate-pulse">
                  {item.badge}
                </span>
              )}
              <div className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-amber-500/15 dark:bg-amber-500/25' : ''}`}>
                <Icon size={20} className={isActive ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400 dark:text-stone-500'} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
