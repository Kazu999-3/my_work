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
浅い要約で情報を削ぎ落とすことは絶対にせず、実戦で役立つ重要な戦術・思考ロジックを漏らさず全て統合してください。

【現在の辞典】
${currentText}

【新しい記事: ${title || '無題'}】
${String(body).slice(0, 15000)}

【マージ方針（最重要・絶対遵守）】:
1. **重要情報の完全網羅（端折り・薄い要約厳禁）**:
   - 記事内で語られている具体的なテクニック、スキルコンボ、アイテム選択の理由・分岐条件、パワースパイクの具体的根拠（Lv・コア完成時）、対面ごとの立ち回り注意点、仕掛けの条件（Why & When）などの重要情報は、省略せず漏らさず詳細に各項目へ追記してください。
2. **既存記述の完全保持（非破壊原則）**:
   - 既存の項目に書かれている文章や箇条書きは**一文字も勝手に消去・短縮しないでください**。既存の内容を残した上で、新しく得られた知見を箇条書きや段落としてリッチに追記してください。
3. **新規情報が無い項目の不変性**:
   - 記事の中に該当する新情報が無い項目は、既存テキストを**そのまま一言一句変えずに**返してください。
4. **構造的で読みやすい整理**:
   - 単なる雑多な追記ではなく、「・【〜の極意】具体的内容」「・【対面対策】〜」のように見出し付き箇条書きを活用して、プレイヤーが一瞬で実戦応用できる形に整理してください。

必ず以下のJSON形式のみを出力してください（Markdownコードブロックは不要）:
{
  "strengths": "...",
  "weaknesses": "...",
  "power_spikes": "...",
  "build_runes": "...",
  "pick_recommendation": "...",
  "added": ["今回追記した具体的な重要知見の要点を箇条書きで1〜5項目"]
}`;

  const raw = await callGeminiWithRetry(prompt, { temperature: 0.2, maxOutputTokens: 6000 });
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
