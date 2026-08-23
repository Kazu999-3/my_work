import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';
import { recordRevision } from '../../../../../lib/knowledgeRevisions';
import { LANES } from '../../../../../lib/laneGuideMerge';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * レーン別ガイドのAI清書・体系化リライトAPI
 * 複数の記事から蓄積されたパッチワーク文章を、重複を排除し、
 * 序盤・中盤・終盤・マクロ原則の美しい章立てで1本の完全攻略ガイドに再構成する。
 */
export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const { lane, dryRun = false } = body;

    if (!lane) {
      return NextResponse.json({ error: 'lane は必須です' }, { status: 400 });
    }

    const laneMeta = LANES.find((l) => l.key === lane) || { key: lane, label: `${lane} レーン` };

    // 現在のガイドを取得
    const { data: guide, error: fetchErr } = await supabase
      .from('lane_guides')
      .select('lane, title, body, source_count')
      .eq('lane', lane)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!guide || !guide.body || guide.body.trim().length === 0) {
      return NextResponse.json({ error: '清書対象のガイド知見がまだありません' }, { status: 400 });
    }

    const isCommon = lane === 'COMMON';
    const laneSpecificInstruction = isCommon
      ? `- 【全レーン共通】どのロール・どのチャンピオンでも通用する普遍的なマクロ原則・判断基準に統一してください。特定のチャンピオン名や個別スキルの解説は含めないでください。`
      : `- 【${laneMeta.label}専用】このレーン特有の視界管理、ローム判断、ウェーブコントロール、マッチアップ原則を具体的に掘り下げてください。`;

    const prompt = `あなたはLeague of Legendsの最高峰の戦略アナリスト兼プロコーチです。
以下は、${laneMeta.label}に関して様々な解説動画や記事から収集・追記された【蓄積知見】です。
多くの記事が追記されたため、文章に重複や散らかりが生じています。

この蓄積知見の【全ての重要戦術・具体的ノウハウ】を漏らさず網羅した上で、
無駄な重複を完全に排除し、初心者から上級者まで実践できる「究極の体系的攻略マニュアル」として1本の洗練されたMarkdownドキュメントに清書・リライトしてください。

━━━━━━━━━━━━━━━━━━━━
【執筆ルール】
1. **章立ての徹底**:
   以下の体系的な構成で美しくMarkdown見出し（##, ###）を組み立ててください：
   - ## 1. ${laneMeta.label}の基本思想と勝利条件（コアコンセプト）
   - ## 2. 序盤戦術（Lv1〜6・ウェーブ管理とトレード原則）
   - ## 3. 中盤戦術（14分以降・タワー折衝・サイドプッシュ・ローム）
   - ## 4. 終盤戦術・集団戦（20分以降・オブジェクト戦・ポジション取り）
   - ## 5. 勝率を底上げするマクロ原則とよくある負け筋の回避
2. **重複の完全排除**:
   同じ内容（例: リコールタイミング、ガンク警戒など）が複数回書かれている場合は、最も具体的で分かりやすい一箇所に統合してください。
3. **具体性の維持**:
   「意識する」「気をつける」といった抽象表現を避け、「相手JGがTopに見えたら即座にBotでダイブまたはドラゴンを触る」のように【状況＋具体的行動】で記述してください。
${laneSpecificInstruction}
4. **出力形式**:
   余計な挨拶や解説（「はい、清書しました」など）は一切出力せず、Markdown本文のみを出力してください。
━━━━━━━━━━━━━━━━━━━━

【蓄積された生データ】
${guide.body}
`;

    const refinedBody = await callGeminiWithRetry(prompt, { temperature: 0.2 });

    if (!refinedBody || refinedBody.trim().length < 50) {
      throw new Error('AIによる清書の生成に失敗しました（出力が短すぎます）');
    }

    const cleanBody = refinedBody.trim();
    const refinedTitle = `${laneMeta.label} 完全攻略・マクロ戦術バイブル`;

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        lane,
        title: refinedTitle,
        refinedBody: cleanBody,
        originalBody: guide.body,
        sourceCount: guide.source_count,
      });
    }

    // データベースへ保存
    const { error: saveErr } = await supabase
      .from('lane_guides')
      .upsert({
        lane,
        title: refinedTitle,
        body: cleanBody,
        source_count: guide.source_count,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lane' });

    if (saveErr) throw saveErr;

    // リビジョン履歴に記録
    await recordRevision({
      targetType: 'lane_guide',
      targetKey: lane,
      field: 'body',
      before: guide.body,
      after: cleanBody,
      sourceTitle: 'AI体系化リライト（清書・重複排除）',
    });

    return NextResponse.json({
      success: true,
      dryRun: false,
      lane,
      title: refinedTitle,
      body: cleanBody,
      sourceCount: guide.source_count,
    });
  } catch (err: any) {
    console.error('[lane-guides/refine] error:', err);
    return NextResponse.json({ error: err.message || '清書処理に失敗しました' }, { status: 500 });
  }
}
