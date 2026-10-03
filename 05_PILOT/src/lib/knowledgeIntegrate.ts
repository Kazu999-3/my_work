import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRosterChampion } from './championRoster';

// 攻略ライブラリ(personal_knowledge)の記事をチャンピオン辞典へ統合する。
// 旧ポータル /api/admin/knowledge/sync の移植。統合すると:
//   1. matchup_sentinel(champ_<ID>_global) の strategy に「## 【記事】タイトル」節として追記（同名節は置き換え）
//   2. knowledge_revisions に変更履歴を残す
//   3. champion_notes に構造化メモとして登録（同じ記事の分は入れ替え）
//   4. ライブラリ側は __DELETED__ タグで削除扱い、review_status は approved にする
//
// 旧実装から変えた点:
// - offset でページ送りしていたが、統合した記事は __DELETED__ で検索対象から外れるため
//   次のページの開始位置がずれ、未処理の記事を飛ばしていた。id の昇順で進める方式にした。
// - 承認状態(review_status)を見ずに統合していた。呼び出し側で対象を選ぶ前提にし、統合した記事は approved にする。
// - Gemini を使う「項目マージ」と「矛盾チェック」は移していない（Geminiの利用枠を使うため）。

export interface IntegrateArticle {
  id: number;
  title: string | null;
  content: string | null;
  raw_content: string | null;
  champion: string | null;
}

export interface IntegrateResult {
  integrated: number[];
  skippedNoChampion: number[];
  errors: string[];
  champions: string[];
}

const NON_CHAMPION = new Set(['', 'UNKNOWN', 'GENERAL', 'NULL', 'NONE']);

/** "Ahri, Zed" のような複数指定も含め、実在チャンピオンIDの配列にする */
async function resolveChampions(raw: string | null): Promise<string[]> {
  const out: string[] = [];
  for (const part of String(raw || '').split(',').map((s) => s.trim())) {
    if (NON_CHAMPION.has(part.toUpperCase())) continue;
    const id = await resolveRosterChampion(part);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

async function recordRevision(sb: SupabaseClient, key: string, field: string, before: string | null, after: string, sourceTitle: string) {
  if (before === after) return;
  try {
    await sb.from('knowledge_revisions').insert({
      target_type: 'matchup_sentinel',
      target_key: key,
      field,
      before_text: before,
      after_text: after,
      source_title: sourceTitle,
      source_id: null,
    });
  } catch (e) {
    console.warn('[knowledgeIntegrate] 履歴の保存に失敗:', e);
  }
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function integrateArticles(sb: SupabaseClient, articles: IntegrateArticle[]): Promise<IntegrateResult> {
  const result: IntegrateResult = { integrated: [], skippedNoChampion: [], errors: [], champions: [] };

  const resolved: { a: IntegrateArticle; champions: string[]; body: string; title: string }[] = [];
  for (const a of articles) {
    const champions = await resolveChampions(a.champion);
    if (champions.length === 0) { result.skippedNoChampion.push(a.id); continue; }
    resolved.push({ a, champions, title: a.title || '(無題)', body: a.raw_content || a.content || '' });
  }

  // チャンピオン単位でまとめて1回だけ読み書きする
  const byChampion = new Map<string, { title: string; body: string }[]>();
  for (const r of resolved) {
    for (const c of r.champions) {
      byChampion.set(c, [...(byChampion.get(c) || []), { title: r.title, body: r.body }]);
    }
  }

  const failedChampions = new Set<string>();
  for (const [champion, items] of byChampion) {
    try {
      const matchupId = `champ_${champion}_global`;
      const { data: existing, error: selErr } = await sb
        .from('matchup_sentinel').select('strategy, raw_data').eq('matchup_id', matchupId).maybeSingle();
      if (selErr) throw selErr;

      let strategy: string = existing?.strategy || '';
      for (const { title, body } of items) {
        const header = `## 【記事】${title}`;
        if (!strategy.trim()) {
          strategy = `${header}\n\n${body}`;
        } else if (strategy.includes(header)) {
          const pattern = new RegExp(`## 【記事】${escapeRegExp(title)}\\s*\\n[\\s\\S]*?(?=\\n---|$)`);
          strategy = strategy.replace(pattern, () => `${header}\n\n${body}`);
        } else {
          strategy = `${strategy}\n\n---\n\n${header}\n\n${body}`;
        }
      }

      const { error: upErr } = await sb.from('matchup_sentinel').upsert({
        matchup_id: matchupId,
        champion,
        enemy: 'GLOBAL',
        strategy,
        raw_data: { ...(existing?.raw_data || {}), source: 'champ_db', role: 'GLOBAL' },
        // 辞典一覧の「更新日」は created_at を見ているため更新時も現在時刻を入れる
        created_at: new Date().toISOString(),
      }, { onConflict: 'matchup_id' });
      if (upErr) throw upErr;

      await recordRevision(sb, matchupId, 'strategy', existing ? existing.strategy || '' : null, strategy,
        `攻略ライブラリから統合（${items.length}件の記事）`);
      result.champions.push(champion);
    } catch (e: any) {
      failedChampions.add(champion);
      if (result.errors.length < 5) result.errors.push(`${champion}: ${e?.message || e}`);
    }
  }

  // 辞典への追記に成功した記事だけ、notes登録とライブラリからの削除扱いを行う
  for (const r of resolved) {
    if (r.champions.some((c) => failedChampions.has(c))) continue;
    try {
      await sb.from('champion_notes').delete().eq('source_article_id', r.a.id);
      const { error: insErr } = await sb.from('champion_notes').insert(
        r.champions.map((champion) => ({ champion, title: r.title, body: r.body, source: 'article', source_article_id: r.a.id })),
      );
      if (insErr) throw new Error(`champion_notes: ${insErr.message}`);

      const { error: tagErr } = await sb
        .from('personal_knowledge').update({ review_status: 'approved' }).eq('id', r.a.id);
      if (tagErr) throw new Error(`personal_knowledge: ${tagErr.message}`);
      result.integrated.push(r.a.id);
    } catch (e: any) {
      if (result.errors.length < 5) result.errors.push(`記事${r.a.id}: ${e?.message || e}`);
    }
  }

  return result;
}
