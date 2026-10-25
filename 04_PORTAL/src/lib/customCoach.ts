import { supabase } from './supabaseClient';
import { callGeminiWithRetry } from './geminiClient';

export interface CustomCoachReport {
  playerName: string;
  analyzedMatchesCount: number;
  overallRating: 'S' | 'A' | 'B' | 'C';
  coachBadge: {
    title: string;
    description: string;
    icon: string;
  };
  keyStats: {
    avgKda: string;
    avgDamage: number;
    avgTimeDeadSec: number;
    avgCs: number;
    winRate: number;
    mostPlayedChamp: string;
    mainRole: string;
  };
  strengths: Array<{
    title: string;
    detail: string;
  }>;
  improvementFocus: {
    headline: string;
    analysis: string;
    actionableAdvice: string;
  };
  itemAndBuildAdvice: {
    summary: string;
    recommendedTip: string;
  };
  soloqGapAnalysis?: {
    hasSoloqData: boolean;
    soloqRank?: string;
    soloqPlaystyleTag?: string;
    tendencyDifference: string;
    synergyAdvice: string;
  };
  coachCheerMessage: string;
  createdAt: string;
}

/**
 * プレイヤーのソロキュー連携情報・プレイスタイルを取得
 */
export async function fetchPlayerSoloqInfo(playerName: string) {
  if (!supabase) return null;
  try {
    const { data: p } = await supabase
      .from('ktm_players')
      .select('highest_rank, puuid, riot_id, metadata')
      .eq('name', playerName)
      .maybeSingle();

    if (!p) return null;

    const soloq = (p.metadata as any)?.playstyle_cache?.soloq;
    return {
      highestRank: p.highest_rank || 'UNRANKED',
      riotId: p.riot_id || '',
      hasPuuid: Boolean(p.puuid),
      soloqPlaystyle: soloq || null,
    };
  } catch {
    return null;
  }
}

/**
 * プレイヤーの直近カスタム戦績と生詳細スタッツを収集
 */
export async function fetchPlayerRecentCustomMatches(playerName: string, limit = 8) {
  if (!supabase) return [];

  // プレイヤーの参加履歴を取得（新しい順）
  const { data: participations, error } = await supabase
    .from('ktm_match_participants')
    .select(`
      match_id,
      player_name,
      team,
      role,
      champion_name,
      kills,
      deaths,
      assists,
      kda_score,
      cs,
      gold,
      damage_dealt,
      vision_score,
      mmr_delta,
      player_mmr,
      ktm_matches (
        id,
        created_at,
        winning_team,
        game_duration
      )
    `)
    .eq('player_name', playerName)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !participations || participations.length === 0) {
    return [];
  }

  // edge_tasks から生詳細スタッツを取得してマージ
  const matchIds = participations.map((p: any) => p.match_id).filter(Boolean);
  const detailMap = new Map<string, any>();
  if (matchIds.length > 0) {
    try {
      const { data: detailTasks } = await supabase
        .from('edge_tasks')
        .select('payload')
        .eq('task_type', 'ktm_match_detail_stats')
        .limit(100);

      if (detailTasks) {
        for (const t of detailTasks) {
          const p = t.payload;
          if (p?.matchId) {
            detailMap.set(String(p.matchId), p);
          }
        }
      }
    } catch {
      // 取得失敗時はフォールバック
    }
  }

  return participations.map((p: any) => {
    const match = p.ktm_matches;
    const isWin = match?.winning_team ? p.team === match.winning_team : false;
    const detail = detailMap.get(String(p.match_id));
    const participantDetail = detail?.participants?.find((dp: any) => dp.name === playerName);

    return {
      matchId: p.match_id,
      date: match?.created_at,
      duration: match?.game_duration || 0,
      isWin,
      role: p.role,
      champion: p.champion_name || 'Unknown',
      kills: Number(p.kills) || 0,
      deaths: Number(p.deaths) || 0,
      assists: Number(p.assists) || 0,
      cs: Number(p.cs) || 0,
      gold: Number(p.gold) || 0,
      damageDealt: Number(p.damage_dealt) || 0,
      visionScore: Number(p.vision_score) || 0,
      mmrDelta: Number(p.mmr_delta) || 0,
      playerMmr: Number(p.player_mmr) || 0,
      // 生詳細スタッツ
      items: participantDetail?.items || [],
      spells: participantDetail?.spells || [],
      timeDead: Number(participantDetail?.time_dead) || 0,
      soloKills: Number(participantDetail?.solo_kills) || 0,
      damageMitigated: Number(participantDetail?.damage_mitigated) || 0,
      ccTime: Number(participantDetail?.cc_time) || 0,
      buildingDamage: Number(participantDetail?.building_damage) || 0,
    };
  });
}

