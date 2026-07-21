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
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

    let query = supabase
      .from('knowledge_revisions')
      .select('id, target_type, target_key, field, before_text, after_text, source_title, source_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (targetType) query = query.eq('target_type', targetType);
    if (targetKey) query = query.eq('target_key', targetKey);

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
