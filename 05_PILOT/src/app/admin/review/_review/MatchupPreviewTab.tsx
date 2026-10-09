'use client';

import { Swords } from 'lucide-react';
import type { PreviewResult } from './types';

// プレビュー: 対面DB（matchup_sentinel の ${champion}_vs_${enemy} 行）への追記文面
export default function MatchupPreviewTab({ previewData }: { previewData: PreviewResult | null }) {
  const previews = previewData?.matchupPreviews || [];

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-zinc-400">
        個別対面DB（`matchup_sentinel`）の対象マッチアップ行に、レーン属性とともに統合・追記されます。
      </div>
      {previews.length > 0 ? (
        previews.map((mp) => (
          <div key={mp.matchupId} className="p-4 rounded-xl bg-zinc-950 border border-rose-900/50 space-y-2">
            <div className="flex items-center justify-between text-xs text-rose-300 font-bold border-b border-zinc-800 pb-2">
              <span className="flex items-center gap-1.5">
                <Swords size={14} className="text-rose-400" />
                <span>対面: {mp.championJa} vs {mp.enemyJa} [{mp.lane}]</span>
              </span>
              <span className="font-mono text-[10px] text-zinc-500">{mp.matchupId}</span>
            </div>
            <div className="p-3 bg-[#111115] rounded-lg border border-zinc-800/80 max-h-72 overflow-y-auto font-sans leading-relaxed text-zinc-200 text-xs whitespace-pre-wrap select-text">
              {mp.sectionText}
            </div>
          </div>
        ))
      ) : (
        <p className="p-4 rounded-xl bg-zinc-950 text-zinc-500 text-xs border border-zinc-800">
          対面相手が検出されていないか指定されていません。対面記事として統合する場合は、上部の「対面相手」欄にチャンピオン名を入力してください。
        </p>
      )}
    </div>
  );
}
