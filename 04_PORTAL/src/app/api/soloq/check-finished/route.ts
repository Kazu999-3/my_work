import { NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchRecentMatchIds } from '../../../../lib/riot';
import { verifyAdminSession } from '../../../../lib/adminAuth';

export async function POST(request: Request) {
  try {
    const authResult = await verifyAdminSession(request);
    if (!authResult.ok) {
      return NextResponse.json({ isNewMatch: false });
    }

    const body = await request.json().catch(() => ({}));
    const { ign = '', lastKnownMatchId = '' } = body;

    if (!ign || !ign.includes('#')) {
      return NextResponse.json({ isNewMatch: false });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ isNewMatch: false });
    }

    const [gameName, tagLine] = ign.split('#');
    const puuid = await fetchPuuidByRiotId(gameName.trim(), tagLine.trim(), apiKey);

    const matchIds = await fetchRecentMatchIds(puuid, apiKey, 1, 420);
    if (!matchIds || matchIds.length === 0) {
      return NextResponse.json({ isNewMatch: false });
    }

    const latestMatchId = matchIds[0];
    const isNewMatch = !!lastKnownMatchId && lastKnownMatchId !== latestMatchId;

    return NextResponse.json({
      isNewMatch,
      latestMatchId,
    });
  } catch (err: any) {
    return NextResponse.json({ isNewMatch: false });
  }
}
