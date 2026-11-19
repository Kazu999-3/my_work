import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// .env.local をロード
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

import { isOllamaAvailable, callHybridLlm } from '../ollamaClient';
import { decomposeArticle } from '../knowledgeDecompose';

test('isOllamaAvailable returns boolean', async () => {
  const available = await isOllamaAvailable();
  assert.equal(typeof available, 'boolean');
  console.log('isOllamaAvailable:', available);
});

test('decomposeArticle works with hybrid LLM', async () => {
  const sampleArticle = {
    title: 'パッチ26.22 トップ＆ジャングル解説：ダリウスとジャーヴァンIVの立ち回り',
    content: `
## ダリウスの変更と立ち回り
ダリウスは序盤のQの回復量が上昇しました。
対面が近接チャンピオン（特にリヴェンやジャックス）の場合、Lv1からWスタートで積極的にトレードを仕掛けて出血スタックを溜めるのが有効です。
相手がフラッシュを切った後はゴーストを使って一気に追い詰めます。

## ジャーヴァンIVのガンクルート
ジャーヴァンIVは02:55のリフトスカトル湧きに合わせて赤バフからフルクリアまたは3キャンプガンクを選択します。
ポッピーが敵にいる場合は、EQコンボがポッピーのW（ステッドファスト）で阻止されるため、ポッピーのWを見てからスキルを切るように注意してください。
    `.trim(),
    champion: 'Darius',
  };

  const results = await decomposeArticle(sampleArticle);
  assert.ok(Array.isArray(results));
  assert.ok(results.length >= 2, `分解知見数が2件以上であること: 実際は ${results.length} 件`);

  console.log(`✓ ナレッジ分解成功 (${results.length}件の知見を抽出):`);
  for (const r of results) {
    console.log(`  - [${r.champion}${r.enemyChampion ? ` vs ${r.enemyChampion}` : ''}] ${r.title} (${r.scope})`);
  }
});
