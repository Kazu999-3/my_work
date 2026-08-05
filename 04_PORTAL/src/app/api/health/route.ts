import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { createAdminNotification } from '../../../lib/notify';

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
// console.error だけに直した時期もあったが、Vercelの関数ログは誰も能動的に
// 見ないため実質気づけないままだった(2026-08-04発覚)。管理者通知(ベル+プッシュ)
// に流すことで、フロントのクラッシュに実際に気づけるようにする。
// 同じエラーの連投で通知が埋もれないよう、直近15分以内に同じmessageの通知が
// あればスキップする。
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = String(body?.message || 'Unknown UI Error').slice(0, 200);
    console.error('[portal_boundary_error]', body);

    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from('admin_notifications')
      .select('id')
      .eq('type', 'portal_boundary_error')
      .ilike('title', `%${message.slice(0, 60)}%`)
      .gt('created_at', since)
      .limit(1);

    // 上の重複抑止はmessage文字列の一致判定のみのため、文言を少し変えるだけで
    // すり抜けられてしまっていた(2026-08-05発覚)。内容に関わらず、直近5分間の
    // 総件数が多すぎる場合は個別のメッセージ内容を問わず追加通知をスキップする
    // (通知の埋没・プッシュのスパム化を防ぐグローバルな上限)。
    const burstSince = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: burstCount } = await supabaseAdmin
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'portal_boundary_error')
      .gt('created_at', burstSince);

    if ((!recent || recent.length === 0) && (burstCount || 0) < 10) {
      await createAdminNotification({
        type: 'portal_boundary_error',
        title: `💥 フロントエラー: ${message}`,
        body: body?.stack ? String(body.stack).slice(0, 400) : undefined,
        data: { digest: body?.digest },
      });
    }
  } catch {
    // 本文が読めなくても報告自体は失敗させない
  }
  return NextResponse.json({ ok: true });
}
