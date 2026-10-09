import { supabase } from './supabaseClient';
import { resolveRosterChampion } from './championRoster';

// 対面メモ（matchup_sentinel の <自分>_vs_<対面> 行の strategy）へ追記する共通処理。2026-10-06
// 元は /api/lol/sync-match-feedback の中にあった。05の /api/soloq/reflections は移植時(2026-10-02)に
// upsert({champion, enemy, strategy, updated_at}, onConflict 'champion,enemy') という別実装になっていたが、
// matchup_sentinel には (champion, enemy) のユニーク制約も updated_at 列も無いため毎回エラーになり、
// その error を見ていなかった（04の旧実装は正常。05で該当期間に保存された振り返りは0件のため実害は無し）。
// また成功しても strategy を丸ごと上書きする作りだった。ここでは追記のみ・失敗は呼び出し元へ返す。

export type AppendMatchupMemoResult =
  | { ok: true; matchupId: string; champion: string; enemy: string; created: boolean }
  | { ok: false; error: string };

async function recordRevision(key: string, before: string, after: string, sourceTitle: string) {
  if (!supabase || before === after) return;
  try {
    await supabase.from('knowledge_revisions').insert({
      target_type: 'matchup_sentinel', target_key: key, field: 'strategy',
      before_text: before, after_text: after, source_title: sourceTitle, source_id: null,
    });
  } catch (e) {
    console.warn('[matchupMemo] 履歴の保存に失敗:', e);
  }
}

export async function appendMatchupMemo(params: {
  myChampion: string;
  enemyChampion: string;
  text: string;
  /** 追記する見出しのラベル（例: 「試合後の振り返り」） */
  label: string;
  /** 新規行の raw_data.source に入れる値 */
  source: string;
}): Promise<AppendMatchupMemoResult> {
  if (!supabase) return { ok: false, error: 'Supabaseクライアントが未初期化です' };
  const text = params.text.trim();
  if (!text) return { ok: false, error: 'メモが空です' };

  // 実在しないチャンピオン名で行を作らない（matchup_sentinel にゴミ行が溜まった前例がある）
  const champion = await resolveRosterChampion(params.myChampion);
  const enemy = await resolveRosterChampion(params.enemyChampion);
  if (!champion || !enemy) {
    return { ok: false, error: `チャンピオン名を解決できませんでした（${params.myChampion} / ${params.enemyChampion}）。` };
  }

  const matchupId = `${champion}_vs_${enemy}`;
  const dateStr = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const sourceTitle = `${params.label} (${champion} vs ${enemy})`;

  const { data: existing, error: selErr } = await supabase
    .from('matchup_sentinel').select('strategy').eq('matchup_id', matchupId).maybeSingle();
  if (selErr) return { ok: false, error: selErr.message };

  if (existing) {
    const before = existing.strategy || '';
    const after = `${before}${before ? '\n\n' : ''}【${params.label} (${dateStr})】\n${text}`;
    const { error } = await supabase.from('matchup_sentinel').update({ strategy: after }).eq('matchup_id', matchupId);
    if (error) return { ok: false, error: error.message };
    await recordRevision(matchupId, before, after, sourceTitle);
    return { ok: true, matchupId, champion, enemy, created: false };
  }

  // id は GENERATED ALWAYS AS IDENTITY のため指定しない
  const { error } = await supabase.from('matchup_sentinel').insert({
    matchup_id: matchupId,
    champion,
    enemy,
    title: `${champion} vs ${enemy} 対策`,
    strategy: text,
    raw_data: { source: params.source, created_at: new Date().toISOString() },
  });
  if (error) return { ok: false, error: error.message };
  await recordRevision(matchupId, '', text, sourceTitle);
  return { ok: true, matchupId, champion, enemy, created: true };
}

/**
 * 攻略ライブラリから承認された対面記事を matchup_sentinel の <自分>_vs_<対面> 行へ統合する。
 * レーン情報も raw_data.lane に保存し、辞書の対面タブでレーン毎に正確にフィルタリングできるようにする。
 */
export async function integrateMatchupArticle(params: {
  myChampion: string;
  enemyChampion: string;
  title: string;
  content: string;
  lane?: string;
  sourceUrl?: string | null;
}): Promise<AppendMatchupMemoResult> {
  if (!supabase) return { ok: false, error: 'Supabaseクライアントが未初期化です' };
  const title = params.title.trim();
  const content = params.content.trim();
  if (!title && !content) return { ok: false, error: 'タイトルまたは本文が空です' };

  const champion = await resolveRosterChampion(params.myChampion);
  const enemy = await resolveRosterChampion(params.enemyChampion);
  if (!champion || !enemy) {
    return { ok: false, error: `チャンピオン名を解決できませんでした（${params.myChampion} / ${params.enemyChampion}）。` };
  }

  const matchupId = `${champion}_vs_${enemy}`;
  const targetLane = (params.lane || 'COMMON').toUpperCase();
  const sourceTitle = `対面攻略記事: ${title} (${champion} vs ${enemy})`;

  const header = `## 【記事】${title}`;
  const section = `${header}\n\n${content}`;

  const { data: existing, error: selErr } = await supabase
    .from('matchup_sentinel')
    .select('strategy, raw_data')
    .eq('matchup_id', matchupId)
    .maybeSingle();
  if (selErr) return { ok: false, error: selErr.message };

  if (existing) {
    const before = existing.strategy || '';
    let after = before;
    if (!before.trim()) {
      after = section;
    } else {
      const parts = before.split(/\n(?=## 【記事】)/);
      const idx = parts.findIndex((p: string) => p.startsWith('## 【記事】') && p.split('\n', 1)[0].trim() === header);
      if (idx === -1) {
        after = `${before}\n\n---\n\n${section}`;
      } else {
        parts[idx] = section;
        after = parts.join('\n');
      }
    }

    const rawData = {
      ...(existing.raw_data || {}),
      lane: targetLane,
      role: targetLane,
      source: 'library_article',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('matchup_sentinel')
      .update({
        strategy: after,
        raw_data: rawData,
        created_at: new Date().toISOString(),
      })
      .eq('matchup_id', matchupId);

    if (error) return { ok: false, error: error.message };
    await recordRevision(matchupId, before, after, sourceTitle);
    return { ok: true, matchupId, champion, enemy, created: false };
  }

  const { error } = await supabase.from('matchup_sentinel').insert({
    matchup_id: matchupId,
    champion,
    enemy,
    title: `${champion} vs ${enemy} 対策`,
    strategy: section,
    raw_data: {
      source: 'library_article',
      lane: targetLane,
      role: targetLane,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });

  if (error) return { ok: false, error: error.message };
  await recordRevision(matchupId, '', section, sourceTitle);
  return { ok: true, matchupId, champion, enemy, created: true };
}
