import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { diffLines, diffSummary } from '../../../../../lib/knowledgeRevisions';

// チャンピオン辞典・レーン別ガイドの更新履歴。
// 一覧（サマリのみ）と、1件の詳細（行差分）を返す。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // --- 1件の詳細（行差分つき） ---
    if (id) {
      const { data, error } = await supabase
        .from('knowledge_revisions').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: '履歴が見つかりません' }, { status: 404 });

      return NextResponse.json({
        success: true,
        revision: data,
        diff: diffLines(data.before_text || '', data.after_text || ''),
      });
    }

    // --- 一覧 ---
    const targetType = searchParams.get('type');   // lane_guide / champion_fact
    const targetKey = searchParams.get('key');     // TOP / Graves など
    const sourceId = searchParams.get('sourceId'); // personal_knowledge記事のid（この記事由来の履歴だけに絞る）
    const champion = searchParams.get('champion'); // チャンピオン辞典ページ内で、そのチャンピオンに関わる全履歴を横断表示する用
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

    // champion_fact は target_key=champion名で直接引けるが、matchup_sentinel は
    // target_key=matchup_id（生成元により "champ_X_global" / "X_vs_Y" 等表記がバラバラ）、
    // champion_notes は target_key=行id で、どちらもtarget_keyだけではチャンピオン名を
    // 引けない。該当チャンピオンの実際の行を先に引いてから、そのキー群で履歴を絞り込む。
    if (champion) {
      const selectCols = 'id, target_type, target_key, field, before_text, after_text, source_title, source_id, created_at';
      const [factRes, sentinelRes, noteRes] = await Promise.all([
        supabase.from('knowledge_revisions').select(selectCols).eq('target_type', 'champion_fact').eq('target_key', champion),
        supabase.from('matchup_sentinel').select('matchup_id').eq('champion', champion),
        supabase.from('champion_notes').select('id').eq('champion', champion),
      ]);
      const matchupIds = ((sentinelRes.data || []) as any[]).map((r) => r.matchup_id).filter(Boolean);
      const noteIds = ((noteRes.data || []) as any[]).map((r) => String(r.id));

      const [matchupRevRes, noteRevRes] = await Promise.all([
        matchupIds.length > 0
          ? supabase.from('knowledge_revisions').select(selectCols).eq('target_type', 'matchup_sentinel').in('target_key', matchupIds)
          : Promise.resolve({ data: [] as any[] }),
        noteIds.length > 0
          ? supabase.from('knowledge_revisions').select(selectCols).eq('target_type', 'champion_notes').in('target_key', noteIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const merged = ([...(factRes.data || []), ...(matchupRevRes.data || []), ...(noteRevRes.data || [])] as any[])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);

      const revisions = merged.map((r: any) => {
        const { added, removed } = diffSummary(r.before_text || '', r.after_text || '');
        return {
          id: r.id, target_type: r.target_type, target_key: r.target_key, field: r.field,
          source_title: r.source_title, source_id: r.source_id, created_at: r.created_at,
          added, removed, isNew: !r.before_text,
        };
      });

      return NextResponse.json({ success: true, revisions });
    }

    let query = supabase
      .from('knowledge_revisions')
      .select('id, target_type, target_key, field, before_text, after_text, source_title, source_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (targetType) query = query.eq('target_type', targetType);
    if (targetKey) query = query.eq('target_key', targetKey);
    if (sourceId) query = query.eq('source_id', String(sourceId));

    const { data, error } = await query;
    if (error) throw error;

    // 本文をそのまま返すと重いので、一覧では増減行数だけにする
    const revisions = (data || []).map((r: any) => {
      const { added, removed } = diffSummary(r.before_text || '', r.after_text || '');
      return {
        id: r.id,
        target_type: r.target_type,
        target_key: r.target_key,
        field: r.field,
        source_title: r.source_title,
        source_id: r.source_id,
        created_at: r.created_at,
        added,
        removed,
        isNew: !r.before_text,
      };
    });

    return NextResponse.json({ success: true, revisions });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ロールバック（この更新の直前の状態に戻す）
export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'idが必要です' }, { status: 400 });

    const { data: rev, error } = await supabase
      .from('knowledge_revisions').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!rev) return NextResponse.json({ error: '履歴が見つかりません' }, { status: 404 });
    if (rev.before_text == null) {
      return NextResponse.json({ error: 'これは新規作成の履歴のため、戻せる状態がありません。' }, { status: 400 });
    }

    if (rev.target_type === 'lane_guide') {
      const { error: e2 } = await supabase
        .from('lane_guides')
        .update({ body: rev.before_text, updated_at: new Date().toISOString() })
        .eq('lane', rev.target_key);
      if (e2) throw e2;
    } else if (rev.target_type === 'champion_fact') {
      const { error: e2 } = await supabase
        .from('champion_facts')
        .update({ [rev.field]: rev.before_text, updated_at: new Date().toISOString() })
        .eq('champion', rev.target_key);
      if (e2) throw e2;
    } else if (rev.target_type === 'matchup_sentinel') {
      // matchup_sentinelにはupdated_at列が存在しない(champions/save/route.tsのコメント通り)。
      // 以前はここでupdated_atを含めてupdateしており、存在しない列としてPostgRESTが
      // エラーを返すため「更新を取り消す」ボタンが常に失敗していた。
      if (rev.field === 'title' || rev.field === 'strategy') {
        const { error: e2 } = await supabase
          .from('matchup_sentinel')
          .update({ [rev.field]: rev.before_text })
          .eq('matchup_id', rev.target_key);
        if (e2) throw e2;
      } else {
        // raw_data(JSONB)内のフィールドは読み取り→該当キーだけ差し替え→書き戻す
        const { data: row, error: e2 } = await supabase
          .from('matchup_sentinel')
          .select('raw_data')
          .eq('matchup_id', rev.target_key)
          .maybeSingle();
        if (e2) throw e2;
        if (!row) return NextResponse.json({ error: '対象の辞典データが見つかりません' }, { status: 404 });

        let restored: any = rev.before_text;
        try { restored = JSON.parse(rev.before_text); } catch { /* 文字列のまま使う（元々テキスト項目） */ }

        const { error: e3 } = await supabase
          .from('matchup_sentinel')
          .update({ raw_data: { ...(row.raw_data || {}), [rev.field]: restored } })
          .eq('matchup_id', rev.target_key);
        if (e3) throw e3;
      }
    } else if (rev.target_type === 'champion_notes') {
      const { error: e2 } = await supabase
        .from('champion_notes')
        .update({ [rev.field]: rev.before_text })
        .eq('id', rev.target_key);
      if (e2) throw e2;
    } else {
      return NextResponse.json({ error: `未対応の種別です: ${rev.target_type}` }, { status: 400 });
    }

    // 戻した操作自体も履歴に残す（戻したことを取り消せるように）
    await supabase.from('knowledge_revisions').insert({
      target_type: rev.target_type,
      target_key: rev.target_key,
      field: rev.field,
      before_text: rev.after_text,
      after_text: rev.before_text,
      source_title: `↩️ #${rev.id} の更新を取り消し`,
    });

    return NextResponse.json({ success: true, message: '更新前の状態に戻しました。' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
