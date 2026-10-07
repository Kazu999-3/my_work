import { NextRequest, NextResponse } from 'next/server';
import {
  fetchPuuidByRiotId,
  fetchRankedSoloMatchIds,
  fetchRecentMatchIds,
  fetchMatchDetails,
  fetchMatchTimeline,
} from '@/lib/riot';
import { supabase } from '@/lib/supabaseClient';
import { analyzePostgameTempo, loadItemMeta, type PostgameTempoReport } from '@/lib/postgameTempo';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

// 試合後: 詳細分析。2026-10-05 全面見直し。
// 旧版(04_PORTAL からの移植)はリコールのテンポ損失(`回数×30G`)・ワード監査の目標本数と評価・
// 「ダイヤ級」等のランク水準ラベル・勝率から出したレーダー値・合算モードの固定リコール3件など、
// 実データを見ていない値を多数返していた。ここでは Match-V5 の試合詳細とタイムラインに
// 実在する数値だけを、対面（敵チームの同ポジション）と並べて返す。良し悪しの採点はしない。
// 2026-10-06: 別タブだった「試合後: テンポ」を統合。同じ試合詳細・タイムラインから
// lib/postgameTempo.ts の15分テンポ逆再生・帰還テンポ・ビルド監査も算出して一緒に返す
// （以前は2つのタブがそれぞれ試合詳細6件＋タイムラインを取り直していた）。

type MatchResult = Awaited<ReturnType<typeof fetchMatchDetails>>;
type Participant = MatchResult['participants'][number];

const CONTROL_WARD_ITEM_ID = 2055;
/** レーン差の要約ラベルのしきい値（ゴールド差）。目安としてUIにも表示する */
const LANE_GOLD_THRESHOLDS = { big: 1000, small: 300 };

