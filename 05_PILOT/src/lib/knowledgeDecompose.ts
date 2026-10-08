import type { SupabaseClient } from '@supabase/supabase-js';
import { callGemini } from './geminiClient';
import { resolveRosterChampion, getChampionNameJa } from './championRoster';
import { LaneKey, LANE_CONFIG } from './laneDetector';

export interface DecomposedInsight {
  champion: string; // チャンピオン英語ID、または 'Unknown'
  championNameJa?: string;
  lane: LaneKey;
  laneLabel?: string;
  title: string;
  content: string;
  tags: string[];
  scope: 'champion_specific' | 'lane_general';
  targetEnemy?: string;
  selected?: boolean;
}

export interface DecomposeArticleInput {
  id?: number;
  title: string;
  content: string;
  source_url?: string | null;
}

/**
 * ティアリストやパッチまとめ記事から、各チャンピオン固有の戦術や
 * レーン一般マクロの知見を漏れなくAIで分解・抽出する
 */
export async function decomposeArticle(article: DecomposeArticleInput): Promise<DecomposedInsight[]> {
  const title = article.title || '無題';
  const content = (article.content || '').trim();

  if (content.length < 100) {
    throw new Error('記事の本文が短すぎるため、ナレッジ分解を実行できません');
  }

  const prompt = `あなたはLeague of Legends (LoL) のトッププロコーチ兼データアナリストAIです。
以下の入力記事（パッチ解説、ティアリスト、動画まとめ等）には、複数のチャンピオンやレーンに関する戦術・調整知見が含まれています。
この内容を精査し、【チャンピオンごと】および【レーン一般マクロごと】に独立したナレッジ（分割知見 / Atomic Insights）へ漏れなく分解・抽出してください。

【対象記事: ${title}】
${content.slice(0, 15000)}

【抽出・分解の絶対ルール】:
1. **複数チャンピオンの完全網羅**:
   - 記事内で言及されている各チャンピオン（例: Mordekaiser, Lillia, Swain, Rammus, Ezreal 等）について、個別の知見として必ず1つずつ独立して抽出してください。
   - パッチの変更点（バフ・ナーフ）、具体的なスキル・コンボ、立ち回り、アイテム・ルーン、有利・不利な対面、集団戦の役割などを記事の内容に基づいて具体的に記述してください。
   - 「薄い要約」にせず、実戦でそのチャンピオンを使うプレイヤーが読んで即座に役立つ詳細度を維持してください。
2. **アイテム・全体マクロの抽出（該当する場合）**:
   - 特定チャンピオンに限らないアイテム調整（例: ヘクステックプレート、ルナーン、ロケットベルト等）や、レーン全体のメタ（例: 近接サポートの優位性、ウェーブ管理原則）があれば、scope="lane_general" として抽出してください。
3. **チャンピオン名の表記**:
   - champion には Riot公式の英名ID（例: "Mordekaiser", "Lillia", "Swain", "Rammus", "Ezreal", "Thresh", "Unknown"）を指定してください。
4. **出力フォーマット**:
   必ず以下のJSONフォーマットのみを返却してください（Markdownのコードブロック等は含めない、純粋なJSON）。

{
  "insights": [
    {
      "champion": "対象チャンピオン英名 (例: Mordekaiser。一般論の場合は 'Unknown')",
      "scope": "champion_specific または lane_general",
      "targetLane": "TOP または JG または MID または ADC または SUP または COMMON",
      "title": "具体的でわかりやすい日本語タイトル (例: 【Patch 26.20】Q火力強化とR短縮を活かしたスノーボール戦術)",
      "content": "詳細なMarkdown戦術本文 (パッチ調整、スキル運用、立ち回り、意識すべきWhy&When)",
      "tags": ["Patch26.20", "TOP", "Mordekaiser"]
    }
  ]
}`;

  const resText = await callGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 6000,
    responseMimeType: 'application/json',
  });

  let rawJson: { insights?: any[] } = {};
  try {
    const cleaned = resText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    rawJson = JSON.parse(cleaned);
  } catch (e) {
    const m = resText.match(/\{[\s\S]*\}/);
    if (m) {
      try { rawJson = JSON.parse(m[0]); } catch {}
    }
  }

  const rawInsights = Array.isArray(rawJson.insights) ? rawJson.insights : [];
  if (rawInsights.length === 0) {
    throw new Error('AIによるナレッジ分解結果が取得できませんでした');
  }

  // チャンピオンID正規化 ＆ 日本語名の付与
  const formatted: DecomposedInsight[] = [];
  for (const item of rawInsights) {
    let champId = 'Unknown';
    if (item.champion && item.champion !== 'Unknown') {
      const resolved = await resolveRosterChampion(item.champion);
      if (resolved) champId = resolved;
    }

    const champNameJa = champId !== 'Unknown' ? await getChampionNameJa(champId) : undefined;
    const lane: LaneKey = (['TOP', 'JG', 'MID', 'ADC', 'SUP', 'COMMON'].includes(item.targetLane)
      ? item.targetLane
      : 'COMMON') as LaneKey;

    const sourceHeader = article.source_url
      ? `> 📺 **元動画・親記事**: [${title}](${article.source_url})\n\n---\n\n`
      : '';

    formatted.push({
      champion: champId,
      championNameJa: champNameJa,
      lane,
      laneLabel: LANE_CONFIG[lane]?.label || lane,
      title: item.title || `${champNameJa || champId} 戦術知見`,
      content: `${sourceHeader}${item.content || ''}`.trim(),
      tags: Array.isArray(item.tags) ? item.tags : ['LoL攻略'],
      scope: item.scope === 'lane_general' ? 'lane_general' : 'champion_specific',
      selected: true,
    });
  }

  return formatted;
}

/**
 * 分解された知見群を Supabase の personal_knowledge テーブルへ子ナレッジとして保存する
 */
export async function saveDecomposedInsights(
  sb: SupabaseClient,
  parentArticleId: number,
  insights: DecomposedInsight[],
  sourceUrl?: string | null
): Promise<{ count: number; savedIds: number[] }> {
  if (insights.length === 0) return { count: 0, savedIds: [] };

  const records = insights.map((insight) => ({
    title: insight.title,
    content: insight.content,
    raw_content: insight.content,
    source_url: sourceUrl || null,
    genre: 'LoL攻略',
    tags: insight.tags,
    champion: insight.champion === 'Unknown' ? 'Unknown' : insight.champion,
    parent_id: parentArticleId,
    is_atomic: true,
    review_status: 'pending',
  }));

  const { data, error } = await sb
    .from('personal_knowledge')
    .insert(records)
    .select('id');

  if (error) {
    throw new Error(`分割知見の保存に失敗しました: ${error.message}`);
  }

  // 親記事のタグに __DECOMPOSED__ をマーク
  try {
    const { data: parent } = await sb
      .from('personal_knowledge')
      .select('tags')
      .eq('id', parentArticleId)
      .maybeSingle();

    const parentTags = Array.isArray(parent?.tags) ? parent.tags : [];
    if (!parentTags.includes('__DECOMPOSED__')) {
      await sb
        .from('personal_knowledge')
        .update({ tags: [...parentTags, '__DECOMPOSED__'] })
        .eq('id', parentArticleId);
    }
  } catch (err) {
    console.warn('[saveDecomposedInsights] 親記事タグ更新スキップ:', err);
  }

  const savedIds = (data || []).map((r: any) => r.id);
  return { count: savedIds.length, savedIds };
}
