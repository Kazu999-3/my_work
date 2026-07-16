"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 課題③: ソロキュー偵察機能は /coach の「🎯 スカウト」タブに統合済み。
// このページ自体は後方互換のリダイレクトとしてのみ残す（ブックマーク・外部リンク対策）。
export default function SoloqScoutRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/coach?tab=scout");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white text-sm">
      /coach のスカウトタブへ移動しました。リダイレクト中...
    </div>
  );
}
