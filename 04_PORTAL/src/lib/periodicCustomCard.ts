/**
 * 次の定期カスタム（土曜・日曜 21:00）の募集カードを Discord から読み、エントリー者を返す（2026-10-17）。
 *
 * 募集カードは bot（03_SYSTEMS/ktm_bot）が投稿し、カードの表示テキストがそのまま参加データになっている
 * （`recruitmentStatus.js` の `extractEntryLines` と同じ考え方）。`recruitments` テーブルへの記録は
 * 漏れることがある（2026-10-17 時点で 10/17・10/18 分が無かった）ため、bot と同じくチャンネルを直接見る。
 */
import { discordFetch } from './discordFetch';

// 定期カスタムの募集チャンネル（bot の CONFIG.PERIODIC_RECRUIT_CHANNEL_ID と同じ）
const PERIODIC_RECRUIT_CHANNEL_ID = process.env.PERIODIC_RECRUIT_CHANNEL_ID || '1528646515533287497';

export interface CustomEntryDetail {
  discordId: string;
  lanes: string[]; // ['TOP', 'JG'] など
  rank?: string | null; // 'PLATINUM', 'GOLD' など
  tier?: number | null; // 1〜10
  playerName?: string | null;
  isLate: boolean;
  isSingle: boolean;
}

export const RANK_TIERS: Record<string, number> = {
  IRON: 1,
  BRONZE: 2,
  SILVER: 3,
  GOLD: 4,
  PLATINUM: 5,
  EMERALD: 6,
  DIAMOND: 7,
  MASTER: 8,
  GRANDMASTER: 9,
  CHALLENGER: 10,
};

const CARD_RANK_MAP: Record<string, string> = {
  アイアン: 'IRON',
  アイ: 'IRON',
  ブロンズ: 'BRONZE',
  ブロ: 'BRONZE',
  シルバー: 'SILVER',
  シル: 'SILVER',
  ゴールド: 'GOLD',
  ゴル: 'GOLD',
  プラチナ: 'PLATINUM',
  プラ: 'PLATINUM',
  エメラルド: 'EMERALD',
  エメ: 'EMERALD',
  ダイヤモンド: 'DIAMOND',
  ダイア: 'DIAMOND',
  ダイヤ: 'DIAMOND',
  マスター: 'MASTER',
  マス: 'MASTER',
  グランドマスター: 'GRANDMASTER',
  グラマス: 'GRANDMASTER',
  チャレンジャー: 'CHALLENGER',
  チャレ: 'CHALLENGER',
};

export function getRankTier(rankStr: string | null | undefined): number | null {
  if (!rankStr) return null;
  const u = rankStr.toUpperCase();
  for (const [k, v] of Object.entries(RANK_TIERS)) {
    if (u.includes(k)) return v;
  }
  return null;
}

function extractRankFromLine(line: string): string | null {
  const match = line.match(/【(アイアン|アイ|ブロンズ|ブロ|シルバー|シル|ゴールド|ゴル|プラチナ|プラ|エメラルド|エメ|ダイヤモンド|ダイア|ダイヤ|マスター|マス|グラマス|チャレンジャー|チャレ)】/i);
  if (match) {
    return CARD_RANK_MAP[match[1]] || null;
  }
  return null;
}

export interface PeriodicCustomEntries {
  title: string;
  startAt: string;
  messageUrl: string;
  /** カードに出場エントリーしている人（観戦希望を除く） */
  entryIds: string[];
  /** 自分で観戦を選んだ人 */
  spectatorIds: string[];
  /** エントリー者の詳細情報（希望レーン等） */
  entries: CustomEntryDetail[];
  /** 各レーンの現在エントリー人数（TOP, JG, MID, BOT, SUP） */
  laneCounts: Record<string, number>;
  /** 対面が未成立（2人未満）の不足レーン */
  neededLanes: string[];
}

function normalizeLane(lane: string): string {
  const u = lane.toUpperCase().trim();
  if (u === 'JG' || u === 'JUNGLE') return 'JG';
  if (u === 'MID' || u === 'MIDDLE') return 'MID';
  if (u === 'ADC' || u === 'BOT' || u === 'BOTTOM') return 'BOT';
  if (u === 'SUP' || u === 'SUPPORT') return 'SUP';
  if (u === 'TOP') return 'TOP';
  if (u === 'ALL' || u === 'FILL') return 'ALL';
  return u;
}

