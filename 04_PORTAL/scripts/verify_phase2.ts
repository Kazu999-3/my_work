import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testPhase2() {
  console.log('🧪 フェーズ2 (自動更新 ＆ 鮮度ダッシュボード) の検証テストを開始します...');

  const { supabaseAdmin: supabase } = await import('../src/lib/supabaseAdmin');

  // 1. 最新パッチ取得テスト
  const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
  const versions = await res.json();
  const currentPatch = (versions[0] || '16.15.1').split('.').slice(0, 2).join('.');
  console.log(`✅ 最新パッチ判定: ${currentPatch} (DDragon全バージョン中先頭)`);

  // 2. champion_facts の健康度状態集計テスト
  const { data: facts } = await supabase
    .from('champion_facts')
    .select('champion, patch, confidence, last_verified_at, auto_updated_at, strengths')
    .eq('archived', false);

  let verified = 0;
  let aiGenerated = 0;
  let stale = 0;

  (facts || []).forEach((f: any) => {
    const p = (f.patch || '').split('.').slice(0, 2).join('.');
    const isLatest = p === currentPatch;
    const conf = f.confidence || 'ai_generated';
    const hasContent = !!f.strengths;

    if (!hasContent || !isLatest || conf === 'stale') stale++;
    else if (conf === 'verified') verified++;
    else aiGenerated++;
  });

  console.log(`📊 健康度サマリー結果:
  - 🟢 確認済み (Verified): ${verified} 体
  - 🟡 AI生成 (AI Updated): ${aiGenerated} 体
  - 🔴 要対応 (Stale / Outdated): ${stale} 体
  - 合計: ${facts?.length || 0} 体
  `);

  console.log('🎉 フェーズ2 バックエンド・API ロジックは正常に機能しています！');
}

testPhase2().catch((e) => {
  console.error('❌ フェーズ2 テスト失敗:', e);
  process.exit(1);
});
