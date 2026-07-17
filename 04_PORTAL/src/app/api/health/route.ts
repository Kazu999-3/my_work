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
    ms: Date.now() - started,
    checkedAt: new Date().toISOString(),
  });
}
