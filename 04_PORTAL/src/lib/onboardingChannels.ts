/**
 * 個別案内チャンネルの発言状況の管理と、本人からの新着通知（2026-10-17）。
 *
 * Bot は応答専用（Cloudflare Workers）で Discord のメッセージイベントを受け取れないため、
 * チャンネル一覧の last_message_id の変化から新着を見つける。変化したチャンネルだけ最新1件を取りに行くので、
 * 70チャンネルあっても普段の Discord API 呼び出しは一覧の1回だけ。
 * 呼び出し元: pg_cron（1時間おき /api/onboarding/channels/poll、migration 107）と、管理画面の一覧表示。
 */
import { supabaseAdmin as supabase } from './supabaseAdmin';
import { discordFetch } from './discordFetch';
import { listOnboardingChannels, onboardingChannelName, SERVER_ADMIN_USER_ID, GUILD_ID } from './onboardingProcessor';
import { createAdminNotification } from './notify';

export type AuthorKind = 'member' | 'admin' | 'bot' | 'other';

export interface ChannelActivity {
  channelId: string;
  channelName: string;
  ownerUserId: string;
  lastMessageAt: string | null;
  lastAuthorKind: AuthorKind | null;
  /** 最後にカスタム募集案内（対面募集含む）を送った日時（直近4日以内の再送防止用） */
  lastCustomNudgeAt: string | null;
  /** 本人が最後に話していて、まだ誰も返していない */
  needsReply: boolean;
  /** 要返信のうち、管理画面の「開く」でまだ見ていない（Discord の既読は Bot から読めないため独自に記録） */
  unread: boolean;
  url: string;
}

