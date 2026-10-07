import React from "react";
import InlineBold from "./InlineBold";

// AI が書いた Markdown 風の文章を、見出し（# / ## / ###）・箇条書き（* / -）・太字（**）だけ整えて表示する（2026-10-08）。
// ソロQの自動振り返りなどで `###` や `**` が記号のまま出ていた。表・リンク・コードブロックは扱わない。
export default function LiteMarkdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  return (
    <div className={className}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <div key={i} className="h-2" />;
        const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
        if (heading) {
          return (
            <div key={i} className="font-black text-amber-300 mt-2 first:mt-0">
              <InlineBold text={heading[1].replace(/\*\*/g, "")} />
            </div>
          );
        }
        const bullet = line.match(/^(\s*)[*\-・]\s+(.*)$/);
        if (bullet) {
          return (
            <div key={i} className="flex gap-1.5" style={{ paddingLeft: bullet[1].length ? 12 : 0 }}>
              <span className="shrink-0 text-amber-500">・</span>
              <span><InlineBold text={bullet[2]} /></span>
            </div>
          );
        }
        return (
          <div key={i}>
            <InlineBold text={line} />
          </div>
        );
      })}
    </div>
  );
}
