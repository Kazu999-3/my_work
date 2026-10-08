import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env.local 読み込み
const envPath = path.join(__dirname, '../.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const geminiKey = env['GEMINI_API_KEY'] || env['GEMINI_API_KEY_FREE'];

import { createClient } from '@supabase/supabase-js';
const sb = createClient(supabaseUrl, supabaseKey);

async function callGemini(prompt) {
  const models = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 6000,
            responseMimeType: 'application/json',
          },
        }),
      });
      if (!res.ok) {
        console.warn(`[Gemini ${model}] failed status: ${res.status}`);
        continue;
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (e) {
      console.warn(`[Gemini ${model}] error:`, e.message);
    }
  }
  throw new Error('全Geminiモデル呼び出し失敗');
}

async function run() {
  console.log('🔍 対象記事 ID 37557 を取得中...');
  const { data: article, error } = await sb.from('personal_knowledge').select('*').eq('id', 37557).single();
  if (error || !article) throw new Error('記事取得エラー: ' + (error?.message || '見つかりません'));

  console.log('📄 タイトル:', article.title);
  console.log('   文字数:', article.content.length);

  const prompt = `あなたはLeague of Legends (LoL) のトッププロコーチ兼データアナリストAIです。
以下の入力記事（パッチ解説、ティアリスト、動画まとめ等）には、複数のチャンピオンやレーンに関する戦術・調整知見が含まれています。
この内容を精査し、【チャンピオンごと】および【レーン一般マクロごと】に独立したナレッジ（分割知見 / Atomic Insights）へ漏れなく分解・抽出してください。

【対象記事: ${article.title}】
${article.content}

【抽出・分解の絶対ルール】:
1. **複数チャンピオンの完全網羅**:
   - 記事内で言及されている各チャンピオン（例: Mordekaiser, Lillia, Swain, Rammus, Ezreal 等）について、個別の知見として必ず1つずつ独立して抽出してください。
   - パッチの変更点（バフ・ナーフ）、具体的なスキル・コンボ、立ち回り、アイテム・ルーン、有利・不利な対面、集団戦の役割などを記事の内容に基づいて具体的に記述してください。
   - 「薄い要約」にせず、実戦でそのチャンピオンを使うプレイヤーが読んで即座に役立つ詳細度を維持してください。
2. **アイテム・全体マクロの抽出（該当する場合）**:
   - 特定チャンピオンに限らないアイテム調整（例: ヘクステックプレート、ルナーン、ロケットベルト等）や、レーン全体のメタ（例: 近接サポートの優位性、ウェーブ管理原則）があれば、scope="lane_general" として抽出してください。
3. **チャンピオン名の表記**:
   - champion には Riot公式の英名ID（例: "Mordekaiser", "Lillia", "Swain", "Rammus", "Ezreal", "Thresh", "Unknown"）を指定してください。
4. **出力フォーマット**:
   必ず以下のJSONフォーマットのみを返却してください。

{
  "insights": [
    {
      "champion": "対象チャンピオン英名 (例: Mordekaiser。一般論の場合は 'Unknown')",
      "scope": "champion_specific または lane_general",
      "targetLane": "TOP または JG または MID または ADC または SUP または COMMON",
      "title": "具体的でわかりやすい日本語タイトル (例: 【Patch 26.20】Q火力強化とR短縮を活かしたスノーボール戦術)",
      "content": "詳細なMarkdown戦術本文 (パッチ調整、スキル運用、立ち回り、意識すべきWhy&When)",
      "tags": ["Patch26.20", "TOP", "Mordekaiser"]
    }
  ]
}`;

  console.log('🤖 Gemini AI で複数チャンピオンへナレッジ分解中...');
  const resText = await callGemini(prompt);
  const parsed = JSON.parse(resText);
  const insights = parsed.insights || [];

  console.log(`✨ 分解結果: ${insights.length} 件の知見を抽出`);
  insights.forEach((item, idx) => {
    console.log(`   [${idx + 1}] [${item.champion}] [${item.targetLane}] ${item.title}`);
  });

  // DB保存
  console.log('💾 分割知見（is_atomic = true, parent_id = 37557）を personal_knowledge に保存中...');
  const records = insights.map((item) => ({
    title: item.title,
    content: `> 📺 **元動画・親記事**: [${article.title}](${article.source_url})\n\n---\n\n${item.content}`,
    raw_content: item.content,
    source_url: article.source_url,
    genre: 'LoL攻略',
    tags: item.tags || ['LoL攻略'],
    champion: item.champion || 'Unknown',
    parent_id: article.id,
    is_atomic: true,
    review_status: 'pending',
  }));

  const { data: inserted, error: insErr } = await sb.from('personal_knowledge').insert(records).select('id, champion, title');
  if (insErr) throw insErr;

  console.log(`✅ 保存成功！ ${inserted.length} 件のレコードを作成しました:`);
  inserted.forEach((r) => console.log(`   - ID ${r.id}: [${r.champion}] ${r.title}`));

  // 親記事タグに __DECOMPOSED__ を追加
  const parentTags = Array.isArray(article.tags) ? article.tags : [];
  if (!parentTags.includes('__DECOMPOSED__')) {
    await sb.from('personal_knowledge').update({ tags: [...parentTags, '__DECOMPOSED__'] }).eq('id', 37557);
    console.log('🏷️ 親記事タグに __DECOMPOSED__ をマークしました');
  }

  console.log('🎉 ナレッジ分解完了！');
}

run().catch((e) => {
  console.error('❌ エラー:', e);
  process.exit(1);
});
