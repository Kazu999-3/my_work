import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { performFullMmrRebuild } from '../../../../../lib/mmr';
import { computePityAfterMatch, computeSettleCoins } from '../../../../../lib/matchSettlement';
import { getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../../lib/playerCoins';
import { buildMatchupField, isMatchupField, resultEmbedColor } from '../../../../../lib/matchResultMessage';

/**
 * 編集後の内容（名前・勝敗・リビルド後の MMR 増減）で Discord の試合結果メッセージを書き換える（2026-10-17）。
 * 対戦表フィールドは作り直し、号外など他のフィールドは差し替えた名前だけ置き換える。
 * 結果メッセージ ID が分からない試合（2026-10-17 より前で予測行も無いもの）は何もしない。
 */
async function refreshResultMessage(matchId: string, renamed: Map<string, string>) {
  const webhookUrl = process.env.DISCORD_KTM_WEBHOOK_URL;
  if (!webhookUrl) return 'Webhook 未設定';
  const { data: match } = await supabase
    .from('ktm_matches').select('winning_team, riot_match_id, result_message_id').eq('id', matchId).maybeSingle();
  let messageId: string | null = match?.result_message_id || null;
  if (!messageId) {
    const { data: pred } = await supabase
      .from('balancer_predictions').select('result_message_id').eq('match_id', matchId).maybeSingle();
    messageId = pred?.result_message_id || null;
  }
  if (!match || !messageId) return '結果メッセージが特定できないため未更新';

  const [{ data: rows }, { data: ledger }] = await Promise.all([
    supabase.from('ktm_match_participants')
      .select('player_name, team, role, champion_name, kills, deaths, assists, mmr_delta').eq('match_id', matchId),
    supabase.from('coin_transactions').select('player_name, metadata')
      .eq('reason', 'match_settle').eq('metadata->>matchId', matchId),
  ]);
  const doublers = new Set((ledger || []).filter((t: any) => t.metadata?.hasVictoryDoubler === true).map((t: any) => t.player_name));

  const msgUrl = `${webhookUrl}/messages/${messageId}`;
  const res = await fetch(msgUrl);
  if (!res.ok) return `結果メッセージの取得に失敗（${res.status}）`;
  const msg = await res.json();
  const embed = msg.embeds?.[0];
  if (!embed) return '結果メッセージに Embed が無いため未更新';

  const renameText = (s: string) => {
    let out = s;
    renamed.forEach((to, from) => { out = out.split(from).join(to); });
    return out;
  };
  const matchupField = buildMatchupField(
    (rows || []).map((r: any) => ({
      name: r.player_name, team: r.team, role: r.role, champion_name: r.champion_name,
      kills: r.kills || 0, deaths: r.deaths || 0, assists: r.assists || 0, mmrDelta: r.mmr_delta || 0,
      hasVictoryDoubler: doublers.has(r.player_name),
    })),
    match.winning_team,
    match.riot_match_id === 'EXHIBITION'
  );
  const fields = (embed.fields || []).map((f: any) =>
    isMatchupField(f) ? matchupField : { ...f, name: renameText(f.name), value: renameText(f.value) }
  );
  const patch = await fetch(msgUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [{ ...embed, color: resultEmbedColor(match.winning_team), fields }] }),
  });
  return patch.ok ? '結果メッセージも更新' : `結果メッセージの更新に失敗（${patch.status}）`;
}

type Slot = { role: string; team: string; player_name: string; discord_id: string | null };

/**
 * 試合の編集（勝敗の入れ替え・参加者の差し替え）に合わせて、コインと Pity を付け替える（2026-10-17）。
 * それまで編集で直るのは MMR・試合数（自動リビルド）だけで、コインと Pity は元の人に残っていた。
 * - コイン: その試合の精算として各人に払った額（台帳の match_settle / match_settle_correction の合計）と、
 *   編集後の内容で本来払う額を比べて差額を調整する。台帳開始(2026-09-22)前の試合は支払い記録が無いので対象外。
 * - Pity: 「今の状態」なので、編集したのが一番新しい試合の時だけ、入れ替わった枠の元の人から戻し新しい人に付ける。
 *   元の人が第1希望で出ていた場合（-2 消費）は元の値が分からないため戻さない。
 */
