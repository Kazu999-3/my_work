import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { callGemini, uploadToGeminiFileApi, callGeminiWithMedia } from '@/lib/geminiClient';
import { formatChampId } from '@/lib/ddragonClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action = 'parse', type = 'memo', url = '', memo = '', parsedData } = body;

    // 1. 保存アクション (action === 'save')
    if (action === 'save') {
      if (!supabase) {
        return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
      }
      if (!parsedData || !parsedData.champion) {
        return NextResponse.json({ error: '保存データが不足しています' }, { status: 400 });
      }

      const champId = formatChampId(parsedData.champion);
      const enemy = parsedData.target_enemy ? formatChampId(parsedData.target_enemy) : 'GLOBAL';

      // matchup_sentinel に保存
      const { data: inserted, error: insertErr } = await supabase
        .from('matchup_sentinel')
        .insert({
          champion: champId,
          enemy: enemy,
          title: parsedData.title || `${champId} 戦術知見`,
          strategy: parsedData.strategy || '',
          raw_data: {
            trap: parsedData.trap || '',
            weakness: parsedData.weakness || '',
            power_spike: parsedData.power_spike || '',
            source: type === 'url' ? url : 'memo',
            created_at: new Date().toISOString(),
          }
        })
        .select()
        .single();

      if (insertErr) {
        console.error('matchup_sentinel 保存エラー:', insertErr);
        return NextResponse.json({ error: `保存に失敗しました: ${insertErr.message}` }, { status: 500 });
      }

      return NextResponse.json({ success: true, saved: inserted });
    }

    // 2. 解析アクション (action === 'parse')
    let rawText = memo || '';
    let videoUrlToFetch = '';

    // URLからのテキスト抽出
    if (type === 'url' && url) {
      try {
        if (/youtube\.com\/watch|youtu\.be\//i.test(url)) {
          rawText = `[YouTube動画URL]: ${url}\n（YouTube動画の解説・ビルド・立ち回り・対面戦術知見）\n${memo}`;
        } else if (/x\.com|twitter\.com/i.test(url)) {
          // X / Twitter の場合
          const tweetIdMatch = url.match(/status\/(\d+)/);
          const tweetId = tweetIdMatch ? tweetIdMatch[1] : '';
          let tweetText = '';

          if (tweetId) {
            // 1. fxtwitter status API
            const fxRes = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              signal: AbortSignal.timeout(8000),
            }).catch(() => null);
            if (fxRes && fxRes.ok) {
              const fxData: any = await fxRes.json().catch(() => null);
              tweetText = fxData?.tweet?.text || fxData?.status?.text || '';

              // 動画メディアの検出 (最も軽量/高効率なmp4を探す)
              const videos = fxData?.tweet?.media?.videos;
              if (Array.isArray(videos) && videos.length > 0) {
                const variants = videos[0]?.variants || [];
                const mp4s = variants
                  .filter((v: any) => v.content_type === 'video/mp4' && v.url)
                  .sort((a: any, b: any) => (a.bitrate || 0) - (b.bitrate || 0));
                if (mp4s.length > 0) {
                  videoUrlToFetch = mp4s[0].url;
                } else if (videos[0]?.url) {
                  videoUrlToFetch = videos[0].url;
                }
              }
            }

            // 2. 予備: /2/thread API
            if (!tweetText) {
              const threadRes = await fetch(`https://api.fxtwitter.com/2/thread/${tweetId}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(8000),
              }).catch(() => null);
              if (threadRes && threadRes.ok) {
                const threadData: any = await threadRes.json().catch(() => null);
                tweetText = threadData?.tweet?.text || threadData?.status?.text || '';
              }
            }

            // 3. 予備: reference_items テーブルからのDBフォールバック
            if (!tweetText && supabase) {
              const cleanUrl = url.split('?')[0];
              const { data: refItem } = await supabase
                .from('reference_items')
                .select('content, summary, title')
                .or(`url.ilike.%${tweetId}%,url.ilike.%${cleanUrl}%`)
                .limit(1)
                .maybeSingle();
              if (refItem) {
                tweetText = `${refItem.title}\n要点: ${refItem.summary}\n${refItem.content || ''}`;
              }
            }
          }

          rawText = tweetText 
            ? `[X投稿URL]: ${url}\n投稿本文: ${tweetText}\n${memo}`
            : `[X投稿URL]: ${url}\n${memo}`;
        } else {
          // 一般Webページ
          const webRes = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(10000),
          }).catch(() => null);
          if (webRes && webRes.ok) {
            const html = await webRes.text();
            // 簡易HTMLタグ除去
            const cleaned = html
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 5000);
            rawText = `[Web記事URL]: ${url}\n本文抜粋:\n${cleaned}\n${memo}`;
          } else {
            rawText = `[WebURL]: ${url}\n${memo}`;
          }
        }
      } catch (err: any) {
        console.warn('URL抽出失敗、フォールバック:', err.message);
        rawText = `[URL]: ${url}\n${memo}`;
      }
    }

    if (!rawText.trim() && !videoUrlToFetch) {
      return NextResponse.json({ error: '解析対象のテキストまたはURLが空です' }, { status: 400 });
    }

    let geminiText = '';
    let isVideoAnalyzed = false;

    // 🎥 1. 動画が検出された場合: Gemini File API によるマルチモーダル動画直接解析
    if (videoUrlToFetch) {
      try {
        console.log('[Ingest] X動画を検出。マルチモーダル深層解析を開始します:', videoUrlToFetch);
        const vidRes = await fetch(videoUrlToFetch, { signal: AbortSignal.timeout(15000) });
        if (vidRes.ok) {
          const arrayBuf = await vidRes.arrayBuffer();
          const vidBuffer = Buffer.from(arrayBuf);
          // 25MB未満ならFile APIで直接動画をGeminiに渡す
          if (vidBuffer.length > 0 && vidBuffer.length < 25 * 1024 * 1024) {
            const uploaded = await uploadToGeminiFileApi(vidBuffer, 'video/mp4', `x_vid_${Date.now()}.mp4`);
            if (uploaded?.uri) {
              const videoPrompt = `あなたはLoL (League of Legends) の世界最高峰チャレンジャーアナリスト兼プロコーチです。
この動画はLoLの対面戦術・プロミクロ解説動画です。
動画内の【音声・解説・字幕・画面上の実際の操作・ウェーブ状況】を1秒単位で詳細に分析し、
以下のJSONフォーマットのみを出力してください。抽象論（「CSを取る」「立ち回りを意識」等）は厳禁です。
必ずプロ（Zika選手やハイラングプレイヤー等）が実践している具体的なスキル順、ウェーブ管理、スキルの温存・発動タイミング、ルーン、コンボを出力してください。

【厳守フォーマット (JSONのみ)】:
{
  "champion": "対象チャンピオンの英名 (例: Sion, Aatrox, Darius, LeeSin)",
  "target_enemy": "対面・特定の相手がいる場合はその英名、全般知識なら 'GLOBAL'",
  "role": "推奨レーン ('TOP' | 'JG' | 'MID' | 'BOT' | 'SUP' | 'GLOBAL')",
  "title": "プロ直伝の核心を突く具体的タイトル (30文字以内)",
  "strategy": "【Lv1の仕掛け】【ウェーブ・ミニオン管理】【スキルの後出し・温存タイミング】【ガンク・ダイブ拒否】【集団戦のポジショニング】など、状況別に箇条書きで誰でもレーン戦で再現できるレベルで詳細に解説した実戦ミクロ知見",
  "runes": "推奨ルーン構成（メインルーン、対面による可変枠、サブ天啓等の必須理由）",
  "combo": "確定スキルコンボ手順（Lv6前、Lv6後など）",
  "weakness": "対面やチャンピオンの突くべき隙・クールダウンの隙",
  "trap": "一般プレイヤーがやってしまいがちな絶対地雷行動（NG行動）と、なぜそれが負けに直結するかの具体的理由",
  "power_spike": "警戒すべきパワースパイクのタイミングとレベル"
}`;
              geminiText = await callGeminiWithMedia(uploaded.uri, 'video/mp4', videoPrompt, {
                temperature: 0.1,
                maxOutputTokens: 4096,
                responseMimeType: 'application/json',
              });
              if (geminiText) {
                isVideoAnalyzed = true;
                console.log('[Ingest] マルチモーダル動画解析に成功しました');
              }
            }
          }
        }
      } catch (vidErr: any) {
        console.warn('[Ingest] 動画マルチモーダル解析失敗、テキスト＋Web検索にフォールバック:', vidErr.message);
      }
    }

    // 📖 2. 動画がなかった場合、または動画解析フォールバック時: チャレンジャー級深層テキスト＋Webグラウンディング解析
    if (!isVideoAnalyzed) {
      const prompt = `あなたはLoL (League of Legends) の世界最高峰チャレンジャーアナリスト兼プロコーチです。
以下の入力テキスト（Web記事、動画URL、X投稿、またはプレイヤーの反省メモ）から、
チャンピオン攻略・対面相性・立ち回りのエッセンスを徹底的に深掘り解剖してください。
表面的な要約や抽象論（「CSを取る」「立ち回りを意識する」等）は一切禁止します。
誰でもレーン戦で即座に再現できる具体的数値・スキル順・立ち位置・ウェーブ管理手順を詳細に出力してください。

【入力テキスト】:
${rawText}

【厳守フォーマット (JSONのみ)】:
{
  "champion": "対象チャンピオンの英名 (例: Sion, Aatrox, Darius, LeeSin)",
  "target_enemy": "対面・特定の相手がいる場合はその英名、全般知識なら 'GLOBAL'",
  "role": "推奨レーン ('TOP' | 'JG' | 'MID' | 'BOT' | 'SUP' | 'GLOBAL')",
  "title": "核心を突く具体的タイトル (30文字以内)",
  "strategy": "【Lv1の仕掛け】【ウェーブ・ミニオン管理】【スキルの後出し・温存タイミング】【ガンク・ダイブ拒否】【集団戦のポジショニング】など、状況別に箇条書きで誰でもレーン戦で再現できるレベルで詳細に解説した実戦ミクロ知見",
  "runes": "推奨ルーン構成（メイン、対面による可変枠、サブ天啓等の必須理由）",
  "combo": "確定スキルコンボ手順",
  "weakness": "対面やチャンピオンの突くべき隙・クールダウンの隙",
  "trap": "一般プレイヤーがやってしまいがちな絶対地雷行動（NG行動）と、なぜそれが負けに直結するかの理由",
  "power_spike": "警戒すべきパワースパイクのタイミングとレベル"
}`;

      try {
        geminiText = await callGemini(prompt, {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          enableSearch: true, // Google Search Grounding で動画や元ネタをWeb補完
        });
      } catch (apiErr: any) {
        console.error('Gemini呼び出し失敗:', apiErr);
        return NextResponse.json({
          error: `AI解析に失敗しました: ${apiErr.message || 'モデルの利用制限または通信エラー'}`,
        }, { status: 502 });
      }
    }

    let parsedResult: any = null;
    const jsonMatch = geminiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsedResult = JSON.parse(jsonMatch[0]);
      } catch {}
    }

    if (!parsedResult) {
      return NextResponse.json({
        error: 'AIによる構造化に失敗しました。生テキストをご確認ください。',
        rawAiOutput: geminiText,
      }, { status: 500 });
    }

    // strategy 等の配列を読みやすい改行区切りテキストに正規化
    let strategyText = Array.isArray(parsedResult.strategy)
      ? parsedResult.strategy.join('\n')
      : (parsedResult.strategy || '');

    if (parsedResult.runes && !strategyText.includes('【推奨ルーン】')) {
      const runesText = typeof parsedResult.runes === 'object'
        ? JSON.stringify(parsedResult.runes, null, 2)
        : parsedResult.runes;
      strategyText += `\n\n【推奨ルーン】\n${runesText}`;
    }
    if (parsedResult.combo && !strategyText.includes('【スキルコンボ】')) {
      const comboText = Array.isArray(parsedResult.combo)
        ? parsedResult.combo.join('\n')
        : parsedResult.combo;
      strategyText += `\n\n【スキルコンボ】\n${comboText}`;
    }

    const trapText = Array.isArray(parsedResult.trap)
      ? parsedResult.trap.join('\n')
      : (parsedResult.trap || '');

    const weaknessText = Array.isArray(parsedResult.weakness)
      ? parsedResult.weakness.join('\n')
      : (parsedResult.weakness || '');

    const powerSpikeText = Array.isArray(parsedResult.power_spike)
      ? parsedResult.power_spike.join('\n')
      : (parsedResult.power_spike || '');

    return NextResponse.json({
      success: true,
      preview: {
        champion: formatChampId(parsedResult.champion || 'Aatrox'),
        target_enemy: parsedResult.target_enemy ? formatChampId(parsedResult.target_enemy) : 'GLOBAL',
        role: parsedResult.role || 'GLOBAL',
        title: parsedResult.title || '戦術知見',
        strategy: strategyText,
        weakness: weaknessText,
        trap: trapText,
        power_spike: powerSpikeText,
        source: type === 'url' ? url : 'memo',
      }
    });

  } catch (e: any) {
    console.error('Ingest APIエラー:', e);
    return NextResponse.json({ error: e.message || '内部エラーが発生しました' }, { status: 500 });
  }
}
