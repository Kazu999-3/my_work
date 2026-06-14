import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerName = searchParams.get('name');

    if (!playerName) {
      return NextResponse.json({ error: 'プレイヤー名が指定されていません。' }, { status: 400 });
    }

    // 1. 指定したプレイヤーの全試合データを取得（winning_teamも取得）
    const { data: myMatches, error: myError } = await supabase
      .from('ktm_match_participants')
      .select(`
        match_id,
        team,
        ktm_matches!inner(winning_team)
      `)
      .eq('player_name', playerName);

    if (myError) throw myError;
    if (!myMatches || myMatches.length === 0) {
      return NextResponse.json({ success: true, chemistry: [], rivals: [] });
    }

    // match_id リストを作成
    const matchIds = myMatches.map(m => m.match_id);

    // 2. それらの試合に同席した全員のデータを一括取得
    const { data: allParticipants, error: allError } = await supabase
      .from('ktm_match_participants')
      .select('match_id, player_name, team')
      .in('match_id', matchIds)
      .neq('player_name', playerName); // 自分自身は除く

    if (allError) throw allError;

    // 3. マップ化して集計を容易にする
    // myMatchesMap[match_id] = { team, isWin }
    const myMatchesMap: Record<number, { team: string, isWin: boolean }> = {};
    myMatches.forEach(m => {
      const winningTeam = Array.isArray(m.ktm_matches) 
        ? (m.ktm_matches[0] as any)?.winning_team 
        : (m.ktm_matches as any)?.winning_team;

      myMatchesMap[m.match_id] = {
        team: m.team,
        isWin: m.team === winningTeam
      };
    });

    const chemistry: Record<string, { games: number, wins: number }> = {};
    const rivals: Record<string, { games: number, wins: number }> = {};

    // 参加者レコードをループして集計
    allParticipants.forEach(p => {
      const myMatch = myMatchesMap[p.match_id];
      if (!myMatch) return;

      const partnerName = p.player_name;
      const sameTeam = myMatch.team === p.team;
      const isWin = myMatch.isWin;

      if (sameTeam) {
        if (!chemistry[partnerName]) {
          chemistry[partnerName] = { games: 0, wins: 0 };
        }
        chemistry[partnerName].games += 1;
        if (isWin) chemistry[partnerName].wins += 1;
      } else {
        if (!rivals[partnerName]) {
          rivals[partnerName] = { games: 0, wins: 0 };
        }
        rivals[partnerName].games += 1;
        if (isWin) rivals[partnerName].wins += 1; // 自分が勝った場合
      }
    });

    // 4. 配列フォーマット＆ソート
    const formattedChemistry = Object.entries(chemistry)
      .map(([name, data]) => ({
        name,
        games: data.games,
        wins: data.wins,
        winRate: Math.round((data.wins / data.games) * 100)
      }))
      .sort((a, b) => {
        // 勝率順（降順）、同率なら試合数順
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.games - a.games;
      });

    const formattedRivals = Object.entries(rivals)
      .map(([name, data]) => ({
        name,
        games: data.games,
        wins: data.wins,
        winRate: Math.round((data.wins / data.games) * 100) // 自分が相手に勝った確率
      }))
      .sort((a, b) => {
        // 宿敵（勝率が低い＝自分が負けている）を先頭にするため昇順ソート、同率なら試合数順
        if (a.winRate !== b.winRate) return a.winRate - b.winRate;
        return b.games - a.games;
      });

    return NextResponse.json({
      success: true,
      chemistry: formattedChemistry,
      rivals: formattedRivals
    });

  } catch (error: any) {
    console.error('Chemistry Fetch Error:', error);
    return NextResponse.json({ error: error.message || '相性分析データの取得に失敗しました。' }, { status: 500 });
  }
}
