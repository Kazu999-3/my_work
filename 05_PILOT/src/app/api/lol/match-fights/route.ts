import { NextRequest, NextResponse } from 'next/server';
import {
  fetchPuuidByRiotId,
  fetchRankedSoloMatchIds,
  fetchRecentMatchIds,
  fetchMatchDetails,
  fetchMatchTimeline,
} from '@/lib/riot';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

// 集団戦レビュー。2026-10-05 見直し。
// 旧版は交戦ごとの「XXX dmg」(実際は試合全体の与ダメ÷交戦数×1.2/0.8)、ゴールド変動(キル差×400±600)、
// 時刻だけで決めた交戦名(「バロン/インヒビター決戦」等)、原因を断定する定型文(「CCチェーンを受け」等)、
// Shyvana専用の文面を返していた。タイムラインに記録されている事実(キル・デス・アシスト・
// エリートモンスター獲得・自分の関与)だけを返す。
// また killerId=0(タワー/ミニオンによる処刑)を「killerId<=5 なら味方」で判定していたため、
// 敵タワーに処刑されても味方キルに数えていた。キルの帰属は倒された側のチームで判定する。

type MatchResult = Awaited<ReturnType<typeof fetchMatchDetails>>;

/** 直前のキルからこの時間以内のキルは同じ交戦とみなす */
const FIGHT_GAP_MS = 25_000;
/** 交戦の前後この時間以内のエリートモンスター獲得は、その交戦に含める */
const OBJECTIVE_ATTACH_MS = 30_000;

const fmtTs = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const MONSTER_NAME: [string, string][] = [
  ['HORDE', 'ヴォイドグラブ'],
  ['RIFTHERALD', 'リフトヘラルド'],
  ['BARON', 'バロン'],
  ['ELDER', 'エルダードラゴン'],
  ['ATAKHAN', 'アタカン'],
  ['CHEMTECH', 'ケミテックドラゴン'],
  ['HEXTECH', 'ヘクステックドラゴン'],
  ['FIRE', 'インファーナルドラゴン'],
  ['EARTH', 'マウンテンドラゴン'],
  ['WATER', 'オーシャンドラゴン'],
  ['AIR', 'クラウドドラゴン'],
  ['DRAGON', 'ドラゴン'],
];
// monsterSubType は FIRE_DRAGON / EARTH_DRAGON / ELDER_DRAGON 等。無い場合は monsterType(DRAGON/BARON_NASHOR/HORDE/RIFTHERALD/ATAKHAN)
const monsterName = (ev: any) => {
  const raw = String(ev.monsterSubType || ev.monsterType || '').toUpperCase();
  return MONSTER_NAME.find(([k]) => raw.includes(k))?.[1] || raw.replace(/_/g, ' ');
};

interface KillEv { ts: number; allyKill: boolean; mine: 'kill' | 'assist' | 'death' | null }
interface ObjEv { ts: number; name: string; ally: boolean }