const botHeaders = () => {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN is not set.');
  return { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
};

/** Discord の ID（snowflake）から作成時刻を取り出す */
const snowflakeTime = (id: string) => new Date(Number((BigInt(id) >> BigInt(22)) + BigInt(1420070400000))).toISOString();

export const channelUrl = (channelId: string) => `https://discord.com/channels/${GUILD_ID}/${channelId}`;

/**
 * メッセージ内容が「定期カスタムの募集・案内（対面募集含む）」に該当するか判定する。
 * 通常の個別会話・相談返信、お見合い便、入会初期ウェルカムなどは除外する。
 */
export function isCustomNudgeMessage(content: string): boolean {
  if (!content) return false;
  // 初期ウェルカム・名簿登録完了メッセージは除外
  if (content.includes('KTMサーバーへようこそ') || content.includes('名簿への登録が完了しました')) return false;
  // お見合い便・師弟連絡は除外
  if (content.includes('お見合い') || content.includes('師弟')) return false;
  // 定期カスタムの案内・対面募集・募集カードURL/ID
  return /定期カスタム|対面.*募集|対面で勝負|募集カード|1528646515533287497/.test(content);
}

function kindOf(author: any, ownerUserId: string): AuthorKind {
  if (!author) return 'other';
  if (author.id === ownerUserId) return 'member';
  if (author.bot) return 'bot';
  if (author.id === SERVER_ADMIN_USER_ID) return 'admin';
  return 'other';
}

/**
 * チャンネル一覧を取り直して状態テーブルを更新し、本人からの新着があれば管理者へ通知する。
 * 状態テーブルが空の初回は、過去の発言で一斉に通知しないよう記録だけする。
 */
export async function syncOnboardingChannels(): Promise<{ channels: ChannelActivity[]; notified: number }> {
  const headers = botHeaders();
  const list = await listOnboardingChannels();
  const { data: stateRows, error } = await supabase.from('onboarding_channel_state').select('*');
  if (error) throw new Error(`onboarding_channel_state の読み込みに失敗: ${error.message}`);
  const states = new Map<string, any>((stateRows || []).map((r: any) => [String(r.channel_id), r]));
  const isFirstRun = states.size === 0;

  // DBマイグレーション前でも落ちないようカラム存在チェック（migration 123）
  let hasCustomNudgeCol = false;
  try {
    const { error: colErr } = await supabase.from('onboarding_channel_state').select('last_custom_nudge_at').limit(1);
    hasCustomNudgeCol = !colErr;
  } catch {
    hasCustomNudgeCol = false;
  }

  const customNudgeMap = new Map<string, string>();
  for (const [chId, st] of states.entries()) {
    if (st.last_custom_nudge_at) {
      customNudgeMap.set(chId, st.last_custom_nudge_at);
    }
  }

  // 直近4日以内の発言でBot/Admin発言かつcustomNudgeMapに未登録のものをDiscordから補完判定
  const fourDaysAgoMs = Date.now() - 4 * 86400e3;
  const recentAdminChannels = list.filter((ch) => {
    if (customNudgeMap.has(ch.channelId)) return false;
    const prev = states.get(ch.channelId);
    if (!prev?.last_message_at) return false;
    const at = new Date(prev.last_message_at).getTime();
    return at >= fourDaysAgoMs && prev.last_author_kind !== 'member';
  });
  if (recentAdminChannels.length > 0) {
    for (const ch of recentAdminChannels) {
      try {
        const res = await discordFetch(`https://discord.com/api/v10/channels/${ch.channelId}/messages?limit=1`, { headers });
        const msgs = res.ok ? await res.json().catch(() => []) : [];
        const msg = Array.isArray(msgs) ? msgs[0] : null;
        if (msg && isCustomNudgeMessage(String(msg.content || ''))) {
          const at = msg.timestamp || snowflakeTime(msg.id);
          customNudgeMap.set(ch.channelId, at);
        }
      } catch {
        // Discord API エラー時はスキップ
      }
    }
  }

  const upserts: any[] = [];
  const newMemberMessages: { channelId: string; channelName: string; ownerUserId: string; messageId: string; content: string }[] = [];

  for (const ch of list) {
    const prev: any = states.get(ch.channelId);
    const row: any = {
      channel_id: ch.channelId,
      owner_user_id: ch.userId,
      channel_name: ch.name,
      last_message_id: prev?.last_message_id ?? null,
      last_message_at: prev?.last_message_at ?? null,
      last_author_id: prev?.last_author_id ?? null,
      last_author_kind: prev?.last_author_kind ?? null,
      notified_message_id: prev?.notified_message_id ?? null,
      read_message_id: prev?.read_message_id ?? null,
      reply_dismissed_message_id: prev?.reply_dismissed_message_id ?? null,
      updated_at: new Date().toISOString(),
    };
    if (hasCustomNudgeCol) {
      row.last_custom_nudge_at = prev?.last_custom_nudge_at ?? null;
    }
    if (ch.lastMessageId && ch.lastMessageId !== prev?.last_message_id) {
      // 変化したチャンネルだけ最新1件を取りに行く（発言者の判定のため）
      const res = await discordFetch(`https://discord.com/api/v10/channels/${ch.channelId}/messages?limit=1`, { headers });
      const msgs = res.ok ? await res.json().catch(() => []) : [];
      const msg = Array.isArray(msgs) ? msgs[0] : null;
      if (msg) {
        const kind = kindOf(msg.author, ch.userId);
        const at = msg.timestamp || snowflakeTime(msg.id);
        row.last_message_id = msg.id;
        row.last_message_at = at;
        row.last_author_id = msg.author?.id ?? null;
        row.last_author_kind = kind;
        if (kind !== 'member' && isCustomNudgeMessage(String(msg.content || ''))) {
          if (hasCustomNudgeCol) row.last_custom_nudge_at = at;
          customNudgeMap.set(ch.channelId, at);
        }
        if (kind === 'member' && !isFirstRun && prev?.notified_message_id !== msg.id) {
          newMemberMessages.push({ channelId: ch.channelId, channelName: ch.name, ownerUserId: ch.userId, messageId: msg.id, content: String(msg.content || '') });
        }
        if (kind === 'member' && isFirstRun) row.notified_message_id = msg.id;
      } else {
        // 取れなかった時は ID と時刻だけ進める（次回また最新1件を取りに行かないよう）
        row.last_message_id = ch.lastMessageId;
        row.last_message_at = snowflakeTime(ch.lastMessageId);
      }
    }
    upserts.push(row);
  }

  if (upserts.length > 0) {
    const { error: upErr } = await supabase.from('onboarding_channel_state').upsert(upserts, { onConflict: 'channel_id' });
    if (upErr) throw new Error(`onboarding_channel_state の更新に失敗: ${upErr.message}`);
  }
  // 消えたチャンネル（退会者の部屋の削除など）の行は片付ける
  const alive = new Set(list.map((c) => c.channelId));
  const gone = [...states.keys()].filter((id) => !alive.has(id));
  if (gone.length > 0) await supabase.from('onboarding_channel_state').delete().in('channel_id', gone);

  // 本人からの新着を管理者へ通知（ベルの履歴＋アプリのプッシュ）
  let notified = 0;
  if (newMemberMessages.length > 0) {
    const ownerIds = [...new Set(newMemberMessages.map((m) => m.ownerUserId))];
    const { data: players } = await supabase.from('ktm_players').select('name,discord_id').in('discord_id', ownerIds);
    const nameOf = new Map((players || []).map((p: any) => [p.discord_id, p.name]));
    for (const m of newMemberMessages) {
      const who = nameOf.get(m.ownerUserId) || m.channelName;
      const snippet = m.content.replace(/\s+/g, ' ').trim();
      await createAdminNotification({
        type: 'onboarding_message',
        title: `💬 ${who} さんから個別案内に新着`,
        body: snippet ? (snippet.length > 80 ? `${snippet.slice(0, 80)}…` : snippet) : '新しいメッセージがあります',
        // タップで既読を記録してから Discord へ移る（/api/admin/onboarding-channels/read の GET）
        url: `/api/admin/onboarding-channels/read?channelId=${m.channelId}`,
        data: { channelId: m.channelId, messageId: m.messageId },
      });
      await supabase.from('onboarding_channel_state').update({ notified_message_id: m.messageId }).eq('channel_id', m.channelId);
      notified++;
    }
  }

  const channels: ChannelActivity[] = upserts.map((r) => ({
    channelId: r.channel_id,
    channelName: r.channel_name,
    ownerUserId: r.owner_user_id,
    lastMessageAt: r.last_message_at,
    lastAuthorKind: r.last_author_kind,
    lastCustomNudgeAt: r.last_custom_nudge_at || customNudgeMap.get(r.channel_id) || null,
    // 「返信不要」にした発言のままなら要返信から外す（本人が新しく発言すれば戻る）
    needsReply: r.last_author_kind === 'member' && r.reply_dismissed_message_id !== r.last_message_id,
    unread: r.last_author_kind === 'member' && r.reply_dismissed_message_id !== r.last_message_id && r.read_message_id !== r.last_message_id,
    url: channelUrl(r.channel_id),
  }));
  return { channels, notified };
}

/**
 * 指定した個別案内チャンネルへ同じ文面を投稿する。個別案内カテゴリのチャンネル以外には送らない。
 * mention=true なら先頭で持ち主にメンションする（その人だけ通知が鳴る）。
 */
export interface BroadcastHistoryEntry {
  id: string;
  sentAt: string;
  sentCount: number;
  failedCount: number;
  channelCount: number;
  mention: boolean;
  contentSnippet: string;
}

export async function getBroadcastHistory(): Promise<BroadcastHistoryEntry[]> {
  try {
    const { data } = await supabase
      .from('ktm_settings')
      .select('value')
      .eq('key', 'onboarding_broadcast_history')
      .maybeSingle();
    return Array.isArray(data?.value) ? data.value : [];
  } catch {
    return [];
  }
}

export async function broadcastToOnboardingChannels(
  channelIds: string[],
  content: string,
  mention: boolean
): Promise<{ sent: number; failed: { channelId: string; status: number }[] }> {
  const headers = botHeaders();
  const owners = new Map((await listOnboardingChannels()).map((c) => [c.channelId, c.userId]));
  let sent = 0;
  const failed: { channelId: string; status: number }[] = [];
  const successfulChannelIds: string[] = [];
  for (const id of [...new Set(channelIds)]) {
    const owner = owners.get(id);
    if (!owner) { failed.push({ channelId: id, status: 0 }); continue; }
    const res = await discordFetch(`https://discord.com/api/v10/channels/${id}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: mention ? `<@${owner}>\n${content}` : content,
        allowed_mentions: mention ? { users: [owner] } : { parse: [] },
      }),
    });
    if (res.ok) {
      sent++;
      successfulChannelIds.push(id);
    } else {
      failed.push({ channelId: id, status: res.status });
    }
    // Discord の送信制限に余裕を持たせる
    await new Promise((r) => setTimeout(r, 300));
  }
  // カスタム募集案内だった場合、送信成功したチャンネルの last_custom_nudge_at を即時更新（再送防止）
  if (isCustomNudgeMessage(content) && successfulChannelIds.length > 0) {
    const nowIso = new Date().toISOString();
    try {
      const { error: updateErr } = await supabase
        .from('onboarding_channel_state')
        .update({ last_custom_nudge_at: nowIso })
        .in('channel_id', successfulChannelIds);
      if (updateErr) {
        console.warn('[onboardingChannels] last_custom_nudge_at 更新スキップ:', updateErr.message);
      }
    } catch (err: any) {
      console.warn('[onboardingChannels] last_custom_nudge_at 更新スキップ:', err?.message || err);
    }
  }
  // 配信ログを ktm_settings に直近20件保存
  try {
    const prevHistory = await getBroadcastHistory();
    const newEntry: BroadcastHistoryEntry = {
      id: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      sentCount: sent,
      failedCount: failed.length,
      channelCount: channelIds.length,
      mention,
      contentSnippet: content.slice(0, 100),
    };
    const updatedHistory = [newEntry, ...prevHistory].slice(0, 20);
    await supabase.from('ktm_settings').upsert({ key: 'onboarding_broadcast_history', value: updatedHistory }, { onConflict: 'key' });
  } catch (err: any) {
    console.warn('[onboardingChannels] broadcast history 保存スキップ:', err?.message || err);
  }
  return { sent, failed };
}

/**
 * 本人の個別案内チャンネルへ、メンション付きで1件送る（その人だけ通知が鳴る）。2026-10-20
 * 師弟のお見合い便は DM で送っていたが、ユーザー判断で個別チャンネルへ切り替えた（DM は届いたか分からず、
 * 運営側も後から見返せないため）。チャンネルが無い人には送らず false を返す（DM には切り替えない）。
 */
export async function sendToMemberChannel(
  discordId: string,
  payload: { content?: string; embeds?: any[]; components?: any[] }
): Promise<boolean> {
  if (!discordId) return false;
  try {
    const channel = (await listOnboardingChannels()).find((c) => c.userId === discordId);
    if (!channel) {
      console.warn(`[onboardingChannels] ${discordId} の個別案内チャンネルが無いため送れませんでした`);
      return false;
    }
    const res = await discordFetch(`https://discord.com/api/v10/channels/${channel.channelId}/messages`, {
      method: 'POST',
      headers: botHeaders(),
      body: JSON.stringify({
        content: [`<@${discordId}>`, payload.content].filter(Boolean).join('\n'),
        embeds: payload.embeds,
        components: payload.components,
        allowed_mentions: { users: [discordId] },
      }),
    });
    if (!res.ok) console.warn(`[onboardingChannels] 個別案内チャンネルへの送信に失敗 (${res.status})`);
    return res.ok;
  } catch (e) {
    console.warn('[onboardingChannels] 個別案内チャンネルへの送信で例外:', e);
    return false;
  }
}

