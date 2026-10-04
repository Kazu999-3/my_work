import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRosterChampion } from './championRoster';

// 攻略ライブラリ(personal_knowledge)の記事をチャンピオン辞典へ統合する。
// 旧ポータル /api/admin/knowledge/sync の移植。統合すると:
//   1. matchup_sentinel(champ_<ID>_global) の strategy に「## 【記事】タイトル」節として追記（同じ記事の節は置き換え。タイトル・動画ID・元URLで判定）
//   2. knowledge_revisions に変更履歴を残す
//   3. champion_notes に構造化メモとして登録（同じ記事の分は入れ替え）
//   4. 記事に INTEGRATED_TAG を足し（既存タグは残す）、review_status を approved にする
//
// タグの意味:
// - __DELETED__   … 旧ポータルで「削除」または「統合」したもの（旧実装はタグを丸ごと置き換えていたため両者を区別できない）
// - __INTEGRATED__ … 05で辞典へ統合したもの。ライブラリには残し、定期統合の対象からは外す。
//   印が無いと3時間おきの定期統合が同じ記事を毎回統合し直し、メンテ画面で直した【記事】節を元に戻してしまう（2026-10-04 発見）。
//
// 旧実装から変えた点:
// - offset でページ送りしていたが、統合した記事が検索対象から外れると
//   次のページの開始位置がずれ、未処理の記事を飛ばしていた。id の昇順で進める方式にした。
// - 承認状態(review_status)を見ずに統合していた。呼び出し側で対象を選ぶ前提にし、統合した記事は approved にする。
// - Gemini を使う「項目マージ」と「矛盾チェック」は移していない（Geminiの利用枠を使うため）。
// - 本文は要約(content)を優先する。旧実装は raw_content を優先していたが、動画解析の記事では raw_content が
//   字幕の生テキストか「映像直接解析による自動抽出 (ID: …)」という仮の1行で、辞典に要約ではなくそれが
//   載っていた（2026-10-05 発見: 33体の辞典に仮の1行だけの節があった）。

export interface IntegrateArticle {
  id: number;
  title: string | null;
  content: string | null;
  raw_content: string | null;
  champion: string | null;
  tags?: string[] | null;
  source_url?: string | null;
}

export const INTEGRATED_TAG = '__INTEGRATED__';

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

function extractYoutubeId(url: string | null | undefined): string | null {
  const m = String(url || '').match(/(?:youtu\.be\/|[?&]v=)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * 統合戦術マスター教本(strategy)に【記事】節を追加、または同じ記事の節を置き換える。
 *
 * 同じ記事かどうかは「見出しのタイトル」だけでなく「動画ID／元URL」でも判定する。
 * 2026-10-04: タイトルだけで判定していたため、英語名→日本語名の翻訳でタイトルが変わった記事が別の節として
 * 二重に追記されていた（19体・20節）。また置き換え範囲を「最初の --- まで」にしていたため本文途中で止まり、
 * 新旧の本文が1つの節に同居していた。節は「次の【記事】見出し」で区切る。
 */
export function upsertArticleSection(strategy: string, title: string, body: string, sourceUrl?: string | null): string {
  const header = `## 【記事】${title}`;
  const section = `${header}\n\n${body}`;
  if (!strategy.trim()) return section;

  const vid = extractYoutubeId(sourceUrl);
  const url = String(sourceUrl || '').trim();
  const isSameArticle = (p: string) => p.startsWith('## 【記事】') && (
    p.split('\n', 1)[0].trim() === header ||
    (!!vid && p.includes(vid)) ||
    (!vid && url.length > 0 && p.includes(url))
  );

  const parts = strategy.split(/\n(?=## 【記事】)/);
  const idx = parts.findIndex(isSameArticle);
  if (idx === -1) return `${strategy}\n\n---\n\n${section}`;

  const trailing = parts[idx].match(/\n\n---\n?$/)?.[0] || '';
  parts[idx] = section + trailing;
  // 同じ記事の節がほかにも残っていれば落とす
  return parts.filter((p, i) => i <= idx || !isSameArticle(p)).join('\n');
}

export async function integrateArticles(sb: SupabaseClient, articles: IntegrateArticle[]): Promise<IntegrateResult> {
  const result: IntegrateResult = { integrated: [], skippedNoChampion: [], errors: [], champions: [] };

  const resolved: { a: IntegrateArticle; champions: string[]; body: string; title: string; sourceUrl: string | null }[] = [];
  for (const a of articles) {
    const champions = await resolveChampions(a.champion);
    if (champions.length === 0) { result.skippedNoChampion.push(a.id); continue; }
    resolved.push({ a, champions, title: a.title || '(無題)', body: a.content || a.raw_content || '', sourceUrl: a.source_url || null });
  }

  // チャンピオン単位でまとめて1回だけ読み書きする
  const byChampion = new Map<string, { title: string; body: string; sourceUrl: string | null }[]>();
  for (const r of resolved) {
    for (const c of r.champions) {
      byChampion.set(c, [...(byChampion.get(c) || []), { title: r.title, body: r.body, sourceUrl: r.sourceUrl }]);
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
      for (const { title, body, sourceUrl } of items) {
        strategy = upsertArticleSection(strategy, title, body, sourceUrl);
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

      const tags = Array.isArray(r.a.tags) ? r.a.tags : [];
      const { error: tagErr } = await sb
        .from('personal_knowledge')
        .update({ review_status: 'approved', tags: tags.includes(INTEGRATED_TAG) ? tags : [...tags, INTEGRATED_TAG] })
        .eq('id', r.a.id);
      if (tagErr) throw new Error(`personal_knowledge: ${tagErr.message}`);
      result.integrated.push(r.a.id);
    } catch (e: any) {
      if (result.errors.length < 5) result.errors.push(`記事${r.a.id}: ${e?.message || e}`);
    }
  }

  return result;
}
