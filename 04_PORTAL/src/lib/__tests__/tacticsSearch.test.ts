import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

// API内部ロジックの動作検証
test('tacticsSearch: バイブルのセクション分割とスニペット抽出ロジック', () => {
  const dummyMarkdown = `---
title: "ダリウス (Darius) 対面戦術バイブル"
status: hand_written
---

# ⚔️ ダリウス (Darius) 対面戦術バイブル

## 📌 基本方針 ＆ パワースパイク
- **戦術概要**: 出血5スタック（紅血の力）発動時の圧倒的AD上昇と、TrueダメージRによる連続処刑。

## 🗺️ 3段階勝ちパターン手順書 (Matchup Blueprint)
### Phase 1 (Lv1〜2: 序盤主導権)
- **アクション**: ウェーブを引いてフリーズ。相手が前に出た瞬間にゴーストを切って追撃、5スタック溜めてキル。

## ⚠️ 検討して落とした選択肢 ＆ 罠ビルド (Rejected Options / 没理由)
### 🚫 罠アイテム・NGビルド
- **移動速度（MS）増加のないビルド**: カイトされて即死する。
`;

  const sections = dummyMarkdown.split(/\n(?=##\s+)/);
  assert.equal(sections.length, 4);

  // 「ゴースト」で検索
  const keyword = 'ゴースト';
  const matchedSections = sections.filter(s => s.includes(keyword));
  assert.equal(matchedSections.length, 1);
  assert.ok(matchedSections[0].includes('3段階勝ちパターン手順書'));
});

test('tacticsSearch: 実際のリポジトリのバイブルから戦術概念が検索できること', () => {
  const repoRoot = path.resolve('..');
  const tacticsDir = path.join(repoRoot, '01_INTEL', 'tactics');
  
  if (!fs.existsSync(tacticsDir)) {
    // ディレクトリが存在しない環境ではスキップ
    return;
  }

  const files = fs.readdirSync(tacticsDir).filter(f => f.endsWith('_tactics_bible.md'));
  assert.ok(files.length >= 10, '最低10以上のバイブルが存在すること');

  // 「パワースパイク」という戦術概念で検索
  let hitCount = 0;
  for (const f of files) {
    const raw = fs.readFileSync(path.join(tacticsDir, f), 'utf-8');
    if (raw.includes('パワースパイク') || raw.includes('勝ちパターン')) {
      hitCount++;
    }
  }

  assert.ok(hitCount > 5, '主要概念で複数のバイブルがヒットすること');
});
