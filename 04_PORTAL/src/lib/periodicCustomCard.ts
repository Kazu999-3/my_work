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

export interface PeriodicCustomEntries {
  title: string;
  startAt: string;
  messageUrl: string;
  /** カードにエントリーしている人（観戦希望を含む） */
  entryIds: string[];
  /** 自分で観戦を選んだ人 */
  spectatorIds: string[];
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

  const lines = String(best.msg.embeds[0].fields?.[0]?.value || '').split('\n').filter((l) => l.startsWith('- '));
  const idOf = (l: string) => l.match(/<@!?(\d+)>/)?.[1];
  const entryIds = [...new Set(lines.map(idOf).filter((v): v is string => !!v))];
  const spectatorIds = [...new Set(lines.filter((l) => /観戦/.test(l)).map(idOf).filter((v): v is string => !!v))];
  return {
    title: best.title,
    startAt: best.start.toISOString(),
    messageUrl: `https://discord.com/channels/${best.msg.guild_id || '1485636149379858567'}/${PERIODIC_RECRUIT_CHANNEL_ID}/${best.msg.id}`,
    entryIds,
    spectatorIds,
  };
}
