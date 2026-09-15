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
    const { discordId, discordName, ign, main, sub, ng1, ng2, weight } = await req.json();

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
      const currentPrefs = existing.role_preferences || {};
      const updatedPrefs = {
        ...currentPrefs,
        primary: main || currentPrefs.primary || 'ALL',
        secondary: (sub !== undefined && sub !== null) ? sub : (currentPrefs.secondary || '-'),
        coins: typeof currentPrefs.coins === 'number' ? currentPrefs.coins : 1000,
        inventory: Array.isArray(currentPrefs.inventory) ? currentPrefs.inventory : [],
      };
      updateData.role_preferences = updatedPrefs;
      if (ng1 !== undefined) updateData.ng_lane_1 = ng1;
      if (ng2 !== undefined) updateData.ng_lane_2 = ng2;
      if (weight !== undefined && weight !== null && weight !== '') {
        const w = parseInt(String(weight));
        if (!Number.isNaN(w)) updateData.weight = w;
      }

      if (rankTier) {
        const { higherRank, rankScore } = await import('../../../../lib/mmr');
        const oldRank = existing.highest_rank || 'UNRANKED';
        const newRank = higherRank(oldRank, rankTier);
        updateData.highest_rank = newRank;

        if (oldRank !== 'UNRANKED' && newRank !== 'UNRANKED' && rankScore(newRank) > rankScore(oldRank)) {
          const { sendRankUpgradeNotification } = await import('../../../../lib/discordNotify');
          sendRankUpgradeNotification({
            playerName: existing.name,
            discordId: existing.discord_id,
            oldRank,
            newRank,
            ign,
          }).catch((notifyErr) => console.warn('[update-puuid] Rank upgrade notify error:', notifyErr));
        }
      }
      const { error } = await supabase
        .from('ktm_players')
        .update(updateData)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // 新規プレイヤーの自動作成 (Upsert)
      const defaultName = discordName || gameName || `User_${String(discordId).slice(-4)}`;
      const tierKey = (rankTier || 'UNRANKED').toUpperCase();
      const initialMmr = (await import('../../../../lib/mmr')).RANKS[tierKey] || 1200;

      const newPrefs = {
        primary: main || 'ALL',
        secondary: sub || '-',
        coins: 1000,
        inventory: [],
      };

      const newPlayerData: any = {
        discord_id: discordId,
        name: defaultName,
        ign: ign,
        puuid: puuid,
        is_active: true,
        highest_rank: rankTier || 'UNRANKED',
        role_preferences: newPrefs,
        mmr: initialMmr,
        mmr_top: initialMmr,
        mmr_jg: initialMmr,
        mmr_mid: initialMmr,
        mmr_adc: initialMmr,
        mmr_sup: initialMmr,
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

      if (ng1) newPlayerData.ng_lane_1 = ng1;
      if (ng2) newPlayerData.ng_lane_2 = ng2;
      if (weight !== undefined && weight !== null && weight !== '') {
        const w = parseInt(String(weight));
        if (!Number.isNaN(w)) newPlayerData.weight = w;
      }

      const { error } = await supabase
        .from('ktm_players')
        .insert(newPlayerData);

      if (error) {
        console.warn('[update-puuid] standard insert failed, retrying minimal insert:', error.message);
        const fallbackData = {
          discord_id: discordId,
          name: defaultName,
          ign: ign,
          puuid: puuid,
          is_active: true,
          highest_rank: rankTier || 'UNRANKED',
          mmr: initialMmr,
          role_preferences: newPrefs,
        };
        const { error: fbErr } = await supabase.from('ktm_players').insert(fallbackData);
        if (fbErr) throw fbErr;
      }
    }

    return NextResponse.json({ status: "SUCCESS", puuid, rankTier, ign });
  } catch (err: any) {
    console.error("Update PUUID Error:", err);
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
