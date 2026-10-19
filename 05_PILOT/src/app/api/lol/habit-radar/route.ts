import { NextRequest, NextResponse } from 'next/server';
import {
  fetchPuuidByRiotId,
  fetchRankedSoloMatchIds,
  fetchRecentMatchIds,
  fetchMatchDetails,
  fetchMatchTimeline,
} from '@/lib/riot';
import {
  extractSingleGameHabit,
  aggregateHabitRadar,
  type SingleGameHabit,
  type HabitRadarSummary
} from '@/lib/habitRadar';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

// メモリキャッシュ (TTL: 10分)
interface CacheEntry {
  data: HabitRadarSummary;
  expiresAt: number;
}
const habitCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RIOT_API_KEY が設定されていません。' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    let puuid = searchParams.get('puuid') || '';
    const riotId = searchParams.get('riotId') || '';
    const countParam = Number(searchParams.get('count')) || 5;
    const count = Math.max(1, Math.min(10, countParam));

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

    // キャッシュチェック
    const cacheKey = `${puuid}_${count}`;
    const cached = habitCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(
        {
          success: true,
          source: 'cache',
          radar: cached.data
        },
        {
          headers: {
            'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
          },
        }
      );
    }

    // 1. 直近マッチIDを取得（ソロQ優先）
    let matchIds = await fetchRankedSoloMatchIds(puuid, apiKey, count);
    if (matchIds.length === 0) {
      matchIds = await fetchRecentMatchIds(puuid, apiKey, count);
    }

    if (matchIds.length === 0) {
      return NextResponse.json({
        success: true,
        radar: aggregateHabitRadar([])
      });
    }

    // 2. 各試合の詳細とタイムラインを並列取得して癖を抽出
    const habits: SingleGameHabit[] = [];

    // レートリミットを考慮し、1つずつ安全にまたはバッチで処理
    const matchPromises = matchIds.map(async (matchId) => {
      try {
        const [matchDetails, timeline] = await Promise.all([
          fetchMatchDetails(matchId, apiKey),
          fetchMatchTimeline(matchId, apiKey)
        ]);

        if (matchDetails && timeline) {
          const habit = extractSingleGameHabit(timeline, puuid, matchDetails);
          if (habit) return habit;
        }
      } catch (err) {
        console.warn(`[HabitRadar] Match ${matchId} skipped:`, err);
      }
      return null;
    });

    const results = await Promise.all(matchPromises);
    for (const res of results) {
      if (res) habits.push(res);
    }

    // 3. 集計処理
    const radar = aggregateHabitRadar(habits);

    // キャッシュ保存
    habitCache.set(cacheKey, {
      data: radar,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    return NextResponse.json(
      {
        success: true,
        source: 'live',
        radar
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error: any) {
    console.error('[HabitRadar API Error]:', error);
    return NextResponse.json({ error: error.message || '内部エラーが発生しました。' }, { status: 500 });
  }
}
