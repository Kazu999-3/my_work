"use client";

import React, { useEffect, useState } from 'react';
import { useVisiblePolling } from '../lib/useVisiblePolling';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  LayoutDashboard,
  Swords,
  BookOpen,
  BookHeart,
  Trophy,
  Users,
  HeartHandshake,
  ChevronLeft,
  ChevronRight,
  Menu as MenuIcon,
  X as XIcon,
  TrendingUp,
  Coins,
  LogIn,
  LogOut,
  UserCheck,
  Home,
  Globe,
  Gift,
  Check,
  History,
  Library,
  Download,
  Inbox,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import PushOptIn from './PushOptIn';
import NotificationBell from './NotificationBell';
import TaskStatusDrawer from './TaskStatusDrawer';
import ThemeToggle from './ThemeToggle';
import { useCurrentUser } from '../hooks/useCurrentUser';

function UserAuthWidget({ collapsed, inDrawer }: { collapsed?: boolean; inDrawer?: boolean }) {
  const { user, loading, loginWithDiscord, logout, refreshUser } = useCurrentUser();
  const [claiming, setClaiming] = useState(false);

  const handleQuickDailyClaim = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || user.claimedDaily || claiming) return;

    setClaiming(true);
    try {
      const res = await fetch('/api/bet', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: user.discordId,
          playerName: user.playerName || user.displayName,
          type: 'daily'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        try {
          confetti({
            particleCount: 60,
            spread: 55,
            origin: { y: 0.7 },
            colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899']
          });
        } catch {}
        if (data.message) {
          alert(data.message);
        }
        refreshUser();
      } else {
        alert(data.error || '受取に失敗しました');
      }
    } catch {
      alert('通信エラーが発生しました');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return null;

  if (user) {
    const targetName = user.playerName || user.displayName;
    const mypageHref = targetName ? `/player/${encodeURIComponent(targetName)}?tab=settings` : '/mypage';

    return (
      <div
        className={`p-2.5 rounded-2xl bg-primary-500/10 dark:bg-primary-500/15 border border-primary-edge-strong/20 flex items-center gap-2 transition ${
          collapsed && !inDrawer ? 'justify-center' : ''
        }`}
      >
        <Link href={mypageHref} className="flex items-center gap-2.5 min-w-0 flex-1 group">
          <img
            src={user.avatar}
            alt={user.displayName}
            className="w-8 h-8 rounded-full border border-primary-edge-strong/40 shrink-0 group-hover:scale-105 transition"
          />
          {(!collapsed || inDrawer) && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-foreground dark:text-stone-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition">
                {user.displayName}
              </div>
              <div className="text-[11px] font-bold text-primary-700 dark:text-primary-300 flex items-center gap-1">
                <span>🪙</span>
                <span>{(user.coins ?? 1000).toLocaleString()} pt</span>
              </div>
            </div>
          )}
        </Link>

        {/* 🎁 デイリーボーナス ワンタップ受取ボタン */}
        {!user.claimedDaily && (!collapsed || inDrawer) && (
          <button
            type="button"
            onClick={handleQuickDailyClaim}
            disabled={claiming}
            className="px-2 py-1 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-stone-950 font-black text-[10px] rounded-xl shadow-xs transition-all animate-pulse flex items-center gap-1 cursor-pointer shrink-0 border border-primary-edge"
            title="本日のデイリーボーナス (+100pt) を受け取る"
          >
            <Gift size={12} className="shrink-0" />
            <span>{claiming ? '...' : '+100'}</span>
          </button>
        )}

        {/* 折りたたみ時のコンパクト受取バッジ */}
        {!user.claimedDaily && collapsed && !inDrawer && (
          <button
            type="button"
            onClick={handleQuickDailyClaim}
            disabled={claiming}
            className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 text-stone-950 rounded-full flex items-center justify-center text-[9px] font-black border border-white animate-pulse"
            title="本日のデイリーボーナス受取可能！"
          >
            🎁
          </button>
        )}

        {(!collapsed || inDrawer) && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              logout();
            }}
            title="ログアウト"
            className="p-1.5 rounded-lg text-faint hover:text-danger-600 hover:bg-danger-500/10 transition shrink-0"
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => loginWithDiscord()}
      className={`w-full py-2.5 px-3 rounded-2xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
        collapsed && !inDrawer ? 'px-0' : ''
      }`}
      title="Discordアカウントでログイン"
    >
      <LogIn size={15} />
      {(!collapsed || inDrawer) && <span>Discordでログイン</span>}
    </button>
  );
}

