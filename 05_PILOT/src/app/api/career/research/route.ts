import { NextRequest, NextResponse } from 'next/server';
import { callGeminiDetailed } from '@/lib/geminiClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const company_name = String(body?.company_name || '').trim();
    const job_title = String(body?.job_title || '').trim();
    const job_headline = String(body?.job_headline || '').trim();
    const source = String(body?.source || '').trim();
    const existing_url = String(body?.job_url || '').trim();
    const existing_notes = String(body?.job_notes || '').trim();

    if (!company_name) {
      return NextResponse.json({ error: '会社名を入力してください。' }, { status: 400 });
    }

    const prompt = `あなたは日本の求人市場・採用実態・企業情報リサーチに特化した最上級キャリアアナリストAIです。
Google検索ツールを使用して、以下の対象企業および求人募集について【リアルタイムWeb調査】を実行し、最新かつ客観的な事実に基づいた転職管理データを精査・抽出してください。

【対象求人情報】
- 会社名: ${company_name}
- 求人タイトル・見出し: ${job_headline || 'なし'}
- 応募職種: ${job_title || '総合職または代表的職種'}
- 応募媒体: ${source || '一般求人'}
${existing_url && !existing_url.includes('google.com') ? `- 既存求人URL: ${existing_url}` : ''}
${existing_notes ? `- 参考メモ: ${existing_notes}` : ''}

【必須リサーチ項目と厳格なルール】
1. **想定月収（salary）**:
   - ⚠️【適当な業界平均（28万〜30万など）で埋めることは厳禁】です。
   - Google検索を用いて、該当企業の該当職種の実際の採用要項・初任給・中途採用提示月給（基本給＋固定手当など）を調べてください。
   - 例: 「月給25万円〜35万円」であれば下限または標準的なスタート月収として「25」または「28」など、実際の公開レンジに基づく数値を数値型（単位: 万円）で返してください。
   - 年俸制（例: 480万円）の場合は12で割った月収（40）を算出してください。
   - どうしても金額が見当たらない場合のみ、同社の有価証券報告書平均年収やOpenWork/転職会議の実態月収から算出し、attractionに「※相場推定」と添えてください。

2. **勤務形態（work_style）**:
   - 該当企業の現在の出社方針・リモートワーク制度を調査してください。
   - "フルリモート" または "ハイブリッド" または "出社" のいずれか1つを選択してください。

3. **求人URL・公式URL（job_url）**:
   - ⚠️【架空のURLやGoogle検索URL（google.com/search...）を出力することは絶対禁止】です。
   - 既存URL（${existing_url}）が既に有効な求人URL（マイナビ・エン・Indeed等）であれば、それを最優先で維持してください。
   - 既存URLが無い場合は、検索で見つかった「企業の公式採用ページ」または「公式サイト」または「公式求人票」の実在するURLを返してください。どうしても確実なURLが見当たらない場合は空文字 ("") にしてください。

4. **魅力・志望理由（attraction）**:
   - 企業の強み、働きやすさ、事業の将来性、福利厚生など、面接や志望動機で使える具体的なアピールポイント（60〜100文字程度）。

5. **選考メモ・業務内容（job_notes）**:
   - 主な業務内容、求められるスキルや人物像、企業の特徴（60〜120文字程度）。

【出力形式】
以下のJSONフォーマットのみを返してください。Markdownコードブロック (\`\`\`json) で囲んで出力してください。

\`\`\`json
{
  "company_name": "${company_name}",
  "job_headline": "求人タイトルの要約・キャッチコピー（25〜40文字程度）",
  "job_title": "明確な職種名（例: 施工管理アシスタント、社内SE、Webマーケター など。25文字以内）",
  "salary": 数値（単位: 万円。整数値のみ。例: 25）,
  "work_style": "フルリモート" | "ハイブリッド" | "出社",
  "attraction": "魅力・志望理由ポイント",
  "job_notes": "選考メモ・事業内容",
  "job_url": "実在する公式採用ページURLまたは求人URL（架空URL厳禁）"
}
\`\`\`
`;

    // Google Search Grounding を有効化してリアルタイム調査
    const result = await callGeminiDetailed(prompt, {
      temperature: 0.1,
      maxOutputTokens: 1200,
      enableSearch: true,
      timeoutMs: 40000,
    });

    const text = (result?.text || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI解析結果のパースに失敗しました。', raw: text }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // URLの精査: AIが架空URLを返した場合や空の場合、Google検索で実際にヒットしたURLからフォールバック
    let finalUrl = String(parsed.job_url || '').trim();
    if (finalUrl.includes('google.com/search') || finalUrl.includes('example.com') || finalUrl.includes('localhost')) {
      finalUrl = '';
    }

    // 既存の有効なURLがあればそれを最優先
    if (existing_url && !existing_url.includes('google.com/search') && !existing_url.includes('example.com')) {
      finalUrl = existing_url;
    } else if (!finalUrl && result.searchChunks && result.searchChunks.length > 0) {
      // 検索で見つかった実在URLから、企業の公式ページや採用ページ候補を抽出
      const bestChunk = result.searchChunks.find(c => 
        !c.uri.includes('google.com') && 
        !c.uri.includes('wikipedia.org') &&
        (c.uri.includes('recruit') || c.uri.includes('career') || c.uri.includes('job') || c.uri.includes('corp') || c.uri.includes('co.jp'))
      ) || result.searchChunks.find(c => !c.uri.includes('google.com'));

      if (bestChunk?.uri) {
        finalUrl = bestChunk.uri;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        company_name: String(parsed.company_name || company_name),
        job_headline: String(parsed.job_headline || job_headline || ''),
        job_title: String(parsed.job_title || job_title || ''),
        salary: Number(parsed.salary) || 0,
        work_style: ['フルリモート', 'ハイブリッド', '出社'].includes(parsed.work_style) ? parsed.work_style : '出社',
        attraction: String(parsed.attraction || ''),
        job_notes: String(parsed.job_notes || ''),
        job_url: finalUrl,
        searchQueries: result.webSearchQueries || [],
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
