import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

// ============================================================
// ナレッジ関連テーブルの鮮度監視 (2026-08-03 追加)
//
// 「生成経路はあるが誰も気づかないまま止まっている」パターンが同日に3件
// (youtube_channel_monitorの起票消失、champion_facts同期停止、
// champion_power_spikesのSupabaseキー名不一致)見つかったため、個別に気づく
// のではなく、主要テーブルの最終更新時刻を一覧で見られるようにする。
// ============================================================

interface FreshnessSource {
  key: string;
  label: string;
  expectedIntervalHours: number;
}

const SOURCES: FreshnessSource[] = [
  { key: 'champion_facts', label: '辞典 構造化バックフィル (champion_facts)', expectedIntervalHours: 48 },
  { key: 'champion_power_spikes', label: 'パワースパイク (champion_power_spikes)', expectedIntervalHours: 240 },
  { key: 'matchup_sentinel', label: 'チャンピオン辞典本体 (matchup_sentinel)', expectedIntervalHours: 48 },
  { key: 'youtube_channels', label: 'YouTube チャンネル監視', expectedIntervalHours: 6 },
  { key: 'youtube_playlists', label: 'YouTube プレイリスト監視', expectedIntervalHours: 6 },
  { key: 'lane_guides', label: 'レーン別ガイド', expectedIntervalHours: 720 },
  { key: 'personal_knowledge', label: '攻略ライブラリ 新規取り込み', expectedIntervalHours: 72 },
];

export async function GET(req: Request) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: 401 });

  try {
    const [
      { data: cf },
      { data: cps },
      { data: ms },
      { data: ycActive }, { data: ycAll },
      { data: ypActive }, { data: ypAll },
      { data: lg },
      { data: pk },
    ] = await Promise.all([
      supabase.from('champion_facts').select('updated_at').order('updated_at', { ascending: false }).limit(1),
      supabase.from('champion_power_spikes').select('updated_at').order('updated_at', { ascending: false }).limit(1),
      supabase.from('matchup_sentinel').select('created_at').order('created_at', { ascending: false }).limit(1),
      supabase.from('youtube_channels').select('last_fetched_at').eq('active', true).order('last_fetched_at', { ascending: false, nullsFirst: false }).limit(1),
      supabase.from('youtube_channels').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('youtube_playlists').select('last_fetched_at').eq('active', true).order('last_fetched_at', { ascending: false, nullsFirst: false }).limit(1),
      supabase.from('youtube_playlists').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('lane_guides').select('updated_at').order('updated_at', { ascending: false }).limit(1),
      supabase.from('personal_knowledge').select('created_at').order('created_at', { ascending: false }).limit(1),
    ]);

    const latestByKey: Record<string, string | null> = {
      champion_facts: cf?.[0]?.updated_at ?? null,
      champion_power_spikes: cps?.[0]?.updated_at ?? null,
      matchup_sentinel: ms?.[0]?.created_at ?? null,
      // 監視対象(active)チャンネル/プレイリストが0件なら「該当なし」として鮮度判定から除外する
      youtube_channels: (ycAll as any)?.count > 0 ? (ycActive?.[0]?.last_fetched_at ?? null) : undefined as any,
      youtube_playlists: (ypAll as any)?.count > 0 ? (ypActive?.[0]?.last_fetched_at ?? null) : undefined as any,
      lane_guides: lg?.[0]?.updated_at ?? null,
      personal_knowledge: pk?.[0]?.created_at ?? null,
    };

    const now = Date.now();
    const results = SOURCES
      .filter((s) => latestByKey[s.key] !== undefined)
      .map((s) => {
        const lastUpdated = latestByKey[s.key];
        const ageHours = lastUpdated ? (now - new Date(lastUpdated).getTime()) / (1000 * 60 * 60) : null;
        const isStale = ageHours === null || ageHours > s.expectedIntervalHours;
        return {
          key: s.key,
          label: s.label,
          lastUpdated,
          ageHours: ageHours !== null ? Math.round(ageHours * 10) / 10 : null,
          expectedIntervalHours: s.expectedIntervalHours,
          isStale,
        };
      });

    return NextResponse.json({ sources: results, checkedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('[knowledge/freshness] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
