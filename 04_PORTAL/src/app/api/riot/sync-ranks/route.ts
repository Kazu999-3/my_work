import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchPuuidByRiotId, fetchLeagueByPuuid } from '../../../../lib/riot';
import { higherRank } from '../../../../lib/mmr';

export async function POST(req: Request) {
  try {
    const { discordName } = await req.json();
    if (!discordName) return NextResponse.json({ status: "ERROR", message: "Missing discordName" }, { status: 400 });

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) throw new Error("RIOT_API_KEY is not set.");

    // DBからプレイヤー取得
    const { data: player, error } = await supabase
      .from('ktm_players')
      .select('id, ign, highest_rank')
      .eq('name', discordName)
      .single();

    if (error || !player) throw new Error("Player not found in DB.");
    if (!player.ign || !player.ign.includes('#')) throw new Error("IGNが未登録または不正です。");

    const [gameName, tagLine] = player.ign.split('#');
    
    // PUUID -> League
    // 旧: PUUID -> summoner.id -> League だったが、Riotが2025年6月20日に
    // by-summoner系ランクエンドポイントを廃止し、summoner-v4のby-puuidレスポンスからも
    // `id`フィールドが消えたため、ずっと失敗し続けていた（=highest_rankが同期されない）。
    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);
    const leagues = await fetchLeagueByPuuid(puuid, apiKey);

    // Solo Queue のランクを探す。今季未ランクでも既存の最高ランクを消さない（UNRANKED上書き防止）。
    const soloQ = leagues.find(l => l.queueType === 'RANKED_SOLO_5x5');
    const currentRank = soloQ ? `${soloQ.tier} ${soloQ.rank}` : null;
    // 既存(highest)と現在ランクの高い方を保持する。現在未ランクなら既存をそのまま維持。
    const rankStr = higherRank(player.highest_rank, currentRank);

    // DB更新（変化がある時だけでも良いが、冪等なので常時更新）
    const { error: updateError } = await supabase
      .from('ktm_players')
      .update({ highest_rank: rankStr })
      .eq('id', player.id);

    if (updateError) throw new Error(`DB Update failed: ${updateError.message}`);

    return NextResponse.json({
      status: "SUCCESS",
      message: currentRank
        ? `ランク情報を同期しました（現在: ${currentRank} / 最高: ${rankStr}）`
        : `今季は未ランクのため、最高ランク（${rankStr}）を維持しました。`
    });
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