interface MenuItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: any;
  href: string;
  color: string;
  activeBg: string;
  adminOnly?: boolean;
  /** メニューのまとまり。main はホーム・マイページ（スマホでは下メニューにあるのでメニュー画面には出さない） */
  group: MenuGroupKey;
  /** この項目を「表示中」とみなすパスの先頭（href 以外にも当てはめたい時） */
  activePrefixes?: string[];
}

type MenuGroupKey = 'main' | 'play' | 'records' | 'social' | 'help' | 'admin';

// 2026-10-20 ユーザー判断でページを目的ごとに整理した（以前は8項目が同じ並びで、管理者項目も3つに分かれていた）
const MENU_GROUPS: { key: Exclude<MenuGroupKey, 'main'>; title: string }[] = [
  { key: 'play', title: 'カスタムで遊ぶ' },
  { key: 'records', title: 'みんなの記録' },
  { key: 'social', title: '交流' },
  { key: 'help', title: '困ったとき' },
];

// 🌐 一般ユーザー向けメニュー
const GENERAL_MENU_ITEMS: MenuItem[] = [
  { id: 'home', label: 'ホーム', shortLabel: 'ホーム', icon: Home, href: '/', color: 'text-primary-500', activeBg: 'bg-primary-500/15', group: 'main' },
  { id: 'mypage', label: 'マイページ', shortLabel: 'マイページ', icon: Users, href: '/mypage', color: 'text-primary-500', activeBg: 'bg-primary-500/15', group: 'main' },
  // カスタムで遊ぶ（画面の上でも「チーム分け／過去の試合／お祭りピック」を切り替えられる: CustomSubNav）
  { id: 'balancer', label: 'チーム分け', shortLabel: 'チーム分け', icon: Swords, href: '/balancer', color: 'text-danger-600', activeBg: 'bg-danger-500/15', group: 'play' },
  { id: 'history', label: '過去の試合', shortLabel: '過去の試合', icon: History, href: '/history', color: 'text-success-600', activeBg: 'bg-success-500/15', group: 'play' },
  { id: 'festival-pick', label: 'お祭りピック', shortLabel: 'お祭りピック', icon: Sparkles, href: '/festival/pick', color: 'text-amber-500', activeBg: 'bg-amber-500/15', group: 'play' },
  // みんなの記録
  { id: 'leaderboard', label: '順位表 ＆ 名簿', shortLabel: '順位・名簿', icon: Trophy, href: '/leaderboard', color: 'text-primary-600', activeBg: 'bg-primary-500/15', group: 'records' },
  { id: 'casino', label: '勝敗予想', shortLabel: '勝敗予想', icon: Coins, href: '/casino', color: 'text-primary-600', activeBg: 'bg-primary-500/15', group: 'records' },
  // 交流
  { id: 'mentorship', label: '教えて先輩', shortLabel: '教えて先輩', icon: HeartHandshake, href: '/mentorship', color: 'text-success-500', activeBg: 'bg-success-500/15', group: 'social' },
  // 困ったとき
  { id: 'guide', label: '使い方ガイド', shortLabel: 'ガイド', icon: BookOpen, href: '/guide', color: 'text-success-600', activeBg: 'bg-success-500/15', group: 'help' },
];

// 🛡️ 管理者向け。外部分析・仕様ガイドは管理画面のタブ・リンクから開く（2026-10-20 に1項目へまとめた）
const ADMIN_EXTRA_ITEMS: MenuItem[] = [
  { id: 'ktm-admin', label: '管理画面', shortLabel: '管理画面', icon: Shield, href: '/ktm-admin', color: 'text-primary-600', activeBg: 'bg-primary-500/15', group: 'admin', activePrefixes: ['/analyzer', '/admin'] },
];

