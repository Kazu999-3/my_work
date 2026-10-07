import React from "react";

// 文中の **太字** だけを <strong> にして表示する（2026-10-08）。
// レーン攻略の本文などは AI が Markdown 風に書いた文字列をそのまま出しており、`**` が記号のまま見えていた。
// 見出し・リンク・表などは扱わない（改行は親の whitespace-pre-wrap に任せる）。
export default function InlineBold({ text }: { text: string }) {
  const parts = (text || "").split(/(\*\*[^*\n]+?\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={i} className="font-bold text-zinc-50">{part.slice(2, -2)}</strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}
