import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

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
      return NextResponse.json({ success: true, merged: 0, remaining: 0, done: true, message: '統合対象のレーン記事はありません。' });
    }

    const batch = targets.slice(0, CHUNK);
    const remaining = Math.max(0, targets.length - batch.length);
    const mergedLanes: string[] = [];

    // 2) レーンごとに既存ガイドへ追記マージ
    for (const a of batch) {
      const lane = detectLane(a);
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

      const raw = await callGeminiWithRetry(prompt, { temperature: 0.3, maxOutputTokens: 6000, maxRetries: 2 });
      let cleaned = (raw || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
      if (s < 0 || e <= s) continue; // 解析できなければこの記事はスキップ（次回再挑戦）
      const result = JSON.parse(cleaned.slice(s, e + 1));
      if (!result.body) continue;

      await supabase.from('lane_guides').upsert({
        lane,
        title: result.title || laneLabel,
        body: result.body,
        source_count: (existing?.source_count || 0) + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lane' });

      // 統合済みの記事はライブラリから片付ける（復元は「移動済み」から可能）
      await supabase.from('personal_knowledge').update({ tags: ['__DELETED__'] }).eq('id', a.id);
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
