import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { recordMatchupSentinelRevision } from '../../../../../lib/matchupSentinelRevisions';
import { recordRevision } from '../../../../../lib/knowledgeRevisions';
import { resolveToRosterChampion } from '../../../../../lib/dictFactCheck';
import { detectLane, classifyLaneGeneralContent, mergeContentIntoLane } from '../../../../../lib/laneGuideMerge';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';

// ============================================================
// 攻略ライブラリ(personal_knowledge)の1記事を、選択されたチャンピオンの
// 辞典(champion_facts / matchup_sentinel)へ高度に統合する。
//
// 1. チャンピオントレンド構造化項目 (強み/弱み/パワースパイク/ビルド/立ち回り/BAN/ピック)
//    をAIで事前に整理・抽出し、プレビューで確認してから移動。
// 2. 記事内に含まれる「対〇〇（敵チャンピオン）」対策を自動検知し、
//    対面マッチアップ情報として matchup_sentinel に保存。
// 3. レーン一般論を検知し、レーンガイドへの同時統合もサポート。
// ============================================================
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TREND_FIELDS = [
  { key: 'strengths', label: '強み・長所' },
  { key: 'weaknesses', label: '弱み・注意点' },
  { key: 'power_spikes', label: 'パワースパイク' },
  { key: 'build_runes', label: 'ビルド/ルーン' },
  { key: 'strategy', label: '基本立ち回り' },
  { key: 'must_ban_champions', label: '要注意・BAN推奨' },
  { key: 'pick_recommendation', label: 'ピック基準' },
] as const;

export type MatchupInsight = {
  targetChampion: string;
  enemyChampion: string;
  title: string;
  strategy: string;
  confidence?: 'high' | 'medium';
};

export type TrendFieldUpdate = {
  fieldKey: string;
  fieldLabel: string;
  existingValue: string;
  extractedValue: string;
  mergedValue: string;
  isNew: boolean;
};

export type ChampionTrendAnalysis = {
  champion: string;
  summaryPoints: string[];
  fieldUpdates: TrendFieldUpdate[];
  availableRoles?: string[];
  detectedRole?: string;
};

function mergeContent(existingText: string, newText: string, title: string): string {
  const ext = existingText || "";
  if (!ext.trim()) return newText;
  if (newText.trim() === ext.trim()) return ext;
  const header = `## 【記事】${title}`;
  if (ext.includes(header)) {
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`## 【記事】${escapeRegExp(title)}\\s*\\n[\\s\\S]*?(?=\\n---|$)`);
    const newContent = ext.replace(pattern, `${header}\n\n${newText}`);
    if (newContent !== ext) return newContent;
  }
  if (ext.includes(newText)) return ext;
  return `${ext}\n\n---\n\n${header}\n\n${newText}`;
}

