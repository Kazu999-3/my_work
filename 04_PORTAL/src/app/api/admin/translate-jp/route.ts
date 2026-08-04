import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';
import { recordMatchupSentinelRevision } from '../../../../lib/matchupSentinelRevisions';

// 既存データの日本語化。英語のまま保存されている辞典・記事を日本語へ変換する。
// チャンク処理にして、クライアントから完了まで繰り返し呼ぶ（同期処理と同じ方式）。
export const dynamic = 'force-dynamic';
// CHUNK=2件 × 最大8フィールド × (Gemini呼び出し + 4秒クールダウン)は60秒を超えうるため、
// Vercelのタイムアウトでプラットフォーム側のプレーンテキストエラーページが返って
// クライアントのres.json()が"Unexpected token 'A'..."で落ちていた。余裕を持って延長する。
export const maxDuration = 280;

// 1リクエストでの変換件数。連続でAIを呼ぶとレート制限(429)に当たりやすいため小さく保つ。
const CHUNK = 2;
// AI呼び出しの間に置く待機。無料枠は「1分あたりのリクエスト数」で制限されるため、
// 間隔を空けることで429そのものを避ける（リトライに頼らない）。
const COOL_DOWN_MS = 4000;

// 動詞（の語幹）を含むかどうか。アイテム名・ルーン名だけの羅列（例:
// "Arcane Boots, Scythe of Vyse, Locket of the Iron Solari"）は、翻訳指示上
// 固有名詞を英語のまま残すため、AIに何度渡しても内容が変化しない。
// それにも関わらずisEnglish()が「まだ英語」と判定し続け、champion_facts の
// power_spikes/build_runes 等で同じ十数件を無限に再翻訳し続け、変換件数だけが
// 際限なく積み上がる不具合があった(2026-08-04、"日本語化500件超え"として発覚)。
// 固有名詞の羅列には動詞がほぼ出現しないため、動詞の有無で「本当に翻訳が
// 必要な英文か」と「翻訳不要な固有名詞リスト」を切り分ける。
const PROSE_VERB_RE = /\b(is|are|was|were|has|have|excel|lack|provid|allow|requir|need|deal|struggl|reli|domina|focus|help|make|giv|offer|becom|remain|contain|includ|featur|utiliz|maxim|secur|priorit|understand|analyz|adapt|anticipat|gain|build|scal|engag|push|initiat|control|manag|counter|synerg|position)\w*\b/i;

/** 日本語がほとんど含まれない＝英語のままと判定する */
function isEnglish(text: string): boolean {
  const t = String(text || '').trim();
  if (t.length < 20) return false; // 短すぎるものは判定しない

  // 日本語文字の比率で判定する。閾値5%は厳しすぎて、
  // 「見出しだけ日本語で本文は英語」といった混在データが対象外になっていた。
  const jp = (t.match(/[ぁ-んァ-ヶ一-龠]/g) || []).length;
  const ratio = jp / t.length;
  if (ratio >= 0.25) return false; // 十分に日本語 → 対象外

  // 比率が低くても、英単語がほとんど無ければ（記号や数値の羅列）翻訳しない
  const words = (t.match(/[A-Za-z]{3,}/g) || []).length;
  if (words < 8) return false;

  // 動詞が無ければアイテム名等の固有名詞リストの可能性が高いため対象外にする
  return PROSE_VERB_RE.test(t);
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
    // レート制限・サーバー高負荷(503)は「失敗」ではなく「今は打ち止め」。
    // ここまでの成果を保持して中断し、呼び出し側が待って再開する。
    const msg = String(e?.message || '');
    if (msg.includes('レート制限') || msg.includes('503') || msg.includes('一時的に利用できません')) {
      throw new RateLimited();
    }
    throw e;
  }
}

