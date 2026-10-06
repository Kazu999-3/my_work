import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getRoster, resolveRosterChampions, getChampionNameJa } from '@/lib/championRoster';
import { integrateArticles, formatChampionArticleSection } from '@/lib/knowledgeIntegrate';
import { detectArticleLane, LANE_CONFIG, LaneKey } from '@/lib/laneDetector';
import { formatLaneGuideSection, mergeArticleToLaneGuide } from '@/lib/laneGuideIntegrate';
import { previewChampionFactsMerge, executeChampionFactsMerge } from '@/lib/championFactsMerge';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;


function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

const NO_CHAMPION = 'Unknown';
const DEFAULT_PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const { searchParams } = new URL(req.url);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10)));
    const champion = searchParams.get('champion') || '';
    const type = searchParams.get('type') || ''; // 'video' | 'atomic'
    const channelFilter = searchParams.get('channel') || '';
    const laneFilter = searchParams.get('lane') || ''; // 'COMMON' | 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP'
    const queryKeyword = (searchParams.get('q') || '').trim().toLowerCase();
    const sort = searchParams.get('sort') || 'created_asc'; // 'created_asc' | 'created_desc' | 'channel_asc' | 'volume_desc' | 'title_asc'

    // 1. youtube_queue からチャンネル名辞書をロード
    const { data: queueRows } = await supabase
      .from('youtube_queue')
      .select('url, channel_name')
      .limit(3000);

    const channelMap: Record<string, string> = {};
    const videoIdMap: Record<string, string> = {};

    if (queueRows) {
      for (const qr of queueRows) {
        if (qr.url) {
          const trimmedUrl = qr.url.trim();
          const vid = extractYoutubeId(trimmedUrl);
          if (qr.channel_name) {
            const trimmedCh = qr.channel_name.trim();
            channelMap[trimmedUrl] = trimmedCh;
            if (vid) videoIdMap[vid] = trimmedCh;
          }
        }
      }
    }

    // 2. 未承認記事（pending）全件を取得
    let baseQuery = supabase
      .from('personal_knowledge')
      .select('id, title, content, champion, parent_id, is_atomic, source_url, tags, created_at')
      .eq('review_status', 'pending')
      .or('tags.is.null,tags.not.cs.{__DELETED__}')
      .order('created_at', { ascending: true })
      .limit(1000);

    if (champion) baseQuery = baseQuery.eq('champion', champion);
    if (type === 'atomic') baseQuery = baseQuery.eq('is_atomic', true);
    if (type === 'video') baseQuery = baseQuery.eq('is_atomic', false);

    const { data, error } = await baseQuery;
    if (error) throw error;

    const rawRows = data || [];

    // 親記事タイトルのマッピング
    const parentIds = Array.from(new Set(rawRows.map((r: any) => r.parent_id).filter(Boolean)));
    let parentTitles: Record<string, string> = {};
    if (parentIds.length > 0) {
      const { data: parents } = await supabase.from('personal_knowledge').select('id, title').in('id', parentIds);
      parentTitles = Object.fromEntries((parents || []).map((p: any) => [String(p.id), p.title]));
    }

    const roster = await getRoster().catch(() => []);

    // 3. 各記事のチャンネル名、レーン判定、文字数を解決
    const enrichedItems = await Promise.all(
      rawRows.map(async (r: any) => {
        // チャンネル特定
        let ch = '';
        const src = (r.source_url || '').trim();
        const srcVid = extractYoutubeId(src);

        if (src && channelMap[src]) {
          ch = channelMap[src];
        } else if (srcVid && videoIdMap[srcVid]) {
          ch = videoIdMap[srcVid];
        } else if (r.content) {
          const m = r.content.match(/>\s*-\s*\*\*チャンネル\*\*:\s*([^\n\r]+)/);
          if (m) {
            ch = m[1].trim();
          } else {
            const vidMatch = r.content.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/);
            if (vidMatch && videoIdMap[vidMatch[1]]) {
              ch = videoIdMap[vidMatch[1]];
            }
          }
        }

        // 表記揺れ統一
        if (ch.toLowerCase() === 'kireilol') ch = 'Coach Kirei';
        if (ch.toLowerCase() === 'coach kirei') ch = 'Coach Kirei';

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

        // 既存の champion カラムを解決した日本語名
        const currentChampParts = String(r.champion || '')
          .split(/[,、/|]\s*|\s+/)
          .filter(Boolean);
        const currentChampNamesJa = await Promise.all(
          currentChampParts.map((c) => getChampionNameJa(c))
        );

        const charCount = (r.content || '').length;

        return {
          ...r,
          channel: ch || '不明',
          char_count: charCount,
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

    // 4. チャンネル一覧＆件数の集計（全件ベース）
    const channelCounts: Record<string, number> = {};
    const laneCounts: Record<string, number> = {
      ALL: enrichedItems.length,
      COMMON: 0,
      TOP: 0,
      JG: 0,
      MID: 0,
      ADC: 0,
      SUP: 0,
    };

    for (const item of enrichedItems) {
      const chName = item.channel || '不明';
      channelCounts[chName] = (channelCounts[chName] || 0) + 1;
      const l = item.detectedLane as LaneKey;
      if (laneCounts[l] !== undefined) {
        laneCounts[l]++;
      }
    }

    const channels = Object.entries(channelCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        // 不明は末尾に配置、それ以外は件数降順
        if (a.name === '不明') return 1;
        if (b.name === '不明') return -1;
        return b.count - a.count;
      });

    // 5. フィルタリング適用
    let filtered = enrichedItems;

    // チャンネルフィルター
    if (channelFilter) {
      filtered = filtered.filter((item) => item.channel === channelFilter);
    }

    // レーンフィルター
    if (laneFilter && laneFilter !== 'ALL') {
      filtered = filtered.filter((item) => item.detectedLane === laneFilter);
    }

    // キーワード検索（タイトル、本文、チャンネル名、チャンピオン名）
    if (queryKeyword) {
      filtered = filtered.filter((item) => {
        const titleMatch = (item.title || '').toLowerCase().includes(queryKeyword);
        const contentMatch = (item.content || '').toLowerCase().includes(queryKeyword);
        const channelMatch = (item.channel || '').toLowerCase().includes(queryKeyword);
        const champMatch = (item.currentChampNamesJa || '').toLowerCase().includes(queryKeyword) ||
          (item.detectedChampionsJa || '').toLowerCase().includes(queryKeyword);
        return titleMatch || contentMatch || channelMatch || champMatch;
      });
    }

    // 6. ソート適用
    filtered.sort((a, b) => {
      switch (sort) {
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'channel_asc':
          return a.channel.localeCompare(b.channel, 'ja') || (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'volume_desc':
          return (b.char_count || 0) - (a.char_count || 0);
        case 'title_asc':
          return (a.title || '').localeCompare(b.title || '', 'ja');
        case 'created_asc':
        default:
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
    });

    // 7. ページネーション切り出し
    const pagedItems = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      total: filtered.length,
      totalAll: enrichedItems.length,
      items: pagedItems,
      channels,
      laneCounts,
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
    const db = supabase;
    const body = await req.json();
    const { action } = body;

    // ──────────────────────────────────────────
    // 1. プレビュー生成アクション
    // ──────────────────────────────────────────
    if (action === 'preview') {
      const { title, content, champion, lane, includeLaneGuide, includeFactMerge, source_url } = body;
      const cleanTitle = String(title || '(無題)').trim();
      const cleanContent = String(content || '').trim();
      const targetLane = (lane || 'COMMON') as LaneKey;

      // チャンピオン教本プレビュー
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

      // 各項目（champion_facts: 強み・弱み等）のマージプレビュー
      let factPreviews: any[] = [];
      if (includeFactMerge !== false && resolvedChamps.length > 0 && cleanContent.length >= 100) {
        factPreviews = await Promise.all(
          resolvedChamps.map((champId) =>
            previewChampionFactsMerge(db, champId, cleanTitle, cleanContent)
          )
        );
      }

      // レーンガイドプレビュー
      let laneGuidePreview = null;
      if (includeLaneGuide) {
        // AI抽出に失敗したら本文を流用せず、理由をプレビューに出す（2026-10-06）
        let laneSectionText = '';
        let laneError: string | null = null;
        try {
          laneSectionText = await formatLaneGuideSection(
          {
            id: 0,
            title: cleanTitle,
            content: cleanContent,
            champion: resolvedChamps.join(', ') || null,
            source_url: source_url || null,
          },
          targetLane
        );
        } catch (e: any) {
          laneError = e?.message || String(e);
        }
        laneGuidePreview = {
          lane: targetLane,
          laneLabel: LANE_CONFIG[targetLane]?.label || targetLane,
          sectionText: laneSectionText,
          error: laneError,
        };
      }

      return NextResponse.json({
        success: true,
        championPreviews,
        factPreviews,
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
    // 3. 承認 ＆ 二系統統合（＋各項目マージ）アクション
    // ──────────────────────────────────────────
    if (action !== 'approve') return NextResponse.json({ error: '無効な action です' }, { status: 400 });

    const update: Record<string, any> = { review_status: 'approved' };
    let explicitLane: LaneKey | null = null;
    let explicitIncludeLaneGuide: boolean | null = null;
    let explicitIncludeFactMerge: boolean = true;
    let customLaneSectionText: string | undefined = undefined;

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
      if (typeof body.includeFactMerge === 'boolean') {
        explicitIncludeFactMerge = body.includeFactMerge;
      }
      if (typeof body.customLaneSectionText === 'string' && body.customLaneSectionText.trim()) {
        customLaneSectionText = body.customLaneSectionText.trim();
      }

      if (typeof body.champion === 'string') {
        const rawChamp = body.champion.trim();
        const upper = rawChamp.toUpperCase();
        const isNonChamp = !rawChamp || ['UNKNOWN', 'NONE', 'NULL', 'なし', '未設定', '全般', '共通', '未指定'].includes(upper);
        
        if (isNonChamp) {
          update.champion = NO_CHAMPION;
        } else {
          const resolved = await resolveRosterChampions(rawChamp);
          if (resolved.length === 0) {
            // レーンガイド統合がONなら、チャンピオン無しとして許容して統合を続行する
            if (explicitIncludeLaneGuide) {
              update.champion = NO_CHAMPION;
            } else {
              return NextResponse.json({ error: `「${rawChamp}」に該当するチャンピオンが見つかりません（チャンピオン無しの場合は空欄または「Unknown」にしてください）` }, { status: 400 });
            }
          } else {
            update.champion = resolved.join(', ');
          }
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

    // トラックA: チャンピオン教本（matchup_sentinel & champion_notes）へ統合
    const champResult = await integrateArticles(db, targetRows);

    // トラックB（各項目AI差分マージ）とトラックC（レーンガイド統合）を並行実行して高速化
    let factUpdatedChamps = 0;
    let laneIntegratedCount = 0;
    // 以前は項目マージ・レーンガイド統合の失敗を console.warn だけで捨て、画面には「承認しました」と
    // だけ出ていた（本番に GEMINI_API_KEY が無く全件失敗していても気づけなかった。2026-10-06）
    const subErrors: string[] = [];
    const laneDetails: string[] = [];

    const factTasks = explicitIncludeFactMerge
      ? targetRows.map(async (row) => {
          const champList = await resolveRosterChampions(row.champion);
          const articleText = row.content || row.raw_content || '';
          if (champList.length > 0 && articleText.length >= 100) {
            for (const champId of champList) {
              try {
                const factRes = await executeChampionFactsMerge(
                  db,
                  champId,
                  row.title || '(無題)',
                  articleText,
                  row.id
                );
                if (factRes.success && factRes.updatedFields.length > 0) {
                  factUpdatedChamps++;
                } else if (!factRes.success) {
                  subErrors.push(`${champId} 辞典項目マージ失敗: ${factRes.error || '不明'}`);
                }
              } catch (factErr: any) {
                console.warn(`[knowledge/review] 項目マージ失敗 (${champId}):`, factErr);
                subErrors.push(`${champId} 辞典項目マージ失敗: ${factErr?.message || factErr}`);
              }
            }
          }
        })
      : [];

    const laneTasks = targetRows.map(async (row) => {
      try {
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
          const laneRes = await mergeArticleToLaneGuide(
            db,
            targetLane,
            {
              id: row.id,
              title: row.title,
              content: row.content,
              raw_content: row.raw_content,
              champion: row.champion,
              source_url: row.source_url,
            },
            customLaneSectionText
          );

          if (laneRes.success && laneRes.updated) {
            laneIntegratedCount++;
            if (!laneDetails.includes(targetLane)) laneDetails.push(targetLane);
          }
          if (!laneRes.success) {
            subErrors.push(`レーンガイド(${targetLane})統合失敗: ${laneRes.error || '不明'}`);
          }
        }
      } catch (laneErr: any) {
        console.warn(`[knowledge/review] レーンガイドマージ失敗:`, laneErr);
        subErrors.push(`レーンガイド統合失敗: ${laneErr?.message || laneErr}`);
      }
    });

    await Promise.all([...factTasks, ...laneTasks]);

    const totalCount = targetRows.length;
    const champCount = champResult.integrated.length;
    const errors = [...champResult.errors, ...subErrors];

    const message = [
      `${totalCount}件を承認しました。`,
      champCount > 0 ? `📖 教本へ${champCount}件統合` : '',
      factUpdatedChamps > 0 ? `🧬 辞典各項目（強み・弱み等）を更新・履歴保存` : '',
      laneIntegratedCount > 0 ? `🗺️ レーンガイド（${laneDetails.join(', ')}）へ${laneIntegratedCount}件マージ` : '',
      champResult.skippedNoChampion.length > 0 && laneIntegratedCount === 0 ? `（チャンピオン無しはライブラリに保持）` : '',
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
