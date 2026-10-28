import type { SupabaseClient } from '@supabase/supabase-js';
import { callGemini } from './geminiClient';
import { resolveRosterChampion, resolveRosterChampions, getChampionNameJa } from './championRoster';
import { LaneKey, LANE_CONFIG } from './laneDetector';
import { integrateArticles, IntegrateArticle } from './knowledgeIntegrate';
import { integrateMatchupArticle } from './matchupMemo';
import { detectArticleMatchup } from './matchupDetector';

export interface DecomposedInsight {
  champion: string; // チャンピオン英語ID、または 'Unknown'（操作する自チャンピオン）
  championNameJa?: string;
  lane: LaneKey;
  laneLabel?: string;
  title: string;
  content: string;
  tags: string[];
  scope: 'champion_specific' | 'lane_general';
  enemyChampion?: string; // 対面・敵チャンピオン英語ID (例: 'Poppy')
  enemyChampionNameJa?: string;
  selected?: boolean;
}

export interface DecomposeArticleInput {
  id?: number;
  title: string;
  content: string;
  source_url?: string | null;
  champion?: string | null;
}

/**
 * ティアリストやパッチまとめ記事から、各チャンピオン固有の戦術や
 * レーン一般マクロの知見を漏れなくAIで分解・抽出する。
 * 対面対策（カウンター知見）では、操作側（自チャンプ）と敵側（対面チャンプ）を厳密に分離する。
 */
