import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { resolveRosterChampion, getChampionNameJa } from '@/lib/championRoster';

export const dynamic = 'force-dynamic';

const FIELD_LABELS: Record<string, string> = {
  strengths: '💪 強み',
  weaknesses: '⚠️ 弱み',
  power_spikes: '⚡ パワースパイク',
  build_runes: '🛡️ ビルド/ルーン',
  pick_recommendation: '🎯 ピック判断',
  strategy: '👑 マスター教本 (全般立ち回り)',
};

export async function GET(req: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const { searchParams } = new URL(req.url);
    const rawChampion = searchParams.get('champion');

    if (!rawChampion) {
      return NextResponse.json({ error: 'championパラメータが必要です' }, { status: 400 });
    }

    const champId = await resolveRosterChampion(rawChampion);
    const champNameJa = await getChampionNameJa(champId || rawChampion);

    // 英語ID・日本語名・matchup_sentinel形式のすべてのキーを検索対象に
    const targetKeys = Array.from(new Set([
      rawChampion,
      champId,
      champNameJa,
      `champ_${champId}_global`,
      `champ_${rawChampion}_global`,
    ].filter(Boolean))) as string[];

    const { data, error } = await supabase
      .from('knowledge_revisions')
      .select('id, target_type, target_key, field, before_text, after_text, source_title, source_id, created_at')
      .in('target_key', targetKeys)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const revisions = (data || []).map((r) => ({
      ...r,
      fieldLabel: FIELD_LABELS[r.field] || r.field,
    }));

    return NextResponse.json({
      success: true,
      champion: champId || rawChampion,
      championNameJa: champNameJa,
      total: revisions.length,
      revisions,
    });
  } catch (e: any) {
    console.error('[admin/revisions] GET error:', e);
    return NextResponse.json({ error: e.message || '履歴取得に失敗しました' }, { status: 500 });
  }
}
