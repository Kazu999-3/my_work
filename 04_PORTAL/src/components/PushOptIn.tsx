"use client";

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { toast } from './Toaster';

// Web Push 購読ボタン (課題#52)。ブラウザ通知の許可→購読→サーバー保存を行う。
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PushOptIn({ collapsed = false }: { collapsed?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(ok);
    if (ok) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribed(!!sub))
        .catch(() => {});
    }
  }, []);

  const subscribe = async () => {
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) { toast.error('通知キー(VAPID)が未設定です。管理者に連絡してください。'); return; }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast.info('通知が許可されませんでした。'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // 新しいTSのUint8Array型(ArrayBufferLike)がBufferSourceと厳密には非互換になるためキャスト
        applicationServerKey: urlBase64ToUint8Array(vapid) as unknown as BufferSource,
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, userAgent: navigator.userAgent }),
      });
      if (!res.ok) throw new Error('購読の保存に失敗しました');
      setSubscribed(true);
      toast.success('通知を有効化しました');
    } catch (e: any) {
      toast.error('通知の有効化に失敗: ' + e.message);
    } finally { setBusy(false); }
  };

  const unsubscribe = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.info('通知を無効化しました');
    } catch (e: any) {
      toast.error('解除に失敗: ' + e.message);
    } finally { setBusy(false); }
  };

  if (!supported) return null;

  return (
    <button
      onClick={subscribed ? unsubscribe : subscribe}
      disabled={busy}
      title={subscribed ? '通知を無効化' : '通知を有効化'}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all disabled:opacity-50 ${
        subscribed ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-400 hover:bg-white/5 hover:text-white'
      } ${collapsed ? 'justify-center' : 'w-full'}`}
    >
      {subscribed ? <Bell size={16} /> : <BellOff size={16} />}
      {!collapsed && <span>{subscribed ? '通知ON' : '通知を有効化'}</span>}
    </button>
  );
}
