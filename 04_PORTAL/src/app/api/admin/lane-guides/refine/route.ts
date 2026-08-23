import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';
import { recordRevision } from '../../../../../lib/knowledgeRevisions';
import { LANES } from '../../../../../lib/laneGuideMerge';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export interface KeyPointAudit {
  topic: string;
  targetSection: string;
}

export interface DuplicateAudit {
  duplicateSummary: string;
  resolvedAction: string;
}

/**
 * レーン別ガイドのAI清書・体系化リライトAPI
 * 蓄積知見を2026年最新仕様で完全体系化しつつ、
 * 「元データの重要情報が漏れなく引き継がれているか」を監査する重要知見網羅レポート(Key Points Audit)を同時に返却する。
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

    const baseBody = guide?.body;
    if (!baseBody || baseBody.trim().length === 0) {
      return NextResponse.json({ error: '清書対象のガイド知見がまだありません' }, { status: 400 });
    }

    const isCommon = lane === 'COMMON';
    const laneSpecificInstruction = isCommon
      ? `- 【全レーン共通】どのロール・どのチャンピオンでも通用する普遍的なマクロ原則・判断基準に統一してください。特定のチャンピオン名や個別スキルの解説は含めないでください。`
      : `- 【${laneMeta.label}専用】このレーン特有の視界管理、ローム判断、ウェーブコントロール、マッチアップ原則を具体的に掘り下げてください。`;

    const prompt = `あなたはLeague of Legendsの最高峰の戦略アナリスト兼プロコーチです。
以下は、${laneMeta.label}に関して様々な解説記事から収集・追記された【蓄積知見】です。

━━━━━━━━━━━━━━━━━━━━
【🚨 最重要ミッション：重要知見の欠落ゼロ ＆ 2026年最新仕様の適用】
1. **情報欠落の完全防止**:
   元の生データに含まれる【具体的戦術・テクニック・注意点・判断基準】を絶対に削除・省略しないでください。
   すべての具体的知見を、適切な章の下に100%網羅して組み込んでください。
2. **2026年シーズン最新仕様の厳格適用**:
   - 初動ミニオン0:30、キャンプ湧き0:55、初動スカトル（蟹）出現は【2:55】（※3:30は過去仕様）。
   - 初代ドラゴン【5:00】（5分リスポーン）。
   - ヴォイドグラブ【8:00】（1回のみ、14:45消滅）。
   - リフトヘラルド【15:00】（19:45消滅）。
   - バロンナッシャー【20:00】（6分リスポーン）。
   - タワープレートは14分消滅ではなく【永続（Permanent）】仕様。
3. **章立ての構造**:
   - ## 1. ${laneMeta.label}の基本思想と勝利条件（コアコンセプト）
   - ## 2. 序盤戦術（Lv1〜6・2:55スカトル争奪・ウェーブ管理とトレード原則）
   - ## 3. 中盤戦術（8:00グラブ・15:00ヘラルド・サイドプッシュ・ローム）
   - ## 4. 終盤戦術・集団戦（20分以降・バロン戦・オブジェクト戦・ポジション取り）
   - ## 5. 勝率を底上げする2026マクロ原則とよくある負け筋の回避
${laneSpecificInstruction}
4. **監査レポート（重要知見の網羅性チェック）の作成**:
   元データに含まれていた【主要戦術・ノウハウ（5〜10個）】を抽出し、清書版のどの章に継承されたかをリスト化してください。
   また、重複として1本化された内容があればそれも記載してください。
━━━━━━━━━━━━━━━━━━━━

【蓄積生データ】
${baseBody}

以下のJSONフォーマットのみを出力してください（Markdownコードブロックで囲む）：
\`\`\`json
{
  "refinedBody": "## 1. ...\\n## 2. ...\\n（清書後の完全Markdown本文）",
  "retainedKeyPoints": [
    { "topic": "2:55初動スカトルでのレーン主導権と寄りの判断", "targetSection": "第2章: 序盤戦術" },
    { "topic": "8:00ヴォイドグラブ出現前のウェーブプッシュ原則", "targetSection": "第3章: 中盤戦術" },
    { "topic": "永続タワープレートの削り方とリコールタイミング", "targetSection": "第2章・第3章" }
  ],
  "consolidatedDuplicates": [
    { "duplicateSummary": "複数記事に重複していたリコールタイミングの記述", "resolvedAction": "第2章に最も具体的な判断基準として1本化統合" }
  ]
}
\`\`\`
`;

    const rawResponse = await callGeminiWithRetry(prompt, { temperature: 0.2 });

    let refinedBody = '';
    let retainedKeyPoints: KeyPointAudit[] = [];
    let consolidatedDuplicates: DuplicateAudit[] = [];

    try {
      const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawResponse;
      const parsed = JSON.parse(jsonStr.trim());
      refinedBody = parsed.refinedBody || '';
      retainedKeyPoints = parsed.retainedKeyPoints || [];
      consolidatedDuplicates = parsed.consolidatedDuplicates || [];
    } catch {
      // JSONパースに失敗した場合は生テキストをそのままMarkdownとして扱う
      refinedBody = rawResponse.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    }

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
        originalBody: baseBody,
        sourceCount: guide?.source_count || 0,
        retainedKeyPoints,
        consolidatedDuplicates,
      });
    }

    // データベースへ保存
    const { error: saveErr } = await supabase
      .from('lane_guides')
      .upsert({
        lane,
        title: refinedTitle,
        body: cleanBody,
        source_count: guide?.source_count || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lane' });

    if (saveErr) throw saveErr;

    // リビジョン履歴に記録
    await recordRevision({
      targetType: 'lane_guide',
      targetKey: lane,
      field: 'body',
      before: guide?.body,
      after: cleanBody,
      sourceTitle: 'AI完全清書・体系化リライト',
    });

    return NextResponse.json({
      success: true,
      dryRun: false,
      lane,
      title: refinedTitle,
      body: cleanBody,
      sourceCount: guide?.source_count || 0,
      retainedKeyPoints,
      consolidatedDuplicates,
    });
  } catch (err: any) {
    console.error('[lane-guides/refine] error:', err);
    return NextResponse.json({ error: err.message || '清書処理に失敗しました' }, { status: 500 });
  }
}
