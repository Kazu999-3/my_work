import type { fetchMatchDetails } from './riot';

// 集団戦レビューの解析（2026-10-06、/api/lol/match-fights から移動）。
// タイムラインに記録された事実(キル・デス・アシスト・エリートモンスター獲得・自分の関与)だけを返す。
// 旧版の推定ダメージ・ゴールド変動・原因を断定する定型文は根拠が無いため2026-10-05に削除した。
// キルの帰属は倒された側のチームで判定する（killerId=0 のタワー/ミニオン処刑を味方キルに数えないため）。
// 詳細分析(postgame-deep-analytics)が同じ試合詳細・タイムラインから一緒に計算して返す。

type MatchResult = Awaited<ReturnType<typeof fetchMatchDetails>>;

/** 直前のキルからこの時間以内のキルは同じ交戦とみなす */
const FIGHT_GAP_MS = 25_000;
/** 交戦の前後この時間以内のエリートモンスター獲得は、その交戦に含める */
const OBJECTIVE_ATTACH_MS = 30_000;
export const FIGHT_RULES = { fight_gap_sec: FIGHT_GAP_MS / 1000, objective_attach_sec: OBJECTIVE_ATTACH_MS / 1000 };

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

export function extractFights(details: MatchResult, timeline: any, puuid: string) {
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
