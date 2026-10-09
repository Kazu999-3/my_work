import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { calculateFreshness } from '@/lib/patchFreshness';
import { detectArticleLane, LANE_CONFIG, LaneKey } from '@/lib/laneDetector';
import { detectArticleMatchup } from '@/lib/matchupDetector';

export const dynamic = 'force-dynamic';

function isLolRecord(item: any): boolean {
  if (item.champion && item.champion !== 'Unknown' && item.champion !== 'null') return true;
  const source = (item.source_url || '').toLowerCase();
  if (source.includes('_lol') || source.includes('leagueoflegends')) return true;
  const genre = (item.genre || '').toLowerCase();
  if (genre.includes('lol') || genre.includes('マクロ') || genre.includes('ビルド') || genre.includes('メカニクス')) return true;
  const tagsStr = (item.tags || []).join(' ').toLowerCase();
  if (tagsStr.includes('lol') || tagsStr.includes('jg') || tagsStr.includes('league') || tagsStr.includes('マクロ') || tagsStr.includes('ビルド')) return true;
  const title = (item.title || '').toLowerCase();
  const lolWords = [
    'lol', 'league', 'jg', 'jungle', 'gank', 'lane', 'patch', 'パッチ', 'ガンク',
    'ジャングル', 'レーン', 'ドラゴン', 'バロン', 'サモナー', 'チャレンジャー',
    'マスター', 'ダイヤ', 'ランク', 'ソロq', 'ビルド', 'ルーン', 'coach', 'kirei',
    '対面', 'ピック', 'elo', 'midgame', 'early game', 'late game', 'challenger',
    'macro', 'micro', 'smite', 'roam', 'dive', 'wave', 'troll', 'carry', 'inting', 'hardstuck'
  ];
  return lolWords.some(w => title.includes(w));
}