const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const fmtTs = (ms: number) => fmtDuration(Math.floor(ms / 1000));

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RIOT_API_KEY が未設定です。' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const requestedMatchId = searchParams.get('matchId') || '';
    const requestedSummoner = searchParams.get('summoner') || '';
    let puuid = searchParams.get('puuid') || '';

    if (!puuid && requestedSummoner) {
      const [gName = '', tLine = 'JP1'] = requestedSummoner.split('#').map((s) => s.trim());
      puuid = await fetchPuuidByRiotId(gName, tLine || 'JP1', apiKey);
    }
    // 旧ポータルは Riot ID 未指定時に特定プレイヤーへ黙って切り替えていたため、05では必須にしている(2026-10-04)
    if (!puuid) {
      return NextResponse.json({ error: 'Riot ID（名前#タグ）を入力してください。' }, { status: 400 });
    }

    let matchIds = await fetchRankedSoloMatchIds(puuid, apiKey, 6);
    if (matchIds.length === 0) matchIds = await fetchRecentMatchIds(puuid, apiKey, 6);
    if (matchIds.length === 0) {
      return NextResponse.json({ error: '直近の試合履歴が見つかりませんでした。' }, { status: 404 });
    }

    // 一覧用の試合詳細（タイムラインは選択した1試合分だけ取る）
    const detailsList = await Promise.all(
      matchIds.map((mId) => fetchMatchDetails(mId, apiKey).catch(() => null)),
    );

    const recentMatches = matchIds
      .map((mId, idx) => {
        const d = detailsList[idx];
        const me = d?.participants.find((p) => p.puuid === puuid);
        if (!d || !me) return null;
        return {
          matchId: mId,
          championName: me.championName,
          isWin: me.win,
          kdaStr: `${me.kills}/${me.deaths}/${me.assists}`,
          kills: me.kills,
          deaths: me.deaths,
          assists: me.assists,
          cs: me.totalMinionsKilled + me.neutralMinionsKilled,
          visionScore: me.visionScore,
          gameDurationStr: fmtDuration(d.gameDuration),
          gameDurationSec: d.gameDuration,
          gameStartTimestamp: d.gameStartTimestamp,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const n = recentMatches.length;
    const wins = recentMatches.filter((m) => m.isWin).length;
    const avg = (f: (m: (typeof recentMatches)[number]) => number, digits = 1) =>
      n > 0 ? Number((recentMatches.reduce((a, m) => a + f(m), 0) / n).toFixed(digits)) : 0;
    const cross_match_summary = {
      total_matches: n,
      wins,
      win_rate: n > 0 ? Math.round((wins / n) * 100) : 0,
      avg_kda: `${avg((m) => m.kills)} / ${avg((m) => m.deaths)} / ${avg((m) => m.assists)}`,
      avg_cs_per_min: avg((m) => m.cs / Math.max(1, m.gameDurationSec / 60)),
      avg_vision_score: avg((m) => m.visionScore),
    };

    // ---- 選択された1試合 ----
    const targetMatchId = requestedMatchId && matchIds.includes(requestedMatchId) ? requestedMatchId : matchIds[0];
    let match = detailsList[matchIds.indexOf(targetMatchId)];
    if (!match) {
      match = await fetchMatchDetails(targetMatchId, apiKey).catch(() => null);
    }
    if (!match) {
      return NextResponse.json({ error: '選択された試合詳細を取得できませんでした。' }, { status: 404 });
    }
    let timelineError: string | null = null;
    const [timeline, itemMeta] = await Promise.all([
      // 失敗理由（Riotの回数制限など）を画面に出すため握りつぶさない
      fetchMatchTimeline(targetMatchId, apiKey).catch((e) => { timelineError = e?.message || String(e); return null; }),
      loadItemMeta().catch((e) => { console.warn('[postgame-deep-analytics] item meta:', e); return null; }),
    ]);

    const me = match.participants.find((p) => p.puuid === puuid);
    if (!me) {
      return NextResponse.json({ error: '試合内に該当プレイヤーが見つかりませんでした。' }, { status: 404 });
    }
    // lane は lib/riot.ts で TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY に正規化済み
    const enemy = match.participants.find((p) => p.teamId !== me.teamId && p.lane === me.lane) || null;
    const durationMin = match.gameDuration / 60;

    // ---- レーン戦スナップショット（15分。15分前に終わった試合は最終フレーム） ----
    const frames: any[] = timeline?.info?.frames || [];
    const pidOf = (p: Participant | null) =>
      p ? timeline?.info?.participants?.find((tp: any) => tp.puuid === p.puuid)?.participantId ?? null : null;
    const myPid = pidOf(me);
    const enemyPid = pidOf(enemy);
    const snapMinute = Math.min(15, frames.length - 1);
    const snapOf = (pid: number | null) => {
      const pf = pid != null && snapMinute >= 1 ? frames[snapMinute]?.participantFrames?.[pid] : null;
      if (!pf) return null;
      return {
        cs: (pf.minionsKilled || 0) + (pf.jungleMinionsKilled || 0),
        gold: pf.totalGold || 0,
        xp: pf.xp || 0,
        level: pf.level || 0,
      };
    };
    const mySnap = snapOf(myPid);
    const enemySnap = snapOf(enemyPid);
    let lane_snapshot = null;
    if (mySnap) {
      const goldDiff = enemySnap ? mySnap.gold - enemySnap.gold : null;
      const { big, small } = LANE_GOLD_THRESHOLDS;
      const lane_result =
        goldDiff == null ? '対面データなし'
        : goldDiff >= big ? '大きくリード'
        : goldDiff >= small ? 'リード'
        : goldDiff > -small ? 'ほぼ互角'
        : goldDiff > -big ? 'ビハインド'
        : '大きくビハインド';
      lane_snapshot = {
        minute: snapMinute,
        me: mySnap,
        enemy: enemySnap,
        gold_diff: goldDiff,
        cs_diff: enemySnap ? mySnap.cs - enemySnap.cs : null,
        xp_diff: enemySnap ? mySnap.xp - enemySnap.xp : null,
        lane_result,
        thresholds: LANE_GOLD_THRESHOLDS,
      };
    }

    // ---- 試合全体の比較（自分 vs 対面） ----
    const statsOf = (p: Participant, m: MatchResult = match!) => {
      const sum = (teamId: number, f: (x: Participant) => number) =>
        m.participants.filter((x) => x.teamId === teamId).reduce((a, x) => a + f(x), 0);
      const tk = sum(p.teamId, (x) => x.kills);
      const td = sum(p.teamId, (x) => x.damageDealtToChampions);
      const durationMin = m.gameDuration / 60;
      return {
        cs_per_min: Number(((p.totalMinionsKilled + p.neutralMinionsKilled) / Math.max(1, durationMin)).toFixed(1)),
        gold_earned: p.goldEarned || 0,
        damage_to_champions: p.damageDealtToChampions,
        damage_share: td > 0 ? Math.round((p.damageDealtToChampions / td) * 100) : 0,
        kill_participation: tk > 0 ? Math.round(((p.kills + p.assists) / tk) * 100) : 0,
        deaths: p.deaths,
        vision_score: p.visionScore,
        vision_per_min: Number((p.visionScore / Math.max(1, durationMin)).toFixed(2)),
        wards_placed: p.wardsPlaced || 0,
        wards_killed: p.wardsKilled || 0,
        control_wards_bought: p.visionWardsBoughtInGame || 0,
      };
    };

    // ---- 目標との比較用: 直近の同じロールの試合の平均（試合詳細だけで出せる指標） ----
    const sameRole = matchIds
      .map((_, idx) => detailsList[idx])
      .map((d) => (d ? { d, p: d.participants.find((x) => x.puuid === puuid) } : null))
      .filter((x): x is { d: MatchResult; p: Participant } => !!x && !!x.p && x.p.lane === me.lane);
    const roleStats = sameRole.map(({ d, p }) => statsOf(p, d));
    const avgOf = (k: keyof ReturnType<typeof statsOf>) =>
      roleStats.length ? Number((roleStats.reduce((a, s) => a + s[k], 0) / roleStats.length).toFixed(2)) : null;
    const role_recent = {
      count: roleStats.length,
      avg: {
        cs_per_min: avgOf('cs_per_min'),
        deaths: avgOf('deaths'),
        vision_per_min: avgOf('vision_per_min'),
        kill_participation: avgOf('kill_participation'),
        damage_share: avgOf('damage_share'),
        control_wards_bought: avgOf('control_wards_bought'),
      },
    };

    // ---- コントロールワード購入時刻（ITEM_UNDO を反映） ----
    const controlWardTimes: number[] = [];
    if (myPid != null) {
      for (const f of frames) {
        for (const ev of f.events || []) {
          if (ev.participantId !== myPid) continue;
          if (ev.type === 'ITEM_PURCHASED' && ev.itemId === CONTROL_WARD_ITEM_ID) controlWardTimes.push(ev.timestamp);
          if (ev.type === 'ITEM_UNDO' && ev.beforeId === CONTROL_WARD_ITEM_ID) controlWardTimes.pop();
        }
      }
    }

    // 自動振り返り（ソロQ試合後の通知と同じ内容。cron が coach_analyses に保存）。DB読みのみでLLMは使わない。
    // 以前は通知から開いても、折りたたまれた「自動振り返りの履歴」を開いて行を押さないと見えなかった（2026-10-06）
    let auto_review: { weaknesses: string[]; focus: string | null; advice: string; created_at: string } | null = null;
    if (supabase) {
      const { data: rev } = await supabase
        .from('coach_analyses')
        .select('weaknesses, focus, advice, created_at')
        .eq('puuid', puuid).eq('match_id', targetMatchId)
        .not('advice', 'is', null)
        .maybeSingle();
      if (rev?.advice) {
        auto_review = {
          weaknesses: Array.isArray(rev.weaknesses) ? rev.weaknesses : [],
          focus: rev.focus || null,
          advice: rev.advice,
          created_at: rev.created_at,
        };
      }
    }

    // テンポ解析はタイムラインが必須。失敗しても詳細分析の残りは返す
    let tempo: PostgameTempoReport | null = null;
    let tempo_error: string | null = null;
    if (timeline && itemMeta) {
      try {
        tempo = analyzePostgameTempo(match, timeline, puuid, itemMeta);
      } catch (e: any) {
        tempo_error = e?.message || 'テンポ解析に失敗しました';
      }
    } else {
      tempo_error = timeline ? 'アイテム辞書(DDragon)を取得できませんでした' : (timelineError || 'タイムラインを取得できませんでした');
    }

    return NextResponse.json({
      success: true,
      selected_match_id: targetMatchId,
      recent_matches: recentMatches,
      cross_match_summary,
      my_champion: me.championName,
      enemy_champion: enemy?.championName || null,
      my_position: me.lane,
      is_win: me.win,
      match_duration_str: fmtDuration(match.gameDuration),
      game_duration_sec: match.gameDuration,
      my_cs: me.totalMinionsKilled + me.neutralMinionsKilled,
      kda_str: `${me.kills}/${me.deaths}/${me.assists}`,
      timeline_available: frames.length > 0,
      lane_snapshot,
      match_stats: { me: statsOf(me), enemy: enemy ? statsOf(enemy) : null },
      control_ward_times: controlWardTimes.map(fmtTs),
      role_recent,
      auto_review,
      timeline_error: timelineError,
      tempo,
      tempo_error,
    });
  } catch (error: any) {
    console.error('[postgame-deep-analytics] Error:', error);
    return NextResponse.json({ error: error.message || '詳細分析に失敗しました。' }, { status: 500 });
  }
}
