import type { SupabaseClient } from '@supabase/supabase-js';
import { LaneKey, LANE_CONFIG } from './laneDetector';
import { getChampionNameJa } from './championRoster';
import { callGeminiWithRetry } from './geminiClient';

export interface LaneGuideMergeArticle {
  id: number;
  title: string | null;
  content: string | null;
  raw_content?: string | null;
  champion?: string | null;
  source_url?: string | null;
}

export interface LaneGuideMergeResult {
  success: boolean;
  lane: LaneKey;
  updated: boolean;
  alreadyExists: boolean;
  error?: string;
}

function extractYoutubeId(url: string | null | undefined): string | null {
  const m = String(url || '').match(/(?:youtu\.be\/|[?&]v=)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** 記事からレーン攻略に役立つ本質的知見（Why & When、ウェーブ、オブジェクト、立ち回り）を漏らさず全て構造化抽出 */
export async function extractLaneGuideKnowledge(article: LaneGuideMergeArticle, lane: LaneKey): Promise<string> {
  const rawBody = (article.content || article.raw_content || '').trim();
  if (rawBody.length < 150) return rawBody;

  const laneInfo = LANE_CONFIG[lane] || LANE_CONFIG.COMMON;
  const prompt = `あなたはLeague of Legendsのトッププロコーチです。以下の記事から、【${laneInfo.name}】レーンをプレイする上で役立つ本質的なマクロ知見、立ち回り、状況判断（Why & When）を、重要な情報を一切端折らずに漏らさず全て抽出・構造化してください。

【対象記事: ${article.title || '無題'}】
${rawBody.slice(0, 15000)}

【抽出指針（最重要・絶対遵守）】:
1. **重要知見の完全網羅（薄い要約・端折りの厳禁）**:
   - 動画や解説の前置き、挨拶、雑談などのノイズのみを除去し、戦術的な知見、判断根拠（Why）、状況・条件（When）、ウェーブ管理、視界確保、寄りの判断、時間帯ごとの定石は余すところなく全て網羅してください。
   - 数行の浅いまとめにせず、実戦で迷った時に読めばそのまま答えになる充実した分量・具体性で記述してください。
2. **体系的な構造化見出し**:
   記事の内容に合わせて、該当する項目を見出し付きで記述してください（該当しない項目は省略可）:
   - #### 🌊 【レーン戦・ウェーブ＆テンポ管理】
   - #### 🗺️ 【オブジェクト・寄り・ローム判断】
   - #### ⚔️ 【集団戦・立ち回り・仕掛けの条件】
   - #### 💡 【思考ロジック＆定石の根拠（Why & When）】
3. Markdown形式で出力してください（コードブロック \`\`\` は不要です）。`;

  // ★ 2026-10-06: 以前は失敗時に記事本文をそのまま返し、レーンガイドへ全文（1万字超・記事の大見出し込み）が
  // 「成功」として貼り付けられていた（Gemini の 503 混雑時に COMMON/JG で実際に発生）。失敗は呼び出し元へ伝える。
  const res = await callGeminiWithRetry(prompt, { temperature: 0.2, maxOutputTokens: 3500 });
  const cleaned = (res || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
  if (!cleaned) throw new Error('AIの応答が空でした');
  return demoteHeadings(cleaned);
}

/**
 * AI出力の見出し（#〜###）を ####以下へ下げる。節タイトルが「### 📺」のため、AIが ### を使うと
 * ガイド内の階層が崩れる（2026-10-06、プロンプトで #### を指定しても ### で返ってきた実例あり）。
 */
export function demoteHeadings(md: string): string {
  return md.replace(/^(#{1,3})(\s)/gm, '####$2');
}

/** チャンピオン欄の「Unknown」等はチャンピオン無しとして扱う（ガイド上に「対象: Unknown」と出さない） */
const NO_CHAMPION_VALUES = new Set(['unknown', 'none', 'なし', '-', 'n/a']);

/** レーンガイドに追記するためのMarkdownブロックを生成する */
export async function formatLaneGuideSection(
  article: LaneGuideMergeArticle,
  lane: LaneKey,
  customExtractedText?: string
): Promise<string> {
  const title = article.title?.trim() || '実戦解説';
  const url = article.source_url?.trim() || '';

  // customExtractedTextが指定されていればそれを使用。無ければGeminiで本質知見を漏らさず抽出
  const extractedBody = customExtractedText
    ? customExtractedText.trim()
    : await extractLaneGuideKnowledge(article, lane);

  // 対象チャンピオン名の日本語表示
  const champParts = String(article.champion || '').split(/[,、/|]\s*|\s+/)
    .filter((c) => c && !NO_CHAMPION_VALUES.has(c.toLowerCase()));
  const champNames = await Promise.all(champParts.map((c) => getChampionNameJa(c)));
  const champLabel = champNames.length > 0 ? champNames.join(', ') : `${LANE_CONFIG[lane].name}全般`;

  const linkStr = url ? `[${title}](${url})` : title;

  return [
    `### 📺 ${title}`,
    `- **出典・チャンピオン**: ${linkStr} （対象: **${champLabel}**）`,
    extractedBody,
  ].join('\n\n');
}

/** 既存のレーンガイド本文に新しい知見ブロックを安全に統合する */
export function appendSectionToLaneGuide(existingBody: string, newSection: string): string {
  const headerSection = '## 実戦動画・プロ解説からの最新マクロ知見（Why & When アーカイブ）';
  
  // 既にマクロ知見見出しが存在する場合
  if (existingBody.includes(headerSection) || existingBody.includes('## 8. 実戦動画・プロ解説からの最新マクロ知見')) {
    return `${existingBody.trim()}\n\n---\n\n${newSection}`;
  }

  // 存在しない場合は新たな章として末尾に新設
  return `${existingBody.trim()}\n\n\n${headerSection}\n\n実戦動画やトッププロの解説から抽出された、アクション根拠（Why & When）と普遍的マクロ知見のストックです。\n\n${newSection}`;
}

/** レーンガイド（lane_guides テーブル）へ記事を統合する */
export async function mergeArticleToLaneGuide(
  sb: SupabaseClient,
  lane: LaneKey,
  article: LaneGuideMergeArticle,
  customSectionText?: string
): Promise<LaneGuideMergeResult> {
  try {
    const { data: record, error: selErr } = await sb
      .from('lane_guides')
      .select('lane, title, body, source_count')
      .eq('lane', lane)
      .maybeSingle();

    if (selErr) throw selErr;

    const currentBody = record?.body || '';
    const currentCount = record?.source_count || 0;
    const title = article.title?.trim() || '';
    const vid = extractYoutubeId(article.source_url);
    const url = article.source_url?.trim() || '';

    // 重複チェック
    const isAlreadyIncluded = (
      (title && currentBody.includes(`### 📺 ${title}`)) ||
      (vid && currentBody.includes(vid)) ||
      (url && currentBody.includes(url))
    );

    if (isAlreadyIncluded) {
      return {
        success: true,
        lane,
        updated: false,
        alreadyExists: true,
      };
    }

    const newSection = customSectionText
      ? customSectionText.trim()
      : await formatLaneGuideSection(article, lane);
    const updatedBody = appendSectionToLaneGuide(currentBody, newSection);

    const { error: upErr } = await sb
      .from('lane_guides')
      .upsert({
        lane,
        title: record?.title || `${LANE_CONFIG[lane].name} レーン攻略ガイド`,
        body: updatedBody,
        source_count: currentCount + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lane' });

    if (upErr) throw upErr;

    return {
      success: true,
      lane,
      updated: true,
      alreadyExists: false,
    };
  } catch (e: any) {
    console.error(`[laneGuideIntegrate] ${lane} レーンガイド統合エラー:`, e);
    return {
      success: false,
      lane,
      updated: false,
      alreadyExists: false,
      error: e?.message || String(e),
    };
  }
}
