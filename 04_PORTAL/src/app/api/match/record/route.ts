import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { calculateNewMMRDetailed, calculateKdaScore, MmrCalcContext, calculateInitialMmr, computeRepresentativeMmr, propagateCrossLaneMmr } from '../../../../lib/mmr';
import { fetchAllRows } from '../../../../lib/fetchAll';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { verifyBotSecret } from '../../../../lib/botAuth';
import { syncPlayersDiscordRoles } from '../../../../lib/discordRoleSync';

export async function POST(request: Request) {
  try {
    // ===== 認証（2026-09-29 追加）=====
    // 以前は「仲間内メンバーが自分でも操作する運用のため認証は掛けない設計」という
    // コメントと共に完全な無認証だった。だがその前提は既に失効している:
    // 唯一の手動記録UI だった MatchRecordPanel を 2026-09-23 に削除済みで、
    // 現在の呼び出し元は KTM Bot の handleAutoMatchEnd（ktm_bot/src/utils/helpers.js:245）
    // 1箇所だけ。Bot は fetchPortalAPI 経由で X-Bot-Secret を送っている。
    //
    // 無認証のままだと、捏造した10人分のペイロードをPOSTするだけで
    // 1試合あたり約2,550コイン（参加100×10 + 勝利150×5 + MVP200 + 各賞200×3）を発行でき、
    // コイン総供給が約15,000枚規模のため1回で約17%のインフレになる。
    // さらに ktm_matches / ktm_match_participants に架空の戦績が入り、MMRとリーダーボードも汚染される。
    //
    // verifyBotSecret は PORTAL_BOT_SECRET 未設定時のみ fail-open する（Vercelには設定済み）。
    // 将来ポータル側に手動記録UIを戻す場合は管理者セッションでも通るようにしてある。
    const botAuth = verifyBotSecret(request);
    if (!botAuth.ok) {
      const adminAuth = await verifyAdminSession(request);
      if (!adminAuth.ok) {
        return NextResponse.json(
          { error: botAuth.error || adminAuth.error || 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    // ==================================

    const body = await request.json();
    const { winningTeam, gameDuration, participants, riotMatchId, balanceSatisfaction, isExhibition, dry_run } = body;

    if (!winningTeam || !participants || participants.length !== 10) {
      return NextResponse.json({ error: '入力データが不正です。10人の参加者と勝利チームが必要です。' }, { status: 400 });
    }

    // 荒唐無稽な数値の入力・誤操作でMMR/戦績データが壊れることを防ぐため、
    // 認証とは別に最低限の値域チェックも行う(2026-08-05発覚)。
    if (winningTeam !== 'BLUE' && winningTeam !== 'RED') {
      return NextResponse.json({ error: 'winningTeamはBLUEかREDのいずれかを指定してください。' }, { status: 400 });
    }
    const names = participants.map((p: any) => p.name);
    if (new Set(names).size !== 10) {
      return NextResponse.json({ error: '10人の参加者名が重複しています。' }, { status: 400 });
    }
    for (const p of participants) {
      if (p.team !== 'BLUE' && p.team !== 'RED') {
        return NextResponse.json({ error: `不正なteam値です: ${p.name}` }, { status: 400 });
      }
      if (!['TOP', 'JG', 'MID', 'ADC', 'SUP'].includes(p.role)) {
        return NextResponse.json({ error: `不正なrole値です: ${p.name}` }, { status: 400 });
      }
      for (const key of ['kills', 'deaths', 'assists'] as const) {
        const v = Number(p[key]);
        if (!Number.isFinite(v) || v < 0 || v > 100) {
          return NextResponse.json({ error: `${p.name}の${key}が不正な値です。` }, { status: 400 });
        }
      }
      if (p.penta_kills !== undefined) {
        const v = Number(p.penta_kills);
        if (!Number.isInteger(v) || v < 0 || v > 5) {
          return NextResponse.json({ error: `${p.name}のペンタキル数が不正な値です（0〜5）。` }, { status: 400 });
        }
      }
    }
    // 各チーム5ロールが重複なく揃っているかの検証(2026-08-05発覚)。以前は無かったため、
    // 同ロールが片チームに重複投稿されると対面特定(line 105のfind)が失敗してopponentMmrが
    // 黙って1200にフォールバックし、MMR計算・Discord速報・対面カルテが静かに歪んでいた。
    for (const team of ['BLUE', 'RED'] as const) {
      const roles = participants.filter((p: any) => p.team === team).map((p: any) => p.role);
      const uniqueRoles = new Set(roles);
      if (roles.length !== 5 || uniqueRoles.size !== 5) {
        return NextResponse.json({ error: `${team}チームのロール構成が不正です（TOP/JG/MID/ADC/SUPが重複なく5人必要です）。` }, { status: 400 });
      }
    }

    if (gameDuration !== undefined && gameDuration !== null) {
      const gd = Number(gameDuration);
      if (!Number.isFinite(gd) || gd < 0 || gd > 3 * 60 * 60) {
        return NextResponse.json({ error: 'gameDurationが不正な値です。' }, { status: 400 });
      }
    }

    // 1. データベースから全参加者の最新ステータスを取得
    const { data: dbPlayers, error: pError } = await supabase
      .from('ktm_players')
      .select('*')
      .in('name', names);

    if (pError || !dbPlayers || dbPlayers.length !== 10) {
      return NextResponse.json({ error: '一部のプレイヤー情報がDBから見つかりません。' }, { status: 500 });
    }

    // 2. 過去の勝率・試合数を取得 (Supabaseのktm_match_participants等から)
    // 簡易的に全試合履歴をフェッチして集計（パフォーマンス問題があれば後日Viewや集計テーブルに移行）
    // 1000件超に備えページネーションで全件取得（欠落するとMMR計算のnumGames/勝率が不正確になる）
    const { data: historyData, error: hError } = await fetchAllRows((from, to) =>
      supabase
        .from('ktm_match_participants')
        .select(`
          match_id, player_name, role, team, ktm_matches!inner(winning_team)
        `)
        .in('player_name', names)
        .range(from, to)
    );

    if (hError) {
      return NextResponse.json({ error: `過去の試合履歴の取得に失敗しました: ${hError.message}` }, { status: 500 });
    }

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
      const dbP = dbPlayers.find((p: any) => p.name === input.name);
      if (!dbP) continue;

      const roleMmrKey = `mmr_${input.role.toLowerCase()}` as keyof typeof dbP;
      const dbMmr = dbP[roleMmrKey];
      const currentMmr = (dbMmr !== null && dbMmr !== undefined)
        ? Number(dbMmr)
        : calculateInitialMmr(dbP.highest_rank, input.role, dbP.initial_prefs || dbP.role_preferences);

      // 対面相手のMMRを探す
      const opponent = participants.find((p: any) => p.role === input.role && p.team !== input.team);
      const oppDbP = opponent ? dbPlayers.find((p: any) => p.name === opponent.name) : null;
      let opponentMmr = 1200;
      if (oppDbP && opponent) {
        const oppMmrKey = `mmr_${opponent.role.toLowerCase()}` as keyof typeof oppDbP;
        const oppMmr = oppDbP[oppMmrKey];
        opponentMmr = (oppMmr !== null && oppMmr !== undefined)
          ? Number(oppMmr)
          : calculateInitialMmr(oppDbP.highest_rank, opponent.role, oppDbP.role_preferences);
      }

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

      // お祭りマッチ（完全オフメタ・ランダム等）の場合はMMR変動ゼロ（完全戦績保護）
      let mmrDelta = 0;
      let mmrBreakdown = null;

      if (!isExhibition) {
        const mmrResult = calculateNewMMRDetailed(ctx);
        mmrDelta = mmrResult.delta;
        mmrBreakdown = mmrResult.breakdown;
      } else {
        mmrBreakdown = {
          baseDelta: 0,
          kdaBonus: 0,
          mvpBonus: 0,
          streakBonus: 0,
          finalDelta: 0,
          isExhibition: true,
          note: 'お祭りカスタム (戦績ノーカウント保護)'
        };
      }

      const kdaScore = calculateKdaScore(input.kills, input.deaths, input.assists);

      results.push({
        ...input,
        currentMmr,
        mmrDelta,
        mmrBreakdown,
        kdaScore,
        dbPlayer: dbP
      });
    }

    // 🛡️ DRY_RUN ガード: 自動操作やテスト時はDB更新・Webhook送信を行わず計算結果のみ返す
    if (dry_run) {
      return NextResponse.json({
        success: true,
        matchId: 'dry-run-match-id',
        message: '【DRY RUN】シミュレーション完了（DB書き込み・Discord通知は安全にスキップされました）',
        results: results.map((r: any) => ({
          name: r.name,
          role: r.role,
          team: r.team,
          mmrDelta: r.mmrDelta,
          newMmr: r.currentMmr + r.mmrDelta
        }))
      });
    }

    // 4. DBへのトランザクション書き込み
    // (1) ktm_matches レコード作成
    const effectiveRiotMatchId = isExhibition ? 'EXHIBITION' : (riotMatchId || null);
    const { data: matchData, error: mError } = await supabase
      .from('ktm_matches')
      .insert({
        winning_team: winningTeam,
        game_duration: gameDuration || 0,
        riot_match_id: effectiveRiotMatchId
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
      discord_id: r.dbPlayer?.discord_id || null, // 改名に強い紐付けキー
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
      penta_kills: Number(r.penta_kills) || 0, // 記録画面で入力（2026-10-07）。ジャックポット総取りの判定に使う
      kda_score: r.kdaScore,
      mmr_delta: r.mmrDelta,
      mmr_breakdown: r.mmrBreakdown || null, // M-03: 変動の内訳
      player_mmr: r.currentMmr
    }));

    const { error: piError } = await supabase
      .from('ktm_match_participants')
      .insert(participantInserts);
    
    if (piError) throw new Error(`参加者データの作成に失敗: ${piError.message}`);

    // (3) ktm_players のMMRとPityとコインをUPDATE
    for (const r of results) {
      const gamesKey = `games_${r.role.toLowerCase()}`;

      // ⑤ レーン間MMR連動 (Cross-Lane Propagation)
      const currentLaneMmrs = {
        TOP: r.dbPlayer.mmr_top || 1200,
        JG:  r.dbPlayer.mmr_jg  || 1200,
        MID: r.dbPlayer.mmr_mid || 1200,
        ADC: r.dbPlayer.mmr_adc || 1200,
        SUP: r.dbPlayer.mmr_sup || 1200,
      };
      const propagated = propagateCrossLaneMmr(currentLaneMmrs, r.role, r.mmrDelta);
      const top = isExhibition ? currentLaneMmrs.TOP : propagated.TOP;
      const jg  = isExhibition ? currentLaneMmrs.JG  : propagated.JG;
      const mid = isExhibition ? currentLaneMmrs.MID : propagated.MID;
      const adc = isExhibition ? currentLaneMmrs.ADC : propagated.ADC;
      const sup = isExhibition ? currentLaneMmrs.SUP : propagated.SUP;

      const newGames = {
        TOP: (r.dbPlayer.games_top || 0) + (!isExhibition && r.role === 'TOP' ? 1 : 0),
        JG:  (r.dbPlayer.games_jg  || 0) + (!isExhibition && r.role === 'JG'  ? 1 : 0),
        MID: (r.dbPlayer.games_mid || 0) + (!isExhibition && r.role === 'MID' ? 1 : 0),
        ADC: (r.dbPlayer.games_adc || 0) + (!isExhibition && r.role === 'ADC' ? 1 : 0),
        SUP: (r.dbPlayer.games_sup || 0) + (!isExhibition && r.role === 'SUP' ? 1 : 0),
      };
      const newTotalMmr = isExhibition ? (r.dbPlayer.mmr || 1200) : computeRepresentativeMmr({ TOP: top, JG: jg, MID: mid, ADC: adc, SUP: sup }, newGames);

      // Pity（通常の選抜漏れ・配置Pity）の計算
      const primary = r.dbPlayer.role_preferences?.primary || 'ALL';
      const secondary = r.dbPlayer.role_preferences?.secondary || 'ALL';
      const playedRole = r.role;
      let newPity = Number(r.dbPlayer.pity) || 0;

      if (primary === 'ALL' || primary === 'FILL') {
        newPity = 0;
      } else if (playedRole === primary) {
        newPity = 0;
      } else if (playedRole === secondary || secondary === 'ALL' || secondary === 'FILL') {
        newPity += 2;
      } else {
        newPity += 5;
      }

      let newOffRolePity = Number(r.dbPlayer.off_role_pity) || 0;
      if (primary === 'ALL' || primary === 'FILL') {
        newOffRolePity = 0;
      } else if (playedRole === primary) {
        newOffRolePity = 0;
      } else if (playedRole === secondary || secondary === 'ALL' || secondary === 'FILL') {
        // 維持
      } else {
        newOffRolePity += 1;
      }

      // コイン付与計算: 参加賞 +100コイン、勝利チーム +150コイン (お祭りマッチでもコインは満額付与！)
      const currentRolePrefs = typeof r.dbPlayer.role_preferences === 'object' && r.dbPlayer.role_preferences !== null ? r.dbPlayer.role_preferences : {};
      const currentCoins = Number(currentRolePrefs.coins ?? r.dbPlayer.coins ?? r.dbPlayer.metadata?.coins) || 1000;
      const coinReward = (r.team === winningTeam) ? 250 : 100;
      const newCoins = currentCoins + coinReward;
      const currentMeta = typeof r.dbPlayer.metadata === 'object' && r.dbPlayer.metadata !== null ? r.dbPlayer.metadata : {};

      const baseUpdate: any = {
        mmr_top: top,
        mmr_jg: jg,
        mmr_mid: mid,
        mmr_adc: adc,
        mmr_sup: sup,
        [gamesKey]: (newGames as any)[r.role],
        mmr: newTotalMmr,
        pity: newPity,
        off_role_pity: newOffRolePity,
        coins: newCoins,
        role_preferences: { ...currentRolePrefs, coins: newCoins },
        metadata: { ...currentMeta, coins: newCoins }
      };

      const { error: uError } = await supabase
        .from('ktm_players')
        .update(baseUpdate)
        .eq('name', r.name);

      if (uError) {
        console.warn(`[match/record] Player ${r.name} full update failed (${uError.message}), retrying without direct coins column:`);
        delete baseUpdate.coins;
        const retryRes = await supabase
          .from('ktm_players')
          .update(baseUpdate)
          .eq('name', r.name);
        if (retryRes.error) {
          throw new Error(`Player ${r.name} の更新エラー: ${retryRes.error.message}`);
        }
      }
    }

    // (4) 待機プレイヤーの Pity 加算はチーム確定時（pending保存時）に行うようにライフサイクルを分離・移動したため、ここでは行わない。

    // この試合が精算する「ラウンド」(balancer_predictions.id)。(4.5) でロスター一致した予測から確定し、
    // (4.6) の勝敗予想ベット精算で「このラウンドのベットだけ」を対象にするために使う。
    // 予測を特定できなければ null のままとし、(4.6) は従来どおり pending 全件を精算する（取りこぼし防止）。
    let settledRoundId: string | number | null = null;

    // (4.5) バランサー予測勝率の突き合わせ（課題: 予測勝率の検証）
    // 直近の未突き合わせ予測から、このゲームのロスターに一致するものを探して的中/不的中を記録する。
    // 予測はチーム確定時に balancer_predictions へ保存済み。テーブル未作成でも try/catch で握りつぶす。
    try {
      const blueNames = new Set(results.filter((r: any) => r.team === 'BLUE').map((r: any) => r.name));
      const redNames = new Set(results.filter((r: any) => r.team === 'RED').map((r: any) => r.name));
      const setEq = (a: Set<string>, b: string[]) => a.size === b.length && b.every((n) => a.has(n));

      const { data: preds } = await supabase
        .from('balancer_predictions')
        .select('*')
        .is('match_id', null)
        .order('created_at', { ascending: false })
        .limit(20);

      // 青赤の並びは入れ替わっている可能性があるので両方向で照合する
      const match = (preds || []).find((p: any) => {
        const pb: string[] = p.blue_players || [];
        const pr: string[] = p.red_players || [];
        const sameOrient = setEq(blueNames, pb) && setEq(redNames, pr);
        const swapped = setEq(blueNames, pr) && setEq(redNames, pb);
        return sameOrient || swapped;
      });

      if (match) {
        settledRoundId = match.id ?? null;
        // 予測は「保存時のblue側」基準。実ロスターが入れ替わっていれば勝者側も読み替える。
        const swapped = !(setEq(blueNames, match.blue_players || []));
        const actualBlueWon = winningTeam === 'BLUE';
        // 予測blue勝率を、保存時のblue視点での実勝敗に変換
        const predictedBlueWon = Number(match.predicted_blue_winprob) >= 0.5;
        const savedBlueActuallyWon = swapped ? !actualBlueWon : actualBlueWon;
        const correct = predictedBlueWon === savedBlueActuallyWon;

        // ⚠️ 戻り値の error を必ず見る。2026-09-30まで、ここは error を捨てていたため
        // match_id の型が uuid→bigint に変わっていた（migration 24 の誤り）ことに
        // 2か月以上気づけず、予測検証・満足度・結果メッセージIDの紐付けが
        // すべて黙って失敗し続けていた（45件すべて actual_winner が NULL）。
        const { error: predErr } = await supabase
          .from('balancer_predictions')
          .update({
            match_id: newMatchId,
            actual_winner: winningTeam,
            correct,
          })
          .eq('id', match.id);
        if (predErr) {
          console.error('[match/record] 予測の突き合わせ保存に失敗:', predErr.message, predErr.details || '');
        }

        // 結果が確定するたびに直近の的中率を確認し、コイントス並みまで落ちていれば通知する
        const { reviewBalancerPredictionAccuracy } = await import('../../../../lib/balancer');
        await reviewBalancerPredictionAccuracy(supabase).catch(() => {});
      }
    } catch (e) {
      console.warn('[match/record] 予測突き合わせに失敗（続行）:', e);
    }

    // (4.6) 勝敗予想ベットの自動精算（的中者へのコイン払い戻し）
    // 4. 勝敗予想（ベット）の自動精算 ＆ 的中配当払い戻し
    const payoutWinners: Array<{ name: string; payout: number; multiplier: number; streak?: number }> = [];
    try {
      const { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } = await import('../../../../lib/playerCoins');
      const { data: allOpenBetTasks } = await supabase
        .from('edge_tasks')
        .select('id, payload')
        .eq('task_type', 'custom_bet')
        .eq('status', 'pending');

      // このラウンドに属するベットだけを精算する。settledRoundId が特定できなかった場合は
      // 従来どおり全件（filterBetsByRound が roundId=null で全件返す）。round_id を持たない
      // レガシーbet は常に含まれる（filterBetsByRound の仕様）。
      const { filterBetsByRound } = await import('../../../../lib/betOdds');
      const openBetTasks = filterBetsByRound(
        (allOpenBetTasks || []).map((t: any) => ({ round_id: t?.payload?.round_id ?? null, task: t })),
        settledRoundId
      ).map((x: any) => x.task);

      if (openBetTasks && openBetTasks.length > 0) {
        for (const task of openBetTasks) {
          const bet = task.payload || {};
          const won = (bet.team === winningTeam);
          let payout = 0;
          // 保存済みoddsは必ずクランプしてから使う。2026-09-22以前に作られたレコードは
          // クライアント申告値がそのまま入っている可能性があるため（任意倍率払い戻しの防止）。
          const { sanitizeStoredOdds } = await import('../../../../lib/betOdds');
          const multiplier = sanitizeStoredOdds(bet.odds);

          const pPlayer = await findOrCreatePlayer({
            discordId: bet.discord_id,
            name: bet.player_name,
            autoCreate: true,
          });

          let streakBonusPercent = 0;
          let currentStreak = 0;

          if (won) {
            currentStreak = (Number(pPlayer?.role_preferences?.betStreak) || 0) + 1;
            const maxStreak = Math.max(currentStreak, Number(pPlayer?.role_preferences?.maxBetStreak) || currentStreak);

            // 🔥 連勝ボーナス (5連勝以上:+20%, 3連勝以上:+10%, 2連勝:+5%)
            if (currentStreak >= 5) {
              streakBonusPercent = 20;
            } else if (currentStreak >= 3) {
              streakBonusPercent = 10;
            } else if (currentStreak >= 2) {
              streakBonusPercent = 5;
            }

            const effectiveMultiplier = multiplier * (1 + streakBonusPercent / 100);
            payout = Math.floor((bet.amount || 0) * effectiveMultiplier);
            payoutWinners.push({ name: bet.player_name, payout, multiplier: Number(effectiveMultiplier.toFixed(2)), streak: currentStreak });

            if (pPlayer) {
              const cur = getPlayerCoins(pPlayer);
              await updatePlayerCoinsAndInventory({
                player: pPlayer,
                newCoins: cur + payout,
                reason: 'bet_payout',
                reasonMetadata: { team: bet.team, amount: bet.amount, multiplier, streak: currentStreak },
                rolePreferencesUpdate: {
                  betStreak: currentStreak,
                  maxBetStreak: maxStreak,
                },
              });
            }
          } else {
            // 不的中：連勝リセット
            if (pPlayer) {
              await updatePlayerCoinsAndInventory({
                player: pPlayer,
                rolePreferencesUpdate: {
                  betStreak: 0,
                },
              });
            }
          }

          await supabase
            .from('edge_tasks')
            .update({
              status: 'completed',
              result: {
                won,
                payout,
                multiplier,
                streak: currentStreak,
                streakBonusPercent,
                settled_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', task.id);
        }
      }
    } catch (e) {
      console.warn('[match/record] 勝敗予想の自動精算エラー（続行）:', e);
    }

    // (4.7) 💎 サーバー共有ジャックポット金庫（試合開催ボーナスの積立 ＋ ペンタキルでの総取り）
    //
    // ★ 2026-10-07: 総取りの判定をここへ戻した。2026-09-22 に「Botが試合直後に呼ぶ時点ではKDAが0埋め」
    // という理由で riot/match-sync（Riot APIの実データ取得）側へ移していたが、その経路は Discord の勝敗ボタンが
    // Bot の書き直しで無くなって一度も動いておらず、ジャックポットは積み立てられるだけで誰も当てられなかった。
    // 現在の記録は 04 の記録画面から行い、ペンタキル数も記録画面で入力する（ktm_match_participants.penta_kills）。
    // 【条件】ペンタキルを達成し、かつその試合に勝利していること（負け試合の帳尻ペンタでは払い出さない）。
    // お祭りカスタム（戦績ノーカウント）は対象外。二重払い出しは ktm_matches.jackpot_claimed で防ぐ。
    let jackpotWinner: { name: string; payout: number } | null = null;
    try {
      const { addToJackpot, claimJackpot } = await import('../../../../lib/jackpot');
      // 積み立てを先に行い、この試合の分も総取りの対象に含める（JACKPOT_CAP に達していれば加算されない）
      await addToJackpot(100);

      const pentaWinner = isExhibition
        ? null
        : results.find((r: any) => Number(r.penta_kills) > 0 && r.team === winningTeam);
      if (pentaWinner) {
        const { data: matchRow } = await supabase
          .from('ktm_matches')
          .select('id, jackpot_claimed')
          .eq('id', newMatchId)
          .maybeSingle();
        if (matchRow && matchRow.jackpot_claimed === false) {
          const jRes = await claimJackpot(pentaWinner.name, pentaWinner.dbPlayer?.discord_id || null);
          if (jRes.success && jRes.payout > 0) {
            jackpotWinner = { name: pentaWinner.name, payout: jRes.payout };
            await supabase.from('ktm_matches').update({ jackpot_claimed: true }).eq('id', newMatchId);
            const { sendShopNotification } = await import('../../../../lib/discordNotify');
            await sendShopNotification({
              content: `🚨 **【JACKPOT 炸裂！！】** \`${pentaWinner.name}\` 選手がペンタキルを達成し、そのまま勝利！ ジャックポット金庫 **${jRes.payout.toLocaleString()}コイン** を総取りしました！！ 🚨`,
            }).catch(() => {});
          }
        }
      }
    } catch (jErr) {
      // 金庫処理の失敗で試合の記録そのものを失敗させない
      console.warn('[match/record] ジャックポット積立・判定エラー（続行）:', jErr);
    }

    // 5. Discordへ試合結果を速報通知 (非同期で送信して待たないか、待つか。エラーになっても保存は完了させる)
    try {
      const webhookUrl = process.env.DISCORD_KTM_WEBHOOK_URL;
      if (webhookUrl) {
        const blueTeam = results.filter((r: any) => r.team === 'BLUE');
        const redTeam = results.filter((r: any) => r.team === 'RED');
        
        const formatPlayer = (p: any) => {
          const delta = isExhibition ? `±0 (お祭り保護)` : (p.mmrDelta > 0 ? `+${p.mmrDelta}` : `${p.mmrDelta}`);
          const kda = `${p.kills}/${p.deaths}/${p.assists}`;
          const champ = p.champion_name ? p.champion_name : 'Unknown';
          const coinsEarned = p.team === winningTeam ? '+250🪙' : '+100🪙';
          return `\`${p.name}\` (${champ}) - **${kda}** (MMR: ${delta} | ${coinsEarned})`;
        };

        const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
        const icons: Record<string, string> = { TOP: '🛡️', JG: '🌲', MID: '🔥', ADC: '🏹', SUP: '✨' };
        
        const matchupsText = roles.map((role: any) => {
          const pb = blueTeam.find((p: any) => p.role === role);
          const pr = redTeam.find((p: any) => p.role === role);
          const bText = pb ? formatPlayer(pb) : '-';
          const rText = pr ? formatPlayer(pr) : '-';
          return `${icons[role]} **${role}**: ${bText} 🆚 ${rText}`;
        }).join('\n\n');

        const blueTitle = winningTeam === 'BLUE' ? '🏆 🟦 BLUE TEAM (WIN)' : '💀 🟦 BLUE TEAM';
        const redTitle = winningTeam === 'RED' ? '🏆 🟥 RED TEAM (WIN)' : '💀 🟥 RED TEAM';

        const betPayoutSummary = payoutWinners.length > 0
          ? payoutWinners.map(w => `・\`${w.name}\`: **+${w.payout.toLocaleString()}🪙** 獲得！(x${w.multiplier}倍)`).join('\n')
          : '的中者なし (または受付中のベットなし)';

        // 📰 AIハイライト実況ニュース（スポーツ報知風ダイジェスト）の自動生成
        let newsArticle: any = null;
        try {
          const { generateMatchNews } = await import('../news/route');
          newsArticle = await generateMatchNews({
            matchId: newMatchId,
            winningTeam,
            gameDuration,
            participants: results.map((r: any) => ({
              name: r.name,
              team: r.team,
              role: r.role,
              champion_name: r.champion_name,
              kills: r.kills || 0,
              deaths: r.deaths || 0,
              assists: r.assists || 0,
              mmrDelta: r.mmrDelta || 0,
            })),
          });

          // edge_tasks へ保存（ポータルトップや履歴での閲覧用）
          await supabase.from('edge_tasks').insert({
            task_type: 'ktm_match_news',
            payload: {
              matchId: newMatchId,
              winningTeam,
              article: newsArticle,
            },
            status: 'completed',
          });
        } catch (newsErr) {
          console.warn('[match/record] AIニュース生成スキップ（続行）:', newsErr);
        }

        const fieldsList = [
          ...(newsArticle ? [
            {
              name: `📰 【KTMスポーツ号外】${newsArticle.headline}`,
              value: `**${newsArticle.subheadline}**\n${newsArticle.lead}\n\n👑 **本日のMVP**: **${newsArticle.mvp?.name}** (${newsArticle.mvp?.role} / KDA: ${newsArticle.mvp?.kda})\n💬 *（※AI演出コメント）「${newsArticle.interviewQuote}」*`,
              inline: false
            }
          ] : []),
          {
            name: `${blueTitle}  🆚  ${redTitle}`,
            value: matchupsText,
            inline: false
          },
          {
            name: "💰 勝敗予想カジノ 配当結果",
            value: betPayoutSummary,
            inline: false
          }
        ];

        // ペンタキル総取りの通知は上の (4.7) で送る（2026-10-07 に riot/match-sync から移設）

        const payload = isExhibition ? {
          content: "🎪 **【KTMお祭りカスタム速報】エキシビション対決が終了しました！** 🎪\n🛡️ **完全戦績保護適用**: 全員の公式MMR・通算勝率はノーカウント（±0）で保護されました！\n🪙 参加賞（+100pt）＆勝利ボーナス（+150pt）および勝敗予想配当を付与しました！",
          embeds: [
            {
              title: "🎪 お祭りカスタム 試合リザルト (戦績ノーカウント保護)",
              color: 0xf59e0b,
              fields: fieldsList,
              footer: { text: 'KTM Sovereign Festival Match • Official MMR Protected' },
              timestamp: new Date().toISOString()
            }
          ]
        } : {
          content: "📜 **KTM 試合結果が記録されました！** 📜\n各プレイヤーのMMRが更新されました。",
          embeds: [
            {
              title: "⚔️ 試合リザルト",
              color: winningTeam === 'BLUE' ? 3447003 : 15158332,
              fields: fieldsList
            }
          ]
        };

        // 開発環境（ローカル実行やE2E自動テスト）では本番Discordチャンネルへの誤爆送信を安全に防止
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) {
          console.log('[match/record DEV] ローカル開発環境のため Discord Webhook 送信をスキップしました。');
        } else {
          // ?wait=true でメッセージ本体(id/channel_id)を受け取り、満足度投票の👍/👎を付ける（課題#42）
          const sep = webhookUrl.includes('?') ? '&' : '?';
          const whRes = await fetch(`${webhookUrl}${sep}wait=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(err => { console.error("Discord webhook error:", err); return null; });

          // 満足度は管理者が入力時に記録する方式に変更したため、リアクション付与は廃止。
          // 結果メッセージIDだけは参照用に紐付けておく。
          try {
            const msg = whRes && whRes.ok ? await whRes.json() : null;
            if (msg?.id && msg?.channel_id) {
              const { error: linkDbErr } = await supabase
                .from('balancer_predictions')
                .update({ result_message_id: msg.id, result_channel_id: msg.channel_id })
                .eq('match_id', newMatchId);
              if (linkDbErr) {
                console.error('[match/record] 結果メッセージIDの紐付けに失敗:', linkDbErr.message);
              }
            }
          } catch (linkErr) {
            console.warn('[match/record] 結果メッセージIDの紐付けに失敗（続行）:', linkErr);
          }
        }
      }
    } catch (discordErr) {
      console.error("Failed to send discord notification", discordErr);
    }

    // チーム分け満足度: 管理者が成績入力時に選んだ値を予測行へ保存する。
    // 以前はDiscordのリアクションを後から集計していたが、集まりが悪く手間もかかったため入力時記録に変更。
    if (balanceSatisfaction === 'good' || balanceSatisfaction === 'normal' || balanceSatisfaction === 'bad') {
      try {
        // 更新行数まで確認する。型不一致(error)だけでなく「対象行が無い(0件更新)」も
        // 起こり得るため。満足度は予測行に相乗りしているので、ロスター照合に失敗して
        // match_id が埋まらなかった試合では保存先が存在しない。
        const { data: satRows, error: satDbErr } = await supabase
          .from('balancer_predictions')
          .update({
            satisfaction_up: balanceSatisfaction === 'good' ? 1 : 0,
            satisfaction_down: balanceSatisfaction === 'bad' ? 1 : 0,
            satisfaction_updated_at: new Date().toISOString(),
          })
          .eq('match_id', newMatchId)
          .select('id');
        if (satDbErr) {
          console.error('[match/record] 満足度の保存に失敗:', satDbErr.message, satDbErr.details || '');
        } else if (!satRows || satRows.length === 0) {
          console.warn(
            '[match/record] 満足度の保存先が見つかりませんでした（この試合に紐づく予測行が無い）。' +
            'チーム分けをバランサー経由で確定していない試合では起こり得ます。match_id=' + newMatchId,
          );
        }
      } catch (satErr: any) {
        console.warn('[match/record] 満足度の保存に失敗（続行）:', satErr?.message);
      }
    }

    // F: 対面カルテ。各プレイヤーの「対面相手」を記録し、試合後の振り返り導線に使う。
    try {
      const logRows: any[] = [];
      for (const r of results) {
        const opp = results.find((o: any) => o.role === r.role && o.team !== r.team);
        if (!opp) continue;
        logRows.push({
          match_id: newMatchId,
          discord_id: r.dbPlayer?.discord_id || null,
          player_name: r.name,
          role: r.role,
          my_champion: r.champion_name || null,
          enemy_champion: opp.champion_name || null,
          is_win: r.team === winningTeam,
          kills: r.kills || 0,
          deaths: r.deaths || 0,
          assists: r.assists || 0,
        });
      }
      if (logRows.length > 0) {
        await supabase.from('matchup_log').insert(logRows);
      }
    } catch (logErr: any) {
      console.warn('[match/record] matchup_log の保存に失敗（続行）:', logErr?.message);
    }

    // Web Push: 試合結果の通知(#54)。失敗しても本処理は成功扱い。
    try {
      const { sendPushToAll } = await import('../../push/send/route');
      await sendPushToAll({
        title: '🏆 試合結果が記録されました',
        body: `${winningTeam === 'BLUE' ? '🟦 BLUE' : '🟥 RED'} チームの勝利！詳細はポータルで確認できます。`,
        url: '/history',
      });
    } catch (pushErr: any) {
      console.warn('[match/record] push skipped:', pushErr?.message);
    }

    // Discord ロール自動同期: 試合参加者の戦績更新に伴い、5区分ロール（初参加/ライト/常連等）を即時更新
    try {
      const participantPlayerIds = results
        .map((r: any) => r.dbPlayer?.id)
        .filter((id: any) => typeof id === 'number');

      if (participantPlayerIds.length > 0) {
        // レスポンス遅延を防ぐため、バックグラウンド的に同期を実行
        syncPlayersDiscordRoles({ playerIds: participantPlayerIds }).catch((syncErr) => {
          console.warn('[match/record] Discordロール同期エラー（続行）:', syncErr?.message);
        });
      }
    } catch (roleErr: any) {
      console.warn('[match/record] Discordロール同期呼び出し失敗（続行）:', roleErr?.message);
    }

    return NextResponse.json({ success: true, matchId: newMatchId, updates: results, jackpotWinner });

  } catch (error: any) {
    console.error('Record Match Error:', error);
    return NextResponse.json({ error: error.message || '試合の記録中にエラーが発生しました。' }, { status: 500 });
  }
}
