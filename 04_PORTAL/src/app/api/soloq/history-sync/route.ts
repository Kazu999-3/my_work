import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { fetchPuuidByRiotId, fetchRankedSoloMatchIds, fetchMatchDetails, RiotRateLimitError } from '../../../../lib/riot';

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
    let rateLimited = false;
    let stoppedAtIndex = ids.length; // レート制限で中断しなければ全件処理したことにする
    for (let i = 0; i < ids.length; i++) {
      const matchId = ids[i];
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
        // 429は「そのうち回復する一時的な失敗」であり、他のエラーのように握りつぶして
        // 次へ進めると、この試合が二度と再試行されないまま欠落する(2026-08-05発覚)。
        // ここで中断し、nextOffsetをこの試合の手前に据えて次回呼び出しで再試行させる。
        if (e instanceof RiotRateLimitError) {
          console.warn(`[soloq/history-sync] レート制限のため中断 (${matchId}、retryAfter=${e.retryAfterSec ?? '不明'}秒):`, e.message);
          rateLimited = true;
          stoppedAtIndex = i;
          break;
        }
        console.warn(`[soloq/history-sync] 試合${matchId}の取得に失敗:`, e);
      }
    }

    const processedCount = stoppedAtIndex;
    const nextOffset = offset + processedCount;
    const done = !rateLimited && (processedCount < CHUNK || nextOffset >= TOTAL_TARGET);

    return NextResponse.json({
      processed: processedCount,
      synced,
      nextOffset: done ? null : nextOffset,
      done,
      rateLimited,
      totalTarget: TOTAL_TARGET,
    });
  } catch (err: any) {
    console.error('[soloq/history-sync] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
