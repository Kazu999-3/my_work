import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchPuuidByRiotId } from '../../../../lib/riot';
import { verifyBotSecret } from '../../../../lib/botAuth';

export async function POST(req: Request) {
  try {
  // ===== Bot共有シークレット確認 (未設定の間はfail-open) =====
  const authResult = verifyBotSecret(req);
  if (!authResult.ok) {
    return NextResponse.json({ status: 'ERROR', message: authResult.error }, { status: 401 });
  }
  // =================================
    const { discordId, discordName, ign } = await req.json();

    if (!discordId || !ign) {
      return NextResponse.json({ status: "ERROR", message: "Missing discordId or ign" }, { status: 400 });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) throw new Error("RIOT_API_KEY is not set.");

    // Parse IGN (Name#Tag)
    const [gameName, tagLine] = ign.split('#');
    if (!gameName || !tagLine) {
      throw new Error("IGN format must be Name#Tag");
    }

    // Fetch PUUID
    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);

    // ランク情報の取得を試行
    let rankTier: string | null = null;
    let rankDiv: string | null = null;
    let rankLp: number | null = null;
    try {
      const { fetchLeagueByPuuid } = await import('../../../../lib/riot');
      const leagues = await fetchLeagueByPuuid(puuid, apiKey);
      const soloQ = leagues.find((l: any) => l.queueType === 'RANKED_SOLO_5x5');
      if (soloQ) {
        rankTier = soloQ.tier;
        rankDiv = soloQ.rank;
        rankLp = soloQ.leaguePoints;
      }
    } catch (e) {
      console.warn('[update-puuid] Rank fetch failed (continuing):', e);
    }

    // 既存プレイヤーを検索
    const { data: existingPlayers } = await supabase
      .from('ktm_players')
      .select('*')
      .eq('discord_id', discordId)
      .limit(1);

    const existing = existingPlayers && existingPlayers.length > 0 ? existingPlayers[0] : null;

    if (existing) {
      // 既存プレイヤーの更新
      const updateData: any = { ign, puuid };
      if (rankTier) {
        updateData.highest_rank = rankTier;
      }
      const { error } = await supabase
        .from('ktm_players')
        .update(updateData)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // 新規プレイヤーの自動作成 (Upsert)
      const defaultName = discordName || gameName || 'NewPlayer';
      const initialMmr = 1200;
      const newPlayerData: any = {
        discord_id: discordId,
        name: defaultName,
        ign: ign,
        puuid: puuid,
        is_active: true,
        highest_rank: rankTier || 'UNRANKED',
        coins: 1000, // 初期KTMコイン
        role_preferences: { primary: 'ALL', secondary: '-' },
        mmrs: {
          TOP: initialMmr,
          JG: initialMmr,
          MID: initialMmr,
          ADC: initialMmr,
          SUP: initialMmr
        },
        stats: {
          total: { g: 0, w: 0 },
          roles: {
            TOP: { g: 0, w: 0 },
            JG: { g: 0, w: 0 },
            MID: { g: 0, w: 0 },
            ADC: { g: 0, w: 0 },
            SUP: { g: 0, w: 0 }
          },
          recent: []
        }
      };

      const { error } = await supabase
        .from('ktm_players')
        .upsert(newPlayerData, { onConflict: 'discord_id' });

      if (error) throw error;
    }

    return NextResponse.json({ status: "SUCCESS", puuid, rankTier });
  } catch (err: any) {
    console.error("Update PUUID Error:", err);
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
