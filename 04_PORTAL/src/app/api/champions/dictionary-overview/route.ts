import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// champions/tabs/DictionaryTab.tsx の一覧グリッド用データを1つにまとめた読み取り専用API。
// 従来はブラウザから matchup_sentinel / champion_power_spikes に3回直接アクセスしていた。
export const dynamic = 'force-dynamic';

const ALIAS_MAP: Record<string, string> = {
  kisante: 'ksante', qkuaa: 'qiyana', naitina: 'nilah', silas: 'sylas', zilian: 'zilean', viper: 'viego',
};
const normalizeKey = (str: string) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export async function GET() {
  try {
    const [{ data, error }, { data: spikeRows, error: spikeError }, { data: contentRows, error: contentError }] = await Promise.all([
      supabase.from('matchup_sentinel').select('champion, created_at, patch_meta:raw_data->patch_meta, jg_style:raw_data->jg_style, is_favorited:raw_data->is_favorited').eq('enemy', 'GLOBAL'),
      supabase.from('champion_power_spikes').select('champion, early_game_score, mid_game_score, late_game_score'),
      supabase.from('matchup_sentinel').select('champion').eq('enemy', 'GLOBAL').not('strategy', 'is', null).neq('strategy', ''),
    ]);
    if (error) throw error;
    if (spikeError) throw spikeError;
    if (contentError) throw contentError;

    const hasContent = new Set((contentRows || []).map((r: any) => r.champion));
    const dates: Record<string, string> = {};
    const pending: Record<string, boolean> = {};
    const patchMetas: Record<string, any> = {};
    const jgStyles: Record<string, any> = {};
    const dbFavorites: string[] = [];

    (data || []).forEach((row: any) => {
      const rawUpdatedAt = row.created_at;
      const normKey = normalizeKey(row.champion);
      const aliasKey = ALIAS_MAP[normKey] || normKey;

      dates[row.champion] = rawUpdatedAt;
      dates[normKey] = rawUpdatedAt;
      dates[aliasKey] = rawUpdatedAt;

      const isPending = !hasContent.has(row.champion);
      pending[row.champion] = isPending;
      pending[normKey] = isPending;
      pending[aliasKey] = isPending;

      let patchMetaObj = row.patch_meta ? { ...row.patch_meta } : {};
      if (!patchMetaObj.updated_at && rawUpdatedAt) {
        patchMetaObj.updated_at = Math.floor(new Date(rawUpdatedAt).getTime() / 1000);
      }
      patchMetas[row.champion] = patchMetaObj;
      patchMetas[normKey] = patchMetaObj;
      patchMetas[aliasKey] = patchMetaObj;

      let parsedJgStyle = null;
      if (row.jg_style) {
        parsedJgStyle = typeof row.jg_style === 'string' ? JSON.parse(row.jg_style) : row.jg_style;
      }
      jgStyles[row.champion] = parsedJgStyle || null;
      jgStyles[normKey] = parsedJgStyle || null;
      jgStyles[aliasKey] = parsedJgStyle || null;

      if (row.is_favorited === true) dbFavorites.push(row.champion);
    });

    const powerSpikes: Record<string, any> = {};
    (spikeRows || []).forEach((row: any) => {
      powerSpikes[row.champion] = {
        early_game_score: row.early_game_score,
        mid_game_score: row.mid_game_score,
        late_game_score: row.late_game_score,
      };
    });

    return NextResponse.json({ dates, pending, patchMetas, jgStyles, powerSpikes, dbFavorites });
  } catch (err: any) {
    console.error('[champions/dictionary-overview] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
