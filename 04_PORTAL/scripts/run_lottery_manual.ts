import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function main() {
  console.log('🎟️ 週末メガ宝くじ 抽選を実行中...');
  try {
    const { executeLotteryDraw } = await import('../src/lib/lotteryEngine');
    const result = await executeLotteryDraw();
    console.log('✅ 抽選完了結果:');
    console.log(JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.error('❌ 抽選実行エラー:', e);
    process.exit(1);
  }
}

main();
