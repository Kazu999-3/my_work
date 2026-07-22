import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';
import { getChampionKnowledge } from '../../../../lib/championKnowledge';
import { fetchChampionStats } from '../../../../lib/championStats';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
        // 注: youtube_queue に champion カラムは無い。入れると列不明でinsertが失敗し、
        // 動画登録が丸ごと0本になる。チャンプ名はタイトルに含めて識別する。
        await supabase.from('youtube_queue').insert({
          id: vid,
          url: videoUrl,
          title: `[ディープリサーチ] ${champion} 解説動画 (${vid})`,
          channel_name: 'DeepResearch',
          status: 'pending',
          priority: 'high',
          // date_added はUNIX秒(bigint)。ISO文字列を入れると型エラーで登録に失敗する。
          date_added: Math.floor(Date.now() / 1000),
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

    // 参考データを2系統から集める。
    // (a) 公式 Data Dragon のチャンピオン実データ（スキルCD・射程・ベースステータス・公式Tips）。
    //     LoLalytics等はJS描画でサーバー取得できず空になるため、確実に取れる公式ソースに変更。
    // (b) 自分たちが蓄積した内部知識（手書きメモ・記事・辞典）。実戦の確度が高い。
    const siteData = await fetchChampionStats(champClean);
    let internalKnowledge = { hasData: false, text: '' } as { hasData: boolean; text: string };
    try {
      const k = await getChampionKnowledge(supabase, champClean, { maxNotes: 8, maxNoteChars: 600 });
      internalKnowledge = { hasData: k.hasData, text: k.text || '' };
    } catch (e) {
      console.warn('[champion-research] 内部知識の取得に失敗:', e);
    }

    // 1. AI によるディープリサーチ & 攻略バイブル生成
    const prompt = `あなたはLoLの最高峰アナリスト兼プロコーチです。
対象チャンピオン: **${champClean}** (メイン想定レーン: ${role})

以下の2種類の参考情報と、あなたの専門知識を統合して、
「${champClean}」の**実戦で使える深掘り攻略バイブル(Markdown)** を作成してください。

【参考情報A: 公式データ(Riot Data Dragon) — スキルのCD/射程/コスト、レベル別ステータス、公式Tips】
${siteData.ok ? siteData.text.slice(0, 6000) : '（今回は公式データを取得できませんでした。あなたの知識で補ってください）'}

【参考情報B: このコミュニティが蓄積した内部ナレッジ（手書きメモ・攻略記事・辞典）】
${internalKnowledge.hasData ? internalKnowledge.text.slice(0, 6000) : '（内部ナレッジはまだありません）'}

【深さの要求 — 重要】
- 抽象論を避け、**具体的な数字・タイミング・操作**を必ず含めること（例:「6レベルでコアの1つ目が完成し、そこがパワースパイク」「3:30前後でフルクリア後に上ガンク」）。
- 「状況→とるべき行動→理由」の形で、判断基準まで書くこと。
- 参考情報Bに具体的な記述があれば、それを最優先で取り込むこと。

【出力構成（各セクションを厚めに）】
1. **概要とメタでの立ち位置**: 強み・弱み・このパッチでの評価
2. **ビルド・ルーン**: コア/状況別アイテム、ルーンの選択理由
3. **序盤(Lv1-6)**: リーシュ/ファームルート、パワースパイク、最初のプレイメイク
4. **中盤以降のマクロ**: オブジェクトの寄り方、サイドプッシュ、ウェーブ管理の判断
5. **集団戦での役割**: 誰を狙うか、スキルの当て方、ポジショニング
6. **主要マッチアップ**: 得意・苦手それぞれ3体ずつ、具体的な対策込み

【出力形式】
見出し(#, ##)と箇条書きを使った完全なMarkdown。
チャンピオン名・アイテム名・スキル名は英語のまま、説明文は必ず日本語で。`;

    const markdownArticle = await callGeminiWithRetry(prompt, {
      temperature: 0.35,
      maxOutputTokens: 8000,   // 3500では浅く途切れがち。深掘り用に増やす。
      maxRetries: 2,
    });

    // AIが実際に中身を生成できたか検証する。
    // キー未設定だと「※ ...スキップしました」、失敗すると「生成失敗」等の短い文字列が返る。
    // これをそのまま保存すると「一瞬で完了したのに中身が空」の事故になるため、ここで弾く。
    const aiText = String(markdownArticle || '').trim();
    const aiFailed = aiText.length < 200 || aiText.startsWith('※') || aiText === '生成失敗';
    if (aiFailed) {
      return NextResponse.json({
        error: 'AIが有効な攻略記事を生成できませんでした。GEMINI_API_KEYの設定、またはレート制限を確認してください。',
        aiRaw: aiText.slice(0, 300),
      }, { status: 502 });
    }

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
      source_url: siteData.ok ? siteData.source : undefined,
    };

    let savedArticleId: any = existingArticle?.id ?? null;
    if (existingArticle) {
      await supabase
        .from('personal_knowledge')
        .update(knowledgePayload)
        .eq('id', existingArticle.id);
    } else {
      const { data: inserted } = await supabase
        .from('personal_knowledge')
        .insert(knowledgePayload)
        .select('id')
        .single();
      savedArticleId = inserted?.id ?? null;
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
      article: aiText,             // 生成本文（その場で表示するため返す）
      articleId: savedArticleId,   // ライブラリで開くためのID
      articleLength: aiText.length,
      statsSource: siteData.ok ? siteData.source : null,
      lolalyticsUsed: siteData.ok,  // 公式データを実際に取得できたか（旧名はUI互換のため維持）
      internalKnowledgeUsed: internalKnowledge.hasData,  // 内部ナレッジを材料にできたか
      enqueuedVideos,
      patch: siteData.patch || 'Latest',
      summary: `「${champClean}」のディープリサーチを完了し、攻略バイブル(${aiText.length.toLocaleString()}字)の生成、チャンピオン辞典の更新、および高優先度解説動画(${enqueuedVideos}本)のキュー登録を行いました。`,
    });
  } catch (e: any) {
    console.error(`[champion-research] エラー:`, e);
    return NextResponse.json({ error: e.message || 'ディープリサーチ処理中にエラーが発生しました。' }, { status: 500 });
  }
}
