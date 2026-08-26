import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { resolveDisplayName } from '../../../../lib/discordName';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

function parseIntroduction(content: string) {
  const lower = content.toLowerCase();
  let ign: string | null = null;
  let primary: string = "ALL";
  let secondary: string = "-";
  let ignore_role: string = "-";

  // Riot ID の抽出 (Name#TAG)
  const match = lower.match(/[^\s#]{2,16}#[a-z0-9]{3,5}/g);
  if (match && match.length > 0) {
    ign = match[0].trim();
  }

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
    const isNgLine = line.includes("ng") || line.includes("苦手") || line.includes("やりたくない") || line.includes("無理") || line.includes("できない") || line.includes("できません");
    if (isNgLine) {
      for (const [key, val] of Object.entries(roleMapping)) {
        if (line.includes(key)) {
          ignore_role = val;
          break;
        }
      }
    }

    const isPrimaryLine = line.includes("第1") || line.includes("第一") || line.includes("メイン") || line.includes("希望") || line.includes("1");
    if (isPrimaryLine && primary === "ALL") {
      for (const [key, val] of Object.entries(roleMapping)) {
        if (line.includes(key) && val !== ignore_role) {
          primary = val;
          break;
        }
      }
    }

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

  return {
    ign,
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

  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    return NextResponse.json({ error: 'Discord credentials not configured' }, { status: 500 });
  }

  try {
    // 1. Discordから最新メンバー一覧を取得
    const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members?limit=1000`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Discord API Error: ${await res.text()}` }, { status: res.status });
    }

    const discordMembers: any[] = await res.json();
    const humanMembers = discordMembers.filter(m => !m.user?.bot);

    // 2. DBから現在の全プレイヤーを取得
    const { data: dbPlayers, error: dbError } = await supabase
      .from('ktm_players')
      .select('id, discord_id, name, highest_rank, mmr, is_active');

    if (dbError) throw dbError;

    const existingDiscordIds = new Set(dbPlayers?.map((p: any) => p.discord_id).filter(Boolean));
    const existingNames = new Set(dbPlayers?.map((p: any) => p.name?.toLowerCase()));

    // 3. 未登録メンバーを抽出
    const newMembers = humanMembers.filter(m => {
      const dId = m.user?.id;
      const displayName = resolveDisplayName(m);
      return !existingDiscordIds.has(dId) && !existingNames.has(displayName?.toLowerCase());
    });

    if (newMembers.length === 0) {
      return NextResponse.json({ success: true, addedCount: 0, message: '新規メンバーはいませんでした（最新状態です）' });
    }

    // 4. 自己紹介チャンネル（あれば）から直近メッセージを検索してパース
    let introMessages: any[] = [];
    try {
      const introChannelId = '1485646578621616209';
      const msgRes = await fetch(`https://discord.com/api/v10/channels/${introChannelId}/messages?limit=100`, {
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      });
      if (msgRes.ok) {
        introMessages = await msgRes.json();
      }
    } catch {}

    const recordsToInsert: any[] = [];

    for (const m of newMembers) {
      const discordId = m.user?.id;
      const displayName = resolveDisplayName(m);
      const userMsg = introMessages.find(msg => msg.author?.id === discordId);
      const parsed = userMsg?.content ? parseIntroduction(userMsg.content) : null;

      recordsToInsert.push({
        discord_id: discordId,
        name: displayName,
        ign: parsed?.ign || `${m.user?.username}#JP1`,
        highest_rank: 'UNRANKED',
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
          intro_parsed: !!parsed
        }
      });
    }

    // 5. DBに自動インサート
    const { data: inserted, error: insertError } = await supabase
      .from('ktm_players')
      .insert(recordsToInsert)
      .select();

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      addedCount: inserted?.length || 0,
      addedMembers: inserted?.map((p: any) => p.name)
    });

  } catch (error: any) {
    console.error('Auto sync discord members error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
