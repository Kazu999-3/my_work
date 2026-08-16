import { supabaseAdmin as supabase } from './supabaseAdmin';
import { callGeminiWithRetry } from './geminiClient';
import { recordRevision } from './knowledgeRevisions';

// 2026-08-15、knowledge/add/route.tsのatomic insight単位のレーン振り分けからも
// 使えるよう、元々lane-guides/route.tsだけに閉じていた統合ロジックを切り出した
// (route.tsはGET/POST等の決まったexport以外を外から安全にimportできないため)。
export const LANES = [
  { key: 'COMMON', label: '全レーン共通（上達の原則）' },
  { key: 'TOP', label: 'TOP（トップ）' },
  { key: 'JG', label: 'JG（ジャングル）' },
  { key: 'MID', label: 'MID（ミッド）' },
  { key: 'ADC', label: 'ADC（ボット）' },
  { key: 'SUP', label: 'SUP（サポート）' },
];

// 記事がどのレーンの話かを、チャンピオン欄・タイトル・本文の語から判定する
export function detectLane(article: any): string {
  const hay = `${article.champion || ''} ${article.title || ''} ${(article.raw_content || article.content || '').slice(0, 600)}`.toLowerCase();
  const score: Record<string, number> = { TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0 };
  const rules: [string, RegExp][] = [
    ['TOP', /\btop\b|トップ|タンク対面|テレポート/],
    ['JG', /\bjungle\b|\bjg\b|ジャングル|ガンク|周回|スマイト|カウンタージャングル/],
    ['MID', /\bmid\b|ミッド|ロー\s?ム|ローミング/],
    ['ADC', /\badc\b|\bbot\b|bottom|ボット|マークスマン|キャリー/],
    ['SUP', /\bsup\b|support|サポート|視界|ワード|ローム/],
  ];
  for (const [lane, re] of rules) {
    const m = hay.match(new RegExp(re, 'gi'));
    if (m) score[lane] += m.length;
  }
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'COMMON';
}

/** AIの利用制限で中断したことを示す。呼び出し側で「続きから再開」に使う。 */
export class RateLimitedError extends Error {}

/**
 * Markdown本文1つを指定レーンのガイドへ追記マージする（personal_knowledgeの削除は行わない）。
 * 記事まるごとの統合(mergeArticleIntoLane)と、記事の一部だけ(レーン一般論の抜粋)を
 * 統合したいケース(merge-article route、2026-08-16)の両方から使えるよう分離した。
 */
