import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getCalendarPatch } from '@/lib/ddragonClient';

export const dynamic = 'force-dynamic';

// 運用ダッシュボード（旧ポータル /admin/dashboard の移植）。2026-10-04
//
// 旧版から変えた点:
// - 「Webポータル」「Discord Bot」は何も測らずに常に「稼働中」を出していた。測れないものは出さず、
//   Botは「最後にBotが書いた記録の時刻」で代わりに示す。
// - /api/admin/health はVercel上でリポジトリのファイルを読めず常に ALL GREEN を返していた（brokenLinks: 0 等も固定値）。移植しない。
// - PCワーカーの死活は /api/youtube/worker-status（デーモン専用ハートビート …0005）を画面側で使う。
//   旧版の共有行 …0000 は GitHub Actions も更新するため、デーモン停止中でも稼働中に見えていた。
// - 旧版は kbStats を集計していたが画面に出していなかった。表示する。

const HEARTBEAT_IDS = ['00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000005'];

// 「要対応」に出すタスク種別（旧版と同じ）
const ATTENTION_TASK_TYPES = [
  'champion_trend', 'resolve_youtube_channel', 'resolve_youtube_playlist', 'youtube_channel_monitor',
  'reddit_scout', 'lol_trend_collect', 'dict_synthesizer', 'champion_db_bulk_update',
];

// Gemini の利用枠切れ・意図的なスキップは「要対応」から除く（時間が経てば自然に解消するため）
function isTransientFailure(t: { task_type: string; error_message: string | null }): boolean {
  const msg = String(t.error_message || '').toLowerCase();
  if (t.task_type === 'champion_db_bulk_update' && (msg.includes('自動的に再キュー') || msg.includes('3600秒'))) return true;
  return ['quota', '429', 'resource_exhausted', 'クォータ', '利用上限', '安全にスキップ', 'skipped'].some((k) => msg.includes(k));
}

// コイン残高は列・role_preferences・metadata の3か所に分散している（旧ポータル lib/playerCoins.ts と同じ優先順位）
function getPlayerCoins(p: any): number {
  const col = typeof p?.coins === 'number' ? p.coins : null;
  const pref = typeof p?.role_preferences?.coins === 'number' ? p.role_preferences.coins : null;
  const meta = typeof p?.metadata?.coins === 'number' ? p.metadata.coins : null;
  if (col !== null && col !== 1000) return col;
  if (pref !== null) return pref;
  if (meta !== null) return meta;
  if (col !== null) return col;
  return 1000;
}

