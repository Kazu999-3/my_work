import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchAllRows } from '../../../../lib/fetchAll';

// 管理画面「運営の状況」タブ（2026-10-20）。
// - Bot の定期実行の記録（bot_cron_runs、migration 115/116）
// - 週ごとの数字（試合数・参加人数・初参加・2回目・名簿に入った人）と、来なくなった常連の数
// - 最高ランクとメインレーンの分布（名簿全員 / 直近60日に出場した人）
// 9月以降、初参加した人が2回目に来ていない（9月 5人中0人）ことが分かったため、運営の数字をスマホから見られるようにした。
export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;
const JST = 9 * 60 * 60 * 1000;
const WEEKS = 8;
const NIGHT_SHIFT = 6 * 60 * 60 * 1000;

/** JST の月曜 0:00 を週の始まりとして、その週の開始時刻（UTC ミリ秒）を返す */
function weekStartOf(ms: number): number {
  const jst = new Date(ms + JST);
  const dow = (jst.getUTCDay() + 6) % 7; // 月=0 … 日=6
  return Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() - dow) - JST;
}

function jstDay(ms: number): string {
  return new Date(ms + JST).toISOString().slice(0, 10);
}

const RANK_ORDER = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER', 'UNRANKED'];
const LANE_ORDER = ['TOP', 'JG', 'MID', 'ADC', 'SUP', 'ALL'];

function tierOf(rank: string | null | undefined): string {
  const t = (rank || '').trim().toUpperCase().split(/\s+/)[0];
  return RANK_ORDER.includes(t) ? t : 'UNRANKED';
}

function laneOf(prefs: any): string {
  const l = String(prefs?.primary || '').trim().toUpperCase();
  if (l === 'JUNGLE') return 'JG';
  if (l === 'BOT' || l === 'BOTTOM') return 'ADC';
  if (l === 'SUPPORT') return 'SUP';
  return LANE_ORDER.includes(l) ? l : '未設定';
}

function countBy(values: string[], order: string[]) {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) || 0) + 1);
  const keys = [...order.filter((k) => map.has(k)), ...[...map.keys()].filter((k) => !order.includes(k))];
  return keys.map((key) => ({ key, count: map.get(key) || 0 }));
}

