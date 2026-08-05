import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { resolveToRosterChampion } from '../../../../lib/dictFactCheck';

// ============================================================
// チャンピオン辞典 構造化バックフィル (課題#29 / 段階1)
//
// 既存 matchup_sentinel を読み、champion_facts / champion_notes へコピーする。
// 非破壊: matchup_sentinel は一切変更しない。何度でも再実行可能（対象チャンピオンの
// champion_notes を毎回作り直す）。
//
// 呼び出し（管理者ログイン状態、またはCRON_SECRET）:
//   確認のみ:   GET /api/admin/dict-migrate?dryRun=1
//   実行:       GET /api/admin/dict-migrate
//
// 2026-08-03発覚: この一括コピーは元々「課題#29 段階1」の一度きりの手動バックフィル
// として作られ、以後どこからも自動で呼ばれていなかった。一方 /api/cron/dict-review-check
// (週次の鮮度レビュー)はchampion_factsの方を見て判定するため、matchup_sentinelに
// 日々ingestされる新しい知見がchampion_factsへ一切反映されず、レビューが実際に
// 表示されている辞典内容とズレたスナップショットを見続ける状態になっていた。
// /api/cron (日次) から毎日呼び出すことで、champion_factsをmatchup_sentinelに
// 追従させ続けるようにした。
// ============================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 辞典対象として扱わない特殊 enemy 値（反省ログ等の内部用レコード）
const SPECIAL_ENEMY = new Set(['PROCESS_INTERROGATION', 'SYSTEM', 'LIVE', 'PROCESS']);

// strategy 内の「## 【記事】タイトル」区切りを個別ノートに分解する
function splitArticles(strategy: string): { title: string; body: string }[] {
  if (!strategy || !strategy.includes('## 【記事】')) return [];
  const parts = strategy.split(/\n?##\s*【記事】/).map((s) => s.trim()).filter(Boolean);
  const notes: { title: string; body: string }[] = [];
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const title = (nl >= 0 ? part.slice(0, nl) : part).trim();
    const body = (nl >= 0 ? part.slice(nl + 1) : '').replace(/^---+$/gm, '').trim();
    if (body) notes.push({ title: title || '(無題)', body });
  }
  return notes;
}

