"use client";

import { ExternalLink } from "lucide-react";
import type { FactClaim } from "./types";

// 辞典の記述を出典付きで並べる（2026-10-07）。
// 出典のある記述（ライブラリの動画・記事 / 検索結果 / 手入力）は出典を、出典の無い AI 生成は「AI推定・出典なし」を必ず添える。
const ORIGIN_LABEL: Record<FactClaim["origin"], string> = {
  library: "ライブラリ",
  library_mixed: "ライブラリ＋AI",
  web_search: "検索",
  manual: "手入力",
  ai_estimate: "AI推定・出典なし",
};

export default function FactClaimList({ claims, marker, markerClass }: {
  claims: FactClaim[];
  marker: string;
  markerClass: string;
}) {
  return (
    <div className="space-y-2 text-xs">
      {claims.map((c, idx) => {
        const isAi = c.origin === "ai_estimate";
        return (
          <div key={idx} className={`bg-zinc-950 p-2.5 rounded-xl border leading-relaxed ${isAi ? "border-zinc-800/60 text-zinc-400" : "border-zinc-800/80 text-zinc-300"}`}>
            <div className="flex items-start gap-2">
              <span className={`font-black mt-0.5 ${markerClass}`}>{marker}</span>
              <span className="leading-relaxed whitespace-pre-line">{c.text}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
              <span className={`px-1.5 py-0.5 rounded font-bold ${isAi ? "bg-zinc-800 text-zinc-400" : "bg-teal-950/40 text-teal-300 border border-teal-800/50"}`}>
                {ORIGIN_LABEL[c.origin]}
              </span>
              {c.needsReview && (
                <span className="px-1.5 py-0.5 rounded font-bold bg-rose-950/30 text-rose-300 border border-rose-800/50" title="記事を取り込んだ時にAIが既存の文章と混ぜて書き直したもの。AIの記憶が混ざっている可能性があります">
                  要確認
                </span>
              )}
              {!isAi && c.sourceTitle && (
                c.sourceUrl ? (
                  <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-zinc-400 hover:text-amber-300 underline decoration-zinc-700 break-all">
                    {c.sourceTitle}<ExternalLink size={10} className="shrink-0" />
                  </a>
                ) : (
                  <span className="break-all">{c.sourceTitle}</span>
                )
              )}
              {c.date && <span>{c.date}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
