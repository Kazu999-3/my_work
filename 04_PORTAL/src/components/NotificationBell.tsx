"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';

interface AdminNotification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  read: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

// 管理者専用の通知ベル(#63)。ブラウザのプッシュ通知は見逃すと消えるため、
// ポータル内でも履歴を後から見返せるようにする。管理者ログイン中のみ表示。
export default function NotificationBell({ collapsed = false, align = 'left' }: { collapsed?: boolean; align?: 'left' | 'right' }) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // 通知本文はline-clampで2行に省略されるため、KDA/Vision等を含む長い本文
  // (例: ソロQ振り返り通知)を全文読むための開閉状態。
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // タスクバー/Dockのバッジ同期
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    if (unreadCount > 0) {
      (navigator as any).setAppBadge(unreadCount).catch(() => {});
    } else {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }, [unreadCount]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleResize = () => calculateCoords();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [open]);

  const calculateCoords = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const drawerWidth = Math.min(360, window.innerWidth - 32);
    
    let left: number | undefined;
    let right: number | undefined;

    if (align === 'right') {
      const calculatedRight = window.innerWidth - rect.right;
      right = Math.max(16, Math.min(calculatedRight, window.innerWidth - drawerWidth - 16));
    } else {
      const calculatedLeft = rect.left;
      if (calculatedLeft + drawerWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - drawerWidth - 16);
      } else {
        left = Math.max(16, calculatedLeft);
      }
    }

    let top = rect.bottom + 8;
    if (top + 460 > window.innerHeight && rect.top > 460) {
      top = Math.max(16, rect.top - 470);
    }

    setCoords({ top, left, right });
  };

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        setTimeout(calculateCoords, 0);
      }
      return next;
    });
  };

  const markAllRead = async () => {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch('/api/admin/notifications/read', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
    } catch {}
  };

  const markRead = async (n: AdminNotification) => {
    if (n.read) return;
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await fetch('/api/admin/notifications/read', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id }),
      });
    } catch {}
  };

  const clearAllRead = async () => {
    if (!confirm('既読の通知をすべて削除しますか？')) return;
    setDeleting(true);
    setNotifications((prev) => prev.filter((n) => !n.read));
    try {
      await fetch('/api/admin/notifications/delete', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allRead: true }),
      });
    } catch {} finally {
      setDeleting(false);
    }
  };

  const toggleExpand = (n: AdminNotification) => {
    markRead(n);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(n.id)) next.delete(n.id); else next.add(n.id);
      return next;
    });
  };

  const getNotificationBadge = (n: AdminNotification) => {
    const title = n.title.toLowerCase();
    const type = n.type.toLowerCase();
    if (type.includes('soloq') || title.includes('ソロq') || title.includes('振り返り')) {
      return { icon: '🎮', label: 'ソロQ', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
    if (type.includes('discord') || title.includes('メンバー') || title.includes('参加')) {
      return { icon: '👤', label: '新メンバー', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
    }
    if (type.includes('match') || title.includes('内戦') || title.includes('試合')) {
      return { icon: '🏆', label: '大会・内戦', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    if (type.includes('error') || title.includes('エラー') || title.includes('失敗')) {
      return { icon: '⚠️', label: 'アラート', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
    }
    return { icon: '🔔', label: 'お知らせ', bg: 'bg-stone-100 text-stone-800 border-stone-200' };
  };

  const getQuickAction = (n: AdminNotification) => {
    const title = n.title.toLowerCase();
    const type = n.type.toLowerCase();
    if (type.includes('soloq') || title.includes('ソロq') || title.includes('振り返り')) {
      return { label: '⚡ 1分振り返りを開く →', url: '/coach' };
    }
    if (type.includes('discord') || title.includes('メンバー') || title.includes('参加')) {
      return { label: '👤 名簿で確認・Rank設定 →', url: '/ktm-admin' };
    }
    if (type.includes('match') || title.includes('内戦') || title.includes('試合')) {
      return { label: '🏆 戦績履歴を見る →', url: '/ktm-admin' };
    }
    if (type.includes('error') || title.includes('riot')) {
      return { label: '🔧 Riot ID修正へ →', url: '/ktm-admin' };
    }
    return n.url ? { label: '関連ページを開く →', url: n.url } : null;
  };

  const displayedNotifications = onlyUnread 
    ? notifications.filter(n => !n.read) 
    : notifications;

  return (
    <div ref={containerRef} className={`relative ${collapsed ? '' : 'w-full'}`}>
      <button
        onClick={toggleOpen}
        title="通知"
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all hover:bg-black/5 hover:text-stone-900 text-gray-400 relative cursor-pointer ${
          collapsed ? 'justify-center' : 'w-full'
        }`}
      >
        <span className="relative">
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white shadow-2xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        {!collapsed && <span>通知{unreadCount > 0 ? ` (${unreadCount})` : ''}</span>}
      </button>

      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{ top: coords.top, left: coords.left, right: coords.right }}
          className="fixed z-50 w-96 max-w-[calc(100vw-2rem)] max-h-[460px] overflow-hidden flex flex-col rounded-2xl border border-stone-300/80 bg-white shadow-2xl animate-in"
        >
          {/* ヘッダー コントロールバー */}
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 bg-stone-50/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-stone-900">通知センター</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black">
                  未読 {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setOnlyUnread(!onlyUnread)}
                className={`px-2 py-0.5 rounded-md transition cursor-pointer border ${
                  onlyUnread ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-100'
                }`}
              >
                {onlyUnread ? '未読のみ' : 'すべて'}
              </button>

              {unreadCount > 0 && (
                <button 
                  type="button"
                  onClick={markAllRead} 
                  className="text-amber-800 hover:text-amber-950 transition cursor-pointer"
                  title="すべて既読にする"
                >
                  ✓ 全既読
                </button>
              )}

              {notifications.some(n => n.read) && (
                <button
                  type="button"
                  onClick={clearAllRead}
                  disabled={deleting}
                  className="text-stone-400 hover:text-rose-700 transition cursor-pointer"
                  title="既読の通知をすべて削除"
                >
                  🗑️ 既読消去
                </button>
              )}
            </div>
          </div>

          {/* 通知リスト本体 */}
          <div className="overflow-y-auto flex-1 divide-y divide-stone-100">
            {displayedNotifications.length === 0 ? (
              <div className="px-4 py-12 text-center text-xs text-stone-400 font-medium">
                {onlyUnread ? '未読の通知はありません 🎉' : '通知はありません'}
              </div>
            ) : (
              displayedNotifications.map((n) => {
                const isExpanded = expandedIds.has(n.id);
                const isLong = !!n.body && n.body.length > 40;
                const badge = getNotificationBadge(n);
                const action = getQuickAction(n);

                return (
                  <div 
                    key={n.id} 
                    className={`p-3.5 transition-colors ${
                      !n.read ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-base shrink-0 select-none mt-0.5">{badge.icon}</span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${badge.bg}`}>
                            {badge.label}
                          </span>
                          <span className="text-[9px] text-stone-400 font-mono">{timeAgo(n.created_at)}</span>
                        </div>

                        <div 
                          onClick={() => toggleExpand(n)}
                          className="cursor-pointer group"
                        >
                          <div className={`text-xs font-black text-stone-900 group-hover:text-amber-800 transition ${!n.read ? 'font-black' : 'font-bold text-stone-700'}`}>
                            {n.title}
                          </div>

                          {n.body && (
                            <p className={`mt-1 text-[11px] text-stone-600 whitespace-pre-wrap leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                              {n.body}
                            </p>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-stone-100">
                          {action ? (
                            <a
                              href={action.url}
                              onClick={() => markRead(n)}
                              className="text-[10px] font-black text-amber-800 hover:text-amber-950 transition hover:underline flex items-center gap-0.5"
                            >
                              {action.label}
                            </a>
                          ) : <div />}

                          {isLong && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(n)}
                              className="text-[9px] font-bold text-stone-400 hover:text-stone-700 cursor-pointer"
                            >
                              {isExpanded ? '閉じる ▲' : 'もっと見る ▼'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
