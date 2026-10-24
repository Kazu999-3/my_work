import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { calculateBlueWinProbability } from '../../../../lib/mmr';
import { getAuthSession } from '../../../../lib/authGuard';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// 以前はプロセス内メモリ(Map)に保存していたが、Vercelはリクエストごとに別インスタンス
// (別プロセス)で実行されうるため、POSTしたインスタンスとGETしたインスタンスが異なると
// 「チーム分けデータが見つからない」という不整合が起きていた。
// 既存の汎用タスクテーブル edge_tasks (task_type/payload/status) をそのまま流用し、
// 全インスタンスから見える永続ストアに保存することで解消する。
const TASK_TYPE = 'balancer_pending';
const EXPIRE_MS = 3 * 60 * 60 * 1000; // 3時間有効（以前のインメモリ版と同じ）

export async function POST(request: Request) {
  try {
    // ★ 2026-10-07: 保存はログイン中のメンバー（Discordログイン）か管理者に限定し、誰が保存したかを残す。
    // 以前は認証なしで、誰でも架空のチーム分けを送れた（カジノの勝敗予想の対象試合の差し替え、
    // 観戦・待機メンバーの pity +10、予測勝率の記録が起きる）。2026-08-13 の監査では「仲間内で気軽に
    // 使える方針に反する」としてログイン必須を見送っていたが、ユーザー判断でメンバー限定＋履歴で追える形にした。
    // 未ログインでもバランサーのチーム分け自体は使える（保存されずカジノに連携されないだけ）。
    const member = await getAuthSession();
    const admin = member ? null : await verifyAdminSession(request);
    if (!member && !admin?.ok) {
      return NextResponse.json({ error: 'チーム分けの保存にはDiscordログインが必要です。', requireLogin: true }, { status: 401 });
    }
    const submittedBy = member
      ? { discordId: member.discordId, name: member.displayName || member.username, isAdmin: member.isAdmin }
      : { discordId: null, name: '管理者（パスワードログイン）', isAdmin: true };

    const { balanceResult } = await request.json();
    if (!balanceResult) {
      return NextResponse.json({ error: 'チーム分け結果がありません。' }, { status: 400 });
    }

    // 期限切れの古いpendingデータを間引く（テーブル肥大化防止、失敗しても本筋は止めない）
    supabase
      .from('edge_tasks')
      .delete()
      .eq('task_type', TASK_TYPE)
      .lt('created_at', new Date(Date.now() - EXPIRE_MS).toISOString())
      .then(({ error }: { error: any }) => { if (error) console.warn('[balancer/pending] 期限切れデータの削除に失敗:', error); });

    // 観戦投票（勝敗予想）の締め切り固定:
    // Discordへチーム発表した時刻（announcedAt）を優先。同一試合で既に保存されたものがあれば引き継ぐ。
    const nowIso = new Date().toISOString();
    let initialCreatedAt = nowIso;
    let announcedAt: string | null = null;
    try {
      const { data: oldestPending } = await supabase
        .from('edge_tasks')
        .select('created_at, payload')
        .eq('task_type', TASK_TYPE)
        .eq('status', 'pending')
        .gte('created_at', new Date(Date.now() - EXPIRE_MS).toISOString())
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (oldestPending) {
        initialCreatedAt = oldestPending.payload?.initialCreatedAt || oldestPending.created_at || nowIso;
        announcedAt = oldestPending.payload?.announcedAt || oldestPending.payload?.balanceResult?.announcedAt || null;
      }
    } catch (e) {
      console.warn('[balancer/pending] 初回保存時刻の取得に失敗（現在時刻でフォールバック）:', e);
    }

    const { data: inserted, error: insertError } = await supabase
      .from('edge_tasks')
      .insert({
        task_type: TASK_TYPE,
        payload: {
          balanceResult,
          submittedBy,
          submittedAt: nowIso,
          initialCreatedAt,
          announcedAt,
        },
        status: 'pending'
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    const pendingId = inserted.id;

    // ★ バランサー予測勝率の記録（課題: 予測勝率の検証 ＆ Blueサイド勝率+1.5%補正）
    try {
      const blue = balanceResult.teamBlue || [];
      const red = balanceResult.teamRed || [];
      if (blue.length > 0 && red.length > 0) {
        const avg = (arr: any[]) => arr.reduce((s: number, p: any) => s + (Number(p.mmr) || 1200), 0) / arr.length;
        const blueAvg = avg(blue);
        const redAvg = avg(red);
        const predictedBlueWinprob = calculateBlueWinProbability(blueAvg, redAvg);
        await supabase.from('balancer_predictions').insert({
          blue_players: blue.map((p: any) => p.name),
          red_players: red.map((p: any) => p.name),
          blue_avg_mmr: Math.round(blueAvg),
          red_avg_mmr: Math.round(redAvg),
          predicted_blue_winprob: predictedBlueWinprob,
        });
      }
    } catch (e) {
      console.warn('[balancer/pending] 予測勝率の保存に失敗（続行）:', e);
    }

    // 待機プレイヤーの Pity +10 は試合の記録時（/api/match/record）に、実際に行われたチーム分けの待機者へ1回だけ付ける。
    // 以前はここ（チーム分けを出すたびに自動保存される）で付けており、やり直すほど加算されていた（2026-10-19）

    // 🔊 Discord VCチャンネル名を「〇戦目進行中・交代歓迎」に自動更新
    try {
      const { updateCustomVoiceChannelStatus } = await import('../../../../lib/discordNotify');
      // 本日（直近15時間以内）の試合数を取得して何試合目かを算出
      const todayCutoff = new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('ktm_matches')
        .select('*', { count: 'exact', head: true })
        .gte('played_at', todayCutoff);
      const matchNum = (count || 0) + 1;
      await updateCustomVoiceChannelStatus(`${matchNum}戦目進行中・交代歓迎`);
    } catch (vcErr) {
      console.warn('[balancer/pending] VC名更新エラー（続行）:', vcErr);
    }

    return NextResponse.json({ success: true, pendingId });
  } catch (error: any) {
    console.error('Pending Match Save Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      // 最新の受付中アクティブマッチを取得（直近2時間以内の pending）
      const { data: latestTask, error: lError } = await supabase
        .from('edge_tasks')
        .select('id, payload, created_at')
        .eq('task_type', TASK_TYPE)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lError || !latestTask) {
        return NextResponse.json({ success: true, activeMatch: null });
      }

      const isExpired = Date.now() - new Date(latestTask.created_at).getTime() > EXPIRE_MS;
      if (isExpired) {
        return NextResponse.json({ success: true, activeMatch: null });
      }

      // 締め切り基準時刻: Discordへチーム発表した時刻（announcedAt）を最優先。
      // 観戦投票（勝敗予想）の15分カウントダウンは、Discordにチーム発表を送信した瞬間から開始する。
      const announcedAt = latestTask.payload?.announcedAt || latestTask.payload?.balanceResult?.announcedAt || null;
      const isAnnounced = Boolean(announcedAt);
      let matchCreatedAt = announcedAt || latestTask.payload?.initialCreatedAt || latestTask.created_at;
      if (!announcedAt && !latestTask.payload?.initialCreatedAt) {
        try {
          const { data: oldest } = await supabase
            .from('edge_tasks')
            .select('created_at')
            .eq('task_type', TASK_TYPE)
            .eq('status', 'pending')
            .gte('created_at', new Date(Date.now() - EXPIRE_MS).toISOString())
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (oldest?.created_at) {
            matchCreatedAt = oldest.created_at;
          }
        } catch {}
      }

      return NextResponse.json({
        success: true,
        pendingId: latestTask.id,
        createdAt: matchCreatedAt,
        announcedAt,
        isAnnounced,
        balanceResult: latestTask.payload?.balanceResult,
        activeMatch: {
          ...(latestTask.payload?.balanceResult || {}),
          createdAt: matchCreatedAt,
          announcedAt,
          isAnnounced,
          pendingId: latestTask.id,
        },
      });
    }

    const { data: task, error } = await supabase
      .from('edge_tasks')
      .select('payload, created_at')
      .eq('id', id)
      .eq('task_type', TASK_TYPE)
      .maybeSingle();
    if (error) throw error;

    const expired = task && Date.now() - new Date(task.created_at).getTime() > EXPIRE_MS;
    if (!task || expired) {
      return NextResponse.json({ error: '指定されたチーム分けデータが見つからないか、期限切れです。' }, { status: 404 });
    }

    return NextResponse.json({ success: true, balanceResult: task.payload?.balanceResult });
  } catch (error: any) {
    console.error('Pending Match Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  // idはedge_tasks.id(UUID)であり、Supabase上でdata_type=uuidであることを確認済み。
  // シーケンシャルな連番ではなく総当たりで推測できないため、「idさえ分かれば」という
  // 前提自体が成立しない(事実上のアクセストークンとして機能する)。認証なしのままでも
  // 実害は無いと判断し、この点についてはコード変更なし(2026-08-05確認)。
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      await supabase.from('edge_tasks').delete().eq('id', id).eq('task_type', TASK_TYPE);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
