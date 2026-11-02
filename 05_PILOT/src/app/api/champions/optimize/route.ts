import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { callGeminiWithRetry } from '@/lib/geminiClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }
    const db = supabase;
    const body = await req.json();
    const { action, championId, optimizedStrategy } = body;

    if (!championId || typeof championId !== 'string') {
      return NextResponse.json({ error: 'championId が必要です' }, { status: 400 });
    }

    // ──────────────────────────────────────────
    // 1. 反映（apply）アクション
    // ──────────────────────────────────────────
    if (action === 'apply') {
      if (!optimizedStrategy || typeof optimizedStrategy !== 'string' || !optimizedStrategy.trim()) {
        return NextResponse.json({ error: '最適化後の教本本文が空です' }, { status: 400 });
      }

      const { data: record, error: selErr } = await db
        .from('matchup_sentinel')
        .select('id, champion, strategy')
        .eq('champion', championId)
        .eq('enemy', 'GLOBAL')
        .maybeSingle();

      if (selErr) throw selErr;
      if (!record) {
        return NextResponse.json({ error: `該当する教本 (${championId} vs GLOBAL) が見つかりません` }, { status: 404 });
      }

      const { error: upErr } = await db
        .from('matchup_sentinel')
        .update({
          strategy: optimizedStrategy.trim(),
        })
        .eq('id', record.id);

      if (upErr) throw upErr;

      return NextResponse.json({
        success: true,
        message: `${championId} の教本を最新の最適化版に更新しました`,
      });
    }

    // ──────────────────────────────────────────
    // 2. プレビュー生成（preview）アクション
    // ──────────────────────────────────────────
    const { data: record, error: selErr } = await db
      .from('matchup_sentinel')
      .select('id, champion, strategy')
      .eq('champion', championId)
      .eq('enemy', 'GLOBAL')
      .maybeSingle();

    if (selErr) throw selErr;
    if (!record || !record.strategy?.trim()) {
      return NextResponse.json({ error: `対象チャンピオン (${championId}) の教本データが存在しません` }, { status: 400 });
    }

    const currentStrategy = record.strategy;

    // 冗長なメタデータヘッダーや連続改行を整理
    const cleanedForPrompt = currentStrategy
      .replace(/>\s*📺\s*\*\*元動画情報\*\*[\s\S]*?---\n+/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const prompt = `あなたはLeague of Legendsのトッププロアナリスト兼エグゼクティブコーチです。
以下は【${championId}】の現在の統合戦術マスター教本（GLOBAL戦略）全文です。
現在、末尾に「## 【記事】...」として多数の動画記事（数十本）が全文貼り付けられ、教本全体が長大化（数万字〜10万字規模）しています。

この動画知見に含まれるプロの判断基準（Why & When、スキル回し・コンボ、パワースパイク、序盤・中盤・集団戦の立ち回り、苦手対面対策、NG行動）を、前半の体系的な戦術構造へ自然に統合・肉付けし、重複する表現を1本化して、実戦で即座に判断できる【最高峰のチャンピオン完全攻略バイブル（4,000〜7,000文字程度）】へ美しく再構築・最適化してください。

【現在の教本全文（全量）】
${cleanedForPrompt}

【再構築・最適化の指針（絶対遵守）】:
1. **本質情報の完全保持（情報の切り捨て厳禁・高密度化）**:
   - 動画知見に含まれる具体的な判断根拠（Why & When）、コンボ順（例: Q3温存、Eキャンセル）、アイテム選択基準、実戦Tipsなどの重要な知見は**一切切り捨てず**、該当する各セクションに漏らさず美しく組み込んでください。
2. **重複の整理と文章の洗練**:
   - 似たような解説（例: フルクリア、キャンプ狩り方、定番ビルド）は統合・整理し、プレイヤーが試合前・試合中に一目で判断できるように体系化してください。
3. **動画インデックスのスマートな目次化**:
   - 末尾に「## 実戦動画・プロ解説マクロインデックス」を設け、主要な動画タイトルとYouTubeリンク、そしてその動画から得られる核心Tips（1〜2行）をコンパクトな目次リストとしてまとめてください（記事全文のベタ貼りは厳禁）。
4. **章立ての統一（Markdown形式）**:
   - 以下の階層構造を尊重して視覚的に美しく整理してください：
     - ## 1. チャンピオンの本質と勝利条件（コアコンセプト）
     - ## 2. スキル運用・コンボ・固有メカニクス（ミクロ極意）
     - ## 3. 序盤の立ち回りとテンポ管理（Lv1〜6・ファーム・ガンク）
     - ## 4. ビルドパス・パワースパイク・アイテム使い分け
     - ## 5. 中盤・オブジェクト・集団戦のポジショニング
     - ## 6. 🚨 絶対回避事項（NG行動リスト）
     - ## 7. 実戦動画・プロ解説マクロインデックス（参照リンク集）
5. **出力形式**:
   - 最適化後の教本全文をMarkdown形式のみで出力してください（\`\`\`markdown などのコードブロック記法は不要です）。`;

    const rawOptimized = await callGeminiWithRetry(prompt, {
      temperature: 0.2,
      maxOutputTokens: 8192,
      timeoutMs: 120000,
    });
    const cleanedOptimized = (rawOptimized || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();

    return NextResponse.json({
      success: true,
      championId,
      currentStrategy,
      optimizedStrategy: cleanedOptimized || currentStrategy,
    });
  } catch (e: any) {
    console.error('[champions/optimize] エラー:', e);
    return NextResponse.json({ error: e.message || '最適化処理に失敗しました' }, { status: 500 });
  }
}
