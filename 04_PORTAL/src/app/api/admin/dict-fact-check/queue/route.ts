import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { resolveChampionId, getNoChampionMarker, getChampionPreviewText } from '../../../../../lib/dictFactCheck';
import { getAllChampionIds } from '../../../../../lib/ddragonClient';

// dict_fact_check_queue の閲覧・人間による最終判断の反映。
// 反映は「対応済みにする」「不正タグを修正する」のみで、辞典本体の
// 自動削除・自動書き換えは一切行わない（誤検知で正しい情報を消すリスクを避けるため）。
export const dynamic = 'force-dynamic';

const FIXABLE_TABLES = new Set(['matchup_sentinel', 'champion_notes', 'personal_knowledge']);
// champion列に「Rek'Sai & Fizz」のように2チャンピオン分が紛れ込んでいた場合、
// enemy列を持つテーブルだけは「対面」として2体目を書き込める。
const TABLES_WITH_ENEMY = new Set(['matchup_sentinel', 'champion_notes']);

// invalid_champion_tagは champion 列自体がゴミ値(記号・単発文字等)のことが多く、
// 「辞典で確認」リンク(champion名から引く辞典ページ)が意味を持たない。
// 代わりに、参照元レコードの本文を直接プレビュー表示できるよう、テーブルごとの
// タイトル/本文カラムを定義しておく（人間が「元々何のチャンピオンの話だったか」を
// 判断するために必要）。
const PREVIEW_COLUMNS: Record<string, { title: string; body: string; url?: string }> = {
  matchup_sentinel: { title: 'title', body: 'strategy' },
  champion_notes: { title: 'title', body: 'body' },
  personal_knowledge: { title: 'title', body: 'content', url: 'source_url' },
};

async function attachSourcePreviews(items: any[]): Promise<any[]> {
  const targets = items.filter((it) => it.issue_type === 'invalid_champion_tag' && it.source_refs?.[0]?.table && it.source_refs?.[0]?.id);
  if (targets.length === 0) return items;

  const idsByTable = new Map<string, number[]>();
  for (const it of targets) {
    const { table, id } = it.source_refs[0];
    if (!PREVIEW_COLUMNS[table]) continue;
    if (!idsByTable.has(table)) idsByTable.set(table, []);
    idsByTable.get(table)!.push(id);
  }

  const previewByKey = new Map<string, { title: string; body: string; url?: string }>();
  for (const [table, ids] of idsByTable) {
    const cols = PREVIEW_COLUMNS[table];
    const selectCols = ['id', cols.title, cols.body, cols.url].filter(Boolean).join(', ');
    const { data } = await supabase.from(table).select(selectCols).in('id', ids);
    for (const row of (data || []) as any[]) {
      previewByKey.set(`${table}:${row.id}`, {
        title: row[cols.title] || '',
        body: (row[cols.body] || '').toString().slice(0, 300),
        url: cols.url ? row[cols.url] : undefined,
      });
    }
  }

  return items.map((it) => {
    if (it.issue_type !== 'invalid_champion_tag' || !it.source_refs?.[0]) return it;
    const { table, id } = it.source_refs[0];
    const preview = previewByKey.get(`${table}:${id}`);
    return preview ? { ...it, sourcePreview: preview } : it;
  });
}

// contradiction/unconfirmed_source/possible_fact_errorは特定の1行ではなく
// 「チャンピオン単位で複数ソースを横断した結果」なので、AIが実際に読んだ
// 辞典本体・対面メモ・コーチAI知識層メモ・ナレッジをそのまま人間にも見せる
// （でないとsummary(40字程度)だけでは何が根拠なのか検証できない）。
async function attachChampionPreviews(items: any[]): Promise<any[]> {
  const targets = items.filter((it) => it.issue_type !== 'invalid_champion_tag' && it.champion);
  if (targets.length === 0) return items;

  const champions = Array.from(new Set(targets.map((it) => it.champion)));
  const previewByChampion = new Map<string, string>();
  for (const champion of champions) {
    try {
      previewByChampion.set(champion, await getChampionPreviewText(supabase, champion));
    } catch (e) {
      console.warn(`[dict-fact-check/queue] ${champion} のプレビュー取得に失敗:`, e);
    }
  }

  return items.map((it) => {
    if (it.issue_type === 'invalid_champion_tag' || !it.champion) return it;
    const preview = previewByChampion.get(it.champion);
    return preview ? { ...it, championPreview: preview } : it;
  });
}

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

    const withInvalidTagPreviews = await attachSourcePreviews(data || []);
    const items = await attachChampionPreviews(withInvalidTagPreviews);
    return NextResponse.json({ items });
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
    const action: 'dismiss' | 'acknowledge' | 'fix_champion_tag' | 'record_correction' | 'mark_no_champion' | 'delete_article' = body.action;
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

    if (action === 'delete_article') {
      if (item.issue_type !== 'invalid_champion_tag') {
        return NextResponse.json({ error: 'このアクションはinvalid_champion_tagのみ対応しています。' }, { status: 400 });
      }
      const ref = Array.isArray(item.source_refs) ? item.source_refs[0] : null;
      if (!ref?.table || !ref?.id || !FIXABLE_TABLES.has(ref.table)) {
        return NextResponse.json({ error: '対象レコードを特定できませんでした。' }, { status: 400 });
      }

      // 明示的な人間の操作(1件ずつ・確認ダイアログ経由)のみを想定した削除。
      // 元データがゴミ/価値のない記事だった場合の最終手段として、
      // 参照元レコード本体とこのキュー項目の両方を削除する（元に戻せない）。
      const { error: deleteSourceErr } = await supabase.from(ref.table).delete().eq('id', ref.id);
      if (deleteSourceErr) throw deleteSourceErr;

      const { error: deleteQueueErr } = await supabase.from('dict_fact_check_queue').delete().eq('id', id);
      if (deleteQueueErr) throw deleteQueueErr;

      return NextResponse.json({ success: true });
    }

    if (action === 'mark_no_champion') {
      if (item.issue_type !== 'invalid_champion_tag') {
        return NextResponse.json({ error: 'このアクションはinvalid_champion_tagのみ対応しています。' }, { status: 400 });
      }
      const ref = Array.isArray(item.source_refs) ? item.source_refs[0] : null;
      if (!ref?.table || !ref?.id || !FIXABLE_TABLES.has(ref.table)) {
        return NextResponse.json({ error: '対象レコードを特定できませんでした。' }, { status: 400 });
      }

      // 特定のチャンピオンに関する記事ではないと人間が判断した場合の専用マーカー。
      // 空文字や適当な値を書くと次のスキャンでまた不正タグとして検出されてしまう
      // ため、各テーブルの「チャンピオン無し」慣習値を書き込む。
      const marker = getNoChampionMarker(ref.table);
      const { error: updateErr } = await supabase.from(ref.table).update({ champion: marker }).eq('id', ref.id);
      if (updateErr) throw updateErr;

      const { error } = await supabase
        .from('dict_fact_check_queue')
        .update({ status: 'fixed', reviewed_at: new Date().toISOString(), detail: { ...(item.detail || {}), markedNoChampion: true, marker } })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, marker });
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