/** AIで記事を解析し、チャンピオントレンド構造化項目と対面マッチアップ情報を抽出する */
async function analyzeArticleInsights(
  title: string,
  content: string,
  champions: string[]
): Promise<{
  trendData: Record<string, {
    summaryPoints: string[];
    fields: Partial<Record<typeof TREND_FIELDS[number]['key'], string>>;
  }>;
  matchups: MatchupInsight[];
}> {
  const champListStr = champions.join(', ');
  const prompt = `あなたはLeague of Legendsの戦略データアナリストです。
以下の攻略記事を詳細に分析し、対象チャンピオン【${champListStr}】に関する構造化トレンドデータ、および記事中に登場する「対特定チャンピオン（マッチアップ対策）」情報を整理して抽出してください。

【記事タイトル】
${title || '無題'}

【記事本文】
${content.slice(0, 10000)}

【指示】
1. **各チャンピオンのトレンド項目**:
   - 対象チャンピオン（${champListStr}）ごとに、記事から得られる知見を以下の項目別に文章で整理してください。
   - strengths: 強み・長所
   - weaknesses: 弱み・課題・警戒すべき点
   - power_spikes: パワースパイク（強い時間帯、特定アイテム完成時、Lv到達時など）
   - build_runes: 推奨ビルド、アイテム順、主要ルーン
   - strategy: レーン戦や集団戦の基本立ち回り・戦術
   - must_ban_champions: BANすべき相手や厳しい相性の敵
   - pick_recommendation: どんな構成や状況で出すべきか
   - summaryPoints: 今回の記事から得られる重要な要点箇条書き（最大4点）
   ※記事に該当情報がない項目は空文字 "" にしてください。

2. **対チャンピオン（マッチアップ）情報**:
   - 記事中に「対〇〇（敵チャンピオン名）」に対する立ち回り、有利不利、スキル回避、アイテム対策、レーン戦の戦い方が具体的に書かれている場合、抽出してください。
   - targetChampion: 自チャンピオン名（${champListStr} のいずれか）
   - enemyChampion: 相手チャンピオン名（英名。例: Darius, Yasuo, Ahri, Sylas など）
   - title: 対策の要約見出し（例: 「Lv1〜3のショートトレード回避と1コア後のオールイン」）
   - strategy: 具体的な立ち回り・対策詳細（100〜300字程度）
   ※対面情報が見当たらない場合は空配列 [] にしてください。

必ず以下のJSON形式のみを出力してください（Markdownのバッククォート禁止）:
{
  "trendData": {
    "<ChampionName>": {
      "summaryPoints": ["..."],
      "strengths": "...",
      "weaknesses": "...",
      "power_spikes": "...",
      "build_runes": "...",
      "strategy": "...",
      "must_ban_champions": "...",
      "pick_recommendation": "..."
    }
  },
  "matchups": [
    {
      "targetChampion": "<自チャンピオン名>",
      "enemyChampion": "<相手チャンピオン英名>",
      "title": "<対策見出し>",
      "strategy": "<具体的な立ち回り・対策>"
    }
  ]
}`;

  try {
    const raw = await callGeminiWithRetry(prompt, {
      model: 'gemini-3.1-flash-lite',
      temperature: 0.2,
      maxOutputTokens: 3000,
      maxRetries: 2,
    });

    let cleaned = (raw || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) {
      const parsed = JSON.parse(cleaned.slice(s, e + 1));
      const trendData = parsed.trendData || {};
      const rawMatchups = Array.isArray(parsed.matchups) ? parsed.matchups : [];
      
      // 敵チャンピオン名を正規化
      const validatedMatchups: MatchupInsight[] = [];
      for (const m of rawMatchups) {
        if (!m.enemyChampion || !m.strategy) continue;
        const normalizedEnemy = await resolveToRosterChampion(m.enemyChampion);
        const normalizedTarget = await resolveToRosterChampion(m.targetChampion) || champions[0];
        if (normalizedEnemy && normalizedTarget && normalizedEnemy !== normalizedTarget) {
          validatedMatchups.push({
            targetChampion: normalizedTarget,
            enemyChampion: normalizedEnemy,
            title: m.title || `${normalizedTarget} vs ${normalizedEnemy} 対策`,
            strategy: m.strategy,
            confidence: 'high',
          });
        }
      }

      return { trendData, matchups: validatedMatchups };
    }
  } catch (err) {
    console.warn('[merge-article] analyzeArticleInsights失敗(フォールバック):', err);
  }

  return { trendData: {}, matchups: [] };
}

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const {
      articleId,
      title,
      content,
      editChampions,
      dryRun,
      sendLaneGeneralToLane,
      laneGeneralExcerpt,
      approvedMatchups,
      approvedLaneGeneralInsights,
      championSpecificInsights,
      trendDataOverrides,
      championRoles,
    } = await req.json();

    if (!articleId || !title || typeof content !== 'string') {
      return NextResponse.json({ error: 'articleId, title, content が必要です' }, { status: 400 });
    }
    const rawList: string[] = Array.isArray(editChampions) ? editChampions : [];

    const resolvedList = await Promise.all(rawList.map((c) => resolveToRosterChampion((c || '').trim())));
    const validChampions = Array.from(new Set(resolvedList.filter((c): c is string => !!c)));

    // ============================================================
    // dryRun: 実際の書き込みを行わず、AIで整理されたチャンピオントレンド各項目の
    // 更新案、対面マッチアップ情報、レーン一般論を計算して返す
    // （対象チャンピオンが0体でも、レーン一般論の抽出とプレビューは続行する）
    // ============================================================
    if (dryRun) {
      // 1. AIによる構造化トレンド＆対面情報の抽出 (チャンピオンが存在する場合のみ)
      const { trendData, matchups } = validChampions.length > 0
        ? await analyzeArticleInsights(title, content, validChampions)
        : { trendData: {}, matchups: [] };

      // 2. チャンピオンごとのプレイ可能ロール取得と既存データマージ計算
      const trendAnalyses: ChampionTrendAnalysis[] = await Promise.all(
        validChampions.map(async (championName) => {
          // 該当チャンピオンのプレイ可能ロール一覧
          const { data: laneRoleRows } = await supabase
            .from('champion_lane_roles')
            .select('role, rank')
            .ilike('champion', championName)
            .order('rank', { ascending: true });

          const availableRoles: string[] = (laneRoleRows || [])
            .map((r: any) => (r.role === 'ADC' ? 'BOT' : r.role))
            .filter((r: string, i: number, arr: string[]) => arr.indexOf(r) === i);

          // 記事タイトルや本文から推奨ロールを推定
          let detectedRole = availableRoles.length > 0 ? availableRoles[0] : 'GLOBAL';
          for (const r of availableRoles) {
            if (new RegExp(`\\b${r}\\b|${r}ヤスオ|${r}グラガス|${r}運用|${r}ビルド`, 'i').test(`${title} ${content.slice(0, 1000)}`)) {
              detectedRole = r;
              break;
            }
          }

          // 指定ロールまたは最新の既存factを取得
          const { data: existingFact } = await supabase
            .from('champion_facts')
            .select('*')
            .eq('champion', championName)
            .ilike('role', detectedRole)
            .maybeSingle();

          const extractedForChamp = trendData[championName] || trendData[validChampions[0]] || { fields: {}, summaryPoints: [] };
          const extractedFields = extractedForChamp.fields || extractedForChamp || {};

          const fieldUpdates: TrendFieldUpdate[] = TREND_FIELDS.map((f) => {
            const existingVal = (existingFact as any)?.[f.key] || '';
            const extractedVal = (extractedFields as any)?.[f.key] || '';
            let mergedVal = existingVal;

            if (extractedVal && extractedVal.trim()) {
              if (!existingVal.trim()) {
                mergedVal = extractedVal.trim();
              } else if (!existingVal.includes(extractedVal.trim())) {
                mergedVal = `${existingVal.trim()}\n\n【追記知見】\n${extractedVal.trim()}`;
              }
            }

            return {
              fieldKey: f.key,
              fieldLabel: f.label,
              existingValue: existingVal,
              extractedValue: extractedVal,
              mergedValue: mergedVal,
              isNew: !existingVal.trim() && !!extractedVal.trim(),
            };
          });

          return {
            champion: championName,
            summaryPoints: extractedForChamp.summaryPoints || [],
            fieldUpdates,
            availableRoles: availableRoles.length > 0 ? availableRoles : ['GLOBAL'],
            detectedRole,
          };
        })
      );

      // 3. 後方互換プレビューデータ
      const previews = await Promise.all(
        validChampions.map(async (championName) => {
          const matchupId = `champ_${championName}_global`;
          const { data: existingData } = await supabase
            .from('matchup_sentinel')
            .select('raw_data')
            .eq('matchup_id', matchupId)
            .maybeSingle();

          const rawData = existingData?.raw_data || {};
          const customFields = rawData.customFields || {};
          const isNoteDraft = title.includes('HONKI_BIBLE') || title.includes('ARTICLE');
          const fieldName = isNoteDraft ? 'note_draft' : title.replace(`${championName}_`, '').replace(`_${championName}`, '');
          const existingContent = isNoteDraft ? rawData.note_draft || '' : customFields[fieldName] || '';
          const mergedContentText = mergeContent(existingContent, content, title);

          return {
            champion: championName,
            fieldName,
            isNewField: !existingContent.trim(),
            existingExcerpt: existingContent.slice(0, 500),
            mergedExcerpt: mergedContentText.slice(0, 1500),
          };
        })
      );

      // 4. レーン一般論の抽出
      let laneGeneralInsights: { title: string; summary: string }[] = [];
      let detectedLaneKey = 'COMMON';
      try {
        detectedLaneKey = detectLane({ champion: validChampions.join(', '), title, content });
        laneGeneralInsights = await classifyLaneGeneralContent(title, content, validChampions.join(', '));
      } catch (laneDetectErr) {
        console.warn('[merge-article] レーン一般論の判定に失敗:', laneDetectErr);
      }

      return NextResponse.json({
        success: true,
        dryRun: true,
        champions: validChampions,
        trendAnalyses,
        matchupInsights: matchups,
        laneGeneralInsights,
        detectedLane: detectedLaneKey,
        previews,
      });
    }

    // ============================================================
    // 確定実行 (dryRun: false)
    // ============================================================
    let mergedNote = '';

    // 1. チャンピオントレンド構造化項目 (champion_facts & matchup_sentinel) の更新
    for (const championName of validChampions) {
      const targetRole = (championRoles && championRoles[championName]) || 'GLOBAL';
      const matchupId = `champ_${championName}_global`;
      const { data: existingSentinel } = await supabase
        .from('matchup_sentinel')
        .select('*')
        .eq('matchup_id', matchupId)
        .maybeSingle();

      const { data: existingFact } = await supabase
        .from('champion_facts')
        .select('*')
        .eq('champion', championName)
        .ilike('role', targetRole)
        .maybeSingle();

      // raw_data & customFields の更新
      let rawData = existingSentinel?.raw_data || {};
      let customFields = rawData.customFields || {};

      if (title.includes('HONKI_BIBLE') || title.includes('ARTICLE')) {
        rawData.note_draft = mergeContent(rawData.note_draft || '', content, title);
      } else {
        const fieldName = title.replace(`${championName}_`, '').replace(`_${championName}`, '');
        customFields[fieldName] = mergeContent(customFields[fieldName] || '', content, title);
      }
      rawData.customFields = customFields;
      rawData.source = 'champ_db';
      rawData.role = 'GLOBAL';

      // 構造化項目（champion_facts）の更新ペイロード
      const factPayload: any = {
        champion: championName,
        role: targetRole,
        updated_at: new Date().toISOString(),
      };

      // クライアントから渡された overrides または直接マージ値
      const champOverrides = trendDataOverrides?.[championName];
      for (const f of TREND_FIELDS) {
        if (champOverrides && champOverrides[f.key] !== undefined) {
          factPayload[f.key] = champOverrides[f.key];
        }
      }

      // champion_facts を upsert
      const { error: factErr } = await supabase
        .from('champion_facts')
        .upsert(factPayload, { onConflict: 'champion' });
      if (factErr) console.warn('[merge-article] champion_facts upsert error:', factErr);

      // 新しいロールが指定された場合、champion_lane_rolesにも追加登録
      if (targetRole && targetRole !== 'GLOBAL') {
        try {
          const { data: existingRoles } = await supabase
            .from('champion_lane_roles')
            .select('role, rank')
            .ilike('champion', championName);

          const dbRole = targetRole === 'BOT' ? 'ADC' : targetRole;
          const alreadyHas = (existingRoles || []).some((r: any) => r.role === dbRole || r.role === targetRole);
          if (!alreadyHas) {
            const nextRank = (existingRoles || []).length + 1;
            await supabase.from('champion_lane_roles').insert({
              champion: championName,
              role: dbRole,
              rank: nextRank,
            });
          }
        } catch (laneRoleErr) {
          console.warn('[merge-article] champion_lane_roles insert error:', laneRoleErr);
        }
      }

      // リビジョン履歴記録
      for (const f of TREND_FIELDS) {
        if (factPayload[f.key] !== undefined && factPayload[f.key] !== (existingFact as any)?.[f.key]) {
          await recordRevision({
            targetType: 'champion_fact',
            targetKey: championName,
            field: f.key,
            before: (existingFact as any)?.[f.key],
            after: factPayload[f.key],
            sourceTitle: title,
            sourceId: articleId,
          });
        }
      }

      // matchup_sentinel (GLOBAL) を upsert
      const dictData = {
        matchup_id: matchupId,
        champion: championName,
        enemy: 'GLOBAL',
        title: existingSentinel?.title || `${championName} 基本戦略・トレンド`,
        strategy: factPayload.strategy || existingSentinel?.strategy || '',
        raw_data: rawData,
      };

      const { error: sentinelError } = await supabase
        .from('matchup_sentinel')
        .upsert(dictData, { onConflict: 'matchup_id' });
      if (sentinelError) throw sentinelError;

      await recordMatchupSentinelRevision(
        matchupId,
        existingSentinel ?? null,
        { title: dictData.title, strategy: dictData.strategy, raw_data: dictData.raw_data },
        title,
        articleId
      );
    }

    // 2. 対チャンピオン（マッチアップ）情報の保存
    const matchupsToSave: MatchupInsight[] = Array.isArray(approvedMatchups) ? approvedMatchups : [];
    let savedMatchupsCount = 0;

    for (const m of matchupsToSave) {
      if (!m.targetChampion || !m.enemyChampion || !m.strategy) continue;

      try {
        const targetChamp = await resolveToRosterChampion(m.targetChampion) || m.targetChampion;
        const enemyChamp = await resolveToRosterChampion(m.enemyChampion) || m.enemyChampion;
        const matchupIdPrimary = `champ_${targetChamp}_vs_${enemyChamp}`;
        const matchupIdSecondary = `${targetChamp}_vs_${enemyChamp}`;

        const matchupRecord = {
          matchup_id: matchupIdPrimary,
          champion: targetChamp,
          enemy: enemyChamp,
          title: m.title || `${targetChamp} vs ${enemyChamp} 対策メモ`,
          strategy: m.strategy,
          raw_data: {
            source: 'library_article',
            source_article_id: articleId,
            source_title: title,
            extracted_at: new Date().toISOString(),
          },
        };

        // プライマリID (champ_A_vs_B) で upsert
        await supabase
          .from('matchup_sentinel')
          .upsert(matchupRecord, { onConflict: 'matchup_id' });

        // 互換性のためレガシーID (A_vs_B) でも upsert
        await supabase
          .from('matchup_sentinel')
          .upsert({ ...matchupRecord, matchup_id: matchupIdSecondary }, { onConflict: 'matchup_id' });

        savedMatchupsCount++;
      } catch (matchupErr) {
        console.warn(`[merge-article] 対面メモ保存失敗 (${m.targetChampion} vs ${m.enemyChampion}):`, matchupErr);
      }
    }

    if (savedMatchupsCount > 0) {
      mergedNote += `／対面メモ${savedMatchupsCount}件を保存`;
    }

    // 3. チャンピオン固有へ振り分けられた知見の辞典への書き込み
    const specificInsights: Array<{ champion: string; title: string; summary: string }> =
      Array.isArray(championSpecificInsights) ? championSpecificInsights : [];
    let savedSpecificCount = 0;

    for (const item of specificInsights) {
      if (!item.champion || !item.summary) continue;
      try {
        const resolvedChamp = await resolveToRosterChampion(item.champion) || item.champion;
        const insightHeader = `### 【固有知見】${item.title || '戦術メモ'}`;
        const insightText = `${insightHeader}\n${item.summary}`;

        // 1) champion_facts の strategy へ追記マージ
        const { data: existingFact } = await supabase
          .from('champion_facts')
          .select('strategy')
          .eq('champion', resolvedChamp)
          .maybeSingle();

        const currentStrategy = existingFact?.strategy || '';
        if (!currentStrategy.includes(item.summary.trim())) {
          const updatedStrategy = currentStrategy.trim()
            ? `${currentStrategy.trim()}\n\n${insightText}`
            : insightText;

          await supabase
            .from('champion_facts')
            .upsert({
              champion: resolvedChamp,
              strategy: updatedStrategy,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'champion' });

          await recordRevision({
            targetType: 'champion_fact',
            targetKey: resolvedChamp,
            field: 'strategy',
            before: currentStrategy,
            after: updatedStrategy,
            sourceTitle: title,
            sourceId: articleId,
          });
        }

        // 2) champion_notes にも個別知見として保存
        await supabase.from('champion_notes').insert({
          champion: resolvedChamp,
          source_article_id: articleId,
          title: `【知見】${item.title || title}`,
          body: item.summary,
          source: 'article_specific_insight',
        });

        savedSpecificCount++;
      } catch (specErr) {
        console.warn(`[merge-article] チャンピオン固有知見保存失敗 (${item.champion}):`, specErr);
      }
    }

    if (savedSpecificCount > 0) {
      mergedNote += (mergedNote ? '／' : '') + `チャンピオン固有知見${savedSpecificCount}件を辞典に反映`;
    }

    // 4. champion_notes にも元記事を直接dual-write（内部fetchのハング防止）
    try {
      for (const champion of validChampions) {
        if (articleId != null) {
          await supabase.from('champion_notes').delete().eq('champion', champion).eq('source_article_id', articleId);
        } else {
          await supabase.from('champion_notes').delete().eq('champion', champion).eq('title', title).eq('source', 'article');
        }
        await supabase.from('champion_notes').insert({
          champion,
          source_article_id: articleId,
          title,
          body: content,
          source: 'article',
        });
      }
    } catch (dualErr) {
      console.warn('[merge-article] champion_notesへのdual-write失敗:', dualErr);
    }

    // 5. レーン一般論の統合（選択された知見のみを統合）
    if (sendLaneGeneralToLane && typeof laneGeneralExcerpt === 'string' && laneGeneralExcerpt.trim()) {
      try {
        await mergeContentIntoLane(sendLaneGeneralToLane, title, laneGeneralExcerpt, articleId);
        mergedNote += (mergedNote ? '／' : '') + 'レーンガイドにも統合';
      } catch (laneErr: any) {
        console.warn('[merge-article] レーンガイドへの統合に失敗:', laneErr);
      }
    }

    // 5. ライブラリから削除（__DELETED__ タグを付与）
    const { error: deleteError } = await supabase
      .from('personal_knowledge')
      .update({ tags: ['__DELETED__'] })
      .eq('id', articleId);
    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      merged: true,
      champions: validChampions,
      mergedNote: mergedNote || '／トレンド構造化データを更新',
      savedMatchupsCount,
    });
  } catch (e: any) {
    console.error('[merge-article] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
