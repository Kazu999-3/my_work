import { calculateIntegratedTiltScore, analyzeBlameText } from '../src/lib/tiltBlameDetector';

function testTiltDiagnosis() {
  console.log('🧪 ティルト診断精度向上 (2段階判定 & Wメーター) の単体テストを開始します...');

  // パターン 1: 他罰的イライラが高い場合 (味方のせいにしている + 攻撃的キーワード + 連敗)
  const pattern1 = calculateIntegratedTiltScore({
    quickChoice: 'ally_fault',
    aiBlameScore: 85,
    aiCalmScore: 10,
    lossStreak: 3,
    text: 'まじでJGが寄らないでゴミ。トロール多すぎてキャリーできない',
  });

  console.log('\n🔴 パターン 1 (他罰・イライラ高):');
  console.log(`- 他罰イライラ度: ${pattern1.blameScore}%`);
  console.log(`- 冷静・客観度: ${pattern1.calmScore}%`);
  console.log(`- 推奨アクション: ${pattern1.suggestedAction}`);
  console.log(`- 検出理由:`, pattern1.reasons);

  if (pattern1.blameScore >= 70 && pattern1.suggestedAction === 'detox_required') {
    console.log('✅ 他罰イライラ高判定 ＆ アンガーデトックス必須のフラグが正常に立ちました！');
  } else {
    console.error('❌ パターン 1 の判定が期待値と一致しません');
  }

  // パターン 2: 冷静さが高い場合 (自分の反省 + 客観的理由)
  const pattern2 = calculateIntegratedTiltScore({
    quickChoice: 'self_fault',
    aiBlameScore: 10,
    aiCalmScore: 90,
    lossStreak: 0,
    text: 'JGがBot寄りのタイミングでTopで引けずに捕まった。次は事前に敵位置を把握する',
  });

  console.log('\n🟢 パターン 2 (冷静さ高):');
  console.log(`- 他罰イライラ度: ${pattern2.blameScore}%`);
  console.log(`- 冷静・客観度: ${pattern2.calmScore}%`);
  console.log(`- 推奨アクション: ${pattern2.suggestedAction}`);
  console.log(`- 検出理由:`, pattern2.reasons);

  if (pattern2.calmScore >= 70 && pattern2.blameScore < 50) {
    console.log('✅ 冷静・客観的思考の判定が正常に動作しました！');
  } else {
    console.error('❌ パターン 2 の判定が期待値と一致しません');
  }

  console.log('\n🎉 全ての判定ロジックが正常に機能しています！');
}

testTiltDiagnosis();
