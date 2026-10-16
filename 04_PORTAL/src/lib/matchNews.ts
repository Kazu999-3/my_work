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
  }>;
}, options: { maxRetries?: number } = {}): Promise<MatchNewsArticle> {
  const { winningTeam, gameDuration, participants } = matchData;

  const winnerParts = participants.filter((p) => p.team === winningTeam);
  const loserParts = participants.filter((p) => p.team !== winningTeam);

  // チーム総キル数
  const winnerTotalKills = winnerParts.reduce((s, p) => s + (p.kills || 0), 0);
  const loserTotalKills = loserParts.reduce((s, p) => s + (p.kills || 0), 0);

  // MVP候補（最高KDA or キル関与率 or ペンタキル達成）
  const scorePlayer = (p: typeof participants[0], totalKills: number) => {
    const kda = (p.kills + p.assists) / Math.max(1, p.deaths);
    const kp = totalKills > 0 ? (p.kills + p.assists) / totalKills : 0;
    const penta = (p.penta_kills || 0) * 10;
    return kda * 2 + kp * 5 + penta;
  };

  const sortedWinners = [...winnerParts].sort((a, b) => scorePlayer(b, winnerTotalKills) - scorePlayer(a, winnerTotalKills));
  const bestWinner = sortedWinners[0] || winnerParts[0];

  // 敗戦側の敢闘賞（Fighter of the Match: 敗軍の中で最も高いKDAやキル関与）
  const sortedLosers = [...loserParts].sort((a, b) => scorePlayer(b, loserTotalKills) - scorePlayer(a, loserTotalKills));
  const bestLoser = sortedLosers[0] || loserParts[0];

  // 各レーンの対面比較サマリー（KDA・チャンピオン対面）
  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  const matchupSummary = roles.map((role) => {
    const w = winnerParts.find((p) => p.role === role);
    const l = loserParts.find((p) => p.role === role);
    if (!w || !l) return null;
    return `・${role}: 【勝】${w.name} (${w.champion_name || '未定'} / ${w.kills}/${w.deaths}/${w.assists}) vs 【負】${l.name} (${l.champion_name || '未定'} / ${l.kills}/${l.deaths}/${l.assists})`;
  }).filter(Boolean).join('\n');

  const participantSummary = participants
    .map((p) => {
      const delta = p.mmrDelta ? (p.mmrDelta > 0 ? `+${p.mmrDelta}` : `${p.mmrDelta}`) : '±0';
      const extraStats = p.penta_kills ? ` [🔥ペンタキル:${p.penta_kills}回]` : '';
      return `- [${p.team}] [${p.role}] ${p.name} (${p.champion_name || '未定'}) KDA: ${p.kills}/${p.deaths}/${p.assists}${extraStats} (MMR変動: ${delta})`;
    })
    .join('\n');

  const durationText = gameDuration && gameDuration > 0 ? `・試合時間: 約${Math.round(gameDuration / 60)}分` : '';

  const prompt = `あなたは「月刊KTMスポーツ」の戦術デスク兼eスポーツ実況解説者です。
以下のLoLカスタム（KTM公式マッチ）の【実数値スコアボード】に基づき、プロ解説者（LJL実況）の視点を取り入れた、熱狂的で解像度の高いスポーツ新聞風ダイジェスト号外を作成してください。

【厳格な執筆ルール（捏造厳禁・ファクト至上主義）】
1. **架空のセリフ（捏造インタビュー）は絶対に禁止**です。「〇〇と叫んだ」「〜とコメント」等の本人が言っていない発言は作らないでください。
2. **提供されたスコアデータ（KDA、チャンプ名、ロール、勝敗、ペンタキル、MMR増減）にない出来事（神Ult、バロン強奪等）を勝手に創作しないでください**。
3. 称賛・分析はすべて【実数値の根拠】に基づいて行ってください（例: 「デスを〇に抑えたレーン戦の盤石さ」「キル関与率〇%を誇るキャリー」「敗戦側でも孤軍奮闘の〇キル」「怒涛のペンタキル達成」など）。
4. **【最重要】試合時間に関する捏造禁止**: 試合情報の欄に「試合時間: 約〇分」が明記されていない場合は、見出しや本文、寸評に「25分」「25分決着」「スピード決着」など試合時間に関する単語・数字を一切出さないでください。
5. 勝者側MVPだけでなく、敗戦側で最も輝いていた奮闘選手（敢闘賞）の健闘も称えてください。
6. すべて日本語、以下のJSONオブジェクト【のみ】を出力してください（Markdownコードブロックや前置きは厳禁）。

【試合情報】
・勝利陣営: ${winningTeam} TEAM（総キル: ${winnerTotalKills} vs ${loserTotalKills}）
${durationText}

【対面マッチアップ比較】
${matchupSummary}

【全参加者スタッツ】
${participantSummary}

{
  "headline": "実数値に基づくキャッチーな1面大見出し（35文字以内、例: 【KTM速報】〇〇の〇〇が驚異の〇キル！〇〇TEAMが快勝）",
  "subheadline": "勝負の分かれ目となったレーンや数値を要約した小見出し（30文字以内）",
  "lead": "スコアボードの実数値（KDAやキル数、ロール対決の差）を交え、試合の流れと勝者を的確に解説するリード文（100〜140文字程度）",
  "mvp": {
    "name": "${bestWinner?.name || '注目選手'}",
    "champion": "${bestWinner?.champion_name || 'メインチャンプ'}",
    "kda": "${bestWinner?.kills || 0}/${bestWinner?.deaths || 0}/${bestWinner?.assists || 0}",
    "role": "${bestWinner?.role || 'MID'}",
    "comment": "スタッツ（KDAやキル関与率等）に基づくMVP選出寸評（60文字以内）"
  },
  "fighterOfTheMatch": {
    "name": "${bestLoser?.name || '奮闘選手'}",
    "champion": "${bestLoser?.champion_name || 'チャンプ'}",
    "kda": "${bestLoser?.kills || 0}/${bestLoser?.deaths || 0}/${bestLoser?.assists || 0}",
    "role": "${bestLoser?.role || 'TOP'}",
    "comment": "敗戦側で孤軍奮闘した選手を称える敢闘寸評（60文字以内）"
  },
  "turningPoint": "対面マッチアップやダメージ差から読み取れる試合の決定打（80文字以内）",
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
    lines.push(`🛡️ **敢闘賞 (敗軍の将)**: **${article.fighterOfTheMatch.name}** (${article.fighterOfTheMatch.champion || ''} / ${article.fighterOfTheMatch.role} / KDA: ${article.fighterOfTheMatch.kda})\n📝 **寸評**: ${article.fighterOfTheMatch.comment}`);
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
