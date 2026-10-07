"use client";

import { Info, X } from "lucide-react";

// MMR計算ロジックの説明。
// ★ 2026-10-07: 以前の説明（Elo K=48、KDA (KDA-3.0)×8、ランク収束引力、試合数で3.0倍/2.0倍、対面回数倍率、
// 勝ち最低+10/負け最大-5）は実装と食い違っていた（ランク収束引力は実装されておらず、対面回数倍率は廃止済み）。
// lib/mmr.ts の calculateNewMMR / propagateCrossLaneMmr に合わせて書き直した。計算を変えたらここも直すこと。
export default function MmrInfoPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="bg-surface border border-primary-edge-soft rounded-xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary-500"></div>
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold text-primary-700 flex items-center gap-2">
          <Info className="h-6 w-6" /> MMR計算ロジック
        </h2>
        <button onClick={onClose} className="text-muted-strong hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-foreground-subtle">
        <div className="space-y-3">
          <div>
            <h3 className="font-bold text-foreground text-base">1. 勝敗の基本点と相手の強さ</h3>
            <p>勝ちは <span className="text-primary-700 font-mono">+18</span>、負けは <span className="text-primary-700 font-mono">-20</span> が基本。同じレーンの対面とのMMR差で補正します（格上相手は最大 <span className="text-primary-700 font-mono">+15</span>、格下相手は最大 <span className="text-primary-700 font-mono">-10</span>）。負けても最低 <span className="font-mono">-2</span> は下がります。</p>
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">2. KDAボーナス</h3>
            <p>KDA が 2.0 を超えた分を <span className="text-primary-700 font-mono">(KDA - 2.0) × 5</span> で加点（<span className="font-mono">0〜+15</span>、マイナスにはならない）。サポートは KDA に <span className="font-mono">+0.8</span> の補正。デス0のときは (キル+アシスト)×1.2 を KDA とみなします。</p>
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">3. 格上撃破ボーナス</h3>
            <p>対面が自分より MMR <span className="font-mono">200</span> 以上高く、勝利または KDA 3.0 以上のとき <span className="font-mono">+2〜+6</span>。</p>
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">4. 高勝率の補正</h3>
            <p>通算勝率が 60% を超える人は、勝ちの増え幅を減らし負けの減り幅を増やします（最大 <span className="font-mono">8</span>）。上位のレートが上がり続けるのを抑えるためです。</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <h3 className="font-bold text-foreground text-base">5. 試合数が少ないレーン</h3>
            <p>そのレーンでの試合数が 5 未満のうちは、変動を <span className="text-primary-700 font-mono">1.5倍</span> にして早く適正なレートへ寄せます。</p>
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">6. 1試合の上限・下限</h3>
            <p>勝ちは <span className="text-success-700 font-mono">0〜+50</span>、負けは <span className="text-danger-700 font-mono">-3〜-40</span>（負けたら必ず下がる）。試合数5未満のレーンは <span className="font-mono">+70 / -60</span> まで。</p>
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">7. 他のレーンへの波及</h3>
            <p>プレイしたレーンの増減の <span className="text-primary-700 font-mono">25%</span> を他の4レーンにも反映します（各レーン 800〜3000 の範囲）。</p>
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">初期値</h3>
            <p>最高Rank と希望レーンから決めます（Discord同期で新規登録した時、Rebuild の出発点）。</p>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border text-xs text-muted-strong">
        ※ MMRは、戦績の記録時と、管理ダッシュボードの「🔄 Rebuild」実行時に過去の全試合から現在の計算方法で一括再計算されます。
      </div>
    </div>
  );
}
