import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyBotSecret } from '../../../../lib/botAuth';

// レーン希望・NG・こだわり度・格上許可の更新。未登録プレイヤーの初回実行時も自動で安全に名簿登録する。
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // ===== Bot共有シークレット確認 (未設定の間はfail-open) =====
    const authResult = verifyBotSecret(req);
    if (!authResult.ok) {
      return NextResponse.json({ status: 'ERROR', message: authResult.error }, { status: 401 });
    }
    // =================================
    const { discordId, discordName, main, sub, ng1, ng2, weight, allowHigher } = await req.json();
    if (!discordId) {
      return NextResponse.json({ status: 'ERROR', message: 'discordId が必要です。' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ status: 'ERROR', message: 'データベース接続が初期化されていません。' }, { status: 500 });
    }

    // 1. 既存プレイヤーを discord_id → 名前 の順で探す
    let existingPlayer: any = null;
    const { data: byId } = await supabase.from('ktm_players').select('*').eq('discord_id', discordId).limit(1);
    if (byId && byId.length > 0) {
      existingPlayer = byId[0];
    } else if (discordName) {
      const { data: byName } = await supabase.from('ktm_players').select('*').eq('name', discordName).limit(1);
      if (byName && byName.length > 0) {
        existingPlayer = byName[0];
        existingPlayer.discord_id = discordId;
      }
    }

    // 2. 希望レーンオブジェクトの構築
    const currentPrefs = existingPlayer?.role_preferences || {};
    const updatedPrefs: Record<string, any> = {
      ...currentPrefs,
      primary: main || currentPrefs.primary || 'ALL',
      secondary: (sub !== undefined && sub !== null) ? sub : (currentPrefs.secondary || '-'),
      coins: typeof currentPrefs.coins === 'number' ? currentPrefs.coins : 1000,
      inventory: Array.isArray(currentPrefs.inventory) ? currentPrefs.inventory : [],
    };

    if (existingPlayer) {
      // ===== 既存プレイヤーの更新 =====
      const updatePayload: any = {
        role_preferences: updatedPrefs,
        discord_id: discordId,
      };

      if (ng1 !== undefined) updatePayload.ng_lane_1 = ng1;
      if (ng2 !== undefined) updatePayload.ng_lane_2 = ng2;
      if (weight !== undefined && weight !== null && weight !== '') {
        const w = parseInt(String(weight));
        if (!Number.isNaN(w)) updatePayload.weight = w;
      }
      if (allowHigher !== undefined && allowHigher !== null && allowHigher !== '') {
        updatePayload.allow_higher = (allowHigher === 'true' || allowHigher === true);
      }

      const { error: upError } = await supabase
        .from('ktm_players')
        .update(updatePayload)
        .eq('id', existingPlayer.id);

      if (upError) {
        console.warn('[update-lane] standard update failed, retrying minimal update:', upError.message);
        const { error: fbError } = await supabase
          .from('ktm_players')
          .update({ role_preferences: updatedPrefs })
          .eq('id', existingPlayer.id);

        if (fbError) throw new Error(fbError.message);
      }

      return NextResponse.json({ status: 'SUCCESS', mode: 'UPDATED', name: existingPlayer.name });
    } else {
      // ===== 完全未登録プレイヤーの自動作成・登録 =====
      const baseName = discordName || `User_${String(discordId).slice(-4)}`;
      let uniqueName = baseName;

      // 名前の重複をチェック
      const { data: nameDupCheck } = await supabase.from('ktm_players').select('id').eq('name', uniqueName).limit(1);
      if (nameDupCheck && nameDupCheck.length > 0) {
        uniqueName = `${baseName}_${String(discordId).slice(-4)}`;
      }

      const initialMmr = 1200;
      const newPlayerData: any = {
        name: uniqueName,
        discord_id: discordId,
        is_active: true,
        highest_rank: 'UNRANKED',
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
          SUP: initialMmr,
        },
        stats: {
          total: { g: 0, w: 0 },
          roles: {
            TOP: { g: 0, w: 0 },
            JG: { g: 0, w: 0 },
            MID: { g: 0, w: 0 },
            ADC: { g: 0, w: 0 },
            SUP: { g: 0, w: 0 },
          },
          recent: [],
        },
        role_preferences: updatedPrefs,
      };

      if (ng1) newPlayerData.ng_lane_1 = ng1;
      if (ng2) newPlayerData.ng_lane_2 = ng2;
      if (weight !== undefined && weight !== null && weight !== '') {
        const w = parseInt(String(weight));
        if (!Number.isNaN(w)) newPlayerData.weight = w;
      }
      if (allowHigher !== undefined && allowHigher !== null && allowHigher !== '') {
        newPlayerData.allow_higher = (allowHigher === 'true' || allowHigher === true);
      }

      const { error: insError } = await supabase.from('ktm_players').insert(newPlayerData);

      if (insError) {
        console.warn('[update-lane] full insert failed, retrying minimal insert:', insError.message);
        // 最小構成でのフォールバックINSERT
        const fallbackInsertData: any = {
          name: uniqueName,
          discord_id: discordId,
          is_active: true,
          highest_rank: 'UNRANKED',
          mmr: initialMmr,
          role_preferences: updatedPrefs,
        };
        const { error: fbInsError } = await supabase.from('ktm_players').insert(fallbackInsertData);
        if (fbInsError) {
          throw new Error(`新規プレイヤーの登録に失敗しました: ${fbInsError.message}`);
        }
      }

      return NextResponse.json({ status: 'SUCCESS', mode: 'CREATED', name: uniqueName });
    }
  } catch (e: any) {
    console.error('[update-lane] error:', e);
    return NextResponse.json({ status: 'ERROR', message: e.message }, { status: 500 });
  }
}
