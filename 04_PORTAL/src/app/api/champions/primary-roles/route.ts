import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

// champion_lane_roles(op.ggから収集した実データ、既存)は "ADC" 表記だが、5v5シミュレータ等
// このポータルの他の場所はすべて "BOT" 表記に統一している。ここで揃える。
function normalizeRole(role: string): string {
  return role === 'ADC' ? 'BOT' : role;
}

// 実況中のライブ試合から検出したチャンピオンを、5v5シミュレータのTOP/JG/MID/BOT/SUP
// 各スロットへ自動割り当てするために使う「最も可能性の高いロール」の一括取得API。
// 2026-08-15、「リアルタイム偵察で検出した10体を5v5シミュレータへ自動反映したい」
// という要望に対応するために新設。既にジャングルと判明している参加者はこの推定を
// 使わず(Riotのスペクテイターデータでスマイト保持から確実に分かるため)、残り4人
// (TOP/MID/BOT/SUPのどれか、Riot側はまとめて"LANER"としか区別できない)の割り振り
// にだけ使う想定。
export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const champParam = req.nextUrl.searchParams.get('champions') || '';
  const champions = champParam.split(',').map((c) => c.trim()).filter(Boolean);
  if (champions.length === 0) return NextResponse.json({ roles: {} });

  try {
    const { data, error } = await supabase
      .from('champion_lane_roles')
      .select('champion, role, rank')
      .in('champion', champions)
      .order('rank', { ascending: true });
    if (error) throw error;

    // rank昇順で取得しているため、チャンピオンごとに最初に見つかった行(=最小rank=最有力ロール)を採用
    const roles: Record<string, string> = {};
    for (const row of (data || [])) {
      if (!roles[row.champion]) roles[row.champion] = normalizeRole(row.role);
    }
    return NextResponse.json({ roles });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
