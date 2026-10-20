// 記事の「中身の濃さ」の簡易判定（2026-10-19）。承認画面（/admin/review）で「薄い可能性」の目印を出し、
// 再解析するかの判断材料にする。採点ではなく目印なので、理由を必ず添えて出す。
//
// 判定の材料:
//  - 具体的な記述の数: 数値＋単位（秒・分・Lv・コア・%・ゴールド・CS 等）とスキルの入力順（Q→E 等）
//  - 一般論の言い回しの数（「意識しましょう」「状況に応じて」等）
//  - 旧プロンプト（7章固定）で作った記事か
//  - 字幕に無い知識で書いた疑い（「現パッチ」「現在のメタ」等）
//  - 新しい2段階の解析で作った記事は、抽出できた事実の件数（analysis_meta.fact_count）
//
// しきい値は 2026-10-19 の承認待ち331件の分布から決めた（1,000字あたりの具体的な記述: 下位10% 1.0件・
// 25% 1.4件・中央値 1.8件 / 一般論: 中央値 1.65件・上位25% 2.4件）。

export interface DensityReport {
  /** 'thin' = 薄い可能性 / 'ok' = 目印なし */
  level: 'thin' | 'ok';
  /** 1,000字あたりの具体的な記述の数 */
  specificPer1k: number;
  /** 1,000字あたりの一般論の言い回しの数 */
  genericPer1k: number;
  /** 本文の文字数（元動画情報・チャプター・リンクを除く） */
  bodyChars: number;
  /** 薄いと判断した理由（level='ok' でも旧形式などの注意は入る） */
  reasons: string[];
  /** 旧プロンプト（7章固定・5,000字以上）で作った記事 */
  legacyTemplate: boolean;
  /** 抽出できた事実の件数（新しい解析のみ） */
  factCount: number | null;
  /** 本文が文の途中で終わっている（2026-10-20 まで Gemini の返事の最初の part だけを読んでいた不具合の影響） */
  truncated: boolean;
  /** 承認の目安（2026-10-20）。approve=承認候補 / check=要確認 / skip=見送り候補。理由は triageReasons */
  triage: 'approve' | 'check' | 'skip';
  triageReasons: string[];
}

const SPECIFIC_RE =
  /[0-9０-９]+(?:\.[0-9]+)?\s*(?:秒|分|Lv|LV|lv|レベル|コア|%|％|ゴールド|G(?![a-zA-Z])|CS|体|回|個|スタック|ウェーブ|キャンプ|HP|AD|AP|射程)|(?:Lv|レベル)\s*[0-9０-９]+|[0-9]{1,2}:[0-9]{2}|\b[QWER]\s*(?:→|➔|>|＞|->)\s*[QWERAF]/g;
const GENERIC_RE = /意識し|重要です|重要になります|大切です|大切になります|しっかり|臨機応変|状況に応じて|心がけ|徹底し|圧倒的|極めて|劇的/g;
const MEMORY_RE = /現パッチ|現在のパッチ|現在のメタ|今のメタ|最新パッチ|勝率が高い|ティア[0-9SＳ]/g;
const LEGACY_RE = /究極完全攻略バイブル|## 7\. 🧠/;

/** 元動画情報・チャプター一覧・リンクの URL を除いた本文 */
export function stripArticleChrome(content: string): string {
  return (content || '')
    .replace(/^> 📺 \*\*元動画情報\*\*[\s\S]*?\n---\n/, '')
    .replace(/^\s*> ⏱️ \*\*実演チャプター[\s\S]*?\n\n/, '')
    .replace(/\]\(https?:[^)]+\)/g, ']')
    .replace(/\[▶ [0-9:]+(?: 実演シーン)?\]/g, '')
    .trim();
}

function count(re: RegExp, text: string): number {
  return (text.match(re) || []).length;
}

