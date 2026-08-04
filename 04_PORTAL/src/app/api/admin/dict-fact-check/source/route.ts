import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { recordRevision } from '../../../../../lib/knowledgeRevisions';

// 一斉ファクトチェック(Step2)のレビュー画面から、根拠となった元データ
// (matchup_sentinel/champion_notes/champion_facts)を直接編集・削除するためのAPI。
// 「訂正を記録」だけでは今後のAI生成にしか効かず、既存の誤った文章自体は
// 残り続けてしまうため、その場で直接直せるようにするのが目的。
// personal_knowledgeは既存の攻略ライブラリ編集画面があるため対象外。
export const dynamic = 'force-dynamic';

const EDITABLE_FIELDS: Record<string, string[]> = {
  matchup_sentinel: ['strategy'],
  champion_notes: ['body'],
  champion_facts: ['strengths', 'weaknesses', 'power_spikes', 'build_runes', 'strategy', 'counter_champions', 'must_ban_champions'],
};

export async function PATCH(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const table = String(body.table || '');
    const field = String(body.field || '');
    const value = String(body.value ?? '');

    if (!EDITABLE_FIELDS[table]?.includes(field)) {
      return NextResponse.json({ error: `${table}.${field} は編集対象として許可されていません。` }, { status: 400 });
    }

    if (table === 'champion_facts') {
      const champion = String(body.champion || '').trim();
      if (!champion) return NextResponse.json({ error: 'championを指定してください。' }, { status: 400 });

      const { data: existing } = await supabase.from('champion_facts').select(field).eq('champion', champion).maybeSingle();
      const before = (existing as any)?.[field] ?? null;

      const { error } = await supabase
        .from('champion_facts')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('champion', champion);
      if (error) throw error;

      await recordRevision({ targetType: 'champion_fact', targetKey: champion, field, before, after: value });
      return NextResponse.json({ success: true });
    }

    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: 'idを指定してください。' }, { status: 400 });

    if (table === 'matchup_sentinel') {
      const { data: existing } = await supabase.from('matchup_sentinel').select('matchup_id, strategy').eq('id', id).maybeSingle();
      if (!existing) return NextResponse.json({ error: '対象が見つかりません。' }, { status: 404 });
      const before = (existing as any)[field] ?? null;

      const { error } = await supabase.from('matchup_sentinel').update({ [field]: value }).eq('id', id);
      if (error) throw error;

      await recordRevision({ targetType: 'matchup_sentinel', targetKey: existing.matchup_id, field, before, after: value });
      return NextResponse.json({ success: true });
    }

    if (table === 'champion_notes') {
      const { data: existing } = await supabase.from('champion_notes').select(field).eq('id', id).maybeSingle();
      if (!existing) return NextResponse.json({ error: '対象が見つかりません。' }, { status: 404 });
      const before = (existing as any)?.[field] ?? null;

      const { error } = await supabase.from('champion_notes').update({ [field]: value }).eq('id', id);
      if (error) throw error;

      await recordRevision({ targetType: 'champion_notes', targetKey: String(id), field, before, after: value });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `未対応のtable: ${table}` }, { status: 400 });
  } catch (err: any) {
    console.error('[dict-fact-check/source] PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const DELETABLE_TABLES = new Set(['matchup_sentinel', 'champion_notes']);

export async function DELETE(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const table = String(body.table || '');
    const id = Number(body.id);
    if (!DELETABLE_TABLES.has(table) || !id) {
      return NextResponse.json({ error: '削除できる対象を指定してください。' }, { status: 400 });
    }

    if (table === 'matchup_sentinel') {
      // GLOBAL行(辞典本体)は/champions側の詳細取得が.single()で前提にしており、
      // 消すとそのチャンピオンの辞典ページ自体が壊れるため削除させない。
      const { data: existing } = await supabase.from('matchup_sentinel').select('enemy').eq('id', id).maybeSingle();
      if (existing?.enemy === 'GLOBAL') {
        return NextResponse.json({ error: '辞典本体（GLOBAL行）は削除できません。空にしたい場合は編集で内容を消してください。' }, { status: 400 });
      }
    }

    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[dict-fact-check/source] DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
