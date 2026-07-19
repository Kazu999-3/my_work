import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

// 軽量ヘルスチェック。サイドバー下部のステータス表示（#58）が実際の稼働状態を
// 反映できるようにするための公開エンドポイント。DBへの最小クエリで接続性のみ確認する。
export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  let db = false;
  try {
    // head:true + limit(1) で行本体を転送しない（エグレス最小化・#53配慮）
    const { error } = await supabaseAdmin
      .from('ktm_players')
      .select('discord_id', { count: 'exact', head: true })
      .limit(1);
    db = !error;
  } catch {
    db = false;
  }
  return NextResponse.json({
    ok: db,
    db,
    // A-05: 依存サービスの設定状況（キーの有無のみ。疎通確認はレート消費するため行わない）
    riotKey: !!process.env.RIOT_API_KEY,
    geminiKey: !!(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_BATCH || process.env.GOOGLE_API_KEY),
    vapid: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    discordWebhook: !!process.env.DISCORD_KTM_WEBHOOK_URL,
    ms: Date.now() - started,
    checkedAt: new Date().toISOString(),
  });
}
