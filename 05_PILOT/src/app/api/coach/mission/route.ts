import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getRiotId, RIOT_ID_REQUIRED_MESSAGE } from '@/lib/riotIdParam';
import { fetchPuuidByRiotId, fetchRankedSoloMatchIds, fetchMatchDetails, RiotRateLimitError } from '@/lib/riot';
import { getTargetTier, tierNeedsDivision } from '@/lib/coachSettings';
import { BENCHMARK_WINDOW_DAYS } from '@/lib/coachTargetMetrics';
import {
  MISSION_METRIC_BY_KEY, isAchieved, metricsFromParticipant, selectMission,
  type MatchMetrics, type MissionHistoryEntry, type MissionMetricKey,
} from '@/lib/missionLoop';

// 1試合1課題ループ（2026-10-19）。試合前タブ・試合後タブの「🎯 今日の1課題」カードが読む。
// GET: 挑戦中の課題を返す。前回の確認より新しいランク戦があれば、課題を出した後の最初の同じロールの試合で
//      達成かを判定して記録し、次の課題を作る。
// POST { action: 'skip' }: 挑戦中の課題を外して別の指標の課題にする。
// 認証は 05 の proxy.ts が担う。Riot API の回数制限に配慮し、新しい試合が無い時は試合詳細を取らない。
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const RECENT_MATCHES = 10;
/** 3分未満の試合（リメイク）は判定に使わない */
const REMAKE_SEC = 300;

type MatchDetail = Awaited<ReturnType<typeof fetchMatchDetails>>;

async function loadBenchmark(role: string): Promise<{ tier: string; values: Partial<Record<MissionMetricKey, number | null>> } | null> {
  if (!supabase) return null;
  const targetTier = await getTargetTier();
  const [tierRaw, divRaw] = targetTier.toUpperCase().split(/\s+/);
  const division = tierNeedsDivision(tierRaw) ? divRaw || 'IV' : '';
  const { data, error } = await supabase.rpc('rank_benchmark_averages', {
    p_tier: tierRaw, p_division: division, p_days: BENCHMARK_WINDOW_DAYS,
  });
  if (error) {
    console.warn('[coach/mission] rank_benchmark_averages:', error.message);
    return null;
  }
  const row = ((data || []) as any[]).find((r) => r.role === role);
  if (!row) return { tier: `${tierRaw}${division ? ` ${division}` : ''}`, values: {} };
  const values: Partial<Record<MissionMetricKey, number | null>> = {};
  for (const k of Object.keys(MISSION_METRIC_BY_KEY) as MissionMetricKey[]) {
    values[k] = row[k] == null ? null : Number(row[k]);
  }
  return { tier: `${tierRaw}${division ? ` ${division}` : ''}`, values };
}

function myMetrics(d: MatchDetail, puuid: string): { metrics: MatchMetrics; role: string; champion: string } | null {
  const me = d.participants.find((p) => p.puuid === puuid);
  if (!me) return null;
  return { metrics: metricsFromParticipant(me, d.participants, d.gameDuration), role: me.lane, champion: me.championName };
}

/** 直近の試合から一番多いロール（同数なら新しい方） */
function mainRole(entries: { role: string }[]): string | null {
  const count = new Map<string, number>();
  for (const e of entries) if (e.role) count.set(e.role, (count.get(e.role) || 0) + 1);
  let best: string | null = null;
  for (const e of entries) {
    if (!e.role) continue;
    if (!best || (count.get(e.role) || 0) > (count.get(best) || 0)) best = e.role;
  }
  return best;
}

async function createMission(params: {
  puuid: string; riotId: string; details: { d: MatchDetail; m: NonNullable<ReturnType<typeof myMetrics>> }[];
  history: MissionHistoryEntry[]; exclude?: MissionMetricKey[]; latestMatchId: string | null;
}) {
  const role = mainRole(params.details.map((x) => x.m));
  if (!role) return { mission: null, notice: '直近のランク戦が見つからないため、課題を作れません' };
  const sameRole = params.details.filter((x) => x.m.role === role).map((x) => x.m.metrics);
  const bench = await loadBenchmark(role);
  const plan = selectMission({ role, recent: sameRole, benchmark: bench?.values || null, history: params.history, exclude: params.exclude });
  if (!plan) return { mission: null, notice: `${role} の直近のランク戦が3試合未満のため、まだ課題を作れません` };

  const { data, error } = await supabase!
    .from('coach_missions')
    .insert({
      puuid: params.puuid,
      riot_id: params.riotId,
      role,
      metric: plan.metric,
      target: plan.target,
      baseline: plan.baseline,
      benchmark: plan.benchmark,
      target_tier: bench?.tier || null,
      reason: plan.reason,
      status: 'active',
      last_checked_match_id: params.latestMatchId,
    })
    .select('*')
    .single();
  if (error) {
    // 別の画面が同時に作った（挑戦中は1件の一意制約）→ そちらを返す
    if (error.code === '23505') {
      const { data: existing } = await supabase!.from('coach_missions').select('*').eq('puuid', params.puuid).eq('status', 'active').maybeSingle();
      return { mission: existing, notice: null };
    }
    throw error;
  }
  return { mission: data, notice: null };
}

