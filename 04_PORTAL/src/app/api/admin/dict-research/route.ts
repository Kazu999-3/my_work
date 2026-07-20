import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

// 自動リサーチ: LoL統計サイト(OP.GG)から最新のメタ情報を取得し、辞典の下書きを作る。
// 取得できるのは「勝率/ピック率/BAN率」「得意・苦手対面」「コアビルド」「ルーン」など。
// スクレイピングなのでHTML構造の変化に弱い → 取れた分だけ使い、失敗しても落とさない設計。
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROLE_PATH: Record<string, string> = {
  TOP: 'top', JG: 'jungle', JUNGLE: 'jungle', MID: 'mid',
  ADC: 'adc', BOT: 'adc', SUP: 'support', SUPPORT: 'support',
};

/** OP.GGのビルドページから統計テキストを抜き出す */
async function fetchOpgg(champion: string, role: string) {
  const slug = champion.toLowerCase().replace(/[^a-z0-9]/g, '');
  const lane = ROLE_PATH[String(role).toUpperCase()] || 'jungle';
  const url = `https://op.gg/lol/champions/${slug}/build/${lane}`;

  const res = await fetch(url, {
    headers: {
      // 通常のブラウザとして扱ってもらう（弾かれると空HTMLが返るため）
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'ja,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`OP.GGの取得に失敗しました (HTTP ${res.status})`);
  const html = await res.text();

  // タグを落として本文テキスト化（AIに読ませるため、正確なDOM解析までは不要）
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // パッチ番号（"Patch 16.14" 等）を拾えたら記録に使う
  const patchMatch = text.match(/[Pp]atch\s*(\d+\.\d+)/) || html.match(/(\d+\.\d+)\.\d+\/champion/);
  return { url, text: text.slice(0, 18000), patch: patchMatch ? patchMatch[1] : null };
}

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { champion, role, save } = await req.json();
    if (!champion) return NextResponse.json({ error: 'champion が必要です。' }, { status: 400 });

    const site = await fetchOpgg(champion, role || 'JG');

    const prompt = `以下はLoL統計サイト(OP.GG)の「${champion}」ビルドページから抽出したテキストです。
ここから読み取れる**実際の統計データ**をもとに、日本語のチャンピオン辞典を作成してください。
テキストに無い情報は推測で補わず、読み取れた範囲で簡潔に書いてください。

必ず以下のJSONのみ出力（コードブロック禁止）:
{
 "winRate":"<勝率。例: 50.15%。不明なら空>",
 "pickRate":"<ピック率。不明なら空>",
 "banRate":"<BAN率。不明なら空>",
 "tier":"<ティア。例: 2 Tier。不明なら空>",
 "strengths":"<このチャンプの強み。統計(得意対面/高勝率ビルド)を根拠に120字以内>",
 "weaknesses":"<弱み。苦手対面を根拠に120字以内>",
 "power_spikes":"<パワースパイク。コアアイテム完成タイミング等から100字以内>",
 "build_runes":"<推奨ビルドとルーン。最も勝率/採用率が高い構成を具体名で120字以内>",
 "counter_champions":"<苦手なチャンピオン英語IDをカンマ区切り（Weak against の項目）>",
 "strong_against":"<得意なチャンピオン英語IDをカンマ区切り（Strong against の項目）>",
 "summary":"<総評。今のメタでの立ち位置を100字以内>"
}

テキスト:
${site.text}`;

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
      sourceUrl: site.url,
      saved: !!save,
      ...result,
    });
  } catch (e: any) {
    console.error('[dict-research] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