export async function GET() {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const since8d = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();

    const [
      recentTasks, ytErrors, metricsRow, dictReviewNotif, dictFacts,
      players, matches, pendingBets, tasks24h,
      factsCount, libraryCount, laneGuidesCount, memosCount, matchupLogCount,
      lastRecruitment,
    ] = await Promise.all([
      supabase.from('edge_tasks').select('id, task_type, payload, status, error_message, updated_at')
        .in('status', ['failed', 'completed']).in('task_type', ATTENTION_TASK_TYPES)
        .order('updated_at', { ascending: false }).limit(200),
      supabase.from('youtube_queue').select('id', { count: 'exact', head: true })
        .in('status', ['error_generation', 'error_no_transcript', 'failed']),
      supabase.from('matchup_sentinel').select('raw_data').eq('matchup_id', 'SYSTEM_METRICS').maybeSingle(),
      supabase.from('admin_notifications').select('data, created_at').eq('type', 'dict_review').eq('read', false)
        .gt('created_at', since8d).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('champion_facts').select('confidence, patch, strengths'),
      supabase.from('ktm_players').select('id, name, highest_rank, coins, role_preferences, metadata, is_active'),
      supabase.from('ktm_matches').select('id, created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('edge_tasks').select('payload').eq('task_type', 'bet_record').eq('status', 'pending'),
      supabase.from('edge_tasks').select('status').gte('created_at', since24h)
        .not('id', 'in', `(${HEARTBEAT_IDS.join(',')})`),
      supabase.from('matchup_sentinel').select('champion', { count: 'exact', head: true })
        .eq('enemy', 'GLOBAL').not('strategy', 'is', null).neq('strategy', ''),
      supabase.from('personal_knowledge').select('id', { count: 'exact', head: true })
        .or('tags.is.null,tags.not.cs.{__DELETED__}'),
      supabase.from('lane_guides').select('id', { count: 'exact', head: true }),
      supabase.from('matchup_sentinel').select('matchup_id', { count: 'exact', head: true }).neq('enemy', 'GLOBAL'),
      supabase.from('matchup_log').select('id', { count: 'exact', head: true }),
      supabase.from('recruitments').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    // (task_type, payload) ごとに最新の1件だけを見て、それが失敗のままのものを「要対応」とする
    const latestByKey = new Map<string, any>();
    for (const t of recentTasks.data || []) {
      const key = `${t.task_type}|${JSON.stringify(t.payload || {})}`;
      if (!latestByKey.has(key)) latestByKey.set(key, t);
    }
    const failedTasks = [...latestByKey.values()]
      .filter((t) => t.status === 'failed' && !isTransientFailure(t))
      .slice(0, 10);

    // 24時間のタスク実績（llm-health 規約: 成功1件ではなく失敗件数・未処理件数を実測で出す）
    const taskCounts = { completed: 0, failed: 0, pending: 0, running: 0 };
    for (const r of tasks24h.data || []) {
      if (r.status in taskCounts) taskCounts[r.status as keyof typeof taskCounts]++;
    }

    const currentPatch = await getCalendarPatch();
    const dictHealth = { verified: 0, aiGenerated: 0, stale: 0 };
    for (const row of (dictFacts.data || []) as any[]) {
      const p = String(row.patch || '').split('.').slice(0, 2).join('.');
      const conf = row.confidence || 'ai_generated';
      if (conf === 'verified') dictHealth.verified++;
      else if (!row.strengths || p !== currentPatch || conf === 'stale') dictHealth.stale++;
      else dictHealth.aiGenerated++;
    }

    const activePlayers = (players.data || []).filter((p: any) => p.is_active !== false);
    const matchList = matches.data || [];
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;

    let blueAmount = 0, redAmount = 0, blueCount = 0, redCount = 0;
    for (const b of pendingBets.data || []) {
      const p: any = b.payload || {};
      const amt = Number(p.amount) || 0;
      const side = String(p.side || '').toLowerCase();
      if (side === 'blue') { blueAmount += amt; blueCount++; }
      else if (side === 'red') { redAmount += amt; redCount++; }
    }

    return NextResponse.json({
      success: true,
      needsAttention: {
        failedTasks,
        youtubeErrorCount: ytErrors.count ?? 0,
        dictReviewCount: (dictReviewNotif.data?.data as any)?.needsAttention ?? 0,
      },
      tasks24h: taskCounts,
      cloudWorkers: (metricsRow.data?.raw_data as any)?.cloud_workers || {},
      bot: { lastRecruitmentAt: lastRecruitment.data?.created_at || null },
      ktm: {
        activePlayers: activePlayers.length,
        totalMatches: matchList.length,
        recentMatches: matchList.filter((m: any) => new Date(m.created_at).getTime() >= weekAgo).length,
        latestMatchAt: matchList[0]?.created_at || null,
      },
      casino: {
        totalCirculatingCoins: activePlayers.reduce((acc: number, p: any) => acc + getPlayerCoins(p), 0),
        topPlayers: activePlayers
          .map((p: any) => ({ id: p.id, name: p.name, coins: getPlayerCoins(p) }))
          .sort((a, b) => b.coins - a.coins)
          .slice(0, 5),
        pendingBet: { blueAmount, redAmount, blueCount, redCount },
      },
      knowledge: {
        facts: factsCount.count ?? 0,
        library: libraryCount.count ?? 0,
        laneGuides: laneGuidesCount.count ?? 0,
        matchupMemos: memosCount.count ?? 0,
        matchupLog: matchupLogCount.count ?? 0,
      },
      dictHealth,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[admin/ops-dashboard] Error:', e);
    return NextResponse.json({ error: e.message || '取得に失敗しました' }, { status: 500 });
  }
}
