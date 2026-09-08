import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';

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
      chosen_claim, // ユーザーが明示的に選んだ正解候補 ('claim_a' | 'claim_b' | または任意の文章)
    } = body;

    let targetDescription = target_field || '指定項目';
    if (target_field === 'power_spikes') targetDescription = 'パワースパイク（強い時間帯・時期）';
    if (target_field === 'strengths') targetDescription = '強み・特徴';
    if (target_field === 'weaknesses') targetDescription = '弱み・対策';
    if (target_field === 'build_runes') targetDescription = 'ルーン・ビルド';
    if (target_field === 'strategy') targetDescription = '立ち回り・戦術';

    const prompt = `あなたはLeague of Legendsのプロフェッショナルコーチ兼データ管理者です。
現在、チャンピオン辞典およびナレッジのファクトチェック（事実確認・整合性チェック）を行っています。
以下の問題指摘および現在の記載内容を確認し、問題点を解消した【修正後の推奨テキスト（完成版）】を作成してください。

【対象チャンピオン】: ${champion || '不明'}
【項目名 / フィールド】: ${targetDescription} (${target_field || '未指定'})
【指摘種別】: ${issue_type || '事実確認'}
【指摘サマリー】: ${summary || 'なし'}
${conflict_reason ? `【食い違い・問題の理由】: ${conflict_reason}` : ''}
${claim_a ? `【候補 A】: ${claim_a}` : ''}
${claim_b ? `【候補 B】: ${claim_b}` : ''}
${chosen_claim ? `【採用するべき正解方針】: 「${chosen_claim}」の内容を正として反映してください。` : ''}

【現在の元文章（Before）】:
${current_value ? current_value : '(現在空欄または未登録)'}

【リライト指示】
1. 現在の元文章の文脈や良い部分をできる限り活かしながら、誤り・矛盾・古い情報となっている箇所だけを的確に修正してください。
2. 短い単語の箇条書きだけでなく、そのまま辞典の項目として読める自然で実践的な日本語文章（です・ます調または体言止め）に仕上げてください。
3. 出力は必ず以下のJSON形式のみで返してください（Markdownのコードブロック等も含む純粋なJSON）。

\`\`\`json
{
  "suggested_text": "修正後の完成文章（そのまま元のデータフィールドに上書き保存できる完全なテキスト）",
  "explanation": "どう修正したかの短い解説（例: 記述Aの方針に合わせ、パワースパイクの記述を序盤から中盤へ修正）"
}
\`\`\``;

    let suggested_text = '';
    let explanation = '';

    try {
      const aiResponse = await callGeminiWithRetry(prompt, {
        temperature: 0.3,
        maxOutputTokens: 1200,
        responseMimeType: 'application/json',
      });

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        suggested_text = parsed.suggested_text || '';
        explanation = parsed.explanation || '';
      }
    } catch (apiErr: any) {
      console.warn('[suggest-fix] callGeminiWithRetry failed:', apiErr);
      // フォールバック
      if (chosen_claim) {
        suggested_text = chosen_claim;
        explanation = 'AI生成が一時的に利用できなかったため、選択した正解候補を適用しました。';
      } else if (claim_a) {
        suggested_text = claim_a;
        explanation = '候補Aの内容を採用しました。';
      } else if (conflict_reason) {
        suggested_text = conflict_reason;
        explanation = '指摘理由からテキストを抽出しました。';
      }
    }

    if (!suggested_text) {
      suggested_text = current_value || summary || '修正内容';
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