/** 管理画面の「開く」を押した時点の最新メッセージを既読にする */
export async function markOnboardingChannelRead(channelId: string): Promise<void> {
  const { data } = await supabase.from('onboarding_channel_state').select('last_message_id').eq('channel_id', channelId).maybeSingle();
  if (!data) return;
  await supabase.from('onboarding_channel_state').update({ read_message_id: data.last_message_id }).eq('channel_id', channelId);
}

/** 今の最新メッセージまでを「返信不要」にする（既読にもする） */
export async function dismissOnboardingChannelReply(channelId: string): Promise<void> {
  const { data } = await supabase.from('onboarding_channel_state').select('last_message_id').eq('channel_id', channelId).maybeSingle();
  if (!data) return;
  await supabase.from('onboarding_channel_state')
    .update({ reply_dismissed_message_id: data.last_message_id, read_message_id: data.last_message_id })
    .eq('channel_id', channelId);
}

// 記号や大文字小文字を無視した比較用（Discord がチャンネル名を自動で書き換える分を吸収する）
const looseKey = (v: string) => v.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * 個別案内チャンネルの名前を、持ち主の今の表示名（サーバーのニックネーム → 表示名 → ユーザー名）に付け直す。
 * 「どの表示名から付けたか」（name_source）を記録し、表示名が変わった人だけ改名する。
 * 記録が無い初回は、今のチャンネル名がすでに今の表示名と同じなら記録だけする。
 */
