import { supabaseAdmin as supabase } from './supabaseAdmin';
import { discordFetch } from './discordFetch';
import { fetchPuuidByRiotId, fetchLeagueByPuuid } from './riot';
import { RANKS, performFullMmrRebuild } from './mmr';
import { updateMemberDiscordRankRole, getRankRoleName } from './discordRoleSync';

export const INTRO_CHANNEL_ID = '1485646578621616209'; // #📝自己紹介
export const GUILD_ID = '1485636149379858567';
export const ADMIN_ROLE_ID = '1486000799711625307'; // KTM 運営ロール
export const SERVER_ADMIN_USER_ID = '697220229964759130'; // かずき (サーバー管理者)

export const ONBOARDING_ROLES = {
  NEW_MEMBER: '1556958870486777976',     // 🔰 初参加
  RECRUIT_NOTICE: '1513531261950492833', // 🔔 募集通知
  LANE_TOP: '1486761227064705256',
  LANE_JG: '1486761458233770144',
  LANE_MID: '1486761575191806074',
  LANE_ADC: '1486761696574963992',
  LANE_SUP: '1486761816980979722',
};

export const ONBOARDING_CATEGORY_NAME = '🤝 個別案内';

export interface ParsedIntro {
  ign: string;          // Name#Tag
  gameName: string;
  tagLine: string;
  declaredRank?: string;
  mainLane: 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' | 'ALL';
  subLane: 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' | '-';
  ngLane1?: 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' | null;
  ngLane2?: 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' | null;
  rawSelfIntro?: string;
}

/**
 * 自己紹介内のランク表記（例: "B1", "G2", "P4", "シルバー3", "プラチナ", "エメラルド"）から
 * 正規化された Tier と Division（例: "BRONZE", "I"）を抽出する
 */
export function parseDeclaredRank(rankStr?: string | null): { tier: string; division: string } {
  if (!rankStr) return { tier: 'UNRANKED', division: '' };
  const s = rankStr.trim().toLowerCase();

  // Tier検出
  let tier = 'UNRANKED';
  if (s.includes('challenger') || s.includes('チャレンジャー')) tier = 'CHALLENGER';
  else if (s.includes('grandmaster') || s.includes('グランドマスター')) tier = 'GRANDMASTER';
  else if (s.includes('master') || s.includes('マスター')) tier = 'MASTER';
  else if (s.includes('dia') || s.includes('ダイヤ') || s.startsWith('d')) tier = 'DIAMOND';
  else if (s.includes('eme') || s.includes('エメラルド') || s.startsWith('e')) tier = 'EMERALD';
  else if (s.includes('plat') || s.includes('プラチナ') || s.startsWith('p')) tier = 'PLATINUM';
  else if (s.includes('gold') || s.includes('ゴールド') || s.startsWith('g')) tier = 'GOLD';
  else if (s.includes('silver') || s.includes('シルバー') || s.startsWith('s')) tier = 'SILVER';
  else if (s.includes('bronze') || s.includes('ブロンズ') || s.startsWith('b')) tier = 'BRONZE';
  else if (s.includes('iron') || s.includes('アイアン') || s.startsWith('i')) tier = 'IRON';

  // Division検出 (1-4, I-IV)
  let division = '';
  const numMatch = s.match(/[1-4ivx]+/);
  if (numMatch) {
    const rawNum = numMatch[0];
    if (rawNum === '1' || rawNum === 'i') division = 'I';
    else if (rawNum === '2' || rawNum === 'ii') division = 'II';
    else if (rawNum === '3' || rawNum === 'iii') division = 'III';
    else if (rawNum === '4' || rawNum === 'iv') division = 'IV';
  }

  return { tier, division };
}

/**
 * 自己紹介テキストから LoL ID (名前#タグ) と 希望レーン2つ、およびカスタムNGレーンを抽出する
 */
