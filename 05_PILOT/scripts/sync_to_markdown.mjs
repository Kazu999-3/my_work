import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INTEL_DIR = path.resolve(__dirname, '../../01_INTEL');
const TACTICS_DIR = path.join(INTEL_DIR, 'tactics');
const ENV_FILE = path.resolve(__dirname, '../.env.local');

// .env.local 簡易ローダー
function loadEnv() {
  if (fs.existsSync(ENV_FILE)) {
    const raw = fs.readFileSync(ENV_FILE, 'utf-8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

async function syncDbToMarkdown() {
  console.log('🔄 [Sync] Supabase の最新知見を 01_INTEL/tactics/ Markdown原本へ同期中...');

  if (!supabase) {
    console.error('❌ Supabase クライアントが初期化できませんでした。');
    process.exit(1);
  }

  // matchup_sentinel から最新データを取得
  const { data: matchups, error } = await supabase
    .from('matchup_sentinel')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ データ取得エラー:', error.message);
    process.exit(1);
  }

  console.log(`📥 取得件数: ${matchups.length} 件`);

  let updatedCount = 0;

  // チャンピオンごとにグループ化
  const grouped = {};
  for (const m of matchups) {
    const champ = m.champion;
    if (!champ) continue;
    if (!grouped[champ]) grouped[champ] = [];
    grouped[champ].push(m);
  }

  for (const champ of Object.keys(grouped)) {
    const items = grouped[champ];
    const lower = champ.toLowerCase();
    
    // バイブルファイルの探索
    const possibleFiles = [
      path.join(TACTICS_DIR, `${champ}_tactics_bible.md`),
      path.join(TACTICS_DIR, `${lower}_tactics_bible.md`),
    ];
    if (champ === 'MonkeyKing') {
      possibleFiles.push(path.join(TACTICS_DIR, 'monkeyking_tactics_bible.md'));
    }

    let targetFile = possibleFiles.find(f => fs.existsSync(f));

    // ファイルが存在しない場合は新規作成
    if (!targetFile) {
      targetFile = path.join(TACTICS_DIR, `${lower}_tactics_bible.md`);
      const initialContent = `---
title: "${champ} 戦術バイブル"
status: verified
source_type: ai_derived
published_at: 2026-10-01
captured_at: ${new Date().toISOString().split('T')[0]}
verified_at: ${new Date().toISOString().split('T')[0]}
tags: [LoL, Tactics, ${champ}]
---

# ⚔️ ${champ} 戦術バイブル

## 🎯 戦術概要
- **戦術概要**: 実戦から蓄積された攻略知見・立ち回りガイド。

## 📝 実戦・インジェスト追記メモ
`;
      fs.writeFileSync(targetFile, initialContent, 'utf-8');
      console.log(`📄 新規バイブル作成: ${path.basename(targetFile)}`);
    }

    let content = fs.readFileSync(targetFile, 'utf-8');
    let hasChanges = false;

    // 「📝 実戦・インジェスト追記メモ」セクションの有無確認
    if (!content.includes('## 📝 実戦・インジェスト追記メモ')) {
      content += '\n\n## 📝 実戦・インジェスト追記メモ\n';
    }

    for (const item of items) {
      const title = item.title || `${item.enemy || 'GLOBAL'}戦術メモ`;
      const dateStr = item.created_at ? item.created_at.split('T')[0] : '2026-10';
      const enemyTag = item.enemy && item.enemy !== 'GLOBAL' ? `[vs ${item.enemy}] ` : '';
      const memoKey = `### 📌 ${enemyTag}${title} (${dateStr})`;

      // 既に同一見出し・内容が含まれている場合はスキップ
      if (content.includes(memoKey) || (item.strategy && content.includes(item.strategy.slice(0, 30)))) {
        continue;
      }

      let appendBlock = `\n${memoKey}\n`;
      if (item.strategy) {
        appendBlock += `- **立ち回り**: ${item.strategy}\n`;
      }
      if (item.raw_data?.trap) {
        appendBlock += `- **地雷行動**: ${item.raw_data.trap}\n`;
      }
      if (item.raw_data?.weakness) {
        appendBlock += `- **相手の弱み**: ${item.raw_data.weakness}\n`;
      }
      if (item.raw_data?.power_spike) {
        appendBlock += `- **パワースパイク**: ${item.raw_data.power_spike}\n`;
      }

      content += appendBlock;
      hasChanges = true;
    }

    if (hasChanges) {
      fs.writeFileSync(targetFile, content, 'utf-8');
      console.log(`✅ 同期反映完了: ${path.basename(targetFile)}`);
      updatedCount++;
    }
  }

  console.log(`\n🎉 [完了] ${updatedCount} ファイルのMarkdown原本を最新同期しました！`);
}

syncDbToMarkdown().catch(console.error);
