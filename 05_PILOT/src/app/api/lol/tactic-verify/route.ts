import { NextResponse } from 'next/server';
import { fetchMatchDetails, fetchMatchTimeline, fetchPuuidByRiotId, fetchRankedSoloMatchIds } from '@/lib/riot';
import { verifyMatchTactics, type TacticVerificationReport } from '@/lib/tacticVerifier';

export const dynamic = 'force-dynamic';

const verifyCache = new Map<string, { data: TacticVerificationReport; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10分

export async function GET(request: Request) {
  try {
    const apiKey = process.env.RIOT_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ error: 'RIOT_API_KEY が設定されていません。' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    let puuid = searchParams.get('puuid') || '';
    const riotId = searchParams.get('riotId') || '';
    let matchId = searchParams.get('matchId') || '';

    if (!puuid && riotId) {
      const [gName = '', tLine = 'JP1'] = riotId.split('#').map((s) => s.trim());
      try {
        puuid = await fetchPuuidByRiotId(gName, tLine || 'JP1', apiKey);
      } catch (e: any) {
        return NextResponse.json({ error: `Riot ID の解決に失敗しました: ${e.message}` }, { status: 404 });
      }
    }

    if (!puuid) {
      return NextResponse.json({ error: 'puuid または riotId が必要です。' }, { status: 400 });
    }

    if (!matchId) {
      const matches = await fetchRankedSoloMatchIds(puuid, apiKey, 1);
      if (!matches || matches.length === 0) {
        return NextResponse.json({ error: '直近の試合履歴が見つかりません。' }, { status: 404 });
      }
      matchId = matches[0];
    }

    const cacheKey = `${puuid}_${matchId}`;
    const cached = verifyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(
        {
          success: true,
          source: 'cache',
          report: cached.data,
        },
        {
          headers: {
            'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
          },
        }
      );
    }

    const [matchDetails, timelineData] = await Promise.all([
      fetchMatchDetails(matchId, apiKey),
      fetchMatchTimeline(matchId, apiKey),
    ]);

    if (!matchDetails || !timelineData) {
      return NextResponse.json({ error: '試合詳細またはタイムラインの取得に失敗しました。' }, { status: 404 });
    }

    const report = verifyMatchTactics(matchDetails, timelineData, puuid);
    if (!report) {
      return NextResponse.json({ error: '戦術スコアの解析に失敗しました。' }, { status: 422 });
    }

    verifyCache.set(cacheKey, { data: report, expiresAt: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(
      {
        success: true,
        source: 'live',
        report,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error: any) {
    console.error('Tactic Verify API Error:', error);
    return NextResponse.json({ error: error.message || '内部エラーが発生しました。' }, { status: 500 });
  }
}
