import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { fetchPuuidByRiotId, fetchRankedSoloMatchIds, fetchMatchDetails } from '../../../../lib/riot';

// ============================================================
// ソロQ試合履歴(曜日×時間帯の勝率分析用)の遡及バックフィル。
// Riotの試合ID一覧は1回最大100件、試合詳細は1件ずつの取得が必要なため、
// タイムアウトを避けてチャンク処理(offsetベース)にする。クライアント側は
// done:trueになるまでnextOffsetを渡して繰り返し呼び出す。
// ============================================================
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TOTAL_TARGET = 300;
const CHUNK = 20;

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const offset = Number.isFinite(body?.offset) ? Number(body.offset) : 0;

    const apiKey = process.env.RIOT_API_KEY!;
    const gameName = process.env.RIOT_GAME_NAME!;
    const tagLine = process.env.RIOT_TAG_LINE!;
    if (!apiKey || !gameName || !tagLine) {
      return NextResponse.json({ error: 'Riot API環境変数が未設定です。' }, { status: 500 });
    }

    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);
    const ids = await fetchRankedSoloMatchIds(puuid, apiKey, CHUNK, offset);

    if (ids.length === 0) {
      return NextResponse.json({ processed: 0, synced: 0, nextOffset: null, done: true, totalTarget: TOTAL_TARGET });
    }

    // 既に保存済みのmatch_idはスキップ（詳細取得のAPI呼び出しを節約）
    const { data: existing } = await supabase
      .from('soloq_match_history')
      .select('match_id')
      .eq('puuid', puuid)
      .in('match_id', ids);
    const existingIds = new Set((existing || []).map((r: any) => r.match_id));

    let synced = 0;
    for (const matchId of ids) {
      if (existingIds.has(matchId)) continue;
      try {
        const detail = await fetchMatchDetails(matchId, apiKey);
        const me = detail.participants.find((p) => p.puuid === puuid);
        if (!me || !detail.gameStartTimestamp) continue;

        const { error } = await supabase.from('soloq_match_history').upsert({
          puuid,
          match_id: matchId,
          game_start_timestamp: new Date(detail.gameStartTimestamp).toISOString(),
          win: me.win,
          champion: me.championName,
          role: me.lane,
          kills: me.kills,
          deaths: me.deaths,
          assists: me.assists,
        }, { onConflict: 'puuid,match_id' });
        if (!error) synced++;
      } catch (e) {
        console.warn(`[soloq/history-sync] 試合${matchId}の取得に失敗:`, e);
      }
    }

    const processedCount = ids.length;
    const nextOffset = offset + processedCount;
    const done = processedCount < CHUNK || nextOffset >= TOTAL_TARGET;

    return NextResponse.json({
      processed: processedCount,
      synced,
      nextOffset: done ? null : nextOffset,
      done,
      totalTarget: TOTAL_TARGET,
    });
  } catch (err: any) {
    console.error('[soloq/history-sync] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