export function parseIntroMessage(content: string): ParsedIntro | null {
  if (!content) return null;

  // 1. LoL ID (Name#Tag) の抽出
  // 例: "・LoL ID: Na2mi#0723", "LoL ID:激おこ牛若丸 #JP1", "IGN: はるちゃん#はるちゃん"
  let gameName = '';
  let tagLine = '';

  const idPattern = /(?:lol\s*id|サモナー名|ign|riot\s*id)[\s:：]*([^\n\r#]+?)\s*#\s*([a-zA-Z0-9ぁ-んァ-ヶー一-龠]+)/i;
  const match = content.match(idPattern);

  if (match) {
    gameName = match[1].replace(/^[・\s\-*]+/, '').trim();
    tagLine = match[2].trim();
  } else {
    // 予備: テンプレートのラベルがなくても Name#Tag の形があれば拾う
    const fallbackMatch = /([^\s\n\r#]+?)\s*#\s*([a-zA-Z0-9ぁ-んァ-ヶー一-龠]+)/.exec(content);
    if (fallbackMatch) {
      gameName = fallbackMatch[1].replace(/^[・\s\-*]+/, '').trim();
      tagLine = fallbackMatch[2].trim();
    }
  }

  if (!gameName || !tagLine) {
    return null;
  }

  const ign = `${gameName}#${tagLine}`;

  // 2. 得意なレーンの抽出
  // 例: "・得意なレーン2つ: adc、jg", "得意なレーン: top"
  let mainLane: ParsedIntro['mainLane'] = 'ALL';
  let subLane: ParsedIntro['subLane'] = '-';

  const laneLineMatch = /(?:得意なレーン|希望レーン|メインレーン)[\s:：]*([^\n\r]+)/i.exec(content);
  const textToScan = laneLineMatch ? laneLineMatch[1] : content;

  const foundLanes: Array<'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP'> = [];
  const normalized = textToScan.toLowerCase();

  // 順序を保って出現順に検出
  const positions: Array<{ role: 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP'; index: number }> = [];

  const check = (role: 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP', regexes: RegExp[]) => {
    for (const r of regexes) {
      const m = r.exec(normalized);
      if (m) {
        positions.push({ role, index: m.index });
        break;
      }
    }
  };

  check('TOP', [/\btop\b/, /トップ/]);
  check('JG', [/\bjg\b/, /\bjungle\b/, /ジャングル/]);
  check('MID', [/\bmid\b/, /ミッド/]);
  check('ADC', [/\badc\b/, /\bbot\b/, /ボット/]);
  check('SUP', [/\bsup\b/, /\bsupport\b/, /サポート/]);

  positions.sort((a, b) => a.index - b.index);

  for (const pos of positions) {
    if (!foundLanes.includes(pos.role)) {
      foundLanes.push(pos.role);
    }
  }

  if (foundLanes.length >= 1) mainLane = foundLanes[0];
  if (foundLanes.length >= 2) subLane = foundLanes[1];

  // 3. カスタムNGレーンの抽出
  // 例: "・カスタムNGレーン（2つまで）: sup ad", "NGレーン: JG,SUP"
  let ngLane1: ParsedIntro['ngLane1'] = null;
  let ngLane2: ParsedIntro['ngLane2'] = null;

  const ngMatch = /(?:ngレーン|カスタムng|ng)[\s:：]*([^\n\r]+)/i.exec(content);
  if (ngMatch) {
    const ngRaw = ngMatch[1].trim().toLowerCase();
    const isNoNg = ngRaw.includes('なし') || ngRaw.includes('none') || ngRaw.includes('no') || ngRaw.includes('特にない') || ngRaw.includes('大丈夫') || ngRaw.includes('下手でも');
    if (!isNoNg) {
      const ngPositions: Array<{ role: 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP'; index: number }> = [];
      const checkNg = (role: 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP', regexes: RegExp[]) => {
        for (const r of regexes) {
          const m = r.exec(ngRaw);
          if (m) {
            ngPositions.push({ role, index: m.index });
            break;
          }
        }
      };

      checkNg('TOP', [/\btop\b/, /トップ/]);
      checkNg('JG', [/\bjg\b/, /\bjungle\b/, /ジャングル/]);
      checkNg('MID', [/\bmid\b/, /ミッド/]);
      checkNg('ADC', [/\badc\b/, /\bad\b/, /\bbot\b/, /ボット/]);
      checkNg('SUP', [/\bsup\b/, /\bsp\b/, /\bsupport\b/, /サポート/]);

      ngPositions.sort((a, b) => a.index - b.index);
      const foundNgs: Array<'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP'> = [];
      for (const pos of ngPositions) {
        if (!foundNgs.includes(pos.role)) foundNgs.push(pos.role);
      }
      if (foundNgs.length >= 1) ngLane1 = foundNgs[0];
      if (foundNgs.length >= 2) ngLane2 = foundNgs[1];
    }
  }

  // 4. 自己申告ランクの抽出
  // 例: "・最高ランク:B1", "最高ランク: P2", "ランク: ゴールド3", "最高ランク：エメラルド"
  let declaredRank: string | undefined = undefined;
  const rankMatch = /(?:最高ランク|現在のランク|現ランク|ランク)[\s:：]*([^\n\r]+)/i.exec(content);
  if (rankMatch) {
    declaredRank = rankMatch[1].trim();
  }

  return {
    ign,
    gameName,
    tagLine,
    declaredRank,
    mainLane,
    subLane,
    ngLane1,
    ngLane2,
    rawSelfIntro: content,
  };
}

/**
 * Discord API ヘルパー
 */
function getBotHeaders(): Record<string, string> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN is not set.');
  return {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * 空きのある個別案内カテゴリーを取得（50チャンネル上限に達していたら自動で連番作成）
 */
export async function getOrCreateOnboardingCategory(): Promise<string | null> {
  const headers = getBotHeaders();
  try {
    const res = await discordFetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/channels`, { headers });
    if (!res.ok) return null;
    const channels = await res.json();
    if (!Array.isArray(channels)) return null;

    // カテゴリー一覧 (type === 4)
    const categories = channels.filter((c: any) => c.type === 4);
    
    // 各カテゴリーの配下チャンネル数を集計
    const childCounts = new Map<string, number>();
    for (const c of channels) {
      if (c.parent_id) {
        childCounts.set(c.parent_id, (childCounts.get(c.parent_id) || 0) + 1);
      }
    }

    // "🤝 個別案内" で始まるカテゴリーを番号順（①, ②, ③...）にチェック
    const numSymbols = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
    for (let i = 0; i < numSymbols.length; i++) {
      const targetName = `🤝 個別案内${numSymbols[i]}`;
      const existing = categories.find((c: any) => c.name === targetName);

      if (existing) {
        const count = childCounts.get(existing.id) || 0;
        // Discordの上限は50。安全マージンとして48未満ならこのカテゴリーに割り当て
        if (count < 48) {
          return existing.id;
        }
      } else {
        // まだ存在しない連番カテゴリーを作成
        const createRes = await discordFetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/channels`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: targetName,
            type: 4, // GUILD_CATEGORY
          }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          return created.id;
        }
      }
    }

    return null;
  } catch (err) {
    console.warn('[getOrCreateOnboardingCategory] error:', err);
    return null;
  }
}

/**
 * 個別プライベート案内チャンネルを作成する
 */
/** 個別案内チャンネルの名前（作成時と、表示名が変わった時の付け直しで共通。2026-10-17） */
export function onboardingChannelName(userName: string): string {
  return `🔒・${userName.slice(0, 20).toLowerCase().replace(/[\s_]+/g, '-')}-案内`;
}

export async function createPrivateWelcomeChannel(params: {
  userId: string;
  userName: string;
  categoryId?: string | null;
}): Promise<string | null> {
  const headers = getBotHeaders();
  const safeName = onboardingChannelName(params.userName);

  // Permission Overwrites:
  // 1. @everyone: VIEW_CHANNEL (1024) DENY
  // 2. サーバー管理者個人: VIEW_CHANNEL (1024) + SEND_MESSAGES (2048) ALLOW
  // 3. 対象メンバー: VIEW_CHANNEL (1024) + SEND_MESSAGES (2048) ALLOW
  const permissionOverwrites = [
    {
      id: GUILD_ID, // @everyone
      type: 0,      // Role
      deny: '1024',
      allow: '0',
    },
    {
      id: SERVER_ADMIN_USER_ID, // サーバー管理者 (個人)
      type: 1,                  // Member
      allow: '3072',            // VIEW + SEND
      deny: '0',
    },
    {
      id: params.userId, // 新メンバー
      type: 1,           // Member
      allow: '3072',     // VIEW + SEND
      deny: '0',
    },
  ];

  try {
    const payload: any = {
      name: safeName,
      type: 0, // GUILD_TEXT
      permission_overwrites: permissionOverwrites,
    };
    if (params.categoryId) {
      payload.parent_id = params.categoryId;
    }

    const res = await discordFetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/channels`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[createPrivateWelcomeChannel] Failed:', res.status, errText);
      return null;
    }

    const channel = await res.json();
    return channel.id;
  } catch (err) {
    console.error('[createPrivateWelcomeChannel] Exception:', err);
    return null;
  }
}

/**
 * メンバーへロールを付与する
 */
export async function addMemberRole(userId: string, roleId: string): Promise<boolean> {
  const headers = getBotHeaders();
  try {
    const res = await discordFetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${roleId}`,
      { method: 'PUT', headers }
    );
    return res.ok || res.status === 204;
  } catch (err) {
    console.warn(`[addMemberRole] Failed to add role ${roleId} to user ${userId}:`, err);
    return false;
  }
}

/**
 * メンバーからロールを剥奪する
 */
export async function removeMemberRole(userId: string, roleId: string): Promise<boolean> {
  const headers = getBotHeaders();
  try {
    const res = await discordFetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${roleId}`,
      { method: 'DELETE', headers }
    );
    return res.ok || res.status === 204;
  } catch (err) {
    console.warn(`[removeMemberRole] Failed to remove role ${roleId} from user ${userId}:`, err);
    return false;
  }
}

/**
 * メッセージにリアクションを追加する
 */
export async function addReactionToMessage(channelId: string, messageId: string, emoji: string): Promise<boolean> {
  const headers = getBotHeaders();
  try {
    const encodedEmoji = encodeURIComponent(emoji);
    const res = await discordFetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`,
      { method: 'PUT', headers }
    );
    return res.ok || res.status === 204;
  } catch (err) {
    console.warn(`[addReactionToMessage] Failed to react:`, err);
    return false;
  }
}

/**
 * 単一の自己紹介メッセージを処理するメイン処理
 */
export async function processSingleIntroMessage(msg: {
  id: string;
  author: { id: string; username: string; global_name?: string };
  content: string;
}): Promise<{ success: boolean; reason?: string; player?: any; channelId?: string }> {
  const parsed = parseIntroMessage(msg.content);
  if (!parsed) {
    return { success: false, reason: 'NO_IGN_DETECTED' };
  }

  const apiKey = process.env.RIOT_API_KEY;

  const discordId = msg.author.id;
  const discordName = msg.author.global_name || msg.author.username;

  // 1. Riot APIからPUUID取得（キー失効・障害時もオンボーディング全体を止めない多重防壁）
  let puuid = '';
  let riotFetchSuccess = false;
  if (apiKey) {
    try {
      puuid = await fetchPuuidByRiotId(parsed.gameName, parsed.tagLine, apiKey);
      riotFetchSuccess = true;
    } catch (e: any) {
      console.warn(`[processSingleIntroMessage] PUUID fetch failed for ${parsed.ign} (continuing with fallback):`, e.message);
    }
  }

  // 2. ランクの決定（Riot API優先、取得失敗時は自己紹介テキストの自己申告ランクを採用）
  const parsedDeclared = parseDeclaredRank(parsed.declaredRank);
  let rankTier = parsedDeclared.tier;
  let rankDiv = parsedDeclared.division;

  if (puuid && apiKey) {
    try {
      const leagues = await fetchLeagueByPuuid(puuid, apiKey);
      const soloQ = leagues.find((l: any) => l.queueType === 'RANKED_SOLO_5x5');
      if (soloQ) {
        rankTier = soloQ.tier;
        rankDiv = soloQ.rank;
      }
    } catch (e: any) {
      console.warn('[processSingleIntroMessage] Rank fetch failed (using declared rank):', e.message);
    }
  }

  // 3. 初期MMR計算
  const tierKey = (rankTier || 'UNRANKED').toUpperCase();
  const initialMmr = RANKS[tierKey] || 1200;

  // 4. 名簿テーブル (ktm_players) へ UPSERT
  const { data: existingPlayers } = await supabase
    .from('ktm_players')
    .select('*')
    .eq('discord_id', discordId)
    .limit(1);

  const existing = existingPlayers && existingPlayers.length > 0 ? existingPlayers[0] : null;

  let savedPlayer: any = null;
  if (existing) {
    const currentPrefs = existing.role_preferences || {};
    const updatedPrefs = {
      ...currentPrefs,
      primary: parsed.mainLane !== 'ALL' ? parsed.mainLane : (currentPrefs.primary || 'ALL'),
      secondary: parsed.subLane !== '-' ? parsed.subLane : (currentPrefs.secondary || '-'),
      coins: typeof currentPrefs.coins === 'number' ? currentPrefs.coins : 1000,
    };
    const updateData: any = {
      ign: parsed.ign,
      puuid: puuid,
      highest_rank: rankTier,
      is_active: true,
      ...(parsed.ngLane1 ? { ng_lane_1: parsed.ngLane1 } : {}),
      ...(parsed.ngLane2 ? { ng_lane_2: parsed.ngLane2 } : {}),
    };
    // 希望レーンは role_preferences に DB 上で重ねる（丸ごと書き戻すとコイン・受取印が古い値に戻るため。2026-10-19）
    const { patchPlayerPrefs } = await import('./playerCoins');
    const prefsRes = await patchPlayerPrefs(existing.id, { primary: updatedPrefs.primary, secondary: updatedPrefs.secondary });
    if (!prefsRes.ok) throw new Error(prefsRes.error);
    const { data: updated, error: uErr } = await supabase
      .from('ktm_players')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single();
    if (uErr) throw uErr;
    savedPlayer = updated;
  } else {
    const newPrefs = {
      primary: parsed.mainLane,
      secondary: parsed.subLane,
      coins: 1000,
      inventory: [],
      ignore_role: parsed.ngLane1 || '-',
      ng_roles: [parsed.ngLane1, parsed.ngLane2].filter(Boolean),
    };
    // 参加日は Discord サーバーに参加した日時にする（バランサーの No. = Discord 参加順。大会管理の同期も同じ値で上書きする）。
    // 以前は自己紹介を処理した時刻を入れており、次の同期まで並びがずれていた（2026-10-17）
    let discordJoinedAt: string | null = null;
    try {
      const memberRes = await discordFetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}`, { headers: getBotHeaders() });
      if (memberRes.ok) discordJoinedAt = (await memberRes.json())?.joined_at || null;
    } catch {
      // 取れなければ処理時刻のまま
    }
    const newPlayerData: any = {
      discord_id: discordId,
      name: discordName,
      ign: parsed.ign,
      puuid: puuid,
      is_active: true,
      highest_rank: rankTier,
      role_preferences: newPrefs,
      initial_prefs: newPrefs,
      ng_lane_1: parsed.ngLane1 || null,
      ng_lane_2: parsed.ngLane2 || null,
      // 新しい人は「こだわり: 通常」「格上との対面: 避けたい（保護あり）」で始める（2026-10-17）。
      // 以前はここで指定しておらず DB の初期値（格上OK）になり、保護したい新しい人ほど保護が外れていた
      weight: 2,
      allow_higher: false,
      metadata: {
        joined_at: discordJoinedAt || new Date().toISOString(),
        initial_highest_rank: rankTier,
      },
      mmr: initialMmr,
      mmr_top: initialMmr,
      mmr_jg: initialMmr,
      mmr_mid: initialMmr,
      mmr_adc: initialMmr,
      mmr_sup: initialMmr,
      coins: 1000,
    };
    const { data: inserted, error: iErr } = await supabase
      .from('ktm_players')
      .insert(newPlayerData)
      .select()
      .single();
    if (iErr) throw iErr;
    savedPlayer = inserted;
  }

  // 5. Discordロール自動付与
  // 🔰 初参加
  await addMemberRole(discordId, ONBOARDING_ROLES.NEW_MEMBER);

  // 🔔 募集通知（初期状態で通知ON、週末カスタムの見落としを防止）
  await addMemberRole(discordId, ONBOARDING_ROLES.RECRUIT_NOTICE);

  // 🎖️ ランクロール（エメラルド、プラチナ、ゴールド、シルバー、ブロンズ、アイアン&アンレート）
  const rankRoleName = getRankRoleName(rankTier);
  try {
    await updateMemberDiscordRankRole(discordId, rankTier);
  } catch (rErr: any) {
    console.warn(`[processSingleIntroMessage] ランクロール付与エラー (${discordName}):`, rErr?.message);
  }


  // メンバーの現在のDiscordロールを取得（旧レーンロールの剥奪用）
  let currentRoles = new Set<string>();
  try {
    const memberRes = await discordFetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}`, { headers: getBotHeaders() });
    if (memberRes.ok) {
      const memberData = await memberRes.json();
      currentRoles = new Set<string>(memberData?.roles || []);
    }
  } catch (mErr) {
    console.warn(`[processSingleIntroMessage] メンバーロール取得失敗 (${discordName}):`, mErr);
  }

  // 希望レーンロール（ユーザー方針: 第1優先の1つのみ付与し、他レーンロールが付いていれば排他制御で剥奪）
  const laneRoleMap: Record<string, string> = {
    TOP: ONBOARDING_ROLES.LANE_TOP,
    JG: ONBOARDING_ROLES.LANE_JG,
    MID: ONBOARDING_ROLES.LANE_MID,
    ADC: ONBOARDING_ROLES.LANE_ADC,
    SUP: ONBOARDING_ROLES.LANE_SUP,
  };
  const targetLaneRole = laneRoleMap[parsed.mainLane];
  if (targetLaneRole) {
    await addMemberRole(discordId, targetLaneRole);
  }
  // 第1優先以外のレーンロールが付いている場合は剥奪して第1優先1つだけに整える
  for (const roleId of Object.values(laneRoleMap)) {
    if (roleId !== targetLaneRole && currentRoles.has(roleId)) {
      await removeMemberRole(discordId, roleId);
    }
  }

  // 6. 個別プライベートチャンネルの作成
  const categoryId = await getOrCreateOnboardingCategory();
  const channelId = await createPrivateWelcomeChannel({
    userId: discordId,
    userName: discordName,
    categoryId,
  });

  // 7. 個別チャンネルへ歓迎案内を投稿
  if (channelId) {
    const headers = getBotHeaders();
    const isDeclaredOnly = !riotFetchSuccess;
    const rankDisplay = rankTier !== 'UNRANKED'
      ? `${rankTier} ${rankDiv}`.trim() + (isDeclaredOnly ? '（自己申告）' : '')
      : 'UNRANKED (未認定)';
    const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://my-work-8jbd.vercel.app';
    const mypageUrl = `${portalUrl}/mypage`;

    const ngList = [parsed.ngLane1, parsed.ngLane2].filter(Boolean).join(', ');
    const ngLine = ngList
      ? `・**カスタムNGレーン**: \`${ngList}\`（チーム分け時にこのレーンへ配置されません）`
      : `・**カスタムNGレーン**: \`なし\`（※もし苦手・避けたいレーンがあれば、[マイページ](<${mypageUrl}>) からいつでも設定できます！）`;

    const grantedRoles: string[] = ['`🔰 初参加`'];
    if (rankRoleName) {
      grantedRoles.push(`\`${rankRoleName}\``);
    }
    if (parsed.mainLane in laneRoleMap) {
      grantedRoles.push(`\`${parsed.mainLane}\``);
    }
    if (parsed.subLane in laneRoleMap && parsed.subLane !== parsed.mainLane) {
      grantedRoles.push(`\`${parsed.subLane}\``);
    }
    grantedRoles.push('`🔔 募集通知`');

    // 2026-10-20: 最初の1通は「次の一歩（定期カスタムの参加ボタンを押す）」を先頭にして短くした（ユーザー判断）。
    // 直近75日に入った41人のうち、名簿登録は41人とも済んでいたが、参加ボタンを押したのは未出場31人中2人だけで、
    // 案内が長く次の一歩が埋もれていた。また「リアクション（スタンプ）を押す」と書いていたが、実際の募集カードはボタン。

    const welcomeText = [
      `👋 **<@${discordId}> さん、KTMサーバーへようこそ！** 名簿への登録が完了しました✨`,
      '',
      `🚀 **次の一歩: 週末の定期カスタム（毎週土日 21:00〜）に参加する**`,
      `・<#1528646515533287497> の募集カードで「フル参加」を押せばエントリー完了です`,
      `・最初は「⏱️ 1戦のみ」や「👀 観戦希望」からでもOK。日曜のお祭りカスタムは戦績に残らない練習歓迎の回です`,
      `・チーム分けは実力が五分になるよう自動で決まります。格上との対面は「🛡️守ってほしい」にしてあるので、初めてでも大丈夫です`,
      '',
      `📋 **登録内容**（変更は [マイページ](<${mypageUrl}>) から）`,
      `・LoL ID \`${parsed.ign}\` / ランク \`${rankDisplay}\` / レーン メイン \`${parsed.mainLane}\`・サブ \`${parsed.subLane}\``,
      ngLine,
      `・付いたロール: ${grantedRoles.join('、')}（募集の通知は <#1485646544043642964> の「🔔 募集通知」からOFFにできます）`,
      '',
      `💬 当日の流れや「VC聞き専でもいい？」など、分からないことはこの部屋に書き込んでください。運営が見ています🤝`,
    ].filter(Boolean).join('\n');

    const welcomeButtons = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5, // LINK
            label: '👤 マイページを開く',
            url: mypageUrl,
          },
          {
            type: 2,
            style: 5, // LINK
            label: '📖 初心者・機能ガイド',
            url: `${portalUrl}/guide`,
          },
          {
            type: 2,
            style: 5, // LINK
            label: '🌐 KTMポータル',
            url: portalUrl,
          },
        ],
      },
    ];

    await discordFetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: welcomeText,
        components: welcomeButtons,
        flags: 4, // 埋め込みリンクカードを完全非表示化
      }),
    });
  }

  // 8. （廃止）#🌱初参加・ライト・復帰交流 への歓迎投稿。部屋に人の発言が10/6〜9の7件しか無く、
  //    2026-10-20 に部屋と🌱初中級交流ロールを削除した（ユーザー判断）

  // 9. 自己紹介メッセージに「✅」リアクションを付与（完了マーク）
  await addReactionToMessage(INTRO_CHANNEL_ID, msg.id, '✅');

  return {
    success: true,
    player: savedPlayer,
    channelId: channelId || undefined,
  };
}

