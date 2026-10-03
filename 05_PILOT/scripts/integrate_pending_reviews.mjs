import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// .env.local をパース
const envText = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key not found in .env.local');
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

// DDragon 173体辞書をロード
const summaryData = JSON.parse(fs.readFileSync('src/data/champions_summary.json', 'utf-8'));
const champLookup = new Map();
for (const c of summaryData) {
  champLookup.set(c.id.toLowerCase(), c.id);
  champLookup.set(c.jpName.toLowerCase(), c.id);
  champLookup.set(c.name.toLowerCase(), c.id);
}
// エイリアス
champLookup.set('wukong', 'MonkeyKing');
champLookup.set('j4', 'JarvanIV');
champLookup.set('jarvan iv', 'JarvanIV');
champLookup.set('jarvaniv', 'JarvanIV');
champLookup.set('lee sin', 'LeeSin');
champLookup.set('leesin', 'LeeSin');
champLookup.set('master yi', 'MasterYi');
champLookup.set('masteryi', 'MasterYi');
champLookup.set('tf', 'TwistedFate');
champLookup.set('twisted fate', 'TwistedFate');
champLookup.set('mf', 'MissFortune');
champLookup.set('miss fortune', 'MissFortune');

function resolveChampId(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (['unknown', 'general', 'null', 'none'].includes(s)) return null;
  return champLookup.get(s) || null;
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function recordRevision(key, field, before, after, sourceTitle) {
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
    console.warn('⚠️ 履歴保存スキップ:', e?.message || e);
  }
}

async function run() {
  console.log('🚀 [Review Integrate] 承認待ち記事の全件取得中...');

  const { data: pendingRows, error } = await sb
    .from('personal_knowledge')
    .select('id, title, content, raw_content, champion, tags')
    .eq('review_status', 'pending')
    .order('id', { ascending: true });

  if (error) {
    console.error('❌ 取得失敗:', error);
    process.exit(1);
  }

  const total = pendingRows?.length || 0;
  console.log(`📋 承認待ち総件数: ${total} 件`);

  if (total === 0) {
    console.log('✅ 承認待ちの記事はありません。');
    return;
  }

  // 1. チャンピオン紐付き記事とUnknown記事を分離
  const champArticles = [];
  const generalArticles = [];

  for (const r of pendingRows) {
    const cid = resolveChampId(r.champion);
    if (cid) {
      champArticles.push({ ...r, resolvedChamp: cid });
    } else {
      generalArticles.push(r);
    }
  }

  console.log(`🎯 チャンピオン紐付き記事: ${champArticles.length} 件`);
  console.log(`🌐 レーン一般論・マクロ記事: ${generalArticles.length} 件`);

  // 2. チャンピオン紐付き記事をチャンピオンごとにグループ化
  const byChampion = new Map();
  for (const r of champArticles) {
    const c = r.resolvedChamp;
    const items = byChampion.get(c) || [];
    items.push({
      id: r.id,
      title: r.title || '(無題)',
      body: r.raw_content || r.content || '',
      champion: c,
    });
    byChampion.set(c, items);
  }

  console.log(`🏆 統合対象チャンピオン数: ${byChampion.size} 体`);

  let integratedCount = 0;
  const failedChamps = new Set();

  for (const [champion, items] of byChampion.entries()) {
    try {
      const matchupId = `champ_${champion}_global`;
      const { data: existing, error: selErr } = await sb
        .from('matchup_sentinel')
        .select('strategy, raw_data')
        .eq('matchup_id', matchupId)
        .maybeSingle();

      if (selErr) throw selErr;

      let strategy = existing?.strategy || '';

      for (const item of items) {
        const header = `## 【記事】${item.title}`;
        if (!strategy.trim()) {
          strategy = `${header}\n\n${item.body}`;
        } else if (strategy.includes(header)) {
          const pattern = new RegExp(`## 【記事】${escapeRegExp(item.title)}\\s*\\n[\\s\\S]*?(?=\\n---|$)`);
          strategy = strategy.replace(pattern, () => `${header}\n\n${item.body}`);
        } else {
          strategy = `${strategy}\n\n---\n\n${header}\n\n${item.body}`;
        }
      }

      // matchup_sentinel へ upsert
      const { error: upErr } = await sb.from('matchup_sentinel').upsert({
        matchup_id: matchupId,
        champion,
        enemy: 'GLOBAL',
        strategy,
        raw_data: { ...(existing?.raw_data || {}), source: 'champ_db', role: 'GLOBAL' },
        created_at: new Date().toISOString(),
      }, { onConflict: 'matchup_id' });

      if (upErr) throw upErr;

      await recordRevision(
        matchupId,
        'strategy',
        existing ? existing.strategy || '' : null,
        strategy,
        `攻略ライブラリから承認統合（${items.length}件の記事）`
      );

      // champion_notes への登録 ＆ personal_knowledge の review_status: approved 更新（tagsは破壊しない）
      for (const item of items) {
        try {
          await sb.from('champion_notes').delete().eq('source_article_id', item.id);
          await sb.from('champion_notes').insert({
            champion,
            title: item.title,
            body: item.body,
            source: 'article',
            source_article_id: item.id,
          });

          const { error: tagErr } = await sb
            .from('personal_knowledge')
            .update({ review_status: 'approved' })
            .eq('id', item.id);

          if (tagErr) throw tagErr;
          integratedCount++;
        } catch (itemErr) {
          console.warn(`⚠️ 記事ID ${item.id} のステータス更新失敗:`, itemErr?.message || itemErr);
        }
      }

      console.log(`  ✓ [${champion}] ${items.length} 件統合完了`);
    } catch (champErr) {
      failedChamps.add(champion);
      console.error(`  ✕ [${champion}] 統合失敗:`, champErr?.message || champErr);
    }
  }

  // 3. レーン一般論記事を approved へ一括昇格
  let generalApprovedCount = 0;
  if (generalArticles.length > 0) {
    console.log(`\n⏳ レーン一般論記事 ${generalArticles.length} 件を承認済みに更新中...`);
    const generalIds = generalArticles.map(r => r.id);
    for (let i = 0; i < generalIds.length; i += 50) {
      const chunk = generalIds.slice(i, i + 50);
      const { error: genErr } = await sb
        .from('personal_knowledge')
        .update({ review_status: 'approved' })
        .in('id', chunk);

      if (genErr) {
        console.error(`  ✕ 一般論更新エラー (chunk ${i}):`, genErr);
      } else {
        generalApprovedCount += chunk.length;
      }
    }
    console.log(`  ✓ レーン一般論承認成功: ${generalApprovedCount} 件`);
  }

  console.log('\n========================================');
  console.log(`🎉 【全処理完了】`);
  console.log(`・チャンピオン辞典統合成功: ${integratedCount} 件`);
  console.log(`・統合先チャンピオン: ${byChampion.size - failedChamps.size} 体`);
  console.log(`・レーン一般論承認成功: ${generalApprovedCount} 件`);
  console.log(`・合計承認数: ${integratedCount + generalApprovedCount} / ${total} 件`);
  if (failedChamps.size > 0) {
    console.log(`・失敗チャンピオン: ${Array.from(failedChamps).join(', ')}`);
  }
  console.log('========================================\n');
}

run().catch(console.error);
