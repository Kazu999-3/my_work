import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { normalizeChampionName } from '../../../../lib/championNames';

export async function POST(request: Request) {
  try {
    const authResult = await verifyAdminSession(request);
    if (!authResult.ok) {
      return NextResponse.json({ warning: null });
    }

    const body = await request.json().catch(() => ({}));
    const { champion: championInput = '', enemyChampion: enemyChampionInput = '' } = body;

    if (!championInput || !enemyChampionInput) {
      return NextResponse.json({ warning: null });
    }

    // 自由記述の入力欄からの値は大文字小文字・アポストロフィがDB表記と食い違うことがあり、
    // 完全一致検索では無警告のまま何も見つからなくなる(coach/analyzeのmatchupモードと同じ正規化)。
    const champion = normalizeChampionName(championInput);
    const enemyChampion = normalizeChampionName(enemyChampionInput);

    if (!supabaseAdmin) {
      return NextResponse.json({ warning: null });
    }

    // 1. Check matchup_sentinel (複数のID形式またはchampion+enemyで検索)
    const matchupIds = [`${champion}_vs_${enemyChampion}`, `champ_${champion}_vs_${enemyChampion}`];
    const { data: sentinelDataList } = await supabaseAdmin
      .from('matchup_sentinel')
      .select('strategy, title, updated_at')
      .or(`matchup_id.in.(${matchupIds.join(',')}),and(champion.eq.${champion},enemy.eq.${enemyChampion})`)
      .order('updated_at', { ascending: false })
      .limit(1);

    const sentinelData = sentinelDataList?.[0] || null;

    // 2. Check soloq_reflections（メモ付きまたは過去の全戦績）
    const { data: reflectionsData } = await supabaseAdmin
      .from('soloq_reflections')
      .select('id, match_id, champion, enemy_champion, win, lane_result, kda, cs, game_duration, win_lose_reason_tags, reflection_note, matchup_memo, next_focus_point, created_at')
      .eq('enemy_champion', enemyChampion)
      .order('created_at', { ascending: false })
      .limit(10);

    // 3. 対面(レーン/JG)成績の完全統合集計
    // 自身のチャンピオンも一致する行を優先しつつ、対面戦績を取得
    const { data: laneRows } = await supabaseAdmin
      .from('soloq_reflections')
      .select('lane_result, win, champion, win_lose_reason_tags')
      .eq('enemy_champion', enemyChampion);

    // 自身がプレイしたチャンピオンに絞り込み (指定がある場合)
    const relevantRows = (laneRows || []).filter(
      (r: any) => !champion || r.champion?.toLowerCase() === champion.toLowerCase()
    );
    const targetRows = relevantRows.length > 0 ? relevantRows : (laneRows || []);

    const wins = targetRows.filter((r: any) => r.lane_result === 'win').length;
    const evens = targetRows.filter((r: any) => r.lane_result === 'even').length;
    const losses = targetRows.filter((r: any) => r.lane_result === 'loss').length;
    const total = targetRows.length;
    const decided = wins + losses;

    // ① 純粋対面勝率 (1v1/JG直接勝敗): 勝ち / (勝ち+負け)
    const laneWinRate = decided > 0 ? Math.round((wins / decided) * 100) : (total > 0 && evens === total ? 50 : 0);

    // ② 互角耐え0.5換算の補正勝率: (勝ち×1.0 + 互角×0.5) / 全試合
    const adjustedLaneWinRate = total > 0 ? Math.round(((wins * 1.0 + evens * 0.5) / total) * 100) : 0;

    // ③ チーム勝率 (Nexus破壊)
    const gameWins = targetRows.filter((r: any) => r.win).length;
    const gameWinRate = total > 0 ? Math.round((gameWins / total) * 100) : 0;

    // ④ キャリー変換率 (レーンで勝った試合中、チームも勝利した割合 = 味方ガチャ耐性)
    const laneWinRows = targetRows.filter((r: any) => r.lane_result === 'win');
    const laneAndGameWins = laneWinRows.filter((r: any) => r.win).length;
    const carryConversionRate = laneWinRows.length > 0
      ? Math.round((laneAndGameWins / laneWinRows.length) * 100)
      : null;

    // ⑤ 外部ノイズ（味方崩壊・被キャンプ）タグ検出数
    const noiseTags = new Set(['味方崩壊', '他レーン崩壊', '敵JGキャンプ', '味方トロール', '不可抗力', 'JG差なし']);
    const noiseMatchCount = targetRows.filter((r: any) =>
      (r.win_lose_reason_tags || []).some((t: string) => noiseTags.has(t))
    ).length;

    const laneRecord = total > 0
      ? {
          wins,
          evens,
          losses,
          total,
          laneWinRate,
          adjustedLaneWinRate,
          gameWinRate,
          carryConversionRate,
          noiseMatchCount,
          isChampionSpecific: relevantRows.length > 0,
        }
      : null;

    let memoText = '';
    if (sentinelData?.strategy) {
      memoText = sentinelData.strategy;
    } else if (reflectionsData && reflectionsData.length > 0) {
      memoText = reflectionsData.map((r: any) => r.matchup_memo).filter(Boolean).slice(0, 3).join('\n---\n');
    }

    // 頻出タグの集計
    const tagCount: Record<string, number> = {};
    (reflectionsData || []).forEach((r: any) => {
      (r.win_lose_reason_tags || []).forEach((t: string) => {
        tagCount[t] = (tagCount[t] || 0) + 1;
      });
    });
    const frequentTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([tag]) => tag);

    const personalDossier = reflectionsData && reflectionsData.length > 0
      ? {
          totalMatches: reflectionsData.length,
          recentMatches: reflectionsData.slice(0, 5).map((r: any) => ({
            matchId: r.match_id,
            champion: r.champion,
            win: r.win,
            laneResult: r.lane_result,
            kda: r.kda,
            memo: r.matchup_memo || r.reflection_note,
            createdAt: r.created_at,
          })),
          frequentTags,
        }
      : null;

    return NextResponse.json({
      warning: {
        champion,
        enemyChampion,
        memo: memoText || null,
        laneRecord,
        personalDossier,
        recentReflectionsCount: reflectionsData ? reflectionsData.length : 0,
        lastUpdatedAt: sentinelData?.updated_at || (reflectionsData?.[0]?.created_at || null),
      },
    });
  } catch (err: any) {
    console.error('Error fetching matchup warning:', err);
    return NextResponse.json({ warning: null });
  }
}
