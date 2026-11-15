'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ClipboardCheck, Video, Activity, Edit3, Shield, ArrowLeft 
} from 'lucide-react';

interface AdminTab {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const KNOWLEDGE_TABS: AdminTab[] = [
  { name: '記事の承認', href: '/admin/review', icon: ClipboardCheck },
  { name: 'YouTube解析', href: '/admin/youtube', icon: Video },
];

const DICT_TABS: AdminTab[] = [
  { name: '健全性監査', href: '/admin/dict-health', icon: Activity },
  { name: '教本エディタ', href: '/admin/dict-maintenance', icon: Edit3 },
];

const SYSTEM_TABS: AdminTab[] = [
  { name: 'ダッシュボード', href: '/admin/dashboard', icon: Shield },
];

interface AdminNavHeaderProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function AdminNavHeader({ title, subtitle, action }: AdminNavHeaderProps) {
  const pathname = usePathname();

  return (
    <div className="mb-6 space-y-4">
      {/* 🧭 管理エリア共通サブナビゲーションバー */}
      <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-2 shadow-lg backdrop-blur-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* 左側：戻るボタン ＆ 各タブグループ */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <Link
            href="/"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-950/80 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition border border-zinc-800 shrink-0"
            title="チャンピオン辞典へ戻る"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">辞典へ</span>
          </Link>

          <div className="h-4 w-px bg-zinc-800 shrink-0" />

          {/* グループ1: 知見パイプライン */}
          <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800/60 shrink-0">
            {KNOWLEDGE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500 text-zinc-950 font-black shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-amber-400/80'}`} />
                  <span>{tab.name}</span>
                </Link>
              );
            })}
          </div>

          {/* グループ2: チャンピオン教本 */}
          <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800/60 shrink-0">
            {DICT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500 text-zinc-950 font-black shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-amber-400/80'}`} />
                  <span>{tab.name}</span>
                </Link>
              );
            })}
          </div>

          {/* グループ3: システム */}
          <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800/60 shrink-0">
            {SYSTEM_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500 text-zinc-950 font-black shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-amber-400/80'}`} />
                  <span>{tab.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 右側アクション（各画面固有の追加ボタン等があれば配置） */}
        {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
      </div>

      {/* 画面タイトル ＆ 概要（指定がある場合） */}
      {(title || subtitle) && (
        <div className="border-b border-zinc-800/80 pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            {title && (
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-xs text-zinc-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
