"use client";

import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { SecretMatchmakerModal } from "../../mentorship/SecretMatchmakerModal";

// 師弟のお見合い便（2026-10-20 ユーザー判断で「教えて先輩」画面の管理者ボタンから管理画面へ移した）。
// お見合いの案内は本人の個別案内チャンネルへ届くため、「個別案内」タブに置く。
export default function MatchmakerSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary-600" /> 師弟のお見合い便
        </div>
        <p className="text-[11px] text-muted-strong mt-1">
          後輩とおすすめの先輩の組み合わせを出して、後輩の個別案内チャンネルへ案内を送ります。見送っても相手には通知されません。
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 px-4 py-2 rounded-lg text-xs font-black bg-primary-600 hover:bg-primary-500 text-white cursor-pointer"
      >
        お見合い便を開く
      </button>
      <SecretMatchmakerModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
}
