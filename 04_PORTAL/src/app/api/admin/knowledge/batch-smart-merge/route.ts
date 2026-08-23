import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { resolveToRosterChampion, resolveChampionListString } from '../../../../../lib/dictFactCheck';
import { detectLane, classifyLaneGeneralContent, mergeContentIntoLane } from '../../../../../lib/laneGuideMerge';
import { recordMatchupSentinelRevision } from '../../../../../lib/matchupSentinelRevisions';
import { recordRevision } from '../../../../../lib/knowledgeRevisions';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // サーバーレスタイムアウト対策

const TREND_FIELDS = [
  { key: 'strengths', label: '強み・長所' },
  { key: 'weaknesses', label: '弱み・注意点' },
  { key: 'power_spikes', label: 'パワースパイク' },
  { key: 'build_runes', label: 'ビルド/ルーン' },
  { key: 'strategy', label: '基本立ち回り' },
  { key: 'must_ban_champions', label: '要注意・BAN推奨' },
  { key: 'pick_recommendation', label: 'ピック基準' },
] as const;

/** AIで記事を解析し、チャンピオントレンド構造化項目と対面マッチアップ情報を抽出する */
async function extractArticleInsights(
  title: string,
  content: string,
  champions: string[]
): Promise<{
  trendData: Record<string, {
    summaryPoints: string[];
    fields: Partial<Record<typeof TREND_FIELDS[number]['key'], string>>;
  }>;
  matchups: Array<{ targetChampion: string; enemyChampion: string; title: string; strategy: string }>;
}> {
  if (!champions || champions.length === 0) return { trendData: {}, matchups: [] };
  const champListStr = champions.join(', ');
  const prompt = `あなたはLeague of Legendsの戦略データアナリストです。
以下の攻略記事を詳細に分析し、対象チャンピオン【${champListStr}】に関する構造化トレンドデータ、および記事中に登場する「対特定チャンピオン（マッチアップ対策）」情報を整理して抽出してください。

【記事タイトル】
${title || '無題'}

【記事本文】
${content.slice(0, 8000)}

【指示】
1. **各チャンピオンのトレンド項目**:
   - 対象チャンピオン（${champListStr}）ごとに、記事から得られる知見を以下の項目別に文章で整理してください。
   - strengths: 強み・長所
   - weaknesses: 弱み・課題・警戒すべき点
   - power_spikes: パワースパイク（強い時間帯、特定アイテム完成時、Lv到達時など）
   - build_runes: 推奨ビルド・ルーン・アイテム選択
   - strategy: 基本的な立ち回り・プレイスタイル・マクロ判断
   - must_ban_champions: 苦手な相手やBAN推奨チャンピオン
   - pick_recommendation: このチャンピオンをピックすべき状況や構成
   - summaryPoints: 記事全体の要点箇条書き（2〜4点）

2. **対面マッチアップ対策 (matchups)**:
   - 記事内に「対〇〇（敵チャンピオン名）」に対する具体的な対策や立ち回りが書かれている場合、抽出してください。
   - targetChampion: 対策を行う側のチャンピオン（${champListStr}のいずれか）
   - enemyChampion: 相手となる敵チャンピオン名（正式名称/英語名）
   - title: マッチアップの要約タイトル（例: 「対ヤスオ: W風殺の壁のクールダウン中のトレード」）
   - strategy: 具体的な対面立ち回り・スキル回避・パワースパイクの違い

出力は必ず以下のJSON形式のみ（コードブロックや余分な解説は禁止）:
{
  "trendData": {
    "対象チャンピオン名": {
      "summaryPoints": ["要点1", "要点2"],
      "fields": {
        "strengths": "強み...",
        "weaknesses": "弱み...",
        "power_spikes": "...",
        "build_runes": "...",
        "strategy": "...",
        "must_ban_champions": "...",
        "pick_recommendation": "..."
      }
    }
  },
  "matchups": [
    {
      "targetChampion": "自チャンプ",
      "enemyChampion": "敵チャンプ",
      "title": "対策タイトル",
      "strategy": "対策解説..."
    }
  ]
}`;

  try {
    const raw = await callGeminiWithRetry(prompt, {
      temperature: 0.2,
      maxOutputTokens: 4096,
      maxRetries: 2,
      responseMimeType: 'application/json',
    });
    const cleaned = (raw || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) {
      const parsed = JSON.parse(cleaned.slice(s, e + 1));
      const trendData = parsed.trendData || {};
      const rawMatchups = Array.isArray(parsed.matchups) ? parsed.matchups : [];
      const validatedMatchups = [];
      for (const m of rawMatchups) {
        if (!m.enemyChampion || !m.strategy) continue;
        const normalizedEnemy = await resolveToRosterChampion(m.enemyChampion);
        const normalizedTarget = (await resolveToRosterChampion(m.targetChampion)) || champions[0];
        if (normalizedEnemy && normalizedTarget && normalizedEnemy !== normalizedTarget) {
          validatedMatchups.push({
            targetChampion: normalizedTarget,
            enemyChampion: normalizedEnemy,
            title: m.title || `${normalizedTarget} vs ${normalizedEnemy} 対策`,
            strategy: m.strategy,
          });
        }
      }
      return { trendData, matchups: validatedMatchups };
    }
  } catch (err) {
    console.warn('[batch-smart-merge] extractArticleInsights error:', err);
  }
  return { trendData: {}, matchups: [] };
}

