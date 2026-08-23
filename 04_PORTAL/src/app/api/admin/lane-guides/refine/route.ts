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

export interface KeyPointAudit {
  topic: string;
  targetSection: string;
}

/**
 * レーン別ガイドのAI清書・体系化リライトAPI
 * 蓄積知見を2026年最新仕様で完全体系化しつつ、
 * 元文章の各段落が「何章に移動したか/なぜ削除されたか」の朱入れ編集マップ(Edit Annotations)を返却する。
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
【🚨 最重要ミッション】
1. **元文章の朱入れ編集マップ（段落追跡）**:
   元の蓄積データに含まれる各段落・主要トピックが「清書後にどう扱われたか」を1つずつ追跡してください：
   - どこの章（第1章〜第5章）に移動・統合されたか
   - なぜ重複削除されたか（「第2章のリコール解説と重複のため1本化」など）
   - 2026年最新仕様（2:55スカトル等）にどう補正されたか

2. **2026年シーズン最新仕様の厳格適用**:
   - 初動ミニオン0:30、キャンプ湧き0:55、初動スカトル（蟹）出現は【2:55】（※3:30は過去仕様）。
   - 初代ドラゴン【5:00】（5分リスポーン）。
   - ヴォイドグラブ【8:00】（1回のみ、14:45消滅）。
   - リフトヘラルド【15:00】（19:45消滅）。
   - バロンナッシャー【20:00】（6分リスポーン）。
   - タワープレートは14分消滅ではなく【永続（Permanent）】仕様。

3. **清書後の完全Markdown出力（※省略・短縮は絶対に禁止）**:
   以下の5大章立てで、元データの具体的戦術・テクニックをすべて詳細に書き下ろしてください（2000〜4000文字の完全な長文攻略ガイドとして出力すること。「...」などで省略することは厳禁です）：
   - ## 1. ${laneMeta.label}の基本思想と勝利条件（コアコンセプト）
   - ## 2. 序盤戦術（Lv1〜6・2:55スカトル争奪・ウェーブ管理とトレード原則）
   - ## 3. 中盤戦術（8:00グラブ・15:00ヘラルド・サイドプッシュ・ローム）
   - ## 4. 終盤戦術・集団戦（20分以降・バロン戦・オブジェクト戦・ポジション取り）
   - ## 5. 勝率を底上げする2026マクロ原則とよくある負け筋の回避
${laneSpecificInstruction}
━━━━━━━━━━━━━━━━━━━━

【蓄積生データ】
${baseBody}

【出力フォーマット（厳格遵守）】
以下の2つの区切りタグを使って出力してください：

===EDIT_MAP===
- [元データの段落や文の抜粋] || [action: moved / deleted_duplicate / deleted_noise / updated_2026] || [移動先・理由: 第2章: 序盤戦術へ統合 / 第2章と重複のためカット / 3:30から2:55へ補正]
（元データの段落・トピックを網羅して10〜20件記述）

===REFINED_BODY===
（ここに第1章から第5章までの詳細なMarkdown攻略本文を全文漏らさず記述してください。省略は一切禁止です）
`;

    const rawResponse = await callGeminiWithRetry(prompt, { temperature: 0.2, maxOutputTokens: 6000 });

    let refinedBody = '';
    let editMap: EditAnnotation[] = [];

    // セクション区切り（===REFINED_BODY===）の抽出
    if (rawResponse.includes('===REFINED_BODY===')) {
      const parts = rawResponse.split('===REFINED_BODY===');
      refinedBody = parts[1]?.trim() || '';

      const metaPart = parts[0];

      // EDIT_MAP のパース
      if (metaPart.includes('===EDIT_MAP===')) {
        const editMapPart = metaPart.split('===EDIT_MAP===')[1];
        const editLines = editMapPart.split('\n');
        for (const line of editLines) {
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
      }
    } else {
      refinedBody = rawResponse.replace(/```(?:markdown)?/g, '').replace(/```/g, '').trim();
    }

    if (!refinedBody || refinedBody.length < 200) {
      // 万が一短すぎる場合は生データベースでフルプロンプト再実行
      const fallbackPrompt = `あなたはLeague of Legendsの戦略アナリスト兼プロコーチです。
以下は「${laneMeta.label}」の蓄積知見データです。
2026年最新仕様（2:55スカトル、8:00グラブ、15:00ヘラルド、20:00バロン、永続タワープレート）を適用し、
以下の5大章立てで、具体的戦術を省略せず詳細に完全書き下ろしたMarkdown攻略ガイドを出力してください：
- ## 1. ${laneMeta.label}の基本思想と勝利条件
- ## 2. 序盤戦術（Lv1〜6・2:55スカトル争奪・ウェーブ管理）
- ## 3. 中盤戦術（8:00グラブ・15:00ヘラルド・サイドプッシュ）
- ## 4. 終盤戦術・集団戦（20分以降・バロン戦・ポジション取り）
- ## 5. 勝率を底上げする2026マクロ原則

【生データ】
${baseBody}
`;
      refinedBody = await callGeminiWithRetry(fallbackPrompt, { temperature: 0.2, maxOutputTokens: 6000 });
      refinedBody = refinedBody.replace(/```(?:markdown)?/g, '').replace(/```/g, '').trim();
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
