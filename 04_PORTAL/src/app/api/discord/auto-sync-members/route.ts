import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { resolveDisplayName } from '../../../../lib/discordName';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

/** 自己紹介メッセージから情報を構造化抽出するパーサー */
function parseIntroduction(content: string) {
  if (!content) return null;
  const lower = content.toLowerCase();
  let ign: string | null = null;
  let primary: string = "ALL";
  let secondary: string = "-";
  let ignore_role: string = "-";
  let highestRank: string = "UNRANKED";
  const favoriteChamps: string[] = [];

  // 1. Riot ID の抽出 (Name#TAG) - 日本語名・英数・スペース対応
  const riotIdMatches = content.match(/([^\s\n\r#]{1,16}#[a-zA-Z0-9]{2,6})/g);
  if (riotIdMatches && riotIdMatches.length > 0) {
    ign = riotIdMatches[0].trim();
  }

  // 2. ロールマッピング
  const roleMapping: Record<string, string> = {
    top: "TOP",
    トップ: "TOP",
    jg: "JG",
    jungle: "JG",
    ジャングル: "JG",
    mid: "MID",
    ミッド: "MID",
    adc: "ADC",
    bot: "ADC",
    ボット: "ADC",
    sup: "SUP",
    support: "SUP",
    サポート: "SUP"
  };

  const lines = lower.split(/[\r\n]+/);
  for (const line of lines) {
    // NG / 苦手ロール
    const isNgLine = line.includes("ng") || line.includes("苦手") || line.includes("やりたくない") || line.includes("無理") || line.includes("できない") || line.includes("できません");
    if (isNgLine) {
      for (const [key, val] of Object.entries(roleMapping)) {
        if (line.includes(key)) {
          ignore_role = val;
          break;
        }
      }
    }

    // メイン希望
    const isPrimaryLine = line.includes("第1") || line.includes("第一") || line.includes("メイン") || line.includes("希望") || line.includes("1");
    if (isPrimaryLine && primary === "ALL") {
      for (const [key, val] of Object.entries(roleMapping)) {
        if (line.includes(key) && val !== ignore_role) {
          primary = val;
          break;
        }
      }
    }

    // サブ希望
    const isSecondaryLine = line.includes("第2") || line.includes("第二") || line.includes("サブ") || line.includes("2");
    if (isSecondaryLine && secondary === "-") {
      for (const [key, val] of Object.entries(roleMapping)) {
        if (line.includes(key) && val !== ignore_role && val !== primary) {
          secondary = val;
          break;
        }
      }
    }
  }

  // 3. ランクの抽出
  const rankKeywords: Record<string, string> = {
    'iron': 'IRON',
    'アイアン': 'IRON',
    'bronze': 'BRONZE',
    'ブロンズ': 'BRONZE',
    'silver': 'SILVER',
    'シルバー': 'SILVER',
    'gold': 'GOLD',
    'ゴールド': 'GOLD',
    'platinum': 'PLATINUM',
    'プラチナ': 'PLATINUM',
    'emerald': 'EMERALD',
    'エメラルド': 'EMERALD',
    'diamond': 'DIAMOND',
    'ダイヤ': 'DIAMOND',
    'マスター': 'MASTER',
    'master': 'MASTER',
    'グランドマスター': 'GRANDMASTER',
    'grandmaster': 'GRANDMASTER',
    'チャレンジャー': 'CHALLENGER',
    'challenger': 'CHALLENGER',
  };

  for (const [kw, rankVal] of Object.entries(rankKeywords)) {
    if (lower.includes(kw)) {
      highestRank = rankVal;
      break;
    }
  }

  return {
    ign,
    highest_rank: highestRank,
    role_preferences: {
      primary,
      secondary,
      ignore_role
    }
  };
}

export async function POST(request: Request) {
  return handleSync(request);
}

export async function GET(request: Request) {
  return handleSync(request);
}

async function handleSync(request: Request) {
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
  const INTRO_CHANNEL_ID = process.env.DISCORD_INTRO_CHANNEL_ID || '1485646578621616209';

  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    return NextResponse.json({ error: 'Discord credentials (DISCORD_BOT_TOKEN / DISCORD_GUILD_ID) not configured' }, { status: 500 });
  }

  try {
    // 1. Discordから最新メンバー一覧を取得 (最大1000名)
    const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members?limit=1000`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Discord API Error: ${await res.text()}` }, { status: res.status });
    }

    const discordMembers: any[] = await res.json();
    const humanMembers = discordMembers.filter((m) => !m.user?.bot);

    // 2. 自己紹介チャンネルの直近メッセージを一括取得 (最大100件)
    let introMessages: any[] = [];
    try {
      const msgRes = await fetch(`https://discord.com/api/v10/channels/${INTRO_CHANNEL_ID}/messages?limit=100`, {
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      });
      if (msgRes.ok) {
        introMessages = await msgRes.json();
      }
    } catch (e: any) {
      console.warn('[discord-sync] 自己紹介チャンネル取得警告:', e.message);
    }

    // 3. DBから現在の全プレイヤーを取得
    const { data: dbPlayers, error: dbError } = await supabase
      .from('ktm_players')
      .select('id, discord_id, name, ign, highest_rank, role_preferences, is_active');

    if (dbError) throw dbError;

    const existingByDiscordId = new Map<string, any>();
    const existingByName = new Map<string, any>();
    dbPlayers?.forEach((p: any) => {
      if (p.discord_id) existingByDiscordId.set(p.discord_id, p);
      if (p.name) existingByName.set(p.name.toLowerCase(), p);
    });

    let addedCount = 0;
    let updatedCount = 0;
    const syncedNames: string[] = [];

    // 4. メンバーごとに新規追加または自己紹介反映
    for (const m of humanMembers) {
      const discordId = m.user?.id;
      const displayName = resolveDisplayName(m) || m.user?.username;
      if (!discordId) continue;

      // 該当ユーザーの自己紹介メッセージを探す
      const userMsg = introMessages.find((msg) => msg.author?.id === discordId);
      const parsed = userMsg?.content ? parseIntroduction(userMsg.content) : null;

      const existing = existingByDiscordId.get(discordId) || existingByName.get(displayName.toLowerCase());

      if (!existing) {
        // --- 新規メンバーの追加 ---
        const newRecord = {
          discord_id: discordId,
          name: displayName,
          ign: parsed?.ign || `${m.user?.username}#JP1`,
          highest_rank: parsed?.highest_rank && parsed.highest_rank !== 'UNRANKED' ? parsed.highest_rank : 'UNRANKED',
          role_preferences: parsed?.role_preferences || { primary: 'ALL', secondary: '-', ignore_role: '-' },
          mmr: 1000,
          mmr_top: 1000,
          mmr_jg: 1000,
          mmr_mid: 1000,
          mmr_adc: 1000,
          mmr_sup: 1000,
          is_active: false,
          metadata: {
            joined_at: m.joined_at,
            auto_added: true,
            intro_parsed: !!parsed,
            synced_at: new Date().toISOString(),
          },
        };

        const { error: insertErr } = await supabase.from('ktm_players').insert(newRecord);
        if (!insertErr) {
          addedCount++;
          syncedNames.push(`[新規] ${displayName}`);
        }
      } else if (parsed && parsed.ign) {
        // --- 既存メンバーで自己紹介から有益な情報が得られた場合のみ更新 ---
        const updates: any = {};
        if (!existing.ign || existing.ign.endsWith('#JP1') || existing.ign !== parsed.ign) {
          updates.ign = parsed.ign;
        }
        if (parsed.highest_rank && parsed.highest_rank !== 'UNRANKED' && (!existing.highest_rank || existing.highest_rank === 'UNRANKED')) {
          updates.highest_rank = parsed.highest_rank;
        }
        if (parsed.role_preferences && parsed.role_preferences.primary !== 'ALL' && (!existing.role_preferences || existing.role_preferences.primary === 'ALL')) {
          updates.role_preferences = parsed.role_preferences;
        }

        if (Object.keys(updates).length > 0) {
          updates.discord_id = discordId;
          const { error: updateErr } = await supabase.from('ktm_players').update(updates).eq('id', existing.id);
          if (!updateErr) {
            updatedCount++;
            syncedNames.push(`[更新] ${displayName}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      addedCount,
      updatedCount,
      totalScanned: humanMembers.length,
      introCount: introMessages.length,
      syncedNames,
      message: `同期完了: 新規追加 ${addedCount}名 / 情報更新 ${updatedCount}名 (全${humanMembers.length}名中)`
    });

  } catch (error: any) {
    console.error('Auto sync discord members error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