export async function decomposeArticle(article: DecomposeArticleInput): Promise<DecomposedInsight[]> {
  const title = article.title || '無題';
  const content = (article.content || '').trim();

  if (content.length < 100) {
    throw new Error('記事の本文が短すぎるため、ナレッジ分解を実行できません');
  }

  // 親記事のメインチャンピオン推定（コンテキスト補強）
  let parentChamp = article.champion || '';
  if (!parentChamp || parentChamp === 'Unknown') {
    const parentMatchup = await detectArticleMatchup({ title, content });
    if (parentMatchup.myChampion) {
      parentChamp = parentMatchup.myChampion;
    }
  }
  const resolvedParentChamp = parentChamp ? await resolveRosterChampion(parentChamp) : null;
  const parentChampNameJa = resolvedParentChamp ? await getChampionNameJa(resolvedParentChamp) : null;

  const prompt = `あなたはLeague of Legends (LoL) のトッププロコーチ兼データアナリストAIです。
以下の入力記事（パッチ解説、ティアリスト、動画まとめ等）には、複数のチャンピオンやレーンに関する戦術・調整知見が含まれています。
この内容を精査し、【チャンピオンごと】および【レーン一般マクロごと】に独立したナレッジ（分割知見 / Atomic Insights）へ漏れなく分解・抽出してください。

【対象記事: ${title}】
${parentChampNameJa ? `【記事の主役チャンピオン: ${parentChampNameJa} (${resolvedParentChamp})】\n` : ''}${content.slice(0, 15000)}

【抽出・分解の絶対ルール】:
1. **主語（自チャンプ）と対面（敵チャンプ）の厳密な分離**:
   - 立ち回りや対策知見を抽出する際、「操作する自チャンピオン（プレイヤー側）」を必ず champion に指定してください。
   - 対面相手やカウンター対象（例: ○○への立ち回り、対面○○、○○対策、○○のエンゲージを阻害する相手）が出てきた場合は、その相手を enemyChampion に指定してください。
   - ⚠️ **絶対に敵チャンピオンを champion に設定してはいけません！**
     【正誤例】:
     ジャーヴァンIV解説記事内で「ポッピーに対する立ち回り（ポッピーのWでEQを阻害される対策）」を抽出する場合:
     ❌ 誤り: champion: "Poppy", enemyChampion: null
     ⭕ 正解: champion: "JarvanIV" (操作側), enemyChampion: "Poppy" (対面相手), title: "【対面対策】ジャーヴァンIV vs ポッピーの立ち回り"
   - 記事全体の主役（${parentChampNameJa || '自チャンプ'}）がいる場合、その主役が戦う敵への対策知見は champion を必ずその主役にしてください。

2. **複数チャンピオンの完全網羅**:
   - 記事内で言及されている各チャンピオンについて、個別の知見として必ず1つずつ独立して抽出してください。
   - パッチの変更点（バフ・ナーフ）、具体的なスキル・コンボ、立ち回り、アイテム・ルーン、有利・不利な対面、集団戦の役割などを具体的に記述してください。

3. **アイテム・全体マクロの抽出（該当する場合）**:
   - 特定チャンピオンに限らないアイテム調整や、レーン全体のメタがあれば、scope="lane_general", champion="Unknown" として抽出してください。

4. **出力フォーマット**:
   必ず以下のJSONフォーマットのみを返却してください（Markdownのコードブロック等は含めない、純粋なJSON）。

{
  "insights": [
    {
      "champion": "操作する自チャンピオン英名 (例: JarvanIV, Mordekaiser。一般論の場合は 'Unknown')",
      "enemyChampion": "対面・敵チャンピオン英名 (例: Poppy, Sylas。対面対策知見の場合のみ指定、それ以外は null)",
      "scope": "champion_specific または lane_general",
      "targetLane": "TOP または JG または MID または ADC または SUP または COMMON",
      "title": "具体的でわかりやすい日本語タイトル (例: 【対面対策】ジャーヴァンIV vs ポッピーの立ち回り)",
      "content": "詳細なMarkdown戦術本文 (スキル運用、立ち回り、意識すべきWhy&When)",
      "tags": ["Patch26.20", "JG", "JarvanIV", "vs_Poppy"]
    }
  ]
}`;

  const resText = await callGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 6000,
    responseMimeType: 'application/json',
  });

  let rawJson: { insights?: any[] } = {};
  try {
    const cleaned = resText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    rawJson = JSON.parse(cleaned);
  } catch (e) {
    const m = resText.match(/\{[\s\S]*\}/);
    if (m) {
      try { rawJson = JSON.parse(m[0]); } catch {}
    }
  }

  const rawInsights = Array.isArray(rawJson.insights) ? rawJson.insights : [];
  if (rawInsights.length === 0) {
    throw new Error('AIによるナレッジ分解結果が取得できませんでした');
  }

  // チャンピオンID正規化 ＆ 対面スワップ補正 ＆ 日本語名の付与
  const formatted: DecomposedInsight[] = [];
  for (const item of rawInsights) {
    let champId = 'Unknown';
    if (item.champion && item.champion !== 'Unknown') {
      const resolved = await resolveRosterChampion(item.champion);
      if (resolved) champId = resolved;
    }

    let enemyChampId: string | undefined = undefined;
    if (item.enemyChampion && item.enemyChampion !== 'Unknown' && item.enemyChampion !== 'null') {
      const resolvedEnemy = await resolveRosterChampion(item.enemyChampion);
      if (resolvedEnemy) enemyChampId = resolvedEnemy;
    }

    // 🛡️ フェイルセーフ補正:
    // タイトルが「〇〇への立ち回り」「〇〇対策」であり、AIが誤って敵チャンプを champion に設定している場合、
    // 親チャンプ（または本文から検出された自チャンプ）と自動スワップする
    const titleText = String(item.title || '');
    const contentText = String(item.content || '');
    const isCounterTitle = /(?:への立ち回り|対策|への対処|vs\s+)/i.test(titleText);

    if (isCounterTitle && resolvedParentChamp && champId !== resolvedParentChamp) {
      // 親チャンプがジャーヴァンIVなのに、分解知見の champion がポッピーになっているパターン
      const enemyCandidate = champId;
      champId = resolvedParentChamp;
      enemyChampId = enemyCandidate;
    } else if (!enemyChampId && isCounterTitle) {
      // enemyChampion が空だがタイトルから敵を検出できる場合
      const detected = await detectArticleMatchup({ title: titleText, content: contentText, champion: champId });
      if (detected.enemyChampion) {
        enemyChampId = detected.enemyChampion;
      }
    }

    const champNameJa = champId !== 'Unknown' ? await getChampionNameJa(champId) : undefined;
    const enemyNameJa = enemyChampId ? await getChampionNameJa(enemyChampId) : undefined;

    const lane: LaneKey = (['TOP', 'JG', 'MID', 'ADC', 'SUP', 'COMMON'].includes(item.targetLane)
      ? item.targetLane
      : 'COMMON') as LaneKey;

    formatted.push({
      champion: champId,
      championNameJa: champNameJa,
      enemyChampion: enemyChampId,
      enemyChampionNameJa: enemyNameJa,
      lane,
      laneLabel: LANE_CONFIG[lane]?.label || lane,
      title: item.title || `${champNameJa || champId} 戦術知見`,
      content: (item.content || '').trim(),
      tags: Array.isArray(item.tags) ? item.tags : ['LoL攻略'],
      scope: item.scope === 'lane_general' ? 'lane_general' : 'champion_specific',
      selected: true,
    });
  }

  return formatted;
}

