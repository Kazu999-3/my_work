import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { loadNextPeriodicCustomEntries } from '../../../../lib/periodicCustomCard';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const custom = await loadNextPeriodicCustomEntries().catch((e) => {
      console.warn('[import-recruits] loadNextPeriodicCustomEntries 失敗:', e);
      return null;
    });

    if (!custom || (!custom.entryIds?.length && !custom.spectatorIds?.length)) {
      return NextResponse.json({
        success: false,
        error: '直近で募集中の定期カスタムカード、またはエントリーメンバーが見つかりませんでした。',
      }, { status: 404 });
    }

    const allDiscordIds = Array.from(new Set([...custom.entryIds, ...custom.spectatorIds]));

    // 名簿テーブルから discord_id で player レコードを取得
    const { data: players, error } = await supabase
      .from('ktm_players')
      .select('id, discord_id, name, highest_rank, role_preferences')
      .in('discord_id', allDiscordIds);

    if (error) {
      console.error('[import-recruits] ktm_players 取得エラー:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const discordToPlayerMap = new Map<string, any>((players || []).map((p: any) => [p.discord_id, p]));

    const activePlayerIds: number[] = [];
    const spectatorPlayerIds: number[] = [];
    const unmappedDiscordIds: string[] = [];
    const importedPlayerNames: string[] = [];

    for (const dId of custom.entryIds) {
      const p = discordToPlayerMap.get(dId);
      if (p) {
        activePlayerIds.push(p.id);
        importedPlayerNames.push(p.name);
      } else {
        unmappedDiscordIds.push(dId);
      }
    }

    for (const dId of custom.spectatorIds) {
      const p = discordToPlayerMap.get(dId);
      if (p) {
        spectatorPlayerIds.push(p.id);
      }
    }

    return NextResponse.json({
      success: true,
      title: custom.title,
      startAt: custom.startAt,
      activeCount: activePlayerIds.length,
      spectatorCount: spectatorPlayerIds.length,
      activePlayerIds,
      spectatorPlayerIds,
      unmappedDiscordIds,
      importedPlayerNames,
    });
  } catch (err: any) {
    console.error('[import-recruits] 例外発生:', err);
    return NextResponse.json({ error: err.message || '内部エラーが発生しました' }, { status: 500 });
  }
}
