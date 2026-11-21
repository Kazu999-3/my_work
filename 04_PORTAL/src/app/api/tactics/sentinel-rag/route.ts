import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';
import { getChampionSearchVariations } from '../../../../lib/championNames';

export const dynamic = 'force-dynamic';

export interface SentinelRagResponse {
  ok: boolean;
  myChampion: string;
  enemyChampion: string;
  role: string;
  threeRules: {
    lv1to3: string;
    powerSpikeTiming: string;
    killOpportunity: string;
  };
  recommendedTacticsCode?: string;
  tacticsAdvice?: string;
  powerSpikeCompare?: {
    myEarlyScore: number;
    enemyEarlyScore: number;
    advantagePhase: 'EARLY' | 'MID' | 'LATE' | 'EVEN';
  };
}

/**
 * 試合前30秒 虎の巻動的RAG API (POST /api/tactics/sentinel-rag)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const myChampion = String(body.myChampion || '').trim();
    const enemyChampion = String(body.enemyChampion || '').trim();
    const role = String(body.role || 'ALL').toUpperCase();

    if (!myChampion) {
      return NextResponse.json({ ok: false, error: 'myChampion は必須です' }, { status: 400 });
    }

    // 1. パワースパイク情報の取得
    let mySpike: any = null;
    let enemySpike: any = null;

    if (supabase) {
      const myVars = getChampionSearchVariations(myChampion);
      const enemyVars = enemyChampion ? getChampionSearchVariations(enemyChampion) : [];

      const orTerms = [...myVars, ...enemyVars].map((v) => `champion.ilike.%${v}%`).join(',');
      if (orTerms) {
        const { data } = await supabase
          .from('champion_power_spikes')
          .select('champion, early_game_score, mid_game_score, late_game_score, peak_window, summary')
          .or(orTerms)
          .limit(6);

        if (data) {
          mySpike = data.find((d: any) => myVars.some((v) => d.champion.toLowerCase().includes(v.toLowerCase())));
          if (enemyChampion) {
            enemySpike = data.find((d: any) => enemyVars.some((v) => d.champion.toLowerCase().includes(v.toLowerCase())));
          }
        }
      }
    }

    const myEarly = mySpike?.early_game_score || 3;
    const enemyEarly = enemySpike?.early_game_score || 3;
    let advantagePhase: 'EARLY' | 'MID' | 'LATE' | 'EVEN' = 'EVEN';

    if (myEarly > enemyEarly) advantagePhase = 'EARLY';
    else if (myEarly < enemyEarly) advantagePhase = 'MID';

    // 2. 虎の巻コードの推奨選定
    let recommendedTacticsCode = 'D4';
    let tacticsSummary = '「ターン」同期とウェーブ押し込み後のリコール管理';

    if (role === 'TOP') {
      recommendedTacticsCode = 'D59';
      tacticsSummary = '3ウェーブダイブの作り方：15体溜めて3:15にぶつける（タワー下クラッシュ）';
    } else if (role === 'JG') {
      recommendedTacticsCode = 'D97';
      tacticsSummary = '強サイド決定と湧く1分前の先行リコールテンポ（負けレーンへの安易なガンク厳禁）';
    } else if (role === 'MID') {
      recommendedTacticsCode = 'D68';
      tacticsSummary = 'ロテートとロームの分離：ウェーブを押し切らずに歩いた側が自滅する';
    } else if (role === 'ADC' || role === 'SUP') {
      recommendedTacticsCode = 'D60';
      tacticsSummary = 'ボット3分のファーストブラッド警戒：キャノン押し込み後の無理なハラス厳禁';
    }

    // 3. Gemini による30秒虎の巻生成
    const prompt = `あなたはLoLチャレンジャーの専属戦術アナリストです。
試合開始前のわずか30秒でプレイヤーが脳内に叩き込めるよう、以下の対面マッチアップに対する【試合前30秒 虎の巻（3箇条）】を作成してください。

【マッチアップ情報】
・味方使用チャンプ: ${myChampion} (ロール: ${role}, 序盤強度★${myEarly}/5)
・敵対面チャンプ: ${enemyChampion || '対面不明'} (序盤強度★${enemyEarly}/5)
・推奨戦術コード: 【${recommendedTacticsCode}】 ${tacticsSummary}

【出力要件】
1. **lv1to3**: Lv1〜3のレーン戦立ち回り（プッシュ権を争うべきか、Lv3まで引いてウェーブを引くべきか。40文字以内）
2. **powerSpikeTiming**: 相手のパワースパイク警戒時間と自分の有利時間（40文字以内）
3. **killOpportunity**: 相手のどのキーCD・アクションの隙を突いて仕掛けるべきか（40文字以内）
4. 出力は以下のJSON形式【のみ】（Markdown不要）。

{
  "lv1to3": "Lv1〜3の立ち回り指示（40文字以内）",
  "powerSpikeTiming": "パワースパイク警戒指示（40文字以内）",
  "killOpportunity": "キルチャンス・仕掛け時指示（40文字以内）"
}`;

    let threeRules = {
      lv1to3: myEarly >= enemyEarly
        ? 'Lv1から前衛ミニオンを先に殴り、先行Lv2から強気にプッシュ主導権を握る。'
        : 'Lv1-2は無理に前に出ず、後衛ミニオンをタワー手前で受けてLv3から反撃する。',
      powerSpikeTiming: enemyChampion
        ? `相手のLv6および1コア完成時の急襲に警戒し、有利時間帯にオブジェクトへ先手合流する。`
        : '自身の1コア完成タイミングに合わせてリコールし、オブジェクトへ先行合流する。',
      killOpportunity: enemyChampion
        ? `相手が主要スキル（主要CCや離脱技）をミニオンに使用した直後のCD中が仕掛け時。`
        : '相手のフラッシュ落ち時や孤立したタイミングを見逃さず味方と挟撃する。',
    };

    try {
      const raw = await callGeminiWithRetry(prompt, {
        model: 'gemini-3.5-flash-lite',
        temperature: 0.4,
        maxOutputTokens: 512,
        maxRetries: 2,
      });

      let cleaned = (raw || '').trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
      }
      const s = cleaned.indexOf('{');
      const e = cleaned.lastIndexOf('}');
      if (s >= 0 && e > s) {
        const parsed = JSON.parse(cleaned.slice(s, e + 1));
        if (parsed.lv1to3 && parsed.powerSpikeTiming && parsed.killOpportunity) {
          threeRules = parsed;
        }
      }
    } catch (err) {
      console.warn('[sentinel-rag] Gemini fallback to rule-based:', err);
    }

    const responseData: SentinelRagResponse = {
      ok: true,
      myChampion,
      enemyChampion,
      role,
      threeRules,
      recommendedTacticsCode,
      tacticsAdvice: tacticsSummary,
      powerSpikeCompare: {
        myEarlyScore: myEarly,
        enemyEarlyScore: enemyEarly,
        advantagePhase,
      },
    };

    return NextResponse.json(responseData);
  } catch (err: any) {
    console.error('[sentinel-rag] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || '虎の巻RAGの生成に失敗しました。' }, { status: 500 });
  }
}
