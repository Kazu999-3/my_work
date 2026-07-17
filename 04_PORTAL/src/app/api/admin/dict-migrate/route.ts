import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// ============================================================
// チャンピオン辞典 構造化バックフィル (課題#29 / 段階1)
//
// 既存 matchup_sentinel を読み、champion_facts / champion_notes へコピーする。
// 非破壊: matchup_sentinel は一切変更しない。何度でも再実行可能（対象チャンピオンの
// champion_notes を毎回作り直す）。
//
// 呼び出し（管理者ログイン状態）:
//   確認のみ:   GET /api/admin/dict-migrate?dryRun=1
//   実行:       GET /api/admin/dict-migrate
// ============================================================

export const dynamic = 'force-dynamic';

// 辞典対象として扱わない特殊 enemy / champion 値
const SPECIAL_ENEMY = new Set(['PROCESS_INTERROGATION', 'SYSTEM', 'LIVE', 'PROCESS']);
const FAKE_CHAMPIONS = new Set(['', 'Unknown', 'その他', 'SYSTEM', 'LIVE', 'GLOBAL', 'test']);

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
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: 401 });

  try {
    const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';

    // DDragonの実在チャンピオンID一覧を取得し、ゴミ/テスト名(qKUaa等)を除外する。
    // 取得に失敗した場合はフィルタせず全件処理（フォールバック）。
    let validChampions: Set<string> | null = null;
    try {
      const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
      const versions = await vRes.json();
      const cRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/en_US/champion.json`);
      const cData = await cRes.json();
      validChampions = new Set(Object.keys(cData.data || {})); // 'Heimerdinger' 等のID
    } catch (e) {
      console.warn('[dict-migrate] DDragonチャンピオン一覧の取得に失敗、フィルタなしで続行:', e);
    }

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
      const champion = row.champion;
      if (!champion || FAKE_CHAMPIONS.has(champion)) continue;
      // DDragon照合: 実在しないチャンピオン名（qKUaa等のゴミ）はスキップ
      if (validChampions && !validChampions.has(champion)) continue;
      const enemy = row.enemy;
      if (enemy && SPECIAL_ENEMY.has(enemy)) continue; // 反省ログ等はスキップ
      const rd = row.raw_data || {};
      const isGlobal = enemy === 'GLOBAL' || (row.matchup_id || '').includes('GLOBAL');

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
      } else if (enemy && !FAKE_CHAMPIONS.has(enemy)) {
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
    // notes は再実行可能にするため、対象チャンピオンぶんを一度消してから入れ直す
    const champions = Array.from(notesByChampion.keys());
    for (const champ of champions) {
      await supabase.from('champion_notes').delete().eq('champion', champ);
    }
    const allNotes = Array.from(notesByChampion.values()).flat();
    for (let i = 0; i < allNotes.length; i += 100) {
      const chunk = allNotes.slice(i, i + 100);
      const { error: nErr } = await supabase.from('champion_notes').insert(chunk);
      if (nErr) throw new Error(`champion_notes insert失敗: ${nErr.message}`);
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
