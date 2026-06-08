/**
 * Riot API クライアント
 * Match-V5などからKTM用のカスタムゲームスタッツを取得する
 */

const RIOT_API_BASE_ASIA = "https://asia.api.riotgames.com";

interface ParticipantStats {
  riotIdName: string;
  riotIdTagline: string;
  championName: string;
  teamId: number; // 100=Blue, 200=Red
  kills: number;
  deaths: number;
  assists: number;
  visionScore: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  damageDealtToChampions: number;
  totalDamageTaken: number;
  damageDealtToObjectives: number;
  totalHeal: number;
  damageSelfMitigated: number;
  win: boolean;
  lane: string; // TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
}

interface MatchResult {
  matchId: string;
  gameDuration: number; // seconds
  participants: ParticipantStats[];
}

export async function fetchPuuidByRiotId(gameName: string, tagLine: string, apiKey: string): Promise<string> {
  const url = `${RIOT_API_BASE_ASIA}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Riot IDの検索に失敗しました (${gameName}#${tagLine}): ${res.statusText}`);
  }
  const data = await res.json();
  return data.puuid;
}

export async function fetchRecentCustomMatchId(puuid: string, apiKey: string): Promise<string> {
  // 直近20試合から検索 (type=custom は Riot APIでエラーになるため指定しない)
  const url = `${RIOT_API_BASE_ASIA}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20&api_key=${apiKey}`;
  const res = await fetch(url);
  
  if (!res.ok) {
    throw new Error(`Riot API: 試合履歴の取得に失敗しました。(${res.statusText})`);
  }

  let data = await res.json();

  if (data.length === 0) {
    throw new Error("Riot API: 試合履歴がありません。");
  }
  
  return data[0]; // 最新の試合ID
}

export async function fetchMatchDetails(matchId: string, apiKey: string): Promise<MatchResult> {
  const url = `${RIOT_API_BASE_ASIA}/lol/match/v5/matches/${matchId}?api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`試合詳細の取得に失敗しました (${matchId}): ${res.statusText}`);
  }
  const data = await res.json();
  
  const gameDuration = data.info.gameDuration;
  
  const participants: ParticipantStats[] = data.info.participants.map((p: any) => ({
    riotIdName: p.riotIdGameName || p.summonerName,
    riotIdTagline: p.riotIdTagline || '',
    championName: p.championName,
    teamId: p.teamId,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    visionScore: p.visionScore || 0,
    totalMinionsKilled: p.totalMinionsKilled || 0,
    neutralMinionsKilled: p.neutralMinionsKilled || 0,
    damageDealtToChampions: p.totalDamageDealtToChampions || 0,
    totalDamageTaken: p.totalDamageTaken || 0,
    damageDealtToObjectives: p.damageDealtToObjectives || 0,
    totalHeal: (p.totalHeal || 0) + (p.totalDamageShieldedOnTeammates || 0),
    damageSelfMitigated: p.damageSelfMitigated || 0,
    win: p.win,
    lane: p.teamPosition || p.lane // TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
  }));

  return {
    matchId,
    gameDuration,
    participants
  };
}


// ==========================================
// 追加: League-V4 (Rank Sync)
// ※ Summoner ID への変換が必要
// ==========================================
const RIOT_API_BASE_JP = "https://jp1.api.riotgames.com";

export async function fetchSummonerByPuuid(puuid: string, apiKey: string): Promise<any> {
  const url = `${RIOT_API_BASE_JP}/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Summoner fetch error: ${res.statusText}`);
  return await res.json();
}

export async function fetchLeagueBySummonerId(summonerId: string, apiKey: string): Promise<any[]> {
  const url = `${RIOT_API_BASE_JP}/lol/league/v4/entries/by-summoner/${summonerId}?api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`League fetch error: ${res.statusText}`);
  return await res.json();
}

/**
 * PUUIDからチャンピオンマスタリー(熟練度)の上位3件を取得します
 */
export async function fetchChampionMasteryByPuuid(puuid: string, apiKey: string, count: number = 3): Promise<any[]> {
  const url = `${RIOT_API_BASE_JP}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return []; // マスタリーがないプレイヤー
    throw new Error(`Mastery fetch error: ${res.statusText}`);
  }
  return await res.json();
}