/**
 * #📝自己紹介 の未処理メッセージをチェックして一括処理する
 * 
 * ⚠️ 安全設計 (ジョージぱぱ・セーフティ原則):
 * 本機能の導入前に投稿された過去メッセージに対して一斉に個別チャンネルを作成・通知する
 * 事故（過去ログ爆撃）を防ぐため、デフォルトでは `minTimestamp`（本機能稼働開始日時）
 * 以降に投稿された新着メッセージのみを自動処理対象とします。
 */
export const ONBOARDING_START_TIMESTAMP = '2026-10-08T07:00:00.000Z'; // 2026-10-08 16:00 JST

export async function processPendingIntros(options: {
  limit?: number;
  allowHistorical?: boolean; // 過去ログも強制処理したい場合のみ true
  minTimestamp?: string;
} = {}): Promise<{
  processed: number;
  skipped: number;
  errors: number;
  details: any[];
  rebuild?: { success: boolean; message?: string; error?: string };
}> {
  const limit = options.limit || 20;
  const minTime = options.allowHistorical
    ? 0
    : new Date(options.minTimestamp || ONBOARDING_START_TIMESTAMP).getTime();

  const headers = getBotHeaders();

  // 自己紹介チャンネルから最新メッセージを取得
  const res = await discordFetch(
    `https://discord.com/api/v10/channels/${INTRO_CHANNEL_ID}/messages?limit=${limit}`,
    { headers }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch intro messages: ${res.status}`);
  }

  const messages: any[] = await res.json();
  if (!Array.isArray(messages)) {
    return { processed: 0, skipped: 0, errors: 0, details: [] };
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  const details: any[] = [];

  for (const msg of messages) {
    // 1. Bot自身の投稿はスキップ
    if (msg.author?.bot) {
      skipped++;
      continue;
    }

    // 2. 本機能リリース前の過去メッセージは自動処理から除外（過去ログ爆撃ガード）
    const msgTime = new Date(msg.timestamp).getTime();
    if (msgTime < minTime) {
      skipped++;
      details.push({
        msgId: msg.id,
        user: msg.author?.username,
        status: 'SKIPPED_HISTORICAL',
        timestamp: msg.timestamp,
      });
      continue;
    }

    // 3. すでに「✅」リアクションがついているか確認
    const hasCheckReaction = Array.isArray(msg.reactions) &&
      msg.reactions.some((r: any) => r.emoji?.name === '✅');

    if (hasCheckReaction) {
      skipped++;
      continue;
    }

    try {
      const result = await processSingleIntroMessage(msg);
      if (result.success) {
        processed++;
        details.push({
          msgId: msg.id,
          user: msg.author.username,
          ign: result.player?.ign,
          status: 'SUCCESS',
          channelId: result.channelId,
        });
      } else {
        // 自己紹介フォーマットでない（普通の雑談等）場合はスキップ
        skipped++;
        details.push({
          msgId: msg.id,
          user: msg.author.username,
          status: 'SKIPPED',
          reason: result.reason,
        });
      }
    } catch (err: any) {
      errors++;
      details.push({
        msgId: msg.id,
        user: msg.author?.username,
        status: 'ERROR',
        error: err.message,
      });
    }
  }

  let rebuildResult: { success: boolean; message?: string; error?: string } | undefined = undefined;
  if (processed > 0) {
    try {
      console.log(`[processPendingIntros] 新メンバー ${processed} 名が名簿に追加されたため、MMR自動リビルドを開始します...`);
      const res = await performFullMmrRebuild(supabase);
      rebuildResult = res;
      console.log(`[processPendingIntros] MMR自動リビルド完了:`, res.message);
    } catch (rebuildErr: any) {
      console.error('[processPendingIntros] MMR自動リビルド失敗:', rebuildErr);
      rebuildResult = { success: false, error: rebuildErr.message };
    }
  }

  return { processed, skipped, errors, details, rebuild: rebuildResult };
}


// ─── 退出メンバーの個別案内チャンネルの掃除（2026-10-08 追加） ───
// Botは応答専用(Cloudflare Worker)で退出イベントを受け取れず、チャンネルIDもDBに残していないため、
// 「🤝 個別案内」カテゴリ内のチャンネルの閲覧権限から持ち主を割り出す。
// 放置するとカテゴリ上限(10×48)とサーバー全体の上限(500)に近づき、新メンバーの部屋が作れなくなる。
// 大会管理の「Discord & Riot同期」で、プレビュー → 実行の流れに乗せている。

export interface OnboardingChannel {
  channelId: string;
  name: string;
  userId: string;
  /** チャンネルの最後のメッセージID（発言が無ければ null）。新着の検知に使う */
  lastMessageId?: string | null;
}

/**
 * 個別案内カテゴリ直下のテキストチャンネルと、その持ち主を返す。
 * 管理者以外のメンバー権限がちょうど1人分のものだけを対象にする（持ち主が特定できないものは触らない）。
 */
export async function listOnboardingChannels(): Promise<OnboardingChannel[]> {
  const headers = getBotHeaders();
  const res = await discordFetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/channels`, { headers });
  if (!res.ok) throw new Error(`Discord channel list failed: ${res.status}`);
  const channels = await res.json();
  if (!Array.isArray(channels)) throw new Error('Discord channel list returned non-array');

  const categoryIds = new Set(
    channels
      .filter((c: any) => c.type === 4 && typeof c.name === 'string' && c.name.startsWith(ONBOARDING_CATEGORY_NAME))
      .map((c: any) => c.id)
  );

  const result: OnboardingChannel[] = [];
  for (const ch of channels) {
    if (ch.type !== 0 || !categoryIds.has(ch.parent_id)) continue;
    const memberOverwrites = (ch.permission_overwrites || []).filter(
      (o: any) => o.type === 1 && o.id !== SERVER_ADMIN_USER_ID
    );
    if (memberOverwrites.length !== 1) continue;
    result.push({ channelId: ch.id, name: ch.name, userId: memberOverwrites[0].id, lastMessageId: ch.last_message_id || null });
  }
  return result;
}