function extractLanesFromLine(line: string): string[] {
  // 【TOP/JG】 または 【第1: TOP / 第2: JG】 または 【TOP】 などのパターン
  const match = line.match(/【(?:第1:\s*)?([A-Za-z]+)(?:\s*[\/／]\s*(?:第2:\s*)?([A-Za-z]+))?】/);
  if (match) {
    const l1 = normalizeLane(match[1]);
    const l2 = match[2] ? normalizeLane(match[2]) : null;
    return [l1, l2].filter((l): l is string => !!l && l !== '-' && l !== 'NONE');
  }
  // フォールバック: 単語マッチ
  const found: string[] = [];
  for (const raw of ['TOP', 'JG', 'JUNGLE', 'MID', 'ADC', 'BOT', 'BOTTOM', 'SUP', 'SUPPORT', 'ALL', 'FILL']) {
    if (new RegExp(`\\b${raw}\\b`, 'i').test(line)) {
      const norm = normalizeLane(raw);
      if (!found.includes(norm)) found.push(norm);
    }
  }
  return found;
}

/** カードのタイトル「… 10/17(土) 21:00〜」から開始時刻（JST）を出す。年は近い方を選ぶ */
function startFromTitle(title: string, now: Date): Date | null {
  const m = title.match(/(\d{1,2})\/(\d{1,2})\([^)]*\)\s*21:00/);
  if (!m) return null;
  const year = new Date(now.getTime() + 9 * 3600e3).getUTCFullYear();
  const candidates = [year - 1, year, year + 1].map((y) => new Date(`${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}T21:00:00+09:00`));
  return candidates.sort((a, b) => Math.abs(a.getTime() - now.getTime()) - Math.abs(b.getTime() - now.getTime()))[0];
}

/** まだ終わっていない（開始から4時間以内を含む）一番近い定期カスタムのカード */
export async function loadNextPeriodicCustomEntries(now = new Date()): Promise<PeriodicCustomEntries | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN is not set.');
  const res = await discordFetch(`https://discord.com/api/v10/channels/${PERIODIC_RECRUIT_CHANNEL_ID}/messages?limit=50`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) throw new Error(`募集チャンネルの読み込みに失敗: ${res.status}`);
  const messages: any[] = await res.json();

  let best: { msg: any; title: string; start: Date } | null = null;
  for (const msg of messages) {
    if (!msg.author?.bot) continue;
    const embed = msg.embeds?.[0];
    const title: string = embed?.title || '';
    // 締め切ったカード（タイトルに受付終了）は除く
    if (!/カスタム/.test(title) || /受付終了|締め切/.test(title)) continue;
    const start = startFromTitle(title, now);
    if (!start || start.getTime() < now.getTime() - 4 * 3600e3) continue;
    if (!best || start < best.start) best = { msg, title, start };
  }
  if (!best) return null;

  // 全 fields から参加行を走査（複数フィールド分割や日跨ぎカードにも完全対応）
  const allFields = best.msg.embeds?.[0]?.fields || [];
  const lines: string[] = [];
  for (const f of allFields) {
    const rawLines = String(f.value || '').split('\n');
    for (const l of rawLines) {
      if (l.startsWith('- ') && /<@!?\d+>/.test(l)) {
        lines.push(l);
      }
    }
  }

  const idOf = (l: string) => l.match(/<@!?(\d+)>/)?.[1];
  const spectatorIds: string[] = [];
  const entryIds: string[] = [];
  const entries: CustomEntryDetail[] = [];
  const laneCounts: Record<string, number> = { TOP: 0, JG: 0, MID: 0, BOT: 0, SUP: 0 };

  for (const l of lines) {
    const id = idOf(l);
    if (!id) continue;
    if (/観戦/.test(l)) {
      spectatorIds.push(id);
    } else {
      entryIds.push(id);
      const lanes = extractLanesFromLine(l);
      const cardRank = extractRankFromLine(l);
      const isLate = /2戦目|合流|🌙/.test(l);
      const isSingle = /1戦のみ|⏱️/.test(l);
      entries.push({
        discordId: id,
        lanes,
        rank: cardRank,
        tier: getRankTier(cardRank),
        isLate,
        isSingle,
      });

      // 第1希望レーンでカウント
      const primary = lanes[0];
      if (primary && laneCounts[primary] !== undefined) {
        laneCounts[primary] += 1;
      }
    }
  }

  // 2名未満（対面未成立）のレーンを「不足対面」とする
  const standardLanes = ['TOP', 'JG', 'MID', 'BOT', 'SUP'];
  const neededLanes = standardLanes.filter((lane) => (laneCounts[lane] || 0) < 2);

  return {
    title: best.title,
    startAt: best.start.toISOString(),
    messageUrl: `https://discord.com/channels/${best.msg.guild_id || '1485636149379858567'}/${PERIODIC_RECRUIT_CHANNEL_ID}/${best.msg.id}`,
    entryIds: [...new Set(entryIds)],
    spectatorIds: [...new Set(spectatorIds)],
    entries,
    laneCounts,
    neededLanes,
  };
}
