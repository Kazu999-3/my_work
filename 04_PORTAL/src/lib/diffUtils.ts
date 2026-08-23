export type DiffOp = 'added' | 'removed' | 'same';
export interface DiffLine {
  op: DiffOp;
  text: string;
}

export interface SideBySideLine {
  left: { op: 'removed' | 'same' | 'empty'; text: string; lineNum?: number };
  right: { op: 'added' | 'same' | 'empty'; text: string; lineNum?: number };
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

/**
 * 左右横並び（Side-by-Side）表示用の差分行ペアを生成する。
 * 左：清書前（削除行が赤ハイライト）、右：清書後（追加行が緑ハイライト）
 */
export function diffSideBySide(before: string, after: string): SideBySideLine[] {
  const lines = diffLines(before, after);
  const rows: SideBySideLine[] = [];

  let leftNum = 1;
  let rightNum = 1;

  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    if (cur.op === 'same') {
      rows.push({
        left: { op: 'same', text: cur.text, lineNum: leftNum++ },
        right: { op: 'same', text: cur.text, lineNum: rightNum++ },
      });
    } else if (cur.op === 'removed') {
      const next = lines[i + 1];
      if (next && next.op === 'added') {
        rows.push({
          left: { op: 'removed', text: cur.text, lineNum: leftNum++ },
          right: { op: 'added', text: next.text, lineNum: rightNum++ },
        });
        i++; // added分を消費
      } else {
        rows.push({
          left: { op: 'removed', text: cur.text, lineNum: leftNum++ },
          right: { op: 'empty', text: '' },
        });
      }
    } else if (cur.op === 'added') {
      rows.push({
        left: { op: 'empty', text: '' },
        right: { op: 'added', text: cur.text, lineNum: rightNum++ },
      });
    }
  }

  return rows;
}
