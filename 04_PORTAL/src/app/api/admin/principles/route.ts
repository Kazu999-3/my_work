import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

// 汎用原則の抽出。
// 辞典・メモ・ナレッジからチャンピオン固有の記述を除き、
// 「どのチャンプでも通用する判断・マクロ・考え方」だけをテーマ別のテキストにまとめる。
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const THEMES = [
  { key: 'macro', label: 'マクロ・試合運び' },
  { key: 'laning', label: 'レーン戦・対面の駆け引き' },
  { key: 'objective', label: 'オブジェクトと集団戦' },
  { key: 'vision', label: '視界とマップ把握' },
  { key: 'mindset', label: '判断力・メンタル' },
];

/** 保存済みの汎用原則を返す（一般公開用にGETは認証不要） */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('universal_principles')
      .select('id, theme, title, body, source_count, generated_at')
      .order('generated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, principles: data || [], themes: THEMES });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { theme } = await req.json();
    const themeDef = THEMES.find((t) => t.key === theme);
    if (!themeDef) {
      return NextResponse.json({ error: `theme は ${THEMES.map(t => t.key).join('/')} のいずれかです。` }, { status: 400 });
    }

    // 1) 素材を集める: 辞典の戦略・チャンピオンノート・対面メモ・ナレッジ記事
    const [facts, notes, memos, knowledge] = await Promise.all([
      supabase.from('champion_facts').select('champion, strategy, note_draft').limit(200),
      supabase.from('champion_notes').select('champion, title, body').limit(300),
      supabase.from('matchup_sentinel').select('champion, enemy, strategy').neq('enemy', 'GLOBAL').limit(300),
      supabase.from('personal_knowledge').select('title, content, champion').or('tags.is.null,tags.not.cs.{__DELETED__}').limit(200),
    ]);

    // チャンピオン名を伏せ字にして「固有名詞に引きずられた要約」を防ぐ。
    // これをしないと結局「Gravesは〜」という記述がそのまま出てくる。
    const championNames = new Set<string>();
    (facts.data || []).forEach((f: any) => f.champion && championNames.add(f.champion));
    (notes.data || []).forEach((n: any) => n.champion && championNames.add(n.champion));
    (memos.data || []).forEach((m: any) => { if (m.champion) championNames.add(m.champion); if (m.enemy) championNames.add(m.enemy); });

    const mask = (text: string) => {
      let out = String(text || '');
      for (const name of championNames) {
        if (!name || name.length < 3) continue;
        out = out.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '【あるチャンプ】');
      }
      return out;
    };

    const chunks: string[] = [];
    (facts.data || []).forEach((f: any) => { if (f.strategy) chunks.push(mask(f.strategy)); if (f.note_draft) chunks.push(mask(f.note_draft)); });
    (notes.data || []).forEach((n: any) => { if (n.body) chunks.push(mask(n.body)); });
    (memos.data || []).forEach((m: any) => { if (m.strategy) chunks.push(mask(m.strategy)); });
    (knowledge.data || []).forEach((k: any) => { if (k.content) chunks.push(mask(k.content)); });

    const material = chunks.filter(Boolean).join('\n---\n').slice(0, 24000);
    if (material.length < 200) {
      return NextResponse.json({ error: '素材となる辞典・メモがまだ足りません。' }, { status: 400 });
    }

    const prompt = `以下はLoLの攻略メモ・辞典を集めたテキストです（チャンピオン名は【あるチャンプ】に伏せてあります）。

ここから「**${themeDef.label}**」に関する、**特定のチャンピオンに依存しない普遍的な原則・考え方**だけを抽出し、読み物として使える日本語のテキストを作成してください。

厳守事項:
- 特定チャンピオンの性能・スキル・ビルドの話は**一切含めない**
- 「どのチャンプを使っていても通用する判断基準」だけを書く
- 素材に書かれていない一般論を創作しない。素材から読み取れる範囲でまとめる
- 抽象的な精神論ではなく、**具体的な状況と行動**で書く（例:「相手ジャングルが上に映ったら、下のオブジェクトを準備する」）

必ず以下のJSONのみ出力（コードブロック禁止）:
{"title":"<このテキストのタイトル。25字以内>","body":"<Markdown本文。## 見出しで3〜5節に分け、各節は箇条書き3〜5項目。全体1200〜1800字>"}

素材:
${material}`;

    const raw = await callGeminiWithRetry(prompt, { temperature: 0.35, maxOutputTokens: 4096, maxRetries: 2 });
    let cleaned = (raw || '').trim().replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s < 0 || e <= s) throw new Error('AI出力の解析に失敗しました');
    const result = JSON.parse(cleaned.slice(s, e + 1));

    // 同テーマの古い版は置き換える（履歴を溜めすぎない）
    await supabase.from('universal_principles').delete().eq('theme', themeDef.key);
    const { data: inserted, error: insErr } = await supabase
      .from('universal_principles')
      .insert({
        theme: themeDef.key,
        title: result.title || themeDef.label,
        body: result.body || '',
        source_count: chunks.length,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    return NextResponse.json({ success: true, principle: inserted, sourceCount: chunks.length });
  } catch (e: any) {
    console.error('[principles] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
