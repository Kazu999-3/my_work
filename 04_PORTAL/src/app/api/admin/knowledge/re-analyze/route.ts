import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

async function analyzeXPostImagesWithGemini(photos: any[], videos: any[], tweetText: string): Promise<string> {
  const mediaList: any[] = [];

  if (photos && photos.length > 0) {
    photos.forEach((p: any, i: number) => {
      if (p.url) mediaList.push({ type: 'image', url: p.url, label: `画像 #${i + 1}` });
    });
  }

  if (videos && videos.length > 0) {
    videos.forEach((v: any, i: number) => {
      const targetMediaUrl = v.url || v.thumbnail_url;
      const isVideoFile = v.url && (v.url.endsWith('.mp4') || v.url.includes('.mp4'));
      if (targetMediaUrl) {
        mediaList.push({ 
          type: isVideoFile ? 'video_file' : 'video_thumb', 
          url: targetMediaUrl, 
          label: `添付動画 #${i + 1} (${isVideoFile ? 'MP4動画データ' : '動画サムネイル'})` 
        });
      }
    });
  }

  if (mediaList.length === 0) return '';

  const apiKey = process.env.GEMINI_API_KEY_FREE || process.env.GEMINI_API_KEY;
  if (!apiKey) return '';

  let combinedAnalysis: string[] = [];

  for (let idx = 0; idx < Math.min(mediaList.length, 4); idx++) {
    const item = mediaList[idx];
    try {
      const mediaRes = await fetch(item.url, { signal: AbortSignal.timeout(15000) });
      if (!mediaRes.ok) continue;

      const arrayBuffer = await mediaRes.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      const rawContentType = mediaRes.headers.get('content-type');
      const contentType = item.type === 'video_file' ? (rawContentType || 'video/mp4') : (rawContentType || 'image/jpeg');

      const prompt = item.type === 'video_file' ? 
`あなたはLoL(League of Legends)戦略・動画解説の超一流アナリストAIです。
添付されたX(Twitter)の【添付動画 #${idx + 1}】を1秒も逃さず完全にAI動画解析し、以下の情報を全書き起こししてください。

【投稿本文】: ${tweetText}

【指示事項】:
1. 【動画内プレイ・アクションの展開解説】: 動画内で起きているプレイ、スキルコンボ、集団戦の立ち回り、操作順、オブジェクト獲得を時系列で解説。
2. 【画面内UI・ビルド・テキスト解読】: 画面に表示されているチャンピオン名、アイテム、ルーン、KDA、数値、テキストの完全解読。
3. 【勝つための戦術ポイント】: この動画プレイから学べる立ち回りのコツ、注意点、プロ/高レートの思考プロセスを長文Markdownで徹底解説してください。
※要約して短くすることは固く禁止します。貴重な情報を一つも漏らさず全て網羅してください。`
:
`あなたはLoL(League of Legends)戦略・ビルド・戦術解読の超一流アナリストAIです。
添付されたX(Twitter)のメディア【${item.label}】を【一切の省略なく】全情報高密度解読・文字起こししてください。

【投稿本文】: ${tweetText}

【指示事項】:
1. 【画面内全文字テキストの完全文字起こし】: 画像・画面内に書かれているすべての文字、数値、チャンピオン名、プレイヤー名、テキストを1文字も漏らさず書き出してください。
2. 【LoL全ビジュアルデータの網羅解読】: 全アイテム、全ルーン、スキル順、KDA、CS数、ゴールド差、勝率、ランク帯、対面状況
3. 【詳細な戦術・ロジックの完全書き出し】: なぜこのビルド/ルーンが強いのか、立ち回りのコツ、注意点、コンボ、メリット・デメリットを長文で徹底解説してください。
※要約して短くすることは固く禁止します。貴重な情報を一つも漏らさず全て網羅してください。`;

      const reqBody = {
        contents: [
          {
            parts: [
              { inline_data: { mime_type: contentType, data: base64Data } },
              { text: prompt }
            ]
          }
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
      };

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
        signal: AbortSignal.timeout(30000)
      });

      if (geminiRes.ok) {
        const resData = await geminiRes.json();
        const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          combinedAnalysis.push(`### 🎬 添付メディア【${item.label}】のAI動画・ビジュアル解読\n${text}`);
        }
      } else {
        const fallbackRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
          signal: AbortSignal.timeout(30000)
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const text = fallbackData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            combinedAnalysis.push(`### 🎬 添付メディア【${item.label}】のAI動画・ビジュアル解読\n${text}`);
          }
        }
      }
    } catch (err: any) {
      console.warn(`Gemini Vision/Video re-analysis error: ${err.message}`);
    }
  }

  return combinedAnalysis.join('\n\n---\n\n');
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

              let aiVisualAnalysis = await analyzeXPostImagesWithGemini(photos, videos, tweetText);

              let mediaDesc = [];
              if (photos.length > 0) mediaDesc.push(`添付画像 ${photos.length} 枚`);
              if (videos.length > 0) mediaDesc.push(`添付動画 ${videos.length} 本`);
              const mediaString = mediaDesc.length > 0 ? ` [メディア: ${mediaDesc.join(', ')}]` : '';

              const fullContent = `【X (Twitter) 動画＆画像完全網羅マルチモーダルAI解析ナレッジ】\n` +
                `投稿者: ${author}\n` +
                `投稿本文: ${tweetText}${mediaString}\n` +
                `投稿リンク: ${url}\n\n` +
                (aiVisualAnalysis ? `【AI動画＆全添付メディア視覚解読詳細（無省略）】\n${aiVisualAnalysis}` : `※添付画像/動画メディアと投稿本文を統合した高密度AIナレッジです。`);

              return {
                title: `X動画・画像完全解析 (${author}): ${tweetText.slice(0, 30)}...`,
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
      .slice(0, 15000);

    return { title, textContent };
  } catch (e: any) {
    return { title: 'No Title', textContent: '' };
  }
}

