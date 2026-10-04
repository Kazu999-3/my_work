import { NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchRecentMatchIds, fetchMatchDetails } from '@/lib/riot';

export const dynamic = 'force-dynamic';

// 直近のソロQ試合一覧（旧ポータル /api/soloq/recent-matches の移植）。2026-10-04
// 旧版は Riot ID 未指定時に環境変数 DEFAULT_RIOT_IGN を使っていた。05では画面に保存した Riot ID を必須にする。
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ign = String(body.ign || '').trim();
    const count = Math.min(Math.max(Number(body.count) || 5, 1), 30);
    if (!ign.includes('#')) {
      return NextResponse.json({ error: 'Riot ID (例: 名前#JP1) を入力してください。' }, { status: 400 });
    }
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'サーバーに RIOT_API_KEY が設定されていません。' }, { status: 500 });

    const [gameName, tagLine] = ign.split('#');
    const puuid = await fetchPuuidByRiotId(gameName.trim(), tagLine.trim(), apiKey);

    // ランクソロ(420)を優先し、無ければ全キュー
    let matchIds = await fetchRecentMatchIds(puuid, apiKey, count, 420);
    if (!matchIds || matchIds.length === 0) matchIds = await fetchRecentMatchIds(puuid, apiKey, count);
    if (!matchIds || matchIds.length === 0) {
      return NextResponse.json({ error: '直近のソロQ試合データが見つかりませんでした。' }, { status: 404 });
    }

    const results = await Promise.all(matchIds.map(async (mId) => {
      try {
        const details = await fetchMatchDetails(mId, apiKey);
        const me = details.participants.find((p) => p.puuid === puuid);
        if (!me) return null;
        const enemy =
          details.participants.find((p) => p.teamId !== me.teamId && p.lane === me.lane && me.lane !== 'NONE' && me.lane !== '') ||
          details.participants.find((p) => p.teamId !== me.teamId);
        return {
          matchId: mId,
          champion: me.championName,
          enemyChampion: enemy ? enemy.championName : 'Unknown',
          win: me.win,
          kda: `${me.kills}/${me.deaths}/${me.assists}`,
          cs: (me.totalMinionsKilled || 0) + (me.neutralMinionsKilled || 0),
          gameDuration: details.gameDuration,
          lane: me.lane,
        };
      } catch (err) {
        console.error(`[soloq/recent-matches] ${mId} の取得に失敗:`, err);
        return null;
      }
    }));

    const matches = results.filter((m) => m !== null);
    if (matches.length === 0) return NextResponse.json({ error: '試合データの取得・パースに失敗しました。' }, { status: 500 });
    return NextResponse.json({ matches });
  } catch (e: any) {
    console.error('[soloq/recent-matches] Error:', e);
    return NextResponse.json({ error: e.message || '直近のソロQ試合一覧取得に失敗しました。' }, { status: 500 });
  }
}
