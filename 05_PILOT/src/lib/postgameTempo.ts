/**
 * 試合後ディープアナリティクス（15分テンポ逆再生 ＋ ビルド監査）
 *
 * Match-V5 の試合詳細とタイムラインだけを入力にした純粋関数。
 * 旧ポータル(04_PORTAL)の postgame-deep-analytics はリコール評価・ビルド評価を
 * 固定値や勝敗から出していたため流用していない。ここで返す値はすべて
 * タイムラインの実測値から計算し、判定に使うしきい値は下の定数に明示する。
 *
 * 計測上の限界:
 * - Riot API にリコールイベントは無い。「アイテム購入のまとまり」を帰還とみなすため、
 *   何も買わなかった帰還は検出できない。
 * - フレームは1分刻み。帰還の前後比較は分単位のスナップショット同士の差になる。
 */

import { fetchMatchDetails } from './riot';
import { getLatestPatch } from './ddragonClient';

type MatchResult = Awaited<ReturnType<typeof fetchMatchDetails>>;

// ---- 判定しきい値（目安。根拠のある公式値ではないためUIにもそのまま表示する） ----
/** この秒数以内に連続した購入は1回の帰還とみなす */
const TRIP_GAP_MS = 60_000;
/** 開始からこの時間内の購入は初期購入 */
const START_ITEMS_MS = 90_000;
/** デスからこの時間内の購入はデス帰還（復活後の買い物）とみなす */
const DEATH_TRIP_WINDOW_MS = 90_000;
/** 1分間でこれ以上ゴールド差/CS差が悪化した区間を「テンポロス区間」とする */
const LOSS_GOLD_PER_MIN = -150;
const LOSS_CS_PER_MIN = -3;
/** 回復主体の敵: 試合全体の回復量中央値のこの倍率以上、かつ毎分この量以上 */
const HEAVY_HEAL_MEDIAN_RATIO = 2;
const HEAVY_HEAL_PER_MIN = 400;
/** 靴の属性ミスマッチ判定: 敵のダメージのうちこの割合以上が片方の属性 */
const DAMAGE_SKEW_RATIO = 0.6;
/** 上位靴（2段階目）の完成目安（分） */
const BOOTS_T2_TARGET_MIN = 15;
const BOOTS_T2_TARGET_MIN_SUPPORT = 18;
const BOOTS_LATE_MARGIN_MIN = 5;
/** 重傷アイテムの購入タイミング目安（分） */
const GW_EARLY_MIN = 15;
const GW_STANDARD_MIN = 20;

export const TEMPO_THRESHOLDS = {
  LOSS_GOLD_PER_MIN,
  LOSS_CS_PER_MIN,
  HEAVY_HEAL_MEDIAN_RATIO,
  HEAVY_HEAL_PER_MIN,
  DAMAGE_SKEW_RATIO,
  BOOTS_T2_TARGET_MIN,
  BOOTS_T2_TARGET_MIN_SUPPORT,
  GW_EARLY_MIN,
  GW_STANDARD_MIN,
};

// ==========================================
// DDragon アイテム情報
// ==========================================
export interface ItemMeta {
  name: string;
  /** 0=靴以外 / 1=ブーツ / 2=上位靴 / 3=上位靴の強化版 */
  bootsTier: 0 | 1 | 2 | 3;
  armor: number;
  magicResist: number;
  /** 重傷（Wounds）を付与するアイテムか */
  appliesWounds: boolean;
}

let cachedItemMeta: { patch: string; map: Map<number, ItemMeta> } | null = null;

