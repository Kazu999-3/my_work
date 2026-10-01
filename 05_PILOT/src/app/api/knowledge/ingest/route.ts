import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { callGemini } from '@/lib/geminiClient';
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

    // URLからのテキスト抽出
    if (type === 'url' && url) {
      try {
        if (/youtube\.com\/watch|youtu\.be\//i.test(url)) {
          rawText = `[YouTube動画URL]: ${url}\n（YouTube動画の解説・ビルド・立ち回り・対面戦術知見）\n${memo}`;
        } else if (/x\.com|twitter\.com/i.test(url)) {
          // X / Twitter の場合
          const tweetIdMatch = url.match(/status\/(\d+)/);
          const tweetId = tweetIdMatch ? tweetIdMatch[1] : '';
          if (tweetId) {
            const fxRes = await fetch(`https://api.fxtwitter.com/2/thread/${tweetId}`, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              signal: AbortSignal.timeout(8000),
            }).catch(() => null);
            if (fxRes && fxRes.ok) {
              const fxData = await fxRes.json();
              const tweetText = fxData.tweet?.text || '';
              rawText = `[X投稿URL]: ${url}\n投稿本文: ${tweetText}\n${memo}`;
            } else {
              rawText = `[X投稿URL]: ${url}\n${memo}`;
            }
          } else {
            rawText = `[X投稿URL]: ${url}\n${memo}`;
          }
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

    if (!rawText.trim()) {
      return NextResponse.json({ error: '解析対象のテキストまたはURLが空です' }, { status: 400 });
    }

    // Gemini による戦術構造化プロンプト
    const prompt = `あなたはLoL (League of Legends) の超一流チャレンジャーアナリストAIです。
以下の入力テキスト（Web記事、動画URL、X投稿、またはプレイヤーの反省メモ）から、
チャンピオン攻略・対面相性・立ち回りのエッセンスを漏れなく抽出し、以下のJSONフォーマットのみを出力してください。

【入力テキスト】:
${rawText}

【厳守フォーマット】:
必ず以下のキーを持つJSONオブジェクトのみを出力してください（Markdownの\`\`\`jsonブロックなどで囲む）：
{
  "champion": "対象となるチャンピオンの英名 (例: Aatrox, Ahri, Darius, LeeSin)",
  "target_enemy": "対面・特定の相手がいる場合はその英名、全般知識なら 'GLOBAL'",
  "role": "推奨レーン ('TOP' | 'JG' | 'MID' | 'BOT' | 'SUP' | 'GLOBAL')",
  "title": "知見の要約タイトル (30文字以内)",
  "strategy": "立ち回り・具体的なミクロ手順・スキルの当て方・ウェーブ管理等の実戦知見 (箇条書きや丁寧な解説)",
  "weakness": "相手の弱み・突くべき隙（あれば、無ければ空文字）",
  "trap": "やってはいけない絶対地雷行動・即負けトラップ（あれば、無ければ空文字）",
  "power_spike": "警戒すべきパワースパイクやタイミング（あれば、無ければ空文字）"
}`;

    const geminiText = await callGemini(prompt, {
      temperature: 0.2,
      maxOutputTokens: 2048,
    });

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

    return NextResponse.json({
      success: true,
      preview: {
        champion: formatChampId(parsedResult.champion || 'Aatrox'),
        target_enemy: parsedResult.target_enemy ? formatChampId(parsedResult.target_enemy) : 'GLOBAL',
        role: parsedResult.role || 'GLOBAL',
        title: parsedResult.title || '戦術知見',
        strategy: parsedResult.strategy || '',
        weakness: parsedResult.weakness || '',
        trap: parsedResult.trap || '',
        power_spike: parsedResult.power_spike || '',
        source: type === 'url' ? url : 'memo',
      }
    });

  } catch (e: any) {
    console.error('Ingest APIエラー:', e);
    return NextResponse.json({ error: e.message || '内部エラーが発生しました' }, { status: 500 });
  }
}