/** 単一記事をスマート統合する */
async function processSingleArticle(article: any): Promise<{
  success: boolean;
  articleId: any;
  title: string;
  champions: string[];
  laneGeneralCount: number;
  matchupCount: number;
  error?: string;
}> {
  const articleId = article.id;
  const title = article.title || '無題';
  const content = article.raw_content || article.content || '';

  try {
    // 1. チャンピオン判定
    const validChampions = await resolveChampionListString(article.champion || '');
    const champLabel = validChampions.join(', ');

    // 2. チャンピオントレンド & マッチアップ抽出
    const { trendData, matchups } = validChampions.length > 0
      ? await extractArticleInsights(title, content, validChampions)
      : { trendData: {}, matchups: [] };

    // 3. レーン一般論抽出
    let laneGeneralInsights: { title: string; summary: string }[] = [];
    try {
      laneGeneralInsights = await classifyLaneGeneralContent(title, content, champLabel);
    } catch (e) {
      console.warn(`[batch-smart-merge] レーン一般論抽出失敗 (${title}):`, e);
    }

    // 4. チャンピオン辞典への書き込み
    for (const championName of validChampions) {
      // 4-a. matchup_sentinel (GLOBAL)
      const matchupId = `champ_${championName}_global`;
      const { data: existingMatchup } = await supabase
        .from('matchup_sentinel')
        .select('title, raw_data, strategy')
        .eq('matchup_id', matchupId)
        .maybeSingle();

      const existingStrategy = existingMatchup?.strategy || '';
      const header = `## 【記事】${title}`;
      let updatedStrategy = existingStrategy;
      if (!existingStrategy.trim()) {
        updatedStrategy = `${header}\n\n${content}`;
      } else if (!existingStrategy.includes(header)) {
        updatedStrategy = `${existingStrategy}\n\n---\n\n${header}\n\n${content}`;
      }

      await supabase.from('matchup_sentinel').upsert({
        matchup_id: matchupId,
        champion: championName,
        enemy: 'GLOBAL',
        strategy: updatedStrategy,
        raw_data: { ...(existingMatchup?.raw_data || {}), source: 'champ_db', role: 'GLOBAL' },
        created_at: new Date().toISOString(),
      }, { onConflict: 'matchup_id' });

      await recordMatchupSentinelRevision(
        matchupId,
        existingMatchup,
        { strategy: updatedStrategy },
        `スマート一括同期（記事: ${title}）`
      );

      // 4-b. champion_facts (構造化項目マージ)
      const champTrend = trendData[championName] || trendData[Object.keys(trendData).find(k => k.toLowerCase() === championName.toLowerCase()) || ''];
      if (champTrend?.fields) {
        // ロール特定
        const { data: laneRoleRows } = await supabase
          .from('champion_lane_roles')
          .select('role, rank')
          .ilike('champion', championName)
          .order('rank', { ascending: true });
        const detectedRole = (laneRoleRows && laneRoleRows.length > 0) ? (laneRoleRows[0].role === 'ADC' ? 'BOT' : laneRoleRows[0].role) : 'GLOBAL';

        const { data: existingFact } = await supabase
          .from('champion_facts')
          .select('*')
          .eq('champion', championName)
          .ilike('role', detectedRole)
          .maybeSingle();

        const updates: Record<string, any> = {
          champion: championName,
          role: detectedRole,
          updated_at: new Date().toISOString(),
        };

        for (const [fKey, fVal] of Object.entries(champTrend.fields)) {
          if (fVal && typeof fVal === 'string' && fVal.trim()) {
            const currentVal = existingFact ? existingFact[fKey] || '' : '';
            const mergedVal = currentVal.trim() ? `${currentVal}\n\n- ${fVal.trim()}` : `- ${fVal.trim()}`;
            updates[fKey] = mergedVal;
          }
        }

        await supabase.from('champion_facts').upsert(updates, { onConflict: 'champion,role' });
      }

      // 4-c. champion_notes
      await supabase.from('champion_notes').delete().eq('champion', championName).eq('source_article_id', articleId);
      await supabase.from('champion_notes').insert({
        champion: championName,
        source_article_id: articleId,
        title,
        body: content,
        source: 'article',
      });
    }

    // 5. 対面マッチアップの保存 (matchup_sentinel)
    for (const m of matchups) {
      try {
        const mId = `champ_${m.targetChampion}_vs_${m.enemyChampion}`;
        const { data: existM } = await supabase.from('matchup_sentinel').select('*').eq('matchup_id', mId).maybeSingle();
        const header = `### 【知見】${m.title}`;
        let strat = existM?.strategy || '';
        strat = strat.trim() ? `${strat}\n\n${header}\n${m.strategy}` : `${header}\n${m.strategy}`;

        await supabase.from('matchup_sentinel').upsert({
          matchup_id: mId,
          champion: m.targetChampion,
          enemy: m.enemyChampion,
          strategy: strat,
          created_at: new Date().toISOString(),
        }, { onConflict: 'matchup_id' });
      } catch (me: any) {
        console.warn('[batch-smart-merge] matchup save error:', me);
      }
    }

    // 6. レーン一般論をレーン別ガイドへマージ
    let laneCount = 0;
    if (laneGeneralInsights.length > 0) {
      const targetLane = detectLane(article);
      const laneExcerpt = laneGeneralInsights.map((i) => `## ${i.title}\n${i.summary}`).join('\n\n');
      try {
        await mergeContentIntoLane(targetLane, title, laneExcerpt, articleId);
        laneCount = laneGeneralInsights.length;
      } catch (le: any) {
        console.warn('[batch-smart-merge] lane guide merge error:', le);
      }
    } else if (validChampions.length === 0) {
      // チャンピオン特定がない純粋なマクロ記事の場合、記事全体をレーンガイドへ
      const targetLane = detectLane(article);
      try {
        await mergeContentIntoLane(targetLane, title, content, articleId);
        laneCount = 1;
      } catch (le: any) {
        console.warn('[batch-smart-merge] full article lane guide merge error:', le);
      }
    }

    // 7. ライブラリから退避（__DELETED__）
    await supabase.from('personal_knowledge').update({ tags: ['__DELETED__'] }).eq('id', articleId);

    return {
      success: true,
      articleId,
      title,
      champions: validChampions,
      laneGeneralCount: laneCount,
      matchupCount: matchups.length,
    };
  } catch (err: any) {
    console.error(`[batch-smart-merge] 記事${articleId}の処理エラー:`, err);
    return {
      success: false,
      articleId,
      title,
      champions: [],
      laneGeneralCount: 0,
      matchupCount: 0,
      error: err.message,
    };
  }
}

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { articleIds } = await req.json();
    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json({ error: 'articleIdsの配列が必要です' }, { status: 400 });
    }

    // 1回で受け付ける最大件数を制限（タイムアウト防止）
    const targetIds = articleIds.slice(0, 5);

    // 記事データ取得
    const { data: articles, error } = await supabase
      .from('personal_knowledge')
      .select('*')
      .in('id', targetIds);

    if (error) throw error;
    if (!articles || articles.length === 0) {
      return NextResponse.json({ success: true, results: [], processedCount: 0 });
    }

    const results = [];
    for (const article of articles) {
      const res = await processSingleArticle(article);
      results.push(res);
    }

    return NextResponse.json({
      success: true,
      results,
      processedCount: results.length,
      remainingCount: Math.max(0, articleIds.length - targetIds.length),
    });
  } catch (err: any) {
    console.error('[batch-smart-merge] API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