// 重傷アイテムや靴のIDは手書きしない。パッチでIDや効果が変わっても追従できるよう
// DDragon の説明文（英語版の "Wounds" キーワード）とタグから毎回判定する。
export async function loadItemMeta(): Promise<Map<number, ItemMeta>> {
  const patch = await getLatestPatch();
  if (cachedItemMeta && cachedItemMeta.patch === patch) return cachedItemMeta.map;

  const [jaRes, enRes] = await Promise.all([
    fetch(`https://ddragon.leagueoflegends.com/cdn/${patch}/data/ja_JP/item.json`),
    fetch(`https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/item.json`),
  ]);
  if (!jaRes.ok || !enRes.ok) {
    throw new Error(`DDragon item.json の取得に失敗しました (ja: ${jaRes.status}, en: ${enRes.status})`);
  }
  const ja = (await jaRes.json()).data || {};
  const en = (await enRes.json()).data || {};

  const map = new Map<number, ItemMeta>();
  for (const [idStr, raw] of Object.entries<any>(en)) {
    const id = Number(idStr);
    const isBoots = Array.isArray(raw.tags) && raw.tags.includes('Boots');
    const depth = Number(raw.depth) || 1;
    map.set(id, {
      name: ja[idStr]?.name || raw.name || `Item_${id}`,
      bootsTier: isBoots ? (Math.min(3, depth) as 1 | 2 | 3) : 0,
      armor: Number(raw.stats?.FlatArmorMod) || 0,
      magicResist: Number(raw.stats?.FlatSpellBlockMod) || 0,
      appliesWounds: /\bWounds\b/.test(String(raw.description || '')),
    });
  }
  cachedItemMeta = { patch, map };
  return map;
}

// ==========================================
// 出力の型
// ==========================================
export interface ShoppingTrip {
  kind: 'start' | 'recall' | 'death';
  startMs: number;
  timeStr: string;
  items: string[];
  /** 直前フレーム（分単位）時点の所持金 */
  goldBefore: number | null;
  goldBeforeAtMin: number | null;
}

export interface RecallTempo extends ShoppingTrip {
  /** 帰還を含む2分間で、自分のCS増加 − 対面のCS増加 */
  relCs: number | null;
  /** 同じ2分間のゴールド差の変化 */
  relGold: number | null;
  windowStr: string;
  /** 対面も前後60秒以内に帰還していた（＝テンポは相殺） */
  opponentAlsoBacked: boolean;
}

export interface MinuteRow {
  minute: number;
  myCs: number;
  oppCs: number | null;
  csDiff: number | null;
  goldDiff: number | null;
  xpDiff: number | null;
  dCsDiff: number | null;
  dGoldDiff: number | null;
  cause: 'death' | 'recall' | 'lane';
  events: string[];
}

export interface TempoLossSegment {
  minute: number;
  dCsDiff: number;
  dGoldDiff: number;
  cause: MinuteRow['cause'];
  events: string[];
}

export interface BuildAuditCheck {
  status: 'good' | 'ok' | 'warn' | 'na';
  verdict: string;
  details: string[];
}

export interface PostgameTempoReport {
  matchId: string;
  myChampion: string;
  opponentChampion: string | null;
  position: string;
  isWin: boolean;
  durationStr: string;
  kdaStr: string;
  analyzedUntilMin: number;
  replay: {
    rows: MinuteRow[];
    lossSegments: TempoLossSegment[];
    breakdown: { cause: MinuteRow['cause']; minutes: number; csDiff: number; goldDiff: number }[];
    final: { csDiff: number | null; goldDiff: number | null; xpDiff: number | null };
  };
  recalls: RecallTempo[];
  buildAudit: {
    boots: BuildAuditCheck;
    grievousWounds: BuildAuditCheck;
  };
  thresholds: typeof TEMPO_THRESHOLDS;
}

// ==========================================
// ヘルパー
// ==========================================
const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const MONSTER_LABEL: Record<string, string> = {
  DRAGON: 'ドラゴン',
  RIFTHERALD: 'ヘラルド',
  HORDE: 'ヴォイドグラブ',
  BARON_NASHOR: 'バロン',
  ATAKHAN: 'アタカン',
};

interface Purchase { itemId: number; ts: number }

