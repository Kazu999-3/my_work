/**
 * 🛡️ Sovereign OS スクリプト安全実行ヘルパー (safe_runner.mjs)
 *
 * あすらぼ氏の「Flavor物理分離・誤爆防止」思想に基づく、全運用スクリプト共通の安全防壁。
 * - 引数に `--execute` が明示されない限り、デフォルトで【Dry-Run (読み取り・試算のみ)】で動作
 * - 実行モード（Dry-Run vs 本番実行）を視覚的に明示
 * - 本番実行時は3秒の猶予カウントダウンまたは確認バナーを表示
 */

export function parseRunMode(args = process.argv.slice(2)) {
  const isExecute = args.includes('--execute');
  const isDryRun = !isExecute;

  return {
    isExecute,
    isDryRun,
    printBanner: (scriptName) => {
      console.log('='.repeat(60));
      console.log(`🛡️  Sovereign OS Script Runner: [${scriptName}]`);
      if (isDryRun) {
        console.log('Mode: 🧪 DRY-RUN (シミュレーション / 変更は書き込まれません)');
        console.log('Hint: 本番適用するには `--execute` フラグを付与して再実行してください。');
      } else {
        console.log('Mode: 🔥 LIVE EXECUTION (本番実行 / DB・データを実際に更新します)');
      }
      console.log('='.repeat(60));
    },
  };
}