function extractFights(details: MatchResult, timeline: any, puuid: string) {
  const me = details.participants.find((p) => p.puuid === puuid);
  const tlParticipants: any[] = timeline?.info?.participants || [];
  const myPid = tlParticipants.find((p) => p.puuid === puuid)?.participantId;
  if (!me || myPid == null) return null;

  // participantId → teamId（タイムラインの puuid で突き合わせる）
  const teamOf = new Map<number, number>();
  for (const tp of tlParticipants) {
    const p = details.participants.find((x) => x.puuid === tp.puuid);
    if (p) teamOf.set(tp.participantId, p.teamId);
  }

  const kills: KillEv[] = [];
  const objs: ObjEv[] = [];
  for (const f of timeline?.info?.frames || []) {
    for (const ev of f.events || []) {
      if (ev.type === 'CHAMPION_KILL') {
        const victimTeam = teamOf.get(ev.victimId);
        if (victimTeam == null) continue;
        const mine = ev.victimId === myPid ? 'death'
          : ev.killerId === myPid ? 'kill'
          : (ev.assistingParticipantIds || []).includes(myPid) ? 'assist'
          : null;
        kills.push({ ts: ev.timestamp, allyKill: victimTeam !== me.teamId, mine });
      } else if (ev.type === 'ELITE_MONSTER_KILL') {
        const team = ev.killerTeamId ?? teamOf.get(ev.killerId);
        if (team == null) continue;
        objs.push({ ts: ev.timestamp, name: monsterName(ev), ally: team === me.teamId });
      }
    }
  }

  const clusters: { start: number; end: number; kills: KillEv[]; objs: ObjEv[] }[] = [];
  for (const k of kills) {
    const last = clusters[clusters.length - 1];
    if (last && k.ts - last.end <= FIGHT_GAP_MS) {
      last.end = k.ts;
      last.kills.push(k);
    } else {
      clusters.push({ start: k.ts, end: k.ts, kills: [k], objs: [] });
    }
  }
  for (const o of objs) {
    const c = clusters.find((c) => o.ts >= c.start - OBJECTIVE_ATTACH_MS && o.ts <= c.end + OBJECTIVE_ATTACH_MS);
    if (c) c.objs.push(o);
    else clusters.push({ start: o.ts, end: o.ts, kills: [], objs: [o] });
  }

  // 2キル以上・オブジェクト絡み・自分が関与した交戦だけを残す
  const significant = clusters
    .filter((c) => c.kills.length >= 2 || c.objs.length > 0 || c.kills.some((k) => k.mine))
    .sort((a, b) => a.start - b.start);

  const summarize = (list: ObjEv[]) => {
    const counts = new Map<string, number>();
    list.forEach((o) => counts.set(o.name, (counts.get(o.name) || 0) + 1));
    return Array.from(counts, ([name, c]) => (c > 1 ? `${name} x${c}` : name));
  };

  let won = 0, lost = 0, even = 0;
  const fights = significant.map((c, idx) => {
    const ally_kills = c.kills.filter((k) => k.allyKill).length;
    const enemy_kills = c.kills.length - ally_kills;
    const allyObjs = summarize(c.objs.filter((o) => o.ally));
    const enemyObjs = summarize(c.objs.filter((o) => !o.ally));
    // キル差で判定し、同数ならオブジェクトを取った側。どちらも同じなら互角
    const score = ally_kills - enemy_kills || allyObjs.length - enemyObjs.length;
    const result = score > 0 ? 'WON' : score < 0 ? 'LOST' : 'EVEN';
    if (result === 'WON') won++; else if (result === 'LOST') lost++; else even++;

    const my = {
      kills: c.kills.filter((k) => k.mine === 'kill').length,
      assists: c.kills.filter((k) => k.mine === 'assist').length,
      died: c.kills.some((k) => k.mine === 'death'),
    };
    const involved = my.kills + my.assists > 0 || my.died;

    return {
      fight_id: idx + 1,
      time_str: fmtTs(c.end) !== fmtTs(c.start) ? `${fmtTs(c.start)}〜${fmtTs(c.end)}` : fmtTs(c.start),
      result,
      ally_kills,
      enemy_kills,
      ally_objectives: allyObjs,
      enemy_objectives: enemyObjs,
      involved,
      my_kills: my.kills,
      my_assists: my.assists,
      my_died: my.died,
    };
  });

  return { champion: me.championName, fights, won, lost, even };
}

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

    // 試合の選択肢は詳細分析カード側が持つため、ここでは対象1試合だけを解析する
    let matchId = requestedMatchId;
    if (!matchId) {
      let ids = await fetchRankedSoloMatchIds(puuid, apiKey, 1);
      if (ids.length === 0) ids = await fetchRecentMatchIds(puuid, apiKey, 1);
      matchId = ids[0];
    }
    if (!matchId) {
      return NextResponse.json({ error: '直近の試合履歴が見つかりませんでした。' }, { status: 404 });
    }

    const [details, timeline] = await Promise.all([
      fetchMatchDetails(matchId, apiKey),
      fetchMatchTimeline(matchId, apiKey).catch(() => null),
    ]);
    if (!timeline) {
      return NextResponse.json({ error: 'この試合のタイムラインを取得できませんでした。' }, { status: 404 });
    }
    const res = extractFights(details, timeline, puuid);
    if (!res) {
      return NextResponse.json({ error: '試合内に該当プレイヤーが見つかりませんでした。' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      selected_match_id: matchId,
      champion: res.champion,
      total_fights: res.fights.length,
      won_fights: res.won,
      lost_fights: res.lost,
      even_fights: res.even,
      involved_fights: res.fights.filter((f) => f.involved).length,
      fights: res.fights,
      rules: { fight_gap_sec: FIGHT_GAP_MS / 1000, objective_attach_sec: OBJECTIVE_ATTACH_MS / 1000 },
    });
  } catch (error: any) {
    console.error('[match-fights] Error:', error);
    return NextResponse.json({ error: error?.message || '集団戦解析エラー' }, { status: 500 });
  }
}
