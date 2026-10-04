import { NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

// 辞典監査の一覧で行を開いた時に、そのチャンピオンの辞典の中身を返す（2026-10-05）。
// 一覧APIは173体分を返すため軽い項目だけに絞っており、本文はこちらで1体ずつ取る。
export async function GET(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database client not initialized' }, { status: 500 });
  }
  const champion = new URL(req.url).searchParams.get('champion') || '';
  if (!champion) return NextResponse.json({ error: 'champion を指定してください' }, { status: 400 });

  const { data, error } = await supabase
    .from('champion_facts')
    .select('champion, role, patch, jg_type, strengths, weaknesses, power_spikes, build_runes, full_clear_time, counter_champions, pick_recommendation, strategy, source_summary, updated_at')
    .eq('champion', champion)
    .eq('archived', false)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: '辞典データが見つかりません' }, { status: 404 });
  return NextResponse.json({ fact: data });
}
