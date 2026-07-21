import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

// 既存データの日本語化。英語のまま保存されている辞典・記事を日本語へ変換する。
// チャンク処理にして、クライアントから完了まで繰り返し呼ぶ（同期処理と同じ方式）。
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 1リクエストでの変換件数。連続でAIを呼ぶとレート制限(429)に当たりやすいため小さく保つ。
const CHUNK = 2;
// AI呼び出しの間に置く待機。無料枠は「1分あたりのリクエスト数」で制限されるため、
// 間隔を空けることで429そのものを避ける（リトライに頼らない）。
const COOL_DOWN_MS = 4000;

/** 日本語がほとんど含まれない＝英語のままと判定する */
function isEnglish(text: string): boolean {
  const t = String(text || '').trim();
  if (t.length < 30) return false; // 短すぎるものは判定しない
  const jp = (t.match(/[ぁ-んァ-ヶ一-龠]/g) || []).length;
  return jp / t.length < 0.05; // 日本語文字が5%未満なら英語とみなす
}

/** レート制限に当たったことを示すエラー（呼び出し側で「中断して途中保存」に使う） */
class RateLimited extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function toJapanese(text: string, kind: string): Promise<string> {
  const prompt = `以下の${kind}を自然な日本語に翻訳してください。
- 内容を省略・要約せず、意味をそのまま日本語にすること
- チャンピオン名・アイテム名・ルーン名・スキル名は英語表記のまま残すこと
- Markdownの記法（見出し・箇条書き）はそのまま維持すること
- 翻訳結果の本文のみを出力し、前置きや説明は書かないこと

原文:
${String(text).slice(0, 10000)}`;
  try {
    // 一括翻訳はバッチ処理なので、専用キーがあればそちらを使い対話系の枠を圧迫しない
    const apiKeyEnv = process.env.GEMINI_API_KEY_BATCH ? 'GEMINI_API_KEY_BATCH' : 'GEMINI_API_KEY';
    const out = await callGeminiWithRetry(prompt, { temperature: 0.2, maxOutputTokens: 4096, maxRetries: 3, apiKeyEnv });
    return (out || '').trim();
  } catch (e: any) {
    // レート制限は「失敗」ではなく「今は打ち止め」。ここまでの成果を保持して中断する。
    if (String(e?.message || '').includes('レート制限')) throw new RateLimited();
    throw e;
  }
}

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { target } = await req.json(); // 'facts' | 'articles' | 'memos'
    let converted = 0;
    let remaining = 0;
    let rateLimited = false; // 制限に当たって中断したか
    const samples: string[] = [];

    // ===== 1. チャンピオン辞典（構造化項目） =====
    if (target === 'facts') {
      const { data } = await supabase
        .from('champion_facts')
        .select('champion, strengths, weaknesses, power_spikes, build_runes, strategy');
      const fields = ['strengths', 'weaknesses', 'power_spikes', 'build_runes', 'strategy'] as const;

      const targets = (data || []).filter((f: any) => fields.some((k) => isEnglish(f[k])));
      remaining = Math.max(0, targets.length - CHUNK);

      for (const f of targets.slice(0, CHUNK)) {
        const payload: any = { champion: f.champion, updated_at: new Date().toISOString() };
        let touched = false;
        try {
          for (const k of fields) {
            if (isEnglish((f as any)[k])) {
              payload[k] = await toJapanese((f as any)[k], 'チャンピオン攻略情報');
              touched = true;
              await sleep(COOL_DOWN_MS);
            }
          }
        } catch (e) {
          if (e instanceof RateLimited) rateLimited = true; else throw e;
        }
        // 途中まで翻訳できた分は保存する（次回はその続きから）
        if (touched) {
          await supabase.from('champion_facts').upsert(payload, { onConflict: 'champion' });
          converted++;
          if (samples.length < 3) samples.push(f.champion);
        }
        if (rateLimited) break;
      }
    }

    // ===== 2. 攻略ライブラリの記事 =====
    if (target === 'articles') {
      const { data } = await supabase
        .from('personal_knowledge')
        .select('id, title, content, raw_content')
        .or('tags.is.null,tags.not.cs.{__DELETED__}')
        .limit(500);

      const targets = (data || []).filter((a: any) => isEnglish(a.raw_content || a.content));
      remaining = Math.max(0, targets.length - CHUNK);

      for (const a of targets.slice(0, CHUNK)) {
        try {
          const src = a.raw_content || a.content;
          const jp = await toJapanese(src, '攻略記事');
          await sleep(COOL_DOWN_MS);
          const jpTitle = isEnglish(a.title) ? await toJapanese(a.title, '記事タイトル') : a.title;
          await supabase.from('personal_knowledge').update({
            title: jpTitle,
            raw_content: jp,
            content: jp.slice(0, 300).replace(/[#*`]/g, ''),
          }).eq('id', a.id);
          converted++;
          if (samples.length < 3) samples.push(a.title || `記事${a.id}`);
          await sleep(COOL_DOWN_MS);
        } catch (e) {
          if (e instanceof RateLimited) { rateLimited = true; break; }
          throw e;
        }
      }
    }

    // ===== 3. 対面メモ・チャンピオンノート =====
    if (target === 'memos') {
      const { data: memos } = await supabase
        .from('matchup_sentinel')
        .select('matchup_id, strategy')
        .not('strategy', 'is', null)
        .limit(500);

      const targets = (memos || []).filter((m: any) => isEnglish(m.strategy));
      remaining = Math.max(0, targets.length - CHUNK);

      for (const m of targets.slice(0, CHUNK)) {
        try {
          const jp = await toJapanese(m.strategy, '対面攻略メモ');
          await supabase.from('matchup_sentinel').update({ strategy: jp }).eq('matchup_id', m.matchup_id);
          converted++;
          if (samples.length < 3) samples.push(m.matchup_id);
          await sleep(COOL_DOWN_MS);
        } catch (e) {
          if (e instanceof RateLimited) { rateLimited = true; break; }
          throw e;
        }
      }
    }

    return NextResponse.json({
      success: true,
      converted,
      remaining,
      // レート制限で中断した場合は done にしない（クライアント側で待機して再開する）
      done: remaining === 0 && !rateLimited,
      rateLimited,
      samples,
    });
  } catch (e: any) {
    console.error('[translate-jp] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
