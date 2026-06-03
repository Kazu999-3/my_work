import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { fetchPuuidByRiotId, fetchLiveGameByPuuid } from '@/lib/riot';

export async function POST(req: Request) {
  try {
    const { discordIds } = await req.json();
    if (!discordIds || !Array.isArray(discordIds)) {
      return NextResponse.json({ status: "ERROR", message: "Invalid discordIds" }, { status: 400 });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) throw new Error("RIOT_API_KEY is not set.");

    // 1. DBからIGNを取得
    const { data: players, error } = await supabase
      .from('ktm_players')
      .select('discord_id, name, ign')
      .in('discord_id', discordIds);
    
    if (error) throw new Error(error.message);

    const statuses: Record<string, { name: string, message: string }> = {};

    // 2. 各プレイヤーのステータスを取得
    for (const p of players || []) {
      if (!p.ign || !p.ign.includes('#')) {
        statuses[p.discord_id] = { name: p.name, message: "IGN未登録" };
        continue;
      }
      
      try {
        const [gameName, tagLine] = p.ign.split('#');
        const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);
        const liveGame = await fetchLiveGameByPuuid(puuid, apiKey);

        if (!liveGame) {
          statuses[p.discord_id] = { name: p.name, message: "💤 オフライン (待機中)" };
        } else {
          const mode = liveGame.gameMode || "不明";
          const elapsed = liveGame.gameLength ? Math.floor(liveGame.gameLength / 60) : 0;
          statuses[p.discord_id] = { name: p.name, message: `🔥 試合中 (${mode} - ${elapsed}分経過)` };
        }
      } catch (err: any) {
        console.error(`Live Status Error for ${p.ign}:`, err.message);
        statuses[p.discord_id] = { name: p.name, message: "エラー (取得失敗)" };
      }
    }

    return NextResponse.json({ status: "SUCCESS", statuses });
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
