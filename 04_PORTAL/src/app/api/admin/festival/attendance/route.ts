import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

/**
 * お祭りカスタム出席記録API (POST /api/admin/festival/attendance)
 * 
 * 日曜のお祭りカスタム等の終了後、詳細な勝敗やスコアを入力せずに
 * 参加メンバーの通算試合数（total_games）のみを +1 して初参加フラグ（🔰）を外すための管理機能。
 * 
 * - 勝敗（winning_team）: 'DRAW'（引き分け扱い）
 * - ロール（role）: 'FESTIVAL'（ノーマライズ対象外のためレーン別MMRやランキングに影響なし）
 * - MMR変動（mmr_delta）: 0（レート非干渉）
 */
export async function POST(req: Request) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await req.json();
    const { players } = body || {};

    if (!Array.isArray(players) || players.length === 0) {
      return NextResponse.json(
        { error: '対象プレイヤーが指定されていません（1名以上必要です）' },
        { status: 400 }
      );
    }

    // 1. ktm_matches に「お祭りカスタム出席記録（EXHIBITION）」の試合レコードを作成
    // KTMシステム全体で、riot_match_id === 'EXHIBITION' の試合は
    // MMR整合性チェック・フルリビルド・個人スタッツ集計から完全除外される仕様（SSoT）。
    const nowIso = new Date().toISOString();

    const { data: matchData, error: matchError } = await supabase
      .from('ktm_matches')
      .insert({
        winning_team: 'DRAW',
        game_duration: 0,
        riot_match_id: 'EXHIBITION',
        created_at: nowIso,
      })
      .select('id')
      .single();

    if (matchError || !matchData) {
      console.error('[festival/attendance] 試合レコード作成失敗:', matchError);
      return NextResponse.json(
        { error: `お祭り試合データの作成に失敗しました: ${matchError?.message}` },
        { status: 500 }
      );
    }

    const newMatchId = matchData.id;

    // 2. ktm_match_participants に参加者全員分のレコードを作成
    const participantRows = players.map((p: any) => ({
      match_id: newMatchId,
      player_name: String(p.name || '').trim(),
      discord_id: p.discord_id ? String(p.discord_id).trim() : null,
      team: 'FESTIVAL',
      role: 'FESTIVAL',
      kills: 0,
      deaths: 0,
      assists: 0,
      vision_score: 0,
      kda_score: 0,
      mmr_delta: 0,
      created_at: nowIso,
    }));

    const { error: partError } = await supabase
      .from('ktm_match_participants')
      .insert(participantRows);

    if (partError) {
      console.error('[festival/attendance] 参加者レコード作成失敗:', partError);
      // ロールバック代わりに試合レコードを削除
      await supabase.from('ktm_matches').delete().eq('id', newMatchId);
      return NextResponse.json(
        { error: `参加者データの保存に失敗しました: ${partError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      matchId: newMatchId,
      count: participantRows.length,
      message: `${participantRows.length}名にお祭り参加回数（+1）を記録しました`,
    });
  } catch (err: any) {
    console.error('[festival/attendance] 予期せぬエラー:', err);
    return NextResponse.json(
      { error: err?.message || 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
