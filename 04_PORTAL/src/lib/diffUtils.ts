export type DiffOp = 'added' | 'removed' | 'same';
export interface DiffLine {
  op: DiffOp;
  text: string;
}

/**
 * 行単位の差分（LCS: 最長共通部分列アルゴリズム）
 * 削除行（removed）、追加行（added）、共通行（same）を判定する。
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = String(before || '').split('\n');
  const b = String(after || '').split('\n');

  const n = a.length, m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: 'same', text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ op: 'removed', text: a[i] });
      i++;
    } else {
      out.push({ op: 'added', text: b[j] });
      j++;
    }
  }
  while (i < n) {
    out.push({ op: 'removed', text: a[i] });
    i++;
  }
  while (j < m) {
    out.push({ op: 'added', text: b[j] });
    j++;
  }

  return out;
}

/** 差分の要約（追加/削除された行数）。一覧で「+12 / -3」のように出す用。 */
export function diffSummary(before: string, after: string): { added: number; removed: number } {
  let added = 0, removed = 0;
  for (const line of diffLines(before, after)) {
    if (!line.text.trim()) continue; // 空行は数えない
    if (line.op === 'added') added++;
    else if (line.op === 'removed') removed++;
  }
  return { added, removed };
}
