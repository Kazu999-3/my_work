import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { playerId, playerName, stats } = await req.json();

    if (!playerId || !playerName) {
      return NextResponse.json({ error: 'Player ID or Name missing' }, { status: 400 });
    }

    // 7日間キャッシュのチェック（強制更新フラグがなければ、7日以内は既存プロファイルをそのまま返す）
    const { data: player } = await supabase
      .from('ktm_players')
      .select('metadata')
      .eq('id', playerId)
      .single();

    const meta = player?.metadata || {};
    const lastUpdated = meta.ai_profile_updated_at ? new Date(meta.ai_profile_updated_at).getTime() : 0;
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    if (meta.ai_profile && (now - lastUpdated < SEVEN_DAYS)) {
      return NextResponse.json({ success: true, profile: meta.ai_profile, cached: true });
    }

    // AI による週刊アナリスト一言プロファイルの生成
    const prompt = `あなたはKTM League of Legendsコミュニティの専属辛口プロアナリストです。
プレイヤー「${playerName}」の直近の統計データを分析し、彼のプレイスタイル・立ち回りの強みや特徴を【愛のあるくすっと笑えるキャッチーな一言プロファイル（120文字以内）】として作成してください。

【プレイヤー統計】
- 勝率: ${stats?.winRate || 50}% (${stats?.totalGames || 0}戦)
- 通算KDA: ${stats?.avgKda || '2.0'} (平均 ${stats?.avgKills || 0}/${stats?.avgDeaths || 0}/${stats?.avgAssists || 0})
- 得意チャンピオン: ${stats?.topChampion || '未登録'}
- メイン希望レーン: ${stats?.mainLane || 'FILL'}

【要件】
- 語尾は「〜するタイプ」「〜な熱血ファイター」「〜の司令塔」など、プロファイルに相応しいキャッチコピー風にしてください。
- 威張らず親しみやすい日本語で120文字以内で出力してください。`;

    const aiProfileText = await callGeminiWithRetry(prompt);
    const cleanProfile = (aiProfileText || '').replace(/[#*`]/g, '').trim();

    // Supabase の metadata に 7日間の不揮発キャッシュとして書き込み
    const updatedMetadata = {
      ...meta,
      ai_profile: cleanProfile,
      ai_profile_updated_at: new Date().toISOString(),
    };

    await supabase
      .from('ktm_players')
      .update({ metadata: updatedMetadata })
      .eq('id', playerId);

    return NextResponse.json({ success: true, profile: cleanProfile, cached: false });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AIプロファイル生成失敗' }, { status: 500 });
  }
}
