import { NextRequest, NextResponse } from 'next/server';
import {
  fetchPuuidByRiotId,
  fetchRankedSoloMatchIds,
  fetchMatchDetails,
  fetchMatchTimeline,
  RiotRateLimitError,
} from '@/lib/riot';
import { analyzePostgameTempo, loadItemMeta } from '@/lib/postgameTempo';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

// 試合選択リストに出す件数。1件ごとに試合詳細APIを1回叩くため増やしすぎない
const LIST_SIZE = 6;

/**
 * GET /api/coach/postgame-tempo?gameName=...&tagLine=...&matchId=...
 * 直近ランクソロの1試合について、15分までのテンポロス逆再生とビルド監査を返す。
 * matchId 未指定時は最新の試合。
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.RIOT_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ error: 'RIOT_API_KEY が設定されていません。' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const gameName = String(searchParams.get('gameName') || '').trim();
    const tagLine = String(searchParams.get('tagLine') || 'JP1').trim().replace(/^#/, '') || 'JP1';
    const requestedMatchId = String(searchParams.get('matchId') || '').trim();

    // 他人の試合を自分の結果として見せないよう、既定プレイヤーへの暗黙フォールバックはしない
    if (!gameName) {
      return NextResponse.json({ error: 'Riot ID（名前#タグ）を入力してください。' }, { status: 400 });
    }

    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);
    const matchIds = await fetchRankedSoloMatchIds(puuid, apiKey, LIST_SIZE);
    if (matchIds.length === 0) {
      return NextResponse.json({ error: `「${gameName}#${tagLine}」の直近ランクソロ試合が見つかりませんでした。` }, { status: 404 });
    }

    const targetId = requestedMatchId && matchIds.includes(requestedMatchId) ? requestedMatchId : matchIds[0];

    const [details, timeline, items] = await Promise.all([
      Promise.all(matchIds.map((id) => fetchMatchDetails(id, apiKey).catch((e) => (e instanceof RiotRateLimitError ? Promise.reject(e) : null)))),
      fetchMatchTimeline(targetId, apiKey),
      loadItemMeta(),
    ]);

    const recentMatches = details
      .map((d) => {
        if (!d) return null;
        const me = d.participants.find((p) => p.puuid === puuid);
        if (!me) return null;
        const opp = d.participants.find((p) => p.teamId !== me.teamId && p.lane === me.lane);
        return {
          matchId: d.matchId,
          championName: me.championName,
          opponentChampion: opp?.championName || null,
          position: me.lane,
          isWin: me.win,
          kdaStr: `${me.kills}/${me.deaths}/${me.assists}`,
          durationMin: Math.floor(d.gameDuration / 60),
          gameStartTimestamp: d.gameStartTimestamp,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const targetDetail = details.find((d) => d?.matchId === targetId) || (await fetchMatchDetails(targetId, apiKey));
    const report = analyzePostgameTempo(targetDetail, timeline, puuid, items);

    return NextResponse.json({ success: true, recentMatches, report });
  } catch (error: any) {
    if (error instanceof RiotRateLimitError) {
      return NextResponse.json(
        { error: `Riot APIのレート制限に達しました。${error.retryAfterSec ? `${error.retryAfterSec}秒後に` : 'しばらくしてから'}再試行してください。` },
        { status: 429 },
      );
    }
    console.error('[postgame-tempo] Error:', error);
    return NextResponse.json({ error: error?.message || '試合後解析に失敗しました。' }, { status: 500 });
  }
}