export async function POST(req: Request) {
  // ===== 管理者セッション or CRON_SECRET(日次自動整備用) =====
  const cronOk = !!process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk) {
    const auth = await verifyAdminSession(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { target } = await req.json(); // 'facts' | 'articles' | 'memos'
    let converted = 0;
    let remaining = 0;
    let rateLimited = false; // 制限に当たって中断したか
    let scanned = 0;         // 判定した総件数（0件変換だった理由の確認用）
    const samples: string[] = [];

    // ===== 1. チャンピオン辞典（構造化項目） =====
    if (target === 'facts') {
      const { data } = await supabase
        .from('champion_facts')
        .select('champion, strengths, weaknesses, power_spikes, build_runes, strategy, note_draft, counter_champions, pick_recommendation, jg_description');
      // 英語で入りうる文章項目をすべて対象にする（一部だけ残ると混在して読みにくいため）
      const fields = ['strengths', 'weaknesses', 'power_spikes', 'build_runes', 'strategy', 'note_draft', 'pick_recommendation', 'jg_description'] as const;

      const targets = (data || []).filter((f: any) => fields.some((k) => isEnglish(f[k])));
      remaining = Math.max(0, targets.length - CHUNK);
      scanned = (data || []).length; // 判定結果を画面で確認できるようにする

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

      // 本文(raw_content/content)だけを判定基準にしていたため、YouTube動画取り込みAIが
      // 本文は既に日本語で生成する一方、タイトルだけ英語のまま(例: "[YouTube] Coaching
      // Jungle Fundamentals - How to climb in League of Legends")残っているレコードが
      // 対象から漏れ続けていた(2026-08-04発覚)。タイトル単体の英語も対象に含める。
      const targets = (data || []).filter((a: any) => isEnglish(a.raw_content || a.content) || isEnglish(a.title));
      remaining = Math.max(0, targets.length - CHUNK);
      scanned = (data || []).length;

      for (const a of targets.slice(0, CHUNK)) {
        try {
          const src = a.raw_content || a.content;
          const bodyNeedsTranslation = isEnglish(src);
          const jpTitle = isEnglish(a.title) ? await toJapanese(a.title, '記事タイトル') : a.title;
          if (isEnglish(a.title)) await sleep(COOL_DOWN_MS);

          const updatePayload: Record<string, any> = { title: jpTitle };
          if (bodyNeedsTranslation) {
            const jp = await toJapanese(src, '攻略記事');
            updatePayload.raw_content = jp;
            updatePayload.content = jp.slice(0, 300).replace(/[#*`]/g, '');
            await sleep(COOL_DOWN_MS);
          }
          await supabase.from('personal_knowledge').update(updatePayload).eq('id', a.id);
          converted++;
          if (samples.length < 3) samples.push(a.title || `記事${a.id}`);
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
        .select('matchup_id, title, strategy')
        .not('strategy', 'is', null)
        .limit(500);

      // champion_notes（記事から生成されたノート）も英語のまま残るため対象にする
      const { data: notes } = await supabase
        .from('champion_notes').select('id, title, body').not('body', 'is', null).limit(500);

      // 本文だけでなくtitle単体が英語のまま残るケースも対象に含める(articlesと同じ根本原因)
      const memoTargets = (memos || []).filter((m: any) => isEnglish(m.strategy) || isEnglish(m.title)).map((m: any) => ({ kind: 'memo', ...m }));
      const noteTargets = (notes || []).filter((n: any) => isEnglish(n.body) || isEnglish(n.title)).map((n: any) => ({ kind: 'note', ...n }));
      const targets = [...memoTargets, ...noteTargets];
      remaining = Math.max(0, targets.length - CHUNK);
      scanned = (memos || []).length + (notes || []).length;

      for (const t of targets.slice(0, CHUNK)) {
        try {
          const bodyField = t.kind === 'memo' ? t.strategy : t.body;
          const bodyNeedsTranslation = isEnglish(bodyField);
          const titleNeedsTranslation = isEnglish(t.title);
          const jpTitle = titleNeedsTranslation ? await toJapanese(t.title, t.kind === 'memo' ? '対面攻略メモのタイトル' : 'チャンピオン攻略ノートのタイトル') : t.title;
          if (titleNeedsTranslation) await sleep(COOL_DOWN_MS);
          const jpBody = bodyNeedsTranslation ? await toJapanese(bodyField, t.kind === 'memo' ? '対面攻略メモ' : 'チャンピオン攻略ノート') : bodyField;
          if (bodyNeedsTranslation) await sleep(COOL_DOWN_MS);

          if (t.kind === 'memo') {
            const updatePayload: Record<string, any> = { title: jpTitle };
            if (bodyNeedsTranslation) updatePayload.strategy = jpBody;
            await supabase.from('matchup_sentinel').update(updatePayload).eq('matchup_id', t.matchup_id);
            if (bodyNeedsTranslation) {
              await recordMatchupSentinelRevision(
                t.matchup_id,
                { strategy: t.strategy },
                { strategy: jpBody },
                '英語→日本語 自動翻訳'
              );
            }
            if (samples.length < 3) samples.push(t.matchup_id);
          } else {
            const updatePayload: Record<string, any> = { title: jpTitle };
            if (bodyNeedsTranslation) updatePayload.body = jpBody;
            await supabase.from('champion_notes').update(updatePayload).eq('id', t.id);
            if (samples.length < 3) samples.push(`note${t.id}`);
          }
          converted++;
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
      scanned,
      samples,
    });
  } catch (e: any) {
    console.error('[translate-jp] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
