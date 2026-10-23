import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchAllRows } from '../../../../lib/fetchAll';
import { syncOnboardingChannels, getBroadcastHistory } from '../../../../lib/onboardingChannels';
import { loadNextPeriodicCustomEntries, getRankTier } from '../../../../lib/periodicCustomCard';

// 管理画面「個別案内」タブの一覧。開いた時点の最新状態に更新してから返す（2026-10-17）。
export const dynamic = 'force-dynamic';

function snowflakeTime(id: string): string {
  try {
    const ms = Number((BigInt(id) >> BigInt(22)) + BigInt(1420070400000));
    return new Date(ms).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  try {
    const { channels } = await syncOnboardingChannels();
    const ownerIds = channels.map((c) => c.ownerUserId);
    const ownerIdSet = new Set(ownerIds);

    const { data: players } = ownerIds.length
      ? await supabase
          .from('ktm_players')
          .select('name,discord_id,created_at,metadata,is_active,role_preferences,initial_prefs,highest_rank')
          .in('discord_id', ownerIds)
      : { data: [] as any[] };
    const playerMap = new Map<string, any>((players || []).map((p: any) => [p.discord_id, p]));
    const nameOf = new Map((players || []).map((p: any) => [p.discord_id, p.name]));
    const discordOfName = new Map<string, string>();
    (players || []).forEach((p: any) => {
      if (p.name && p.discord_id) {
        discordOfName.set(p.name.trim().toLowerCase(), p.discord_id.trim());
      }
    });

    // 名簿に入った日（自己紹介時の joined_at、無ければ名簿作成日、無ければチャンネル作成日）。未登録者も snowflake で補完
    const joinedOf = new Map(
      channels.map((c) => {
        const p = playerMap.get(c.ownerUserId);
        const at = p?.metadata?.joined_at || p?.created_at || snowflakeTime(c.channelId);
        return [c.ownerUserId, at];
      })
    );

    // 試合の実際の日時（朝6時境界のNIGHT_SHIFTで夜を正確に計算）
    const { data: matches } = await fetchAllRows((from, to) =>
      supabase.from('ktm_matches').select('id,created_at').order('id').range(from, to)
    );
    const matchAt = new Map((matches || []).map((m: any) => [m.id, new Date(m.created_at).getTime()]));

    // 全出場記録から、Discord ID または プレイヤー名で確実に紐付けて集計
    const { data: parts } = await fetchAllRows((from, to) =>
      supabase.from('ktm_match_participants').select('discord_id,player_name,match_id').order('id').range(from, to)
    );

    const lastPlayedMsMap = new Map<string, number>();
    const firstPlayedMsMap = new Map<string, number>();
    const playCount = new Map<string, number>();
    const nights = new Map<string, Set<string>>();

    for (const p of parts || []) {
      let dId: string | null = p.discord_id || null;
      if (!dId && p.player_name) {
        dId = discordOfName.get(p.player_name.trim().toLowerCase()) || null;
      }
      if (!dId || !ownerIdSet.has(dId)) continue;

      playCount.set(dId, (playCount.get(dId) || 0) + 1);

      const at = matchAt.get(p.match_id);
      if (at === undefined) continue;

      // 最新試合
      const curLast = lastPlayedMsMap.get(dId);
      if (curLast === undefined || at > curLast) {
        lastPlayedMsMap.set(dId, at);
      }

      // 初回試合
      const curFirst = firstPlayedMsMap.get(dId);
      if (curFirst === undefined || at < curFirst) {
        firstPlayedMsMap.set(dId, at);
      }

      // 参加した夜（0時またぎを1晩として数えるため朝6時境界）
      const night = new Date(at + 9 * 3600e3 - 6 * 3600e3).toISOString().slice(0, 10);
      const set = nights.get(dId) || new Set<string>();
      set.add(night);
      nights.set(dId, set);
    }

    const normLane = (v: any): string | null => {
      if (!v || typeof v !== 'string') return null;
      const u = v.toUpperCase().trim();
      if (u === 'JG' || u === 'JUNGLE') return 'JG';
      if (u === 'MID' || u === 'MIDDLE') return 'MID';
      if (u === 'ADC' || u === 'BOT' || u === 'BOTTOM') return 'BOT';
      if (u === 'SUP' || u === 'SUPPORT') return 'SUP';
      if (u === 'TOP') return 'TOP';
      if (u === 'ALL' || u === 'FILL') return 'ALL';
      return u;
    };

    const rows = channels.map((c) => {
      const lastMs = lastPlayedMsMap.get(c.ownerUserId);
      const firstMs = firstPlayedMsMap.get(c.ownerUserId);
      const p = playerMap.get(c.ownerUserId);
      const primaryLane = normLane(p?.role_preferences?.primary || p?.initial_prefs?.primary);
      const secondaryLane = normLane(p?.role_preferences?.secondary || p?.initial_prefs?.secondary);
      const rank = p?.highest_rank || null;

      return {
        ...c,
        playerName: nameOf.get(c.ownerUserId) || null,
        primaryLane,
        secondaryLane,
        rank,
        lastPlayedAt: lastMs ? new Date(lastMs).toISOString() : null,
        joinedAt: joinedOf.get(c.ownerUserId) || null,
        playCount: playCount.get(c.ownerUserId) || 0,
        playNights: nights.get(c.ownerUserId)?.size || 0,
        firstPlayedAt: firstMs ? new Date(firstMs).toISOString() : null,
        isActive: p?.is_active !== false,
      };
    });

    // 次の定期カスタムのエントリー者・観戦希望（フィルタ用）
    const nextCustom = await loadNextPeriodicCustomEntries().catch((e) => {
      console.warn('[admin/onboarding-channels] 次の定期カスタムの読み込みに失敗:', e);
      return null;
    });

    if (nextCustom && nextCustom.entries && nextCustom.entries.length > 0) {
      const entryIds = nextCustom.entries.map((e) => e.discordId);
      const { data: entryPlayers } = await supabase
        .from('ktm_players')
        .select('discord_id, highest_rank, name')
        .in('discord_id', entryIds);
      const entryPlayerMap = new Map<string, any>((entryPlayers || []).map((p: any) => [p.discord_id, p]));
      for (const ent of nextCustom.entries) {
        const ep = entryPlayerMap.get(ent.discordId);
        if (!ent.rank && ep?.highest_rank) {
          ent.rank = ep.highest_rank;
          ent.tier = getRankTier(ep.highest_rank);
        }
        ent.playerName = ep?.name || null;
      }
    }

    const broadcastHistory = await getBroadcastHistory();
    return NextResponse.json({ success: true, channels: rows, nextCustom, broadcastHistory });
  } catch (err: any) {
    console.error('[admin/onboarding-channels] error:', err);
    return NextResponse.json({ error: '個別案内チャンネルの取得に失敗しました。' }, { status: 500 });
  }
}
