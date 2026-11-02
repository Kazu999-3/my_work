import fs from 'fs';
import path from 'path';

// .env.local を手動パースして環境変数に注入
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {
  console.warn('env read error:', e);
}

import { supabase } from '../src/lib/supabaseClient';
import { callGeminiWithRetry } from '../src/lib/geminiClient';

async function main() {
  if (!supabase) {
    console.error('Supabase client not initialized');
    process.exit(1);
  }

  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const targetCount = limitArg ? parseInt(limitArg.split('=')[1], 10) : 5;

  console.log(`=== チャンピオン教本 AI一括最適化バッチ (Target: 上位${targetCount}件) ===`);

  // 1. 全GLOBAL教本を取得して文字数降順にソート
  const { data: records, error } = await supabase
    .from('matchup_sentinel')
    .select('id, champion, strategy')
    .eq('enemy', 'GLOBAL');

  if (error || !records) {
    console.error('Failed to fetch records:', error);
    process.exit(1);
  }

  const sorted = records
    .map(r => ({ ...r, len: (r.strategy || '').length }))
    .filter(r => r.len >= 10000) // 1万文字以上の肥大化教本のみを対象
    .sort((a, b) => b.len - a.len);

  const targets = sorted.slice(0, targetCount);
  console.log(`対象チャンピオン: ${targets.map(t => `${t.champion} (${t.len}文字)`).join(', ')}`);

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log(`\n[${i + 1}/${targets.length}] 処理開始: ${target.champion} (現在 ${target.len} 文字)...`);

    const cleanedForPrompt = (target.strategy || '')
      .replace(/>\s*📺\s*\*\*元動画情報\*\*[\s\S]*?---\n+/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const prompt = `あなたはLeague of Legendsのトッププロアナリスト兼エグゼクティブコーチです。
以下は【${target.champion}】の現在の統合戦術マスター教本（GLOBAL戦略）全文です。
現在、末尾に「## 【記事】...」として多数の動画記事（数十本）が全文貼り付けられ、教本全体が長大化（数万字〜10万字規模）しています。

この動画知見に含まれるプロの判断基準（Why & When、スキル回し・コンボ、パワースパイク、序盤・中盤・集団戦の立ち回り、苦手対面対策、NG行動）を、前半の体系的な戦術構造へ自然に統合・肉付けし、重複する表現を1本化して、実戦で即座に判断できる【最高峰のチャンピオン完全攻略バイブル（4,000〜7,000文字程度）】へ美しく再構築・最適化してください。

【現在の教本全文（全量）】
${cleanedForPrompt}

【再構築・最適化の指針（絶対遵守）】:
1. **本質情報の完全保持（情報の切り捨て厳禁・高密度化）**:
   - 動画知見に含まれる具体的な判断根拠（Why & When）、コンボ順（例: Q3温存、Eキャンセル）、アイテム選択基準、実戦Tipsなどの重要な知見は**一切切り捨てず**、該当する各セクションに漏らさず美しく組み込んでください。
2. **重複の整理と文章の洗練**:
   - 似たような解説（例: フルクリア、キャンプ狩り方、定番ビルド）は統合・整理し、プレイヤーが試合前・試合中に一目で判断できるように体系化してください。
3. **動画インデックスのスマートな目次化**:
   - 末尾に「## 実戦動画・プロ解説マクロインデックス」を設け、主要な動画タイトルとYouTubeリンク、そしてその動画から得られる核心Tips（1〜2行）をコンパクトな目次リストとしてまとめてください（記事全文のベタ貼りは厳禁）。
4. **章立ての統一（Markdown形式）**:
   - 以下の階層構造を尊重して視覚的に美しく整理してください：
     - ## 1. チャンピオンの本質と勝利条件（コアコンセプト）
     - ## 2. スキル運用・コンボ・固有メカニクス（ミクロ極意）
     - ## 3. 序盤の立ち回りとテンポ管理（Lv1〜6・ファーム・ガンク）
     - ## 4. ビルドパス・パワースパイク・アイテム使い分け
     - ## 5. 中盤・オブジェクト・集団戦のポジショニング
     - ## 6. 🚨 絶対回避事項（NG行動リスト）
     - ## 7. 実戦動画・プロ解説マクロインデックス（参照リンク集）
5. **出力形式**:
   - 最適化後の教本全文をMarkdown形式のみで出力してください（\`\`\`markdown などのコードブロック記法は不要です）。`;

    try {
      const rawOptimized = await callGeminiWithRetry(prompt, {
        temperature: 0.2,
        maxOutputTokens: 8192,
        timeoutMs: 120000,
      });

      const cleanedOptimized = (rawOptimized || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
      const newLen = cleanedOptimized.length;

      if (newLen < 1000) {
        console.warn(`⚠️ 最適化結果が短すぎるためスキップ: ${target.champion} (${newLen}文字)`);
        continue;
      }

      const reduction = (((target.len - newLen) / target.len) * 100).toFixed(1);
      console.log(`✅ AI最適化完了: ${target.champion} (${target.len}字 ➔ ${newLen}字, 削減率 -${reduction}%)`);

      // DB反映
      const { error: upErr } = await supabase
        .from('matchup_sentinel')
        .update({ strategy: cleanedOptimized })
        .eq('id', target.id);

      if (upErr) {
        console.error(`❌ DB更新エラー (${target.champion}):`, upErr);
      } else {
        console.log(`💾 DB更新完了: ${target.champion}`);
      }

      // レートリミット対策で少し待機
      if (i < targets.length - 1) {
        console.log('⏱️ 3秒待機中...');
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (e: any) {
      console.error(`❌ 処理失敗 (${target.champion}):`, e.message || e);
    }
  }

  console.log('\n=== 一括最適化バッチ終了 ===');
}

main().catch(console.error);
