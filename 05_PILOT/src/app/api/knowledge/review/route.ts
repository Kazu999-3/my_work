import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getRoster, resolveRosterChampion } from '@/lib/championRoster';
import { integrateArticles } from '@/lib/knowledgeIntegrate';

export const dynamic = 'force-dynamic';

// 動画解析などでAIが自動生成した personal_knowledge(review_status='pending') の承認・却下。
// 承認するまで辞典同期(knowledge/sync)にもトレンド集計にも使われない（2026-08-15/16 に導入）。
// 旧ポータルの pending-review を移植したもの。Gemini を使う「辞典反映プレビュー」は移していない。
//
// 2026-10-02: 旧ポータルの辞典同期は review_status を見ずに統合しており、「承認するまで辞典に
// 入らない」は実際には守られていなかった（承認待ち450件中197件が統合済みだった）。
// そこで「承認＝辞典へ統合」に一本化した。チャンピオンが無い記事(レーン一般論)は
// 統合先が無いため、承認済みとしてライブラリに残す。
//
// personal_knowledge で「特定チャンピオンではない（レーン一般論）」を表す値
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
      .select('id, title, content, champion, parent_id, is_atomic, source_url, created_at', { count: 'exact' })
      .eq('review_status', 'pending')
      // 統合済み（ライブラリ側で削除扱い）の記事は承認待ちに出さない
      .or('tags.is.null,tags.not.cs.{__DELETED__}');
    if (champion) query = query.eq('champion', champion);
    if (type === 'atomic') query = query.eq('is_atomic', true);
    if (type === 'video') query = query.eq('is_atomic', false);
    query = query.order('created_at', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    // 分割知見は「どの記事から分割されたか」を出すため親記事のタイトルを付ける
    const parentIds = Array.from(new Set((data || []).map((r: any) => r.parent_id).filter(Boolean)));
    let parentTitles: Record<string, string> = {};
    if (parentIds.length > 0) {
      const { data: parents } = await supabase.from('personal_knowledge').select('id, title').in('id', parentIds);
      parentTitles = Object.fromEntries((parents || []).map((p: any) => [String(p.id), p.title]));
    }

    const roster = await getRoster().catch(() => []);
    return NextResponse.json({
      success: true,
      total: count ?? 0,
      items: (data || []).map((r: any) => ({
        ...r,
        parentTitle: r.parent_id ? parentTitles[String(r.parent_id)] || null : null,
        isLaneGeneral: !r.champion || r.champion === NO_CHAMPION,
      })),
      roster,
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
    const { action, champion } = body;
    const ids: number[] = (Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [])
      .map(Number).filter((n: number) => Number.isFinite(n) && n > 0).slice(0, 200);
    if (ids.length === 0) return NextResponse.json({ error: '対象の id / ids が必要です' }, { status: 400 });

    if (action === 'reject') {
      // 承認待ちのAI生成記事だけを消す（承認済みや手動登録の記事は対象外）
      const { error, count } = await supabase
        .from('personal_knowledge')
        .delete({ count: 'exact' })
        .in('id', ids)
        .eq('review_status', 'pending');
      if (error) throw error;
      return NextResponse.json({ success: true, count: count ?? 0, message: `${count ?? 0}件を却下しました` });
    }

    if (action !== 'approve') return NextResponse.json({ error: '無効な action です' }, { status: 400 });

    const update: Record<string, any> = { review_status: 'approved' };
    // チャンピオンの付け替えは1件ずつのときだけ受け付ける
    if (ids.length === 1 && typeof champion === 'string') {
      if (!champion.trim()) {
        update.champion = NO_CHAMPION;
      } else {
        const resolved = await resolveRosterChampion(champion);
        if (!resolved) {
          return NextResponse.json({ error: `「${champion}」というチャンピオンが見つかりません` }, { status: 400 });
        }
        update.champion = resolved;
      }
    }

    const { data: rows, error } = await supabase
      .from('personal_knowledge')
      .update(update)
      .in('id', ids)
      .eq('review_status', 'pending')
      .select('id, title, content, raw_content, champion');
    if (error) throw error;

    // 承認した記事を辞典へ統合する（チャンピオンの無い記事は承認済みのままライブラリに残る）
    const result = await integrateArticles(supabase, rows || []);
    const n = rows?.length || 0;
    const kept = result.skippedNoChampion.length;
    return NextResponse.json({
      success: result.errors.length === 0,
      count: n,
      integrated: result.integrated.length,
      keptAsLaneGeneral: kept,
      errors: result.errors,
      message: `${n}件を承認し、${result.integrated.length}件を辞典へ統合しました`
        + (kept ? `（チャンピオン無し${kept}件はレーン一般論としてライブラリに残しました）` : '')
        + (result.errors.length ? `。失敗: ${result.errors.join(' / ')}` : ''),
    });
  } catch (e: any) {
    console.error('[knowledge/review] POST Error:', e);
    return NextResponse.json({ error: e.message || '処理に失敗しました' }, { status: 500 });
  }
}
