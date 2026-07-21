import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';


// 以前はローカルPCのPythonデーモン(edge_worker_daemon.py)がedge_tasksを処理する設計で、
// デーモンが起動していないと必ずタイムアウトしていた。サーバー(Vercel)上で直接Geminiを
// 呼んで結果をedge_tasksに書き込む方式に変更（クライアントのポーリングはそのまま動く）。
export const maxDuration = 60; // Gemini応答待ちのためタイムアウトを延長
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { blue, red } = body;

    if (!blue || !red || Object.keys(blue).length !== 5 || Object.keys(red).length !== 5) {
      return NextResponse.json({ success: false, error: '味方チーム5名、敵チーム5名のチャンピオンをすべて選択してください。' }, { status: 400 });
    }

    // タスク行を作成（クライアントはこのidをポーリングする）
    const { data: inserted, error: insertErr } = await supabase
      .from('edge_tasks')
      .insert({ task_type: 'matchup_simulation_5v5', payload: { blue, red }, status: 'pending' })
      .select('id')
      .single();
    if (insertErr) {
      return NextResponse.json({ success: false, error: `シミュレーションタスクの登録に失敗しました: ${insertErr.message}` }, { status: 500 });
    }

    // サーバー上で直接分析を実行し、結果をタスク行へ書き込む。
    // ※Vercelは応答後のバックグラウンド処理が保証されないため、完了までawaitしてから応答する
    //  （クライアントのポーリングは即completedを拾うだけになる）。
    {
      try {
        const roles = ['TOP', 'JG', 'MID', 'BOT', 'SUP'];
        const teamStr = (t: any) => roles.map(r => `${r}: ${t[r]}`).join(', ');

        // KTM辞典の知見を注入（一般知識だけでなくコミュニティ蓄積データに基づかせる）
        let factsText = '';
        try {
          const champs = [...Object.values(blue), ...Object.values(red)].filter(Boolean) as string[];
          const { data: facts } = await supabase
            .from('champion_facts')
            .select('champion, strengths, weaknesses, power_spikes')
            .in('champion', champs)
            .eq('archived', false);
          if (facts && facts.length > 0) {
            factsText = '\n【コミュニティ辞典の知見（最優先で反映すること）】\n' + facts.map((f: any) =>
              `- ${f.champion}: 強み=${f.strengths || '-'} / 弱み=${f.weaknesses || '-'} / スパイク=${f.power_spikes || '-'}`
            ).join('\n') + '\n';
          }
        } catch { /* 辞典なしでも分析は続行 */ }

        const prompt = `あなたはLoLの一流アナリストです。以下の5v5カスタム構成を分析してください。
BLUE: ${teamStr(blue)}
RED: ${teamStr(red)}
${factsText}

必ず以下のJSONのみを出力（コードブロック・前置き禁止、すべて日本語）:
{
 "lanes": { "TOP": {"priority":"BLUE_PRIORITY|RED_PRIORITY|EVEN","reason":"<40字>"}, "JG": {...}, "MID": {...}, "BOT": {...}, "SUP": {...} },
 "blue_team": {"composition_style":"<構成タイプ>","strengths":"<60字>","weaknesses":"<60字>"},
 "red_team": {"composition_style":"<構成タイプ>","strengths":"<60字>","weaknesses":"<60字>"},
 "game_plan": {"early":"<BLUE視点の序盤方針60字>","mid":"<中盤60字>","late":"<終盤60字>"},
 "win_conditions": ["<BLUE視点の勝利条件>","<2つ目>","<3つ目>"]
}`;
        const raw = await callGeminiWithRetry(prompt, { temperature: 0.4, maxOutputTokens: 2048, maxRetries: 2 });
        let cleaned = (raw || '').trim();
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
        const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
        if (s < 0 || e <= s) throw new Error('AI出力の解析に失敗しました');
        const result = JSON.parse(cleaned.slice(s, e + 1));
        await supabase.from('edge_tasks').update({ status: 'completed', result }).eq('id', inserted.id);
      } catch (err: any) {
        console.error('[simulate] inline processing failed:', err);
        await supabase.from('edge_tasks').update({ status: 'failed', error_message: `AI分析に失敗: ${err.message}` }).eq('id', inserted.id);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'AI 5v5構成シミュレーションを開始しました。',
      task_id: inserted.id
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
