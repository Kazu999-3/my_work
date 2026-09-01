"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { Shield, LogIn, Key, Sparkles, AlertTriangle } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const { user, loginWithDiscord } = useCurrentUser();
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // 既存セッションの検証
    fetch("/api/auth/verify", { method: "POST", credentials: "include" })
      .then((res) => {
        if (res.ok) {
          router.replace("/admin/dashboard");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.replace("/admin/dashboard");
      } else {
        setErrorMsg(data.error || "パスワードが正しくありません。");
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(`通信エラーが発生しました: ${err.message}`);
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#eae4d4]">
        <div className="w-10 h-10 border-3 border-stone-800/10 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#f5f1e6] via-[#eae4d4] to-[#ded5be] text-stone-900">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-black/10 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
        
        {/* ロゴ ＆ タイトル */}
        <div className="space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-600 border border-amber-500/30 flex items-center justify-center mx-auto text-3xl shadow-sm">
            <Shield size={32} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900">
            Sovereign Portal 管理認証
          </h1>
          <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
            システムダッシュボードおよび管理機能へアクセスするには、ログインを行ってください。
          </p>
        </div>

        {/* 方法1: 🎮 Discord管理者アカウントで1秒ログイン */}
        <div className="p-5 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 space-y-3">
          <div className="text-left">
            <div className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-600" />
              おすすめ：Discordアカウントで認証
            </div>
            <p className="text-[11px] text-stone-600 mt-0.5">
              管理者Discordアカウント（かずき）でログインすると、パスワード不要で即座に開きます🔥
            </p>
          </div>
          <button
            type="button"
            onClick={() => loginWithDiscord('/admin/dashboard')}
            className="w-full py-3.5 px-4 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs transition-all shadow-md hover:shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer transform active:scale-98"
          >
            <LogIn size={16} />
            Discordアカウントで管理者ログイン
          </button>
        </div>

        {/* 区切り線 */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-stone-200" />
          <span className="text-[10px] font-bold text-stone-400">または パスコードで認証</span>
          <div className="flex-1 h-px bg-stone-200" />
        </div>

        {/* 方法2: 🔑 パスワード認証フォーム */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1">
              <Key size={13} className="text-stone-500" />
              管理者パスコード
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded-xl px-4 py-3 text-sm font-mono text-stone-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-all shadow-inner"
              disabled={isLoading}
              required
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 text-rose-600" />
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-stone-900 hover:bg-amber-600 text-white font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? "検証中..." : "パスコードでゲートを通過する ➔"}
          </button>
        </form>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#eae4d4]">
          <div className="w-10 h-10 border-3 border-stone-800/10 border-t-amber-600 rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