function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const champion = searchParams.get('champion') || '';
    const category = searchParams.get('category') || 'lol'; // 'lol' | 'general' | 'all'
    const channel = searchParams.get('channel') || '';
    const laneFilter = (searchParams.get('lane') || 'ALL').toUpperCase(); // 'ALL' | 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' | 'COMMON'
    const matchupOnly = searchParams.get('matchupOnly') === 'true' || searchParams.get('matchupOnly') === '1';
    const sort = searchParams.get('sort') || 'date_desc'; // 'date_desc' | 'date_asc' | 'published_desc' | 'published_asc' | 'volume_desc' | 'title_asc'
    const limit = parseInt(searchParams.get('limit') || '60', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    // 元動画URLで記事を特定する（動画解析センターの「記事を見る」から詳細を直接開くため）
    const source = searchParams.get('source') || '';

    // チャンネル名および公開日辞書を youtube_queue からロード
    const { data: queueRows } = await supabase
      .from('youtube_queue')
      .select('url, channel_name, published_at')
      .limit(3000);

    const channelMap: Record<string, string> = {};
    const videoIdMap: Record<string, string> = {};
    const publishedMap: Record<string, string> = {};
    const videoIdPublishedMap: Record<string, string> = {};

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

          if (qr.published_at) {
            publishedMap[trimmedUrl] = qr.published_at;
            if (vid) videoIdPublishedMap[vid] = qr.published_at;
          }
        }
      }
    }

    let query = supabase
      .from('personal_knowledge')
      .select('id, title, champion, source_url, tags, genre, created_at, content')
      // 削除済み(__DELETED__)は出さない。ただしタグが ['__DELETED__'] だけの行は、旧ポータルの統合処理
      // （レーンガイド・辞典への統合）がタグを丸ごと置き換えて片付けた記事なので「統合済み」として出す（2026-10-07 ユーザー要望）。
      // 人が削除した記事は __USER_DELETED__ も付く（下の setDeleted）ため、ここには含まれない
      .or('tags.is.null,tags.not.cs.{__DELETED__},tags.eq.{__DELETED__}')
      .order('created_at', { ascending: false });

    if (q) {
      query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,raw_content.ilike.%${q}%`);
    }

    if (champion) {
      query = query.ilike('champion', `%${champion}%`);
    }

    if (source) {
      query = query.eq('source_url', source);
    }

    // 全件取得してカテゴリ集計＆チャンネル抽出＆フィルタリング
    const { data, error } = await query.limit(2000);
    if (error) throw error;

    const allRows = data || [];
    let lolCount = 0;
    let generalCount = 0;

    // 各記事のチャンネル名、公開日、鮮度、レーン、対面情報を解決
    const enrichedRows = await Promise.all(
      allRows.map(async (r: any) => {
        let ch = '';
        let pubDate: string | null = null;
        const src = (r.source_url || '').trim();
        const srcVid = extractYoutubeId(src);

        // チャンネル特定
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

        // 公開日時特定 (YouTubeキュー ➔ 本文メタデータ ➔ 取込日 created_at)
        if (src && publishedMap[src]) {
          pubDate = publishedMap[src];
        } else if (srcVid && videoIdPublishedMap[srcVid]) {
          pubDate = videoIdPublishedMap[srcVid];
        } else if (r.content) {
          const mPub = r.content.match(/>\s*-\s*\*\*公開日\*\*:\s*([^\n\r]+)/);
          if (mPub) {
            pubDate = mPub[1].trim();
          }
        }

        // チャンネル名正規化（Kireiの表記揺れ統一など）
        if (ch.toLowerCase() === 'kireilol') ch = 'Coach Kirei';
        if (ch.toLowerCase() === 'coach kirei') ch = 'Coach Kirei';

        const charCount = (r.content || '').length;

        // 鮮度・パッチ情報の計算
        const effectiveDate = pubDate || r.created_at;
        const freshnessInfo = calculateFreshness(r.title, r.content || '', effectiveDate);

        // レーン判定＆対面（VS）判定
        const laneInfo = await detectArticleLane({
          title: r.title,
          content: r.content,
          tags: r.tags,
          champion: r.champion,
        });

        const matchupInfo = await detectArticleMatchup({
          title: r.title,
          content: r.content,
          tags: r.tags,
          champion: r.champion,
        });

        // レスポンス軽量化のため一覧では content 本文を削る
        const { content, ...rest } = r;
        return {
          ...rest,
          // __DELETED__ / __INTEGRATED__ 等の内部状態タグは画面に出さない
          tags: (r.tags || []).filter((t: string) => !/^__.+__$/.test(t)),
          integrated: isIntegratedTags(r.tags),
          channel: ch || 'その他・一般',
          char_count: charCount,
          published_at: freshnessInfo.publishedAt || (r.created_at ? r.created_at.split('T')[0] : null),
          patch: freshnessInfo.estimatedPatch,
          is_explicit_patch: freshnessInfo.isExplicitPatch,
          freshness: freshnessInfo.freshness,
          is_old_patch: freshnessInfo.isOldPatch,
          days_ago: freshnessInfo.daysAgo,
          freshness_label: freshnessInfo.label,
          freshness_color: freshnessInfo.badgeColor,
          lane: laneInfo.lane,
          laneLabel: laneInfo.laneLabel,
          isMatchup: matchupInfo.isMatchup,
          enemyChampion: matchupInfo.enemyChampion,
          enemyChampionJa: matchupInfo.enemyChampionJa,
          matchupLabel: matchupInfo.label,
        };
      })
    );

    for (const r of enrichedRows) {
      if (isLolRecord(r)) lolCount++;
      else generalCount++;
    }

    let filtered = enrichedRows;
    if (category === 'lol') {
      filtered = enrichedRows.filter(isLolRecord);
    } else if (category === 'general') {
      filtered = enrichedRows.filter((r: any) => !isLolRecord(r));
    }

    // レーン件数＆対面件数の集計（カテゴリ内ベース）
    const laneCounts: Record<string, number> = {
      ALL: filtered.length,
      TOP: 0,
      JG: 0,
      MID: 0,
      ADC: 0,
      SUP: 0,
      COMMON: 0,
      MATCHUP: 0,
    };
    for (const r of filtered) {
      const l = (r.lane || 'COMMON').toUpperCase();
      if (laneCounts[l] !== undefined) {
        laneCounts[l]++;
      }
      if (r.isMatchup) {
        laneCounts.MATCHUP++;
      }
    }

    // チャンネル集計（フィルタ前/カテゴリ内のチャンネル一覧と件数）
    const channelCountsMap: Record<string, number> = {};
    for (const r of filtered) {
      const ch = r.channel;
      channelCountsMap[ch] = (channelCountsMap[ch] || 0) + 1;
    }
    const channelList = Object.entries(channelCountsMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // チャンネル指定フィルタ
    if (channel) {
      filtered = filtered.filter((r: any) => r.channel === channel);
    }

    // レーン指定フィルタ
    if (laneFilter && laneFilter !== 'ALL') {
      filtered = filtered.filter((r: any) => (r.lane || '').toUpperCase() === laneFilter);
    }

    // 対面記事のみフィルタ
    if (matchupOnly) {
      filtered = filtered.filter((r: any) => r.isMatchup);
    }

    // ソート処理
    if (sort === 'date_desc') {
      filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sort === 'date_asc') {
      filtered.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sort === 'published_desc') {
      filtered.sort((a: any, b: any) => {
        const timeA = a.published_at ? new Date(a.published_at).getTime() : new Date(a.created_at).getTime();
        const timeB = b.published_at ? new Date(b.published_at).getTime() : new Date(b.created_at).getTime();
        return timeB - timeA;
      });
    } else if (sort === 'published_asc') {
      filtered.sort((a: any, b: any) => {
        const timeA = a.published_at ? new Date(a.published_at).getTime() : new Date(a.created_at).getTime();
        const timeB = b.published_at ? new Date(b.published_at).getTime() : new Date(b.created_at).getTime();
        return timeA - timeB;
      });
    } else if (sort === 'volume_desc') {
      filtered.sort((a: any, b: any) => (b.char_count || 0) - (a.char_count || 0));
    } else if (sort === 'title_asc') {
      filtered.sort((a: any, b: any) => a.title.localeCompare(b.title, 'ja'));
    }

    const paged = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      articles: paged,
      total: filtered.length,
      channels: channelList,
      counts: {
        lol: lolCount,
        general: generalCount,
        all: allRows.length,
      },
      laneCounts,
      limit,
      offset,
    });
  } catch (e: any) {
    console.error('library APIエラー:', e);
    return NextResponse.json({ error: e.message || '内部エラー' }, { status: 500 });
  }
}

// 単一記事詳細取得 (POST)
export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'idが必要です' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('personal_knowledge')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    let pubDate: string | null = null;
    if (data?.source_url) {
      const { data: qRow } = await supabase
        .from('youtube_queue')
        .select('published_at')
        .eq('url', data.source_url)
        .maybeSingle();
      if (qRow?.published_at) {
        pubDate = qRow.published_at;
      }
    }

    const freshnessInfo = calculateFreshness(data.title, data.content || '', pubDate || data.created_at);
    const laneInfo = await detectArticleLane({
      title: data.title,
      content: data.content,
      tags: data.tags,
      champion: data.champion,
    });
    const matchupInfo = await detectArticleMatchup({
      title: data.title,
      content: data.content,
      tags: data.tags,
      champion: data.champion,
    });

    const enrichedArticle = {
      ...data,
      published_at: freshnessInfo.publishedAt || (data.created_at ? data.created_at.split('T')[0] : null),
      patch: freshnessInfo.estimatedPatch,
      is_explicit_patch: freshnessInfo.isExplicitPatch,
      freshness: freshnessInfo.freshness,
      is_old_patch: freshnessInfo.isOldPatch,
      days_ago: freshnessInfo.daysAgo,
      freshness_label: freshnessInfo.label,
      freshness_color: freshnessInfo.badgeColor,
      lane: laneInfo.lane,
      laneLabel: laneInfo.laneLabel,
      isMatchup: matchupInfo.isMatchup,
      enemyChampion: matchupInfo.enemyChampion,
      enemyChampionJa: matchupInfo.enemyChampionJa,
      matchupLabel: matchupInfo.label,
    };

    return NextResponse.json({ success: true, article: enrichedArticle });
  } catch (e: any) {
    console.error('library 単一記事取得エラー:', e);
    return NextResponse.json({ error: e.message || '内部エラー' }, { status: 500 });
  }
}

const DELETED_TAG = '__DELETED__';
const USER_DELETED_TAG = '__USER_DELETED__';
const INTEGRATED_TAG = '__INTEGRATED__';

/** レーンガイド・辞典に統合済みの記事か（現行の __INTEGRATED__ と、旧ポータルが ['__DELETED__'] に置き換えたもの） */
function isIntegratedTags(tags: unknown): boolean {
  if (!Array.isArray(tags)) return false;
  return tags.includes(INTEGRATED_TAG) || (tags.length === 1 && tags[0] === DELETED_TAG);
}

// 記事の削除（2026-10-06）。既存の運用に合わせ、行は消さず __DELETED__ タグを付ける論理削除にする。
// 辞典・レーンガイドに統合済みの記事は knowledge_revisions 等から出典として参照されているため、物理削除しない。
// 既存のタグは残す（旧ポータルの退避処理は tags を ['__DELETED__'] で丸ごと置き換えていたため、復元時にタグが失われた）。
async function setDeleted(id: unknown, deleted: boolean) {
  if (!supabase) throw new Error('Supabaseクライアントが未初期化です');
  if (!id) throw Object.assign(new Error('idが必要です'), { status: 400 });
  const { data: row, error: selErr } = await supabase.from('personal_knowledge').select('id, title, tags').eq('id', id).maybeSingle();
  if (selErr) throw selErr;
  if (!row) throw Object.assign(new Error('記事が見つかりません'), { status: 404 });
  const current: string[] = Array.isArray(row.tags) ? row.tags : [];
  // 削除には __USER_DELETED__ も付け、旧ポータルの「統合で片付けた ['__DELETED__']」と区別する（2026-10-07）。
  // 旧形式の統合済み記事を消す時は __INTEGRATED__ に置き換えておく（元に戻した時に統合済みのまま残り、3時間おきの自動統合で二重に統合されない）
  const base = current.length === 1 && current[0] === DELETED_TAG
    ? [INTEGRATED_TAG]
    : current.filter((t) => t !== DELETED_TAG && t !== USER_DELETED_TAG);
  const tags = deleted ? [...base, DELETED_TAG, USER_DELETED_TAG] : base;
  const { error } = await supabase.from('personal_knowledge').update({ tags }).eq('id', id);
  if (error) throw error;
  return row.title as string;
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json().catch(() => ({}));
    const title = await setDeleted(id, true);
    return NextResponse.json({ success: true, message: `「${title}」をライブラリから削除しました` });
  } catch (e: any) {
    console.error('library 削除エラー:', e);
    return NextResponse.json({ error: e.message || '削除に失敗しました' }, { status: e.status || 500 });
  }
}

// 削除の取り消し
export async function PATCH(req: NextRequest) {
  try {
    const { id, restore } = await req.json().catch(() => ({}));
    if (restore !== true) return NextResponse.json({ error: 'restore: true を指定してください' }, { status: 400 });
    const title = await setDeleted(id, false);
    return NextResponse.json({ success: true, message: `「${title}」を元に戻しました` });
  } catch (e: any) {
    console.error('library 復元エラー:', e);
    return NextResponse.json({ error: e.message || '復元に失敗しました' }, { status: e.status || 500 });
  }
}
