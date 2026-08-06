import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SPECIAL_ENEMY = new Set(['PROCESS_INTERROGATION', 'SYSTEM', 'LIVE', 'PROCESS']);

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

async function run() {
  console.log('🚀 SSOT 一括データ移行スクリプトを開始します...');

  // 動的インポートにより環境変数ロード後にモジュール評価を行わせる
  const { supabaseAdmin: supabase } = await import('../src/lib/supabaseAdmin');
  const { resolveToRosterChampion } = await import('../src/lib/dictFactCheck');

  if (!supabase) {
    console.error('❌ SupabaseAdmin の初期化に失敗しました。環境変数を確認してください。');
    process.exit(1);
  }

  const { data: rows, error } = await supabase.from('matchup_sentinel').select('*');
  if (error) {
    console.error('❌ matchup_sentinel 取得エラー:', error);
    process.exit(1);
  }

  console.log(`📦 読み込み完了: matchup_sentinel 全 ${rows?.length || 0} 件`);

  const FACT_CONTENT_KEYS = ['strengths', 'weaknesses', 'power_spikes', 'build_runes', 'full_clear_time', 'counter_champions', 'must_ban_champions', 'pick_recommendation', 'note_draft', 'jg_type'];
  const hasFactContent = (f: any) => FACT_CONTENT_KEYS.some((k) => f[k] !== null && f[k] !== undefined && String(f[k]).trim() !== '');

  const facts: any[] = [];
  const notesByChampion = new Map<string, any[]>();
  let skippedEmptyFacts = 0;

  for (const row of (rows || [])) {
    const rawEnemy = row.enemy;
    if (rawEnemy && SPECIAL_ENEMY.has(rawEnemy)) continue;

    const champion = await resolveToRosterChampion(row.champion);
    if (!champion) continue;

    const isGlobal = rawEnemy === 'GLOBAL' || (row.matchup_id || '').includes('GLOBAL');
    const enemy = isGlobal ? null : (rawEnemy ? await resolveToRosterChampion(rawEnemy) : null);
    const rd = row.raw_data || {};

    if (isGlobal) {
      const jg = rd.jg_style || {};
      const fact: Record<string, any> = {
        champion,
        strengths: rd.strengths || null,
        weaknesses: rd.weaknesses || null,
        power_spikes: rd.powerSpikes || null,
        build_runes: rd.buildRunes || null,
        full_clear_time: rd.fullClearTime || null,
        strategy: null,
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
        custom_fields: rd.customFields || {},
        patch_meta: rd.patch_meta || null,
        pro_builds: rd.pro_builds || [],
        confidence: 'ai_generated',
        auto_updated_at: new Date().toISOString(),
        source_summary: `SSOTデータ移行スクリプト (${new Date().toISOString().slice(0, 10)})`,
        migrated_from_sentinel: true,
      };

      if (hasFactContent(fact)) facts.push(fact);
      else skippedEmptyFacts++;

      const list = notesByChampion.get(champion) || [];
      for (const a of splitArticles(row.strategy || '')) {
        list.push({ champion, enemy: null, title: a.title, body: a.body, source: 'article', patch: rd.patch_meta?.patch || null });
      }
      if (!(row.strategy || '').includes('## 【記事】') && (row.strategy || '').trim()) {
        list.push({ champion, enemy: null, title: '立ち回り', body: row.strategy.trim(), source: 'manual', patch: rd.patch_meta?.patch || null });
      }
      const cf = rd.customFields || {};
      for (const [key, val] of Object.entries(cf)) {
        if (typeof val === 'string' && val.trim()) {
          list.push({ champion, enemy: null, title: key, body: (val as string).trim(), source: 'custom_field', patch: rd.patch_meta?.patch || null });
        }
      }
      notesByChampion.set(champion, list);
    } else if (enemy) {
      const body = (row.strategy || '').trim();
      if (body) {
        const list = notesByChampion.get(champion) || [];
        list.push({ champion, enemy, title: row.title || `vs ${enemy}`, body, source: 'matchup', patch: rd.patch_meta?.patch || null });
        notesByChampion.set(champion, list);
      }
    }
  }

  console.log(`💡 抽出完了: champion_facts 対象 ${facts.length} 件 (空スキップ ${skippedEmptyFacts} 件)`);

  if (facts.length > 0) {
    const { data: existingFacts } = await supabase
      .from('champion_facts')
      .select('champion, confidence, last_verified_at, last_verified_by')
      .in('champion', facts.map((f) => f.champion));
    const existingMap = new Map<string, { confidence?: string; last_verified_at?: string; last_verified_by?: string }>((existingFacts || []).map((e: any) => [e.champion, e]));

    for (let i = 0; i < facts.length; i += 100) {
      const chunk = facts.slice(i, i + 100).map((f) => {
        const existing = existingMap.get(f.champion);
        return {
          ...f,
          updated_at: new Date().toISOString(),
          confidence: existing?.confidence === 'verified' ? 'verified' : f.confidence,
          last_verified_at: existing?.last_verified_at || null,
          last_verified_by: existing?.last_verified_by || null,
        };
      });
      const { error: fErr } = await supabase.from('champion_facts').upsert(chunk, { onConflict: 'champion' });
      if (fErr) {
        console.error('❌ champion_facts upsert 失敗:', fErr);
        process.exit(1);
      }
    }
    console.log('✅ champion_facts (SSOT) への書き込みが正常に完了しました！');
  }

  const champions = Array.from(notesByChampion.keys());
  const allNotes = Array.from(notesByChampion.values()).flat();
  if (champions.length > 0) {
    const { error: rebuildErr } = await supabase.rpc('rebuild_champion_notes_batch', {
      p_champions: champions,
      p_notes: allNotes,
    });
    if (rebuildErr) {
      console.error('❌ champion_notes 再構築失敗:', rebuildErr);
    } else {
      console.log(`✅ champion_notes 再構築完了: ${champions.length} チャンピオン, 計 ${allNotes.length} 件のノート`);
    }
  }

  console.log('\n🎉 フェーズ1 データ移行処理がすべて成功しました！');
}

run().catch((e) => {
  console.error('❌ 実行時例外:', e);
  process.exit(1);
});
