import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// champions/tabs/DictionaryTab.tsx の一覧グリッド用データ。
// フェーズ1 SSOT化: champion_factsを正本として、日付・パッチ・JGスタイル・
// confidence（信頼度）を返す。matchup_sentinelからの読み取りを廃止。
export const dynamic = 'force-dynamic';

const ALIAS_MAP: Record<string, string> = {
  kisante: 'ksante', qkuaa: 'qiyana', naitina: 'nilah', silas: 'sylas', zilian: 'zilean', viper: 'viego',
};
const normalizeKey = (str: string) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const [{ data: factsData, error: factsError }, { data: spikeRows, error: spikeError }] = await Promise.all([
      // champion_facts (SSOT) から一覧用データを取得
      supabase.from('champion_facts')
        .select('champion, updated_at, patch, patch_meta, jg_type, jg_description, jg_blind_pickable, jg_counter_pickable, strengths, confidence, auto_updated_at, last_verified_at')
        .eq('archived', false),
      supabase.from('champion_power_spikes').select('champion, early_game_score, mid_game_score, late_game_score'),
    ]);
    if (factsError) throw factsError;
    if (spikeError) throw spikeError;

    const dates: Record<string, string> = {};
    const pending: Record<string, boolean> = {};
    const patchMetas: Record<string, any> = {};
    const jgStyles: Record<string, any> = {};
    // SSOT: 各チャンピオンの信頼度・最終確認日をUIに返す
    const confidences: Record<string, string> = {};
    const dbFavorites: string[] = [];

    (factsData || []).forEach((row: any) => {
      const normKey = normalizeKey(row.champion);
      const aliasKey = ALIAS_MAP[normKey] || normKey;

      // updated_at を日付として使う
      const rawUpdatedAt = row.updated_at;
      dates[row.champion] = rawUpdatedAt;
      dates[normKey] = rawUpdatedAt;
      dates[aliasKey] = rawUpdatedAt;

      // 内容が空の行は pending 扱い
      const isPending = !row.strengths;
      pending[row.champion] = isPending;
      pending[normKey] = isPending;
      pending[aliasKey] = isPending;

      // patch_meta（JSONBカラムから直接取得）
      let patchMetaObj = row.patch_meta ? { ...row.patch_meta } : {};
      if (!patchMetaObj.updated_at && rawUpdatedAt) {
        patchMetaObj.updated_at = Math.floor(new Date(rawUpdatedAt).getTime() / 1000);
      }
      patchMetas[row.champion] = patchMetaObj;
      patchMetas[normKey] = patchMetaObj;
      patchMetas[aliasKey] = patchMetaObj;

      // JGスタイル（構造化カラムから直接構成）
      const parsedJgStyle = row.jg_type ? {
        type: row.jg_type,
        description: row.jg_description || '',
        blind_pickable: row.jg_blind_pickable,
        counter_pickable: row.jg_counter_pickable,
      } : null;
      jgStyles[row.champion] = parsedJgStyle;
      jgStyles[normKey] = parsedJgStyle;
      jgStyles[aliasKey] = parsedJgStyle;

      // SSOT: confidence
      const conf = row.confidence || 'ai_generated';
      confidences[row.champion] = conf;
      confidences[normKey] = conf;
      confidences[aliasKey] = conf;
    });

    const powerSpikes: Record<string, any> = {};
    (spikeRows || []).forEach((row: any) => {
      const normKey = normalizeKey(row.champion);
      const aliasKey = ALIAS_MAP[normKey] || normKey;
      const spikeObj = {
        early_game_score: row.early_game_score,
        mid_game_score: row.mid_game_score,
        late_game_score: row.late_game_score,
      };
      powerSpikes[row.champion] = spikeObj;
      powerSpikes[normKey] = spikeObj;
      powerSpikes[aliasKey] = spikeObj;
    });

    return NextResponse.json({ dates, pending, patchMetas, jgStyles, powerSpikes, dbFavorites, confidences });
  } catch (err: any) {
    console.error('[champions/dictionary-overview] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
