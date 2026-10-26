import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getRoster, resolveRosterChampions, resolveRosterChampion, getChampionNameJa } from '@/lib/championRoster';
import { integrateArticles, formatChampionArticleSection } from '@/lib/knowledgeIntegrate';
import { detectArticleLane, LANE_CONFIG, LaneKey } from '@/lib/laneDetector';
import { detectArticleMatchup } from '@/lib/matchupDetector';
import { integrateMatchupArticle } from '@/lib/matchupMemo';
import { formatLaneGuideSection, mergeArticleToLaneGuide, appendSectionToLaneGuide } from '@/lib/laneGuideIntegrate';
import { previewChampionFactsMerge, executeChampionFactsMerge, FactFieldKey } from '@/lib/championFactsMerge';
import { decomposeArticle, saveDecomposedInsights, DecomposedInsight } from '@/lib/knowledgeDecompose';
import { assessArticleDensity } from '@/lib/articleDensity';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;


function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

const NO_CHAMPION = 'Unknown';
const DEFAULT_PAGE_SIZE = 50;

// 再解析（2026-10-19）＆分解（2026-10-26）: 採用しなかった版や分解済みの親記事に付けるタグ。行は消さず、ライブラリ・承認待ちから隠す
const SUPERSEDED_TAGS = ['__DELETED__', '__SUPERSEDED__', '__DECOMPOSED__'];
const REANALYZE_REASONS = ['thin', 'focus', 'generic', 'wrong', 'other'];
const REANALYZE_FOCUS = ['build', 'skill', 'laning', 'jungle', 'objective', 'macro', 'teamfight', 'matchup', 'mindset'];