async function reconcileSettlement(matchId: string, oldSlots: Slot[], newSlots: Slot[], winningTeam: string) {
  const ids = Array.from(new Set([...oldSlots, ...newSlots].map((s) => s.discord_id).filter(Boolean))) as string[];
  const names = Array.from(new Set([...oldSlots, ...newSlots].map((s) => s.player_name).filter(Boolean)));
  const [{ data: byId }, { data: byName }] = await Promise.all([
    ids.length ? supabase.from('ktm_players').select('*').in('discord_id', ids) : Promise.resolve({ data: [] as any[] }),
    supabase.from('ktm_players').select('*').in('name', names),
  ]);
  const resolve = (s: Slot): any =>
    (s.discord_id && (byId || []).find((p: any) => p.discord_id === s.discord_id)) ||
    (byName || []).find((p: any) => p.name === s.player_name) || null;
  const summary: string[] = [];

  // ---- コイン ----
  const { data: ledger } = await supabase
    .from('coin_transactions')
    .select('player_id, delta, reason, metadata')
    .in('reason', ['match_settle', 'match_settle_correction'])
    .eq('metadata->>matchId', matchId);
  if ((ledger || []).some((t: any) => t.reason === 'match_settle')) {
    const people = new Map<number, any>();
    for (const s of [...oldSlots, ...newSlots]) { const p = resolve(s); if (p) people.set(p.id, p); }
    for (const player of Array.from(people.values())) {
      const rows = (ledger || []).filter((t: any) => t.player_id === player.id);
      const paid = rows.reduce((a: number, t: any) => a + (Number(t.delta) || 0), 0);
      const usedDoubler = rows.some((t: any) => t.metadata?.hasVictoryDoubler === true);
      const slot = newSlots.find((s) => resolve(s)?.id === player.id);
      let expected = 0;
      if (slot) {
        const prefs = player.role_preferences || {};
        const isAll = prefs.primary === 'ALL' || prefs.primary === 'FILL' || !prefs.primary;
        expected = computeSettleCoins({ isWin: slot.team === winningTeam, allRoleBonusCoins: isAll ? 50 : 0, usedVictoryDoubler: usedDoubler });
      }
      const diff = expected - paid;
      if (diff === 0) continue;
      await updatePlayerCoinsAndInventory({
        player,
        newCoins: getPlayerCoins(player) + diff,
        reason: 'match_settle_correction',
        reasonMetadata: { matchId, note: '試合の編集による精算の訂正', paid, expected },
      });
      summary.push(`${player.name} ${diff > 0 ? '+' : ''}${diff}🪙`);
    }
  }

  // ---- Pity（一番新しい試合を編集した時だけ） ----
  const { data: match } = await supabase.from('ktm_matches').select('created_at').eq('id', matchId).maybeSingle();
  const { count: newer } = await supabase
    .from('ktm_matches').select('id', { count: 'exact', head: true }).gt('created_at', match?.created_at || '9999');
  if ((newer ?? 1) === 0) {
    for (const ns of newSlots) {
      const os = oldSlots.find((o) => o.role === ns.role && o.team === ns.team);
      const oldP = os ? resolve(os) : null;
      let newP = resolve(ns);
      if (!newP || oldP?.id === newP.id) continue;
      // 元の人: この試合で付いた増分を戻す（第1希望 -2 消費は元の値が不明なので戻さない）
      if (oldP && os) {
        const prefs = oldP.role_preferences || {};
        const inc = computePityAfterMatch({
          primary: prefs.primary, secondary: prefs.secondary, ng1: oldP.ng_lane_1, ng2: oldP.ng_lane_2,
          playedRole: os.role, pity: 0, offRolePity: 0, consecutiveSecondary: 0,
        });
        if (inc.kind !== 'PRIMARY') {
          await supabase.from('ktm_players').update({
            pity: Math.max(0, (Number(oldP.pity) || 0) - inc.pity),
            off_role_pity: Math.max(0, (Number(oldP.off_role_pity) || 0) - inc.offRolePity),
          }).eq('id', oldP.id);
          summary.push(`${oldP.name} Pity -${inc.pity}`);
        }
      }
      // 新しい人: 本来付く分を付ける。上のコイン訂正で metadata.coins が変わっているので、書く直前に読み直す
      const { data: fresh } = await supabase.from('ktm_players').select('*').eq('id', newP.id).maybeSingle();
      if (!fresh) continue;
      newP = fresh;
      const prefs = newP.role_preferences || {};
      const meta = newP.metadata || {};
      const res = computePityAfterMatch({
        primary: prefs.primary, secondary: prefs.secondary, ng1: newP.ng_lane_1, ng2: newP.ng_lane_2,
        playedRole: ns.role, pity: Number(newP.pity) || 0, offRolePity: Number(newP.off_role_pity) || 0,
        consecutiveSecondary: Number(meta.consecutive_secondary) || 0,
      });
      await supabase.from('ktm_players').update({
        pity: res.pity, off_role_pity: res.offRolePity, spectator_pity: 0,
        metadata: { ...meta, consecutive_secondary: res.consecutiveSecondary },
      }).eq('id', newP.id);
      summary.push(`${newP.name} Pity ${res.pity}`);
    }
  }
  return summary;
}


