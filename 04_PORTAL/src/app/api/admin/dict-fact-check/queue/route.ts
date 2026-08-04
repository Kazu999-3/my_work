import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

// dict_fact_check_queue の閲覧・人間による最終判断の反映。
// 反映は「対応済みにする」「不正タグを修正する」のみで、辞典本体の
// 自動削除・自動書き換えは一切行わない（誤検知で正しい情報を消すリスクを避けるため）。
export const dynamic = 'force-dynamic';

const FIXABLE_TABLES = new Set(['matchup_sentinel', 'champion_notes', 'personal_knowledge']);

export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';

    let query = supabase.from('dict_fact_check_queue').select('*').order('created_at', { ascending: false }).limit(300);
    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ items: data || [] });
  } catch (err: any) {
    console.error('[dict-fact-check/queue] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const id = Number(body.id);
    const action: 'dismiss' | 'acknowledge' | 'fix_champion_tag' = body.action;
    if (!id || !action) return NextResponse.json({ error: 'idとactionを指定してください。' }, { status: 400 });

    const { data: item, error: fetchErr } = await supabase
      .from('dict_fact_check_queue').select('*').eq('id', id).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!item) return NextResponse.json({ error: '対象が見つかりません。' }, { status: 404 });

    if (action === 'dismiss' || action === 'acknowledge') {
      const { error } = await supabase
        .from('dict_fact_check_queue')
        .update({ status: action === 'dismiss' ? 'dismissed' : 'acknowledged', reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'fix_champion_tag') {
      if (item.issue_type !== 'invalid_champion_tag') {
        return NextResponse.json({ error: 'このアクションはinvalid_champion_tagのみ対応しています。' }, { status: 400 });
      }
      const fixedChampion = String(body.fixedChampion || '').trim();
      if (!fixedChampion) return NextResponse.json({ error: '修正後のチャンピオン名を指定してください。' }, { status: 400 });

      const ref = Array.isArray(item.source_refs) ? item.source_refs[0] : null;
      if (!ref?.table || !ref?.id || !FIXABLE_TABLES.has(ref.table)) {
        return NextResponse.json({ error: '修正対象のレコードを特定できませんでした。' }, { status: 400 });
      }

      const { error: updateErr } = await supabase.from(ref.table).update({ champion: fixedChampion }).eq('id', ref.id);
      if (updateErr) throw updateErr;

      const { error } = await supabase
        .from('dict_fact_check_queue')
        .update({ status: 'fixed', reviewed_at: new Date().toISOString(), detail: { ...(item.detail || {}), fixedChampion } })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, fixedChampion });
    }

    return NextResponse.json({ error: `不明なaction: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[dict-fact-check/queue] PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