function withTags(tags: string[] | null | undefined, add: string[]): string[] {
  const base = Array.isArray(tags) ? tags : [];
  return Array.from(new Set([...base, ...add]));
}

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
    const quality = searchParams.get('quality') || ''; // 'thin'（薄い可能性） | 'reanalyzed'（再解析版） | 'approve' | 'check' | 'skip'（承認の目安。2026-10-20）

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
      .select('id, title, content, champion, parent_id, is_atomic, source_url, tags, created_at, reanalysis_of, analysis_meta')
      .eq('review_status', 'pending')
      .or('tags.is.null,tags.not.cs.{__DELETED__}')
      .order('created_at', { ascending: true })
      .limit(1000);

    if (champion) baseQuery = baseQuery.eq('champion', champion);
    if (type === 'atomic') baseQuery = baseQuery.eq('is_atomic', true);
    if (type === 'video') baseQuery = baseQuery.eq('is_atomic', false);

    const { data, error } = await baseQuery;
    if (error) throw error;

    // 再解析（2026-10-19）: 再解析版がある記事は元の記事を一覧から外し、再解析版のカードで新旧を比べる
    const allRows = data || [];
    const draftByOriginal = new Map<number, any>();
    for (const r of allRows) {
      if (r.reanalysis_of == null) continue;
      const cur = draftByOriginal.get(r.reanalysis_of);
      if (!cur || new Date(r.created_at) > new Date(cur.created_at)) draftByOriginal.set(r.reanalysis_of, r);
    }
    const rowById = new Map<number, any>(allRows.map((r: any) => [r.id, r]));
    const rawRows = allRows
      .filter((r: any) => !draftByOriginal.has(r.id))
      .filter((r: any) => {
        const tags = Array.isArray(r.tags) ? r.tags : [];
        return !tags.some((t: string) => SUPERSEDED_TAGS.includes(t));
      });

    // 元の記事が承認済み等で一覧に無い場合も比較できるよう取ってくる
    const missingOriginalIds = Array.from(draftByOriginal.keys()).filter((id) => !rowById.has(id));
    if (missingOriginalIds.length > 0) {
      const { data: origRows } = await supabase
        .from('personal_knowledge')
        .select('id, title, content, created_at, analysis_meta, tags, is_atomic')
        .in('id', missingOriginalIds);
      for (const o of origRows || []) rowById.set(o.id, o);
    }

    // 進行中・失敗した再解析の依頼（直近3日）
    const reanalysisTasks: Record<number, { status: string; error: string | null; createdAt: string }> = {};
    {
      const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
      const { data: taskRows } = await supabase
        .from('edge_tasks')
        .select('status, payload, error_message, created_at')
        .eq('task_type', 'article_reanalyze')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(500);
      for (const t of taskRows || []) {
        const aid = Number((t as any).payload?.article_id);
        if (!aid) continue;
        reanalysisTasks[aid] = { status: t.status, error: t.error_message, createdAt: t.created_at };
      }
    }

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

        // 対面判定（VS記事・相手チャンピオン検出）
        const matchupDetection = await detectArticleMatchup({
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
        const isShort = Array.isArray(r.tags) && r.tags.includes('Shorts');
        const density = assessArticleDensity(r.content || '', r.analysis_meta, { isShort, isAtomic: !!r.is_atomic });

        // 再解析版なら元の記事（比較用）、元の記事なら進行中・失敗した再解析の依頼
        const rootId: number = r.reanalysis_of ?? r.id;
        const original = r.reanalysis_of != null ? rowById.get(r.reanalysis_of) : null;
        const task = reanalysisTasks[rootId];
        const taskForCard = task && (task.status === 'pending' || task.status === 'running'
          || (task.status === 'failed' && new Date(task.createdAt) > new Date(r.created_at)))
          ? task : null;

        return {
          ...r,
          analysis_meta: r.analysis_meta || null,
          density,
          reanalysisTask: taskForCard,
          reanalysisOriginal: original
            ? {
                id: original.id,
                title: original.title,
                content: original.content,
                density: assessArticleDensity(original.content || '', original.analysis_meta, { isShort, isAtomic: !!original.is_atomic }),
              }
            : null,
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
          isMatchup: matchupDetection.isMatchup,
          enemyChampion: matchupDetection.enemyChampion,
          enemyChampionJa: matchupDetection.enemyChampionJa,
          matchupLabel: matchupDetection.label,
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

    const qualityCounts = {
      determined: enrichedItems.filter((i) => !i.isLaneGeneral || !!i.detectedChampionsJa).length,
      unknown: enrichedItems.filter((i) => i.isLaneGeneral && !i.detectedChampionsJa).length,
      thin: enrichedItems.filter((i) => i.density.level === 'thin').length,
      reanalyzed: enrichedItems.filter((i) => i.reanalysis_of != null).length,
      approve: enrichedItems.filter((i) => i.density.triage === 'approve').length,
      check: enrichedItems.filter((i) => i.density.triage === 'check').length,
      skip: enrichedItems.filter((i) => i.density.triage === 'skip').length,
    };

    // 5. フィルタリング適用
    let filtered = enrichedItems;
    if (quality === 'determined') filtered = filtered.filter((i) => !i.isLaneGeneral || !!i.detectedChampionsJa);
    if (quality === 'unknown') filtered = filtered.filter((i) => i.isLaneGeneral && !i.detectedChampionsJa);
    if (quality === 'thin') filtered = filtered.filter((i) => i.density.level === 'thin');
    if (quality === 'reanalyzed') filtered = filtered.filter((i) => i.reanalysis_of != null);
    if (quality === 'approve' || quality === 'check' || quality === 'skip') filtered = filtered.filter((i) => i.density.triage === quality);

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
      qualityCounts,
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
    // 0. 複数チャンピオンへのナレッジ分解アクション
    // ──────────────────────────────────────────
    if (action === 'decompose_preview') {
      const { id, title, content, source_url } = body;
      let targetTitle = title;
      let targetContent = content;
      let targetUrl = source_url;

      if (id && (!targetContent || !targetTitle)) {
        const { data: row, error: fetchErr } = await db
          .from('personal_knowledge')
          .select('title, content, raw_content, source_url')
          .eq('id', id)
          .single();
        if (fetchErr || !row) {
          return NextResponse.json({ error: '記事の取得に失敗しました' }, { status: 404 });
        }
        targetTitle = row.title;
        targetContent = row.content || row.raw_content || '';
        targetUrl = row.source_url;
      }

      const insights = await decomposeArticle({
        id,
        title: targetTitle,
        content: targetContent,
        source_url: targetUrl,
      });

      return NextResponse.json({
        success: true,
        parentTitle: targetTitle,
        insights,
      });
    }

    if (action === 'decompose_save') {
      const { parentId, insights, source_url } = body;
      if (!parentId || !Array.isArray(insights) || insights.length === 0) {
        return NextResponse.json({ error: 'parentId と insights（配列）が必要です' }, { status: 400 });
      }

      const saveRes = await saveDecomposedInsights(db, Number(parentId), insights as DecomposedInsight[], source_url);
      return NextResponse.json({
        success: true,
        message: `${saveRes.count}件の分割知見を登録しました（未承認リストに反映されます）`,
        count: saveRes.count,
        savedIds: saveRes.savedIds,
      });
    }

    // ──────────────────────────────────────────
    // 1. プレビュー生成アクション
    // ──────────────────────────────────────────
    if (action === 'preview') {
      const { title, content, champion, enemyChampion, lane, includeLaneGuide, includeFactMerge, source_url } = body;
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

      // 対面DBプレビュー
      let matchupPreviews: any[] = [];
      let resolvedEnemy: string | null = null;
      if (enemyChampion && typeof enemyChampion === 'string' && enemyChampion.trim()) {
        resolvedEnemy = await resolveRosterChampion(enemyChampion.trim());
      }
      if (!resolvedEnemy && resolvedChamps.length > 0) {
        const matchupDetection = await detectArticleMatchup({
          title: cleanTitle,
          content: cleanContent,
          champion: resolvedChamps[0],
        });
        if (matchupDetection.isMatchup && matchupDetection.enemyChampion) {
          resolvedEnemy = matchupDetection.enemyChampion;
        }
      }

      if (resolvedEnemy && resolvedChamps.length > 0) {
        const myChamp = resolvedChamps[0];
        const myChampJa = await getChampionNameJa(myChamp);
        const enemyJa = await getChampionNameJa(resolvedEnemy);
        matchupPreviews.push({
          matchupId: `${myChamp}_vs_${resolvedEnemy}`,
          champion: myChamp,
          championJa: myChampJa,
          enemy: resolvedEnemy,
          enemyJa,
          lane: targetLane,
          sectionText: formatChampionArticleSection(cleanTitle, cleanContent),
        });
      }

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

        // 既存のレーンガイド本文を取得
        const { data: guideRow } = await db
          .from('lane_guides')
          .select('title, body, source_count')
          .eq('lane', targetLane)
          .maybeSingle();

        const existingBody = guideRow?.body || '';
        const mergedBody = laneSectionText ? appendSectionToLaneGuide(existingBody, laneSectionText) : existingBody;

        laneGuidePreview = {
          lane: targetLane,
          laneLabel: LANE_CONFIG[targetLane]?.label || targetLane,
          sectionText: laneSectionText,
          existingBody: existingBody,
          mergedBody: mergedBody,
          sourceCount: guideRow?.source_count || 0,
          error: laneError,
        };
      }

      return NextResponse.json({
        success: true,
        championPreviews,
        matchupPreviews,
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

    // ──────────────────────────────────────────
    // 再解析（2026-10-19）: 依頼・旧版のまま（再解析版を破棄）
    // ──────────────────────────────────────────
    if (action === 'reanalyze') {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 });
      const reason = REANALYZE_REASONS.includes(body.reason) ? body.reason : 'thin';
      const focus = Array.isArray(body.focus) ? body.focus.filter((f: string) => REANALYZE_FOCUS.includes(f)) : [];
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
      const model = body.model === 'high' ? 'high' : 'standard';

      const { data: row, error: rowErr } = await db
        .from('personal_knowledge')
        .select('id, source_url, review_status, reanalysis_of, is_atomic, tags')
        .eq('id', id)
        .maybeSingle();
      if (rowErr) throw rowErr;
      if (!row || row.review_status !== 'pending' || (row.tags || []).includes('__DELETED__')) {
        return NextResponse.json({ error: '承認待ちの記事が見つかりません（承認・却下済みの可能性）' }, { status: 404 });
      }
      if (row.is_atomic || !/youtu/.test(row.source_url || '')) {
        return NextResponse.json({ error: '再解析できるのは YouTube 動画の記事だけです' }, { status: 400 });
      }
      // 再解析版をさらに作り直す時は、元の記事を基準にし、今の版を「前回の記事」として渡す
      const rootId: number = row.reanalysis_of ?? row.id;

      const { data: running } = await db
        .from('edge_tasks')
        .select('id')
        .eq('task_type', 'article_reanalyze')
        .in('status', ['pending', 'running'])
        .contains('payload', { article_id: rootId })
        .limit(1);
      if (running && running.length > 0) {
        return NextResponse.json({ error: 'この記事は再解析中です。完了までお待ちください' }, { status: 409 });
      }

      const { error: insErr } = await db.from('edge_tasks').insert({
        task_type: 'article_reanalyze',
        status: 'pending',
        payload: { article_id: rootId, base_id: row.id, reason, focus, note, model },
      });
      if (insErr) throw insErr;
      return NextResponse.json({
        success: true,
        message: '再解析を依頼しました。数分で新しい版が届きます（届いたら通知ベルでお知らせします）',
      });
    }

    if (action === 'discard_reanalysis') {
      const id = Number(body.id);
      const { data: row, error: rowErr } = await db
        .from('personal_knowledge')
        .select('id, tags, reanalysis_of, review_status')
        .eq('id', id)
        .maybeSingle();
      if (rowErr) throw rowErr;
      if (!row || row.reanalysis_of == null || row.review_status !== 'pending') {
        return NextResponse.json({ error: '承認待ちの再解析版が見つかりません' }, { status: 404 });
      }
      const { error: upErr } = await db
        .from('personal_knowledge')
        .update({ tags: withTags(row.tags, SUPERSEDED_TAGS) })
        .eq('id', id);
      if (upErr) throw upErr;
      return NextResponse.json({ success: true, message: '再解析版を使わず、元の記事に戻しました（再解析版は履歴として残しています）' });
    }

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
    // 3. 承認 ＆ 統合（教本・対面DB・項目マージ・レーンガイド）
    // ──────────────────────────────────────────
    if (action !== 'approve') return NextResponse.json({ error: '無効な action です' }, { status: 400 });

    const update: Record<string, any> = { review_status: 'approved' };
    let explicitLane: LaneKey | null = null;
    let explicitEnemy: string | null = null;
    let explicitIncludeLaneGuide: boolean | null = null;
    let explicitIncludeFactMerge: boolean = true;
    let customLaneSectionText: string | undefined = undefined;
    let customFactOverrides: Record<string, Partial<Record<FactFieldKey, string>>> | undefined = undefined;

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
      if (typeof body.enemyChampion === 'string') {
        explicitEnemy = body.enemyChampion.trim() || null;
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
      if (body.customFactOverrides && typeof body.customFactOverrides === 'object') {
        customFactOverrides = body.customFactOverrides;
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
      .select('id, title, content, raw_content, champion, tags, source_url, reanalysis_of');
    if (error) throw error;

    const targetRows = rows || [];

    // 再解析版を承認した時は、元の記事（と同じ元から作った他の版）を履歴として隠す（2026-10-19）
    const supersededRoots = targetRows.map((r: any) => r.reanalysis_of).filter((v: any) => v != null);
    if (supersededRoots.length > 0) {
      const approvedIds = targetRows.map((r: any) => r.id);
      const { data: olds } = await db
        .from('personal_knowledge')
        .select('id, tags')
        .or(`id.in.(${supersededRoots.join(',')}),reanalysis_of.in.(${supersededRoots.join(',')})`);
      for (const o of olds || []) {
        if (approvedIds.includes(o.id)) continue;
        await db.from('personal_knowledge').update({ tags: withTags(o.tags, SUPERSEDED_TAGS) }).eq('id', o.id);
      }
    }
    if (targetRows.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: '対象記事がありませんでした' });
    }

    // トラックA: チャンピオン教本（matchup_sentinel & champion_notes）へ統合
    const champResult = await integrateArticles(db, targetRows);

    // トラックB（各項目AI差分マージ）、トラックC（レーンガイド統合）、トラックD（対面DB統合）を並行実行
    let factUpdatedChamps = 0;
    let laneIntegratedCount = 0;
    let matchupIntegratedCount = 0;
    const subErrors: string[] = [];
    const laneDetails: string[] = [];
    const matchupDetails: string[] = [];

    const factTasks = explicitIncludeFactMerge
      ? targetRows.map(async (row) => {
          const champList = await resolveRosterChampions(row.champion);
          const articleText = row.content || row.raw_content || '';
          if (champList.length > 0 && articleText.length >= 100) {
            for (const champId of champList) {
              try {
                const champOverride = customFactOverrides ? customFactOverrides[champId] : undefined;
                const factRes = await executeChampionFactsMerge(
                  db,
                  champId,
                  row.title || '(無題)',
                  articleText,
                  row.id,
                  champOverride
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

    // トラックD: 対面DB（matchup_sentinel の ${myChamp}_vs_${enemy} 行）への統合
    const matchupTasks = targetRows.map(async (row) => {
      try {
        const champList = await resolveRosterChampions(row.champion);
        const myChamp = champList[0];
        if (!myChamp) return;

        let enemyToIntegrate = explicitEnemy && ids.length === 1 ? explicitEnemy : null;
        if (!enemyToIntegrate) {
          const detection = await detectArticleMatchup({
            title: row.title,
            content: row.content,
            tags: row.tags,
            champion: myChamp,
          });
          if (detection.isMatchup && detection.enemyChampion) {
            enemyToIntegrate = detection.enemyChampion;
          }
        }

        if (enemyToIntegrate) {
          const resolvedEnemy = await resolveRosterChampion(enemyToIntegrate);
          if (resolvedEnemy && resolvedEnemy.toLowerCase() !== myChamp.toLowerCase()) {
            const laneForMatchup = (explicitLane !== null && ids.length === 1)
              ? explicitLane
              : (await detectArticleLane({ title: row.title, content: row.content, champion: myChamp })).lane;

            const res = await integrateMatchupArticle({
              myChampion: myChamp,
              enemyChampion: resolvedEnemy,
              title: row.title || '(無題)',
              content: row.content || row.raw_content || '',
              lane: laneForMatchup,
              sourceUrl: row.source_url,
            });

            if (res.ok) {
              matchupIntegratedCount++;
              const label = `${myChamp} vs ${resolvedEnemy} [${laneForMatchup}]`;
              if (!matchupDetails.includes(label)) matchupDetails.push(label);
            } else {
              subErrors.push(`対面DB統合失敗 (${myChamp} vs ${resolvedEnemy}): ${res.error}`);
            }
          }
        }
      } catch (matchupErr: any) {
        console.warn(`[knowledge/review] 対面DBマージ失敗:`, matchupErr);
        subErrors.push(`対面DB統合失敗: ${matchupErr?.message || matchupErr}`);
      }
    });

    await Promise.all([...factTasks, ...laneTasks, ...matchupTasks]);

    const totalCount = targetRows.length;
    const champCount = champResult.integrated.length;
    const errors = [...champResult.errors, ...subErrors];

    const message = [
      `${totalCount}件を承認しました。`,
      champCount > 0 ? `📖 教本へ${champCount}件統合` : '',
      matchupIntegratedCount > 0 ? `⚔️ 対面DB（${matchupDetails.join(', ')}）へ${matchupIntegratedCount}件統合` : '',
      factUpdatedChamps > 0 ? `🧬 辞典各項目（強み・弱み等）を更新・履歴保存` : '',
      laneIntegratedCount > 0 ? `🗺️ レーンガイド（${laneDetails.join(', ')}）へ${laneIntegratedCount}件マージ` : '',
      champResult.skippedNoChampion.length > 0 && laneIntegratedCount === 0 ? `（チャンピオン無しはライブラリに保持）` : '',
    ].filter(Boolean).join('、');

    return NextResponse.json({
      success: errors.length === 0,
      count: totalCount,
      integratedChampions: champCount,
      integratedMatchups: matchupIntegratedCount,
      integratedLaneGuides: laneIntegratedCount,
      errors,
      message: message + (errors.length ? `。エラー: ${errors.join(' / ')}` : ''),
    });
  } catch (e: any) {
    console.error('[knowledge/review] POST Error:', e);
    return NextResponse.json({ error: e.message || '処理に失敗しました' }, { status: 500 });
  }
}