/**
 * 分解された知見群を Supabase の personal_knowledge テーブルへ保存し、
 * 各チャンピオン教本・対面DB・辞典項目・レーンガイドへ直接承認・統合する（2026-10-28改修）
 */
export async function saveDecomposedInsights(
  sb: SupabaseClient,
  parentArticleId: number,
  insights: DecomposedInsight[],
  sourceUrl?: string | null,
  opts: { autoApprove?: boolean } = { autoApprove: true }
): Promise<{ count: number; savedIds: number[]; integratedChamps: string[]; integratedMatchups: string[] }> {
  if (insights.length === 0) return { count: 0, savedIds: [], integratedChamps: [], integratedMatchups: [] };

  const shouldApprove = opts.autoApprove !== false;

  // 1. 事前重複チェック: DB既存タイトル ＆ バッチ内タイトルの一意化
  const candidateTitles = insights.map((i) => (i.title || '無題知見').trim());
  let existingTitles = new Set<string>();
  try {
    const { data: existingRows } = await sb
      .from('personal_knowledge')
      .select('title')
      .in('title', candidateTitles);
    if (existingRows) {
      existingTitles = new Set(existingRows.map((r: { title: string }) => r.title));
    }
  } catch (err) {
    console.warn('[saveDecomposedInsights] 既存タイトル取得警告:', err);
  }

  const usedTitles = new Set<string>();
  const uniqueInsights = insights.map((insight) => {
    const baseTitle = (insight.title || `${insight.championNameJa || insight.champion} 戦術知見`).trim();
    let currentTitle = baseTitle;

    // 既にDBに存在するか、同一バッチ内で重複している場合は連番を付与
    if (existingTitles.has(currentTitle) || usedTitles.has(currentTitle)) {
      let suffixNum = 2;
      while (existingTitles.has(`${baseTitle} (${suffixNum})`) || usedTitles.has(`${baseTitle} (${suffixNum})`)) {
        suffixNum++;
      }
      currentTitle = `${baseTitle} (${suffixNum})`;
    }
    usedTitles.add(currentTitle);

    return {
      ...insight,
      title: currentTitle,
    };
  });

  // 2. 万が一のユニーク制約エラー（23505 / personal_knowledge_title_key）防止用自動リトライ
  let savedRows: IntegrateArticle[] = [];
  let insertError: any = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const records = uniqueInsights.map((insight, idx) => {
      let titleToUse = insight.title;
      if (attempt > 0) {
        titleToUse = `${insight.title} [#${parentArticleId}-${idx + 1}-${Date.now().toString(36).slice(-4)}]`;
        insight.title = titleToUse;
      }
      const tagsToUse = [...(insight.tags || [])];
      if (insight.enemyChampion) {
        tagsToUse.push(`vs_${insight.enemyChampion}`);
      }
      if (shouldApprove) {
        tagsToUse.push('__INTEGRATED__');
      }

      return {
        title: titleToUse,
        content: insight.content,
        raw_content: insight.content,
        source_url: sourceUrl || null,
        genre: 'LoL攻略',
        tags: Array.from(new Set(tagsToUse)),
        champion: insight.champion === 'Unknown' ? 'Unknown' : insight.champion,
        parent_id: parentArticleId,
        is_atomic: true,
        review_status: shouldApprove ? 'approved' : 'pending',
      };
    });

    const { data, error } = await sb
      .from('personal_knowledge')
      .insert(records)
      .select('id, title, content, raw_content, champion, tags, source_url');

    if (!error && data) {
      savedRows = data as IntegrateArticle[];
      insertError = null;
      break;
    }

    insertError = error;
    if (error?.message?.includes('personal_knowledge_title_key') || error?.code === '23505') {
      console.warn(`[saveDecomposedInsights] タイトル重複エラー検知、サフィックスを付与してリトライ (試行 ${attempt + 1}/3):`, error.message);
      continue;
    } else {
      break;
    }
  }

  if (insertError) {
    throw new Error(`分割知見の保存に失敗しました: ${insertError.message}`);
  }

  const savedIds = savedRows.map((r) => r.id);
  const integratedChamps: string[] = [];
  const integratedMatchups: string[] = [];

  // 直接承認・統合（autoApprove）の実行
  if (shouldApprove && savedRows.length > 0) {
    try {
      // 1. チャンピオン総合教本（matchup_sentinel & strategy）へ統合
      const champRes = await integrateArticles(sb, savedRows);
      if (champRes.champions?.length > 0) {
        integratedChamps.push(...champRes.champions);
      }

      // 2. ⚔️ 対面DB（matchup_sentinel の myChamp_vs_enemy 行）への自動直接統合
      for (let i = 0; i < uniqueInsights.length; i++) {
        const item = uniqueInsights[i];
        if (item.champion && item.champion !== 'Unknown' && item.enemyChampion) {
          try {
            const matchRes = await integrateMatchupArticle({
              myChampion: item.champion,
              enemyChampion: item.enemyChampion,
              title: item.title,
              content: item.content,
              lane: item.lane,
              sourceUrl,
            });
            if (matchRes.ok) {
              const label = `${item.champion} vs ${item.enemyChampion}`;
              integratedMatchups.push(label);
            }
          } catch (mErr) {
            console.warn(`[saveDecomposedInsights] 対面DB統合エラー (${item.champion} vs ${item.enemyChampion}):`, mErr);
          }
        }
      }
    } catch (intErr) {
      console.warn('[saveDecomposedInsights] 教本・対面DBへの直接統合処理で一部警告:', intErr);
    }
  }

  // 親記事のタグに __DECOMPOSED__, __SUPERSEDED__ をマークし、review_status を完了('approved')へ更新
  try {
    const { data: parent, error: fetchErr } = await sb
      .from('personal_knowledge')
      .select('tags')
      .eq('id', parentArticleId)
      .maybeSingle();

    if (fetchErr) {
      console.warn('[saveDecomposedInsights] 親記事タグ取得エラー:', fetchErr);
    }

    const parentTags = Array.isArray(parent?.tags) ? parent.tags : [];
    const newTags = Array.from(new Set([...parentTags, '__DECOMPOSED__', '__SUPERSEDED__']));
    const { error: updateErr } = await sb
      .from('personal_knowledge')
      .update({
        tags: newTags,
        review_status: 'approved',
      })
      .eq('id', parentArticleId);

    if (updateErr) {
      console.error('[saveDecomposedInsights] 親記事のステータス更新失敗:', updateErr);
    }
  } catch (err) {
    console.warn('[saveDecomposedInsights] 親記事タグ・ステータス更新スキップ:', err);
  }

  return {
    count: savedIds.length,
    savedIds,
    integratedChamps: Array.from(new Set(integratedChamps)),
    integratedMatchups: Array.from(new Set(integratedMatchups)),
  };
}
