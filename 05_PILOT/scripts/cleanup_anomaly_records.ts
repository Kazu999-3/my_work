import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// .env.local をロード
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !serviceKey) {
  console.error('[ERROR] Supabase URL または Key が環境変数から取得できません。');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  const isExecute = process.argv.includes('--execute');
  console.log(`=== 異常行クリーンアップ (${isExecute ? '本番実行モード' : 'ドライラン/確認モード'}) ===\n`);

  // 1. 検出フェーズ
  console.log('--- 1. 現状の対象レコードスキャン ---');
  
  // champion_facts
  const factsRes = await supabase
    .from('champion_facts')
    .select('champion, patch, confidence, updated_at')
    .in('champion', ['template', 'Lee Sin', 'LeeSin', 'ヴァイ', 'Vi', "Cho'Gath", 'Chogath']);
  console.log(`[champion_facts] 検出: ${factsRes.data?.length || 0} 件`);
  for (const r of factsRes.data || []) {
    console.log(`  - champion: "${r.champion}", patch: "${r.patch}", updated: "${r.updated_at}"`);
  }

  // matchup_sentinel (champion)
  const sentinelChampRes = await supabase
    .from('matchup_sentinel')
    .select('matchup_id, champion, enemy, strategy')
    .in('champion', ['template', 'Lee Sin', 'ヴァイ', "Cho'Gath"]);
  console.log(`\n[matchup_sentinel (champion)] 検出: ${sentinelChampRes.data?.length || 0} 件`);
  for (const r of sentinelChampRes.data || []) {
    console.log(`  - matchup_id: "${r.matchup_id}", champion: "${r.champion}", enemy: "${r.enemy}"`);
  }

  // matchup_sentinel (enemy)
  const sentinelEnemyRes = await supabase
    .from('matchup_sentinel')
    .select('matchup_id, champion, enemy')
    .in('enemy', ['template', 'Lee Sin', 'ヴァイ', "Cho'Gath"]);
  console.log(`\n[matchup_sentinel (enemy)] 検出: ${sentinelEnemyRes.data?.length || 0} 件`);
  for (const r of sentinelEnemyRes.data || []) {
    console.log(`  - matchup_id: "${r.matchup_id}", champion: "${r.champion}", enemy: "${r.enemy}"`);
  }

  // personal_knowledge
  const pkRes = await supabase
    .from('personal_knowledge')
    .select('id, champion, title')
    .in('champion', ['template', 'Lee Sin', 'ヴァイ', "Cho'Gath"]);
  console.log(`\n[personal_knowledge] 検出: ${pkRes.data?.length || 0} 件`);
  for (const r of pkRes.data || []) {
    console.log(`  - id: "${r.id}", champion: "${r.champion}", title: "${r.title}"`);
  }

  if (!isExecute) {
    console.log('\n※ ドライラン完了。DBへの変更は行われていません。');
    console.log('※ 実際に実行するには `--execute` オプションを付けて実行してください。');
    return;
  }

  // 2. 実行フェーズ
  console.log('\n--- 2. クリーンアップ処理実行 ---');

  // A. 'template' の削除
  console.log('\n[A] template の削除処理:');
  const delFactsTemplate = await supabase.from('champion_facts').delete().eq('champion', 'template');
  console.log(`  ✓ champion_facts から template 削除: ${delFactsTemplate.error ? delFactsTemplate.error.message : '成功'}`);

  const delSentinelTemplate = await supabase.from('matchup_sentinel').delete().or('champion.eq.template,enemy.eq.template');
  console.log(`  ✓ matchup_sentinel から template 削除: ${delSentinelTemplate.error ? delSentinelTemplate.error.message : '成功'}`);

  const delPkTemplate = await supabase.from('personal_knowledge').delete().eq('champion', 'template');
  console.log(`  ✓ personal_knowledge から template 削除: ${delPkTemplate.error ? delPkTemplate.error.message : '成功'}`);

  // B. 'Lee Sin' の LeeSin への統合と削除
  console.log('\n[B] Lee Sin -> LeeSin のマージ＆削除処理:');
  // champion_facts
  const leeSinFact = (factsRes.data || []).find((r: any) => r.champion === 'Lee Sin');
  const leeSinCanonFact = (factsRes.data || []).find((r: any) => r.champion === 'LeeSin');
  if (leeSinFact && !leeSinCanonFact) {
    // LeeSin が無ければ Lee Sin を LeeSin にリネーム
    const renLee = await supabase.from('champion_facts').update({ champion: 'LeeSin' }).eq('champion', 'Lee Sin');
    console.log(`  ✓ champion_facts: Lee Sin を LeeSin に更新: ${renLee.error ? renLee.error.message : '成功'}`);
  } else if (leeSinFact && leeSinCanonFact) {
    // 両方ある場合は Lee Sin 側を削除（LeeSin が既に正本として存在）
    const delLee = await supabase.from('champion_facts').delete().eq('champion', 'Lee Sin');
    console.log(`  ✓ champion_facts: 重複する Lee Sin 行を削除: ${delLee.error ? delLee.error.message : '成功'}`);
  }

  // matchup_sentinel (champion)
  for (const s of sentinelChampRes.data || []) {
    if (s.champion === 'Lee Sin') {
      const newMatchupId = s.matchup_id.replace('Lee Sin', 'LeeSin');
      // 既に newMatchupId があるか確認
      const { data: exist } = await supabase.from('matchup_sentinel').select('matchup_id').eq('matchup_id', newMatchupId).maybeSingle();
      if (exist) {
        await supabase.from('matchup_sentinel').delete().eq('matchup_id', s.matchup_id);
      } else {
        await supabase.from('matchup_sentinel').update({ champion: 'LeeSin', matchup_id: newMatchupId }).eq('matchup_id', s.matchup_id);
      }
    }
  }
  // matchup_sentinel (enemy)
  for (const s of sentinelEnemyRes.data || []) {
    if (s.enemy === 'Lee Sin') {
      const newMatchupId = s.matchup_id.replace('Lee Sin', 'LeeSin');
      const { data: exist } = await supabase.from('matchup_sentinel').select('matchup_id').eq('matchup_id', newMatchupId).maybeSingle();
      if (exist) {
        await supabase.from('matchup_sentinel').delete().eq('matchup_id', s.matchup_id);
      } else {
        await supabase.from('matchup_sentinel').update({ enemy: 'LeeSin', matchup_id: newMatchupId }).eq('matchup_id', s.matchup_id);
      }
    }
  }
  console.log('  ✓ matchup_sentinel: Lee Sin のマージ・付け替え完了');

  // personal_knowledge
  const upPkLee = await supabase.from('personal_knowledge').update({ champion: 'LeeSin' }).eq('champion', 'Lee Sin');
  console.log(`  ✓ personal_knowledge: Lee Sin を LeeSin に更新: ${upPkLee.error ? upPkLee.error.message : '成功'}`);

  // C. 'ヴァイ' の Vi への統合と削除
  console.log('\n[C] ヴァイ -> Vi のマージ＆削除処理:');
  const viFact = (factsRes.data || []).find((r: any) => r.champion === 'ヴァイ');
  const viCanonFact = (factsRes.data || []).find((r: any) => r.champion === 'Vi');
  if (viFact && !viCanonFact) {
    const renVi = await supabase.from('champion_facts').update({ champion: 'Vi' }).eq('champion', 'ヴァイ');
    console.log(`  ✓ champion_facts: ヴァイ を Vi に更新: ${renVi.error ? renVi.error.message : '成功'}`);
  } else if (viFact && viCanonFact) {
    const delVi = await supabase.from('champion_facts').delete().eq('champion', 'ヴァイ');
    console.log(`  ✓ champion_facts: 重複する ヴァイ 行を削除: ${delVi.error ? delVi.error.message : '成功'}`);
  }

  // matchup_sentinel (champion)
  for (const s of sentinelChampRes.data || []) {
    if (s.champion === 'ヴァイ') {
      const newMatchupId = s.matchup_id.replace('ヴァイ', 'Vi');
      const { data: exist } = await supabase.from('matchup_sentinel').select('matchup_id').eq('matchup_id', newMatchupId).maybeSingle();
      if (exist) {
        await supabase.from('matchup_sentinel').delete().eq('matchup_id', s.matchup_id);
      } else {
        await supabase.from('matchup_sentinel').update({ champion: 'Vi', matchup_id: newMatchupId }).eq('matchup_id', s.matchup_id);
      }
    }
  }
  // matchup_sentinel (enemy)
  for (const s of sentinelEnemyRes.data || []) {
    if (s.enemy === 'ヴァイ') {
      const newMatchupId = s.matchup_id.replace('ヴァイ', 'Vi');
      const { data: exist } = await supabase.from('matchup_sentinel').select('matchup_id').eq('matchup_id', newMatchupId).maybeSingle();
      if (exist) {
        await supabase.from('matchup_sentinel').delete().eq('matchup_id', s.matchup_id);
      } else {
        await supabase.from('matchup_sentinel').update({ enemy: 'Vi', matchup_id: newMatchupId }).eq('matchup_id', s.matchup_id);
      }
    }
  }
  console.log('  ✓ matchup_sentinel: ヴァイ のマージ・付け替え完了');

  // personal_knowledge
  const upPkVi = await supabase.from('personal_knowledge').update({ champion: 'Vi' }).eq('champion', 'ヴァイ');
  console.log(`  ✓ personal_knowledge: ヴァイ を Vi に更新: ${upPkVi.error ? upPkVi.error.message : '成功'}`);

  // D. "Cho'Gath" の Chogath への統合と削除
  console.log(`\n[D] Cho'Gath -> Chogath のマージ＆削除処理:`);
  const choFact = (factsRes.data || []).find((r: any) => r.champion === "Cho'Gath");
  const choCanonFact = (factsRes.data || []).find((r: any) => r.champion === 'Chogath');
  if (choFact && !choCanonFact) {
    const renCho = await supabase.from('champion_facts').update({ champion: 'Chogath' }).eq('champion', "Cho'Gath");
    console.log(`  ✓ champion_facts: Cho'Gath を Chogath に更新: ${renCho.error ? renCho.error.message : '成功'}`);
  } else if (choFact && choCanonFact) {
    const delCho = await supabase.from('champion_facts').delete().eq('champion', "Cho'Gath");
    console.log(`  ✓ champion_facts: 重複する Cho'Gath 行を削除: ${delCho.error ? delCho.error.message : '成功'}`);
  }

  // matchup_sentinel (champion)
  for (const s of sentinelChampRes.data || []) {
    if (s.champion === "Cho'Gath") {
      const newMatchupId = s.matchup_id.replace("Cho'Gath", 'Chogath');
      const { data: exist } = await supabase.from('matchup_sentinel').select('matchup_id, strategy').eq('matchup_id', newMatchupId).maybeSingle();
      if (exist) {
        // strategy の追記マージ確認
        if (s.strategy && exist.strategy && !exist.strategy.includes(s.strategy.trim())) {
          const mergedStrategy = `${exist.strategy.trim()}\n\n---\n\n${s.strategy.trim()}\n`;
          await supabase.from('matchup_sentinel').update({ strategy: mergedStrategy }).eq('matchup_id', newMatchupId);
          console.log(`  ✓ matchup_sentinel: ${s.matchup_id} の strategy を ${newMatchupId} へ追記マージしました`);
        }
        const delRes = await supabase.from('matchup_sentinel').delete().eq('matchup_id', s.matchup_id);
        console.log(`  ✓ matchup_sentinel: 旧行 ${s.matchup_id} を削除: ${delRes.error ? delRes.error.message : '成功'}`);
      } else {
        const upRes = await supabase.from('matchup_sentinel').update({ champion: 'Chogath', matchup_id: newMatchupId }).eq('matchup_id', s.matchup_id);
        console.log(`  ✓ matchup_sentinel: ${s.matchup_id} を ${newMatchupId} (Chogath) に更新: ${upRes.error ? upRes.error.message : '成功'}`);
      }
    }
  }

  // matchup_sentinel (enemy)
  for (const s of sentinelEnemyRes.data || []) {
    if (s.enemy === "Cho'Gath") {
      const newMatchupId = s.matchup_id.replace("Cho'Gath", 'Chogath');
      const { data: exist } = await supabase.from('matchup_sentinel').select('matchup_id').eq('matchup_id', newMatchupId).maybeSingle();
      if (exist) {
        const delRes = await supabase.from('matchup_sentinel').delete().eq('matchup_id', s.matchup_id);
        console.log(`  ✓ matchup_sentinel: 敵側の重複行 ${s.matchup_id} を削除: ${delRes.error ? delRes.error.message : '成功'}`);
      } else {
        const upRes = await supabase.from('matchup_sentinel').update({ enemy: 'Chogath', matchup_id: newMatchupId }).eq('matchup_id', s.matchup_id);
        console.log(`  ✓ matchup_sentinel: 敵側 ${s.matchup_id} を ${newMatchupId} に更新: ${upRes.error ? upRes.error.message : '成功'}`);
      }
    }
  }

  // personal_knowledge
  const upPkCho = await supabase.from('personal_knowledge').update({ champion: 'Chogath' }).eq('champion', "Cho'Gath");
  console.log(`  ✓ personal_knowledge: Cho'Gath を Chogath に更新: ${upPkCho.error ? upPkCho.error.message : '成功'}`);

  console.log('\n=== すべてのクリーンアップが正常に完了しました ===');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
