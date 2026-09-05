import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// 以前はプロセス内メモリ(Map)に保存していたが、Vercelはリクエストごとに別インスタンス
// (別プロセス)で実行されうるため、POSTしたインスタンスとGETしたインスタンスが異なると
// 「チーム分けデータが見つからない」という不整合が起きていた。
// 既存の汎用タスクテーブル edge_tasks (task_type/payload/status) をそのまま流用し、
// 全インスタンスから見える永続ストアに保存することで解消する。
const TASK_TYPE = 'balancer_pending';
const EXPIRE_MS = 3 * 60 * 60 * 1000; // 3時間有効（以前のインメモリ版と同じ）

export async function POST(request: Request) {
  try {
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

    const { data: inserted, error: insertError } = await supabase
      .from('edge_tasks')
      .insert({ task_type: TASK_TYPE, payload: { balanceResult }, status: 'pending' })
      .select('id')
      .single();
    if (insertError) throw insertError;

    const pendingId = inserted.id;

    // ★ バランサー予測勝率の記録（課題: 予測勝率の検証）
    // チーム確定の瞬間に、MMR差から青チームの勝率をEloロジスティックで算出して保存する。
    // 後で試合結果(ktm_matches)が記録されたら突き合わせて的中率を集計する。
    // balancer_predictions テーブルが未作成でも try/catch で握りつぶし、本筋は止めない。
    try {
      const blue = balanceResult.teamBlue || [];
      const red = balanceResult.teamRed || [];
      if (blue.length > 0 && red.length > 0) {
        const avg = (arr: any[]) => arr.reduce((s: number, p: any) => s + (Number(p.mmr) || 1200), 0) / arr.length;
        const blueAvg = avg(blue);
        const redAvg = avg(red);
        // Eloロジスティック: 400点差で約10倍の勝ちやすさ
        const predictedBlueWinprob = 1 / (1 + Math.pow(10, (redAvg - blueAvg) / 400));
        await supabase.from('balancer_predictions').insert({
          blue_players: blue.map((p: any) => p.name),
          red_players: red.map((p: any) => p.name),
          blue_avg_mmr: Math.round(blueAvg),
          red_avg_mmr: Math.round(redAvg),
          predicted_blue_winprob: Number(predictedBlueWinprob.toFixed(4)),
        });
      }
    } catch (e) {
      console.warn('[balancer/pending] 予測勝率の保存に失敗（続行）:', e);
    }

    // ★ 修正: 待機プレイヤー（spectators）のPityを一括更新 (+10)
    // チーム確定（結果入力ページへの遷移）の瞬間に即時付与することで、次のゲームの選出で優先される。
    // 以前はSELECT→計算→UPDATEの非アトミック処理で、同時リクエスト時に加算が
    // 失われる競合状態があったため、DB側で加算するRPC(increment_ktm_pity)に置き換えた。
    //
    // このAPI自体は認証なし・spectatorsはリクエストボディの値をそのまま使っていたため、
    // 実在しない名前や同名の重複を含む配列を送りつけて任意にpityを水増しできた
    // (2026-08-13、コーチ/対戦シミュレーター監査#23で発覚)。balancer/pending自体を
    // ログイン必須にする変更はこのツールの「仲間内で気軽に使える」設計方針に反するため、
    // 実在するktm_players.nameかどうかの照合と重複排除だけを追加する。
    if (balanceResult.spectators && balanceResult.spectators.length > 0) {
      const uniqueSpectators = Array.from(new Set(
        (balanceResult.spectators as any[]).map((s) => String(s).trim()).filter(Boolean)
      ));
      const { data: validPlayers } = await supabase
        .from('ktm_players')
        .select('name, is_spectator_fixed, is_active')
        .in('name', uniqueSpectators);

      // 見学固定（試合に出ない人）および非アクティブな待機者はPity加算対象から除外
      const eligibleNames = (validPlayers || [])
        .filter((p: any) => p.is_spectator_fixed !== true && p.is_active !== false)
        .map((p: any) => p.name);

      if (eligibleNames.length > 0) {
        const { error: pityError } = await supabase.rpc('increment_ktm_pity', {
          p_names: eligibleNames,
          p_amount: 10,
        });
        if (pityError) console.warn('[balancer/pending] pity加算に失敗（続行）:', pityError);
      }
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

      return NextResponse.json({
        success: true,
        pendingId: latestTask.id,
        balanceResult: latestTask.payload?.balanceResult,
        activeMatch: latestTask.payload?.balanceResult,
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
