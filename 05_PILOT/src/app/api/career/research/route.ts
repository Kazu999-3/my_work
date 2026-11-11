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

3. **応募形態の求人ページURL（job_url）**:
   - ⚠️【企業の会社概要トップページ（例: https://xxx.co.jp/ のみ）やGoogle検索URL（google.com/search...）は絶対禁止】です。
   - 必ず、ユーザーがクリックして【該当職種に応募できる求人ページURL】を特定してください。
     - 優先1: 大手求人サイトの実際の求人詳細URL（例: employment.en-japan.com/desc_..., tenshoku.mynavi.jp/jobinfo/..., jp.indeed.com/viewjob..., doda.jp/... 等）
     - 優先2: 該当企業の公式採用サイトの募集要項・エントリーページURL（例: https://xxx.co.jp/recruit/..., /career/..., /jobs/... 等）
   - 既存URL（${existing_url}）が既に有効な求人詳細ページであれば、それを最優先で維持してください。
   - どうしても応募可能な求人ページが見当たらない場合のみ空文字 ("") にしてください。

4. **魅力・志望理由（attraction）**:
   - 企業の強み、働きやすさ、事業の将来性、福利厚生など、面接や志望動機で使える具体的なアピールポイント（60〜100文字程度）。

5. **選考メモ・業務内容（job_notes）**:
   - 主な業務内容、求められるスキルや人物像、企業の特徴（60〜120文字程度）。

【出力形式】
前置きや解説、思考メモは一切不要です。即座に以下のJSONコードブロックのみを出力し、必ず末尾の \`\`\` まで完結させてください。

\`\`\`json
{
  "company_name": "${company_name}",
  "job_headline": "求人タイトルの要約・キャッチコピー（20〜35文字程度）",
  "job_title": "職種名（例: 社内SE、施工管理アシスタント など。20文字以内）",
  "salary": 想定月収の数値（例: 25〜35万なら下限または標準の25、整数値のみ）,
  "work_style": "フルリモート" または "ハイブリッド" または "出社",
  "attraction": "魅力・アピール点（40〜70文字程度）",
  "job_notes": "選考メモ（40〜80文字程度）",
  "job_url": "実在する求人詳細ページURLまたは採用ページURL"
}
\`\`\`
`;

    // 見出しやメモからの即時正規表現フォールバック（取り込み時の元データがあれば最優先抽出）
    const rawAll = `${job_headline} ${existing_notes} ${String(body?.attraction || '')}`;
    let preSalary = 0;
    const manM = rawAll.match(/(?:月給|給与|月額|固定給)\s*[:：\s]*([0-9０-９]+(?:\.[0-9]+)?)\s*万/);
    if (manM) preSalary = Math.round(parseFloat(manM[1]));

    // Google Search Grounding を優先実行（失敗時は通常推論へ自動フォールバック）
    let result: any = null;
    try {
      result = await callGeminiDetailed(prompt, {
        temperature: 0.1,
        maxOutputTokens: 3000,
        enableSearch: true,
        timeoutMs: 30000,
      });
    } catch (searchErr: any) {
      console.warn('Google Search Grounding fallback:', searchErr.message);
      result = await callGeminiDetailed(prompt, {
        temperature: 0.2,
        maxOutputTokens: 2500,
        enableSearch: false,
        timeoutMs: 20000,
      });
    }

    const text = (result?.text || '').trim();
    let parsed: any = {};

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (jsonErr) {
        // 末尾切れの場合の補完パース試行
        try {
          const trimmed = jsonMatch[0].trim();
          const lastQuote = trimmed.lastIndexOf('"');
          if (lastQuote !== -1) {
            parsed = JSON.parse(trimmed.slice(0, lastQuote + 1) + '\n}');
          }
        } catch {}
      }
    }

    // JSONパースが失敗した場合でも、正規表現で各キーを確実に救出
    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
      const getVal = (key: string): any => {
        const m = text.match(new RegExp(`"${key}"\\s*:\\s*(?:"([^"]*)"|([0-9]+))`));
        return m ? (m[1] !== undefined ? m[1] : Number(m[2])) : '';
      };
      parsed = {
        company_name: getVal('company_name') || company_name,
        job_headline: getVal('job_headline') || job_headline,
        job_title: getVal('job_title') || job_title,
        salary: Number(getVal('salary')) || preSalary || 0,
        work_style: getVal('work_style') || '出社',
        attraction: getVal('attraction') || '',
        job_notes: getVal('job_notes') || '',
        job_url: getVal('job_url') || '',
      };
    }

    // URLの精査: AIが架空URLを返した場合やトップページの場合、Google検索で実際にヒットした求人URLからフォールバック
    let finalUrl = String(parsed.job_url || '').trim();
    if (finalUrl.includes('google.com') || finalUrl.includes('example.com') || finalUrl.includes('localhost')) {
      finalUrl = '';
    }

    // 既存の有効な求人URLがあればそれを最優先
    if (existing_url && !existing_url.includes('google.com') && !existing_url.includes('example.com')) {
      finalUrl = existing_url;
    } else if (result.searchChunks && result.searchChunks.length > 0) {
      // 検索で見つかった実在URLから、応募形態の求人詳細ページを最優先で特定
      const isJobPage = (u: string) => {
        const lower = u.toLowerCase();
        return lower.includes('employment.en-japan.com/desc_') ||
               lower.includes('tenshoku.mynavi.jp/jobinfo') ||
               lower.includes('jp.indeed.com/viewjob') ||
               lower.includes('doda.jp/dodafront') ||
               lower.includes('en-gage.net') ||
               lower.includes('next.rikunabi.com/company') ||
               lower.includes('/recruit') ||
               lower.includes('/career') ||
               lower.includes('/jobs') ||
               lower.includes('/job') ||
               lower.includes('/entry');
      };

      const jobChunk = result.searchChunks.find((c: any) => isJobPage(c.uri) && !c.uri.includes('google.com'));
      if (jobChunk?.uri) {
        // AIがトップページ（パスなし）を返していた場合でも、実在求人ページが見つかればそちらを優先
        finalUrl = jobChunk.uri;
      } else if (!finalUrl) {
        // 求人詳細が見つからない場合の次善策（採用・コーポレート）
        const corpChunk = result.searchChunks.find((c: any) => 
          !c.uri.includes('google.com') && 
          !c.uri.includes('wikipedia.org') &&
          (c.uri.includes('co.jp') || c.uri.includes('.com') || c.uri.includes('.jp'))
        );
        if (corpChunk?.uri) finalUrl = corpChunk.uri;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        company_name: String(parsed.company_name || company_name),
        job_headline: String(parsed.job_headline || job_headline || ''),
        job_title: String(parsed.job_title || job_title || ''),
        salary: Number(parsed.salary) || preSalary || 0,
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