/** ITEM_UNDO（購入取り消し）を反映した購入履歴 */
function collectPurchases(events: any[], pid: number): Purchase[] {
  const list: Purchase[] = [];
  for (const ev of events) {
    if (ev.participantId !== pid) continue;
    if (ev.type === 'ITEM_PURCHASED') {
      list.push({ itemId: ev.itemId, ts: ev.timestamp });
    } else if (ev.type === 'ITEM_UNDO' && ev.beforeId && !ev.afterId) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].itemId === ev.beforeId) { list.splice(i, 1); break; }
      }
    }
  }
  return list;
}

function groupTrips(purchases: Purchase[], deathTimes: number[]): { kind: ShoppingTrip['kind']; startMs: number; purchases: Purchase[] }[] {
  const trips: { kind: ShoppingTrip['kind']; startMs: number; purchases: Purchase[] }[] = [];
  for (const p of purchases) {
    const last = trips[trips.length - 1];
    const lastTs = last ? last.purchases[last.purchases.length - 1].ts : -Infinity;
    if (last && p.ts - lastTs <= TRIP_GAP_MS) {
      last.purchases.push(p);
    } else {
      trips.push({ kind: 'recall', startMs: p.ts, purchases: [p] });
    }
  }
  for (const t of trips) {
    if (t.startMs < START_ITEMS_MS) t.kind = 'start';
    else if (deathTimes.some((d) => d <= t.startMs && t.startMs - d <= DEATH_TRIP_WINDOW_MS)) t.kind = 'death';
  }
  return trips;
}

