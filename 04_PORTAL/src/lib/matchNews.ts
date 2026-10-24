import { callGeminiWithRetry } from './geminiClient';

// 試合記録時のAIハイライト記事（Discordの試合結果「KTMスポーツ号外」欄で使う）。
// 2026-10-16: ポータルの速報ティッカー撤去に伴い /api/match/news を削除し、生成関数だけここへ移した。

export interface MatchNewsArticle {
  headline: string;
  subheadline: string;
  lead: string;
  mvp: {
    name: string;
    champion?: string;
    kda: string;
    role: string;
    comment: string;
  };
  fighterOfTheMatch?: {
    name: string;
    champion?: string;
    kda: string;
    role: string;
    comment: string;
  };
  entertainer?: {
    name: string;
    champion?: string;
    kda: string;
    role: string;
    comment: string;
  };
  turningPoint: string;
  keyMatchup: string;
  sideStory: string;
}

/**
 * 試合データからスポーツ新聞風の面白いハイライトニュースをGeminiで生成
 */
export async function generateMatchNews(matchData: {
  matchId: string | number;
  winningTeam: 'BLUE' | 'RED';
  gameDuration?: number;
  participants: Array<{
    name: string;
    team: 'BLUE' | 'RED';
    role: string;
    champion_name?: string;
    kills: number;
    deaths: number;
    assists: number;
    penta_kills?: number;
    mmrDelta?: number;
    playerMmr?: number;
    damage_dealt?: number;
    damage_taken?: number;
    vision?: number;
    cs?: number;
    gold?: number;
  }>;
}, options: { maxRetries?: number } = {}): Promise<MatchNewsArticle> {
  const { winningTeam, gameDuration, participants } = matchData;

  const winnerParts = participants.filter((p) => p.team === winningTeam);
  const loserParts = participants.filter((p) => p.team !== winningTeam);

  // チーム総キル数・総ダメージ
  const winnerTotalKills = winnerParts.reduce((s, p) => s + (p.kills || 0), 0);
  const loserTotalKills = loserParts.reduce((s, p) => s + (p.kills || 0), 0);
  const winnerTotalDmg = winnerParts.reduce((s, p) => s + (Number(p.damage_dealt) || 0), 0);
  const loserTotalDmg = loserParts.reduce((s, p) => s + (Number(p.damage_dealt) || 0), 0);

  // ロールごとの対面特定マップ
  const opponentMap = new Map<string, typeof participants[0]>();
  for (const p of participants) {
    const opp = participants.find((o) => o.team !== p.team && o.role === p.role);
    if (opp) opponentMap.set(p.name, opp);
  }

  // 👑 MVP候補（最高KDA、キル関与率、ダメージシェア、対面ジャイアントキリング、サポート視界・鉄壁貢献）
  const scorePlayer = (p: typeof participants[0], totalKills: number, totalDmg: number) => {
    const effectiveDeaths = Math.max(1, p.deaths);
    // サポートはアシストの重みを1.2倍
    const effectiveKpScore = p.role === 'SUP' ? (p.kills + p.assists * 1.2) : (p.kills + p.assists);
    const kda = effectiveKpScore / effectiveDeaths;
    const kp = totalKills > 0 ? (p.kills + p.assists) / totalKills : 0;
    const penta = (p.penta_kills || 0) * 15;

    // ダメージシェアボーナス（総ダメージの25%以上を叩き出したキャリーに加点）
    const dmgShare = totalDmg > 0 ? (Number(p.damage_dealt) || 0) / totalDmg : 0;
    const dmgBonus = dmgShare >= 0.25 ? (dmgShare * 20) : 0;

    // タンク/ファイターの被ダメージ貢献ボーナス
    const taken = Number(p.damage_taken) || 0;
    const tankBonus = (p.role === 'TOP' || p.role === 'JG') && taken >= 20000 ? Math.min(8, taken / 4000) : 0;

    // サポートの視界スコア・守護神ボーナス
    const vision = Number(p.vision) || 0;
    const visionBonus = (p.role === 'SUP' && vision >= 30) ? Math.min(8, vision / 5) : 0;
    const supportBonus = (p.role === 'SUP' && p.assists >= 10 && p.deaths <= 3) ? 6 : 0;

    // 対面とのMMR格差ボーナス（ジャイアントキリング評価）
    const opp = opponentMap.get(p.name);
    let giantKillingBonus = 0;
    if (opp && opp.playerMmr && p.playerMmr) {
      const mmrDiff = opp.playerMmr - p.playerMmr;
      if (mmrDiff >= 50 && kda >= 2.0) {
        giantKillingBonus = Math.min(15, (mmrDiff / 50) * 3);
      }
    }

    return kda * 2.0 + kp * 5.0 + penta + dmgBonus + tankBonus + visionBonus + supportBonus + giantKillingBonus;
  };

  const sortedWinners = [...winnerParts].sort((a, b) => scorePlayer(b, winnerTotalKills, winnerTotalDmg) - scorePlayer(a, winnerTotalKills, winnerTotalDmg));
  const bestWinner = sortedWinners[0] || winnerParts[0];

  // 🛡️ 敗戦側の敢闘賞（Fighter of the Match: 敗軍の中で最も高いKDA・ダメージシェア・キル関与）
  const sortedLosers = [...loserParts].sort((a, b) => scorePlayer(b, loserTotalKills, loserTotalDmg) - scorePlayer(a, loserTotalKills, loserTotalDmg));
  const bestLoser = sortedLosers[0] || loserParts[0];

  // 🎭 芸人枠候補（チームを最も揺らした人）
  // 単なる最多デスではなく、「運ばれ芸人」「特攻ロマン砲」「格上大乱調」「ダメージシェアとデスのギャップ」を総合評価
  const entertainerCandidates = participants.filter((p) => p.name !== bestWinner?.name);
  const scoreEntertainer = (p: typeof participants[0]) => {
    const deaths = Number(p.deaths) || 0;
    const kills = Number(p.kills) || 0;
    const assists = Number(p.assists) || 0;
    const dmg = Number(p.damage_dealt) || 0;
    const teamTotalDmg = p.team === winningTeam ? winnerTotalDmg : loserTotalDmg;
    const dmgShare = teamTotalDmg > 0 ? dmg / teamTotalDmg : 0;
    const opp = opponentMap.get(p.name);

    // ① デス数基礎点
    const deathBase = deaths * 10;
    // ② 逆KDA（キルアシストに対してデスがどれだけ先行しているか）
    const kdaInv = (deaths / Math.max(1, kills + assists)) * 8;

    // ③ 運ばれ芸人ボーナス（勝利陣営なのにデス連発、またはダメージシェアが極端に低いのに勝利）
    const isWinner = p.team === winningTeam;
    let carryMeBonus = 0;
    if (isWinner && deaths >= 5) {
      carryMeBonus += deaths * 8 + 20;
    }
    if (isWinner && teamTotalDmg > 0 && dmgShare < 0.12 && deaths >= 3) {
      carryMeBonus += 25; // チーム総ダメの12%未満でデス先行＝完全な愛され運ばれ枠
    }

    // ④ 特攻ロマン砲ボーナス（ダメージ量はチームトップクラスなのにデスも異次元の突撃狂）
    const recklessAssaultBonus = (dmgShare >= 0.22 && deaths >= 7) ? 35 : (kills >= 3 && deaths >= 7 ? 20 : 0);

    // ⑤ 大物の大乱調ドラマ（高MMRなのに格下相手に崩壊、または慣れないロールで迷走）
    let upsetBonus = 0;
    if (opp && opp.playerMmr && p.playerMmr) {
      const mmrDiff = p.playerMmr - opp.playerMmr;
      if (mmrDiff >= 60 && deaths > kills) {
        upsetBonus = Math.min(25, (mmrDiff / 40) * 5);
      }
    }

    return deathBase + kdaInv + carryMeBonus + recklessAssaultBonus + upsetBonus;
  };
  const sortedEntertainers = [...entertainerCandidates].sort((a, b) => scoreEntertainer(b) - scoreEntertainer(a));
  const bestEntertainer = sortedEntertainers[0] || entertainerCandidates[0];

  // 各レーンの対面比較サマリー（KDA・ダメージ・MMRレート差）
  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  const matchupSummary = roles.map((role) => {
    const w = winnerParts.find((p) => p.role === role);
    const l = loserParts.find((p) => p.role === role);
    if (!w || !l) return null;
    const wMmr = w.playerMmr ? ` [MMR ${w.playerMmr}]` : '';
    const lMmr = l.playerMmr ? ` [MMR ${l.playerMmr}]` : '';
    const diff = (w.playerMmr && l.playerMmr) ? (w.playerMmr - l.playerMmr) : 0;
    const diffText = diff !== 0 ? ` (レート差: ${diff > 0 ? `勝側+${diff}` : `負側+${Math.abs(diff)}`})` : '';
    const wDmg = Number(w.damage_dealt) > 0 ? ` ダメ:${(w.damage_dealt! / 1000).toFixed(1)}k` : '';
    const lDmg = Number(l.damage_dealt) > 0 ? ` ダメ:${(l.damage_dealt! / 1000).toFixed(1)}k` : '';
    return `・${role}: 【勝】${w.name}${wMmr} (${w.champion_name || '未定'} / ${w.kills}/${w.deaths}/${w.assists}${wDmg}) vs 【負】${l.name}${lMmr} (${l.champion_name || '未定'} / ${l.kills}/${l.deaths}/${l.assists}${lDmg})${diffText}`;
  }).filter(Boolean).join('\n');

  const participantSummary = participants
    .map((p) => {
      const delta = p.mmrDelta ? (p.mmrDelta > 0 ? `+${p.mmrDelta}` : `${p.mmrDelta}`) : '±0';
      const mmrText = p.playerMmr ? ` [MMR:${p.playerMmr}]` : '';
      const extraStats = p.penta_kills ? ` [🔥ペンタキル:${p.penta_kills}回]` : '';
      const richDetails: string[] = [];
      if (Number(p.damage_dealt) > 0) richDetails.push(`与ダメ:${(p.damage_dealt! / 1000).toFixed(1)}k`);
      if (Number(p.damage_taken) > 0) richDetails.push(`被ダメ:${(p.damage_taken! / 1000).toFixed(1)}k`);
      if (Number(p.vision) > 0) richDetails.push(`視界:${p.vision}`);
      if (Number(p.cs) > 0) richDetails.push(`CS:${p.cs}`);
      const richText = richDetails.length > 0 ? ` [${richDetails.join(', ')}]` : '';
      return `- [${p.team}] [${p.role}] ${p.name}${mmrText} (${p.champion_name || '未定'}) KDA: ${p.kills}/${p.deaths}/${p.assists}${richText}${extraStats} (MMR変動: ${delta})`;
    })
    .join('\n');

  const durationText = gameDuration && gameDuration > 0 ? `・試合時間: 約${Math.round(gameDuration / 60)}分` : '';
  const dmgSummaryText = winnerTotalDmg > 0 || loserTotalDmg > 0
    ? `・総ダメージ量: ${winningTeam} TEAM ${(winnerTotalDmg / 1000).toFixed(1)}k vs 相手側 ${(loserTotalDmg / 1000).toFixed(1)}k`
    : '';

  const prompt = `あなたは「月刊KTMスポーツ」の戦術デスク兼eスポーツ実況解説者です。
以下のLoLカスタム（KTM公式マッチ）の【実数値スコアボード】に基づき、プロ解説者（LJL実況）の視点を取り入れた、熱狂的で解像度の高いスポーツ新聞風ダイジェスト号外を作成してください。

【厳格な執筆ルール（捏造厳禁・ファクト至上主義）】
1. **架空のセリフ（捏造インタビュー）は絶対に禁止**です。「〇〇と叫んだ」「〜とコメント」等の本人が言っていない発言は作らないでください。
2. **提供されたスコアデータ（KDA、チャンプ名、ロール、勝敗、ペンタキル、MMR増減、対面MMR格差、与ダメ、被ダメ、視界スコア）にない出来事（神Ult、バロン強奪等）を勝手に創作しないでください**。
3. 称賛・分析はすべて【実数値、ダメージ量、視界貢献、MMRレート差の根拠】に基づいて行ってください。
4. **【最重要】試合時間に関する捏造禁止**: 試合情報の欄に「試合時間: 約〇分」が明記されていない場合は、見出しや本文、寸評に「25分」「25分決着」「スピード決着」など試合時間に関する単語・数字を一切出さないでください。
5. 勝者側MVPだけでなく、敗戦側で最も輝いていた奮闘選手（敢闘賞）の健闘も称えてください。
6. すべて日本語、以下のJSONオブジェクト【のみ】を出力してください（Markdownコードブロックや前置きは厳禁）。

【試合情報】
・勝利陣営: ${winningTeam} TEAM（総キル: ${winnerTotalKills} vs ${loserTotalKills}）
${durationText}
${dmgSummaryText}

【対面マッチアップ比較（実力レート差・ダメージ差含む）】
${matchupSummary}

【全参加者スタッツ（与ダメ・被ダメ・視界・CS含む）】
${participantSummary}

【各項目の執筆ガイドライン】
- headline: 実数値に基づくキャッチーな1面大見出し（35文字以内、例: 【KTM速報】〇〇の〇〇が驚異の〇キル！〇〇TEAMが快勝）
- subheadline: 勝負の分かれ目となったレーンや数値を要約した小見出し（30文字以内）
- lead: スコアボードの実数値（KDAやキル数、ダメージ量、ロール対決の差）を交え、試合の流れと勝者を的確に解説するリード文（100〜140文字程度）
- mvp.comment: キル数だけでなく、チームダメージシェア、格上を制したジャイアントキリング、サポートの視界・鉄壁での盤石な貢献など、スタッツの文脈を踏まえて熱狂的に称える寸評（60文字以内）
- fighterOfTheMatch.comment: 敗戦側で孤軍奮闘した選手（高ダメージやキル関与）を称える敢闘寸評（60文字以内）
- entertainer.comment:
  - 勝利チームなのにデスが先行した選手なら「仲間への全力感謝＆激闘の運ばれ大賞」
  - ダメージは出しているのにデスも爆発した選手なら「前に出続けたロマン特攻ファイター」
  - 格下に挑まれて散った選手や格上相手に玉砕した選手なら「果敢な挑戦と熱戦の爪痕」
  として、本人がクスッと笑えて自慢・ネタにしたくなる愛あるユーモア寸評（60文字以内）
- turningPoint: 単にキル数が多い対面を読み上げるだけでなく、レーン対面のMMR格差（格上が順当にゲームを支配したか、あるいは格下が番狂わせを起こしたか）、集団戦の総ダメージ差などの本質的な構造から勝敗の決定打を解説（80文字以内）
- keyMatchup: 最も激戦となった対面レーンのスタッツ比較とレート格差・ダメージ差を踏まえた寸評（70文字以内）
- sideStory: MMR変動（大幅UPや悔しい降格）やサポートの視界・タンクの被ダメ等の隠れた貢献（60文字以内）

{
  "headline": "実数値に基づくキャッチーな1面大見出し（35文字以内）",
  "subheadline": "勝負の分かれ目となったレーンや数値を要約した小見出し（30文字以内）",
  "lead": "スコアボードの実数値（KDAやキル数、ダメージ量、ロール対決の差）を交え、試合の流れと勝者を的確に解説するリード文（100〜140文字程度）",
  "mvp": {
    "name": "${bestWinner?.name || '注目選手'}",
    "champion": "${bestWinner?.champion_name || 'メインチャンプ'}",
    "kda": "${bestWinner?.kills || 0}/${bestWinner?.deaths || 0}/${bestWinner?.assists || 0}",
    "role": "${bestWinner?.role || 'MID'}",
    "comment": "スタッツ（KDA・ダメージ・視界等）とMMR格差に基づくMVP選出寸評（60文字以内）"
  },
  "fighterOfTheMatch": {
    "name": "${bestLoser?.name || '奮闘選手'}",
    "champion": "${bestLoser?.champion_name || 'チャンプ'}",
    "kda": "${bestLoser?.kills || 0}/${bestLoser?.deaths || 0}/${bestLoser?.assists || 0}",
    "role": "${bestLoser?.role || 'TOP'}",
    "comment": "敗戦側で孤軍奮闘した選手を称える敢闘寸評（60文字以内）"
  },
  "entertainer": {
    "name": "${bestEntertainer?.name || '芸人枠'}",
    "champion": "${bestEntertainer?.champion_name || 'チャンプ'}",
    "kda": "${bestEntertainer?.kills || 0}/${bestEntertainer?.deaths || 0}/${bestEntertainer?.assists || 0}",
    "role": "${bestEntertainer?.role || 'TOP'}",
    "comment": "運ばれ感謝・ロマン特攻・熱戦の爪痕など、愛あるユーモア寸評（60文字以内）"
  },
  "turningPoint": "MMR格差やダメージ・キルシェアから読み取れる試合の決定打（80文字以内）",
  "keyMatchup": "最も激戦となった対面レーンのスタッツ比較と寸評（70文字以内）",
  "sideStory": "MMR変動（大幅UPや悔しい降格）やサポートの視界・タンクの被ダメ等の隠れた貢献（60文字以内）"
}`;

  const raw = await callGeminiWithRetry(prompt, {
    model: 'gemini-3.5-flash-lite',
    temperature: 0.7,
    maxOutputTokens: 1024,
    // 記録時は応答を待たせないよう2回まで。失敗時の後追い生成（match/record の after）は多めに試す
    maxRetries: options.maxRetries ?? 2,
  });

  let cleaned = (raw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
  }
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s < 0 || e <= s) {
    throw new Error('AIニュースの生成に失敗しました。');
  }

  return JSON.parse(cleaned.slice(s, e + 1));
}

