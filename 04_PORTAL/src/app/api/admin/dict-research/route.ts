import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { fetchChampionStats } from '../../../../lib/championStats';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

// 自動リサーチ: 辞典の下書きをAIで作る。
// 参考データは公式 Riot Data Dragon（スキルCD/射程/コスト・レベル別ステータス・公式Tips）。
// 以前はLoLalyticsのHTMLを読んでいたが、同サイトはJS描画のためサーバー取得では空になり、
// 勝率等が取れないまま動いていた。確実に取れる公式ソースへ切り替えた。
// 集計統計(勝率/ティア)は公式データに無いため、その系はAIが確実に分かる場合のみ埋める。
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { champion, role, save } = await req.json();
    if (!champion) return NextResponse.json({ error: 'champion が必要です。' }, { status: 400 });

    const site = await fetchChampionStats(champion);

    const prompt = `以下は公式(Riot Data Dragon)の「${champion}」の実データ（スキルのCD/射程/コスト、レベル別ステータス、公式Tips）です。
このキットデータとあなたの最新メタ知識を統合し、日本語のチャンピオン辞典を作成してください。
※ 勝率・ピック率・ティア等の集計統計はこのデータには含まれません。これらのフィールドは
  確実に分かる場合のみ記入し、不明なら空にしてください（推測で埋めない）。
  一方、強み/弱み/パワースパイク/ビルドは、キットデータとメタ知識から具体的に記述してください。

必ず以下のJSONのみ出力（コードブロック禁止）:
{
 "winRate":"<勝率。例: 51.72%。不明なら空>",
 "pickRate":"<ピック率。不明なら空>",
 "banRate":"<BAN率。不明なら空>",
 "tier":"<ティア評価。例: A+。不明なら空>",
 "rank":"<同ロール内の順位。例: 12 / 77。不明なら空>",
 "expertWinRate":"<上位プレイヤーの勝率(Best on 〜)。不明なら空>",
 "strengths":"<このチャンプの強み。得意対面・高勝率ビルド・ダメージ/ゴールド順位などの統計を根拠に120字以内>",
 "weaknesses":"<弱み。苦手対面や不利なスタッツ順位を根拠に120字以内>",
 "power_spikes":"<パワースパイク。コアアイテム完成やスキル上げ順から100字以内>",
 "build_runes":"<推奨ビルドとルーン。最も勝率が高い構成を具体名で120字以内>",
 "counter_champions":"<苦手なチャンピオン英語IDをカンマ区切り（countered most by の項目）>",
 "strong_against":"<得意なチャンピオン英語IDをカンマ区切り（strong counter to の項目）>",
 "objectives":"<オブジェクト関連の傾向。First Tower/Drake等の勝率から100字以内。不明なら空>",
 "summary":"<総評。今のメタでの立ち位置を100字以内>"
}

公式データ:
${site.ok ? site.text : '（公式データを取得できませんでした。あなたの知識で補ってください）'}`;

    const raw = await callGeminiWithRetry(prompt, { temperature: 0.2, maxOutputTokens: 2048, maxRetries: 2 });
    let cleaned = (raw || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s < 0 || e <= s) throw new Error('AI出力の解析に失敗しました');
    const result = JSON.parse(cleaned.slice(s, e + 1));

    // save=true なら辞典に反映（確認してから保存できるよう、既定では下書きを返すだけ）
    if (save) {
      await supabase.from('champion_facts').upsert({
        champion,
        strengths: result.strengths || null,
        weaknesses: result.weaknesses || null,
        power_spikes: result.power_spikes || null,
        build_runes: result.build_runes || null,
        counter_champions: result.counter_champions || null,
        patch: site.patch || null,
        source: 'opgg_research',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'champion' });
    }

    return NextResponse.json({
      success: true,
      champion,
      patch: site.patch,
      sourceUrl: site.ok ? site.source : null,
      saved: !!save,
      ...result,
    });
  } catch (e: any) {
    console.error('[dict-research] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
