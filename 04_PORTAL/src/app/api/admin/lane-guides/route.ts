import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';
import { recordRevision } from '../../../../lib/knowledgeRevisions';

// レーン別ガイドの統合。
// 攻略ライブラリのうち「特定チャンピオンの記事ではないもの」＝レーンのマクロ・立ち回りを
// レーンごとに1本の記事へマージしていく。統合済みの記事はライブラリから片付ける。
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CHUNK = 3; // 1リクエストで統合する記事数（AI呼び出しが重いため）

// ※route.ts では GET/POST 等以外を export できないため const のままにする
// COMMON は「どのレーンでも通用する普遍的な判断・マクロ」を集約する枠。
// 旧「上達の原則」はここに統合した。
const LANES = [
  { key: 'COMMON', label: '全レーン共通（上達の原則）' },
  { key: 'TOP', label: 'TOP（トップ）' },
  { key: 'JG', label: 'JG（ジャングル）' },
  { key: 'MID', label: 'MID（ミッド）' },
  { key: 'ADC', label: 'ADC（ボット）' },
  { key: 'SUP', label: 'SUP（サポート）' },
];

// 記事がどのレーンの話かを、チャンピオン欄・タイトル・本文の語から判定する
function detectLane(article: any): string {
  const hay = `${article.champion || ''} ${article.title || ''} ${(article.raw_content || article.content || '').slice(0, 600)}`.toLowerCase();
  const score: Record<string, number> = { TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0 };
  const rules: [string, RegExp][] = [
    ['TOP', /\btop\b|トップ|タンク対面|テレポート/],
    ['JG', /\bjungle\b|\bjg\b|ジャングル|ガンク|周回|スマイト|カウンタージャングル/],
    ['MID', /\bmid\b|ミッド|ロー\s?ム|ローミング/],
    ['ADC', /\badc\b|\bbot\b|bottom|ボット|マークスマン|キャリー/],
    ['SUP', /\bsup\b|support|サポート|視界|ワード|ローム/],
  ];
  for (const [lane, re] of rules) {
    const m = hay.match(new RegExp(re, 'gi'));
    if (m) score[lane] += m.length;
  }
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'COMMON';
}

/** AIの利用制限で中断したことを示す。呼び出し側で「続きから再開」に使う。 */
class RateLimitedError extends Error {}

/**
 * 記事1本を指定レーンのガイドへ追記マージし、元記事をライブラリから片付ける。
 * 一括統合と「この記事を送る」の両方から使う。
 */