/**
 * 指定された個別案内チャンネルのうち、持ち主がサーバーにいないものを削除する。
 * 画面のプレビューから実行までの間に戻ってきた人を消さないよう、1件ずつ在籍を確認し直す。
 * Discordが「Unknown Member (10007)」と返した時だけ削除し、権限不足・障害などそれ以外は何もしない。
 */
export async function deleteDepartedMemberChannels(channelIds: string[]): Promise<{
  deleted: OnboardingChannel[];
  skipped: number;
}> {
  const headers = getBotHeaders();
  const wanted = new Set(channelIds);
  const targets = (await listOnboardingChannels()).filter((c) => wanted.has(c.channelId));

  const deleted: OnboardingChannel[] = [];
  let skipped = channelIds.length - targets.length;

  for (const ch of targets) {
    const memberRes = await discordFetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${ch.userId}`, { headers });
    if (memberRes.ok) {
      skipped++;
      continue;
    }
    const body = await memberRes.json().catch(() => null);
    if (memberRes.status !== 404 || body?.code !== 10007) {
      skipped++;
      continue;
    }
    const delRes = await discordFetch(`https://discord.com/api/v10/channels/${ch.channelId}`, { method: 'DELETE', headers });
    if (!delRes.ok) {
      console.error('[deleteDepartedMemberChannels] delete failed:', ch.channelId, delRes.status);
      skipped++;
      continue;
    }
    deleted.push(ch);
  }

  return { deleted, skipped };
}