export function assessArticleDensity(
  content: string,
  analysisMeta?: { fact_count?: number | null } | null,
  opts: { isShort?: boolean; isAtomic?: boolean } = {},
): DensityReport {
  const body = stripArticleChrome(content);
  const chars = body.length;
  const per1k = (n: number) => (chars > 0 ? Math.round((n * 1000 * 100) / chars) / 100 : 0);
  const specificPer1k = per1k(count(SPECIFIC_RE, body));
  const genericPer1k = per1k(count(GENERIC_RE, body));
  const memoryHits = count(MEMORY_RE, body);
  const legacyTemplate = LEGACY_RE.test(content || '');
  const factCount = typeof analysisMeta?.fact_count === 'number' ? analysisMeta.fact_count : null;

  const reasons: string[] = [];
  let thin = false;

  // 分割知見（is_atomic）・Shorts は短いのが正常なので、長さと密度では判定しない
  const judgeByDensity = !opts.isAtomic && !opts.isShort && chars >= 400;

  if (factCount !== null) {
    if (factCount < 5) {
      thin = true;
      reasons.push(`字幕から取れた事実が ${factCount} 件だけ`);
    }
  } else if (judgeByDensity) {
    if (specificPer1k < 1.0) {
      thin = true;
      reasons.push(`数値・条件などの具体的な記述が少ない（1,000字あたり ${specificPer1k} 件）`);
    } else if (specificPer1k < 1.8 && genericPer1k >= 2.4) {
      thin = true;
      reasons.push(`一般論が多く具体的な記述が少ない（具体 ${specificPer1k} / 一般論 ${genericPer1k} 件・1,000字あたり）`);
    }
  }
  if (memoryHits > 0 && !opts.isAtomic) {
    reasons.push('「現パッチ」など動画に無い知識で書いた疑いのある箇所あり');
  }
  if (legacyTemplate) {
    reasons.push('旧形式（7章固定）で作った記事。動画に無い章が一般論で埋まっていることが多い');
    // 旧形式は一般論で章が埋まりやすいので、記憶で書いた疑い or 具体性が中央値未満なら薄い扱いにする
    if (memoryHits > 0 || specificPer1k < 1.8) thin = true;
  }

  // 文の途中で終わっているか（句点・閉じ括弧・記号・URL などで終わっていない）
  const lastChar = body.trim().slice(-1);
  const truncated = chars >= 200 && !!lastChar && !/[。！？!?）)」』\]】*`\-|.:：…ー〜~>0-9a-zA-Z]/.test(lastChar);
  if (truncated) reasons.push('本文が文の途中で終わっている（生成が途中で切れた可能性）');

  // 承認の目安。数値で決めず、理由を添えて「どこから手を付けるか」の並び替えに使う
  const triageReasons: string[] = [];
  let triage: 'approve' | 'check' | 'skip' = 'check';
  if (truncated) {
    triage = 'skip';
    triageReasons.push('途中で切れている');
  } else if (factCount !== null && factCount < 3) {
    triage = 'skip';
    triageReasons.push(`字幕から取れた事実が ${factCount} 件だけ`);
  } else if (legacyTemplate && thin) {
    triage = 'skip';
    triageReasons.push('旧形式で、一般論・記憶で書いた疑いが強い');
  } else if (factCount !== null && factCount >= 8) {
    triage = 'approve';
    triageReasons.push(`字幕から取れた事実が ${factCount} 件`);
  } else if (factCount === null && !legacyTemplate && memoryHits === 0 && specificPer1k >= 2.5 && genericPer1k < 2.4) {
    triage = 'approve';
    triageReasons.push(`具体的な記述が多い（1,000字あたり ${specificPer1k} 件）`);
  } else {
    triageReasons.push(thin ? '薄い可能性あり' : '目立った問題はないが、決め手もない');
  }

  return {
    level: thin ? 'thin' : 'ok',
    specificPer1k,
    genericPer1k,
    bodyChars: chars,
    reasons,
    legacyTemplate,
    factCount,
    truncated,
    triage,
    triageReasons,
  };
}
