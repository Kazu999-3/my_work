import type { ChampionFactPreview, FactFieldDiff, LineDestination, PreviewResult } from './types';

// 項目マージ（強み・弱み等）の新規追記行の判定と、承認時に送る内容の組み立て。画面に依存しない処理だけを置く。
// 2026-10-07: page.tsx から分割（処理は分割前と同じ）。

/** 項目マージ差分で行が新規追加されたかを判定 */
export function isLineNewlyAdded(line: string, before: string, beforeSet: Set<string>): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (beforeSet.has(trimmed)) return false;
  // 箇条書きプレフィックスや見出し記号を除去した中身で判定
  const core = trimmed.replace(/^[-*・•\d.()（）:：【】\[\]]+\s*/, '').trim();
  if (core.length >= 6 && before.includes(core)) return false;
  return true;
}

/** 差分1項目の、変更前の行集合と変更後の行 */
export function diffLines(diff: FactFieldDiff) {
  const before = diff.before || '';
  const after = diff.after || '';
  const beforeSet = new Set(before.split('\n').map((l) => l.trim()).filter(Boolean));
  return { before, after, beforeSet, afterLines: after.split('\n') };
}

/** 変更後の行のうち新規追記の行番号 */
export function newlyAddedIndexes(diff: FactFieldDiff): number[] {
  const { before, beforeSet, afterLines } = diffLines(diff);
  const out: number[] = [];
  afterLines.forEach((line, idx) => { if (isLineNewlyAdded(line, before, beforeSet)) out.push(idx); });
  return out;
}

export const lineKeyOf = (champion: string, diffKey: string, idx: number) => `${champion}::${diffKey}::${idx}`;
export const fieldKeyOf = (champion: string, diffKey: string) => `${champion}::${diffKey}`;

/** プレビュー取得直後の選択状態（更新がある項目はON、新規追記行はすべて辞典宛て） */
export function initialSelections(factPreviews: ChampionFactPreview[] | undefined) {
  const fields: Record<string, boolean> = {};
  const lines: Record<string, LineDestination> = {};
  for (const fp of factPreviews || []) {
    for (const diff of fp.diffs || []) {
      fields[fieldKeyOf(fp.champion, diff.key)] = !!diff.isChanged;
      if (diff.isChanged) {
        for (const idx of newlyAddedIndexes(diff)) lines[lineKeyOf(fp.champion, diff.key, idx)] = 'champion';
      }
    }
  }
  return { fields, lines };
}

export interface RoutedLaneLine { champion: string; fieldLabel: string; text: string }

/**
 * 各行（文）の宛先（辞典/レーン/スキップ）に応じて、辞典へ書く各項目の文章と、レーンガイドへ回す文を組み立てる。
 * 項目ごとスキップした・変更が無い項目は既存の文章のまま送る。
 */
export function buildFactOverrides(
  previewData: PreviewResult,
  selectedFactFields: Record<string, boolean>,
  lineDestinations: Record<string, LineDestination>,
) {
  const customFactOverrides: Record<string, Record<string, string>> = {};
  const routedToLaneLines: RoutedLaneLine[] = [];
  for (const fp of previewData.factPreviews || []) {
    customFactOverrides[fp.champion] = {};
    for (const diff of fp.diffs) {
      const isFieldActive = selectedFactFields[fieldKeyOf(fp.champion, diff.key)] ?? diff.isChanged;
      // フィールド全体がスキップの場合、既存テキスト(before)を維持
      if (!isFieldActive || !diff.isChanged) {
        customFactOverrides[fp.champion][diff.key] = diff.before || '';
        continue;
      }
      const { before, beforeSet, afterLines } = diffLines(diff);
      const keptNewLinesForChamp: string[] = [];
      afterLines.forEach((line, idx) => {
        if (!isLineNewlyAdded(line, before, beforeSet)) return;
        const dest = lineDestinations[lineKeyOf(fp.champion, diff.key, idx)] || 'champion';
        if (dest === 'champion') keptNewLinesForChamp.push(line);
        else if (dest === 'lane') routedToLaneLines.push({ champion: fp.championNameJa || fp.champion, fieldLabel: diff.label, text: line });
        // dest === 'skip' は除外
      });
      // チャンピオン辞典用テキストの組み立て（既存＋champion宛ての新規行）。1行も残らなければ既存のまま
      customFactOverrides[fp.champion][diff.key] = keptNewLinesForChamp.length > 0
        ? (before.trim() ? `${before.trim()}\n${keptNewLinesForChamp.join('\n')}` : keptNewLinesForChamp.join('\n'))
        : before;
    }
  }
  return { customFactOverrides, routedToLaneLines };
}

/** レーンガイドへ振り分けられた文を、レーンガイドの統合文面の末尾に足すブロック */
export function routedLinesBlock(routed: RoutedLaneLine[]): string {
  return [
    `\n\n#### 💡 【各項目から振り分けられた戦術・マクロ知見】`,
    ...routed.map((r) => `- **[${r.champion} / ${r.fieldLabel}]**: ${r.text.replace(/^[-*・•\d.()（）:：【】\[\]]+\s*/, '')}`),
  ].join('\n');
}