async function mergeArticleIntoLane(a: any, lane: string): Promise<{ title: string }> {
  const laneLabel = LANES.find((l) => l.key === lane)?.label || lane;
  const body = a.raw_content || a.content || '';

  const { data: existing } = await supabase
      .from('lane_guides').select('title, body, source_count').eq('lane', lane).maybeSingle();

  // COMMON（全レーン共通）は、チャンピオン名を伏せて「どのチャンプでも通用する原則」に絞る。
  // 旧「上達の原則」の役割をここに統合している。
  const isCommon = lane === 'COMMON';
  const commonRule = isCommon
      ? `\n- これは「全レーン共通」のガイドです。特定チャンピオンの性能・スキル・ビルドの話は**一切含めない**でください\n- どのチャンプ・どのレーンを担当していても使える判断基準だけを書いてください\n- 抽象的な精神論ではなく、**具体的な状況と行動**で書いてください（例:「相手ジャングルが上に映ったら、下のオブジェクトを準備する」）`
      : '';

  const prompt = `「${laneLabel}」のレーン攻略ガイドを、新しい記事の内容で更新します。${commonRule}

【現在のガイド】
${existing?.body || '（まだ何も書かれていません）'}

【新しい記事: ${a.title || '無題'}】
${String(body).slice(0, 8000)}

指示:
- **既存のガイドの内容を残したまま**、記事から読み取れる新しい知見を適切な見出しの下に統合してください
- 既存と同じ内容は繰り返さず、重複は整理して1つにまとめること
- 特定チャンピオンの性能の話は含めず、**そのレーンで普遍的に使える立ち回り・判断**に絞ること
- 「## 見出し」で章立てし、各章は箇条書きで読みやすく
- 全体で3000字以内に収まるよう、冗長な部分は圧縮すること

必ず以下のJSONのみ出力（コードブロック禁止）:
{"title":"<ガイドのタイトル。30字以内>","body":"<統合後のMarkdown全文>"}`;

  // レート制限や503で落ちても、ここまでに統合した分は成果として返す（次回は続きから）
  let raw: string;
  try {
      raw = await callGeminiWithRetry(prompt, { temperature: 0.3, maxOutputTokens: 6000, maxRetries: 3 });
  } catch (aiErr: any) {
      const msg = String(aiErr?.message || '');
      if (msg.includes('レート制限') || msg.includes('一時的に利用できません')) {
        throw new RateLimitedError(msg);
      }
      throw aiErr;
  }
  let cleaned = (raw || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
  const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
  if (s < 0 || e <= s) throw new Error('AI出力の解析に失敗しました。');
  const result = JSON.parse(cleaned.slice(s, e + 1));
  if (!result.body) throw new Error('AIが本文を返しませんでした。');

  // 保存の成否を必ず確認する。
  // ここを見ていなかったため、テーブル未作成時に「保存に失敗したのに記事だけ消える」事故が起きた。
  const { error: saveError } = await supabase.from('lane_guides').upsert({
      lane,
      title: result.title || laneLabel,
      body: result.body,
      source_count: (existing?.source_count || 0) + 1,
      updated_at: new Date().toISOString(),
  }, { onConflict: 'lane' });
  if (saveError) throw new Error(`ガイドの保存に失敗しました: ${saveError.message}`);

  // 何がどの記事で増えたのかを後から辿れるように履歴を残す
  await recordRevision({
      targetType: 'lane_guide',
      targetKey: lane,
      field: 'body',
      before: existing?.body,
      after: result.body,
      sourceTitle: a.title,
      sourceId: a.id,
  });

  // 保存が確定してから、統合済みの記事をライブラリから片付ける（復元は「移動済み」から可能）
  await supabase.from('personal_knowledge').update({ tags: ['__DELETED__'] }).eq('id', a.id);
  return { title: result.title || laneLabel };
}

/** 保存済みガイドの取得（メンバー閲覧用なのでGETは認証不要） */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('lane_guides')
      .select('lane, title, body, source_count, updated_at');
    if (error) throw error;
    return NextResponse.json({ success: true, guides: data || [], lanes: LANES });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  let action = 'merge';
  try {
    const body = await req.clone().json();
    action = body?.action || 'merge';
  } catch { /* ボディ無しは従来どおり統合 */ }

  // 復旧: 保存されないまま片付けられてしまったレーン記事をライブラリへ戻す。
  // チャンピオン記事は champion_notes へ正常に移動している可能性があるため対象外にする。
  if (action === 'restore') {
    try {
      const { data: facts } = await supabase.from('champion_facts').select('champion');
      const realChampions = new Set((facts || []).map((f: any) => String(f.champion).toLowerCase()));
      const { data: archived } = await supabase
        .from('personal_knowledge')
        .select('id, title, champion')
        .contains('tags', ['__DELETED__'])
        .limit(1000);

      const restorable = (archived || []).filter((a: any) => {
        const names = String(a.champion || '').split(',').map((c: string) => c.trim().toLowerCase()).filter(Boolean);
        return !names.some((n) => realChampions.has(n));
      });

      if (restorable.length > 0) {
        const { error } = await supabase
          .from('personal_knowledge')
          .update({ tags: [] })
          .in('id', restorable.map((a: any) => a.id));
        if (error) throw error;
      }

      return NextResponse.json({
        success: true,
        restored: restorable.length,
        message: `${restorable.length}件のレーン記事を攻略ライブラリに戻しました。`,
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // 記事を1本だけ、指定したレーンのガイドへ送る。
  // 一括統合は自動判定なので、狙ったレーンへ入れたい場合はこちらを使う。
  if (action === 'merge_one') {
    try {
      const { articleId, lane: requestedLane } = await req.clone().json();
      if (!articleId) return NextResponse.json({ error: 'articleIdが必要です' }, { status: 400 });

      const { data: article } = await supabase
        .from('personal_knowledge')
        .select('id, title, content, raw_content, champion')
        .eq('id', articleId)
        .maybeSingle();
      if (!article) return NextResponse.json({ error: '記事が見つかりません' }, { status: 404 });

      // レーン未指定なら自動判定に任せる
      const lane = requestedLane && LANES.some((l) => l.key === requestedLane)
        ? requestedLane
        : detectLane(article);

      const merged = await mergeArticleIntoLane(article, lane);
      return NextResponse.json({
        success: true,
        lane,
        laneLabel: LANES.find((l) => l.key === lane)?.label || lane,
        title: merged.title,
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  try {
    // 1) チャンピオン記事ではない＝レーン/マクロ記事を集める
    const { data: articles } = await supabase
      .from('personal_knowledge')
      .select('id, title, content, raw_content, champion, genre')
      .or('tags.is.null,tags.not.cs.{__DELETED__}')
      .limit(500);

    // champion欄が空 or 実在しないチャンピオン名（Jungle/macro等）のものが対象
    const { data: facts } = await supabase.from('champion_facts').select('champion');
    const realChampions = new Set((facts || []).map((f: any) => String(f.champion).toLowerCase()));
    const isChampionArticle = (a: any) => {
      const names = String(a.champion || '').split(',').map((c: string) => c.trim().toLowerCase()).filter(Boolean);
      return names.some((n) => realChampions.has(n));
    };

    const targets = (articles || [])
      .filter((a: any) => !isChampionArticle(a))
      .filter((a: any) => (a.raw_content || a.content || '').length >= 200);

    if (targets.length === 0) {
      // なぜ0件なのかが分からないと詰まるので、内訳を返す
      const total = (articles || []).length;
      const champArticles = (articles || []).filter(isChampionArticle).length;
      const tooShort = (articles || []).filter((a: any) => !isChampionArticle(a) && (a.raw_content || a.content || '').length < 200).length;
      return NextResponse.json({
        success: true, merged: 0, remaining: 0, done: true,
        message: `統合対象のレーン記事はありません（ライブラリ内 ${total}件: チャンピオン記事 ${champArticles}件 / 本文200字未満 ${tooShort}件）。`,
        debug: { total, champArticles, tooShort },
      });
    }

    const batch = targets.slice(0, CHUNK);
    const remaining = Math.max(0, targets.length - batch.length);
    const mergedLanes: string[] = [];

    // 2) レーンごとに既存ガイドへ追記マージ
    for (const a of batch) {
      const lane = detectLane(a);
      try {
        await mergeArticleIntoLane(a, lane);
      } catch (err) {
        if (err instanceof RateLimitedError) {
          // ここまでの成果は返し、次回は続きから再開する
          return NextResponse.json({
            success: true,
            merged: mergedLanes.length,
            lanes: mergedLanes,
            remaining: remaining + (batch.length - mergedLanes.length),
            done: false,
            rateLimited: true,
          });
        }
        throw err;
      }
      mergedLanes.push(lane);
    }

    return NextResponse.json({
      success: true,
      merged: mergedLanes.length,
      lanes: mergedLanes,
      remaining,
      done: remaining === 0,
    });
  } catch (e: any) {
    console.error('[lane-guides] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
