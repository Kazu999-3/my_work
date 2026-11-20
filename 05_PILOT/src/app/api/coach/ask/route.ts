import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { callHybridLlm } from '@/lib/ollamaClient';
import { normalizeChampionName } from '@/lib/championNames';

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
`.trim();

    // 3. ハイブリッドLLM（ローカルOllama優先・Geminiフォールバック）で回答生成
    const answer = await callHybridLlm(prompt, {
      temperature: 0.3,
      timeoutMs: 60000,
    });

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
