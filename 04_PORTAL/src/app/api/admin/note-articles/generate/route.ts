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

    // 3. Gemini 3 で note 500円記事（無料フック・有料実践ノウハウ・Xプロモ文）の執筆
    const prompt = `あなたはLeague of Legendsの勝率向上ノウハウを販売し、毎月数十万円を売り上げるトップアフィリエイトライター＆プロコーチです。
参考note記事のベストプラクティスに基づき、チャンピオン「${champion}」（パッチ ${patch}）の【500円有料note記事】のドラフトを執筆してください。

【チャンピオン基本情報 (SSOT)】
- 強み: ${champData.strengths || '未設定'}
- 弱み: ${champData.weaknesses || '未設定'}
- パワースパイク: ${champData.power_spikes || '未設定'}
- ビルド/ルーン: ${champData.build_runes || '未設定'}
- フルクリア時間: ${champData.full_clear_time || '未設定'}
- ピック推奨度: ${champData.pick_recommendation || '未設定'}

【関連ノート・実戦知見】
${notesSummary || '（特記事項なし）'}

【noteライティング最高峰ルール（参考資料ノウハウ）】
1. タイトル: 32文字以内。「なぜ今パッチ${patch}で${champion}を使うと勝率が上がるのか」が即座に伝わる強いフック。
2. 無料部分 (約400文字): 
   - 読者の悩みに共感（例: 「SoloQで味方に左右されて勝てない…」）
   - パッチ${patch}での${champion}の立ち位置と勝てる根拠
   - 有料部分を読むメリット（「これを知るだけで勝率+5%」）
3. 有料部分 (約800文字):
   - 具体的なビルドの買い順とルーン選択の理由
   - 序盤(〜10分)、中盤(〜20分)、終盤の具体的アクションプラン
   - 先出し/後出し時の対面立ち回り秘訣
   - 「王」「軍師」などのAI臭いポエム表現は1文字も使わず、実践的な情報のみを記述。
4. X(Twitter)宣伝テキスト (140文字以内): 読者がクリックしたくなる強い疑問提示とリンク用フック。

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

    // 4. AIポエムクレンジング・フィルター (参考記事ノウハウ: AI臭い装飾表現を徹底自動排除)
    const cleanAiPoetry = (text: string) => {
      if (!text) return '';
      return text
        .replace(/【?SoloQの王】?/g, 'SoloQで高い勝率を誇るチャンピオン')
        .replace(/【?盤上の軍師】?/g, '正確な判断')
        .replace(/圧倒的な力/g, '高いパフォーマンス')
        .replace(/至高の/g, '効果的な')
        .replace(/戦場を支配する/g, '試合主導権を握る')
        .replace(/降臨/g, 'ピック')
        .replace(/神の如き/g, '優れた');
    };

    const finalTitle = cleanAiPoetry(parsed.title || `【パッチ${patch}】${champion}攻略ガイド`);
    const finalFree = cleanAiPoetry(parsed.content_free || '');
    const finalPaid = cleanAiPoetry(parsed.content_paid || '');
    const finalPromo = cleanAiPoetry(parsed.promo_text || '');

    // 5. note_articles テーブルへ保存
    const { data: inserted, error: insErr } = await supabase
      .from('note_articles')
      .insert({
        title: finalTitle,
        champion,
        patch,
        content_free: finalFree,
        content_paid: finalPaid,
        promo_text: finalPromo,
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