async function analyzeWithGemini(title: string, content: string): Promise<{
  title: string; summary: string; genre: string; tags: string[]; champion: string;
}> {
  const prompt = `以下のインプット情報（Webサイトの内容、X投稿のマルチモーダル画像・動画解析結果、またはメモ書き）を解析し、以下の処理を行ってください。

【極重要命令】:
文字数を削ったり要約して情報を省略することは【固く禁止】します。
画像および動画に描かれたすべてのプレイ展開、ビルド、ルーン、アイテム、数値、戦術、画面内テキスト、および本文の貴重な情報を【一つも漏らさず全て網羅】し、圧倒的な情報量の完全解読ナレッジ（Markdown形式）を作成してください。

1. 動画内プレイ展開および画像内のビジュアル解析データ（全アイテム、全ルーン、スキル順、KDA、画面テキスト等）をそのまま書き残すこと。
2. 最も適したジャンルを以下のいずれかから選択してください： 'LoL攻略', 'AIツール', '副業ノウハウ', 'その他'
3. 関連するキーワードタグ（最大8つ）を抽出してください。
4. このナレッジに最も適した具体的で分かりやすいタイトル（日本語）を決定してください。
5. LoLの攻略情報である場合、対象となっているチャンピオン名を特定してください（無い場合は 'Unknown'）。

必ず以下のJSONフォーマットのみを返却してください：
{
  "title": "決定した具体的なタイトル",
  "summary": "全情報を一つも漏らさず完全網羅した高密度・圧倒的ボリュームのMarkdownコンテンツ",
  "genre": "選択したジャンル",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "champion": "特定したチャンピオン名"
}

[インプット情報]:
タイトル: ${title}
内容:
${content}`;

  const responseText = await callGeminiWithRetry(prompt, {
    model: 'gemini-3.1-flash-lite',
    temperature: 0.2,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    apiKeyEnv: process.env.GEMINI_API_KEY_FREE ? 'GEMINI_API_KEY_FREE' : 'GEMINI_API_KEY',
  });

  return JSON.parse(responseText.trim());
}

// POST: 既存ナレッジの画像・動画込み再解析・要約更新
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

    const extracted = await extractUrlContent(url);
    if (!extracted.textContent) {
      return NextResponse.json({ error: 'URLからのコンテンツ取得に失敗しました。' }, { status: 400 });
    }

    const analyzed = await analyzeWithGemini(extracted.title, extracted.textContent);

    const { data: updated, error: updateErr } = await supabase
      .from('personal_knowledge')
      .update({
        title: analyzed.title,
        content: analyzed.summary,
        raw_content: extracted.textContent.slice(0, 15000),
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
      message: `「${analyzed.title}」を動画・画像AI解析付きで再解析・更新しました。`,
      data: updated
    });

  } catch (err: any) {
    console.error('❌ [Knowledge Re-Analyze API] Error:', err);
    return NextResponse.json({ error: err.message || '再解析に失敗しました。' }, { status: 500 });
  }
}
