// V4 Phase 1-2: Edge Function for Match Importer
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RIOT_API_KEY = Deno.env.get("RIOT_API_KEY") || "";
const RIOT_IDS = (Deno.env.get("RIOT_IDS") || "Kazurin#4036").split(",");
const PROJECT_URL = Deno.env.get("PROJECT_URL") || "";
const PROJECT_SERVICE_KEY = Deno.env.get("PROJECT_SERVICE_KEY") || "";
const REGION = "asia";
const PLATFORM = "jp1";

const supabase = createClient(PROJECT_URL, PROJECT_SERVICE_KEY);

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function riotGet(url: string, maxRetries = 3): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { headers: { "X-Riot-Token": RIOT_API_KEY } });
    if (res.status === 200) {
      return await res.json();
    } else if (res.status === 429) {
      const waitTime = parseInt(res.headers.get("Retry-After") || "2", 10) * 1000;
      console.warn(`[MatchImporter] 429 Rate Limit. Waiting ${waitTime}ms...`);
      await delay(waitTime);
    } else {
      console.warn(`[MatchImporter] API Error ${res.status} for ${url}`);
      return null;
    }
  }
  return null;
}

async function getPuuid(name: string, tag: string): Promise<string | null> {
  const url = `https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${name}/${tag}`;
  const data = await riotGet(url);
  return data ? data.puuid : null;
}

async function getRecentMatches(puuid: string, count = 10): Promise<string[]> {
  const url = `https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?type=ranked&count=${count}`;
  return (await riotGet(url)) || [];
}

async function getMatchDetail(matchId: string): Promise<any> {
  const url = `https://${REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
  return await riotGet(url);
}

function extractJgMatchup(matchData: any, puuid: string): any | null {
  const info = matchData.info || {};
  const participants = info.participants || [];

  const me = participants.find((p: any) => p.puuid === puuid);
  if (!me) return null;

  const myTeam = me.teamId;
  const myRole = (me.teamPosition || "").toUpperCase();

  const enemy = participants.find(
    (p: any) => p.teamId !== myTeam && (p.teamPosition || "").toUpperCase() === myRole
  );
  if (!enemy) return null;

  const durationMin = Math.floor((info.gameDuration || 0) / 60);
  const result = me.win ? "Win" : "Lose";

  return {
    match_id: (matchData.metadata || {}).matchId || "",
    champion: me.championName || "Unknown",
    enemy: enemy.championName || "Unknown",
    role: myRole || "JUNGLE",
    result,
    my_kda: `${me.kills || 0}/${me.deaths || 0}/${me.assists || 0}`,
    enemy_kda: `${enemy.kills || 0}/${enemy.deaths || 0}/${enemy.assists || 0}`,
    duration: `${durationMin}分`,
    my_cs: (me.totalMinionsKilled || 0) + (me.neutralMinionsKilled || 0),
    my_gold: me.goldEarned || 0,
    enemy_gold: enemy.goldEarned || 0,
    my_damage: me.totalDamageDealtToChampions || 0,
    my_vision: me.visionScore || 0,
    game_date: new Date((info.gameCreation || 0)).toISOString(),
    challenges: me.challenges || {},
  };
}

serve(async (req) => {
  try {
    console.log("[MatchImporter] Edge function triggered.");
    if (!RIOT_API_KEY || !PROJECT_URL) {
      throw new Error("Missing essential environment variables.");
    }

    let totalImported = 0;

    for (const riotId of RIOT_IDS) {
      const [name, tag] = riotId.split("#");
      if (!name || !tag) continue;

      console.log(`[MatchImporter] Fetching for ${riotId}...`);
      const puuid = await getPuuid(name, tag);
      if (!puuid) continue;

      const matchIds = await getRecentMatches(puuid, 5); // Timeout防止のため5件に絞る

      for (const mid of matchIds) {
        // すでにDBにあるかチェック
        const { data: existingData } = await supabase
          .from("matchup_sentinel")
          .select("matchup_id")
          .eq("matchup_id", `riot_${mid}`)
          .single();

        if (existingData) {
          continue; // すでに処理済み
        }

        const detail = await getMatchDetail(mid);
        if (!detail) continue;

        const matchup = extractJgMatchup(detail, puuid);
        if (!matchup) continue;

        const insertData = {
          matchup_id: `riot_${matchup.match_id}`,
          champion: matchup.champion,
          enemy: matchup.enemy,
          title: `${matchup.champion} vs ${matchup.enemy} (${matchup.role})`,
          strategy: "",
          raw_data: {
            source: "riot_api",
            result: matchup.result,
            role: matchup.role,
            difficulty: 0,
            winCondition: "",
            earlyGame: "",
            firstClear: "",
            counterJg: "",
            powerSpikes: "",
            buildRunes: "",
            my_kda: matchup.my_kda,
            enemy_kda: matchup.enemy_kda,
            duration: matchup.duration,
            my_cs: matchup.my_cs,
            my_gold: matchup.my_gold,
            enemy_gold: matchup.enemy_gold,
            my_damage: matchup.my_damage,
            my_vision: matchup.my_vision,
            game_date: matchup.game_date,
            challenges: matchup.challenges,
            riot_id: riotId,
          },
        };

        const { error } = await supabase.from("matchup_sentinel").upsert(insertData);
        if (!error) {
          totalImported++;
          console.log(`[MatchImporter] Inserted ${matchup.champion} vs ${matchup.enemy}`);
        } else {
          console.error(`[MatchImporter] Supabase Upsert Error: ${error.message}`);
        }
      }
    }

    return new Response(JSON.stringify({ status: "Success", imported: totalImported }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[MatchImporter] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
