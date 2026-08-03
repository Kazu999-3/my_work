import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// player/[id]/page.tsx 用: discord_id / name / ign / id のいずれかで柔軟照合してプレイヤー
// 1件を返す読み取り専用API。従来は全プレイヤーをブラウザへ丸ごと転送して照合していた。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawId = (searchParams.get('id') || '').trim();
    if (!rawId) {
      return NextResponse.json({ error: 'id が必要です' }, { status: 400 });
    }

    const { data: allPlayers, error } = await supabase.from('ktm_players').select('*');
    if (error) throw error;
    if (!allPlayers || allPlayers.length === 0) {
      return NextResponse.json({ player: null });
    }

    const targetLower = rawId.toLowerCase();
    let player = allPlayers.find((p: any) =>
      String(p.discord_id || '').trim() === rawId ||
      String(p.name || '').trim().toLowerCase() === targetLower ||
      String(p.ign || '').trim().toLowerCase() === targetLower ||
      String(p.id || '').trim() === rawId
    );

    // 部分一致フォールバック（かずき → Kazurin 等の IGN や Name 揺れ対応）
    if (!player) {
      player = allPlayers.find((p: any) =>
        String(p.name || '').toLowerCase().includes(targetLower) ||
        String(p.ign || '').toLowerCase().includes(targetLower)
      );
    }

    return NextResponse.json({ player: player || null });
  } catch (err: any) {
    console.error('[player/lookup] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
