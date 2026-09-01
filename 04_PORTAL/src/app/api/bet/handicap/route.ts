import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export const HANDICAP_LEVELS: Record<number, { level: number; cost: number; mmrPenalty: number; title: string; desc: string }> = {
  1: {
    level: 1,
    cost: 300,
    mmrPenalty: 150,
    title: 'Lv.1 軽度ハンデ (得意チャンプBAN / フラッシュ禁止)',
    desc: '得意チャンプ1体BANまたはフラッシュ禁止（ゴースト/TP等）。実効MMR -150'
  },
  2: {
    level: 2,
    cost: 600,
    mmrPenalty: 300,
    title: 'Lv.2 中度ハンデ (サモスペ固定 / キーアイテム禁止)',
    desc: 'サモナースペル1枠固定またはキーアイテム購入禁止。実効MMR -300（実質1ランクダウン）'
  },
  3: {
    level: 3,
    cost: 1200,
    mmrPenalty: 500,
    title: 'Lv.3 重度ハンデ (ブレイバリー縛り / ブーツ禁止)',
    desc: 'ランダムビルド縛りまたはブーツ購入禁止。実効MMR -500（実質2ランクダウン・格下と同等）'
  }
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fromDiscordId, fromName, targetName, level } = body;

    const handicap = HANDICAP_LEVELS[Number(level)];
    if (!handicap) {
      return NextResponse.json({ error: '無効なハンデレベルです（1, 2, 3 を指定してください）。' }, { status: 400 });
    }

    if (!targetName) {
      return NextResponse.json({ error: 'ハンデ対象のプレイヤー名を指定してください。' }, { status: 400 });
    }

    // 発動者（格下側）のコイン確認
    let q = supabase.from('ktm_players').select('name, coins');
    if (fromDiscordId) q = q.eq('discord_id', fromDiscordId);
    else if (fromName) q = q.eq('name', fromName);
    const { data: user } = await q.single();

    if (!user || (user.coins ?? 1000) < handicap.cost) {
      return NextResponse.json({ error: `所持コインが不足しています（現在: ${user?.coins ?? 1000}コイン / 必要: ${handicap.cost}コイン）。` }, { status: 400 });
    }

    // コインを控除
    const remaining = (user.coins ?? 1000) - handicap.cost;
    await supabase.from('ktm_players').update({ coins: remaining }).eq('name', user.name);

    return NextResponse.json({
      success: true,
      fromName: user.name,
      targetName,
      level: handicap.level,
      cost: handicap.cost,
      mmrPenalty: handicap.mmrPenalty,
      ruleTitle: handicap.title,
      ruleDesc: handicap.desc,
      remainingCoins: remaining,
      message: `🎗️ **【ハンデ発動】** ${user.name} さんが ${targetName} 選手に「${handicap.title}」を発動しました！（消費: ${handicap.cost}コイン / 実効MMR -${handicap.mmrPenalty}）`
    });
  } catch (error: any) {
    console.error('Handicap API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
