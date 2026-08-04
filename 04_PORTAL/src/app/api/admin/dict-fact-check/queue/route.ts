import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { resolveChampionId } from '../../../../../lib/dictFactCheck';
import { getAllChampionIds } from '../../../../../lib/ddragonClient';

// dict_fact_check_queue の閲覧・人間による最終判断の反映。
// 反映は「対応済みにする」「不正タグを修正する」のみで、辞典本体の
// 自動削除・自動書き換えは一切行わない（誤検知で正しい情報を消すリスクを避けるため）。
export const dynamic = 'force-dynamic';

const FIXABLE_TABLES = new Set(['matchup_sentinel', 'champion_notes', 'personal_knowledge']);
// champion列に「Rek'Sai & Fizz」のように2チャンピオン分が紛れ込んでいた場合、
// enemy列を持つテーブルだけは「対面」として2体目を書き込める。
const TABLES_WITH_ENEMY = new Set(['matchup_sentinel', 'champion_notes']);

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
    const action: 'dismiss' | 'acknowledge' | 'fix_champion_tag' | 'record_correction' = body.action;
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
      const rawInput = String(body.fixedChampion || '').trim();
      if (!rawInput) return NextResponse.json({ error: '修正後のチャンピオン名を指定してください。' }, { status: 400 });

      // 日本語名(「グレイブス」等)や表記ゆれで入力されても、DataDragon準拠の英語IDに
      // 正規化してから保存する。ここで正規化しないと、修正したつもりが別の形の
      // 不正タグを新しく作ってしまう(グルーピング・他機能からの検索が壊れる)。
      const roster = await getAllChampionIds();
      const rosterArr = Array.from(roster);
      const resolveOrError = (raw: string): string | null => {
        const resolved = resolveChampionId(raw);
        return rosterArr.find((r) => r.toLowerCase() === resolved?.toLowerCase()) || null;
      };

      const canonical = resolveOrError(rawInput);
      if (!canonical) {
        return NextResponse.json({ error: `「${rawInput}」を実在チャンピオン名として認識できませんでした。英語表記(例: Graves)で入力してください。` }, { status: 400 });
      }

      const ref = Array.isArray(item.source_refs) ? item.source_refs[0] : null;
      if (!ref?.table || !ref?.id || !FIXABLE_TABLES.has(ref.table)) {
        return NextResponse.json({ error: '修正対象のレコードを特定できませんでした。' }, { status: 400 });
      }

      // 「Rek'Sai & Fizz」のように元の値に2チャンピオン分が紛れている場合、
      // 2体目を「対面」としてenemy列に書き込めるようにする(enemy列を持つ
      // テーブルのみ対応。personal_knowledgeはenemy概念が無いため非対応)。
      const rawEnemyInput = String(body.fixedEnemy || '').trim();
      let canonicalEnemy: string | null = null;
      if (rawEnemyInput) {
        if (!TABLES_WITH_ENEMY.has(ref.table)) {
          return NextResponse.json({ error: `${ref.table}には対面(enemy)の概念がないため、この項目では指定できません。` }, { status: 400 });
        }
        canonicalEnemy = resolveOrError(rawEnemyInput);
        if (!canonicalEnemy) {
          return NextResponse.json({ error: `対面「${rawEnemyInput}」を実在チャンピオン名として認識できませんでした。` }, { status: 400 });
        }
      }

      const updatePayload: Record<string, string> = { champion: canonical };
      if (canonicalEnemy) updatePayload.enemy = canonicalEnemy;

      const { error: updateErr } = await supabase.from(ref.table).update(updatePayload).eq('id', ref.id);
      if (updateErr) throw updateErr;

      const { error } = await supabase
        .from('dict_fact_check_queue')
        .update({ status: 'fixed', reviewed_at: new Date().toISOString(), detail: { ...(item.detail || {}), fixedChampion: canonical, fixedEnemy: canonicalEnemy } })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, fixedChampion: canonical, fixedEnemy: canonicalEnemy });
    }

    if (action === 'record_correction') {
      if (item.issue_type === 'invalid_champion_tag') {
        return NextResponse.json({ error: 'このアクションはinvalid_champion_tag以外で使用してください。' }, { status: 400 });
      }
      const correctInfo = String(body.correctInfo || '').trim();
      if (!correctInfo) return NextResponse.json({ error: '正しい内容を入力してください。' }, { status: 400 });

      // 一斉ファクトチェックの再生成プロンプト・コーチAI・辞典再生成すべてが読む
      // 共通知識レイヤー(lib/championKnowledge.ts)がこのテーブルを参照するため、
      // ここに記録するだけで以降の全AI生成に「再発防止」として効く。
      const { error: insertErr } = await supabase.from('dict_known_corrections').insert({
        champion: item.champion,
        wrong_claim: item.summary,
        correct_info: correctInfo,
        issue_type: item.issue_type,
        source_queue_id: item.id,
      });
      if (insertErr) throw insertErr;

      const { error } = await supabase
        .from('dict_fact_check_queue')
        .update({ status: 'fixed', reviewed_at: new Date().toISOString(), detail: { ...(item.detail || {}), correctInfo } })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `不明なaction: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[dict-fact-check/queue] PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
