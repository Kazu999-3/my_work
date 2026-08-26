import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';
import { recordRevision } from '../../../../../lib/knowledgeRevisions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TREND_FIELDS = [
  { key: 'strengths', label: '強み・パワースパイク' },
  { key: 'weaknesses', label: '弱点・カウンター対策' },
  { key: 'power_spikes', label: '時間帯別パワースパイク詳細' },
  { key: 'build_runes', label: '推奨ビルド・ルーン状況別選択' },
  { key: 'strategy', label: '基本立ち回り・集団戦マクロ' },
  { key: 'must_ban_champions', label: 'BAN推奨・天敵' },
  { key: 'pick_recommendation', label: 'ピック基準・構成相性' },
];

/**
 * チャンピオン辞典のAI知見清書・重複排除API
 * 複数の記事統合により蓄積された【追記知見】の重複や表記揺れを削ぎ落とし、
 * 最新メタに合わせた洗練された構造化データとして清書する。
 */
export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const { champion, role, dryRun = false } = body;

    if (!champion) {
      return NextResponse.json({ error: 'champion は必須です' }, { status: 400 });
    }

    // 既存の champion_facts を取得
    let query = supabase.from('champion_facts').select('*').eq('champion', champion);
    if (role && role !== 'GLOBAL') {
      query = query.ilike('role', role);
    }
    let { data: existingFact, error: factErr } = await query.maybeSingle();
    if (factErr) throw factErr;

    // champion_facts がない場合、matchup_sentinel からフォールバック取得
    if (!existingFact) {
      const { data: sentinelData } = await supabase
        .from('matchup_sentinel')
        .select('*')
        .eq('champion', champion)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (sentinelData && sentinelData.length > 0) {
        const s = sentinelData[0];
        existingFact = {
          champion,
          role: s.role || role || 'GLOBAL',
          strengths: s.strengths || '',
          weaknesses: s.weaknesses || '',
          power_spikes: s.power_spikes || '',
          build_runes: s.build_runes || '',
          strategy: s.strategy || '',
          must_ban_champions: s.must_ban_champions || '',
          pick_recommendation: s.pick_recommendation || '',
        };
      }
    }

    if (!existingFact) {
      return NextResponse.json({ error: `「${champion}」の蓄積知見データがまだありません。まず「最新トレンド取得」または編集から知見を追加してください。` }, { status: 404 });
    }

    // 既存の各フィールド内容を整理
    const fieldTexts: Record<string, string> = {};
    for (const f of TREND_FIELDS) {
      fieldTexts[f.key] = (existingFact as any)?.[f.key] || '';
    }

    const prompt = `あなたはLeague of Legendsの最高峰の戦略アナリスト兼プロコーチです。
以下は、「${champion}」（対象ロール: ${existingFact.role || role || 'GLOBAL'}）に関して様々な解説記事から収集・追記された【蓄積知見】です。
複数の記事から【追記知見】が継ぎ足されているため、重複した表現や表記揺れが生じています。

各項目の【全ての具体的ノウハウ・注意点・ビルド選択】を漏らさず活かした上で、
重複表現を完全に削ぎ落とし、プレイヤーが一目で理解できる洗練されたプロ品質の文章に清書・リファインしてください。

━━━━━━━━━━━━━━━━━━━━
【🚨 2026年シーズン最新メタ・仕様の厳格適用ルール】
元データに過去パッチの古い記述が含まれている場合でも、必ず以下の【2026年最新仕様】に自動補正・統一して執筆してください：
- 【試合ペース・初動】ミニオン湧き0:30、ジャングルキャンプ湧き0:55、初動スカトル（Scuttle Crab）出現は【2:55】（※3:30は過去パッチの古い情報なので絶対に出力しないでください）。
- 【中立オブジェクト】初代ドラゴン【5:00】、ヴォイドグラブ【8:00】（14:45消滅）、ヘラルド【15:00】（19:45消滅）、バロン【20:00】。
- 【タワープレート】タワープレートは14分消滅ではなく【永続（Permanent）】仕様。
- 【ビルド・ルーン】削除された過去の旧アイテムや旧ルーンは最新の2026年現行アイテム・ルーンに自動読み替えて記述してください。

【各項目の清書ルール】
1. **strengths (強み・パワースパイク)**:
   チャンプの強み、パワースパイクのタイミング、仕掛けるべき状況を箇条書きで具体的にまとめる。
2. **weaknesses (弱点・カウンター対策)**:
   明確な弱点、警戒すべき相手の行動、ガンク被弾リスクを具体的にまとめる。
3. **power_spikes (時間帯別パワースパイク詳細)**:
   序盤(Lv1-6・2:55スカトル/5:00ドラゴン)・中盤(8:00グラブ/15:00ヘラルド/1-2コア完成時)・終盤(20:00バロン戦)の強さの変化を明確に記述する。
4. **build_runes (推奨ビルド・ルーン状況別選択)**:
   コアアイテム、状況別の防具/火力アイテム選択、キーストーンの理由を具体的にまとめる。
5. **strategy (基本立ち回り・集団戦マクロ)**:
   レーン戦のウェーブ管理、サイドプッシュ判断、集団戦のポジション取りとスキル順序を体系的に記述する。
6. **must_ban_champions (BAN推奨・天敵)**:
   苦手な対面や構成、BANすべき理由を簡潔にまとめる。
7. **pick_recommendation (ピック基準・構成相性)**:
   先出し可能か、どんな味方構成/敵構成の時に出すべきかをまとめる。
━━━━━━━━━━━━━━━━━━━━

【現在の蓄積データ】
${JSON.stringify(fieldTexts, null, 2)}

以下のJSON形式のみを出力してください（Markdownコードブロックで囲む）：
\`\`\`json
{
  "strengths": "清書後の強み文章...",
  "weaknesses": "清書後の弱点文章...",
  "power_spikes": "清書後のパワースパイク文章...",
  "build_runes": "清書後のビルド文章...",
  "strategy": "清書後の立ち回り文章...",
  "must_ban_champions": "清書後のBAN推奨文章...",
  "pick_recommendation": "清書後のピック基準文章..."
}
\`\`\`
`;

    const rawResponse = await callGeminiWithRetry(prompt, { temperature: 0.2 });

    // JSON抽出
    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawResponse;
    const refinedFields: Record<string, string> = JSON.parse(jsonStr.trim());

    const resultPayload: any = {
      champion,
      role: existingFact.role || role || 'GLOBAL',
      updated_at: new Date().toISOString(),
    };

    const diffs: Array<{ fieldKey: string; fieldLabel: string; before: string; after: string }> = [];

    for (const f of TREND_FIELDS) {
      const before = fieldTexts[f.key] || '';
      const after = (refinedFields[f.key] || before).trim();
      resultPayload[f.key] = after;
      diffs.push({
        fieldKey: f.key,
        fieldLabel: f.label,
        before,
        after,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        champion,
        role: resultPayload.role,
        diffs,
        refinedFields: resultPayload,
      });
    }

    // データベースへ保存
    const { error: updateErr } = await supabase
      .from('champion_facts')
      .upsert(resultPayload, { onConflict: 'champion' });

    if (updateErr) throw updateErr;

    // リビジョン履歴記録
    for (const d of diffs) {
      if (d.before !== d.after) {
        await recordRevision({
          targetType: 'champion_fact',
          targetKey: champion,
          field: d.fieldKey,
          before: d.before,
          after: d.after,
          sourceTitle: 'AI知見清書・重複排除（リファイン）',
        });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      champion,
      role: resultPayload.role,
      diffs,
      refinedFields: resultPayload,
    });
  } catch (err: any) {
    console.error('[champions/refine-facts] error:', err);
    return NextResponse.json({ error: err.message || '知見清書処理に失敗しました' }, { status: 500 });
  }
}