export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

  try {
    const [runsRes, playersRes, partsRes, matchesRes] = await Promise.all([
      supabase
        .from('bot_cron_runs')
        .select('id, job, source, status, detail, started_at, finished_at')
        .not('job', 'like', 'noop%')
        .order('started_at', { ascending: false })
        .limit(30),
      supabase.from('ktm_players').select('name, highest_rank, role_preferences, created_at, metadata'),
      // 出場記録は1,000件を超えているため分けて読む。出場記録の created_at は記録を作り直すと変わるため、日付は試合側を使う
      fetchAllRows((from, to) =>
        supabase.from('ktm_match_participants').select('player_name, match_id').order('id').range(from, to)
      ),
      fetchAllRows((from, to) => supabase.from('ktm_matches').select('id, created_at').order('id').range(from, to)),
    ]);
    if (playersRes.error) throw playersRes.error;
    if (partsRes.error) throw partsRes.error;
    if (matchesRes.error) throw matchesRes.error;

    const now = Date.now();
    const players = playersRes.data || [];
    const matchAt = new Map((matchesRes.data || []).map((m: any) => [m.id, new Date(m.created_at).getTime()]));
    // 試合の日時が分かる出場記録だけを、試合の古い順に並べる
    const parts = ((partsRes.data || []) as any[])
      .filter((p) => matchAt.has(p.match_id))
      // カスタムは21時に始まり0時をまたぐため、朝6時までの試合は前日の夜として数える（同じ夜が2日に数えられないように）
      .map((p) => ({ ...p, at: (matchAt.get(p.match_id) as number) - NIGHT_SHIFT }))
      .sort((a, b) => a.at - b.at);

    // 人ごとの出場日（JST の日付）。同じ日の複数試合は1日として数える
    const daysOf = new Map<string, string[]>();
    for (const p of parts) {
      if (!p.player_name) continue;
      const d = jstDay(p.at);
      const list = daysOf.get(p.player_name) || [];
      if (list[list.length - 1] !== d) list.push(d);
      daysOf.set(p.player_name, list);
    }
    const dayMs = (d: string) => Date.parse(`${d}T00:00:00+09:00`);

    // 週ごとの数字
    const thisWeek = weekStartOf(now);
    const weeks = Array.from({ length: WEEKS }, (_, i) => {
      const start = thisWeek - (WEEKS - 1 - i) * 7 * DAY;
      return { start, end: start + 7 * DAY, label: jstDay(start).slice(5).replace('-', '/'), matches: new Set<string>(), people: new Set<string>(), firstTime: 0, secondTime: 0, joined: 0 };
    });
    const weekIdx = (ms: number) => weeks.findIndex((w) => ms >= w.start && ms < w.end);

    for (const p of parts) {
      const i = weekIdx(p.at);
      if (i < 0) continue;
      weeks[i].matches.add(p.match_id);
      if (p.player_name) weeks[i].people.add(p.player_name);
    }
    for (const days of daysOf.values()) {
      const i1 = weekIdx(dayMs(days[0]));
      if (i1 >= 0) weeks[i1].firstTime += 1;
      if (days[1]) {
        const i2 = weekIdx(dayMs(days[1]));
        if (i2 >= 0) weeks[i2].secondTime += 1;
      }
    }
    for (const pl of players as any[]) {
      const joined = pl.metadata?.joined_at || pl.created_at;
      const i = joined ? weekIdx(new Date(joined).getTime()) : -1;
      if (i >= 0) weeks[i].joined += 1;
    }

    // 初参加した人がその後来たか（月ごと、直近6か月）
    const monthly = new Map<string, { firstTime: number; cameBack: number }>();
    const sixMonthsAgo = now - 183 * DAY;
    for (const days of daysOf.values()) {
      if (dayMs(days[0]) < sixMonthsAgo) continue;
      const m = days[0].slice(0, 7);
      const row = monthly.get(m) || { firstTime: 0, cameBack: 0 };
      row.firstTime += 1;
      if (days.length >= 2) row.cameBack += 1;
      monthly.set(m, row);
    }

    // 来なくなった常連: 3日以上出場し、最後の出場から30日以上
    const lapsed = [...daysOf.entries()]
      .filter(([, days]) => days.length >= 3 && now - dayMs(days[days.length - 1]) >= 30 * DAY)
      .map(([name, days]) => ({ name, days: days.length, lastDay: days[days.length - 1] }))
      .sort((a, b) => b.lastDay.localeCompare(a.lastDay));

    // 分布（名簿全員 / 直近60日に出場した人）
    const activeNames = new Set(
      [...daysOf.entries()].filter(([, days]) => now - dayMs(days[days.length - 1]) < 60 * DAY).map(([name]) => name)
    );
    const dist = (list: any[]) => ({
      total: list.length,
      rank: countBy(list.map((p) => tierOf(p.highest_rank)), RANK_ORDER),
      lane: countBy(list.map((p) => laneOf(p.role_preferences)), [...LANE_ORDER, '未設定']),
    });

    return NextResponse.json({
      botRuns: runsRes.error ? [] : runsRes.data || [],
      botRunsError: runsRes.error?.message || null,
      weeks: weeks.map((w) => ({
        label: w.label,
        matches: w.matches.size,
        people: w.people.size,
        firstTime: w.firstTime,
        secondTime: w.secondTime,
        joined: w.joined,
      })),
      monthly: [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })),
      lapsed,
      distribution: {
        all: dist(players),
        active: dist((players as any[]).filter((p) => activeNames.has(p.name))),
      },
    });
  } catch (err: any) {
    console.error('[ops-summary] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
