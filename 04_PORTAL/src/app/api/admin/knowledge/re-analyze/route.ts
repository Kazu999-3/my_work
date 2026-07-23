import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

// X (Twitter) 投稿から添付画像を取得し Node.js 上で Gemini Vision 解析
async function analyzeXPostImagesWithGemini(photos: any[], tweetText: string): Promise<string> {
  if (!photos || photos.length === 0) return '';

  const apiKey = process.env.GEMINI_API_KEY_FREE || process.env.GEMINI_API_KEY;
  if (!apiKey) return '';

  let combinedAnalysis = [];

  for (let idx = 0; idx < Math.min(photos.length, 3); idx++) {
    const photoUrl = photos[idx].url;
    if (!photoUrl) continue;

    try {
      const imgRes = await fetch(photoUrl, { signal: AbortSignal.timeout(10000) });
      if (!imgRes.ok) continue;

      const arrayBuffer = await imgRes.arrayBuffer();
      const base64Image = Buffer.from(arrayBuffer).toString('base64');
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

      const prompt = `あなたはLoL(League of Legends)戦略・ビルド・戦術解読の超一流AIアナリストです。
添付されたX(Twitter)投稿の画像 #${idx + 1} を詳細に視覚解析してください。

【投稿本文】: ${tweetText}

【指示事項】:
1. 画像に映っているLoLのチャンピオン名、アイテム構成、ルーン、スキル順、KDA、ゴールド、画面内テキストの全読み取り
2. この画像から読み取れるゲーム内戦術・メタの要点・立ち回り解説
3. 今後の攻略記事や学習にそのまま使える詳細なMarkdown解説文を作成してください。`;

      const reqBody = {
        contents: [
          {
            parts: [
              { inline_data: { mime_type: contentType, data: base64Image } },
              { text: prompt }
            ]
          }
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1500 }
      };

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
        signal: AbortSignal.timeout(20000)
      });

      if (geminiRes.ok) {
        const resData = await geminiRes.json();
        const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          combinedAnalysis.push(`### 🖼️ 添付画像 #${idx + 1} のAI詳細解析\n${text}`);
        }
      }
    } catch (err: any) {
      console.warn(`Gemini Vision re-analysis error: ${err.message}`);
    }
  }

  return combinedAnalysis.join('\n\n');
}

async function extractUrlContent(url: string): Promise<{ title: string; textContent: string }> {
  try {
    const isXPost = /x\.com|twitter\.com/i.test(url) && /status\/\d+/i.test(url);

    if (isXPost) {
      const match = url.match(/status\/(\d+)/i);
      const tweetId = match ? match[1] : '';

      if (tweetId) {
        try {
          const fxRes = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(10000)
          });

          if (fxRes.ok) {
            const data = await fxRes.json();
            const tweet = data.tweet;
            if (tweet) {
              const author = `${tweet.author?.name || 'Unknown'} (@${tweet.author?.screen_name || ''})`;
              const tweetText = tweet.text || '';
              const photos = tweet.media?.photos || [];
              const videos = tweet.media?.videos || [];

              let aiVisualAnalysis = await analyzeXPostImagesWithGemini(photos, tweetText);

              let mediaDesc = [];
              if (photos.length > 0) mediaDesc.push(`添付画像 ${photos.length} 枚`);
              if (videos.length > 0) mediaDesc.push(`添付動画 ${videos.length} 本`);
              const mediaString = mediaDesc.length > 0 ? ` [メディア: ${mediaDesc.join(', ')}]` : '';

              const fullContent = `【X (Twitter) マルチモーダルAI解析ナレッジ】\n` +
                `投稿者: ${author}\n` +
                `投稿本文: ${tweetText}${mediaString}\n` +
                `投稿リンク: ${url}\n\n` +
                (aiVisualAnalysis ? `【AIビジュアル＆添付画像解析詳細】\n${aiVisualAnalysis}` : `※添付画像/動画メディアと投稿本文を統合した高度なAIナレッジです。`);

              return {
                title: `X要約 (${author}): ${tweetText.slice(0, 30)}...`,
                textContent: fullContent
              };
            }
          }
        } catch (e: any) {
          console.warn(`FXTwitter API error: ${e.message}`);
        }
      }
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '');

    const titleMatch = cleaned.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'No Title';

    const textContent = cleaned
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000);

    return { title, textContent };
  } catch (e: any) {
    return { title: 'No Title', textContent: '' };
  }
}

async function analyzeWithGemini(title: string, content: string): Promise<{
  title: string; summary: string; genre: string; tags: string[]; champion: string;
}> {
  const prompt = `以下のインプット情報（Webサイトの内容、X投稿のマルチモーダル画像解析結果、またはメモ書き）を解析し、以下の処理を行ってください。
1. 画像に描かれたビルド/ルーン/戦術および本文の情報を含む高密度な日本語要約（800文字以内、Markdown形式）を作成してください。
2. 最も適したジャンルを以下のいずれかから選択してください： 'LoL攻略', 'AIツール', '副業ノウハウ', 'その他'
3. 関連するキーワードタグ（最大5つ）を抽出してください。
4. この記事に最も適した分かりやすいタイトル（日本語）を決定してください。
5. LoLの攻略情報である場合、対象となっているチャンピオン名を1つ特定してください（無い場合は 'Unknown'）。

必ず以下のJSONフォーマットのみを返却してください：
{
  "title": "決定したタイトル",
  "summary": "要約されたコンテンツ（画像解析結果や戦術ポイントを含む高密度なMarkdown）",
  "genre": "選択したジャンル",
  "tags": ["タグ1", "タグ2"],
  "champion": "特定したチャンピオン名"
}

[インプット情報]:
タイトル: ${title}
内容:
${content}`;

  const responseText = await callGeminiWithRetry(prompt, {
    model: 'gemini-3.1-flash-lite',
    temperature: 0.3,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
    apiKeyEnv: process.env.GEMINI_API_KEY_FREE ? 'GEMINI_API_KEY_FREE' : 'GEMINI_API_KEY',
  });

  return JSON.parse(responseText.trim());
}

// POST: 既存ナレッジの画像込み再解析・要約更新
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ナレッジIDを指定してください。' }, { status: 400 });
    }

    // 1. 対象ナレッジを取得
    const { data: item, error: fetchErr } = await supabase
      .from('personal_knowledge')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !item) {
      return NextResponse.json({ error: '対象のナレッジが見つかりません。' }, { status: 404 });
    }

    const url = item.source_url;
    if (!url) {
      return NextResponse.json({ error: 'このナレッジには元URLが設定されていません。' }, { status: 400 });
    }

    // 2. URLからの再抽出（画像AI解析含む）
    const extracted = await extractUrlContent(url);
    if (!extracted.textContent) {
      return NextResponse.json({ error: 'URLからのコンテンツ取得に失敗しました。' }, { status: 400 });
    }

    // 3. Gemini 再要約
    const analyzed = await analyzeWithGemini(extracted.title, extracted.textContent);

    // 4. DB更新
    const { data: updated, error: updateErr } = await supabase
      .from('personal_knowledge')
      .update({
        title: analyzed.title,
        content: analyzed.summary,
        raw_content: extracted.textContent.slice(0, 10000),
        genre: analyzed.genre,
        tags: analyzed.tags,
        champion: analyzed.champion || 'Unknown'
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      message: `「${analyzed.title}」を画像込みで再解析・更新しました。`,
      data: updated
    });

  } catch (err: any) {
    console.error('❌ [Knowledge Re-Analyze API] Error:', err);
    return NextResponse.json({ error: err.message || '再解析に失敗しました。' }, { status: 500 });
  }
}
