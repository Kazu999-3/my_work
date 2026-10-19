/**
 * 知識の実戦検証スコア エンジン (Tactic Verifier)
 * 
 * 攻略記事や動画バイブルで語られる「チャンピオンごとの定石・NG行動」が、
 * 実際の試合ログ（Match Details & Match Timeline）で守れていたかを機械照合し、
 * 遵守スコア（Compliance Score）と勝敗との相関を言語化する。
 */

export interface TacticRuleCheck {
  id: string;
  category: 'VISION' | 'EARLY_SAFETY' | 'OBJECTIVE' | 'FARMING' | 'DEATH_SPIKE';
  title: string;
  description: string;
  complied: boolean;
  scoreImpact: number; // 0 to 100
  evidence: string;
}

export interface TacticVerificationReport {
  championName: string;
  win: boolean;
  totalScore: number; // 0 to 100
  rating: 'PERFECT' | 'GOOD' | 'NEEDS_WORK' | 'POOR';
  rules: TacticRuleCheck[];
  summaryMessage: string;
}

/**
 * タイムラインから特定プレイヤーのイベントを走査し、戦術ルールの遵守判定を行う
 */
export function verifyMatchTactics(
  matchDetails: any,
  timelineData: any,
  puuid: string
): TacticVerificationReport | null {
  if (!matchDetails || !matchDetails.info || !timelineData || !timelineData.info) {
    return null;
  }

  const participant = matchDetails.info.participants?.find((p: any) => p.puuid === puuid);
  if (!participant) return null;

  const participantId = participant.participantId;
  const championName = participant.championName || 'Unknown';
  const win = Boolean(participant.win);
  const frames = timelineData.info.frames || [];
  const durationMin = Math.max(1, (matchDetails.info.gameDuration || 0) / 60);

  const rules: TacticRuleCheck[] = [];

  // ============================================================
  // ルール1: 【序盤安全性】Lv6未満（〜6分）の不用意な孤立デスを回避したか
  // ============================================================
  let earlyDeaths = 0;
  for (let i = 0; i < Math.min(frames.length, 7); i++) {
    const events = frames[i].events || [];
    for (const ev of events) {
      if (ev.type === 'CHAMPION_KILL' && ev.victimId === participantId) {
        earlyDeaths++;
      }
    }
  }

  const earlySafetyComplied = earlyDeaths === 0;
  rules.push({
    id: 'early_safety',
    category: 'EARLY_SAFETY',
    title: 'Lv6前のセーフティプレイ（不用意な被キル回避）',
    description: 'バイブルの鉄則：序盤のデスはパワースパイク到達を著しく遅らせるため回避必須',
    complied: earlySafetyComplied,
    scoreImpact: earlySafetyComplied ? 25 : 0,
    evidence: earlySafetyComplied
      ? '6分以内のデス 0回。安全にレーン戦を立ち上げられました。'
      : `6分以内に ${earlyDeaths} 回デスが発生。序盤の主導権を失う要因となりました。`,
  });

  // ============================================================
  // ルール2: 【視界管理】初手ワード（3分以内）の設置と分間視界スコア
  // ============================================================
  let firstWardPlacedAtMs: number | null = null;
  for (let i = 0; i < Math.min(frames.length, 4); i++) {
    const events = frames[i].events || [];
    for (const ev of events) {
      if (ev.type === 'WARD_PLACED' && ev.creatorId === participantId) {
        if (firstWardPlacedAtMs === null) {
          firstWardPlacedAtMs = ev.timestamp;
        }
      }
    }
  }

  const visionPerMin = (participant.visionScore || 0) / durationMin;
  const visionComplied = firstWardPlacedAtMs !== null && firstWardPlacedAtMs <= 200000 && visionPerMin >= 0.7;
  const firstWardMinSec = firstWardPlacedAtMs
    ? `${Math.floor(firstWardPlacedAtMs / 60000)}:${String(Math.floor((firstWardPlacedAtMs % 60000) / 1000)).padStart(2, '0')}`
    : '未設置';

  rules.push({
    id: 'vision_control',
    category: 'VISION',
    title: '序盤防壁ワード ＆ 視界スコアの維持',
    description: '敵JGの3分前後ガンクを防ぐ初手ワード設置と視界確保',
    complied: visionComplied,
    scoreImpact: visionComplied ? 25 : (firstWardPlacedAtMs !== null ? 15 : 0),
    evidence: `初手ワード設置時刻: ${firstWardMinSec} / 分間視界: ${visionPerMin.toFixed(2)} (基準: 0.7以上)`,
  });

  // ============================================================
  // ルール3: 【ファーム規律】10分時点でのCSペース（分間6.5以上）
  // ============================================================
  let csAt10 = 0;
  if (frames.length > 10) {
    const pFrame10 = frames[10].participantFrames?.[String(participantId)];
    if (pFrame10) {
      csAt10 = (pFrame10.minionsKilled || 0) + (pFrame10.jungleMinionsKilled || 0);
    }
  } else {
    csAt10 = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);
  }

  const isSupport = participant.teamPosition === 'UTILITY' || participant.individualPosition === 'UTILITY';
  const farmComplied = isSupport || csAt10 >= 65;

  rules.push({
    id: 'farming_discipline',
    category: 'FARMING',
    title: isSupport ? 'サポートの視界献身度' : '10分CSペースの維持（基準65CS以上）',
    description: isSupport ? '視界アイテムの完遂とマップコントロール' : '基礎ゴールドを確保しコアアイテムを完成させるためのCS基準',
    complied: farmComplied,
    scoreImpact: farmComplied ? 25 : 10,
    evidence: isSupport
      ? `サポートロール（CS基準免除、視界スコア: ${participant.visionScore || 0}）`
      : `10分時点CS: ${csAt10} (目標: 65以上)`,
  });

  // ============================================================
  // ルール4: 【集団戦・デス連鎖回避】連続デス（ティルトInting）の抑制
  // ============================================================
  const deathTimestamps: number[] = [];
  for (const f of frames) {
    for (const ev of f.events || []) {
      if (ev.type === 'CHAMPION_KILL' && ev.victimId === participantId) {
        deathTimestamps.push(ev.timestamp);
      }
    }
  }

  let rapidSuccessiveDeaths = 0;
  for (let i = 1; i < deathTimestamps.length; i++) {
    // 2分半（150秒）以内に連続デスした場合はティルトIntingと判定
    if (deathTimestamps[i] - deathTimestamps[i - 1] < 150000) {
      rapidSuccessiveDeaths++;
    }
  }

  const noTiltComplied = rapidSuccessiveDeaths === 0;
  rules.push({
    id: 'mental_discipline',
    category: 'DEATH_SPIKE',
    title: 'メンタルコントロール（連続デスの抑制）',
    description: 'リスポーン直後の無理な仕掛けによるデススパイラルを防ぐ',
    complied: noTiltComplied,
    scoreImpact: noTiltComplied ? 25 : (rapidSuccessiveDeaths === 1 ? 10 : 0),
    evidence: noTiltComplied
      ? '短期連続デス 0回。冷静にリセットできています。'
      : `150秒以内の連続デスが ${rapidSuccessiveDeaths} 回発生。リスポーン後の焦りに注意。`,
  });

  // ============================================================
  // 総合スコア計算
  // ============================================================
  const totalScore = rules.reduce((sum, r) => sum + r.scoreImpact, 0);
  let rating: TacticVerificationReport['rating'] = 'POOR';
  if (totalScore >= 90) rating = 'PERFECT';
  else if (totalScore >= 70) rating = 'GOOD';
  else if (totalScore >= 50) rating = 'NEEDS_WORK';

  let summaryMessage = '';
  if (rating === 'PERFECT') {
    summaryMessage = 'バイブルの教えを100%体現した完璧な立ち回りです。勝率を最大化できています。';
  } else if (rating === 'GOOD') {
    summaryMessage = '基本定石の大部分を守れています。あと一歩の改善でさらに勝ちやすくなります。';
  } else if (rating === 'NEEDS_WORK') {
    summaryMessage = '序盤の被デスまたは視界確保に課題があります。教えを意識して修正しましょう。';
  } else {
    summaryMessage = '焦りによる連続デスや序盤の被キルが目立ちます。一度セーフティの基本に立ち返りましょう。';
  }

  return {
    championName,
    win,
    totalScore,
    rating,
    rules,
    summaryMessage,
  };
}
