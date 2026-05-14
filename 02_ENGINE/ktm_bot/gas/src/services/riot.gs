/**
 * 🔗 Riot API 連携サービス
 */

const RIOT_API_BASE = "https://jp1.api.riotgames.com";

function getRiotRank(summonerName, tagline) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('RIOT_API_KEY');
  if (!apiKey) {
    throw new Error("RIOT_API_KEY がスクリプトプロパティに設定されていません。");
  }

  // 1. Account-v1 で PUUID を取得 (Riot ID -> PUUID)
  // 注: Riot ID の検索は 'asia' リージョン等のルーティングが必要
  const accountUrl = `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${encodeURIComponent(tagline)}?api_key=${apiKey}`;
  const accountRes = UrlFetchApp.fetch(accountUrl, { muteHttpExceptions: true });
  if (accountRes.getResponseCode() !== 200) {
    console.error("Account-v1 Error:", accountRes.getContentText());
    return null;
  }
  const puuid = JSON.parse(accountRes.getContentText()).puuid;

  // 2. Summoner-v4 で ID を取得 (PUUID -> Summoner ID)
  const summonerUrl = `${RIOT_API_BASE}/lol/summoner/v4/by-puuid/${puuid}?api_key=${apiKey}`;
  const summonerRes = UrlFetchApp.fetch(summonerUrl, { muteHttpExceptions: true });
  if (summonerRes.getResponseCode() !== 200) {
    console.error("Summoner-v4 Error:", summonerRes.getContentText());
    return null;
  }
  const summonerData = JSON.parse(summonerRes.getContentText());
  const summonerId = summonerData.id;
  const summonerLevel = summonerData.summonerLevel;

  // 3. League-v4 でソロ＋フレックス両方取得
  const leagueUrl = `${RIOT_API_BASE}/lol/league/v4/entries/by-summoner/${summonerId}?api_key=${apiKey}`;
  const leagueRes = UrlFetchApp.fetch(leagueUrl, { muteHttpExceptions: true });
  if (leagueRes.getResponseCode() !== 200) {
    console.error("League-v4 Error:", leagueRes.getContentText());
    return null;
  }

  const entries = JSON.parse(leagueRes.getContentText());
  const soloQueue = entries.find(e => e.queueType === 'RANKED_SOLO_5x5');
  const flexQueue = entries.find(e => e.queueType === 'RANKED_FLEX_SR');

  return {
    puuid,
    summonerLevel,
    solo: soloQueue
      ? { tier: soloQueue.tier, rank: soloQueue.rank, lp: soloQueue.leaguePoints }
      : { tier: 'UNRANKED', rank: '', lp: 0 },
    flex: flexQueue
      ? { tier: flexQueue.tier, rank: flexQueue.rank, lp: flexQueue.leaguePoints }
      : { tier: 'UNRANKED', rank: '', lp: 0 }
  };
}

/**
 * 直近のランク戦からレーン別経験数を推定する
 * @param {string} puuid
 * @param {string} apiKey
 * @param {number} sampleCount サンプルする試合数（デフォルト8）
 * @returns {{ TOP, JG, MID, ADC, SUP }} 各レーンの経験試合数
 */
function getRiotLaneProficiency(puuid, apiKey, sampleCount = 4) {
  const positionMap = { TOP: 'TOP', JUNGLE: 'JG', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP' };
  const counts = { TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0 };
  
  try {
    const idsUrl = `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${sampleCount}&type=ranked&api_key=${apiKey}`;
    
    Utilities.sleep(1300); // 通信前に待機
    let idsRes = UrlFetchApp.fetch(idsUrl, { muteHttpExceptions: true });
    if (idsRes.getResponseCode() === 429) {
      Utilities.sleep(15000); // 制限時はさらに待機
      idsRes = UrlFetchApp.fetch(idsUrl, { muteHttpExceptions: true });
    }
    if (idsRes.getResponseCode() !== 200) return counts;
    
    const matchIds = JSON.parse(idsRes.getContentText());
    if (matchIds.length === 0) return counts;

    for (const matchId of matchIds) {
      const detailUrl = `https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${apiKey}`;
      
      Utilities.sleep(1300); // 1試合ごとに待機
      let res = UrlFetchApp.fetch(detailUrl, { muteHttpExceptions: true });
      
      if (res.getResponseCode() === 429) {
        Utilities.sleep(15000);
        res = UrlFetchApp.fetch(detailUrl, { muteHttpExceptions: true });
      }

      if (res.getResponseCode() === 200) {
        const matchData = JSON.parse(res.getContentText());
        const participant = matchData.info.participants.find(p => p.puuid === puuid);
        if (participant) {
          const role = positionMap[participant.teamPosition];
          if (role) counts[role]++;
        }
      }
    }

  } catch (e) {
    console.error(`getRiotLaneProficiency Error: ${e.message}`);
  }
  
  return counts;
}

/** ランクからMMRへの変換 */
function rankToMmr(riotRank) {
  if (!riotRank || riotRank.tier === 'UNRANKED') return 300;
  const baseMmr = RANKS[riotRank.tier] || 300;
  const rankBonus = { 'I': 300, 'II': 200, 'III': 100, 'IV': 0 }[riotRank.rank] || 0;
  const lpBonus = Math.floor(riotRank.lp / 2);
  return baseMmr + rankBonus + lpBonus;
}

/** ソロ/フレックスの高い方の情報を返す */
function rankToMmrBest(riotData) {
  const soloMmr = rankToMmr(riotData.solo);
  const flexMmr  = rankToMmr(riotData.flex);
  if (flexMmr > soloMmr) {
    return { mmr: flexMmr, ...riotData.flex, source: 'フレックス' };
  }
  return { mmr: soloMmr, ...riotData.solo, source: 'ソロ' };
}

/** PUUID の取得（詳細情報付き） */
function getCachedPuuidInfo(ign) {
  if (!ign || !ign.includes('#')) return { puuid: null, code: 'INVALID_FORMAT' };
  const [name, tag] = ign.split('#');
  const cacheKey = 'PUUID_' + ign;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) return { puuid: cached, code: 200 };
  
  const apiKey = PropertiesService.getScriptProperties().getProperty('RIOT_API_KEY');
  const accountUrl = `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name.trim())}/${encodeURIComponent(tag.trim())}?api_key=${apiKey}`;
  
  Utilities.sleep(1300); // 待機
  let res = UrlFetchApp.fetch(accountUrl, { muteHttpExceptions: true });
  let code = res.getResponseCode();

  if (code === 429) {
    Utilities.sleep(15000);
    res = UrlFetchApp.fetch(accountUrl, { muteHttpExceptions: true });
    code = res.getResponseCode();
  }

  if (code === 200) {
    const puuid = JSON.parse(res.getContentText()).puuid;
    cache.put(cacheKey, puuid, 21600); // 6時間キャッシュ
    return { puuid: puuid, code: 200 };
  }
  return { puuid: null, code: code };
}

