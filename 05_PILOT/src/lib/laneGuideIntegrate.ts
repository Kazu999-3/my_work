import type { SupabaseClient } from '@supabase/supabase-js';
import { LaneKey, LANE_CONFIG } from './laneDetector';
import { getChampionNameJa } from './championRoster';

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

/** レーンガイドに追記するためのMarkdownブロックを生成する */
export async function formatLaneGuideSection(article: LaneGuideMergeArticle, lane: LaneKey): Promise<string> {
  const title = article.title?.trim() || '実戦解説';
  const url = article.source_url?.trim() || '';
  const body = (article.content || article.raw_content || '').trim();

  // 対象チャンピオン名の日本語表示
  const champParts = String(article.champion || '').split(/[,、/|]\s*|\s+/).filter(Boolean);
  const champNames = await Promise.all(champParts.map((c) => getChampionNameJa(c)));
  const champLabel = champNames.length > 0 ? champNames.join(', ') : `${LANE_CONFIG[lane].name}全般`;

  const linkStr = url ? `[${title}](${url})` : title;

  return [
    `### 📺 ${title}`,
    `- **出典・チャンピオン**: ${linkStr} （対象: **${champLabel}**）`,
    `- **マクロ・立ち回り知見**:`,
    body,
  ].join('\n');
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
  article: LaneGuideMergeArticle
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

    const newSection = await formatLaneGuideSection(article, lane);
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
