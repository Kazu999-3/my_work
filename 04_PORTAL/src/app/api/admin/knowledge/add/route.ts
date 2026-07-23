import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

// ============================================================
// Supabase クライアント
// ============================================================

// ============================================================
// Gemini API キー（Vercel環境変数 or .env から取得）
// ============================================================
// ============================================================
// URLからタイトルと本文をスクレイピング（Node.js fetch で実行）
// ============================================================
// ============================================================
// URLからタイトルと本文（X投稿の場合は画像・動画メディアを含む）をスクレイピング
// ============================================================
async function extractUrlContent(url: string): Promise<{ title: string; textContent: string }> {
  try {
    // X (Twitter) 投稿URLの判定
    const isXPost = /x\.com|twitter\.com/i.test(url) && /status\/\d+/i.test(url);

    if (isXPost) {
      const match = url.match(/status\/(\d+)/i);
      const tweetId = match ? match[1] : '';

      if (tweetId) {
        try {
          // FXTwitter APIから高精度なツイート本文・画像・動画URLを抽出
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

              let aiVisualAnalysis = "";

              // Python x_media_analyzer.py をバックグラウンド実行して画面/画像のマルチモーダルAI解析を取得
              try {
                const { execSync } = require('child_process');
                const pyCmd = `d:\\my_work\\.venv\\Scripts\\python.exe d:\\my_work\\03_SYSTEMS\\v2_CORE\\_LOL\\x_media_analyzer.py "${url}"`;
                const pyOutput = execSync(pyCmd, { encoding: 'utf-8', timeout: 35000 });
                if (pyOutput && pyOutput.length > 50) {
                  aiVisualAnalysis = pyOutput;
                }
              } catch (pyErr: any) {
                console.warn(`x_media_analyzer.py execution error: ${pyErr.message}`);
              }

              let mediaDesc = [];
              if (photos.length > 0) mediaDesc.push(`添付画像 ${photos.length} 枚`);
              if (videos.length > 0) mediaDesc.push(`添付動画 ${videos.length} 本`);

              const mediaString = mediaDesc.length > 0 ? ` [メディア: ${mediaDesc.join(', ')}]` : '';

              const fullContent = `【X (Twitter) マルチモーダルAI解析ナレッジ】\n投稿者: ${author}\n本文: ${tweetText}${mediaString}\n投稿リンク: ${url}\n\n` +
                (aiVisualAnalysis ? `【AIビジュアル＆画像解析詳細】\n${aiVisualAnalysis}` : `※添付画像/動画メディアと投稿本文を統合した高度なAIナレッジです。`);

              return {
                title: `X解析 (${author}): ${tweetText.slice(0, 30)}...`,
                textContent: fullContent
              };
            }
          }
        } catch (e: any) {
          console.warn(`FXTwitter API fallback error: ${e.message}`);
        }
      }
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();

    // 簡易HTMLパーサー（<script>,<style>,<nav>,<footer>,<header>を除去）
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '');

    // タイトル抽出
    const titleMatch = cleaned.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'No Title';

    // HTMLタグを除去してテキスト化
    const textContent = cleaned
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000);  // 最大10000文字

    return { title, textContent };
  } catch (e: any) {
    console.error(`URLスクレイピングエラー: ${e.message}`);
    return { title: 'No Title', textContent: '' };
  }
}

// ============================================================
// Gemini API で要約・分類・タグ付けを実行
// ============================================================
async function analyzeWithGemini(title: string, content: string): Promise<{
  title: string;
  summary: string;
  genre: string;
  tags: string[];
  champion: string;
}> {
  const prompt = `以下のインプット情報（Webサイトの内容またはメモ書き）を解析し、以下の処理を行ってください。
1. 日本語での簡潔な要約（300文字以内、Markdown形式）を作成してください。
2. 最も適したジャンルを以下のいずれかから選択してください：
   - 'LoL攻略'
   - 'AIツール'
   - '副業ノウハウ'
   - 'その他'
3. 関連するキーワードタグ（最大5つ）を抽出してください。
4. この記事に最も適した分かりやすいタイトル（日本語）を決定してください。
5. LoLの攻略情報である場合、対象となっているチャンピオン名を1つ特定してください（該当なし、またはLoL以外の話題の場合は 'Unknown' を返却）。

出力は、必ず以下のJSONフォーマットのみを返却してください。他の説明文などは一切含めないでください。

{
  "title": "決定したタイトル",
  "summary": "要約されたコンテンツ",
  "genre": "選択したジャンル",
  "tags": ["タグ1", "タグ2"],
  "champion": "特定したチャンピオン名（例: Graves、無い場合は 'Unknown'）"
}

[インプット情報]:
タイトル: ${title}
内容:
${content}`;

  // 呼び出しは共通クライアントに集約する。
  // 429/5xxのリトライ、複数APIキーのローテーション、日本語出力の強制がここで効く。
  const responseText = await callGeminiWithRetry(prompt, {
    model: 'gemini-3.1-flash-lite',
    temperature: 0.3,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json',
    // 無料枠キーがあればそちらを優先する（従来の getGeminiApiKey と同じ方針）
    apiKeyEnv: process.env.GEMINI_API_KEY_FREE ? 'GEMINI_API_KEY_FREE' : 'GEMINI_API_KEY',
  });

  try {
    return JSON.parse(responseText.trim());
  } catch (e) {
    console.error('Gemini応答のJSON解析失敗:', responseText.slice(0, 300));
    throw new Error('AIの応答をJSON形式で解析できませんでした。再試行してください。');
  }
}

// ============================================================
// POST: ナレッジの追加（URL or テキスト → AI解析 → DB保存）
// ============================================================
export async function POST(req: NextRequest) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const { url, text } = await req.json();

    if (!url && !text) {
      return NextResponse.json({ error: 'URLまたはメモテキストを入力してください。' }, { status: 400 });
    }

    // 1. コンテンツの取得
    let title = '手書きメモ';
    let rawContent = '';

    if (url) {
      const extracted = await extractUrlContent(url);
      title = extracted.title;
      rawContent = extracted.textContent;
      if (!rawContent) {
        return NextResponse.json({ error: 'URLからコンテンツを取得できませんでした。' }, { status: 400 });
      }
    } else if (text) {
      rawContent = text;
      title = text.split('\n')[0].slice(0, 50);
      if (text.length > 50) title += '...';
    }

    // 2. Gemini でAI要約・分類
    const analyzed = await analyzeWithGemini(title, rawContent);

    // 3. Supabase に保存
    const { data, error } = await supabase
      .from('personal_knowledge')
      .insert([{
        title: analyzed.title,
        content: analyzed.summary,
        raw_content: rawContent.slice(0, 8000),
        source_url: url || '',
        genre: analyzed.genre,
        tags: analyzed.tags,
        champion: analyzed.champion || 'Unknown'
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `ナレッジ「${analyzed.title}」を分類・登録しました。`,
      data
    });

  } catch (err: any) {
    console.error('❌ [Knowledge Add API] POST Error:', err);
    return NextResponse.json({ error: err.message || 'ナレッジの処理に失敗しました。' }, { status: 500 });
  }
}
