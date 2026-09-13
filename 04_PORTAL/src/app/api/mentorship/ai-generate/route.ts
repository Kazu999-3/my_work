import { NextResponse } from 'next/server';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';
import { CHAMPION_JA } from '../../../../lib/championConstants';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      role_type = 'PUPIL',
      lanes = ['MID'],
      champions = ['Ahri'],
      rank = 'GOLD',
      player_name = 'プレイヤー',
    } = body;

    const champNames = (champions || []).map((c: string) => CHAMPION_JA[c] || c).join('、');
    const laneNames = (lanes || []).join(' / ');
    const isMentor = role_type === 'MENTOR';

    const systemPrompt = `あなたはLeague of Legendsのコミュニティメンターシッププログラム（師弟マッチング）のアドバイザーです。
ユーザーが師弟掲示板に登録するための、魅力的で実用的な自己紹介文（bio）とおすすめタグ（tags）、目標（goal）を生成してください。

【ユーザー情報】
- プレイヤー名: ${player_name}
- 登録タイプ: ${isMentor ? '師匠（メンター：指導・アドバイスを提供したい側）' : '弟子（学びたい・成長したい側）'}
- メインレーン: ${laneNames}
- 得意・使用チャンピオン: ${champNames || '特になし'}
- 現在のランク帯: ${rank}

【出力条件】
- 日本語で出力すること。
- 自己紹介文(bio)は 150〜250文字程度で、ポジティブで親しみやすく、かつゲームへの熱意が伝わる自然な文章にすること。
- 弟子の場合: 自分の現在地、学びたい課題（ウェーブ管理、集団戦、トレード等）、目標ランクへの意気込みを含める。
- メンターの場合: 得意な指導分野（画面共有、リプレイ添削、ビルド相談等）、教えたい対象（初心者〜同レート帯）、優しく教えるスタンスを含める。
- おすすめタグ(tags)は 4〜6個 の配列で返すこと（例: 'VC可能', '画面共有ライブ指導', 'ウェーブ管理・フリーズ', 'ゴールド/プラチナ昇格目標' など）。
- 出力は必ず以下の純粋なJSONフォーマットのみで返すこと（Markdownのコードブロックは不要）。

{
  "bio": "自己紹介文テキスト",
  "tags": ["タグ1", "タグ2", "タグ3", "タグ4"],
  "goal": "目標テキスト"
}`;

    let generatedData = null;

    try {
      const aiResponse = await callGeminiWithRetry(systemPrompt, {
        temperature: 0.7,
        responseMimeType: 'application/json',
      });

      if (aiResponse) {
        const cleaned = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        generatedData = JSON.parse(cleaned);
      }
    } catch (aiErr) {
      console.warn('[ai-generate] Gemini generation failed, using template fallback:', aiErr);
    }

    // フォールバック（Gemini呼び出し失敗時でも高品質なテンプレートを即時返却）
    if (!generatedData || !generatedData.bio) {
      if (isMentor) {
        generatedData = {
          bio: `${laneNames}専の${champNames || 'メインキャラ'}使いです！現在ランクは${rank}です。レーン戦のウェーブ管理やパワースパイクの活かし方、マクロの基礎をわかりやすくお伝えできます。Discordでの画面共有やリプレイ添削も大歓迎ですので、気軽にお声がけください！`,
          tags: ['VC可能', '画面共有ライブ指導', 'リプレイ添削', 'ウェーブ管理・フリーズ', '優しく丁寧に指導'],
          goal: '楽しくレーン戦の勝率を伸ばすお手伝いをします！',
        };
      } else {
        generatedData = {
          bio: `普段は${laneNames}で${champNames || 'メインキャラ'}を中心にプレイしています（現在${rank}）。レーン戦のトレード判断や集団戦の立ち回りを基礎から学び、ランクアップを目指したいです！VCや画面共有でのアドバイスをいただけると嬉しいです。よろしくお願いします！`,
          tags: ['VC可能', '画面共有ライブ指導', 'リプレイ添削', 'レーン戦トレード', 'ゴールド/プラチナ昇格目標'],
          goal: '今シーズン中にランク昇格 ＆ レーン戦勝率アップ！',
        };
      }
    }

    return NextResponse.json({
      ok: true,
      data: generatedData,
    });
  } catch (error: any) {
    console.error('Error in mentorship ai-generate:', error);
    return NextResponse.json({ error: error.message || 'AI生成に失敗しました' }, { status: 500 });
  }
}
