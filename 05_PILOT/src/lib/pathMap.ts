// 試合後の「道筋マップ」用に、自分と敵JGの位置をタイムラインから切り出す（2026-10-20）。
//
// Riot の Match-V5 タイムラインで取れる位置は次の2つだけ（秒単位の移動経路は公開 API に無い）:
//  - 1分ごとの全員の位置（frames[n].participantFrames[pid].position）
//  - キル・デス・アシスト・エリートモンスター（ドラゴン等）が起きた場所と時刻（events[].position）
// 出来事はその瞬間の場所が分かるので、1分ごとの点の間に挟むと動きを少し細かく追える。
// 座標はサモナーズリフトの x: 0〜14870 / y: 0〜14980（左下が原点）。

export type PathPointKind = 'frame' | 'kill' | 'death' | 'assist' | 'objective';

export interface PathPoint {
  /** 試合開始からの秒数 */
  t: number;
  x: number;
  y: number;
  kind: PathPointKind;
  /** 出来事の説明（frame 以外） */
  label?: string;
}

export interface PathTrack {
  key: 'me' | 'enemyJg';
  label: string;
  champion: string;
  points: PathPoint[];
}

export interface PathMapReport {
  durationSec: number;
  tracks: PathTrack[];
}

const MONSTER_LABEL: Record<string, string> = {
  DRAGON: 'ドラゴン',
  BARON_NASHOR: 'バロン',
  RIFTHERALD: 'ヘラルド',
  HORDE: 'ヴォイドグラブ',
  ATAKHAN: 'アタカン',
};

export function buildPathMap(match: any, timeline: any, puuid: string): PathMapReport | null {
  const frames: any[] = timeline?.info?.frames || [];
  if (frames.length === 0) return null;
  const participants: any[] = match?.participants || [];
  const me = participants.find((p) => p.puuid === puuid);
  if (!me) return null;
  const enemyJg = participants.find((p) => p.teamId !== me.teamId && p.lane === 'JUNGLE') || null;
  const pidOf = (p: any) =>
    p ? timeline?.info?.participants?.find((tp: any) => tp.puuid === p.puuid)?.participantId ?? null : null;
  const champOf = (pid: number) => participants.find((p) => pidOf(p) === pid)?.championName || '?';

  const buildTrack = (key: PathTrack['key'], label: string, p: any): PathTrack | null => {
    const pid = pidOf(p);
    if (pid == null) return null;
    const points: PathPoint[] = [];
    frames.forEach((f, i) => {
      const pos = f?.participantFrames?.[pid]?.position;
      if (pos && typeof pos.x === 'number') points.push({ t: Math.round((f.timestamp ?? i * 60000) / 1000), x: pos.x, y: pos.y, kind: 'frame' });
    });
    for (const f of frames) {
      for (const ev of f?.events || []) {
        const pos = ev?.position;
        if (!pos || typeof pos.x !== 'number') continue;
        const t = Math.round((ev.timestamp || 0) / 1000);
        if (ev.type === 'CHAMPION_KILL') {
          if (ev.killerId === pid) points.push({ t, x: pos.x, y: pos.y, kind: 'kill', label: `${champOf(ev.victimId)} をキル` });
          else if (ev.victimId === pid) points.push({ t, x: pos.x, y: pos.y, kind: 'death', label: `${champOf(ev.killerId)} にデス` });
          else if ((ev.assistingParticipantIds || []).includes(pid)) points.push({ t, x: pos.x, y: pos.y, kind: 'assist', label: `${champOf(ev.victimId)} のキルにアシスト` });
        } else if (ev.type === 'ELITE_MONSTER_KILL' && (ev.killerId === pid || (ev.assistingParticipantIds || []).includes(pid))) {
          const name = MONSTER_LABEL[ev.monsterType] || ev.monsterType || 'モンスター';
          points.push({ t, x: pos.x, y: pos.y, kind: 'objective', label: `${name}を獲得` });
        }
      }
    }
    points.sort((a, b) => a.t - b.t);
    return { key, label, champion: p.championName, points };
  };

  const tracks = [
    buildTrack('me', '自分', me),
    enemyJg && pidOf(enemyJg) !== pidOf(me) ? buildTrack('enemyJg', '敵JG', enemyJg) : null,
  ].filter(Boolean) as PathTrack[];

  return { durationSec: Math.round(match?.gameDuration || 0), tracks };
}
