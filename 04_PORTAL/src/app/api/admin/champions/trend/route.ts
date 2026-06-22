import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '../../../../../lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { champion, role } = body;
    
    if (!champion) {
      return NextResponse.json({ success: false, error: 'Missing champion name' }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({ success: false, error: 'GEMINI_API_KEY が環境変数に設定されていません。' }, { status: 500 });
    }

    // 2026年コンテキストの動的付与
    const nowStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const prompt = `【システムコンテキスト：現在の年は2026年です（本日は ${nowStr}）。この日時を基準に、未来や過去の出来事を正しく判定し、文脈を構築してください。】

League of Legendsの最新パッチにおける、チャンピオン「${champion}」のロール「${role || 'Jungle'}」の統計データおよびプロプレイヤーの最新ビルド情報をリサーチしてください。

以下のJSONフォーマットのみで出力してください（マークダウンの \`\`\`json や、余計な説明文は一切含めないでください。純粋なJSONオブジェクトのみを出力してください）。

{
  "champion": "${champion}",
  "role": "${role || 'Jungle'}",
  "patch": "最新パッチ番号 (例: 14.12)",
  "win_rate": 50.2, // 最新勝率 (%、数値のみ)
  "pick_rate": 5.4, // 最新ピック率 (%、数値のみ)
  "ban_rate": 8.1,  // 最新バン率 (%、数値のみ)
  "tier": "S",      // ティア (S+, S, A, B, C など)
  "trend_items": ["コアアイテム1", "コアアイテム2", "コアアイテム3"], // 主要なビルドの1st, 2nd, 3rdアイテム
  "trend_runes": {
    "keystone": "キーストーン名",
    "primary": "メインルーンパス名 (例: Precision, Inspiration, Dominationなど)",
    "secondary": "サブルーンパス名 (例: Sorcery, Resolveなど)"
  },
  "pro_builds": [
    {
      "player": "プロ選手名 (例: Canyon, Oner, Faker, Chovy, Zeus, ShowMaker, Rulerなど。実在するプロ選手)",
      "team": "チーム名 (例: GEN, T1, DK, HLE, BLGなど)",
      "win_lose": "直近の勝敗 (例: 3勝1敗, 4W-1Lなど)",
      "build": ["1stコア", "2ndコア", "3rdコア"],
      "runes": ["キーストーン名", "主要ルーン"],
      "description": "このビルドの特徴や狙いに関する短い日本語の解説（1文。'バースト重視'や'序盤のトレード強化'など簡潔に）"
    }
  ],
  "strengths": "最新パッチのトレンドを踏まえた、このチャンピオンの現在の主な強み（簡潔な日本語文章で2〜3文）",
  "weaknesses": "最新パッチのトレンドを踏まえた、現在の主な弱点・対策されやすい点（簡潔な日本語文章で2〜3文）",
  "powerSpikes": "パワースパイク（どの時間帯、どのアイテム完成時に強いか。簡潔な日本語で1〜2文）",
  "buildRunes": "推奨されるコアビルドとルーンの選び方の簡単な解説（簡潔な日本語で2〜3文）",
  "counterChampions": "対面での有利・不利、カウンターチャンピオンに関する情報（簡潔な日本語で2〜3文）",
  "pickRecommendation": "現在のメタにおけるピックの推奨度や、先出し・後出しの適性（簡潔な日本語で1〜2文）"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }] // Google検索ツールを有効化
    };

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      let errorMsg = `Gemini API Error: ${geminiRes.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMsg = errorJson.error.message;
        }
      } catch (e) {}

      if (geminiRes.status === 429) {
        if (errorMsg.includes("spending cap") || errorMsg.includes("spending-cap") || errorMsg.includes("monthly spending cap")) {
          errorMsg = "API利用上限（月の予算制限 Spend Cap）に達しています。管理画面から設定を更新してください。";
        } else {
          errorMsg = `API利用上限（429 Too Many Requests）に達しています: ${errorMsg}`;
        }
      }
      return NextResponse.json({ success: false, error: errorMsg }, { status: geminiRes.status });
    }

    const resJson = await geminiRes.json();
    let text = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      return NextResponse.json({ success: false, error: 'Geminiから空の応答が返されました。' }, { status: 500 });
    }

    if (text.startsWith('```')) {
      const lines = text.split('\n');
      if (lines[0].startsWith('```json') || lines[0].startsWith('```')) {
        text = lines.slice(1, -1).join('\n');
      }
    }
    text = text.trim();

    let trendData: any;
    try {
      trendData = JSON.parse(text);
    } catch (e: any) {
      return NextResponse.json({ success: false, error: `AIの応答をJSONとしてパースできませんでした: ${e.message}` }, { status: 500 });
    }

    // Supabase の GLOBAL レコードとマージ (フロントエンドに合わせ、小文字化せずに元のケースを使用)
    const matchupId = `champ_${champion}_global`;
    const { data: existing, error: fetchErr } = await supabase
      .from('matchup_sentinel')
      .select('raw_data, strategy, title')
      .eq('matchup_id', matchupId)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ success: false, error: `Supabase読み込みエラー: ${fetchErr.message}` }, { status: 500 });
    }

    let rawData = existing?.raw_data || {};
    if (typeof rawData !== 'object' || rawData === null) {
      rawData = {};
    }

    // 最新パッチトレンドとプロビルドの更新
    rawData.patch_meta = {
      win_rate: trendData.win_rate,
      pick_rate: trendData.pick_rate,
      ban_rate: trendData.ban_rate,
      tier: trendData.tier,
      trend_items: trendData.trend_items || [],
      trend_runes: trendData.trend_runes || {},
      patch: trendData.patch,
      updated_at: Math.floor(Date.now() / 1000)
    };
    rawData.pro_builds = trendData.pro_builds || [];

    // 攻略フィールド（強み・弱み等）を最新パッチトレンドを考慮したAI生成文で上書き更新
    rawData.strengths = trendData.strengths || rawData.strengths || '';
    rawData.weaknesses = trendData.weaknesses || rawData.weaknesses || '';
    rawData.powerSpikes = trendData.powerSpikes || rawData.powerSpikes || '';
    rawData.buildRunes = trendData.buildRunes || rawData.buildRunes || '';
    rawData.counterChampions = trendData.counterChampions || rawData.counterChampions || '';
    rawData.pickRecommendation = trendData.pickRecommendation || rawData.pickRecommendation || '';

    const title = existing?.title || `${champion} 基本戦略・トレンド`;
    // 手動で記述された strategy（立ち回りメモ）は上書きせず、完全に保護して維持する
    const strategy = existing?.strategy || '';

    const payload = {
      matchup_id: matchupId,
      champion: champion,
      enemy: 'GLOBAL',
      title: title,
      strategy: strategy,
      raw_data: rawData
    };

    const { error: upsertErr } = await supabase
      .from('matchup_sentinel')
      .upsert(payload, { onConflict: 'matchup_id' });

    if (upsertErr) {
      return NextResponse.json({ success: false, error: `Supabase書き込みエラー: ${upsertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Successfully updated trend for ${champion}` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
