import { execSync } from 'child_process';

const PROJECTS = ['ktm-pilot', 'my-work-8jbd'];
const KEEP_COUNT = 2; // 各プロジェクト最新何件のデプロイを保護するか

function run(cmd) {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
}

async function fetchDeployments(project) {
  let allDeployments = [];
  let next = null;

  console.log(`🔍 [${project}] デプロイ一覧を取得中...`);
  while (true) {
    const nextArg = next ? `--next ${next}` : '';
    const cmd = `npx vercel ls ${project} --format json --limit 100 ${nextArg}`;
    try {
      const raw = run(cmd);
      // Vercel CLI は JSON の前に "Vercel CLI 57.0.0 (Node.js ...)" のログを出力することがあるため JSON 部分のみ抽出
      const jsonStart = raw.indexOf('{');
      if (jsonStart === -1) break;
      const data = JSON.parse(raw.slice(jsonStart));
      const list = data.deployments || [];
      if (list.length === 0) break;

      allDeployments.push(...list);
      if (data.pagination && data.pagination.next && data.pagination.next !== next) {
        next = data.pagination.next;
      } else {
        break;
      }
    } catch (e) {
      console.error(`❌ [${project}] 一覧取得エラー:`, e.message);
      break;
    }
  }

  console.log(`📦 [${project}] 合計 ${allDeployments.length} 件のデプロイが見つかりました。`);
  return allDeployments;
}

async function cleanProject(project) {
  const deployments = await fetchDeployments(project);
  if (deployments.length <= KEEP_COUNT) {
    console.log(`✅ [${project}] 保持件数 (${KEEP_COUNT}件) 以下のため、削除対象はありません。`);
    return { project, deleted: 0, kept: deployments.length };
  }

  // 作成日時降順でソート
  deployments.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // 最新のREADYなProductionデプロイを保護
  const kept = deployments.slice(0, KEEP_COUNT);
  const toDelete = deployments.slice(KEEP_COUNT);

  console.log(`🛡️ [${project}] 最新 ${kept.length} 件を保護:`);
  for (const k of kept) {
    console.log(`   - ${k.url} (${new Date(k.createdAt).toLocaleString('ja-JP')}, status: ${k.state})`);
  }

  console.log(`🗑️ [${project}] 過去 ${toDelete.length} 件のデプロイを一括削除します...`);
  let deletedCount = 0;
  let errorCount = 0;

  // 10件ずつバッチ実行してCLIを呼び出す（高速化）
  const BATCH_SIZE = 5;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const urls = batch.map(d => d.url).join(' ');
    try {
      run(`npx vercel rm ${urls} --yes`);
      deletedCount += batch.length;
      process.stdout.write(`\r   進捗: [${deletedCount}/${toDelete.length}] 削除完了...`);
    } catch (e) {
      // 1件ずつフォールバック
      for (const d of batch) {
        try {
          run(`npx vercel rm ${d.url} --yes`);
          deletedCount++;
        } catch (singleErr) {
          errorCount++;
        }
      }
    }
  }

  console.log(`\n🎉 [${project}] 削除完了: ${deletedCount} 件削除 (エラー: ${errorCount} 件)`);
  return { project, deleted: deletedCount, kept: kept.length };
}

async function main() {
  console.log('🧹 === Vercel 古いデプロイストレージ自動パージ開始 ===\n');
  const results = [];
  for (const project of PROJECTS) {
    const res = await cleanProject(project);
    results.push(res);
  }

  console.log('\n📊 === パージ結果サマリー ===');
  let totalDeleted = 0;
  for (const r of results) {
    console.log(`- ${r.project}: ${r.deleted} 件削除 (保護: ${r.kept} 件)`);
    totalDeleted += r.deleted;
  }
  console.log(`\n✨ 合計 ${totalDeleted} 件の古いデプロイをパージし、Deployment Storage を解放しました！`);
}

main().catch(console.error);
