import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { callHybridLlm } from '@/lib/ollamaClient';
import { normalizeChampionName } from '@/lib/championNames';

/**
 * SPEC 10: AIコーチ回答のバリデーションとサニタイズ
 * - 未記入プレースホルダー（「約何秒」「○○」「XX」等）の自動補正・除去
 * - 中国語誤訳スキル名の Riot 公式日本語名への自動補正（例: 「突っ向勝負」➔「真っ向勝負」）
 * - 意味不明語（「信長値」➔「射程」等）のサニタイズ
 */
function validateAndSanitizeCoachAnswer(text: string): string {
  if (!text) return text;
  let s = text;

  // 1. スキル名・用語の既知の誤訳・文字化け辞書補正
  const TERM_FIXES: [RegExp, string][] = [
    [/突っ?向勝負/g, '真っ向勝負'], // Vi Q (Vault Breaker)
    [/突進パンチ/g, '真っ向勝負(Q)'],
    [/通常攻撃の信長値/g, '通常攻撃の射程・リーチ'],
    [/信長値/g, '射程・リーチ'],
    [/闪く/g, '光る'],
    [/チーク/g, 'トレード'],
  ];
  for (const [pattern, replacement] of TERM_FIXES) {
    s = s.replace(pattern, replacement);
  }

  // 2. 未記入プレースホルダーの除去・補正（長いパターンを先行置換）
  s = s.replace(/【約何秒】/g, '【数秒間】');
  s = s.replace(/約何秒/g, '状況に応じた秒数');
  s = s.replace(/[○◯]{2,}/g, '主要スキル');
  s = s.replace(/X{2,}/g, '敵スキル');
  s = s.replace(/△{2,}/g, '状況');
  s = s.replace(/\[未定\]/g, '適宜判断');

  return s.trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      myChampion = 'Darius',
      enemyChampion = 'Aatrox',
      lane = 'TOP',
      question = '',
      history = [],
    } = body;

    const trimmedQuestion = String(question || '').trim();
    if (!trimmedQuestion) {
      return NextResponse.json({ error: '質問を入力してください' }, { status: 400 });
    }

    // 1. データベースから自チャンプ＆対面の根拠データを取得
    const sources: string[] = [];
    let myFactsText = '';
    let enemyFactsText = '';
    let matchupMemoText = '';

    if (supabase) {
      try {
        const { data: myData } = await supabase
          .from('champion_facts')
          .select('weaknesses, counter_champions, powerspikes, builds, patch')
          .eq('champion', myChampion)
          .maybeSingle();

        if (myData) {
          sources.push(`${myChampion} 辞典データ (Patch ${myData.patch || '現行'})`);
          const parts = [];
          if (myData.weaknesses) parts.push(`【弱み・隙】\n${myData.weaknesses}`);
          if (myData.counter_champions) parts.push(`【苦手な相手】\n${myData.counter_champions}`);
          if (myData.powerspikes) parts.push(`【パワースパイク】\n${myData.powerspikes}`);
          myFactsText = parts.join('\n\n');
        }

        const { data: enemyData } = await supabase
          .from('champion_facts')
          .select('weaknesses, counter_champions, patch')
          .eq('champion', enemyChampion)
          .maybeSingle();

        if (enemyData) {
          sources.push(`${enemyChampion} 辞典データ`);
          if (enemyData.weaknesses) {
            enemyFactsText = `【敵の弱み・隙】\n${enemyData.weaknesses}`;
          }
        }

        const { data: sentinel } = await supabase
          .from('matchup_sentinel')
          .select('strategy')
          .eq('champion', myChampion)
          .eq('enemy', enemyChampion)
          .not('strategy', 'is', null)
          .maybeSingle();

        if (sentinel?.strategy) {
          sources.push(`vs ${enemyChampion} 特化戦術メモ`);
          matchupMemoText = `【実戦対面メモ】\n${sentinel.strategy}`;
        }
      } catch (dbErr) {
        console.warn('[Coach Ask] DBデータ取得失敗（LLM単体で回答します）:', dbErr);
      }
    }

    if (sources.length === 0) {
      sources.push('LoL一般戦術理論 ＆ スキル仕様データ');
    }

    // 2. システムプロンプトの構築
    const contextInfo = [
      `【コンテキスト】`,
      `- 自チャンピオン: ${myChampion}`,
      `- 対面相手: ${enemyChampion}`,
      `- レーン: ${lane}`,
      myFactsText ? `\n【自チャンプ(${myChampion})の正本データ】\n${myFactsText}` : '',
      enemyFactsText ? `\n【敵チャンプ(${enemyChampion})の正本データ】\n${enemyFactsText}` : '',
      matchupMemoText ? `\n【実戦対面メモ(vs ${enemyChampion})】\n${matchupMemoText}` : '',
    ].filter(Boolean).join('\n');

    const prompt = `
あなたはLeague of Legendsの超一流AI戦術コーチです。
プレイヤーからの対面や戦術に関する質問に対して、論理的で具体的、かつ即座に実戦で試せるアドバイスを日本語で返してください。

${contextInfo}

【過去のチャット文脈】
${Array.isArray(history) && history.length > 0
  ? history.slice(-4).map((h: any) => `${h.role === 'user' ? 'プレイヤー' : 'コーチ'}: ${h.content}`).join('\n')
  : '（過去のやりとりなし）'}

【プレイヤーからの質問】
${trimmedQuestion}

【回答のルール】
1. 曖昧な抽象論（「頑張ってCSを取りましょう」等）ではなく、スキルの当て方、CDの隙、ウェーブ管理、初動3分やLv6のキルラインなど、具体的なアクションを提示すること。
2. 今回参照した正本データや対面メモがある場合は、「${sources.join(' / ')}」に基づいた根拠を一言添えること。
3. 文体は親しみやすく頼れるコーチ口調（「〜しよう」「〜がポイントだ」等）にすること。
4. 長すぎず、試合前に30秒で読める簡潔な構成（箇条書き2〜3点＋要約）にすること。
5. 【厳格】スキル名はRiot公式の正式日本語名（例: ViのQは「真っ向勝負」、Rは「強行突入」）を用い、中国語や不正確な訳語を使用しないこと。
6. 【厳格】「約何秒」「○○」などの未記入プレースホルダーは絶対に出力せず、具体的な秒数（例: 約8秒）または「スキルの空振り直後」などの具体的な状況を明記すること。
7. 【論理検証】Q（チャージ突進）とR（確定突入）など、異なるスキルの効果や仕様を混同・混線させないこと。
`.trim();

    // 3. ハイブリッドLLM（ローカルOllama優先・Geminiフォールバック）で回答生成
    // 試合前チャットのためタイムアウトは15秒とし、ローカルOllamaがバッチ処理等で塞がっている場合は即座にGemini（約2.9秒）へフォールバック
    const rawAnswer = await callHybridLlm(prompt, {
      temperature: 0.3,
      timeoutMs: 15000,
    });

    // 4. SPEC 10: 回答文のノイズ除去・サニタイズ検証
    const answer = validateAndSanitizeCoachAnswer(rawAnswer);

    return NextResponse.json({
      success: true,
      answer,
      sources,
      myChampion,
      enemyChampion,
      lane,
    });
  } catch (error: any) {
    console.error('[Coach Ask Error]:', error);
    return NextResponse.json(
      { error: error.message || 'コーチへの質問回答中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
