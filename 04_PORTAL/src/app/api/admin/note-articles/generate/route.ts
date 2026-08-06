import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // AI記事執筆は時間を要するため長めに設定

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const requestedChampion = body.champion;

    // 1. 対象チャンピオンの決定
    let champData: any = null;
    if (requestedChampion) {
      const { data } = await supabase
        .from('champion_facts')
        .select('*')
        .ilike('champion', requestedChampion)
        .maybeSingle();
      champData = data;
    }

    if (!champData) {
      // 指定がない場合は、内容が充実している最新パッチのチャンピオンからランダム/先頭1体を抽出
      const { data: list } = await supabase
        .from('champion_facts')
        .select('*')
        .not('strengths', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (!list || list.length === 0) {
        return NextResponse.json({ error: '生成対象のチャンピオンデータ(champion_facts)が見つかりません' }, { status: 400 });
      }

      champData = list[Math.floor(Math.random() * list.length)];
    }

    const champion = champData.champion;
    const patch = champData.patch || '16.15';

    console.log(`[note-generate] ${champion} (パッチ${patch}) の500円有料記事ドラフトを自動生成します...`);

    // 2. 関連ノート・知見の取得
    const { data: notes } = await supabase
      .from('champion_notes')
      .select('title, body')
      .ilike('champion', champion)
      .limit(3);

    const notesSummary = (notes || []).map((n: any) => `・【${n.title}】 ${n.body?.slice(0, 200)}`).join('\n');

    // 3. Gemini 3.1 で note 500円記事（無料部分・有料部分・Xプロモ文）の執筆
    const prompt = `あなたはLeague of Legendsの勝率向上ノウハウを販売するトップアフィリエイトライター＆コーチです。
チャンピオン「${champion}」（パッチ ${patch}）の【500円有料note記事】のドラフトを執筆してください。

【チャンピオン基本情報 (SSOT)】
- 強み: ${champData.strengths || '未設定'}
- 弱み: ${champData.weaknesses || '未設定'}
- パワースパイク: ${champData.power_spikes || '未設定'}
- ビルド/ルーン: ${champData.build_runes || '未設定'}
- フルクリア時間: ${champData.full_clear_time || '未設定'}
- ピック推奨度: ${champData.pick_recommendation || '未設定'}

【関連ノート・実戦知見】
${notesSummary || '（特記事項なし）'}

【執筆ルール】
1. タイトルは読者の目を引く視認性重視（32文字以内）。
2. 無料部分は、パッチ${patch}での立ち位置・なぜ今勝てるのかの概論（約400文字）。
3. 有料部分は、対面勝利のための具体的な立ち回り、具体的なコアビルド順、有利・不利対面への立ち回り秘訣（約800文字）。
4. プロモテキストは、X(Twitter)で投稿する宣伝ポスト用文面（140文字以内）。
5. AI臭い比喩や「王」「軍師」などの過度な装飾表現は一切使用しないこと。

以下のJSONフォーマットのみで出力してください（コードブロック \`\`\`json も可）:
{
  "title": "記事タイトル(32文字以内)",
  "content_free": "無料部分の本文 (Markdown)",
  "content_paid": "有料部分の本文 (Markdown)",
  "promo_text": "X宣伝用テキスト(140文字以内)"
}`;

    const rawResult = await callGeminiWithRetry(prompt, {
      model: 'gemini-3.1-flash-lite',
      temperature: 0.7,
      maxOutputTokens: 2500,
    });

    let parsed: any = {};
    try {
      let cleaned = rawResult.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
      }
      const s = cleaned.indexOf('{');
      const e = cleaned.lastIndexOf('}');
      if (s >= 0 && e > s) cleaned = cleaned.slice(s, e + 1);
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        title: `【パッチ${patch}】${champion}で勝ち越すための立ち回り完全ガイド`,
        content_free: rawResult.slice(0, 400),
        content_paid: rawResult.slice(400),
        promo_text: `パッチ${patch}の${champion}徹底解説記事を公開しました！`,
      };
    }

    // 4. note_articles テーブルへ保存
    const { data: inserted, error: insErr } = await supabase
      .from('note_articles')
      .insert({
        title: parsed.title || `【パッチ${patch}】${champion}攻略ガイド`,
        champion,
        patch,
        content_free: parsed.content_free || '',
        content_paid: parsed.content_paid || '',
        promo_text: parsed.promo_text || '',
        status: 'draft',
        source_skill: 'auto_generator_ssot',
      })
      .select()
      .single();

    if (insErr) throw insErr;

    console.log(`✅ [note-generate] 記事「${inserted.title}」を生成し保存しました (ID: ${inserted.id})`);

    return NextResponse.json({
      success: true,
      article: inserted,
    });
  } catch (err: any) {
    console.error('[note-generate] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