async function respond(puuid: string, mission: any, notice: string | null, evaluated: any | null) {
  const { data: history } = await supabase!
    .from('coach_missions')
    .select('id, metric, target, actual, status, champion, match_id, role, created_at, evaluated_at')
    .eq('puuid', puuid)
    .in('status', ['achieved', 'missed'])
    .order('created_at', { ascending: false })
    .limit(20);
  const h = history || [];
  const achieved = h.filter((x) => x.status === 'achieved').length;
  return NextResponse.json({
    mission,
    evaluated, // 今回の読み込みで判定した試合（あれば）
    history: h,
    stats: { total: h.length, achieved, rate: h.length ? Math.round((achieved / h.length) * 100) : null },
    notice,
  });
}

async function handle(req: Request, action: 'view' | 'skip') {
  if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'RIOT_API_KEY が未設定です。' }, { status: 500 });
  const body = action === 'skip' ? await req.json().catch(() => ({})) : {};
  const riotId = getRiotId(req, body);
  if (!riotId) return NextResponse.json({ error: RIOT_ID_REQUIRED_MESSAGE }, { status: 400 });
  const riotIdStr = `${riotId.gameName}#${riotId.tagLine}`;

  const puuid = await fetchPuuidByRiotId(riotId.gameName, riotId.tagLine, apiKey);
  const matchIds = await fetchRankedSoloMatchIds(puuid, apiKey, RECENT_MATCHES);
  const latestMatchId = matchIds[0] || null;

  const { data: active } = await supabase.from('coach_missions').select('*').eq('puuid', puuid).eq('status', 'active').maybeSingle();
  const { data: past } = await supabase
    .from('coach_missions').select('metric, status').eq('puuid', puuid).neq('status', 'active')
    .order('created_at', { ascending: false }).limit(10);
  const history = (past || []) as MissionHistoryEntry[];

  // 新しい試合が無く、課題もある → Riot の試合詳細を取らずに返す
  if (action === 'view' && active && active.last_checked_match_id === latestMatchId) {
    return respond(puuid, active, null, null);
  }

  const details = (await Promise.all(matchIds.map((id) => fetchMatchDetails(id, apiKey).catch(() => null))))
    .map((d) => (d ? { d, m: myMetrics(d, puuid) } : null))
    .filter((x): x is { d: MatchDetail; m: NonNullable<ReturnType<typeof myMetrics>> } => !!x && !!x.m && x.d.gameDuration >= REMAKE_SEC);

  if (action === 'skip') {
    if (active) await supabase.from('coach_missions').update({ status: 'skipped', evaluated_at: new Date().toISOString() }).eq('id', active.id);
    const exclude = active ? [active.metric as MissionMetricKey] : [];
    const created = await createMission({ puuid, riotId: riotIdStr, details, history, exclude, latestMatchId });
    return respond(puuid, created.mission, created.notice, null);
  }

  let evaluated: any = null;
  if (active) {
    // 課題を出した後に始まった、同じロールの最初の試合で判定する（他のロールの試合は数えない）
    const createdAt = new Date(active.created_at).getTime();
    const after = details
      .filter((x) => x.d.gameStartTimestamp > createdAt && x.m.role === active.role)
      .sort((a, b) => a.d.gameStartTimestamp - b.d.gameStartTimestamp);
    const target = after[0];
    if (!target) {
      await supabase.from('coach_missions').update({ last_checked_match_id: latestMatchId }).eq('id', active.id);
      const otherRole = details.some((x) => x.d.gameStartTimestamp > createdAt);
      return respond(puuid, { ...active, last_checked_match_id: latestMatchId },
        otherRole ? `課題を出した後の試合は ${active.role} 以外のロールだったため、まだ判定していません` : null, null);
    }
    const actual = target.m.metrics[active.metric as MissionMetricKey];
    const ok = isAchieved(active.metric as MissionMetricKey, actual, Number(active.target));
    const { data: done, error } = await supabase
      .from('coach_missions')
      .update({
        status: ok ? 'achieved' : 'missed',
        actual,
        match_id: target.d.matchId,
        champion: target.m.champion,
        evaluated_at: new Date().toISOString(),
      })
      .eq('id', active.id)
      .eq('status', 'active') // 別の画面が先に判定していたら二重に記録しない
      .select('*')
      .maybeSingle();
    if (error) throw error;
    evaluated = done || null;
    history.unshift({ metric: active.metric, status: ok ? 'achieved' : 'missed' });
    if (!done) {
      const { data: again } = await supabase.from('coach_missions').select('*').eq('puuid', puuid).eq('status', 'active').maybeSingle();
      if (again) return respond(puuid, again, null, null);
    }
  }

  const created = await createMission({ puuid, riotId: riotIdStr, details, history, latestMatchId });
  return respond(puuid, created.mission, created.notice, evaluated);
}

function errorResponse(e: any) {
  if (e instanceof RiotRateLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
  console.error('[coach/mission]', e);
  return NextResponse.json({ error: e?.message || '課題の取得に失敗しました' }, { status: 500 });
}

export async function GET(req: Request) {
  try { return await handle(req, 'view'); } catch (e) { return errorResponse(e); }
}

export async function POST(req: Request) {
  try { return await handle(req, 'skip'); } catch (e) { return errorResponse(e); }
}
