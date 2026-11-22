"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { User, AlertTriangle, RefreshCw, Sparkles } from "lucide-react";

function MyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAndRedirect() {
      try {
        setLoading(true);
        const res = await fetch("/api/player/preferences", { credentials: "include" });
        const data = await res.json();
        if (res.ok && data.ok && data.player) {
          const playerName = data.player.name || data.player.discord_id;
          const targetTab = searchParams.get("tab") || "summary";
          router.replace(`/player/${encodeURIComponent(playerName)}?tab=${targetTab}`);
        } else {
          setError(data.error || "ログインが必要です。");
          setLoading(false);
        }
      } catch (err: any) {
        setError("マイページの取得中に通信エラーが発生しました。");
        setLoading(false);
      }
    }
    fetchAndRedirect();
  }, [router, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
          <p className="text-muted text-sm font-bold">マイページを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface border border-border rounded-3xl p-8 text-center shadow-xl space-y-6 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-primary-500/10 border border-primary-edge-strong/30 flex items-center justify-center mx-auto text-primary-500">
          <Sparkles className="w-8 h-8" />
        </div>
        {error && error !== "ログインが必要です。" && (
          <div className="p-3.5 bg-danger-500/10 border border-danger-500/30 rounded-2xl text-xs text-danger-600 dark:text-danger-400 font-bold flex items-center gap-2 text-left animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-danger-500" />
            <span>{error}</span>
          </div>
        )}
        <div>
          <h2 className="text-xl font-black text-foreground mb-2">マイページのご利用にはログインが必要です</h2>
          <p className="text-xs text-muted leading-relaxed">
            Discordでログインすると、あなた専用の公式カルテ（通算戦績・プレイスタイル診断・相性分析・希望レーン設定・師弟募集・🎁 デイリーボーナス）をすべて確認・利用できます。
          </p>
        </div>
        <Link
          href="/api/auth/discord"
          className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-2xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-sm transition-all shadow-lg shadow-[#5865F2]/20 cursor-pointer"
        >
          <User className="w-5 h-5" />
          <span>Discordでログインする</span>
        </Link>
      </div>
    </div>
  );
}

export default function MyPageRedirect() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    }>
      <MyPageContent />
    </Suspense>
  );
}
