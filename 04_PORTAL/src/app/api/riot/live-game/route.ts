import { NextRequest, NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchActiveGameByPuuid } from '../../../../lib/riot';
import { getChampNameById } from '../../../../lib/ddragonClient';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RIOT_API_KEY が環境変数に設定されていません。' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const requestedRiotId = searchParams.get('riotId') || searchParams.get('summoner') || '';
    let puuid = searchParams.get('puuid') || '';

    // 1. PUUID の特定
    if (!puuid && requestedRiotId && requestedRiotId.includes('#')) {
      const [name, tag] = requestedRiotId.split('#');
      try {
        puuid = await fetchPuuidByRiotId(name.trim(), tag.trim(), apiKey);
      } catch (e: any) {
        console.warn('[live-game] 指定RiotIdのPUUID解決失敗:', e.message);
      }
    }

    if (!puuid) {
      puuid = process.env.KAZURIN_PUUID || '';
    }

    if (!puuid) {
      const { data: player } = await supabase
        .from('ktm_players')
        .select('puuid, ign, name')
        .eq('name', 'かずき')
        .maybeSingle();

      if (player && player.puuid) {
        puuid = player.puuid;
      } else if (player && player.ign && player.ign.includes('#')) {
        const [gName, tLine] = player.ign.split('#');
        puuid = await fetchPuuidByRiotId(gName.trim(), tLine.trim(), apiKey);
      }
    }

    if (!puuid) {
      return NextResponse.json({
        success: false,
        error: '対象プレイヤーの PUUID が特定できませんでした。Riot ID を設定してください。',
      }, { status: 400 });
    }

    // 2. Spectator API で進行中のアクティブゲームを取得
    let activeGame: any = null;
    try {
      activeGame = await fetchActiveGameByPuuid(puuid, apiKey);
    } catch (err: any) {
      if (err.message === 'ACTIVE_GAME_NOT_FOUND' || err.message?.includes('404')) {
        return NextResponse.json({
          success: true,
          liveMatch: null,
          message: '進行中の試合（Active Game）は見つかりませんでした。',
        });
      }
      throw err;
    }

    if (!activeGame || !activeGame.participants) {
      return NextResponse.json({
        success: true,
        liveMatch: null,
        message: '進行中の試合（Active Game）は見つかりませんでした。',
      });
    }

    // 3. 自分と対面チャンピオンの特定
    const participants: any[] = activeGame.participants || [];
    const me = participants.find((p: any) => p.puuid === puuid);

    if (!me) {
      return NextResponse.json({
        success: true,
        liveMatch: null,
        message: '進行中の試合が見つかりましたが、指定プレイヤーの参加データが取得できませんでした。',
      });
    }

    const myTeamId = me.teamId;
    const enemyParticipants = participants.filter((p: any) => p.teamId !== myTeamId);

    // 自分のチャンピオン名 (DDragon ID)
    const myChampionName = await getChampNameById(me.championId);

    // 対面チャンピオンの推定:
    // 1) チーム内でのインデックス一致 (Blue 1番目 vs Red 1番目 など)
    // 2) サモナースペル（例：スマイト持ち同士ならJG）
    const myTeamParticipants = participants.filter((p: any) => p.teamId === myTeamId);
    const myIndexInTeam = myTeamParticipants.findIndex((p: any) => p.puuid === puuid);

    let enemyCandidate = enemyParticipants[myIndexInTeam] || enemyParticipants[0];

    // スマイト (SummonerSmite = 11) の有無でJGを対面として優先マッチング
    const SMITE_SPELL_ID = 11;
    const iHaveSmite = me.spell1Id === SMITE_SPELL_ID || me.spell2Id === SMITE_SPELL_ID;
    if (iHaveSmite) {
      const enemyJg = enemyParticipants.find((p: any) => p.spell1Id === SMITE_SPELL_ID || p.spell2Id === SMITE_SPELL_ID);
      if (enemyJg) enemyCandidate = enemyJg;
    }

    const enemyChampionName = enemyCandidate ? await getChampNameById(enemyCandidate.championId) : '';

    return NextResponse.json({
      success: true,
      liveMatch: {
        gameId: activeGame.gameId,
        gameMode: activeGame.gameMode,
        gameLength: activeGame.gameLength,
        myChampion: myChampionName,
        enemyChampion: enemyChampionName,
        enemyTeam: await Promise.all(enemyParticipants.map(async (p: any) => ({
          championId: p.championId,
          championName: await getChampNameById(p.championId),
          summonerName: p.riotId || p.summonerName || '',
        }))),
      },
      message: `進行中の試合を検出しました (${myChampionName} vs ${enemyChampionName})`,
    });
  } catch (error: any) {
    console.error('[api/riot/live-game] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '進行中試合の取得に失敗しました。',
    }, { status: 500 });
  }
}
