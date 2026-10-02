'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, RefreshCw, AlertTriangle } from 'lucide-react';

// 外部サイトへのリダイレクトに使われないよう、同一サイト内のパスだけを許可する
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'ログインに失敗しました');
      // Cookie を確実に反映させるため、クライアント遷移ではなく再読み込みで移動する
      window.location.href = safeNext(searchParams.get('next'));
    } catch (err: any) {
      setError(err.message || '通信エラーが発生しました');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
      <div className="space-y-1">
        <h1 className="text-lg font-black text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-400" /> Sovereign Pilot
        </h1>
        <p className="text-xs text-slate-400">合言葉を入力してください。この端末では1年間ログイン状態が保持されます。</p>
      </div>
      <input
        type="password"
        autoComplete="current-password"
        autoFocus
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="合言葉"
        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
      />
      {error && (
        <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/60 text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !token.trim()}
        className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
      >
        {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
        ログイン
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
