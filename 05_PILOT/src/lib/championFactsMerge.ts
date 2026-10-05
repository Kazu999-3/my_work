import type { SupabaseClient } from '@supabase/supabase-js';
import { callGeminiWithRetry } from './geminiClient';
import { getChampionNameJa } from './championRoster';

export const FACT_FIELDS = [
  { key: 'strengths', label: '強み' },
  { key: 'weaknesses', label: '弱み' },
  { key: 'power_spikes', label: 'パワースパイク' },
  { key: 'build_runes', label: 'ビルド/ルーン' },
  { key: 'pick_recommendation', label: 'ピック判断' },
] as const;

export type FactFieldKey = typeof FACT_FIELDS[number]['key'];

export interface FactFieldDiff {
  key: FactFieldKey;
  label: string;
  before: string;
  after: string;
  isChanged: boolean;
  addedSummary?: string;
}

export interface ChampionFactsMergePreview {
  champion: string;
  championNameJa: string;
  diffs: FactFieldDiff[];
  addedHighlights: string[];
}

export interface ChampionFactsMergeResult {
  champion: string;
  success: boolean;
  updatedFields: string[];
  addedHighlights: string[];
  error?: string;
}

/** 既存の champion_facts から主要フィールドを取得 */
async function getExistingFacts(sb: SupabaseClient, champion: string): Promise<Record<string, string>> {
  const { data } = await sb
    .from('champion_facts')
    .select('champion, strengths, weaknesses, power_spikes, build_runes, pick_recommendation')
    .eq('champion', champion)
    .maybeSingle();

  const out: Record<string, string> = {};
  for (const f of FACT_FIELDS) {
    out[f.key] = String((data as any)?.[f.key] || '').trim();
  }
  return out;
}

/** Gemini を呼び出して新記事から既存項目へ差分追記マージしたJSONを取得 */
async function generateMergedFactsJson(
  championNameJa: string,
  existingFacts: Record<string, string>,
  title: string,
  body: string
): Promise<{ merged: Record<string, string>; added: string[] }> {
  const currentText = FACT_FIELDS
    .map((f) => `【${f.label}】\n${existingFacts[f.key] || '（未記入）'}`)
    .join('\n\n');

  const prompt = `あなたはLeague of Legendsのトップアナリストです。「${championNameJa}」のチャンピオン辞典の各項目を、最新の攻略記事の内容から差分更新・マージしてください。

【現在の辞典】
${currentText}

【新しい記事: ${title || '無題'}】
${String(body).slice(0, 7000)}

【マージ方針（絶対遵守）】:
1. 各項目について、**既存の重要な記述を残したまま**、記事から読み取れる新しい知見・数値・テクニック・注意点を追記してください。
2. 既存の内容を勝手に消去したり要約して短くしてはいけません。
3. 記事に該当する新しい情報が無い項目は、既存のテキストを**そのまま一言一句変えずに返してください**。
4. 重複や同じ内容の繰り返しは避け、記事固有の具体的なTipsや判断根拠（Why）を追記してください。
5. 各項目は箇条書きや文章で分かりやすく整理してください。

必ず以下のJSON形式のみを出力してください（Markdownコードブロックは不要）:
{
  "strengths": "...",
  "weaknesses": "...",
  "power_spikes": "...",
  "build_runes": "...",
  "pick_recommendation": "...",
  "added": ["今回追記した具体的な新知見の要約を1〜3行"]
}`;

  const raw = await callGeminiWithRetry(prompt, { temperature: 0.2, maxOutputTokens: 3000 });
  let cleaned = (raw || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s < 0 || e <= s) throw new Error('AI出力のJSON解析に失敗しました');

  const parsed = JSON.parse(cleaned.slice(s, e + 1));
  const merged: Record<string, string> = {};
  for (const f of FACT_FIELDS) {
    const val = parsed[f.key];
    merged[f.key] = typeof val === 'string' && val.trim() ? val.trim() : existingFacts[f.key];
  }
  const added = Array.isArray(parsed.added) ? parsed.added.map(String) : [];

  return { merged, added };
}

