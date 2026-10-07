// パッチ鮮度バッジ（旧パッチ / 現行メタ / 1〜2パッチ前）。記事カードと詳細モーダルで共通。
// 2026-10-07: page.tsx の2か所の重複から分割。鮮度が未設定の記事は、カードでは「1〜2パッチ前」、
// 詳細では表示なしだった（分割前のまま。showUnknownAsModerate で切り替える）。
export default function FreshnessBadge({ isOldPatch, daysAgo, freshness, showUnknownAsModerate = false }: {
  isOldPatch?: boolean;
  daysAgo?: number;
  freshness?: 'fresh' | 'moderate' | 'stale';
  showUnknownAsModerate?: boolean;
}) {
  if (isOldPatch) {
    return (
      <span className="px-2 py-0.5 rounded-md bg-rose-950/70 text-rose-300 border border-rose-500/50 text-[10px] font-bold flex items-center gap-1">
        ⚠️ 旧パッチ {daysAgo ? `(${Math.floor(daysAgo / 30)}ヶ月前)` : ''}
      </span>
    );
  }
  if (freshness === 'fresh') {
    return (
      <span className="px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
        🟢 現行メタ
      </span>
    );
  }
  if (freshness === 'moderate' || showUnknownAsModerate) {
    return (
      <span className="px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
        🟡 1〜2パッチ前
      </span>
    );
  }
  return null;
}
