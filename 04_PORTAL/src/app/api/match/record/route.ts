import { NextResponse, after } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchAllRows } from '../../../../lib/fetchAll';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { verifyBotSecret } from '../../../../lib/botAuth';

// 分割モジュール群（2026-11-15 リファクタリング：フェーズの分離・コードの臭い排除）
import { MatchRecordBody } from '../../../../lib/matchRecord/types';
import { validateMatchRecordInput, resolveAndValidateDbPlayers } from '../../../../lib/matchRecord/validator';
import { calculateMatchParticipantsMmr, computePlayerSettlement } from '../../../../lib/matchRecord/calculator';
import { insertMatchParticipants, updatePlayersMmrAndCoins, settleMatchBets, checkAndAwardJackpot } from '../../../../lib/matchRecord/settlement';
import { performMatchNotifications } from '../../../../lib/matchRecord/notifier';

export async function POST(request: Request) {
  try {
    // ===== 1. 認証 =====
    const hasBotSecret = !!request.headers.get('x-bot-secret');
    if (hasBotSecret) {
      const botAuth = verifyBotSecret(request);
      if (!botAuth.ok) {
        return NextResponse.json(
          { error: botAuth.error || 'Unauthorized (invalid bot secret)' },
          { status: 401 }
        );
      }
    } else {
      const adminAuth = await verifyAdminSession(request);
      if (!adminAuth.ok) {
        return NextResponse.json(
          { error: adminAuth.error || '管理者セッションが無効または未ログインです。/login から管理者としてログインしてください。' },
          { status: 401 }
        );
      }
    }

    // ===== 2. 入力バリデーション（エッジケース検証） =====
    const body: MatchRecordBody = await request.json();
    const valResult = validateMatchRecordInput(body);
    if (!valResult.ok) {
      return NextResponse.json({ error: valResult.error }, { status: 400 });
    }

    const { winningTeam, gameDuration, participants, riotMatchId, balanceSatisfaction, isExhibition, isFinalMatch, dry_run } = body;
    const names = participants.map(p => p.name);

    // プレイヤー名簿の取得と重複解決
    const { data: rawDbPlayers, error: pError } = await supabase
      .from('ktm_players')
      .select('*')
      .in('name', names);

    if (pError || !rawDbPlayers) {
      return NextResponse.json({ error: 'プレイヤー情報の取得に失敗しました。' }, { status: 500 });
    }

    const playerRes = resolveAndValidateDbPlayers(rawDbPlayers, names);
    if (!playerRes.ok || !playerRes.dbPlayersMap) {
      return NextResponse.json({ error: playerRes.error }, { status: 400 });
    }
    const dbPlayers = names.map(n => playerRes.dbPlayersMap!.get(n)!);

    // ===== 3. MMR・スタッツ計算 =====
    const { data: historyData, error: hError } = await fetchAllRows((from, to) =>
      supabase
        .from('ktm_match_participants')
        .select('match_id, player_name, team, role, ktm_matches!inner(winning_team)')
        .in('player_name', names)
        .range(from, to)
    );

    if (hError) {
      return NextResponse.json({ error: `過去の試合履歴の取得に失敗しました: ${hError.message}` }, { status: 500 });
    }

    const calculatedPlayers = calculateMatchParticipantsMmr({
      participants,
      winningTeam,
      gameDuration,
      isExhibition: !!isExhibition,
      dbPlayers,
      historyData: historyData || []
    });

    // 🛡️ DRY_RUN ガード
    if (dry_run) {
      return NextResponse.json({
        success: true,
        matchId: 'dry-run-match-id',
        message: '【DRY RUN】シミュレーション完了（DB書き込み・Discord通知は安全にスキップされました）',
        results: calculatedPlayers.map((r: any) => ({
          name: r.name,
          role: r.role,
          team: r.team,
          mmrDelta: r.mmrDelta,
          newMmr: r.currentMmr + r.mmrDelta
        }))
      });
    }

    // 二重記録防止シグネチャ判定（直近30分以内の同一10名・同一KDA）
    {
      const sig = (rows: Array<{ player_name?: string; name?: string; team: string; kills: any; deaths: any; assists: any }>) =>
        rows
          .map((p) => `${p.player_name ?? p.name}|${p.team}|${Number(p.kills) || 0}/${Number(p.deaths) || 0}/${Number(p.assists) || 0}`)
          .sort()
          .join(',');
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recentMatches } = await supabase
        .from('ktm_matches')
        .select('id, ktm_match_participants(player_name, team, kills, deaths, assists)')
        .gte('created_at', since);
      const mySig = sig(calculatedPlayers);
      const dup = (recentMatches || []).find((m: any) => sig(m.ktm_match_participants || []) === mySig);
      if (dup) {
        return NextResponse.json(
          { error: `この試合は既に記録されています（試合ID: ${dup.id}）。二重に記録されないよう保存を止めました。`, matchId: dup.id },
          { status: 409 }
        );
      }
    }

    // 全プレイヤーの最終精算値（レーン波及・Pity・コイン）を計算
    const settledResults = await computePlayerSettlement(calculatedPlayers, winningTeam, !!isExhibition);

    // ===== 4. DB永続化 =====
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

    // 待機プレイヤーのPity加算 ＆ balancer_pending 掃除
    try {
      const pNames = new Set(names);
      const nameOf = (p: any) => (typeof p === 'string' ? p : p?.name);
      const { data: pendings } = await supabase
        .from('edge_tasks')
        .select('payload')
        .eq('task_type', 'balancer_pending')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(30);

      const used = (pendings || []).find((t: any) => {
        const br = t.payload?.balanceResult || {};
        const team = [...(br.teamBlue || []), ...(br.teamRed || [])].map(nameOf).filter(Boolean);
        return team.length === pNames.size && team.every((n: string) => pNames.has(n));
      });

      const specNames = Array.from(new Set(
        ((used?.payload?.balanceResult?.spectators || []) as any[]).map(nameOf).filter((n: any) => n && !pNames.has(n))
      )) as string[];

      if (specNames.length > 0) {
        const { data: specPlayers } = await supabase
          .from('ktm_players')
          .select('name, is_spectator_fixed, is_active')
          .in('name', specNames);
        const eligible = (specPlayers || [])
          .filter((p: any) => p.is_spectator_fixed !== true && p.is_active !== false)
          .map((p: any) => p.name);
        if (eligible.length > 0) {
          await supabase.rpc('increment_ktm_spectator_pity', { p_names: eligible, p_amount: 10 }).catch(() => {});
        }
      }

      await supabase
        .from('edge_tasks')
        .delete()
        .eq('task_type', 'balancer_pending')
        .eq('status', 'pending')
        .lte('created_at', new Date().toISOString())
        .catch(() => {});
    } catch (e) {
      console.warn('[match/record] 待機者Pity処理スキップ:', e);
    }

    // 参加者10人分INSERT
    await insertMatchParticipants(supabase, newMatchId, settledResults);

    // ktm_players更新 ＆ コイン台帳記録
    await updatePlayersMmrAndCoins(supabase, newMatchId, settledResults, winningTeam, !!isExhibition);

    // 予測勝率の突き合わせ（balancer_predictions）
    let settledRoundId: string | number | null = null;
    try {
      const blueNames = new Set(settledResults.filter(r => r.team === 'BLUE').map(r => r.name));
      const redNames = new Set(settledResults.filter(r => r.team === 'RED').map(r => r.name));
      const setEq = (a: Set<string>, b: string[]) => a.size === b.length && b.every((n) => a.has(n));

      const { data: preds } = await supabase
        .from('balancer_predictions')
        .select('*')
        .is('match_id', null)
        .order('created_at', { ascending: false })
        .limit(20);

      const match = (preds || []).find((p: any) => {
        const pb: string[] = p.blue_players || [];
        const pr: string[] = p.red_players || [];
        return (setEq(blueNames, pb) && setEq(redNames, pr)) || (setEq(blueNames, pr) && setEq(redNames, pb));
      });

      if (match) {
        settledRoundId = match.id ?? null;
        const swapped = !(setEq(blueNames, match.blue_players || []));
        const actualBlueWon = winningTeam === 'BLUE';
        const predictedBlueWon = Number(match.predicted_blue_winprob) >= 0.5;
        const savedBlueActuallyWon = swapped ? !actualBlueWon : actualBlueWon;
        const correct = predictedBlueWon === savedBlueActuallyWon;

        await supabase
          .from('balancer_predictions')
          .update({ match_id: newMatchId, actual_winner: winningTeam, correct })
          .eq('id', match.id);

        const { reviewBalancerPredictionAccuracy } = await import('../../../../lib/balancer');
        await reviewBalancerPredictionAccuracy(supabase).catch(() => {});
      }
    } catch (predErr) {
      console.warn('[match/record] 予測突き合わせスキップ:', predErr);
    }

    // 勝敗予想ベット精算
    const payoutWinners = await settleMatchBets(supabase, newMatchId, winningTeam, settledRoundId);

    // ジャックポット判定（ペンタキル勝利）
    const jackpotWinner = await checkAndAwardJackpot(supabase, newMatchId, settledResults, winningTeam, !!isExhibition);

    // ===== 5. Discord通知・副作用（非同期） =====
    const statsMap: Record<string, any> = {};
    names.forEach(name => {
      statsMap[name] = { totalGames: (historyData || []).filter((h: any) => h.player_name === name).length };
    });

    await performMatchNotifications({
      supabase,
      newMatchId,
      winningTeam,
      results: settledResults,
      gameDuration,
      isExhibition: !!isExhibition,
      isFinalMatch,
      balanceSatisfaction,
      payoutWinners,
      statsMap,
      afterHook: after
    });

    return NextResponse.json({ success: true, matchId: newMatchId, updates: settledResults, jackpotWinner });

  } catch (error: any) {
    console.error('Record Match Error:', error);
    const { reportApiError } = await import('../../../../lib/apiHandler');
    reportApiError({ route: '/api/match/record', error });
    return NextResponse.json({ error: '試合の記録中にエラーが発生しました。' }, { status: 500 });
  }
}