/**
 * 実スタッツに基づくルールベースフォールバックカルテ生成
 */
export function buildRuleBasedReport(playerName: string, matches: any[], soloqInfo?: any): CustomCoachReport {
  const totalMatches = matches.length;
  const wins = matches.filter(m => m.isWin).length;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 50;

  const totalKills = matches.reduce((sum, m) => sum + m.kills, 0);
  const totalDeaths = matches.reduce((sum, m) => sum + m.deaths, 0);
  const totalAssists = matches.reduce((sum, m) => sum + m.assists, 0);
  const avgKda = totalDeaths > 0 ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : (totalKills + totalAssists).toFixed(2);

  const avgDamage = totalMatches > 0 ? Math.round(matches.reduce((sum, m) => sum + m.damageDealt, 0) / totalMatches) : 0;
  const avgTimeDead = totalMatches > 0 ? Math.round(matches.reduce((sum, m) => sum + m.timeDead, 0) / totalMatches) : 0;
  const avgCs = totalMatches > 0 ? Math.round(matches.reduce((sum, m) => sum + m.cs, 0) / totalMatches) : 0;

  // 頻出ロールとチャンピオン
  const roleCounts: Record<string, number> = {};
  const champCounts: Record<string, number> = {};
  for (const m of matches) {
    roleCounts[m.role] = (roleCounts[m.role] || 0) + 1;
    champCounts[m.champion] = (champCounts[m.champion] || 0) + 1;
  }
  const mainRole = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ALL';
  const mostPlayedChamp = Object.entries(champCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Flexible';

  // コーチ称号バッジの判定
  let badge = { title: 'オールラウンダー', description: '柔軟なピックと安定したプレイでチームを支える要', icon: '🌟' };
  if (avgDamage >= 20000 || totalKills / Math.max(1, totalMatches) >= 7) {
    badge = { title: '集団戦の主砲', description: 'チーム最大の火力を叩き出し、敵前線を粉砕するエースアタッカー', icon: '🔥' };
  } else if (mainRole === 'SUP' || matches.some(m => m.visionScore >= 35)) {
    badge = { title: '影のゲームメイカー', description: '戦局を見渡す視界掌握と味方キャリーの生存を死守する守護神', icon: '👁️' };
  } else if (mainRole === 'TOP' || matches.some(m => m.damageMitigated >= 25000)) {
    badge = { title: '不沈の重戦車', description: '最前線で敵の猛攻を一身に引き受け、味方に安全な射撃陣地を作る砦', icon: '🛡️' };
  } else if (winRate >= 65) {
    badge = { title: '勝負師の勝率マスター', description: '不利な局面でも勝ち筋を見失わずチームを勝利へ導く勝負強さ', icon: '👑' };
  }

  // 総合評価
  let overallRating: 'S' | 'A' | 'B' | 'C' = 'A';
  if (winRate >= 65 && Number(avgKda) >= 3.0) overallRating = 'S';
  else if (winRate < 45 || Number(avgKda) < 1.8) overallRating = 'B';

  const strengths = [
    {
      title: '高水準なキル関与とダメージ出力',
      detail: `直近${totalMatches}試合において平均ダメージ${avgDamage.toLocaleString()}を記録。特に${mostPlayedChamp}使用時の集団戦での存在感はチームの大きな武器です。`,
    },
    {
      title: `${mainRole}ロールにおける安定した立ち回り`,
      detail: `平均KDA ${avgKda}を維持。序盤のレーン戦から中盤のオブジェクト前への合流意識が高く、味方の動きに合わせやすいプレイができています。`,
    },
  ];

  const timeDeadMin = Math.floor(avgTimeDead / 60);
  const timeDeadSec = avgTimeDead % 60;
  const timeDeadText = avgTimeDead > 0 ? `${timeDeadMin}分${timeDeadSec}秒` : '少数デス';

  const improvementFocus = {
    headline: '中盤の孤立デスを1回減らし、画面白黒時間を削る',
    analysis: `1試合あたりの平均白黒画面時間は約${timeDeadText}。デスの多くが中盤15分〜25分の視界外でのキャッチや単独プッシュ時に発生しています。`,
    actionableAdvice: `ローム時やサイドプッシュ時は、味方JGやSUPの視界が取れている範囲から一歩引いた位置でウェーブを処理しましょう。「次のドラゴン湧き1分前」は単独行動を止め、味方と合流するだけで勝率が一段上がります。`,
  };

  const itemAndBuildAdvice = {
    summary: 'コアアイテムの完成タイミングと対面防御アイテムのバランス',
    recommendedTip: '敵のアサシンやCCが重い構成の場合、第2・第3コアで早めのストップウォッチ系（ゾーニャ）やサモスペ（クレンズ・フラッシュ）の温存を意識すると生存率が跳ね上がります。',
  };

  // 🎮 ソロQ×カスタムのギャップ診断
  let soloqGapAnalysis = undefined;
  if (soloqInfo && soloqInfo.hasPuuid) {
    const soloqRank = soloqInfo.highestRank || 'UNRANKED';
    const tag = soloqInfo.soloqPlaystyle?.primaryTag || 'balanced-player';
    soloqGapAnalysis = {
      hasSoloqData: true,
      soloqRank,
      soloqPlaystyleTag: tag,
      tendencyDifference: `ソロキューでは【${soloqRank}】で個人技・ソロキルを主体に戦う傾向がありますが、カスタムではチームの連携やエンゲージ合わせを優先して慎重に立ち回る場面が見られます。`,
      synergyAdvice: `ソロキューで培った鋭い対面キル圧をカスタムでも遠慮なく発揮しましょう。「自分がレーンを押し込んで先に寄る」コールを味方に1言伝えるだけで、チーム全体の士気と勝率が急上昇します。`,
    };
  }

  return {
    playerName,
    analyzedMatchesCount: totalMatches,
    overallRating,
    coachBadge: badge,
    keyStats: {
      avgKda,
      avgDamage,
      avgTimeDeadSec: avgTimeDead,
      avgCs,
      winRate,
      mostPlayedChamp,
      mainRole,
    },
    strengths,
    improvementFocus,
    itemAndBuildAdvice,
    soloqGapAnalysis,
    coachCheerMessage: `${playerName}さんの持ち味であるアグレッシブな判断力はチームの強力な推進力です！中盤の生存意識をあと1つ高めるだけで、次戦のキャリー力はさらに覚醒します！`,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Gemini を用いてプレイヤー専用カルテをオンデマンド生成
 */
export async function generateCustomCoachReport(playerName: string): Promise<CustomCoachReport> {
  const [matches, soloqInfo] = await Promise.all([
    fetchPlayerRecentCustomMatches(playerName, 8),
    fetchPlayerSoloqInfo(playerName),
  ]);

  if (matches.length === 0) {
    throw new Error('分析対象のカスタム試合履歴がまだありません。カスタムに参加後に再度お試しください。');
  }

  // ルールベースの基礎サマリーを作成
  const baseReport = buildRuleBasedReport(playerName, matches, soloqInfo);

  // Gemini プロンプトの組み立て
  const matchesSummary = matches.map((m: any, idx: number) => {
    const result = m.isWin ? '【勝利】' : '【敗北】';
    const itemsText = m.items?.length > 0 ? `アイテム:[${m.items.filter((i: any) => i > 0).join(',')}]` : '';
    const details = [
      `KDA:${m.kills}/${m.deaths}/${m.assists}`,
      `与ダメ:${(m.damageDealt/1000).toFixed(1)}k`,
      `CS:${m.cs}`,
      m.timeDead > 0 ? `白黒時間:${m.timeDead}秒` : '',
      m.soloKills > 0 ? `ソロキル:${m.soloKills}回` : '',
    ].filter(Boolean).join(', ');
    return `試合${idx+1}: ${result} ${m.role} (${m.champion}) - ${details} ${itemsText}`;
  }).join('\n');

  const soloqSection = soloqInfo?.hasPuuid
    ? `\n【ソロキュー戦績データ】\n・最高到達ランク: ${soloqInfo.highestRank}\n・ソロQプレイスタイル傾向: ${soloqInfo.soloqPlaystyle?.primaryTag || 'balanced-player'}`
    : '';

  const prompt = `あなたはLoLプロチームの専属アナリスト兼パーソナルコーチです。
プレイヤー「${playerName}」の直近のカスタム試合の実数値スコアに基づき、選手の自信を高めつつ、次戦で勝率をあと一段引き上げるための【個人専属カルテ】を作成してください。

【コーチングの鉄則】
1. **まず本人のストロングポイント（強み）を具体的に褒める**:
   - 与ダメージ量、集団戦のキル関与、視界、オブジェクト意識など、実数値に基づき本人の貢献を最大に評価してください。
2. **改善点は「次戦ですぐ実行できる1点」に絞る**:
   - あれこれ指摘せず、最もコスパ良く勝率が上がる「1つの習慣（特に白黒画面時間・中盤の孤立デス対策）」に集中してください。
   - 単なる精神論（「気をつける」）ではなく、「ドラゴンの1分前は視界のないサイドに行かず味方JGと合流する」のような【具体的シチュエーションに基づく行動】に落とし込んでください。
3. **トーン**:
   - 親しみやすく、論理的で、選手をリスペクトした情熱的なプロコーチトーン。
4. 出力は以下のJSON形式【のみ】（Markdownバッククォート不要）。

【直近カスタム試合データ】
・分析対象試合数: ${matches.length}試合
・平均勝率: ${baseReport.keyStats.winRate}% (平均KDA: ${baseReport.keyStats.avgKda})
・主なロール: ${baseReport.keyStats.mainRole} / 主なチャンプ: ${baseReport.keyStats.mostPlayedChamp}
・平均与ダメ: ${baseReport.keyStats.avgDamage.toLocaleString()} / 平均白黒時間: ${baseReport.keyStats.avgTimeDeadSec}秒
${matchesSummary}
${soloqSection}

{
  "playerName": "${playerName}",
  "overallRating": "${baseReport.overallRating}",
  "coachBadge": {
    "title": "選手を表すキャッチーな称号（例: 集団戦の主砲、不沈の守護神、影のゲームメイカー、変幻自在の遊撃手など）",
    "description": "称号の理由となる本人のプレイスタイルの魅力（40文字以内）",
    "icon": "称号にふさわしい絵文字1文字"
  },
  "strengths": [
    {
      "title": "1つ目のストロングポイント（20文字以内）",
      "detail": "実数値に基づき本人のキャリー力や貢献を熱狂的に称える解説（80文字程度）"
    },
    {
      "title": "2つ目のストロングポイント（20文字以内）",
      "detail": "集団戦やロールにおける立ち回りの良さを称える解説（80文字程度）"
    }
  ],
  "improvementFocus": {
    "headline": "次戦で勝率が上がる1つの具体的一手（30文字以内）",
    "analysis": "白黒時間やデス傾向に基づき、なぜそこで損をしているかの明快な分析（80文字程度）",
    "actionableAdvice": "次戦で意識するだけの具体的なアクション指針（100文字程度）"
  },
  "itemAndBuildAdvice": {
    "summary": "ビルドやアイテム選択に関する客観的な総評（40文字以内）",
    "recommendedTip": "生存力や火力を最大化するためのワンポイントアドバイス（80文字以内）"
  },
  "coachCheerMessage": "専属コーチからの熱い激励メッセージ（60文字以内）"
}`;

  try {
    const raw = await callGeminiWithRetry(prompt, {
      model: 'gemini-3.5-flash-lite',
      temperature: 0.6,
      maxOutputTokens: 1024,
      maxRetries: 2,
    });

    let cleaned = (raw || '').trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
    }
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) {
      const parsed = JSON.parse(cleaned.slice(s, e + 1));
      return {
        ...baseReport,
        ...parsed,
        keyStats: baseReport.keyStats,
        analyzedMatchesCount: matches.length,
        createdAt: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('[customCoach] Gemini call failed, fallback to rule-based report:', err);
  }

  // 万一のGeminiエラー時はルールベースカルテを返す（完全非破壊）
  return baseReport;
}

/**
 * 診断結果をキャッシュ保存（edge_tasks を安全なストレージとして利用）
 */
export async function saveCoachReportToStorage(playerName: string, report: CustomCoachReport) {
  if (!supabase) return;
  try {
    // 既存の同一プレイヤーのカルテがあれば上書き、なければ新規作成
    const taskPayload = {
      playerName,
      report,
      updatedAt: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('edge_tasks')
      .select('id')
      .eq('task_type', 'ktm_custom_coach_report')
      .contains('payload', { playerName })
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('edge_tasks')
        .update({ payload: taskPayload })
        .eq('id', existing[0].id);
    } else {
      await supabase
        .from('edge_tasks')
        .insert({
          task_type: 'ktm_custom_coach_report',
          payload: taskPayload,
        });
    }
  } catch (err) {
    console.warn('[customCoach] Failed to save report to edge_tasks:', err);
  }
}

/**
 * 保存された最新カルテを取得
 */
export async function getSavedCoachReport(playerName: string): Promise<CustomCoachReport | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('edge_tasks')
      .select('payload')
      .eq('task_type', 'ktm_custom_coach_report')
      .contains('payload', { playerName })
      .order('id', { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0].payload?.report) {
      return data[0].payload.report as CustomCoachReport;
    }
  } catch {
    // 取得失敗時はnull
  }
  return null;
}