export async function renameOnboardingChannels(maxRenames = 20): Promise<{ checked: number; renamed: number; remaining: number }> {
  const headers = botHeaders();
  const list = await listOnboardingChannels();
  const res = await discordFetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`, { headers });
  if (!res.ok) throw new Error(`メンバー一覧の取得に失敗: ${res.status}`);
  const members: any[] = await res.json();
  const displayOf = new Map<string, string>(
    members.map((m) => [String(m.user?.id), String(m.nick || m.user?.global_name || m.user?.username || '')])
  );
  const { data: rows } = await supabase.from('onboarding_channel_state').select('channel_id,name_source');
  const sourceOf = new Map<string, string | null>((rows || []).map((r: any) => [String(r.channel_id), r.name_source]));

  let renamed = 0;
  let remaining = 0;
  for (const ch of list) {
    const display = displayOf.get(ch.userId);
    if (!display || !sourceOf.has(ch.channelId)) continue; // 退出者・まだ状態の無いチャンネルは次回
    const prevSource = sourceOf.get(ch.channelId);
    if (prevSource === display) continue;
    const expected = onboardingChannelName(display);
    if (prevSource == null && looseKey(ch.name) === looseKey(expected)) {
      await supabase.from('onboarding_channel_state').update({ name_source: display }).eq('channel_id', ch.channelId);
      continue;
    }
    // 1回の同期で改名する数に上限（画面の待ち時間内に収める）。残りは次の同期で
    if (renamed >= maxRenames) { remaining++; continue; }
    const patch = await discordFetch(`https://discord.com/api/v10/channels/${ch.channelId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: expected }),
    }, 1);
    if (patch.status === 429) { remaining++; break; } // 改名は回数制限が厳しいので、残りは次回へ
    if (!patch.ok) {
      console.warn('[renameOnboardingChannels] 改名に失敗:', ch.channelId, patch.status);
      continue;
    }
    const updated = await patch.json().catch(() => null);
    await supabase.from('onboarding_channel_state')
      .update({ name_source: display, channel_name: updated?.name || expected })
      .eq('channel_id', ch.channelId);
    renamed++;
    await new Promise((r) => setTimeout(r, 200));
  }
  return { checked: list.length, renamed, remaining };
}