/** 試合結果 Embed に載せる「📰 KTMスポーツ号外」フィールドを組み立てる（記録時と後追いで共通） */
export function buildMatchNewsField(article: MatchNewsArticle) {
  const lines: string[] = [];
  lines.push(`**${article.subheadline}**`);
  lines.push(article.lead);
  lines.push(`\n👑 **本日のMVP**: **${article.mvp?.name}** (${article.mvp?.champion || ''} / ${article.mvp?.role} / KDA: ${article.mvp?.kda})\n📝 **寸評**: ${article.mvp?.comment || ''}`);
  if (article.fighterOfTheMatch) {
    lines.push(`🛡️ **敢闘賞(敗軍の将)**: **${article.fighterOfTheMatch.name}** (${article.fighterOfTheMatch.champion || ''} / ${article.fighterOfTheMatch.role} / KDA: ${article.fighterOfTheMatch.kda})\n📝 **寸評**: ${article.fighterOfTheMatch.comment}`);
  }
  if (article.entertainer) {
    lines.push(`🎭 **本日の芸人枠（チーム揺らした大賞）**: **${article.entertainer.name}** (${article.entertainer.champion || ''} / ${article.entertainer.role} / KDA: ${article.entertainer.kda})\n📝 **寸評**: ${article.entertainer.comment}`);
  }
  if (article.turningPoint) {
    lines.push(`🎯 **勝負の決め手**: ${article.turningPoint}`);
  }
  return {
    name: `📰 【KTMスポーツ号外】${article.headline}`.slice(0, 256),
    value: lines.join('\n').slice(0, 1024),
    inline: false,
  };
}
