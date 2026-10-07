'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Crown, Bot, BookOpen, Library, Activity, Video, Plus, Menu, X, ChevronRight, Sparkles, Shield, ClipboardCheck } from 'lucide-react';
import KnowledgeIngestModal from './KnowledgeIngestModal';
import NotificationBell from './NotificationBell';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'チャンピオン辞典', href: '/', icon: Crown },
  { name: 'AI戦術コーチ', href: '/coach', icon: Bot },
  { name: 'レーン攻略', href: '/lane-guides', icon: BookOpen },
  { name: '攻略ライブラリ', href: '/library', icon: Library },
  { name: '辞典ヘルス監査', href: '/admin/dict-health', icon: Activity },
  { name: 'YouTube解析', href: '/admin/youtube', icon: Video },
  // 動画解析で作られた記事の承認（承認すると辞典へ統合）。以前はYouTube解析ページ内のリンクからしか行けなかった
  { name: '記事の承認', href: '/admin/review', icon: ClipboardCheck },
  { name: '運用ダッシュボード', href: '/admin/dashboard', icon: Shield },
];

export default function GlobalNavbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);

  return (
    <>
      {/* 👑 トップ固定グローバルメニューバー */}
      <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
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
              <p className="text-[10px] text-zinc-400 hidden xl:block">
                LoL 戦術バイブル ＆ リアルタイムHUD連動コクピット
              </p>
            </div>
          </Link>

          {/* PC向けメニューバー (横並びタブ)
              2026-10-08: 8項目を名前つきで並べると 768〜1279px で入りきらず、名前が1文字ずつ折り返していた。
              1280px未満はアイコンのみ（表示中のページだけ名前も出す。名前はマウスを乗せると出る） */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-bold min-w-0">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.name}
                  className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-950/40'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-zinc-400'}`} />
                  <span className={isActive ? '' : 'hidden xl:inline'}>{item.name}</span>
                </Link>
              );
            })}
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
        <div className="md:hidden fixed inset-0 z-40 bg-zinc-950/95 backdrop-blur-xl pt-16 px-4 pb-20 space-y-4 animate-in fade-in slide-in-from-top-4 duration-150 overflow-y-auto">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-2">
            ナビゲーションメニュー
          </div>
          <div className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
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
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
              );
            })}
          </div>

          <div className="pt-4 border-t border-zinc-800/80">
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
            pathname === '/' ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Crown className="w-4 h-4" />
          <span>辞典</span>
        </Link>

        <Link
          href="/coach"
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            pathname === '/coach' ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>コーチ</span>
        </Link>

        <Link
          href="/lane-guides"
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            pathname === '/lane-guides' ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>攻略</span>
        </Link>

        <Link
          href="/library"
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            pathname === '/library' ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Library className="w-4 h-4" />
          <span>記事</span>
        </Link>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            isMobileMenuOpen ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
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
