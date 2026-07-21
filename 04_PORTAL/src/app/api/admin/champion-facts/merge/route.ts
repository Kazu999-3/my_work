import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';
import { recordRevision } from '../../../../../lib/knowledgeRevisions';

// 記事統合時に champion_facts（強み/弱み/パワースパイク/ビルド）も更新する。
// 重要: 既存を丸ごと上書きせず、「既存に無い知見だけを足す」マージ方式にする。
// 手で書いた内容や過去の蓄積が消えないようにするため。
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FIELDS = [
  { key: 'strengths', label: '強み' },
  { key: 'weaknesses', label: '弱み' },
  { key: 'power_spikes', label: 'パワースパイク' },
  { key: 'build_runes', label: 'ビルド/ルーン' },
] as const;

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    // articleId は履歴に「どの記事由来か」を残すためのもの（無くても動く）
    const { champions, title, body, articleId } = await req.json();
    const list: string[] = Array.isArray(champions) ? champions : (champions ? [champions] : []);
    if (list.length === 0 || !body || String(body).trim().length < 50) {
      return NextResponse.json({ error: 'champions と十分な長さの body が必要です。' }, { status: 400 });
    }

    const results: any[] = [];

    for (const champion of list) {
      try {
        // 既存の辞典を取得（無ければ新規作成扱い）
        const { data: existing } = await supabase
          .from('champion_facts')
          .select('champion, strengths, weaknesses, power_spikes, build_runes')
          .eq('champion', champion)
          .maybeSingle();

        const currentText = FIELDS
          .map(f => `【${f.label}】\n${(existing as any)?.[f.key] || '（未記入）'}`)
          .join('\n\n');

        const prompt = `「${champion}」のチャンピオン辞典を、新しい記事の内容で更新します。

【現在の辞典】
${currentText}

【新しい記事: ${title || '無題'}】
${String(body).slice(0, 8000)}

指示:
- 各項目について、**既存の記述を残したまま**、記事から読み取れる新しい知見を追記してください
- 既存と同じ内容は繰り返さない。矛盾する場合は両論を併記せず、より具体的な方を採用
- 記事に該当する情報が無い項目は、既存のテキストを**そのまま返す**（勝手に書き換えない）
- 各項目200字以内。箇条書きではなく文章で

必ず以下のJSONのみ出力（コードブロック禁止）:
{"strengths":"...","weaknesses":"...","power_spikes":"...","build_runes":"...","added":["<今回追記した内容の要約を最大3つ>"]}`;

        const raw = await callGeminiWithRetry(prompt, { temperature: 0.3, maxOutputTokens: 2048, maxRetries: 2 });
        let cleaned = (raw || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
        const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
        if (s < 0 || e <= s) throw new Error('AI出力の解析に失敗');
        const merged = JSON.parse(cleaned.slice(s, e + 1));

        // 空文字で既存を消してしまわないよう、値がある項目だけ更新する
        const payload: any = { champion, updated_at: new Date().toISOString() };
        for (const f of FIELDS) {
          const v = merged[f.key];
          if (typeof v === 'string' && v.trim()) payload[f.key] = v.trim();
          else if ((existing as any)?.[f.key]) payload[f.key] = (existing as any)[f.key];
        }

        const { error: upErr } = await supabase
          .from('champion_facts')
          .upsert(payload, { onConflict: 'champion' });
        if (upErr) throw new Error(upErr.message);

        // 項目ごとに履歴を残し、どの記事で何が増えたのかを後から辿れるようにする
        for (const f of FIELDS) {
          if (payload[f.key] === undefined) continue;
          await recordRevision({
            targetType: 'champion_fact',
            targetKey: champion,
            field: f.key,
            before: (existing as any)?.[f.key],
            after: payload[f.key],
            sourceTitle: title,
            sourceId: articleId,
          });
        }

        results.push({ champion, ok: true, added: merged.added || [] });
      } catch (err: any) {
        console.warn(`[champion-facts/merge] ${champion} の更新に失敗:`, err?.message);
        results.push({ champion, ok: false, error: err?.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    console.error('[champion-facts/merge] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
