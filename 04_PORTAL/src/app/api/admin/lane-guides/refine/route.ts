import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';
import { recordRevision } from '../../../../../lib/knowledgeRevisions';
import { LANES } from '../../../../../lib/laneGuideMerge';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export type RefineStage = 'dedup' | 'meta_align' | 'structure' | 'all';

/**
 * レーン別ガイドのAI段階的清書・体系化リライトAPI
 * ステージ1: 重複・ノイズ排除（元構成を維持しつつ重複のみ削除 ➔ Diff比較が最も綺麗に効く）
 * ステージ2: 2026年最新メタ・表記統一（スカトル2:55、グラブ8:00、永続プレート等への補正）
 * ステージ3: 究極の章立て・体系化（序盤・中盤・終盤・マクロの5大章立てにリライト）
 */
export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const { lane, stage = 'all', inputBody, dryRun = false } = body;

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

    const baseBody = inputBody || guide?.body;
    if (!baseBody || baseBody.trim().length === 0) {
      return NextResponse.json({ error: '清書対象のガイド知見がまだありません' }, { status: 400 });
    }

    const isCommon = lane === 'COMMON';
    const laneSpecificInstruction = isCommon
      ? `- 【全レーン共通】どのロール・どのチャンピオンでも通用する普遍的なマクロ原則・判断基準に統一してください。特定のチャンピオン名や個別スキルの解説は含めないでください。`
      : `- 【${laneMeta.label}専用】このレーン特有の視界管理、ローム判断、ウェーブコントロール、マッチアップ原則を具体的に掘り下げてください。`;

    let prompt = '';
    let stageTitle = '';

    if (stage === 'dedup') {
      // 🧹 ステージ1: 重複・ノイズの排除（元の文章構成・段落を維持）
      stageTitle = '第1段階: 重複・ノイズ排除';
      prompt = `あなたはLeague of Legendsの戦略アナリストです。
以下は、${laneMeta.label}に関して様々な記事から追記された【蓄積知見】です。

【最重要指示】
元の文章の構成、段落、見出しの骨格は【できる限りそのまま維持】してください。
その上で、以下の作業のみを行ってください：
1. **重複記述のカット**: 同じノウハウや立ち回りが複数回書かれている場合、1箇所を残して他方の重複行・段落を削除する。
2. **ノイズ・無駄な文頭文末の削除**: 「〜〜という意見もあります」「動画の解説によると」などの前置きや余計な挨拶文を削除し、簡潔にする。
3. **重要知見の保持**: 個別の具体的テクニックや注意点は削らずに必ず残す。

※この段階では大がかりな章立ての再編は行わず、元の文章から重複とノイズだけを取り除いたMarkdownを出力してください。
余計な解説は一切出力せず、本文のみを出力してください。

【蓄積生データ】
${baseBody}
`;
    } else if (stage === 'meta_align') {
      // ⏱ ステージ2: 2026年最新メタ・表記統一
      stageTitle = '第2段階: 2026年最新仕様・表記統一';
      prompt = `あなたはLeague of Legendsの戦略アナリストです。
以下は、${laneMeta.label}の攻略知見テキストです。

【最重要指示】
以下の【2026年最新仕様】に基づき、文章内の古い数値・出現時間・仕様を正確に補正・統一してください：
- 【試合開始】ミニオン湧き0:30、ジャングルキャンプ湧き0:55、初動スカトル（蟹）出現は【2:55】（※3:30は過去パッチの古い情報なので2:55に修正）。
- 【オブジェクト】初代ドラゴン【5:00】（5分リスポーン）、ヴォイドグラブ【8:00】（14:45消滅）、ヘラルド【15:00】（19:45消滅）、バロン【20:00】（6分リスポーン）。
- 【タワープレート】タワープレートは14分で消滅せず【永続（Permanent）】仕様。
- 表現を具体的かつ統一されたプロのトーン＆マナーに整える。

余計な解説は一切出力せず、修正後のMarkdown本文のみを出力してください。

【対象テキスト】
${baseBody}
`;
    } else if (stage === 'structure') {
      // 🏛 ステージ3: 究極の章立て・体系化
      stageTitle = '第3段階: 序盤・中盤・終盤の完全体系化';
      prompt = `あなたはLeague of Legendsの最高峰プロコーチです。
以下は、${laneMeta.label}の攻略知見データです。
すべての重要戦術・具体的ノウハウを網羅し、初心者から上級者まで実践できる「究極の体系的攻略マニュアル」として以下の5大章立てに美しく再構成してください：

- ## 1. ${laneMeta.label}の基本思想と勝利条件（コアコンセプト）
- ## 2. 序盤戦術（Lv1〜6・2:55スカトル・ウェーブ管理とトレード原則）
- ## 3. 中盤戦術（8:00グラブ・15:00ヘラルド・サイドプッシュ・ローム）
- ## 4. 終盤戦術・集団戦（20分以降・バロン戦・オブジェクト戦・ポジション取り）
- ## 5. 勝率を底上げする2026マクロ原則とよくある負け筋の回避

${laneSpecificInstruction}
余計な解説は一切出力せず、Markdown本文のみを出力してください。

【対象テキスト】
${baseBody}
`;
    } else {
      // 一括（all）
      stageTitle = '完全清書・体系化';
      prompt = `あなたはLeague of Legendsの最高峰の戦略アナリスト兼プロコーチです。
以下は、${laneMeta.label}に関して様々な解説動画や記事から収集・追記された【蓄積知見】です。

【🚨 2026年シーズン最新仕様の厳格適用ルール】
- 【試合開始・初動】ミニオン湧き0:30、ジャングルキャンプ湧き0:55、初動スカトル（Scuttle Crab）出現は【2:55】（※3:30は過去パッチの古い情報なので絶対に出力しないでください）。
- 【中立オブジェクト】初代ドラゴン【5:00】、ヴォイドグラブ【8:00】（14:45消滅）、ヘラルド【15:00】（19:45消滅）、バロン【20:00】。
- 【タワープレート】タワープレートは14分で消滅せず【永続（Permanent）】仕様。

【執筆ルール】
1. 以下の5大章立てで美しくMarkdown見出しを組み立てる：
   - ## 1. ${laneMeta.label}の基本思想と勝利条件
   - ## 2. 序盤戦術（Lv1〜6・2:55スカトル・ウェーブ管理）
   - ## 3. 中盤戦術（8:00グラブ・15:00ヘラルド・サイドプッシュ）
   - ## 4. 終盤戦術・集団戦（20分以降・バロン戦・ポジション取り）
   - ## 5. 勝率を底上げする2026マクロ原則
2. 重複の完全排除
3. 「状況＋具体的行動」での記述
${laneSpecificInstruction}

余計な挨拶や解説は一切出力せず、Markdown本文のみを出力してください。

【蓄積された生データ】
${baseBody}
`;
    }

    const refinedBody = await callGeminiWithRetry(prompt, { temperature: 0.2 });

    if (!refinedBody || refinedBody.trim().length < 30) {
      throw new Error('AIによる清書の生成に失敗しました（出力が短すぎます）');
    }

    const cleanBody = refinedBody.trim();
    const refinedTitle = `${laneMeta.label} 完全攻略・マクロ戦術バイブル`;

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        lane,
        stage,
        stageTitle,
        title: refinedTitle,
        refinedBody: cleanBody,
        originalBody: baseBody,
        sourceCount: guide?.source_count || 0,
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
      sourceTitle: `AI清書 [${stageTitle}]`,
    });

    return NextResponse.json({
      success: true,
      dryRun: false,
      lane,
      stage,
      stageTitle,
      title: refinedTitle,
      body: cleanBody,
      sourceCount: guide?.source_count || 0,
    });
  } catch (err: any) {
    console.error('[lane-guides/refine] error:', err);
    return NextResponse.json({ error: err.message || '清書処理に失敗しました' }, { status: 500 });
  }
}
