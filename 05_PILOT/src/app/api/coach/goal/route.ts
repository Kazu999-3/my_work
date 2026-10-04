import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { fetchPuuidByRiotId, fetchLeagueByPuuid } from '@/lib/riot';
import { getRiotId, RIOT_ID_REQUIRED_MESSAGE } from '@/lib/riotIdParam';

export const dynamic = 'force-dynamic';

// ランク目標と到達見込み（旧ポータル /api/coach/analyze の mode=goal の移植）。2026-10-04
// 現在ランクを取得して当日のLPスナップショット(soloq_lp_history)を記録し、履歴の傾きから到達日を試算する。
// LLMは使わない（Riot APIのランク取得1回のみ）。

const TIER_BASE: Record<string, number> = {
  IRON: 0, BRONZE: 400, SILVER: 800, GOLD: 1200, PLATINUM: 1600,
  EMERALD: 2000, DIAMOND: 2400, MASTER: 2800, GRANDMASTER: 2800, CHALLENGER: 2800,
};
const DIV_OFFSET: Record<string, number> = { IV: 0, III: 100, II: 200, I: 300 };
const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);

function toAbsLp(tier: string, division: string, lp: number): number {
  const t = (tier || '').toUpperCase();
  const base = TIER_BASE[t] ?? 0;
  if (APEX.has(t)) return base + (lp || 0);
  return base + (DIV_OFFSET[(division || 'IV').toUpperCase()] ?? 0) + (lp || 0);
}

function absLpToLabel(abs: number): string {
  const tiers = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'];
  if (abs >= 2800) return `MASTER+ (${abs - 2800}LP)`;
  const tierIdx = Math.min(tiers.length - 1, Math.floor(abs / 400));
  const within = abs - tierIdx * 400;
  const divIdx = Math.min(3, Math.floor(within / 100));
  const lp = within - divIdx * 100;
  return `${tiers[tierIdx]} ${['IV', 'III', 'II', 'I'][divIdx]} (${lp}LP)`;
}

export async function POST(req: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'RIOT_API_KEY が未設定です' }, { status: 500 });
    const riotId = getRiotId(req, body);
    if (!riotId) return NextResponse.json({ error: RIOT_ID_REQUIRED_MESSAGE }, { status: 400 });
    const puuid = await fetchPuuidByRiotId(riotId.gameName, riotId.tagLine, apiKey);

    const leagues = await fetchLeagueByPuuid(puuid, apiKey).catch(() => []);
    const solo = (leagues as any[]).find((r) => r.queueType === 'RANKED_SOLO_5x5');
    if (!solo) {
      return NextResponse.json({ mode: 'goal', ranked: false, message: 'ソロQのランクが未取得です（プレイスメント未消化の可能性）。' });
    }
    const currentAbs = toAbsLp(solo.tier, solo.rank, solo.leaguePoints);

    // 当日のスナップショットを記録（使うほど推移が貯まる）
    const jstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const { error: snapErr } = await supabase.from('soloq_lp_history').upsert({
      puuid, tier: solo.tier, division: solo.rank, lp: solo.leaguePoints, abs_lp: currentAbs, snapshot_date: jstDate,
    }, { onConflict: 'puuid,snapshot_date' });
    if (snapErr) console.warn('[coach/goal] LPスナップショットの保存に失敗（続行）:', snapErr);

    const targetTier = String(body.targetTier || '').toUpperCase();
    const targetDivision = String(body.targetDivision || 'IV').toUpperCase();
    const targetLp = Number(body.targetLp) || 0;
    const current = { abs: currentAbs, label: `${solo.tier} ${solo.rank} (${solo.leaguePoints}LP)` };
    if (!targetTier || TIER_BASE[targetTier] === undefined) {
      return NextResponse.json({ mode: 'goal', ranked: true, current, message: '目標ティアを指定してください。' });
    }
    const targetAbs = toAbsLp(targetTier, targetDivision, targetLp);

    const { data: hist } = await supabase
      .from('soloq_lp_history').select('abs_lp, snapshot_date').eq('puuid', puuid)
      .order('snapshot_date', { ascending: true }).limit(120);
    const points = (hist || []).map((h: any) => ({ abs: Number(h.abs_lp), date: h.snapshot_date }));

    let lpPerDay: number | null = null;
    let daySpan = 0;
    if (points.length >= 2) {
      const first = points[0], last = points[points.length - 1];
      daySpan = Math.max(1, Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000));
      lpPerDay = +((last.abs - first.abs) / daySpan).toFixed(1);
    }

    const gap = targetAbs - currentAbs;
    let projection: any;
    if (gap <= 0) {
      projection = { reached: true };
    } else if (lpPerDay && lpPerDay > 0) {
      const days = Math.ceil(gap / lpPerDay);
      projection = {
        reached: false,
        days,
        reachDate: new Date(Date.now() + days * 86400000).toISOString().slice(0, 10),
        gamesNeeded: Math.ceil(gap / 20),
        note: '※標準的なLP増減（約+20LP/勝）を仮定した試算目安です。',
      };
    } else {
      projection = { reached: false, insufficientTrend: true };
    }

    return NextResponse.json({
      mode: 'goal', ranked: true, current,
      target: { abs: targetAbs, label: absLpToLabel(targetAbs) },
      gap, lpPerDay, daySpan, snapshots: points.length, projection, history: points.slice(-30),
    });
  } catch (e: any) {
    console.error('[coach/goal] Error:', e);
    return NextResponse.json({ error: e.message || '取得に失敗しました' }, { status: 500 });
  }
}
