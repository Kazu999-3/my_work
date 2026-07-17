import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// ============================================================
// バランス満足度の集計 (課題#42)
//
// Cloudflare Workers(HTTPインタラクション型)のbotはリアクション追加イベントを
// 受信できないため、試合結果メッセージの👍/👎数を「後からポーリングして数える」方式。
// このエンドポイントは result_message_id を持つ予測行のリアクション数を取得し、
// satisfaction_up/down を更新して満足度の集計値を返す。
// 呼び出し: 管理者ログイン状態で GET /api/admin/satisfaction-tally
// ============================================================

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  try {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) return NextResponse.json({ error: 'DISCORD_BOT_TOKENが未設定です。' }, { status: 500 });

    const { data: rows } = await supabase
      .from('balancer_predictions')
      .select('id, result_message_id, result_channel_id')
      .not('result_message_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);

    let totalUp = 0, totalDown = 0, tallied = 0;
    for (const r of (rows || [])) {
      try {
        const res = await fetch(`https://discord.com/api/v10/channels/${r.result_channel_id}/messages/${r.result_message_id}`, {
          headers: { 'Authorization': `Bot ${botToken}` },
        });
        if (!res.ok) continue;
        const msg = await res.json();
        const reactions: any[] = msg.reactions || [];
        const findCount = (name: string) => {
          const rc = reactions.find((x) => x.emoji?.name === name);
          // botが最初に付けた1票を除外（下限0）
          return rc ? Math.max(0, (rc.count || 0) - 1) : 0;
        };
        const up = findCount('👍');
        const down = findCount('👎');
        totalUp += up; totalDown += down; tallied++;
        await supabase
          .from('balancer_predictions')
          .update({ satisfaction_up: up, satisfaction_down: down, satisfaction_updated_at: new Date().toISOString() })
          .eq('id', r.id);
      } catch {
        // 個別失敗はスキップ
      }
    }

    const totalVotes = totalUp + totalDown;
    return NextResponse.json({
      tallied,
      totalUp,
      totalDown,
      satisfactionRate: totalVotes > 0 ? Math.round((totalUp / totalVotes) * 100) : null,
    });
  } catch (err: any) {
    console.error('[satisfaction-tally] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
