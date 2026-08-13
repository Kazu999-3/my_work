import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  // 他のadmin/knowledge/*ルートと異なり認証チェックが無く、誰でもGemini APIを
  // 無制限消費した上でpersonal_knowledgeへ任意データをinsertできる状態だった
  // (2026-08-13の監査#10で発覚)。
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const { mode } = body;

    // 1. 生のDiscordトークテキストからAIで知見を構造化抽出
    if (mode === 'parse') {
      const { text } = body;
      if (!text || typeof text !== 'string' || !text.trim()) {
        return NextResponse.json({ error: 'テキストを入力してください。' }, { status: 400 });
      }

      if (!GEMINI_API_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY が未設定です。' }, { status: 500 });
      }

      const prompt = `
あなたはLeague of Legendsのトップアナリスト・AIコーチです。
以下のDiscordの生のチャットログ（テキスト）を読み、雑談・挨拶・無関係な発言を除外し、LoLのゲーム攻略、立ち回り、ビルド、対面対策、チャンピオンの強み・弱みなどの【有用な知見】のみを抽出してJSON形式で出力してください。

【出力フォーマット (JSONのみ厳守)】
{
  "items": [
    {
      "champion": "チャンピオン名 (英語表記・例: Ahri, LeeSin, JarvanIV, RekSai)",
      "enemy_champion": "対面チャンピオンがいれば英語表記、いなければnull",
      "category": "分類 ('strategy' | 'buildRunes' | 'counterChampions' | 'strengths' | 'weaknesses' | 'general')",
      "title": "簡潔なタイトル (例: Ahri vs Fizz 6前のレーン管理)",
      "summary": "読んですぐに実践できる具体的な立ち回り・ビルド解説要約 (Markdown形式・日本語)",
      "raw_excerpt": "チャットログからの該当発言抜粋"
    }
  ]
}

【注意事項】
- 該当する攻略情報がない場合、items は空配列 [] にしてください。
- チャンピオン名は必ず標準的な英語名（DDragon表記）に正規化してください。

【チャットログ本文】:
${text.slice(0, 8000)}
`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Gemini API Error:', errText);
        return NextResponse.json({ error: 'AIによるテキスト解析に失敗しました。' }, { status: 500 });
      }

      const resJson = await response.json();
      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      let parsed = { items: [] };
      try {
        parsed = JSON.parse(rawText);
      } catch (e) {
        console.error('Failed to parse JSON from Gemini:', rawText);
      }

      return NextResponse.json({ success: true, items: parsed.items || [] });
    }

    // 2. 抽出された知見をナレッジDB (personal_knowledge / champion_facts) へ保存
    if (mode === 'commit') {
      const { items } = body;
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: '取り込むデータがありません。' }, { status: 400 });
      }

      const results = [];
      for (const item of items) {
        if (!item.champion || !item.summary) continue;

        // personal_knowledge テーブルへ知見レコードを保存
        const { data, error } = await supabaseAdmin
          .from('personal_knowledge')
          .insert({
            champion: item.champion,
            enemy_champion: item.enemy_champion || null,
            category: item.category || 'strategy',
            title: item.title || `${item.champion} の攻略メモ`,
            content: item.summary,
            source: 'discord_import',
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('Error inserting personal_knowledge:', error);
          results.push({ champion: item.champion, success: false, error: error.message });
        } else {
          results.push({ champion: item.champion, success: true, id: data.id });
        }
      }

      return NextResponse.json({ success: true, results });
    }

    return NextResponse.json({ error: '不正な mode です。' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in import-discord route:', err);
    return NextResponse.json({ error: err.message || '内部エラーが発生しました。' }, { status: 500 });
  }
}