export async function mergeContentIntoLane(lane: string, title: string, body: string, sourceId?: number | string): Promise<{ title: string }> {
  const laneLabel = LANES.find((l) => l.key === lane)?.label || lane;

  const { data: existing } = await supabase
      .from('lane_guides').select('title, body, source_count').eq('lane', lane).maybeSingle();

  // COMMON（全レーン共通）は、チャンピオン名を伏せて「どのチャンプでも通用する原則」に絞る。
  // 旧「上達の原則」の役割をここに統合している。
  const isCommon = lane === 'COMMON';
  const commonRule = isCommon
      ? `\n- これは「全レーン共通」のガイドです。特定チャンピオンの性能・スキル・ビルドの話は**一切含めない**でください\n- どのチャンプ・どのレーンを担当していても使える判断基準だけを書いてください\n- 抽象的な精神論ではなく、**具体的な状況と行動**で書いてください（例:「相手ジャングルが上に映ったら、下のオブジェクトを準備する」）`
      : '';

  const prompt = `「${laneLabel}」のレーン攻略ガイドを、新しい記事の内容で更新します。${commonRule}

【現在のガイド】
${existing?.body || '（まだ何も書かれていません）'}

【新しい記事: ${title || '無題'}】
${String(body).slice(0, 8000)}

指示:
- **既存のガイドの内容を残したまま**、記事から読み取れる新しい知見を適切な見出しの下に統合してください
- 既存と同じ内容は繰り返さず、重複は整理して1つにまとめること
- 特定チャンピオンの性能の話は含めず、**そのレーンで普遍的に使える立ち回り・判断**に絞ること
- 「## 見出し」で章立てし、各章は箇条書きで読みやすく
- 全体で3000字以内に収まるよう、冗長な部分は圧縮すること

必ず以下のJSONのみ出力（コードブロック禁止）:
{"title":"<ガイドのタイトル。30字以内>","body":"<統合後のMarkdown全文>"}`;

  // レート制限や503で落ちても、ここまでに統合した分は成果として返す（次回は続きから）
  let raw: string;
  try {
      raw = await callGeminiWithRetry(prompt, { temperature: 0.3, maxOutputTokens: 6000, maxRetries: 3 });
  } catch (aiErr: any) {
      const msg = String(aiErr?.message || '');
      if (msg.includes('レート制限') || msg.includes('一時的に利用できません')) {
        throw new RateLimitedError(msg);
      }
      throw aiErr;
  }
  let cleaned = (raw || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
  const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
  if (s < 0 || e <= s) throw new Error('AI出力の解析に失敗しました。');
  const result = JSON.parse(cleaned.slice(s, e + 1));
  if (!result.body) throw new Error('AIが本文を返しませんでした。');

  // 保存の成否を必ず確認する。
  // ここを見ていなかったため、テーブル未作成時に「保存に失敗したのに記事だけ消える」事故が起きた。
  const cleanBody = (result.body || '').replace(/\{\{champion\}\}/gi, '対象チャンピオン').replace(/\{\{role\}\}/gi, lane || '全レーン');
  const { error: saveError } = await supabase.from('lane_guides').upsert({
      lane,
      title: result.title || laneLabel,
      body: cleanBody,
      source_count: (existing?.source_count || 0) + 1,
      updated_at: new Date().toISOString(),
  }, { onConflict: 'lane' });
  if (saveError) throw new Error(`ガイドの保存に失敗しました: ${saveError.message}`);

  // 何がどの記事で増えたのかを後から辿れるように履歴を残す
  await recordRevision({
      targetType: 'lane_guide',
      targetKey: lane,
      field: 'body',
      before: existing?.body,
      after: result.body,
      sourceTitle: title,
      sourceId,
  });

  return { title: result.title || laneLabel };
}

/**
 * 記事1本を指定レーンのガイドへ追記マージし、元記事をライブラリから片付ける。
 * 一括統合・「この記事を送る」・atomic insight単位の自動振り分けの全てから使う。
 */
export async function mergeArticleIntoLane(a: any, lane: string): Promise<{ title: string }> {
  const body = a.raw_content || a.content || '';
  const result = await mergeContentIntoLane(lane, a.title || '無題', body, a.id);

  // 保存が確定してから、統合済みの記事をライブラリから片付ける（復元は「移動済み」から可能）
  if (a.id != null) {
    await supabase.from('personal_knowledge').update({ tags: ['__DELETED__'] }).eq('id', a.id);
  }
  return result;
}

/**
 * 記事本文の中から、特定チャンピオンに限らずそのレーン全般で通用するマクロ・
 * 立ち回り・判断の知見だけを抽出する。チャンピオン辞典統合プレビュー画面で、
 * 「レーン一般論がチャンピオン固有の項目に埋もれてしまう」ことを防ぐために使う
 * (2026-08-16、「レーン全体の攻略情報は優先的に確保したい」という要望への対応)。
 */
export async function classifyLaneGeneralContent(
  title: string,
  content: string,
  championLabel: string,
): Promise<{ title: string; summary: string }[]> {
  const prompt = `以下はLoL(League of Legends)の攻略記事です。この記事の中から、特定チャンピオン(${championLabel || '対象チャンピオン'})の性能・スキル・ビルドに限らず、そのレーン全般・ロール全般で通用するマクロ・立ち回り・判断の知見だけを抽出してください（例:「ジャングルはリスク管理としてスカットルより先に自陣バフを取る」）。
チャンピオン固有の性能・スキル・アイテムビルドの話は含めないでください。
独立して再利用できる知見を最大5件、それぞれ短いタイトルと2〜4文の要約で挙げてください。該当する内容が無ければ空配列を返してください。

必ず以下のJSONのみ出力（コードブロック禁止）:
{"insights": [{"title": "短いタイトル", "summary": "2〜4文の要約"}]}

[記事タイトル]: ${title}
[記事本文]:
${String(content).slice(0, 8000)}`;

  const raw = await callGeminiWithRetry(prompt, {
    temperature: 0.2,
    maxOutputTokens: 3072,
    maxRetries: 2,
    responseMimeType: 'application/json',
  });
  const cleaned = (raw || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
  const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
  if (s < 0 || e <= s) return [];
  try {
    const result = JSON.parse(cleaned.slice(s, e + 1));
    return Array.isArray(result.insights) ? result.insights.slice(0, 5) : [];
  } catch (parseErr) {
    // 出力が途中で切れて不正なJSONになるケースがある。辞典統合の本筋は止めず、
    // レーン一般論の検出だけスキップする。
    console.warn('[classifyLaneGeneralContent] JSON解析に失敗:', parseErr, cleaned.slice(0, 300));
    return [];
  }
}
