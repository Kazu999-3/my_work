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

  // タスクバー/DockのバッジをService Worker側(push受信時)だけでなく、
  // ページを開いて既読にした時点でも同期する(#63)。未対応ブラウザ/
  // 未インストール環境では 'setAppBadge' が無いので何もしない。
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
      // ドロップダウンは document.body へ Portal 描画しているため、
      // containerRef だけでなく dropdownRef 内のクリックも「外側」判定から除外する。
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

  // サイドバーの <aside> は overflow-y-auto (スクロール領域) なので、absolute位置指定の
  // ドロップダウンだとサイドバー幅で見切れて中身が切れてしまっていた。
  // ボタンの画面上の位置を測って document.body へ Portal 描画し、position: fixed で
  // 出すことでサイドバーのoverflowに影響されないようにする。
  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v;
      if (next && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCoords(
          align === 'right'
            ? { top: rect.bottom + 8, right: window.innerWidth - rect.right }
            : { top: rect.bottom + 8, left: rect.left }
        );
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

  // 本文をタップした時は既読化＋開閉のみ行い、遷移はしない
  // （2行省略された本文を全文読みたいだけで、対面メモ画面へ飛びたいとは限らないため）。
  // 実際のページ遷移は下の明示的な「開く」リンクに分離する。
  const toggleExpand = (n: AdminNotification) => {
    markRead(n);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(n.id)) next.delete(n.id); else next.add(n.id);
      return next;
    });
  };

  return (
    <div ref={containerRef} className={`relative ${collapsed ? '' : 'w-full'}`}>
      <button
        onClick={toggleOpen}
        title="通知"
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all hover:bg-black/5 hover:text-stone-900 text-gray-400 relative ${
          collapsed ? 'justify-center' : 'w-full'
        }`}
      >
        <span className="relative">
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white">
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
          className="fixed z-50 w-80 max-w-[85vw] max-h-96 overflow-y-auto rounded-2xl border border-black/10 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
            <span className="text-xs font-black text-gray-700">通知</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] font-bold text-cyan-700 hover:text-cyan-800">
                すべて既読にする
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-gray-500">通知はありません</div>
          ) : (
            <div className="divide-y divide-black/5">
              {notifications.map((n) => {
                const isExpanded = expandedIds.has(n.id);
                const isLong = !!n.body && n.body.length > 50;
                return (
                  <div key={n.id} className={`px-4 py-3 ${!n.read ? 'bg-cyan-50' : ''}`}>
                    <button
                      onClick={() => toggleExpand(n)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-gray-800">{n.title}</div>
                          {n.body && (
                            <div className={`mt-0.5 text-[10px] text-gray-500 whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-2'}`}>
                              {n.body}
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[9px] text-gray-500">{timeAgo(n.created_at)}</span>
                            {isLong && (
                              <span className="text-[9px] font-bold text-cyan-700">{isExpanded ? '閉じる' : 'もっと見る'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                    {n.url && (
                      <a
                        href={n.url}
                        onClick={() => markRead(n)}
                        className="mt-1.5 ml-3.5 inline-block text-[10px] font-bold text-cyan-700 hover:underline"
                      >
                        関連ページを開く →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
