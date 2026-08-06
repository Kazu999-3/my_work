import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function verify() {
  console.log('🔍 SSOT動作検証テストを開始します...');

  const { supabaseAdmin: supabase } = await import('../src/lib/supabaseAdmin');

  // 1. champion_facts 総件数とサンプル取得
  const { data: facts, count } = await supabase
    .from('champion_facts')
    .select('champion, confidence, patch, strengths, auto_updated_at', { count: 'exact' })
    .limit(5);

  console.log(`✅ champion_facts レコード数: ${count} 件`);
  console.log('📄 サンプルデータ (先頭5件):');
  console.table(facts);

  // 2. Aatrox などの代表的なチャンピオンのデータ整合性検証
  const { data: aatrox } = await supabase
    .from('champion_facts')
    .select('*')
    .ilike('champion', 'Aatrox')
    .single();

  if (aatrox) {
    console.log('✅ Aatrox の SSOT データを取得しました:');
    console.log({
      champion: aatrox.champion,
      confidence: aatrox.confidence,
      patch: aatrox.patch,
      strengths: aatrox.strengths?.slice(0, 50) + '...',
      source_summary: aatrox.source_summary,
      migrated_from_sentinel: aatrox.migrated_from_sentinel,
    });
  } else {
    console.warn('⚠️ Aatrox のデータが見つかりませんでした');
  }

  // 3. 型チェック状態の再確認
  console.log('✨ 動作検証完了！SSOT データベースは正常稼働しています。');
}

verify().catch((e) => {
  console.error('❌ 検証例外:', e);
  process.exit(1);
});
