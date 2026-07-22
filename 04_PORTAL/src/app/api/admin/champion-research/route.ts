import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROLE_PATH: Record<string, string> = {
  TOP: 'top', JG: 'jungle', JUNGLE: 'jungle', MID: 'middle',
  ADC: 'bottom', BOT: 'bottom', SUP: 'support', SUPPORT: 'support',
};

/** LoLalyticsのビルドページから統計テキストを取得 */
async function fetchLolalyticsData(champion: string, role: string) {
  const slug = champion.toLowerCase().replace(/[^a-z0-9]/g, '');
  const lane = ROLE_PATH[String(role).toUpperCase()] || 'jungle';
  const url = `https://lolalytics.com/lol/${slug}/build/?lane=${lane}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'ja,en;q=0.9',
      },
    });
    if (!res.ok) return { url, text: '', patch: null };
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const patchMatch = text.match(/[Pp]atch\s*(\d+\.\d+)/);
    return { url, text: text.slice(0, 15000), patch: patchMatch ? patchMatch[1] : null };
  } catch (e) {
    console.warn(`[champion-research] LoLalytics取得スキップ: ${e}`);
    return { url, text: '', patch: null };
  }
}

/** YouTube動画の自動発掘 & キュー登録 */
async function enqueueYoutubeResearchVideos(champion: string) {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=LoL+${encodeURIComponent(champion)}+guide`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'ja,en;q=0.9',
      },
    });
    if (!res.ok) return 0;
    const html = await res.text();
    const matches = Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g));
    const videoIds = Array.from(new Set(matches.map(m => m[1]))).slice(0, 3);

    if (videoIds.length === 0) return 0;

    let addedCount = 0;
    for (const vid of videoIds) {
      const videoUrl = `https://www.youtube.com/watch?v=${vid}`;
      const { data: existing } = await supabase
        .from('youtube_queue')
        .select('id')
        .eq('id', vid)
        .maybeSingle();

      if (!existing) {
        await supabase.from('youtube_queue').insert({
          id: vid,
          url: videoUrl,
          title: `[ディープリサーチ] ${champion} 解説動画 (${vid})`,
          champion: champion,
          status: 'pending',
          priority: 'high',
          date_added: new Date().toISOString(),
        });
        addedCount++;
      }
    }
    return addedCount;
  } catch (e) {
    console.warn(`[champion-research] YouTube動画発掘エラー: ${e}`);
    return 0;
  }
}

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { champion, role = 'JG', fetchVideos = true } = await req.json();
    if (!champion || typeof champion !== 'string') {
      return NextResponse.json({ error: 'champion (文字列) が必要です。' }, { status: 400 });
    }

    const champClean = champion.trim();
    const siteData = await fetchLolalyticsData(champClean, role);

    // 1. AI によるディープリサーチ & 攻略バイブル生成
    const prompt = `あなたはLoLの最高峰アナリスト・プロコーチです。
対象チャンピオン: **${champClean}** (メイン想定レーン: ${role})

以下の参考情報（LoLalytics等の最新データ）およびあなたの専門知識を活用し、
「${champClean}」の**深掘り攻略バイブル(Markdown)** を作成してください。

参考情報:
${siteData.text ? siteData.text.slice(0, 6000) : '（標準データで構成してください）'}

【出力要件】
1. **概要とメタでの立ち位置**: 現在の強み、弱み、おすすめの展開
2. **おすすめビルド・ルーン**: コアアイテムと対面ごとの選択肢
3. **序盤のレーン戦/ファームルート**: レベル1〜6の具体的な動き
4. **集団戦・マクロの立ち回り**: ドラゴン/バロン戦、サイドプッシュの判断基準
5. **主要マッチアップ相性**: 得意な相手、苦手な相手とその対策

【出力形式】
見出し (#, ##), 箇条書きを含む完全な Markdown 形式で回答してください。
チャンピオン名・アイテム名・スキル名は英語表記のまま残し、説明文章は必ず日本語で出力してください。`;

    const markdownArticle = await callGeminiWithRetry(prompt, {
      temperature: 0.3,
      maxOutputTokens: 3500,
      maxRetries: 2,
    });

    // 2. personal_knowledge (攻略ライブラリ/ナレッジ) に保存/更新
    const articleTitle = `[深掘りリサーチ] ${champClean} 総合攻略バイブル`;
    const { data: existingArticle } = await supabase
      .from('personal_knowledge')
      .select('id')
      .eq('champion', champClean)
      .ilike('title', '%深掘りリサーチ%')
      .maybeSingle();

    const knowledgePayload = {
      title: articleTitle,
      content: markdownArticle,
      champion: champClean,
      genre: 'ディープリサーチ',
      tags: [champClean, 'ディープリサーチ', '総合バイブル', role],
      source_url: siteData.url || undefined,
    };

    if (existingArticle) {
      await supabase
        .from('personal_knowledge')
        .update(knowledgePayload)
        .eq('id', existingArticle.id);
    } else {
      await supabase.from('personal_knowledge').insert(knowledgePayload);
    }

    // 3. matchup_sentinel (チャンピオン辞典) へ戦術データを反映
    const matchupId = `${champClean.toUpperCase()}_GLOBAL`;
    const { data: existingSentinel } = await supabase
      .from('matchup_sentinel')
      .select('id, raw_data')
      .eq('matchup_id', matchupId)
      .maybeSingle();

    const sentinelPayload = {
      matchup_id: matchupId,
      title: `${champClean} 戦術ガイド`,
      champion: champClean,
      enemy: 'GLOBAL',
      strategy: markdownArticle.slice(0, 3000), // 要点保存
      raw_data: {
        ...(existingSentinel?.raw_data || {}),
        deep_researched_at: new Date().toISOString(),
        patch: siteData.patch || 'Latest',
      },
    };

    if (existingSentinel) {
      await supabase
        .from('matchup_sentinel')
        .update(sentinelPayload)
        .eq('id', existingSentinel.id);
    } else {
      await supabase.from('matchup_sentinel').insert(sentinelPayload);
    }

    // 4. 高優先度解説動画の発掘 & キュー登録
    let enqueuedVideos = 0;
    if (fetchVideos) {
      enqueuedVideos = await enqueueYoutubeResearchVideos(champClean);
    }

    return NextResponse.json({
      success: true,
      champion: champClean,
      articleTitle,
      enqueuedVideos,
      patch: siteData.patch || 'Latest',
      summary: `「${champClean}」のディープリサーチを完了し、攻略バイブルの生成、チャンピオン辞典の更新、および高優先度解説動画(${enqueuedVideos}本)のキュー登録を行いました。`,
    });
  } catch (e: any) {
    console.error(`[champion-research] エラー:`, e);
    return NextResponse.json({ error: e.message || 'ディープリサーチ処理中にエラーが発生しました。' }, { status: 500 });
  }
}