function isItemActive(item: MenuItem, pathname: string): boolean {
  if (pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))) return true;
  if (item.id === 'mypage' && pathname.startsWith('/player/')) return true;
  return (item.activePrefixes || []).some((p) => pathname.startsWith(p));
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  const resolveItemHref = (item: MenuItem) => {
    if (item.id === 'mypage') {
      const targetName = user?.playerName || user?.displayName;
      return targetName ? `/player/${encodeURIComponent(targetName)}?tab=settings` : '/mypage';
    }
    return item.href;
  };

  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sovereign_sidebar_collapsed');
    if (savedCollapsed === 'true') {
      setIsCollapsed(true);
    }

    // 厳格な管理者判定（Discord ID または API検証結果）
    const isOwnerId = user?.discordId === '697220229964759130';
    if (user && (user.isAdmin || isOwnerId)) {
      setIsAdminUser(true);
    }

    // サーバー認証状態の確認
    fetch("/api/auth/verify", { method: "POST", credentials: "include", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setIsAdminUser(true);
        }
      })
      .catch(() => {});
  }, [user]);

  // モバイルドロワー開閉時の背景スクロール制御
  useEffect(() => {
    if (showMobileDrawer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showMobileDrawer]);

  // 相談待ちの後輩（PUPIL）プロフィール数（リアルタイムバッジ用: 後輩がペア成立済みの時は0になる）
  const [mentorshipCount, setMentorshipCount] = useState<number>(0);

  // 全員の全ページに出るので、表示中だけ5分おき
  useVisiblePolling(async () => {
    try {
      // ユーザー指摘(2026-10-22): 先輩の登録数ではなく、相談相手を探している後輩（PUPIL）の未マッチ数をバッジにする
      const res = await fetch('/api/mentorship/profiles?status=OPEN&roleType=PUPIL');
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok && Array.isArray(data.profiles)) {
        setMentorshipCount(data.profiles.length);
      }
    } catch {
      // ignore
    }
  }, 5 * 60 * 1000);

  // 📱 スマホ用 ボトムバーのスマート退避（オートハイド: 下スクロールで退避、上スクロールで復帰）
  const [isMobileBarVisible, setIsMobileBarVisible] = useState(true);
  useEffect(() => {
    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY < 50) {
            setIsMobileBarVisible(true);
          } else {
            const diff = currentScrollY - lastScrollY;
            if (diff > 8) {
              setIsMobileBarVisible(false);
            } else if (diff < -8) {
              setIsMobileBarVisible(true);
            }
          }
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sovereign_sidebar_collapsed', String(nextState));
  };

  // デスクトップのメニュー: ホーム・マイページの下に、まとまりごとの見出しを付けて並べる
  const desktopSections: { title: string | null; items: MenuItem[] }[] = [
    { title: null, items: GENERAL_MENU_ITEMS.filter((i) => i.group === 'main') },
    ...MENU_GROUPS.map((g) => ({ title: g.title, items: GENERAL_MENU_ITEMS.filter((i) => i.group === g.key) })),
    ...(isAdminUser ? [{ title: '管理者', items: ADMIN_EXTRA_ITEMS }] : []),
  ];

  // スマホ用ボトムバー（2026-10-20 ユーザー判断: ホーム／カスタム／教えて先輩／マイページ／メニュー）
  const mobileBottomBarItems: MenuItem[] = [
    { id: 'home', label: 'ホーム', shortLabel: 'ホーム', icon: Home, href: '/', color: 'text-primary-500', activeBg: 'bg-primary-500/15', group: 'main' },
    { id: 'custom', label: 'カスタム', shortLabel: 'カスタム', icon: Swords, href: '/balancer', color: 'text-danger-600', activeBg: 'bg-danger-500/15', group: 'play', activePrefixes: ['/history', '/festival'] },
    { id: 'mentorship', label: '教えて先輩', shortLabel: '教えて先輩', icon: HeartHandshake, href: '/mentorship', color: 'text-success-500', activeBg: 'bg-success-500/15', group: 'social' },
    { id: 'mypage', label: 'マイページ', shortLabel: 'マイページ', icon: Users, href: '/mypage', color: 'text-primary-500', activeBg: 'bg-primary-500/15', group: 'main' },
  ];

  return (
    <>
      {/* 💻 デスクトップ用 サイドバー */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 bg-[#f7f5f0] dark:bg-background border-r border-border/80 dark:border-border transition-all duration-300 z-30 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/80 dark:border-border">
          {!isCollapsed && (
            <Link href="/" className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-foreground dark:text-white tracking-tight">KTM PORTAL</span>
            </Link>
          )}
          <div className="flex items-center gap-1">
            {!isCollapsed && <ThemeToggle variant="compact" />}
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-xl hover:bg-surface-hover/60 dark:hover:bg-surface-hover text-muted transition cursor-pointer"
            >
              {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>
        </div>

        {/* メニューリスト */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {desktopSections.map((section, si) => (
            <React.Fragment key={section.title || 'main'}>
              {section.title && !isCollapsed && (
                <div className={`px-3 pb-1 text-[10px] font-extrabold tracking-wider ${section.title === '管理者' ? 'text-primary-500' : 'text-faint'} ${si > 0 ? 'pt-3' : ''}`}>
                  {section.title}
                </div>
              )}
              {section.title && isCollapsed && si > 0 && <div className="my-2 border-t border-border/80" />}
          {section.items.map((item: MenuItem) => {
            const Icon = item.icon;
            const itemHref = resolveItemHref(item);
            const isActive = isItemActive(item, pathname);
            const isMentorship = item.id === 'mentorship';

            return (
              <React.Fragment key={item.id}>
                <Link
                  href={itemHref}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                    isActive ? `${item.activeBg} ${item.color}` : 'text-muted hover:bg-surface-hover/50 dark:hover:bg-surface hover:text-foreground dark:hover:text-white'
                  }`}
                  title={isCollapsed ? (isMentorship && mentorshipCount > 0 ? `${item.label} (${mentorshipCount}名募集中)` : item.label) : undefined}
                >
                  <div className="relative shrink-0 flex items-center justify-center">
                    <Icon size={18} />
                    {isCollapsed && isMentorship && mentorshipCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 px-1 text-[9px] font-black rounded-full bg-success-500 text-white min-w-[15px] h-[15px] flex items-center justify-center shadow-xs">
                        {mentorshipCount}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <>
                      <span className="truncate">{item.label}</span>
                      {isMentorship && mentorshipCount > 0 && (
                        <span className="ml-auto px-2 py-0.5 text-[10px] font-black rounded-full bg-success-500/15 dark:bg-success-500/25 text-success-600 dark:text-success-400 border border-success-edge-strong/30 flex items-center gap-1 shrink-0 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
                          <span>{mentorshipCount}名募集中</span>
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </React.Fragment>
            );
          })}
            </React.Fragment>
          ))}
        </div>

        {/* 下部ウィジェット */}
        <div className="p-3 border-t border-border/80 dark:border-border space-y-2">
          {isCollapsed && (
            <div className="flex justify-center pb-1">
              <ThemeToggle variant="compact" />
            </div>
          )}
          <UserAuthWidget collapsed={isCollapsed} />
          {isAdminUser && (
            <>
              <TaskStatusDrawer collapsed={isCollapsed} />
              <NotificationBell collapsed={isCollapsed} />
              <PushOptIn collapsed={isCollapsed} />
            </>
          )}
        </div>
      </aside>

      {/* 📱 スマホ用 ボトム固定ナビゲーションバー (5項目) */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 transform-gpu will-change-transform bg-[#f7f5f0]/95 dark:bg-background/95 backdrop-blur-md border-t border-border dark:border-border px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-lg transition-transform duration-300 ease-out ${isMobileBarVisible || showMobileDrawer ? "translate-y-0" : "translate-y-[120%]"}` }>
        {mobileBottomBarItems.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item, pathname);
          const isMentorship = item.id === 'mentorship';
          return (
            <Link
              key={item.id}
              href={resolveItemHref(item)}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-150 touch-manipulation select-none ${
                isActive
                  ? `${item.color} font-black scale-105`
                  : 'text-muted-strong active:bg-black/5 dark:active:bg-surface/5 font-medium'
              }`}
            >
              <div className={`relative p-1 rounded-xl transition-colors ${isActive ? item.activeBg : ''}`}>
                <Icon size={20} className={isActive ? item.color : 'text-faint'} />
                {isMentorship && mentorshipCount > 0 && (
                  <span className="absolute -top-0.5 -right-1 px-1 text-[9px] font-black rounded-full bg-success-500 text-white min-w-[14px] h-[14px] flex items-center justify-center shadow-xs">
                    {mentorshipCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 leading-none">{item.shortLabel || item.label}</span>
            </Link>
          );
        })}

        {/* ☰ メニューボタン（全機能ドロワー展開） */}
        <button
          type="button"
          onClick={() => setShowMobileDrawer(true)}
          className="flex flex-col items-center justify-center flex-1 py-1 rounded-xl text-muted-strong active:bg-black/5 dark:active:bg-surface/5 font-medium touch-manipulation select-none"
        >
          <div className="p-1 rounded-xl">
            <MenuIcon size={20} className="text-faint" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 leading-none">メニュー</span>
        </button>
      </nav>

      {/* 📱 スマホ用 全機能ボトムシートドロワー */}
      {showMobileDrawer && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end transition-opacity duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setShowMobileDrawer(false)}
          />
          <div className="relative bg-[#f7f5f0] dark:bg-background rounded-t-3xl p-5 border-t border-border dark:border-border max-h-[85vh] overflow-y-auto shadow-2xl z-10 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            
            {/* ドロワーヘッダー */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-border dark:border-border">
              <Link
                href="/"
                onClick={() => setShowMobileDrawer(false)}
                className="flex items-center gap-2 group cursor-pointer"
              >
                <span className="text-lg">👑</span>
                <span className="font-extrabold text-base text-foreground dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition">
                  KTM ポータル
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <ThemeToggle variant="compact" />
                <button
                  onClick={() => setShowMobileDrawer(false)}
                  className="p-2 rounded-full bg-surface-hover/60 dark:bg-surface text-muted hover:bg-stone-300 dark:hover:bg-surface-hover transition"
                  aria-label="閉じる"
                >
                  <XIcon size={18} />
                </button>
              </div>
            </div>

            {/* ユーザーアカウント情報 */}
            <div className="mb-4">
              <UserAuthWidget inDrawer />
            </div>

            {/* 全機能メニュー一覧 */}
            <div className="space-y-4">
              {/* まとまりごとのセクション（ホーム・マイページは下メニューにあるので出さない） */}
              {MENU_GROUPS.map((g) => (
              <div key={g.key}>
                <div className="text-[11px] font-extrabold tracking-wider text-faint mb-2 px-1">
                  {g.title}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {GENERAL_MENU_ITEMS.filter((item) => item.group === g.key).map((item) => {
                    const Icon = item.icon;
                    const itemHref = resolveItemHref(item);
                    const isActive = isItemActive(item, pathname);
                    const isMentorship = item.id === 'mentorship';
                    return (
                      <Link
                        key={item.id}
                        href={itemHref}
                        onClick={() => setShowMobileDrawer(false)}
                        className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                          isActive
                            ? `${item.activeBg} ${item.color} border-current font-black shadow-sm`
                            : 'bg-surface dark:bg-surface border-border/80 dark:border-border text-foreground-subtle dark:text-stone-200 hover:border-primary-edge-strong/40 font-bold'
                        }`}
                      >
                        <div className={`p-1.5 rounded-xl shrink-0 ${isActive ? 'bg-surface/20' : item.activeBg}`}>
                          <Icon size={18} className={item.color} />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs leading-snug line-clamp-2 break-words">{item.label}</span>
                          {isMentorship && mentorshipCount > 0 && (
                            <span className="text-[10px] text-success-600 dark:text-success-400 font-black flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
                              <span>{mentorshipCount}名募集中</span>
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
              ))}

              {/* 🛡️ 管理者専用セクション (管理者かつAdminタブ選択時のみ表示) */}
              {isAdminUser && (
                <div className="pt-2 border-t border-border dark:border-border">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-primary-500 dark:text-primary-400 mb-2 px-1 flex items-center gap-1">
                    <Shield size={12} />
                    <span>管理者</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {ADMIN_EXTRA_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const isActive = isItemActive(item, pathname);
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => setShowMobileDrawer(false)}
                          className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                            isActive
                              ? `${item.activeBg} ${item.color} border-current font-black shadow-sm`
                              : 'bg-surface dark:bg-surface border-primary-edge-soft/60 dark:border-primary-edge-strong/40 text-foreground-subtle dark:text-stone-200 hover:border-primary-edge-strong font-bold'
                          }`}
                        >
                          <div className={`p-1.5 rounded-xl ${item.activeBg}`}>
                            <Icon size={18} className={item.color} />
                          </div>
                          <span className="text-xs leading-snug line-clamp-2 break-words">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

