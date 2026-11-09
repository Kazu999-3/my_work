import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithRetry } from '@/lib/geminiClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const company_name = String(body?.company_name || '').trim();
    const job_title = String(body?.job_title || '').trim();
    const job_headline = String(body?.job_headline || '').trim();

    if (!company_name) {
      return NextResponse.json({ error: '会社名を入力してください。' }, { status: 400 });
    }

    const prompt = `あなたは日本の求人市場・企業情報・採用要件に精通したプロのキャリアアドバイザーAIです。
以下の企業および求人情報について、公開情報・一般的な業界水準・企業の評判をリサーチ・分析し、転職管理シートに必要な不足情報を推定・補完してください。

【対象情報】
- 会社名: ${company_name}
- 求人タイトル・見出し: ${job_headline || 'なし'}
- 応募職種: ${job_title || '記載なし（総合職または代表的な職種を想定）'}

【出力要件】
以下のキーを持つ単一のJSONオブジェクトのみを返してください。Markdownのコードブロック (\`\`\`json) で囲んで構いません。推測が含まれる場合でも、最も妥当な値を埋めてください。

{
  "job_headline": "求人タイトルの要約・キャッチコピー（未入力の場合、企業の強みや職種を表す20〜35文字程度の見出しを生成。入力済みの場合はそれを洗練）",
  "job_title": "明確な職種名（例: 採用人事、Webエンジニア、法人営業 など。20文字以内）",
  "salary": 想定月収（数値、単位：万円。例: 25〜35万円の場合は中間の30など、整数値のみ。不明でも業界平均から推定して30等の数値を必ず入れる）,
  "work_style": "フルリモート" または "ハイブリッド" または "出社"（該当企業の一般的な勤務形態やこの職種の傾向から選択）,
  "attraction": "企業の強み、働きやすさ、待遇、志望動機に使えるアピールポイント（50〜80文字程度）",
  "job_notes": "事業内容の要約、求められるスキルや経験、選考のポイント（60〜100文字程度）",
  "job_url": "企業の公式サイトまたは採用ページURL（不明なら https://www.google.com/search?q=${encodeURIComponent(company_name)}）"
}
`;

    const rawText = await callGeminiWithRetry(prompt, {
      temperature: 0.2,
      maxOutputTokens: 800,
    });

    const text = (rawText || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI解析結果のパースに失敗しました。', raw: text }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      data: {
        job_headline: String(parsed.job_headline || job_headline || ''),
        job_title: String(parsed.job_title || job_title || ''),
        salary: Number(parsed.salary) || 28,
        work_style: ['フルリモート', 'ハイブリッド', '出社'].includes(parsed.work_style) ? parsed.work_style : '出社',
        attraction: String(parsed.attraction || ''),
        job_notes: String(parsed.job_notes || ''),
        job_url: String(parsed.job_url || ''),
      },
    });
  } catch (error: any) {
    console.error('Career Research Error:', error);
    return NextResponse.json(
      { error: error?.message || 'リサーチ中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