export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const resolvedParams = await params;
    const matchId = resolvedParams.id;
    if (!matchId) {
      return NextResponse.json({ error: '無効なマッチIDです。' }, { status: 400 });
    }

    const { winningTeam, participants } = await request.json();

    if (!winningTeam || !participants || participants.length !== 10) {
      return NextResponse.json({ error: '入力データが不正です。10人の参加者と勝利チームが必要です。' }, { status: 400 });
    }

    // 編集前の参加者（コイン・Pity の付け替えで「元の人」を知るため）
    const { data: oldRows, error: oldErr } = await supabase
      .from('ktm_match_participants')
      .select('role, team, player_name, discord_id')
      .eq('match_id', matchId);
    if (oldErr) {
      throw new Error(`編集前の参加者の取得に失敗: ${oldErr.message}`);
    }

    // 1. ktm_matches の更新
    const { error: matchError } = await supabase
      .from('ktm_matches')
      .update({ winning_team: winningTeam })
      .eq('id', matchId);

    if (matchError) {
      throw new Error(`試合レコードの更新に失敗: ${matchError.message}`);
    }

    // 2. ktm_match_participants の更新
    // 以前は10人分をforループで1件ずつ逐次UPDATE(N+1)していたが、
    // update_match_participants_batch(RPC)でmatch_id×role×teamを突き合わせた
    // 単一のUPDATE文にまとめる(migration 49)。値の計算自体はここで行い、
    // 計算済みの配列をそのままDB側へ渡す。
    const participantRows = participants.map((p: any) => ({
      role: p.role,
      team: p.team,
      player_name: p.player_name,
      kills: Number(p.kills) || 0,
      deaths: Number(p.deaths) || 0,
      assists: Number(p.assists) || 0,
      champion_name: p.champion_name || null,
      kda_score: Number(p.deaths) === 0 ? (Number(p.kills) + Number(p.assists)) * 1.2 : Number(((Number(p.kills) + Number(p.assists)) / Number(p.deaths)).toFixed(2)),
      cs: p.cs !== undefined ? Number(p.cs) : null,
      // 0・空欄は「記録なし」（null）。記録画面と同じ扱い（2026-10-18）
      gold: Number(p.gold) > 0 && Number(p.gold) < 100000 ? Math.round(Number(p.gold)) : null,
      damage_dealt: p.damage_dealt !== undefined ? Number(p.damage_dealt) : null,
      vision_score: p.vision_score !== undefined ? Number(p.vision_score) : null,
      mmr_delta: p.mmr_delta !== undefined ? Number(p.mmr_delta) : 0,
    }));

    const { error: partError } = await supabase.rpc('update_match_participants_batch', {
      p_match_id: matchId,
      p_participants: participantRows,
    });
    if (partError) {
      throw new Error(`参加者データの更新に失敗: ${partError.message}`);
    }

    // 名前を差し替えた行の discord_id も新しい名前の人に合わせる。
    // 2026-10-17: 上の一括更新は player_name しか書かず discord_id が元の人のまま残っていた。リビルドは
    // discord_id を優先して人を引くため、名前を「エマ*fam」に直しても MMR・試合数は「ﾀﾛｽ」に付いたままだった。
    // 名簿に無い名前（ゲスト）は discord_id を外す（元の人に紐づけたままにしない）。
    const names = Array.from(new Set(participants.map((p: any) => p.player_name).filter(Boolean)));
    const { data: rosterRows, error: rosterErr } = await supabase
      .from('ktm_players')
      .select('name, discord_id')
      .in('name', names);
    if (rosterErr) {
      throw new Error(`名簿の取得に失敗: ${rosterErr.message}`);
    }
    const discordByName = new Map((rosterRows || []).map((r: any) => [r.name, r.discord_id || null]));
    for (const p of participants) {
      const { error: idErr } = await supabase
        .from('ktm_match_participants')
        .update({ discord_id: discordByName.get(p.player_name) ?? null })
        .eq('match_id', matchId)
        .eq('role', p.role)
        .eq('team', p.team);
      if (idErr) {
        throw new Error(`参加者の紐付け更新に失敗: ${idErr.message}`);
      }
    }

    // コイン・Pity の付け替え（失敗しても編集自体は確定させ、MMR は下のリビルドで直す）
    let settlementSummary: string[] = [];
    try {
      const newSlots: Slot[] = participants.map((p: any) => ({
        role: p.role, team: p.team, player_name: p.player_name,
        discord_id: discordByName.get(p.player_name) ?? null,
      }));
      settlementSummary = await reconcileSettlement(matchId, (oldRows || []) as Slot[], newSlots, winningTeam);
    } catch (settleErr) {
      console.error('[admin/match] コイン・Pity の付け替えに失敗（編集とMMR再計算は続行）:', settleErr);
    }

    // #28: 試合内容の編集でMMRがズレるため、編集後に自動Rebuild（保存値＝導出値を維持）
    await performFullMmrRebuild(supabase);

    // Discord の試合結果メッセージも編集後の内容に合わせる（失敗しても編集は確定させる）
    let messageNote = '';
    try {
      const renamed = new Map<string, string>();
      for (const p of participants) {
        const old = (oldRows || []).find((o: any) => o.role === p.role && o.team === p.team);
        if (old?.player_name && p.player_name && old.player_name !== p.player_name) renamed.set(old.player_name, p.player_name);
      }
      messageNote = await refreshResultMessage(matchId, renamed);
    } catch (msgErr) {
      console.error('[admin/match] 結果メッセージの更新に失敗（編集は確定）:', msgErr);
      messageNote = '結果メッセージの更新に失敗';
    }

    return NextResponse.json({
      success: true,
      message: '試合結果を更新し、MMRを再計算しました。' +
        (settlementSummary.length ? `（精算の訂正: ${settlementSummary.join(' / ')}）` : '') +
        (messageNote ? `［${messageNote}］` : ''),
    });
  } catch (error: any) {
    console.error('Update Match Error:', error);
    return NextResponse.json({ error: error.message || '試合の更新中にエラーが発生しました。' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  // ===== 管理者セッション確認（PUTにはあったがDELETEに無かったため追加） =====
  const authResult = await verifyAdminSession(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const resolvedParams = await params;
    const matchId = resolvedParams.id;
    if (!matchId) {
      return NextResponse.json({ error: '無効なマッチIDです。' }, { status: 400 });
    }

    // CASCADE制約がない場合に備えて、まず参加者レコードから削除
    const { error: partError } = await supabase
      .from('ktm_match_participants')
      .delete()
      .eq('match_id', matchId);

    if (partError) {
      throw new Error(`参加者データの削除に失敗: ${partError.message}`);
    }

    // 試合本体レコードを削除
    const { error: matchError } = await supabase
      .from('ktm_matches')
      .delete()
      .eq('id', matchId);

    if (matchError) {
      throw new Error(`試合レコードの削除に失敗: ${matchError.message}`);
    }

    // #28: 試合削除でMMRがズレるため、削除後に自動Rebuild
    await performFullMmrRebuild(supabase);

    return NextResponse.json({ success: true, message: '試合レコードを削除し、MMRを再計算しました。' });
  } catch (error: any) {
    console.error('Delete Match Error:', error);
    return NextResponse.json({ error: error.message || '試合の削除中にエラーが発生しました。' }, { status: 500 });
  }
}
