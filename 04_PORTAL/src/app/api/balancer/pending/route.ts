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
    // チーム確定（結果入力ページへの遷移）の瞬間に即時付与することで、次のゲームの選出で優先される
    if (balanceResult.spectators && balanceResult.spectators.length > 0) {
      for (const name of balanceResult.spectators) {
        const { data: pData } = await supabase
          .from('ktm_players')
          .select('pity')
          .eq('name', name)
          .single();

        const nextPity = (Number(pData?.pity) || 0) + 10;
        await supabase
          .from('ktm_players')
          .update({ pity: nextPity })
          .eq('name', name);
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
      return NextResponse.json({ error: 'IDが指定されていません。' }, { status: 400 });
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
