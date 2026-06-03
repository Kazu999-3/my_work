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
  // queue=0 (Custom games) または未指定で最新を取得
  const url = `${RIOT_API_BASE_ASIA}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=5&type=custom&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    // カスタムで引っかからない場合は全試合から最新を引く
    const fallbackUrl = `${RIOT_API_BASE_ASIA}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=1&api_key=${apiKey}`;
    const fallbackRes = await fetch(fallbackUrl);
    if (!fallbackRes.ok) throw new Error("試合履歴の取得に失敗しました。");
    const fbData = await fallbackRes.json();
    if (fbData.length === 0) throw new Error("試合履歴がありません。");
    return fbData[0];
  }
  const data = await res.json();
  if (data.length === 0) throw new Error("最近のカスタムゲームが見つかりません。");
  return data[0]; // 最新のカスタムゲーム
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
// 追加: Spectator-V5 (Live Status)
// ==========================================
export async function fetchLiveGameByPuuid(puuid: string, apiKey: string): Promise<any> {
  const url = `${RIOT_API_BASE_ASIA}/lol/spectator/v5/active-games/by-puuid/${puuid}?api_key=${apiKey}`;
  const res = await fetch(url);
  if (res.status === 404) return null; // 試合中ではない
  if (!res.ok) throw new Error(`Live game status error: ${res.statusText}`);
  return await res.json();
}

// ==========================================
// 追加: League-V4 (Rank Sync)
// ※ Summoner ID への変換が必要
// ==========================================
export async function fetchSummonerByPuuid(puuid: string, apiKey: string): Promise<any> {
  const url = `${RIOT_API_BASE_ASIA}/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Summoner fetch error: ${res.statusText}`);
  return await res.json();
}

export async function fetchLeagueBySummonerId(summonerId: string, apiKey: string): Promise<any[]> {
  const url = `${RIOT_API_BASE_ASIA}/lol/league/v4/entries/by-summoner/${summonerId}?api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`League fetch error: ${res.statusText}`);
  return await res.json();
}

