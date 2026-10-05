import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { LaneKey, LANE_CONFIG } from '@/lib/laneDetector';
import { callGeminiWithRetry } from '@/lib/geminiClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }
    const db = supabase;
    const body = await req.json();
    const { action, lane, optimizedBody } = body;

    const targetLane = (lane || 'JG') as LaneKey;
    const laneInfo = LANE_CONFIG[targetLane] || LANE_CONFIG.COMMON;

    // ──────────────────────────────────────────
    // 1. 反映（apply）アクション
    // ──────────────────────────────────────────
    if (action === 'apply') {
      if (!optimizedBody || typeof optimizedBody !== 'string' || !optimizedBody.trim()) {
        return NextResponse.json({ error: '最適化後の本文が空です' }, { status: 400 });
      }

      const { data: record, error: selErr } = await db
        .from('lane_guides')
        .select('title, source_count')
        .eq('lane', targetLane)
        .maybeSingle();

      if (selErr) throw selErr;

      const { error: upErr } = await db
        .from('lane_guides')
        .upsert({
          lane: targetLane,
          title: record?.title || `${laneInfo.name} レーン攻略ガイド`,
          body: optimizedBody.trim(),
          source_count: record?.source_count || 1,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'lane' });

      if (upErr) throw upErr;

      return NextResponse.json({
        success: true,
        message: `${laneInfo.name} ガイドを最新の最適化版に更新しました`,
      });
    }

    // ──────────────────────────────────────────
    // 2. プレビュー生成（preview）アクション
    // ──────────────────────────────────────────
    const { data: record, error: selErr } = await db
      .from('lane_guides')
      .select('lane, title, body, source_count')
      .eq('lane', targetLane)
      .maybeSingle();

    if (selErr) throw selErr;

    const currentBody = record?.body || '';
    if (!currentBody.trim()) {
      return NextResponse.json({ error: '対象レーンのガイド本文が存在しません' }, { status: 400 });
    }

    const prompt = `あなたはLeague of Legendsのトッププロアナリスト兼エグゼクティブコーチです。
以下は【${laneInfo.name}】レーンの現在の攻略ガイド全文です。
末尾の「第8章（実戦動画・プロ解説マクロ知見アーカイブ）」などに蓄積された最新知見を、ガイド全体の体系的な各章（序盤・ウェーブ管理、中盤・オブジェクト判断、集団戦、時間帯別の立ち回り等）へ**自然に組み込み、重複を排除して、1本の洗練された完全版バイブルへと再構築・最適化**してください。

【現在のガイド全文】
${currentBody.slice(0, 20000)}

【再構築・最適化の指針（絶対遵守）】:
1. **本質情報の完全保持（情報の切り捨て厳禁）**:
   - 第8章の動画知見に含まれる具体的な判断根拠（Why & When）、ウェーブコントロール、寄りの基準、実戦Tipsなどの重要な知見は**一切切り捨てず**、該当する各章に漏らさず美しく組み込んでください。
2. **重複の整理と文章の洗練**:
   - 似たような解説や重複したTipsは統合・整理し、プレイヤーが通読して即座に実戦で判断できるように体系化してください。
3. **章立ての統一（Markdown形式）**:
   - 既存の章立て（## 1. 〜、## 2. 〜）を尊重し、各章の中で「### 🌊 〜」「- **〜**: 〜」のように視覚的に読みやすく階層化してください。
   - 第8章は「## 実戦動画・プロ解説からの最新マクロ知見（Why & When アーカイブ）」として、各動画の出典リンクと要点をコンパクトに整理した参照用インデックスとして残してください。
4. **出力形式**:
   - 最適化後のガイド全文をMarkdown形式のみで出力してください（\`\`\`markdown などのコードブロック記法は不要です）。`;

    const rawOptimized = await callGeminiWithRetry(prompt, { temperature: 0.2, maxOutputTokens: 7500 });
    const cleanedOptimized = (rawOptimized || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();

    return NextResponse.json({
      success: true,
      lane: targetLane,
      laneName: laneInfo.name,
      currentBody,
      optimizedBody: cleanedOptimized || currentBody,
      sourceCount: record?.source_count || 0,
    });
  } catch (e: any) {
    console.error('[lane-guides/optimize] エラー:', e);
    return NextResponse.json({ error: e.message || '最適化処理に失敗しました' }, { status: 500 });
  }
}
