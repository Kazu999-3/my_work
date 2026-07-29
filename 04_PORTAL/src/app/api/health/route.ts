import { NextRequest, NextResponse } from 'next/server';
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
    portalBotSecret: !!process.env.PORTAL_BOT_SECRET,
    ms: Date.now() - started,
    checkedAt: new Date().toISOString(),
  });
}

// app/error.tsx がクラッシュ時にここへ報告を送るが、以前はPOSTハンドラが無く
// 405で毎回黙って握りつぶされていた(呼び出し側もcatchで無視)ため、実際に
// フロントでクラッシュが起きてもVercelのログに何も残らなかった。
// 最低限ログには残すようにする（永続化までは不要）。
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.error('[portal_boundary_error]', body);
  } catch {
    // 本文が読めなくても報告自体は失敗させない
  }
  return NextResponse.json({ ok: true });
}