// ==========================================
// 本体
// ==========================================
export function analyzePostgameTempo(
  match: MatchResult,
  timeline: any,
  puuid: string,
  items: Map<number, ItemMeta>,
): PostgameTempoReport {
  const me = match.participants.find((p) => p.puuid === puuid);
  if (!me) throw new Error('試合内に対象プレイヤーが見つかりませんでした。');

  // 対面は「同じポジションの敵」に限定する。見つからない試合で別レーンの敵と
  // 比べると差分が無意味になるため、その場合は対面比較を出さない。
  const opp = match.participants.find((p) => p.teamId !== me.teamId && p.lane === me.lane) || null;

  const tlParticipants: any[] = timeline?.info?.participants || [];
  const pidOf = (pu: string) => tlParticipants.find((p) => p.puuid === pu)?.participantId as number | undefined;
  const myPid = pidOf(me.puuid);
  if (!myPid) throw new Error('タイムライン内に対象プレイヤーが見つかりませんでした。');
  const oppPid = opp ? pidOf(opp.puuid) : undefined;

  const frames: any[] = timeline?.info?.frames || [];
  const events: any[] = frames.flatMap((f) => f.events || []);
  const champOfPid = new Map<number, string>();
  for (const p of match.participants) {
    const pid = pidOf(p.puuid);
    if (pid) champOfPid.set(pid, p.championName);
  }
  const allyPids = match.participants.filter((p) => p.teamId === me.teamId).map((p) => pidOf(p.puuid)).filter((x): x is number => !!x);
  const enemyPids = match.participants.filter((p) => p.teamId !== me.teamId).map((p) => pidOf(p.puuid)).filter((x): x is number => !!x);

  const kills = events.filter((e) => e.type === 'CHAMPION_KILL');
  const deathTimesOf = (pid: number) => kills.filter((e) => e.victimId === pid).map((e) => e.timestamp as number);

  const csAt = (min: number, pid: number) => {
    const pf = frames[min]?.participantFrames?.[pid];
    return pf ? (pf.minionsKilled || 0) + (pf.jungleMinionsKilled || 0) : 0;
  };
  const goldAt = (min: number, pid: number) => frames[min]?.participantFrames?.[pid]?.totalGold ?? 0;
  const xpAt = (min: number, pid: number) => frames[min]?.participantFrames?.[pid]?.xp ?? 0;
  const curGoldAt = (min: number, pid: number) => frames[min]?.participantFrames?.[pid]?.currentGold ?? null;

  // 最終フレームは試合終了時点（分の途中）なので、15分以内に終わった試合では1つ手前までにする
  const lastFullMin = Math.max(0, frames.length - 2);
  const untilMin = Math.min(15, lastFullMin);

  // ---- 帰還（購入のまとまり） ----
  const myPurchases = collectPurchases(events, myPid);
  const myTrips = groupTrips(myPurchases, deathTimesOf(myPid));
  const oppTrips = oppPid ? groupTrips(collectPurchases(events, oppPid), deathTimesOf(oppPid)) : [];

  const toTrip = (t: { kind: ShoppingTrip['kind']; startMs: number; purchases: Purchase[] }): ShoppingTrip => {
    const minBefore = Math.floor(t.startMs / 60000);
    return {
      kind: t.kind,
      startMs: t.startMs,
      timeStr: fmt(t.startMs),
      items: t.purchases.map((p) => items.get(p.itemId)?.name || `アイテム #${p.itemId}`),
      goldBefore: t.kind === 'start' ? null : curGoldAt(minBefore, myPid),
      goldBeforeAtMin: t.kind === 'start' ? null : minBefore,
    };
  };

  const recalls: RecallTempo[] = myTrips
    .filter((t) => t.kind !== 'start' && t.startMs <= 15 * 60000)
    .map((t) => {
      const base = toTrip(t);
      const a = Math.floor(t.startMs / 60000);
      const b = Math.min(a + 2, frames.length - 1);
      const hasOpp = !!oppPid && b > a;
      const relCs = hasOpp ? (csAt(b, myPid) - csAt(a, myPid)) - (csAt(b, oppPid!) - csAt(a, oppPid!)) : null;
      const relGold = hasOpp
        ? (goldAt(b, myPid) - goldAt(b, oppPid!)) - (goldAt(a, myPid) - goldAt(a, oppPid!))
        : null;
      return {
        ...base,
        relCs,
        relGold,
        windowStr: `${a}:00〜${b}:00`,
        opponentAlsoBacked: oppTrips.some((o) => o.kind !== 'start' && Math.abs(o.startMs - t.startMs) <= 60_000),
      };
    });

  // ---- 分単位の逆再生テーブル ----
  const myDeathTimes = deathTimesOf(myPid);
  const myRecallTimes = myTrips.filter((t) => t.kind === 'recall').map((t) => t.startMs);
  const rows: MinuteRow[] = [];
  for (let m = 1; m <= untilMin; m++) {
    const lo = (m - 1) * 60000;
    const hi = m * 60000;
    const timed: { ts: number; text: string }[] = [];
    const push = (ts: number, icon: string, text: string) => timed.push({ ts, text: `${icon} ${fmt(ts)} ${text}` });
    for (const k of kills) {
      if (k.timestamp <= lo || k.timestamp > hi) continue;
      if (k.victimId === myPid) push(k.timestamp, '💀', `デス（${champOfPid.get(k.killerId) || 'タワー/ミニオン'}）`);
      else if (k.killerId === myPid) push(k.timestamp, '⚔️', `キル（${champOfPid.get(k.victimId) || '?'}）`);
      else if (k.assistingParticipantIds?.includes(myPid)) push(k.timestamp, '🤝', `アシスト（${champOfPid.get(k.victimId) || '?'}）`);
      else if (oppPid && k.victimId === oppPid) push(k.timestamp, '🎯', `対面デス`);
    }
    for (const t of myTrips) {
      if (t.kind !== 'start' && t.startMs > lo && t.startMs <= hi) {
        push(t.startMs, '🏠', `${t.kind === 'death' ? 'デス後の買い物' : '帰還'}`);
      }
    }
    for (const t of oppTrips) {
      if (t.kind === 'recall' && t.startMs > lo && t.startMs <= hi) push(t.startMs, '↩️', `対面が帰還`);
    }
    for (const e of events) {
      if (e.type === 'ELITE_MONSTER_KILL' && e.timestamp > lo && e.timestamp <= hi) {
        const ours = allyPids.includes(e.killerId) || e.killerTeamId === me.teamId;
        push(e.timestamp, '🐉', `${ours ? '味方' : '敵'}が${MONSTER_LABEL[e.monsterType] || e.monsterType}を獲得`);
      }
    }

    const windowLo = (m - 2) * 60000;
    const inWindow = (ts: number) => ts > windowLo && ts <= hi;
    const cause: MinuteRow['cause'] = myDeathTimes.some(inWindow) ? 'death' : myRecallTimes.some(inWindow) ? 'recall' : 'lane';

    const myCs = csAt(m, myPid);
    const oppCs = oppPid ? csAt(m, oppPid) : null;
    const csDiff = oppPid ? myCs - oppCs! : null;
    const goldDiff = oppPid ? goldAt(m, myPid) - goldAt(m, oppPid) : null;
    const xpDiff = oppPid ? xpAt(m, myPid) - xpAt(m, oppPid) : null;
    const prevCsDiff = oppPid ? csAt(m - 1, myPid) - csAt(m - 1, oppPid) : null;
    const prevGoldDiff = oppPid ? goldAt(m - 1, myPid) - goldAt(m - 1, oppPid) : null;
    rows.push({
      minute: m,
      myCs,
      oppCs,
      csDiff,
      goldDiff,
      xpDiff,
      dCsDiff: csDiff !== null && prevCsDiff !== null ? csDiff - prevCsDiff : null,
      dGoldDiff: goldDiff !== null && prevGoldDiff !== null ? goldDiff - prevGoldDiff : null,
      cause,
      events: timed.sort((a, b) => a.ts - b.ts).map((t) => t.text),
    });
  }

  const lossSegments: TempoLossSegment[] = rows
    .filter((r) => r.dGoldDiff !== null && r.dCsDiff !== null && (r.dGoldDiff <= LOSS_GOLD_PER_MIN || r.dCsDiff <= LOSS_CS_PER_MIN))
    .map((r) => ({ minute: r.minute, dCsDiff: r.dCsDiff!, dGoldDiff: r.dGoldDiff!, cause: r.cause, events: r.events }))
    .sort((a, b) => a.dGoldDiff - b.dGoldDiff)
    .slice(0, 5);

  const breakdown = (['death', 'recall', 'lane'] as const).map((cause) => {
    const rs = rows.filter((r) => r.cause === cause);
    return {
      cause,
      minutes: rs.length,
      csDiff: rs.reduce((s, r) => s + (r.dCsDiff ?? 0), 0),
      goldDiff: rs.reduce((s, r) => s + (r.dGoldDiff ?? 0), 0),
    };
  });

  const lastRow = rows[rows.length - 1];

  // ==========================================
  // ビルド監査: 靴
  // ==========================================
  const enemyDamageAt = (min: number) => {
    let phys = 0, magic = 0, trueDmg = 0;
    for (const pid of enemyPids) {
      const ds = frames[min]?.participantFrames?.[pid]?.damageStats;
      phys += ds?.physicalDamageDoneToChampions || 0;
      magic += ds?.magicDamageDoneToChampions || 0;
      trueDmg += ds?.trueDamageDoneToChampions || 0;
    }
    const total = phys + magic + trueDmg;
    return { phys, magic, total, physRatio: total > 0 ? phys / total : null, magicRatio: total > 0 ? magic / total : null };
  };

  const isSupport = me.lane === 'UTILITY';
  const bootsTarget = isSupport ? BOOTS_T2_TARGET_MIN_SUPPORT : BOOTS_T2_TARGET_MIN;
  const durationMin = match.gameDuration / 60;
  const bootsBuys = myPurchases.filter((p) => (items.get(p.itemId)?.bootsTier || 0) > 0);
  const firstBoots = bootsBuys[0];
  const t2Boots = bootsBuys.find((p) => (items.get(p.itemId)?.bootsTier || 0) >= 2);

  let boots: BuildAuditCheck;
  if (bootsBuys.length === 0 && me.championName === 'Cassiopeia') {
    boots = { status: 'na', verdict: 'カシオペアは靴を購入できないため対象外', details: [] };
  } else if (!t2Boots) {
    const late = durationMin >= bootsTarget + BOOTS_LATE_MARGIN_MIN;
    boots = {
      status: late ? 'warn' : 'na',
      verdict: late
        ? `上位靴を完成させないまま試合終了（試合時間 ${Math.floor(durationMin)}分）`
        : `試合が短く上位靴の判定対象外（試合時間 ${Math.floor(durationMin)}分）`,
      details: firstBoots ? [`ブーツ購入: ${fmt(firstBoots.ts)}`] : ['ブーツの購入なし'],
    };
  } else {
    const meta = items.get(t2Boots.itemId)!;
    // 「15分以内」は15分台まで含める（15:04 を遅いと判定しない）
    const t2Min = Math.floor(t2Boots.ts / 60000);
    const details: string[] = [];
    if (firstBoots) details.push(`ブーツ購入: ${fmt(firstBoots.ts)}`);
    details.push(`上位靴「${meta.name}」完成: ${fmt(t2Boots.ts)}（目安 ${bootsTarget}分台まで${isSupport ? '・サポート基準' : ''}）`);

    let status: BuildAuditCheck['status'] = t2Min <= bootsTarget ? 'good' : t2Min <= bootsTarget + BOOTS_LATE_MARGIN_MIN ? 'ok' : 'warn';
    const timingText = status === 'good' ? '完成タイミング良好' : status === 'ok' ? '完成はやや遅め' : '完成が遅い';

    // 購入時点で見えていた敵のダメージ内訳で判定する（試合終了時の数値で評価すると後知恵になる）
    const dmg = enemyDamageAt(Math.min(t2Min, frames.length - 1));
    let choiceText = '';
    if (dmg.physRatio !== null && dmg.magicRatio !== null) {
      details.push(`購入時点の敵ダメージ内訳: 物理 ${Math.round(dmg.physRatio * 100)}% / 魔法 ${Math.round(dmg.magicRatio * 100)}%`);
      if (meta.armor > 0 && dmg.magicRatio >= DAMAGE_SKEW_RATIO) {
        choiceText = '・物理防御の靴だが敵は魔法ダメージ主体';
        status = 'warn';
      } else if (meta.magicResist > 0 && dmg.physRatio >= DAMAGE_SKEW_RATIO) {
        choiceText = '・魔法防御の靴だが敵は物理ダメージ主体';
        status = 'warn';
      } else if (meta.armor > 0 || meta.magicResist > 0) {
        choiceText = '・防御靴の属性は敵構成と矛盾なし';
      } else {
        choiceText = '・攻撃系の靴のため属性判定は対象外';
      }
    }
    boots = { status, verdict: `${timingText}${choiceText}`, details };
  }

  // ==========================================
  // ビルド監査: 重傷
  // ==========================================
  const heals = match.participants.map((p) => p.rawTotalHeal ?? 0).sort((a, b) => a - b);
  const medianHeal = heals.length ? (heals[Math.floor((heals.length - 1) / 2)] + heals[Math.ceil((heals.length - 1) / 2)]) / 2 : 0;
  const heavyHealers = match.participants
    .filter((p) => p.teamId !== me.teamId)
    .filter((p) => {
      const h = p.rawTotalHeal ?? 0;
      return h >= medianHeal * HEAVY_HEAL_MEDIAN_RATIO && h / Math.max(1, durationMin) >= HEAVY_HEAL_PER_MIN;
    })
    .sort((a, b) => (b.rawTotalHeal ?? 0) - (a.rawTotalHeal ?? 0));

  const firstWoundsBuy = (pid: number) => collectPurchases(events, pid).find((p) => items.get(p.itemId)?.appliesWounds);
  const myGw = firstWoundsBuy(myPid);
  const allyGw = allyPids
    .filter((pid) => pid !== myPid)
    .map((pid) => ({ champ: champOfPid.get(pid) || '?', buy: firstWoundsBuy(pid) }))
    .filter((x) => x.buy)
    .sort((a, b) => a.buy!.ts - b.buy!.ts);

  const gwDetails: string[] = [];
  gwDetails.push(`回復量の試合中央値: ${Math.round(medianHeal).toLocaleString()}（回復主体の基準: その${HEAVY_HEAL_MEDIAN_RATIO}倍以上かつ毎分${HEAVY_HEAL_PER_MIN}以上）`);
  for (const h of heavyHealers) {
    gwDetails.push(`回復主体の敵: ${h.championName} ${Math.round(h.rawTotalHeal ?? 0).toLocaleString()}（毎分 ${Math.round((h.rawTotalHeal ?? 0) / Math.max(1, durationMin))}）`);
  }
  if (myGw) gwDetails.push(`自分の重傷アイテム: ${items.get(myGw.itemId)?.name} ${fmt(myGw.ts)}`);
  for (const a of allyGw) gwDetails.push(`味方の重傷アイテム: ${a.champ}「${items.get(a.buy!.itemId)?.name}」${fmt(a.buy!.ts)}`);

  // 自分か味方のうち最も早い購入で判定する。味方が買っていても31分では間に合っていない
  const timingOf = (ts: number): BuildAuditCheck['status'] => {
    const min = Math.floor(ts / 60000);
    return min <= GW_EARLY_MIN ? 'good' : min <= GW_STANDARD_MIN ? 'ok' : 'warn';
  };
  const timingLabel = { good: '早期', ok: '標準', warn: '遅い', na: '' } as const;

  let grievousWounds: BuildAuditCheck;
  if (heavyHealers.length > 0) {
    const teamFirst = [
      ...(myGw ? [{ champ: '自分', ts: myGw.ts }] : []),
      ...allyGw.map((a) => ({ champ: a.champ, ts: a.buy!.ts })),
    ].sort((a, b) => a.ts - b.ts)[0];
    if (teamFirst) {
      const status = timingOf(teamFirst.ts);
      const who = teamFirst.champ === '自分' ? '自分が' : `味方の${teamFirst.champ}が`;
      grievousWounds = {
        status,
        verdict: `回復主体の敵がいる試合で、チーム最初の重傷は${who} ${fmt(teamFirst.ts)} に購入（${timingLabel[status]}・目安 ${GW_STANDARD_MIN}分台まで）${myGw ? '' : '。自分は未購入'}`,
        details: gwDetails,
      };
    } else {
      grievousWounds = {
        status: 'warn',
        verdict: `回復主体の敵（${heavyHealers.map((h) => h.championName).join(' / ')}）がいたのに、チームの誰も重傷アイテムを買っていない`,
        details: gwDetails,
      };
    }
  } else {
    grievousWounds = {
      status: myGw ? 'ok' : 'good',
      verdict: myGw
        ? `回復主体の敵はいなかった（${fmt(myGw.ts)} の重傷購入は優先度が低かった可能性）`
        : '回復主体の敵はおらず、重傷アイテムは不要な試合',
      details: gwDetails,
    };
  }

  return {
    matchId: match.matchId,
    myChampion: me.championName,
    opponentChampion: opp?.championName || null,
    position: me.lane,
    isWin: me.win,
    durationStr: fmt(match.gameDuration * 1000),
    kdaStr: `${me.kills}/${me.deaths}/${me.assists}`,
    analyzedUntilMin: untilMin,
    replay: {
      rows,
      lossSegments,
      breakdown,
      final: {
        csDiff: lastRow?.csDiff ?? null,
        goldDiff: lastRow?.goldDiff ?? null,
        xpDiff: lastRow?.xpDiff ?? null,
      },
    },
    recalls,
    buildAudit: { boots, grievousWounds },
    thresholds: TEMPO_THRESHOLDS,
  };
}