/** PUUID の取得（互換用） */
function getCachedPuuid(ign) {
  return getCachedPuuidInfo(ign).puuid;
}

/** ライブステータスの取得 */
function coreGetLiveStatuses(discordIds) {
  const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
  const playerData = playerSheet.getDataRange().getValues();
  const ignColIdx = getColumnByName(playerSheet, "LoL IGN") - 1;
  const discordIdColIdx = 6;
  
  const apiKey = PropertiesService.getScriptProperties().getProperty('RIOT_API_KEY');
  if (!apiKey) throw new Error("API Key missing");

  const results = {};
  
  discordIds.forEach(id => {
    const row = playerData.find(r => String(r[discordIdColIdx]).trim() === String(id).trim());
    if (!row) {
      results[id] = { status: "UNKNOWN", name: "不明", message: "未登録" };
      return;
    }
    const name = row[0];
    const ign = ignColIdx >= 0 ? row[ignColIdx] : null;
    if (!ign) {
      results[id] = { status: "NO_IGN", name: name, message: "IGN未登録" };
      return;
    }
    
    const puuid = getCachedPuuid(ign);
    if (!puuid) {
      results[id] = { status: "ERROR", name: name, message: "ID取得失敗" };
      return;
    }
    
    const cache = CacheService.getScriptCache();
    const cacheKey = 'LIVE_' + puuid;
    const cachedLive = cache.get(cacheKey);
    
    if (cachedLive) {
      const data = JSON.parse(cachedLive);
      data.name = name; // キャッシュから取った後、念のため名前を付与
      results[id] = data;
      return;
    }
    
    const specUrl = `https://jp1.api.riotgames.com/lol/spectator/v5/active-games/by-puuid/${puuid}?api_key=${apiKey}`;
    const res = UrlFetchApp.fetch(specUrl, { muteHttpExceptions: true });
    
    let liveData = { status: "OFFLINE", message: "💤 待機中" };
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      const gameLength = data.gameLength;
      let timeStr = "ロード中";
      if (gameLength > 0) {
        let min = Math.floor(gameLength / 60);
        let sec = gameLength % 60;
        timeStr = `${min}分${sec}秒`;
      }
      liveData = { status: "IN_GAME", message: `🟢 試合中 (${timeStr})` };
      cache.put(cacheKey, JSON.stringify(liveData), 60); // 試合中は1分キャッシュ（時間が進むため）
    } else if (res.getResponseCode() === 404) {
      liveData = { status: "OFFLINE", message: "💤 待機中" };
      cache.put(cacheKey, JSON.stringify(liveData), 120); // 待機中は2分キャッシュ
    } else {
       liveData = { status: "ERROR", message: "取得エラー" };
    }
    
    liveData.name = name;
    results[id] = liveData;
  });
  
  return results;
}

/** OP.GG マルチサーチURLの生成 */
function coreGetOpggUrls(teamBlue, teamRed) {
  const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
  const playerData = playerSheet.getDataRange().getValues();
  const ignColIdx = getColumnByName(playerSheet, "LoL IGN") - 1;
  const discordIdColIdx = 6;
  
  const getIgnStrings = (names) => {
    return names.map(name => {
      const strName = String(name).trim();
      const row = playerData.find(r => String(r[0]).trim() === strName || String(r[discordIdColIdx]).trim() === strName);
      if (row && ignColIdx >= 0 && row[ignColIdx]) {
        return encodeURIComponent(String(row[ignColIdx]).trim());
      }
      return null;
    }).filter(x => x);
  };

  const blueIgns = getIgnStrings(teamBlue);
  const redIgns = getIgnStrings(teamRed);

  return {
    blue: blueIgns.length > 0 ? `https://www.op.gg/multisearch/jp?summoners=${blueIgns.join('%2C')}` : null,
    red: redIgns.length > 0 ? `https://www.op.gg/multisearch/jp?summoners=${redIgns.join('%2C')}` : null
  };
}
