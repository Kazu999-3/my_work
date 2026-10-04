// 05移植(2026-10-04): 旧ポータルから移植。認証は 05 の proxy.ts が担う。Riot ID は画面から渡す（lib/riotIdParam.ts）。
import { NextResponse } from 'next/server';
import { getRiotId, RIOT_ID_REQUIRED_MESSAGE } from '@/lib/riotIdParam';
import { supabase as supabaseClient } from '@/lib/supabaseClient';
const supabase = supabaseClient!;
import { fetchPuuidByRiotId } from '@/lib/riot';
import { getTimingContext, buildPlayRecommendation } from '@/lib/soloqTiming';
import { diagnoseTilt, analyzeStreak, type MatchLite } from '@/lib/playRecommendation';

// ============================================================
// 「次の試合に行くべきか」の判定だけを返す軽量API（2026-09-30新設）。
//
// 【なぜ作ったか】
//   この判定(playRecommendation)は /api/coach/analyze の mode=tilt が既に計算して
//   レスポンスに含めていたが、**どのUIからも参照されていなかった**。
//   試合前タブに出すために analyze を呼ぶと、同じリクエストでGeminiのメンタル
//   アドバイス生成まで走ってしまう。Geminiの日次クォータは実際に枯渇しており
//   (2026-09-30に辞典一括更新が丸1日止まった実例あり)、画面表示のたびに
//   消費するのは避けたい。
//
// 【コスト】LLM呼び出しなし。Riot APIも叩かない。
//   直近の試合は soloq_match_history（毎日05:40 JSTに自動同期）から読む。
//   そのぶんデータは最大1日弱ずれる可能性があるので、新しさも一緒に返して
//   画面側で明示できるようにしている。
// ============================================================
export const dynamic = 'force-dynamic';

const RECENT_LIMIT = 10;

export async function GET(req: Request) {
  try {
    const apiKey = process.env.RIOT_API_KEY!;
    const riotId = getRiotId(req);
    if (!apiKey) return NextResponse.json({ error: 'RIOT_API_KEY が未設定です。' }, { status: 500 });
    if (!riotId) return NextResponse.json({ error: RIOT_ID_REQUIRED_MESSAGE }, { status: 400 });
    const { gameName, tagLine } = riotId;
    // puuidの解決だけはRiot APIを使う（1回・キャッシュ対象の軽いエンドポイント）
    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);

    const { data, error } = await supabase
      .from('soloq_match_history')
      .select('win, kills, deaths, assists, champion, game_start_timestamp')
      .eq('puuid', puuid)
      .order('game_start_timestamp', { ascending: false })
      .limit(RECENT_LIMIT);
    if (error) throw error;

    const rows = data || [];
    if (rows.length === 0) {
      return NextResponse.json({
        available: false,
        reason: '同期済みのソロQ履歴がありません。',
        matchesUsed: 0,
      });
    }

    const matches: MatchLite[] = rows.map((r: any) => ({
      win: !!r.win,
      kills: r.kills ?? 0,
      deaths: r.deaths ?? 0,
      assists: r.assists ?? 0,
      champion: r.champion || undefined,
    }));

    const tilt = diagnoseTilt(matches);
    const streak = analyzeStreak(matches);
    const timing = await getTimingContext(supabase, puuid);
    const recommendation = buildPlayRecommendation(tilt, timing, streak);

    return NextResponse.json({
      available: true,
      matchesUsed: matches.length,
      tilt,
      streak,
      timing,
      recommendation,
      // 判定の根拠がどれだけ新しいか。古い場合は画面側で明示する。
      latestMatchAt: rows[0].game_start_timestamp,
      daysSinceNewest: timing.daysSinceNewest,
    });
  } catch (err: any) {
    console.error('[coach/play-recommendation] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
