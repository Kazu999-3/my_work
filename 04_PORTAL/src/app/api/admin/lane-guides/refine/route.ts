import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';
import { recordRevision } from '../../../../../lib/knowledgeRevisions';
import { LANES } from '../../../../../lib/laneGuideMerge';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export interface EditAnnotation {
  originalSnippet: string;
  action: 'moved' | 'deleted_duplicate' | 'deleted_noise' | 'updated_2026';
  targetChapter: string;
  reason: string;
}

/**
 * レーン別ガイドのAI清書・体系化リライトAPI
 * 1. 2026年最新仕様に基づくフルボリュームの完全攻略ガイド（Markdown本文）を生成
 * 2. 元の生文章の各段落に対する朱入れマップ（移動先・削除理由・2026更新）を生成
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

    // 🎯 ステップ1: フルボリュームの長文Markdown攻略本文を生成（省略厳禁）
    const generateGuidePrompt = `あなたはLeague of Legendsの最高峰の戦略アナリスト兼プロコーチです。
以下は、${laneMeta.label}に関して様々な解説記事から収集・追記された【蓄積生データ】です。
この生データに含まれる全ての重要知見・具体的ノウハウを漏らさず網羅し、以下の5大章立てで【2500文字以上の完全な長文攻略バイブル】を書き下ろしてください。

━━━━━━━━━━━━━━━━━━━━
【🚨 2026年シーズン最新仕様の厳格適用】
- 初動ミニオン0:30、キャンプ湧き0:55、初動スカトル（蟹）出現は【2:55】（※3:30は過去仕様）。
- 初代ドラゴン【5:00】（5分リスポーン）。
- ヴォイドグラブ【8:00】（1回のみ、14:45消滅）。
- リフトヘラルド【15:00】（19:45消滅）。
- バロンナッシャー【20:00】（6分リスポーン）。
- タワープレートは14分消滅ではなく【永続（Permanent）】仕様。

【構成ルール】
以下の5つの大見出し（##）を必ず使い、各見出しの下に【具体的な行動・状況別の判断基準・箇条書き】を詳細に書き下ろしてください。
決して要約したり省略記号（...）で端折ったりせず、最高品質の実践マニュアルとして出力してください：

## 1. ${laneMeta.label}の基本思想と勝利条件（コアコンセプト）
## 2. 序盤戦術（Lv1〜6・2:55スカトル争奪・ウェーブ管理とトレード原則）
## 3. 中盤戦術（8:00グラブ・15:00ヘラルド・サイドプッシュ・ローム）
## 4. 終盤戦術・集団戦（20分以降・バロン戦・オブジェクト戦・ポジション取り）
## 5. 勝率を底上げする2026マクロ原則とよくある負け筋の回避
${laneSpecificInstruction}
━━━━━━━━━━━━━━━━━━━━

【蓄積生データ】
${baseBody}

※余計な挨拶やコードブロック解説は一切出力せず、Markdown本文のみを出力してください。`;

    const refinedRaw = await callGeminiWithRetry(generateGuidePrompt, { temperature: 0.2, maxOutputTokens: 8192 });
    let refinedBody = refinedRaw.replace(/```(?:markdown)?/g, '').replace(/```/g, '').trim();

    // 🎯 ステップ2: 元の生文章に対する朱入れマップ（移動先・削除理由・2026更新）の抽出
    const auditPrompt = `あなたはLeague of Legendsの編集デスクです。
以下の【元データの各段落・主要トピック】が、清書版でどう扱われたかを1つずつ分析してください。

【元データ】
${baseBody}

以下のフォーマットで1行ずつ出力してください（Markdown箇条書き）：
- [元データの具体的な文やトピックの抜粋] || [action: moved / deleted_duplicate / deleted_noise / updated_2026] || [第○章へ統合 / 理由: ○○と重複のため1本化 / 2026年仕様へ補正]
`;

    let editMap: EditAnnotation[] = [];
    try {
      const auditRaw = await callGeminiWithRetry(auditPrompt, { temperature: 0.1, maxOutputTokens: 4096 });
      const lines = auditRaw.split('\n');
      for (const line of lines) {
        const m = line.match(/^-\s*\[(.*?)\]\s*\|\|\s*\[?(.*?)\]?\s*\|\|\s*\[?(.*?)\]?$/);
        if (m && m[1] && m[3]) {
          const rawAction = m[2]?.trim().toLowerCase() || 'moved';
          let action: EditAnnotation['action'] = 'moved';
          if (rawAction.includes('duplicate')) action = 'deleted_duplicate';
          else if (rawAction.includes('noise')) action = 'deleted_noise';
          else if (rawAction.includes('2026') || rawAction.includes('update')) action = 'updated_2026';

          editMap.push({
            originalSnippet: m[1].trim(),
            action,
            targetChapter: m[3].trim(),
            reason: m[3].trim(),
          });
        }
      }
    } catch (e) {
      console.warn('[refine] editMap parse warning:', e);
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
        editMap,
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
      editMap,
    });
  } catch (err: any) {
    console.error('[lane-guides/refine] error:', err);
    return NextResponse.json({ error: err.message || '清書処理に失敗しました' }, { status: 500 });
  }
}
