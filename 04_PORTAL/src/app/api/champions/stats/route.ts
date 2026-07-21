import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export const revalidate = 300; // 5分間キャッシュしてSupabaseへの負荷を削減


export async function GET() {
  try {
    // 1. 全参加者レコードを取得
    const { data: participants, error: pError } = await supabase
      .from('ktm_match_participants')
      .select('match_id, player_name, champion_name, kills, deaths, assists, team, role');
      
    if (pError) throw pError;

    // 2. 試合作成日時および勝敗情報を取得
    const { data: matches, error: mError } = await supabase
      .from('ktm_matches')
      .select('id, created_at, winning_team')
      .order('created_at', { ascending: false });

    if (mError) throw mError;
    
    const matchDateMap = new Map();
    matches.forEach((m: any) => {
      matchDateMap.set(m.id, { date: m.created_at, winner: m.winning_team });
    });

    // 3. 直接対面（マッチアップ）マッピングの事前構築
    // 試合ID -> ロール -> { blue: チャンピオン名, red: チャンピオン名 }
    const matchMatchupMap: Record<string, Record<string, { blue?: string; red?: string }>> = {};
    participants.forEach((p: any) => {
      const mId = p.match_id;
      const role = p.role || 'UNKNOWN';
      const team = p.team || 'blue';
      const champ = p.champion_name;
      if (!champ) return;

      if (!matchMatchupMap[mId]) {
        matchMatchupMap[mId] = {};
      }
      if (!matchMatchupMap[mId][role]) {
        matchMatchupMap[mId][role] = {};
      }
      if (team === 'blue') {
        matchMatchupMap[mId][role].blue = champ;
      } else {
        matchMatchupMap[mId][role].red = champ;
      }
    });

    // 4. チャンピオンごとの集計処理
    const stats: Record<string, any> = {};

    participants.forEach((p: any) => {
      const champ = p.champion_name;
      if (!champ) return;

      const matchInfo = matchDateMap.get(p.match_id) || {};
      const isWin = p.team === matchInfo.winner;

      if (!stats[champ]) {
        stats[champ] = {
          pick_count: 0,
          win_count: 0,
          total_kills: 0,
          total_deaths: 0,
          total_assists: 0,
          player_stats: {},
          history: [],
          matchup_stats: {} // 直接対面の統計用
        };
      }

      const c = stats[champ];
      c.pick_count += 1;
      if (isWin) c.win_count += 1;
      c.total_kills += p.kills || 0;
      c.total_deaths += p.deaths || 0;
      c.total_assists += p.assists || 0;

      // プレイヤーごとの集計
      const pName = p.player_name;
      if (!c.player_stats[pName]) {
        c.player_stats[pName] = {
          player_name: pName,
          games: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0
        };
      }
      const ps = c.player_stats[pName];
      ps.games += 1;
      if (isWin) ps.wins += 1;
      ps.kills += p.kills || 0;
      ps.deaths += p.deaths || 0;
      ps.assists += p.assists || 0;

      // 相手チームの同じロールのチャンピオン（直接の対面）を特定
      const mId = p.match_id;
      const role = p.role || 'UNKNOWN';
      const team = p.team || 'blue';
      const enemyChamp = team === 'blue' ? matchMatchupMap[mId]?.[role]?.red : matchMatchupMap[mId]?.[role]?.blue;

      if (enemyChamp) {
        if (!c.matchup_stats[enemyChamp]) {
          c.matchup_stats[enemyChamp] = {
            enemy_champion: enemyChamp,
            games: 0,
            wins: 0,
            kills: 0,
            deaths: 0,
            assists: 0
          };
        }
        const ms = c.matchup_stats[enemyChamp];
        ms.games += 1;
        if (isWin) ms.wins += 1;
        ms.kills += p.kills || 0;
        ms.deaths += p.deaths || 0;
        ms.assists += p.assists || 0;
      }

      // マッチ履歴レコードの作成
      c.history.push({
        match_id: p.match_id,
        created_at: matchInfo.date || '',
        player_name: pName,
        team: p.team,
        role: p.role,
        score: `${p.kills}/${p.deaths}/${p.assists}`,
        is_win: isWin,
        enemy_champion: enemyChamp || 'Unknown'
      });
    });

    // 5. 整形とデータ分析サマリーの算出
    const formattedStats: Record<string, any> = {};

    Object.keys(stats).forEach(champ => {
      const c = stats[champ];
      
      // 勝率とKDA
      const win_rate = c.pick_count > 0 ? Math.round((c.win_count / c.pick_count) * 1000) / 10 : 0;
      const total_k = c.total_kills;
      const total_d = c.total_deaths;
      const total_a = c.total_assists;
      const avg_kda = total_d > 0 ? Math.round(((total_k + total_a) / total_d) * 100) / 100 : (total_k + total_a);

      // プレイヤーランキング
      const playersList = Object.values(c.player_stats).map((ps: any) => {
        const pWinRate = ps.games > 0 ? Math.round((ps.wins / ps.games) * 1000) / 10 : 0;
        const pKda = ps.deaths > 0 ? Math.round(((ps.kills + ps.assists) / ps.deaths) * 100) / 100 : (ps.kills + ps.assists);
        return {
          player_name: ps.player_name,
          games: ps.games,
          win_rate: pWinRate,
          kda: pKda
        };
      });
      const top_players = playersList
        .sort((a, b) => b.games - a.games || b.win_rate - a.win_rate)
        .slice(0, 3);

      // 直接対面（マッチアップ）の分析データ
      const formattedMatchups: Record<string, any> = {};
      Object.keys(c.matchup_stats).forEach(enemy => {
        const ms = c.matchup_stats[enemy];
        const mWinRate = ms.games > 0 ? Math.round((ms.wins / ms.games) * 1000) / 10 : 0;
        const mKda = ms.deaths > 0 ? Math.round(((ms.kills + ms.assists) / ms.deaths) * 100) / 100 : (ms.kills + ms.assists);
        
        // AIライクな戦績分析要約の自動生成
        let analysis = '';
        if (mWinRate >= 66.7) {
          analysis = `対面 ${enemy} に対しては過去 ${ms.games} 戦中 ${ms.wins} 勝（勝率 ${mWinRate}%）と有利に立ち回っています。平均KDAは ${mKda} と戦闘時の判断が非常に安定しており、主導権を握りやすい対面です。`;
        } else if (mWinRate <= 33.3) {
          analysis = `対面 ${enemy} に対しては過去 ${ms.games} 戦中 ${ms.wins} 勝（勝率 ${mWinRate}%）と苦戦しています。レーン戦で不利を背負いやすいため、序盤のガンク警戒やタワー下でのファームを意識する必要があります。`;
        } else {
          analysis = `対面 ${enemy} とは過去 ${ms.games} 戦中 ${ms.wins} 勝（勝率 ${mWinRate}%）と拮抗しています。中盤以降のオブジェクト戦や集団戦の立ち回りがゲームの勝敗を分けます。`;
        }

        formattedMatchups[enemy] = {
          games: ms.games,
          wins: ms.wins,
          losses: ms.games - ms.wins,
          win_rate: mWinRate,
          kda: mKda,
          analysis_summary: analysis
        };
      });

      // 直近履歴のソート
      const sortedHistory = c.history
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      formattedStats[champ] = {
        pick_count: c.pick_count,
        win_rate: win_rate,
        avg_kda: avg_kda,
        top_players: top_players,
        matchup_stats: formattedMatchups, // 対面ごとの詳細スタッツ
        match_history: sortedHistory
      };
    });

    return NextResponse.json({ success: true, stats: formattedStats });

  } catch (error: any) {
    console.error('Failed to calculate champion stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