/** 項目マージのプレビュー（DB書き込みなし） */
export async function previewChampionFactsMerge(
  sb: SupabaseClient,
  champion: string,
  title: string,
  body: string
): Promise<ChampionFactsMergePreview> {
  const champNameJa = await getChampionNameJa(champion);
  const existing = await getExistingFacts(sb, champion);

  try {
    const { merged, added } = await generateMergedFactsJson(champNameJa, existing, title, body);
    const diffs: FactFieldDiff[] = FACT_FIELDS.map((f) => {
      const before = existing[f.key] || '';
      const after = merged[f.key] || before;
      const isChanged = before.trim() !== after.trim();
      return {
        key: f.key,
        label: f.label,
        before,
        after,
        isChanged,
      };
    });

    return {
      champion,
      championNameJa: champNameJa,
      diffs,
      addedHighlights: added,
    };
  } catch (e: any) {
    console.warn(`[championFactsMerge] プレビュー生成失敗 (${champion}):`, e.message);
    // フォールバック: 既存をそのまま返す
    return {
      champion,
      championNameJa: champNameJa,
      diffs: FACT_FIELDS.map((f) => ({
        key: f.key,
        label: f.label,
        before: existing[f.key] || '',
        after: existing[f.key] || '',
        isChanged: false,
      })),
      addedHighlights: [`AI生成に一時的に失敗したため既存項目を維持します (${e.message})`],
    };
  }
}

/** 実際に champion_facts をマージ更新し、knowledge_revisions に履歴を保存する */
export async function executeChampionFactsMerge(
  sb: SupabaseClient,
  champion: string,
  title: string,
  body: string,
  articleId?: number | null,
  overrideFacts?: Partial<Record<FactFieldKey, string>>
): Promise<ChampionFactsMergeResult> {
  const champNameJa = await getChampionNameJa(champion);
  const existing = await getExistingFacts(sb, champion);

  try {
    let merged: Record<string, string> = {};
    let added: string[] = [];

    if (overrideFacts && Object.keys(overrideFacts).length > 0) {
      // ユーザーがプレビュー画面で修正した文面があればそれを採用
      merged = { ...existing, ...overrideFacts };
    } else {
      const res = await generateMergedFactsJson(champNameJa, existing, title, body);
      merged = res.merged;
      added = res.added;
    }

    const payload: Record<string, any> = {
      champion,
      updated_at: new Date().toISOString(),
      auto_updated_at: new Date().toISOString(),
      source_summary: `記事統合 (${title})`,
    };

    const updatedFields: string[] = [];

    for (const f of FACT_FIELDS) {
      const afterVal = merged[f.key]?.trim() || '';
      const beforeVal = existing[f.key]?.trim() || '';
      payload[f.key] = afterVal || beforeVal;

      if (afterVal && afterVal !== beforeVal) {
        updatedFields.push(f.key);
      }
    }

    // 1. champion_facts テーブルを upsert
    const { error: upErr } = await sb
      .from('champion_facts')
      .upsert(payload, { onConflict: 'champion' });
    if (upErr) throw upErr;

    // 2. 変更があった項目ごとに knowledge_revisions に履歴を記録
    for (const fieldKey of updatedFields) {
      try {
        await sb.from('knowledge_revisions').insert({
          target_type: 'champion_fact',
          target_key: champion,
          field: fieldKey,
          before_text: existing[fieldKey] || null,
          after_text: payload[fieldKey],
          source_title: title,
          source_id: articleId ? String(articleId) : null,
        });
      } catch (revErr) {
        console.warn(`[championFactsMerge] 履歴記録失敗 (${fieldKey}):`, revErr);
      }
    }

    return {
      champion,
      success: true,
      updatedFields,
      addedHighlights: added,
    };
  } catch (err: any) {
    console.error(`[championFactsMerge] マージ実行失敗 (${champion}):`, err);
    return {
      champion,
      success: false,
      updatedFields: [],
      addedHighlights: [],
      error: err?.message || String(err),
    };
  }
}
