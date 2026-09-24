import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { resolveToRosterChampion, getNoChampionMarker } from '../../../../../lib/dictFactCheck';

export const dynamic = 'force-dynamic';

// review_status='pending'の行を一覧・承認・却下するAPI。対象は2種類:
// 1. atomic insight(AIによる知見分解、is_atomic=true) — 2026-08-15、knowledge/add側で導入。
// 2. 動画解析(youtube_worker.py)が自動生成した攻略記事本体(is_atomic=false) — 2026-08-16、
//    「攻略ライブラリから各チャンピオンの辞典に振り分ける前にプレビューしたい」という要望を
//    受け、こちらも人間が承認するまでfetch_personal_knowledge(champion_trend_worker.py)の
//    対象から外れるようにした。既存の承認済み記事(手動登録分・過去の動画解析分)は対象外で、
//    今後youtube_worker.pyが新規保存する分だけがここに現れる。
export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from('personal_knowledge')
      .select('id, title, content, champion, tags, parent_id, is_atomic, source_url, created_at')
      .eq('review_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    // 親記事のタイトルも一緒に返し、レビュー画面で「どの記事から分割されたか」を分かるようにする
    const parentIds = Array.from(new Set((data || []).map((r: any) => r.parent_id).filter(Boolean)));
    let parentTitles: Record<number, string> = {};
    if (parentIds.length > 0) {
      const { data: parents } = await supabase
        .from('personal_knowledge')
        .select('id, title')
        .in('id', parentIds);
      parentTitles = Object.fromEntries((parents || []).map((p: any) => [p.id, p.title]));
    }

    const items = (data || []).map((r: any) => ({
      ...r,
      parentTitle: r.parent_id ? parentTitles[r.parent_id] || null : null,
      isLaneGeneral: r.champion === getNoChampionMarker('personal_knowledge'),
    }));

    return NextResponse.json({ success: true, items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ids, action, champion, mergeToDict } = body;
    if (!action) return NextResponse.json({ error: 'actionが必要です' }, { status: 400 });

    const targetIds: number[] = Array.isArray(ids) ? ids.map(Number).filter(Boolean) : (id ? [Number(id)] : []);
    if (targetIds.length === 0) {
      return NextResponse.json({ error: '対象のidまたはidsが必要です' }, { status: 400 });
    }

    if (action === 'reject') {
      const { error, count } = await supabase
        .from('personal_knowledge')
        .delete({ count: 'exact' })
        .in('id', targetIds)
        .eq('review_status', 'pending');
      if (error) throw error;
      return NextResponse.json({ success: true, count: count ?? targetIds.length });
    }

    if (action === 'approve') {
      const update: Record<string, any> = { review_status: 'approved' };
      // 単一IDでチャンピオン指定がある場合のみ上書き更新
      if (targetIds.length === 1 && typeof champion === 'string') {
        if (champion.trim() === '') {
          update.champion = getNoChampionMarker('personal_knowledge');
        } else {
          const resolved = await resolveToRosterChampion(champion);
          update.champion = resolved || champion;
        }
      }

      const { data: updatedRows, error } = await supabase
        .from('personal_knowledge')
        .update(update)
        .in('id', targetIds)
        .eq('review_status', 'pending')
        .select('id, title, content, champion');

      if (error) throw error;

      // 承認と同時にチャンピオン辞典への即時マージが要求された場合（または既定）
      let mergedCount = 0;
      if (mergeToDict && updatedRows && updatedRows.length > 0) {
        const noChampMarker = getNoChampionMarker('personal_knowledge');
        for (const row of updatedRows) {
          const champ = row.champion;
          if (!champ || champ === noChampMarker || champ === 'unknown' || champ === 'null') {
            continue;
          }
          try {
            // champion_facts を取得して strategy または source_summary に知見を追記
            const { data: fact } = await supabase
              .from('champion_facts')
              .select('champion, strategy, source_summary')
              .ilike('champion', champ)
              .maybeSingle();

            if (fact) {
              const snippet = `\n- 【知見】${row.title}: ${row.content.slice(0, 150)}`;
              const newStrategy = (fact.strategy || '') + snippet;
              await supabase
                .from('champion_facts')
                .update({
                  strategy: newStrategy.slice(0, 4000),
                  updated_at: new Date().toISOString()
                })
                .ilike('champion', champ);
              mergedCount++;
            }
          } catch (mergeErr) {
            console.warn('[pending-review] Auto-merge failed for champion:', champ, mergeErr);
          }
        }
      }

      return NextResponse.json({
        success: true,
        count: updatedRows?.length ?? targetIds.length,
        mergedCount
      });
    }

    return NextResponse.json({ error: '無効なactionです' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
