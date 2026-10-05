import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getRoster, resolveRosterChampions, getChampionNameJa } from '@/lib/championRoster';
import { integrateArticles, formatChampionArticleSection } from '@/lib/knowledgeIntegrate';
import { detectArticleLane, LANE_CONFIG, LaneKey } from '@/lib/laneDetector';
import { formatLaneGuideSection, mergeArticleToLaneGuide } from '@/lib/laneGuideIntegrate';

export const dynamic = 'force-dynamic';

const NO_CHAMPION = 'Unknown';
const PAGE_SIZE = 30;

export async function GET(req: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const { searchParams } = new URL(req.url);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
    const champion = searchParams.get('champion') || '';
    const type = searchParams.get('type') || ''; // 'video' | 'atomic'

    let query = supabase
      .from('personal_knowledge')
      .select('id, title, content, champion, parent_id, is_atomic, source_url, tags, created_at', { count: 'exact' })
      .eq('review_status', 'pending')
      .or('tags.is.null,tags.not.cs.{__DELETED__}');
    if (champion) query = query.eq('champion', champion);
    if (type === 'atomic') query = query.eq('is_atomic', true);
    if (type === 'video') query = query.eq('is_atomic', false);
    query = query.order('created_at', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    // 分割知見は親記事タイトルを付与
    const parentIds = Array.from(new Set((data || []).map((r: any) => r.parent_id).filter(Boolean)));
    let parentTitles: Record<string, string> = {};
    if (parentIds.length > 0) {
      const { data: parents } = await supabase.from('personal_knowledge').select('id, title').in('id', parentIds);
      parentTitles = Object.fromEntries((parents || []).map((p: any) => [String(p.id), p.title]));
    }

    const roster = await getRoster().catch(() => []);

    // 各記事のレーン・マクロ知見・複数チャンピオンを自動判定
    const items = await Promise.all(
      (data || []).map(async (r: any) => {
        const detection = await detectArticleLane({
          title: r.title,
          content: r.content,
          tags: r.tags,
          champion: r.champion,
        });

        // 検出されたチャンピオンの日本語表示名
        const detectedChampsJa = await Promise.all(
          detection.detectedChampions.map((c) => getChampionNameJa(c))
        );

        // 既存の champion カラムを解決した日本語名（複数対応）
        const currentChampParts = String(r.champion || '')
          .split(/[,、/|]\s*|\s+/)
          .filter(Boolean);
        const currentChampNamesJa = await Promise.all(
          currentChampParts.map((c) => getChampionNameJa(c))
        );

        return {
          ...r,
          parentTitle: r.parent_id ? parentTitles[String(r.parent_id)] || null : null,
          isLaneGeneral: !r.champion || r.champion === NO_CHAMPION,
          currentChampNamesJa: currentChampNamesJa.join(', '),
          detectedLane: detection.lane,
          laneLabel: detection.laneLabel,
          isLaneMacro: detection.isLaneMacro,
          macroReason: detection.macroReason,
          detectedChampions: detection.detectedChampions,
          detectedChampionsJa: detectedChampsJa.join(', '),
        };
      })
    );

    return NextResponse.json({
      success: true,
      total: count ?? 0,
      items,
      roster,
      laneConfig: LANE_CONFIG,
    });
  } catch (e: any) {
    console.error('[knowledge/review] GET Error:', e);
    return NextResponse.json({ error: e.message || '取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const body = await req.json();
    const { action } = body;

    // ──────────────────────────────────────────
    // 1. プレビュー生成アクション
    // ──────────────────────────────────────────
    if (action === 'preview') {
      const { title, content, champion, lane, includeLaneGuide, source_url } = body;
      const cleanTitle = String(title || '(無題)').trim();
      const cleanContent = String(content || '').trim();
      const targetLane = (lane || 'COMMON') as LaneKey;

      // チャンピオンプレビュー
      const resolvedChamps = await resolveRosterChampions(champion);
      const championPreviews = await Promise.all(
        resolvedChamps.map(async (champId) => {
          const champNameJa = await getChampionNameJa(champId);
          return {
            id: champId,
            name: champNameJa,
            matchupId: `champ_${champId}_global`,
            sectionText: formatChampionArticleSection(cleanTitle, cleanContent),
          };
        })
      );

      // レーンガイドプレビュー
      let laneGuidePreview = null;
      if (includeLaneGuide) {
        const laneSectionText = await formatLaneGuideSection(
          {
            id: 0,
            title: cleanTitle,
            content: cleanContent,
            champion: resolvedChamps.join(', ') || null,
            source_url: source_url || null,
          },
          targetLane
        );
        laneGuidePreview = {
          lane: targetLane,
          laneLabel: LANE_CONFIG[targetLane]?.label || targetLane,
          sectionText: laneSectionText,
        };
      }

      return NextResponse.json({
        success: true,
        championPreviews,
        laneGuidePreview,
      });
    }

    // ──────────────────────────────────────────
    // 2. 却下アクション
    // ──────────────────────────────────────────
    const ids: number[] = (Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [])
      .map(Number).filter((n: number) => Number.isFinite(n) && n > 0).slice(0, 200);
    if (ids.length === 0) return NextResponse.json({ error: '対象の id / ids が必要です' }, { status: 400 });

    if (action === 'reject') {
      const { error, count } = await supabase
        .from('personal_knowledge')
        .delete({ count: 'exact' })
        .in('id', ids)
        .eq('review_status', 'pending');
      if (error) throw error;
      return NextResponse.json({ success: true, count: count ?? 0, message: `${count ?? 0}件を却下しました` });
    }

    // ──────────────────────────────────────────
    // 3. 承認 ＆ 二系統統合アクション
    // ──────────────────────────────────────────
    if (action !== 'approve') return NextResponse.json({ error: '無効な action です' }, { status: 400 });

    const update: Record<string, any> = { review_status: 'approved' };
    let explicitLane: LaneKey | null = null;
    let explicitIncludeLaneGuide: boolean | null = null;

    // 単一記事承認時の手動修正パラメータ
    if (ids.length === 1) {
      if (typeof body.title === 'string' && body.title.trim()) {
        update.title = body.title.trim();
      }
      if (typeof body.content === 'string') {
        update.content = body.content.trim();
      }
      if (typeof body.lane === 'string' && body.lane in LANE_CONFIG) {
        explicitLane = body.lane as LaneKey;
      }
      if (typeof body.includeLaneGuide === 'boolean') {
        explicitIncludeLaneGuide = body.includeLaneGuide;
      }

      if (typeof body.champion === 'string') {
        const rawChamp = body.champion.trim();
        if (!rawChamp) {
          update.champion = NO_CHAMPION;
        } else {
          const resolved = await resolveRosterChampions(rawChamp);
          if (resolved.length === 0) {
            return NextResponse.json({ error: `「${rawChamp}」に該当するチャンピオンが見つかりません` }, { status: 400 });
          }
          update.champion = resolved.join(', ');
        }
      }
    }

    const { data: rows, error } = await supabase
      .from('personal_knowledge')
      .update(update)
      .in('id', ids)
      .eq('review_status', 'pending')
      .select('id, title, content, raw_content, champion, tags, source_url');
    if (error) throw error;

    const targetRows = rows || [];
    if (targetRows.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: '対象記事がありませんでした' });
    }

    // トラックA: チャンピオン辞典（matchup_sentinel & champion_notes）へ統合
    const champResult = await integrateArticles(supabase, targetRows);

    // トラックB: レーンガイド（lane_guides テーブル）へ統合
    let laneIntegratedCount = 0;
    const laneDetails: string[] = [];

    for (const row of targetRows) {
      // レーンおよびマクロ判定
      const detection = await detectArticleLane({
        title: row.title,
        content: row.content,
        tags: row.tags,
        champion: row.champion,
      });

      const shouldIntegrateLane = (explicitIncludeLaneGuide !== null && ids.length === 1)
        ? explicitIncludeLaneGuide
        : detection.isLaneMacro;

      const targetLane = (explicitLane !== null && ids.length === 1)
        ? explicitLane
        : detection.lane;

      if (shouldIntegrateLane) {
        const laneRes = await mergeArticleToLaneGuide(supabase, targetLane, {
          id: row.id,
          title: row.title,
          content: row.content,
          raw_content: row.raw_content,
          champion: row.champion,
          source_url: row.source_url,
        });

        if (laneRes.success && laneRes.updated) {
          laneIntegratedCount++;
          if (!laneDetails.includes(targetLane)) laneDetails.push(targetLane);
        }
      }
    }

    const totalCount = targetRows.length;
    const champCount = champResult.integrated.length;
    const errors = champResult.errors;

    const message = [
      `${totalCount}件を承認しました。`,
      champCount > 0 ? `📖 チャンピオン辞典へ${champCount}件統合` : '',
      laneIntegratedCount > 0 ? `🗺️ レーンガイド（${laneDetails.join(', ')}）へ${laneIntegratedCount}件マージ` : '',
      champResult.skippedNoChampion.length > 0 && laneIntegratedCount === 0 ? `（チャンピオン無し${champResult.skippedNoChampion.length}件はライブラリに保持）` : '',
    ].filter(Boolean).join('、');

    return NextResponse.json({
      success: errors.length === 0,
      count: totalCount,
      integratedChampions: champCount,
      integratedLaneGuides: laneIntegratedCount,
      errors,
      message: message + (errors.length ? `。エラー: ${errors.join(' / ')}` : ''),
    });
  } catch (e: any) {
    console.error('[knowledge/review] POST Error:', e);
    return NextResponse.json({ error: e.message || '処理に失敗しました' }, { status: 500 });
  }
}
