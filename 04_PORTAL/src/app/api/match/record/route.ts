import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { calculateNewMMR, calculateKdaScore, MmrCalcContext } from '@/lib/mmr';

export async function POST(request: Request) {
  try {
    const { winningTeam, gameDuration, participants, riotMatchId } = await request.json();

    if (!winningTeam || !participants || participants.length !== 10) {
      return NextResponse.json({ error: '入力データが不正です。10人の参加者と勝利チームが必要です。' }, { status: 400 });
    }

    // 1. データベースから全参加者の最新ステータスを取得
    const names = participants.map((p: any) => p.name);
    const { data: dbPlayers, error: pError } = await supabase
      .from('ktm_players')
      .select('*')
      .in('name', names);

    if (pError || !dbPlayers || dbPlayers.length !== 10) {
      return NextResponse.json({ error: '一部のプレイヤー情報がDBから見つかりません。' }, { status: 500 });
    }

    // 2. 過去の勝率・試合数を取得 (Supabaseのktm_match_participants等から)
    // 簡易的に全試合履歴をフェッチして集計（パフォーマンス問題があれば後日Viewや集計テーブルに移行）
    const { data: historyData, error: hError } = await supabase
      .from('ktm_match_participants')
      .select(`
        player_name, role, team, ktm_matches!inner(winning_team)
      `)
      .in('player_name', names);

    const statsMap: Record<string, { roleGames: Record<string, number>, totalGames: number, totalWins: number }> = {};
    names.forEach((name: string) => {
      statsMap[name] = { roleGames: {}, totalGames: 0, totalWins: 0 };
    });

    if (historyData) {
      historyData.forEach((row: any) => {
        const pName = row.player_name;
        const role = row.role;
        const isWin = row.team === row.ktm_matches.winning_team;
        if (!statsMap[pName]) return;
        
        statsMap[pName].totalGames += 1;
        if (isWin) statsMap[pName].totalWins += 1;
        
        statsMap[pName].roleGames[role] = (statsMap[pName].roleGames[role] || 0) + 1;
      });
    }

    // 3. 各プレイヤーのMMR変動を計算
    const results = [];
    
    for (const input of participants) {
      const dbP = dbPlayers.find(p => p.name === input.name);
      if (!dbP) continue;

      const roleMmrKey = `${input.role.toLowerCase()}_mmr` as keyof typeof dbP;
      const currentMmr = Number(dbP[roleMmrKey]) || 1200;

      // 対面相手のMMRを探す
      const opponent = participants.find((p: any) => p.role === input.role && p.team !== input.team);
      const oppDbP = opponent ? dbPlayers.find(p => p.name === opponent.name) : null;
      const oppMmrKey = opponent ? `${opponent.role.toLowerCase()}_mmr` as keyof typeof oppDbP : null;
      const opponentMmr = oppDbP && oppMmrKey ? (Number(oppDbP[oppMmrKey]) || 1200) : 1200;

      // スタッツ計算用データ準備
      const isWin = input.team === winningTeam;
      const mainRank = dbP.highest_rank ? dbP.highest_rank.split(' ')[0].toUpperCase() : 'UNRANKED';
      
      const pStats = statsMap[input.name];
      const numGames = pStats.roleGames[input.role] || 0;
      const totalWinRate = pStats.totalGames > 0 ? (pStats.totalWins / pStats.totalGames) * 100 : 50;
      
      // 対面回数の計算 (今回は簡易的に0とするか、historyDataからさらに集計可能だが省略)
      const matchupCount = 0; 

      const ctx: MmrCalcContext = {
        currentMmr,
        opponentMmr,
        isWin,
        kills: Number(input.kills),
        deaths: Number(input.deaths),
        assists: Number(input.assists),
        mainRank,
        numGames,
        matchupCount,
        totalWinRate
      };

      const mmrDelta = calculateNewMMR(ctx);
      const kdaScore = calculateKdaScore(input.kills, input.deaths, input.assists);

      results.push({
        ...input,
        currentMmr,
        mmrDelta,
        kdaScore,
        dbPlayer: dbP
      });
    }

    // 4. DBへのトランザクション書き込み
    // (1) ktm_matches レコード作成
    const { data: matchData, error: mError } = await supabase
      .from('ktm_matches')
      .insert({
        winning_team: winningTeam,
        game_duration: gameDuration || 0,
        riot_match_id: riotMatchId || null
      })
      .select('id')
      .single();

    if (mError || !matchData) {
      throw new Error(`試合レコードの作成に失敗: ${mError?.message}`);
    }

    const newMatchId = matchData.id;

    // (2) ktm_match_participants に10人分INSERT
    const participantInserts = results.map(r => ({
      match_id: newMatchId,
      player_name: r.name,
      team: r.team,
      role: r.role,
      kills: r.kills,
      deaths: r.deaths,
      assists: r.assists,
      vision_score: r.vision_score || 0,
      kda_score: r.kdaScore,
      mmr_delta: r.mmrDelta
    }));

    const { error: piError } = await supabase
      .from('ktm_match_participants')
      .insert(participantInserts);
    
    if (piError) throw new Error(`参加者データの作成に失敗: ${piError.message}`);

    // (3) ktm_players のMMRをUPDATE
    // それぞれのレコードを更新
    for (const r of results) {
      const roleMmrKey = `${r.role.toLowerCase()}_mmr`;
      const newRoleMmr = r.currentMmr + r.mmrDelta;
      
      // 全体MMRは各レーンの平均をとるのがKTMの仕様
      const top = r.role === 'TOP' ? newRoleMmr : r.dbPlayer.top_mmr;
      const jg = r.role === 'JG' ? newRoleMmr : r.dbPlayer.jg_mmr;
      const mid = r.role === 'MID' ? newRoleMmr : r.dbPlayer.mid_mmr;
      const adc = r.role === 'ADC' ? newRoleMmr : r.dbPlayer.adc_mmr;
      const sup = r.role === 'SUP' ? newRoleMmr : r.dbPlayer.sup_mmr;
      const newTotalMmr = Math.round((top + jg + mid + adc + sup) / 5);

      const updateData: any = {
        [roleMmrKey]: newRoleMmr,
        mmr: newTotalMmr
      };

      const { error: uError } = await supabase
        .from('ktm_players')
        .update(updateData)
        .eq('name', r.name);
        
      if (uError) console.error(`Player ${r.name} の更新エラー:`, uError);
    }

    return NextResponse.json({ success: true, matchId: newMatchId, updates: results });

  } catch (error: any) {
    console.error('Record Match Error:', error);
    return NextResponse.json({ error: error.message || '試合の記録中にエラーが発生しました。' }, { status: 500 });
  }
}
