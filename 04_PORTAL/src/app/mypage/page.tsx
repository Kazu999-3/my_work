"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, AlertTriangle, RefreshCw, Sparkles } from "lucide-react";

export default function MyPageRedirect() {
  const router = useRouter();
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
          // 名簿カルテと完全に統一された自分自身のカルテ（設定タブ）へ即時遷移
          router.replace(`/player/${encodeURIComponent(playerName)}?tab=settings`);
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
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1c1917] text-stone-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-stone-300 text-sm font-bold">マイページ（公式カルテ）を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1c1917] text-stone-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#2b2620] border border-amber-500/30 rounded-3xl p-8 text-center shadow-2xl space-y-6 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <Sparkles className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white mb-2">マイページのご利用にはログインが必要です</h2>
          <p className="text-xs text-stone-400 leading-relaxed">
            Discordでログインすると、あなた専用の公式カルテ（通算戦績・プレイスタイル診断・相性分析・希望レーン設定・師弟募集）をすべて確認・変更できます。
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
