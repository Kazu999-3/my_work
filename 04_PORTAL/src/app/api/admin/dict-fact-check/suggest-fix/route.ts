import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      champion,
      issue_type,
      summary,
      conflict_reason,
      target_field,
      current_value,
      claim_a,
      claim_b,
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;

    // フォールバック用の基本テキスト生成
    const fallbackSuggestion = claim_a || conflict_reason || summary || '指摘内容に基づき修正された内容';

    if (!apiKey) {
      return NextResponse.json({
        suggested_text: fallbackSuggestion,
        explanation: 'APIキー未設定のため、指摘内容から基本案を抽出しました。',
      });
    }

    const prompt = `あなたはLeague of Legendsのプロフェッショナルコーチ兼データ管理者です。
現在、チャンピオン辞典およびナレッジのファクトチェック（事実確認・整合性チェック）を行っています。
以下の問題指摘および現在の記載内容を確認し、問題点を解消した【修正後の推奨テキスト】を1つ作成してください。

【対象チャンピオン】: ${champion || '不明'}
【項目名 / フィールド】: ${target_field || '未指定'}
【指摘種別】: ${issue_type || '事実確認'}
【指摘サマリー】: ${summary || 'なし'}
【食い違い・問題の理由】: ${conflict_reason || 'なし'}
${claim_a ? `【候補 A】: ${claim_a}` : ''}
${claim_b ? `【候補 B】: ${claim_b}` : ''}
${current_value ? `【現在の記載内容】:\n${current_value}` : ''}

【指示】
1. 誤りや矛盾を解消し、プレイヤーにとって正確・実践的・簡潔な文章にリライトしてください。
2. 語尾やトーンは既存の辞典スタイル（です・ます調、または箇条書きの体言止めスタイルに合わせる）に統一してください。
3. 出力は必ず以下のJSON形式のみで返してください（Markdownのコードブロック等も含む純粋なJSON）。

\`\`\`json
{
  "suggested_text": "修正後の完成テキスト（そのまま元データに上書き保存できる完全な文章）",
  "explanation": "どう修正したかの短い解説（例: ○○のパッチ変更を踏まえ、パワースパイク時期を中盤に修正）"
}
\`\`\``;

    let suggested_text = '';
    let explanation = '';

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          suggested_text = parsed.suggested_text;
          explanation = parsed.explanation;
        }
      }
    } catch (apiErr) {
      console.warn('[suggest-fix] Gemini API call failed, falling back:', apiErr);
    }

    if (!suggested_text) {
      suggested_text = fallbackSuggestion;
      explanation = '指摘内容に基づいて生成しました。';
    }

    return NextResponse.json({
      suggested_text,
      explanation,
    });
  } catch (err: any) {
    console.error('[suggest-fix] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
