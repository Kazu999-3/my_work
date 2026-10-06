// パッチ鮮度・バージョン推定および旧パッチ判定ユーティリティ
// 2026-10-06 新設: 攻略記事・動画の鮮度管理 ＆ 検索汚染防止（ジョージぱぱ原則）

export interface FreshnessInfo {
  publishedAt: string | null;     // YYYY-MM-DD 形式
  estimatedPatch: string;         // 例: "26.19", "26.1", "14.24"
  isExplicitPatch: boolean;       // タイトルや本文から明示的に取れたか
  freshness: 'fresh' | 'moderate' | 'stale'; // fresh: 30日以内, moderate: 31〜60日, stale: 61日以上
  daysAgo: number;                // 経過日数
  isOldPatch: boolean;            // 旧パッチ（60日超またはstale）
  badgeColor: {
    bg: string;
    text: string;
    border: string;
  };
  label: string;                  // 表示用ラベル (例: "現行メタ", "1〜2パッチ前", "旧パッチ")
}

/**
 * タイトルや本文、公開日/作成日から記事のパッチバージョンと鮮度を計算する
 * 
 * @param title 記事タイトル
 * @param content 記事本文（省略可）
 * @param rawPublishedAt YouTube公開日時または作成日時 (ISO文字列)
 * @param currentCalendarPatch 現在の公式カレンダーパッチ (例: "26.19")
 */
export function calculateFreshness(
  title: string = '',
  content: string = '',
  rawPublishedAt: string | null | undefined,
  currentCalendarPatch: string = '26.19'
): FreshnessInfo {
  const textToScan = `${title} ${content.slice(0, 800)}`.toLowerCase();
  
  // 1. タイトルまたは冒頭から明示的なパッチ表記を検出 (例: patch 26.19, パッチ 26.1, patch14.2)
  let explicitPatch: string | null = null;
  const patchMatch = textToScan.match(/(?:patch|パッチ|ver\.?|version|シーズン|season)\s*[:：]?\s*([0-9]{1,2}\.[0-9]{1,2})/i);
  if (patchMatch) {
    let p = patchMatch[1];
    // 16.x を 26.x に読み替える（カレンダーパッチ対応）
    if (p.startsWith('16.')) {
      p = '26.' + p.slice(3);
    }
    explicitPatch = p;
  }

  // 2. 日付の計算
  let targetDate: Date | null = null;
  if (rawPublishedAt) {
    const d = new Date(rawPublishedAt);
    if (!isNaN(d.getTime())) {
      targetDate = d;
    }
  }

  const now = new Date();
  // 万一targetDateが無い場合は現在日時をフォールバック
  const effectiveDate = targetDate || now;
  const diffMs = Math.max(0, now.getTime() - effectiveDate.getTime());
  const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // 3. パッチ番号の推定（明示的パッチが無い場合、日付から推定）
  let estimatedPatch = explicitPatch;
  if (!estimatedPatch) {
    const year = effectiveDate.getFullYear();
    const month = effectiveDate.getMonth() + 1; // 1-12
    const day = effectiveDate.getDate();

    if (year >= 2026) {
      // 2026シーズン (約2週間に1回パッチ、年間約24パッチ)
      // 1月上旬を 26.1 とし、おおよそのパッチ番号を算出
      const dayOfYear = Math.floor((effectiveDate.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24));
      const patchNum = Math.max(1, Math.min(24, Math.ceil(dayOfYear / 14)));
      estimatedPatch = `26.${patchNum}`;
    } else if (year === 2025) {
      estimatedPatch = `15.${Math.max(1, Math.min(24, Math.ceil((month * 30 + day) / 14)))}`;
    } else if (year === 2024) {
      estimatedPatch = `14.${Math.max(1, Math.min(24, Math.ceil((month * 30 + day) / 14)))}`;
    } else {
      estimatedPatch = `旧環境(${year})`;
    }
  }

  // 4. 鮮度ステータスの判定
  // - fresh: 30日以内（現行または直前パッチ）
  // - moderate: 31〜60日前（1〜2パッチ前、基本ロジックは生きているが微調整あり）
  // - stale: 61日以上前、または別シーズン（アイテムやルーン変更のリスク大）
  let freshness: 'fresh' | 'moderate' | 'stale';
  if (daysAgo <= 30) {
    freshness = 'fresh';
  } else if (daysAgo <= 60) {
    freshness = 'moderate';
  } else {
    freshness = 'stale';
  }

  // もし明示的に古いシーズン（14.xや15.x）と書かれている場合は強制的に stale
  if (explicitPatch && !explicitPatch.startsWith('26.')) {
    freshness = 'stale';
  }

  const isOldPatch = freshness === 'stale';

  // バッジスタイル
  let badgeColor = {
    bg: 'bg-emerald-950/60',
    text: 'text-emerald-300',
    border: 'border-emerald-500/40',
  };
  let label = '🟢 現行メタ';

  if (freshness === 'moderate') {
    badgeColor = {
      bg: 'bg-amber-950/60',
      text: 'text-amber-300',
      border: 'border-amber-500/40',
    };
    label = '🟡 1〜2パッチ前';
  } else if (freshness === 'stale') {
    badgeColor = {
      bg: 'bg-rose-950/70',
      text: 'text-rose-300',
      border: 'border-rose-500/50',
    };
    label = '⚠️ 旧パッチ';
  }

  // 日付文字列 (YYYY-MM-DD)
  const publishedAtStr = targetDate ? targetDate.toISOString().split('T')[0] : null;

  return {
    publishedAt: publishedAtStr,
    estimatedPatch,
    isExplicitPatch: !!explicitPatch,
    freshness,
    daysAgo,
    isOldPatch,
    badgeColor,
    label,
  };
}
