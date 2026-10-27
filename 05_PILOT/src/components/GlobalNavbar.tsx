'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Crown, Bot, BookOpen, Library, Activity, Video, Plus, Menu, X, ChevronRight, ChevronDown, Shield, ClipboardCheck, FileText, Settings, Edit3
} from 'lucide-react';
import KnowledgeIngestModal from './KnowledgeIngestModal';
import NotificationBell from './NotificationBell';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  desc?: string;
}

// 🌟 日常利用メニュー（最頻出）
const PRIMARY_NAV_ITEMS: NavItem[] = [
  { name: 'チャンピオン辞典', href: '/', icon: Crown },
  { name: 'note下書き', href: '/note', icon: FileText, badge: 'NEW' },
  { name: '攻略ライブラリ', href: '/library', icon: Library },
  { name: 'レーン攻略', href: '/lane-guides', icon: BookOpen },
  { name: 'AI戦術コーチ', href: '/coach', icon: Bot },
];

// ⚙️ 管理・運用メニュー（レビュー・解析・点検）
const ADMIN_NAV_ITEMS: NavItem[] = [
  { name: '記事の承認', href: '/admin/review', icon: ClipboardCheck, desc: '動画知見の承認・分解' },
  { name: 'YouTube解析', href: '/admin/youtube', icon: Video, desc: '動画解析キュー監視' },
  { name: '健全性監査', href: '/admin/dict-health', icon: Activity, desc: '教本鮮度・欠損点検' },
  { name: '教本エディタ', href: '/admin/dict-maintenance', icon: Edit3, desc: '全175体直接編集' },
  { name: '運用ダッシュボード', href: '/admin/dashboard', icon: Shield, desc: 'システム稼働・DB監視' },
];

export default function GlobalNavbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const adminDropdownRef = useRef<HTMLDivElement>(null);

  const isAdminActive = pathname.startsWith('/admin');

  // 外側クリックで管理ドロップダウンを閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setIsAdminDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      {/* 👑 トップ固定グローバルメニューバー */}
      <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-2.5">
        <div className="mx-auto flex items-center justify-between gap-4">
          
          {/* ロゴ */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shadow-inner">
              <Crown className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-wide text-white">
                  SOVEREIGN PILOT
                </span>
                <span className="px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 text-[10px] font-bold border border-amber-800/60 hidden sm:inline-block">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 hidden 2xl:block">
                LoL 戦術バイブル ＆ リアルタイムHUD連動コクピット
              </p>
            </div>
          </Link>

          {/* PC向けメニューバー (日常メイン + 管理・運用ドロップダウン) */}
          <nav className="hidden md:flex items-center gap-1.5 text-xs font-bold min-w-0">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.name}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap shrink-0 relative ${
                    isActive
                      ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-950/40 font-black'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-zinc-400'}`} />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="ml-0.5 px-1 py-0.2 text-[9px] font-extrabold rounded bg-amber-400 text-zinc-950">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* ⚙️ 管理・運用ドロップダウン */}
            <div className="relative shrink-0" ref={adminDropdownRef}>
              <button
                type="button"
                onClick={() => setIsAdminDropdownOpen(!isAdminDropdownOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap border ${
                  isAdminActive
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border-transparent hover:border-zinc-800'
                }`}
                title="記事承認・YouTube・ヘルス監査などの運用画面"
              >
                <Settings className={`w-3.5 h-3.5 ${isAdminActive ? 'text-amber-400' : 'text-zinc-400'}`} />
                <span>管理・運用</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isAdminDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isAdminDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-zinc-900/95 border border-zinc-800 p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                    運用 ＆ メンテナンス
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {ADMIN_NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsAdminDropdownOpen(false)}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs transition-colors ${
                            isActive
                              ? 'bg-amber-500 text-zinc-950 font-bold'
                              : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-zinc-950' : 'text-amber-400/80'}`} />
                          <div className="min-w-0">
                            <div className="font-bold leading-tight">{item.name}</div>
                            {item.desc && (
                              <div className={`text-[10px] truncate ${isActive ? 'text-zinc-800' : 'text-zinc-500'}`}>
                                {item.desc}
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* 右端アクション（通知ベル ＋ 戦術取込 ＋ スマホハンバーガー） */}
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />

            <button
              onClick={() => setIsIngestModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold transition border border-amber-500/40 cursor-pointer shadow-sm whitespace-nowrap"
              title="URLやメモからAIで戦術を自動取込"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">📥 戦術取込</span>
            </button>

            {/* スマホ用ハンバーガーボタン */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
              aria-label="メニューを開く"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </header>

      {/* 📱 スマホ用全画面ドロワーメニュー */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-zinc-950/95 backdrop-blur-xl pt-16 px-4 pb-24 space-y-4 animate-in fade-in slide-in-from-top-4 duration-150 overflow-y-auto">
          {/* 日常メニュー */}
          <div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-2 mb-2">
              日常ツール
            </div>
            <div className="space-y-1.5">
              {PRIMARY_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                      isActive
                        ? 'bg-amber-500 text-zinc-950 font-black shadow-md'
                        : 'bg-zinc-900/80 border border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isActive ? 'bg-amber-600/80' : 'bg-zinc-950 border border-zinc-800'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold">{item.name}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 text-[10px] font-extrabold rounded bg-amber-400 text-zinc-950">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 管理・運用メニュー */}
          <div className="pt-2">
            <div className="text-xs font-bold text-amber-400/80 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              <span>管理 ＆ メンテナンス</span>
            </div>
            <div className="space-y-1.5 bg-zinc-900/40 p-2 rounded-2xl border border-zinc-800/60">
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
                      isActive
                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-zinc-950' : 'text-amber-400'}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold">{item.name}</div>
                        {item.desc && (
                          <div className={`text-[10px] truncate ${isActive ? 'text-zinc-800' : 'text-zinc-500'}`}>
                            {item.desc}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800/80">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsIngestModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>URL・反省メモからAI戦術取込</span>
            </button>
          </div>
        </div>
      )}

      {/* 📱 スマホ用下部固定ボトムナビ (親指で1タップ切り替え) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl">
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            pathname === '/' ? 'text-amber-400 font-black' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Crown className="w-4 h-4" />
          <span>辞典</span>
        </Link>

        <Link
          href="/note"
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            pathname === '/note' ? 'text-amber-400 font-black' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>note</span>
        </Link>

        <Link
          href="/library"
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            pathname === '/library' ? 'text-amber-400 font-black' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Library className="w-4 h-4" />
          <span>知見</span>
        </Link>

        <Link
          href="/lane-guides"
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            pathname === '/lane-guides' ? 'text-amber-400 font-black' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>攻略</span>
        </Link>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            isMobileMenuOpen ? 'text-amber-400 font-black' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Menu className="w-4 h-4" />
          <span>メニュー</span>
        </button>
      </nav>

      {/* 📥 戦術取込モーダル */}
      {isIngestModalOpen && (
        <KnowledgeIngestModal
          isOpen={isIngestModalOpen}
          onClose={() => setIsIngestModalOpen(false)}
          onSaved={() => {
            setIsIngestModalOpen(false);
          }}
        />
      )}
    </>
  );
}