export async function GET(req: Request) {
  // ===== 管理者セッション or CRON_SECRET(日次自動同期用) =====
  const cronOk = !!process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk) {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';

    const { data: rows, error } = await supabase.from('matchup_sentinel').select('*');
    if (error) throw error;

    let notesCount = 0;
    let skippedEmptyFacts = 0;
    const facts: any[] = [];
    const notesByChampion = new Map<string, any[]>();

    // 型付き本体に中身が1つでもあるか（全部nullならゴミ/テスト行として書き込まない）
    const FACT_CONTENT_KEYS = ['strengths', 'weaknesses', 'power_spikes', 'build_runes', 'full_clear_time', 'counter_champions', 'must_ban_champions', 'pick_recommendation', 'note_draft', 'jg_type'];
    const hasFactContent = (f: any) => FACT_CONTENT_KEYS.some((k) => f[k] !== null && f[k] !== undefined && String(f[k]).trim() !== '');

    for (const row of (rows || [])) {
      const rawEnemy = row.enemy;
      if (rawEnemy && SPECIAL_ENEMY.has(rawEnemy)) continue; // 反省ログ等はスキップ
      // 「実在チャンピオンかどうか」だけを判定基準にする(resolveToRosterChampion)。
      // 以前は手作りのFAKE_CHAMPIONS除外リストとDDragon照合を併用していたが、
      // 除外リストが他の書き込み経路(knowledge/sync等)と食い違い、プレースホルダー値
      // ("Jungle"/"[YouTube]"等)が漏れて毎日のcronで入り続けるバグがあった。
      const champion = await resolveToRosterChampion(row.champion);
      if (!champion) continue;
      const isGlobal = rawEnemy === 'GLOBAL' || (row.matchup_id || '').includes('GLOBAL');
      // GLOBAL行以外の対面別メモは、enemy列も同じ基準で実在チャンピオンへ正規化する
      // （以前はFAKE_CHAMPIONSの文字列一致チェックのみで、DDragon照合が無かった）。
      const enemy = isGlobal ? null : (rawEnemy ? await resolveToRosterChampion(rawEnemy) : null);
      const rd = row.raw_data || {};

      if (isGlobal) {
        // --- 型付きの辞典本体 ---
        const jg = rd.jg_style || {};
        const fact = {
          champion,
          strengths: rd.strengths || null,
          weaknesses: rd.weaknesses || null,
          power_spikes: rd.powerSpikes || null,
          build_runes: rd.buildRunes || null,
          full_clear_time: rd.fullClearTime || null,
          strategy: null, // 立ち回りはstrategy列に記事が混在するため、下でノート分解後に本文だけ残す
          counter_champions: rd.counterChampions || null,
          must_ban_champions: rd.mustBanChampions || null,
          pick_recommendation: rd.pickRecommendation || null,
          note_draft: rd.note_draft || null,
          jg_type: jg.type || null,
          jg_description: jg.description || null,
          jg_blind_pickable: typeof jg.blind_pickable === 'number' ? jg.blind_pickable : null,
          jg_counter_pickable: typeof jg.counter_pickable === 'number' ? jg.counter_pickable : null,
          patch: rd.patch_meta?.patch || null,
          source: rd.source || 'champ_db',
        };
        // 中身が全部空のGLOBAL行（ゴミ/テストデータ）は facts に書き込まない
        if (hasFactContent(fact)) facts.push(fact);
        else skippedEmptyFacts++;

        const list = notesByChampion.get(champion) || [];
        // strategy に継ぎ足された記事を分解
        for (const a of splitArticles(row.strategy || '')) {
          list.push({ champion, enemy: null, title: a.title, body: a.body, source: 'article', patch: rd.patch_meta?.patch || null });
        }
        // strategy に記事区切りが無ければ、strategy全体を立ち回りノートとして1本
        if (!(row.strategy || '').includes('## 【記事】') && (row.strategy || '').trim()) {
          list.push({ champion, enemy: null, title: '立ち回り', body: row.strategy.trim(), source: 'manual', patch: rd.patch_meta?.patch || null });
        }
        // customFields を各ノートに
        const cf = rd.customFields || {};
        for (const [key, val] of Object.entries(cf)) {
          if (typeof val === 'string' && val.trim()) {
            list.push({ champion, enemy: null, title: key, body: (val as string).trim(), source: 'custom_field', patch: rd.patch_meta?.patch || null });
          }
        }
        notesByChampion.set(champion, list);
      } else if (enemy) {
        // --- 対面別マッチアップメモ ---
        const body = (row.strategy || '').trim();
        if (body) {
          const list = notesByChampion.get(champion) || [];
          list.push({ champion, enemy, title: row.title || `vs ${enemy}`, body, source: 'matchup', patch: rd.patch_meta?.patch || null });
          notesByChampion.set(champion, list);
        }
      }
    }

    for (const list of notesByChampion.values()) notesCount += list.length;

    if (dryRun) {
      // 中身のある実チャンピオンのサンプルを返す（マッピング検証用）
      const sampleFact = facts.find((f) => f.strengths || f.weaknesses) || facts[0] || null;
      const sampleNote = Array.from(notesByChampion.values()).flat().find((n) => n.body && n.body.length > 20) || null;
      return NextResponse.json({
        dryRun: true,
        wouldWriteFacts: facts.length,
        skippedEmptyFacts,
        wouldWriteNotes: notesCount,
        factChampionsSample: facts.slice(0, 8).map((f) => f.champion),
        sampleFact,
        sampleNote,
      });
    }

    // --- 実書き込み ---
    // facts は upsert（champion PK）
    if (facts.length > 0) {
      for (let i = 0; i < facts.length; i += 100) {
        const chunk = facts.slice(i, i + 100).map((f) => ({ ...f, updated_at: new Date().toISOString() }));
        const { error: fErr } = await supabase.from('champion_facts').upsert(chunk, { onConflict: 'champion' });
        if (fErr) throw new Error(`champion_facts upsert失敗: ${fErr.message}`);
      }
    }
    // notesは再実行可能にするため、対象チャンピオンぶんを一度消してから入れ直す。
    // 以前は削除と投入が別々のクエリ(delete→100件ずつinsert)で、投入側が途中で
    // 失敗するとそのチャンピオンのノートが削除されたまま復元されない事故があった。
    // rebuild_champion_notes_batch(RPC)でdelete+insertを1トランザクションにまとめ、
    // 失敗時は削除も含めて全体がロールバックされるようにする(migration 50)。
    const champions = Array.from(notesByChampion.keys());
    const allNotes = Array.from(notesByChampion.values()).flat();
    if (champions.length > 0) {
      const { error: rebuildErr } = await supabase.rpc('rebuild_champion_notes_batch', {
        p_champions: champions,
        p_notes: allNotes,
      });
      if (rebuildErr) throw new Error(`champion_notes再構築失敗: ${rebuildErr.message}`);
    }

    return NextResponse.json({
      success: true,
      wroteFacts: facts.length,
      skippedEmptyFacts,
      wroteNotes: notesCount,
      champions: champions.length,
    });
  } catch (err: any) {
    console.error('[dict-migrate] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
