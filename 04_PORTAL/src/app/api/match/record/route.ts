import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { calculateNewMMR, calculateKdaScore, MmrCalcContext } from '../../../../lib/mmr';

export async function POST(request: Request) {
  try {
    const { winningTeam, gameDuration, participants, riotMatchId, adminPassword } = await request.json();

    // 管理者パスワードの検証 (安全のためのセキュリティチェック)
    // 一般ユーザーでも保存可能にするため、チェックを無効化しています
    /*
    const expectedPassword = process.env.ADMIN_PASSWORD || 'ktm';
    if (adminPassword !== expectedPassword) {
      return NextResponse.json({ error: '管理者パスワードが正しくありません。保存権限がありません。' }, { status: 403 });
    }
    */

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
        match_id, player_name, role, team, ktm_matches!inner(winning_team)
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

      const roleMmrKey = `mmr_${input.role.toLowerCase()}` as keyof typeof dbP;
      const currentMmr = Number(dbP[roleMmrKey]) || 1200;

      // 対面相手のMMRを探す
      const opponent = participants.find((p: any) => p.role === input.role && p.team !== input.team);
      const oppDbP = opponent ? dbPlayers.find(p => p.name === opponent.name) : null;
      const oppMmrKey = opponent ? `mmr_${opponent.role.toLowerCase()}` as keyof typeof oppDbP : null;
      const opponentMmr = oppDbP && oppMmrKey ? (Number(oppDbP[oppMmrKey]) || 1200) : 1200;

      // スタッツ計算用データ準備
      const isWin = input.team === winningTeam;
      const mainRank = dbP.highest_rank ? dbP.highest_rank.split(' ')[0].toUpperCase() : 'UNRANKED';
      
      const pStats = statsMap[input.name];
      const numGames = pStats.roleGames[input.role] || 0;
      const totalWinRate = pStats.totalGames > 0 ? (pStats.totalWins / pStats.totalGames) * 100 : 50;
      
      // 対面相手との対面回数を historyData から集計
      let matchupCount = 0;
      if (historyData && opponent) {
        const myMatches = historyData.filter((r: any) => r.player_name === input.name && r.role === input.role);
        const oppMatches = historyData.filter((r: any) => r.player_name === opponent.name && r.role === input.role);
        myMatches.forEach((myM: any) => {
          const matchedOpp = oppMatches.find((oppM: any) => oppM.match_id === myM.match_id && oppM.team !== myM.team);
          if (matchedOpp) {
            matchupCount++;
          }
        });
      } 

      const teamParticipants = participants.filter((p: any) => p.team === input.team);
      const teamTotalKills = teamParticipants.reduce((acc: number, curr: any) => acc + (Number(curr.kills) || 0), 0);
      
      const isDamageMvp = teamParticipants.every((p: any) => (Number(input.damage_dealt) || 0) >= (Number(p.damage_dealt) || 0)) && (Number(input.damage_dealt) || 0) > 0;
      const isObjectiveMvp = teamParticipants.every((p: any) => (Number(input.objective_damage) || 0) >= (Number(p.objective_damage) || 0)) && (Number(input.objective_damage) || 0) > 0;
      const isTankMvp = teamParticipants.every((p: any) => (Number(input.damage_taken) || 0) >= (Number(p.damage_taken) || 0)) && (Number(input.damage_taken) || 0) > 0;
      const isHealMvp = teamParticipants.every((p: any) => (Number(input.heal_shield) || 0) >= (Number(p.heal_shield) || 0)) && (Number(input.heal_shield) || 0) > 0;

      const ctx: MmrCalcContext = {
        currentMmr,
        opponentMmr,
        isWin,
        kills: Number(input.kills) || 0,
        deaths: Number(input.deaths) || 0,
        assists: Number(input.assists) || 0,
        mainRank,
        numGames,
        matchupCount,
        totalWinRate,
        visionScore: Number(input.vision_score) || 0,
        cs: Number(input.cs) || 0,
        damageDealt: Number(input.damage_dealt) || 0,
        damageTaken: Number(input.damage_taken) || 0,
        objectiveDamage: Number(input.objective_damage) || 0,
        healShield: Number(input.heal_shield) || 0,
        role: input.role,
        teamTotalKills,
        isDamageMvp,
        isObjectiveMvp,
        isTankMvp,
        isHealMvp,
        csd15: input.csd15
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
      champion_name: r.champion_name || null,
      vision_score: r.vision_score || 0,
      cs: r.cs || 0,
      damage_dealt: r.damage_dealt || 0,
      damage_taken: r.damage_taken || 0,
      objective_damage: r.objective_damage || 0,
      heal_shield: r.heal_shield || 0,
      kda_score: r.kdaScore,
      mmr_delta: r.mmrDelta
    }));

    const { error: piError } = await supabase
      .from('ktm_match_participants')
      .insert(participantInserts);
    
    if (piError) throw new Error(`参加者データの作成に失敗: ${piError.message}`);

    // (3) ktm_players のMMRとPityをUPDATE
    // それぞれのレコードを更新
    for (const r of results) {
      const roleMmrKey = `mmr_${r.role.toLowerCase()}`;
      const newRoleMmr = r.currentMmr + r.mmrDelta;
      
      // 全体MMRは各レーンの平均をとるのがKTMの仕様
      const top = r.role === 'TOP' ? newRoleMmr : (r.dbPlayer.mmr_top || 1200);
      const jg = r.role === 'JG' ? newRoleMmr : (r.dbPlayer.mmr_jg || 1200);
      const mid = r.role === 'MID' ? newRoleMmr : (r.dbPlayer.mmr_mid || 1200);
      const adc = r.role === 'ADC' ? newRoleMmr : (r.dbPlayer.mmr_adc || 1200);
      const sup = r.role === 'SUP' ? newRoleMmr : (r.dbPlayer.mmr_sup || 1200);
      const newTotalMmr = Math.round((top + jg + mid + adc + sup) / 5);

      // Pity（通常の選抜漏れ・配置Pity）の計算
      const primary = r.dbPlayer.role_preferences?.primary || 'ALL';
      const secondary = r.dbPlayer.role_preferences?.secondary || 'ALL';
      const playedRole = r.role;
      let newPity = Number(r.dbPlayer.pity) || 0;

      // 試合に参加したので、メイン配置ならリセット、サブなら+2、その他なら+5
      if (primary === 'ALL' || primary === 'FILL') {
        newPity = 0;
      } else if (playedRole === primary) {
        newPity = 0; // メインロール
      } else if (playedRole === secondary || secondary === 'ALL' || secondary === 'FILL') {
        newPity += 2; // サブロール
      } else {
        newPity += 5; // 希望外ロール
      }

      // オフロールPityの計算
      let newOffRolePity = Number(r.dbPlayer.off_role_pity) || 0;

      // "ALL" や "FILL" は実質全ロールが希望レーンとみなす
      if (primary === 'ALL' || primary === 'FILL') {
        newOffRolePity = 0;
      } else if (playedRole === primary) {
        newOffRolePity = 0; // 第一希望ならリセット
      } else if (playedRole === secondary || secondary === 'ALL' || secondary === 'FILL') {
        // 第二希望なら維持（増減なし）
      } else {
        newOffRolePity += 1; // それ以外ならオフロールPity蓄積
      }

      const updateData: any = {
        [roleMmrKey]: newRoleMmr,
        mmr: newTotalMmr,
        pity: newPity,
        off_role_pity: newOffRolePity
      };

      const { error: uError } = await supabase
        .from('ktm_players')
        .update(updateData)
        .eq('name', r.name);
        
      if (uError) {
        throw new Error(`Player ${r.name} の更新エラー: ${uError.message}`);
      }
    }

    // (4) 今回の試合に選出されなかったアクティブプレイヤーの Pity 加算 (+10)
    const { data: allActivePlayers, error: apError } = await supabase
      .from('ktm_players')
      .select('name, pity')
      .eq('is_active', true);

    if (apError) {
      throw new Error(`アクティブプレイヤー一覧の取得失敗: ${apError.message}`);
    } else if (allActivePlayers) {
      const waitingPlayers = allActivePlayers.filter(p => !names.includes(p.name));
      
      // 待機プレイヤーのPityを一括更新 (+10)
      for (const p of waitingPlayers) {
        const nextPity = (Number(p.pity) || 0) + 10;
        const { error: wUpdateError } = await supabase
          .from('ktm_players')
          .update({ pity: nextPity })
          .eq('name', p.name);
        
        if (wUpdateError) {
          throw new Error(`待機プレイヤー ${p.name} のPity更新に失敗: ${wUpdateError.message}`);
        }
      }
    }

    // 5. Discordへ試合結果を速報通知 (非同期で送信して待たないか、待つか。エラーになっても保存は完了させる)
    try {
      const webhookUrl = process.env.DISCORD_KTM_WEBHOOK_URL;
      if (webhookUrl) {
        const blueTeam = results.filter(r => r.team === 'BLUE');
        const redTeam = results.filter(r => r.team === 'RED');
        
        const formatPlayer = (p: any) => {
          const delta = p.mmrDelta > 0 ? `+${p.mmrDelta}` : `${p.mmrDelta}`;
          const kda = `${p.kills}/${p.deaths}/${p.assists}`;
          const champ = p.champion_name ? p.champion_name : 'Unknown';
          return `\`${p.name}\` (${champ}) - **${kda}** (MMR: ${delta})`;
        };

        const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
        const icons: Record<string, string> = { TOP: '🛡️', JG: '🌲', MID: '🔥', ADC: '🏹', SUP: '✨' };
        
        const matchupsText = roles.map(role => {
          const pb = blueTeam.find(p => p.role === role);
          const pr = redTeam.find(p => p.role === role);
          const bText = pb ? formatPlayer(pb) : '-';
          const rText = pr ? formatPlayer(pr) : '-';
          return `${icons[role]} **${role}**: ${bText} 🆚 ${rText}`;
        }).join('\n\n');

        const blueTitle = winningTeam === 'BLUE' ? '🏆 🟦 BLUE TEAM (WIN)' : '💀 🟦 BLUE TEAM';
        const redTitle = winningTeam === 'RED' ? '🏆 🟥 RED TEAM (WIN)' : '💀 🟥 RED TEAM';

        const payload = {
          content: "📜 **KTM 試合結果が記録されました！** 📜\n各プレイヤーのMMRが更新されました。",
          embeds: [
            {
              title: "⚔️ 試合リザルト",
              color: winningTeam === 'BLUE' ? 3447003 : 15158332, // Blue or Red
              fields: [
                {
                  name: `${blueTitle}  🆚  ${redTitle}`,
                  value: matchupsText,
                  inline: false
                }
              ]
            }
          ]
        };

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(err => console.error("Discord webhook error:", err));
      }
    } catch (discordErr) {
      console.error("Failed to send discord notification", discordErr);
    }

    return NextResponse.json({ success: true, matchId: newMatchId, updates: results });

  } catch (error: any) {
    console.error('Record Match Error:', error);
    return NextResponse.json({ error: error.message || '試合の記録中にエラーが発生しました。' }, { status: 500 });
  }
}
