import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { fetchPuuidByRiotId } from '@/lib/riot';
import { callGemini } from '@/lib/geminiClient';
import { computeTrendAggregates, formatMainRoleLine, formatDeathContextBlock } from '@/lib/coachTrends';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 自動振り返りの履歴・傾向分析（旧ポータル /api/coach/analyze の history / trends モードの移植）。2026-10-04
// coach_analyses は旧ポータルのcron(/api/cron/soloq-coach)が試合ごとに貯めている。
//   { mode: 'history', summoner, limit } … DB読みだけ（LLMなし）
//   { mode: 'trends', summoner }          … Geminiを1回呼ぶ（画面ではボタンで明示的に実行させる）
export async function POST(req: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const mode = body.mode;
    const summoner = String(body.summoner || '').trim();
    if (!summoner.includes('#')) return NextResponse.json({ error: 'Riot ID（名前#タグ）を入力してください。' }, { status: 400 });
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'RIOT_API_KEY が未設定です' }, { status: 500 });

    const [gameName, tagLine] = summoner.split('#');
    const puuid = await fetchPuuidByRiotId(gameName.trim(), tagLine.trim(), apiKey);

    if (mode === 'history') {
      const limit = Math.min(50, Math.max(1, Number(body.limit) || 20));
      const { data: rows, error } = await supabase
        .from('coach_analyses').select('*').eq('puuid', puuid)
        .order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return NextResponse.json({
        mode: 'history',
        analyses: (rows || []).map((row: any) => ({
          matchId: row.match_id,
          win: row.win,
          champion: row.champion,
          enemyChampion: row.enemy_champion,
          role: row.role,
          kda: `${row.kills}/${row.deaths}/${row.assists}`,
          kdaRatio: row.kda_ratio === null ? 'Perfect' : String(row.kda_ratio),
          csPerMin: String(row.cs_per_min),
          visionPerMin: String(row.vision_per_min),
          weaknesses: row.weaknesses || [],
          advice: row.advice || '',
          focus: row.focus,
          focusAchieved: row.focus_achieved,
          notes: row.notes || '',
          createdAt: row.created_at,
        })),
      });
    }

    if (mode === 'trends') {
      const limit = Math.min(50, Math.max(5, Number(body.limit) || 20));
      const { data: rows, error } = await supabase
        .from('coach_analyses').select('*').eq('puuid', puuid)
        .order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      const analyses = rows || [];
      if (analyses.length < 3) {
        return NextResponse.json({
          mode: 'trends', enough: false, count: analyses.length,
          message: '傾向分析には自動振り返りの蓄積が3件以上必要です。',
        });
      }

      const agg = computeTrendAggregates(analyses);
      const { deathPhases: phaseCount, topKillers, topWeaknesses, csTrend, visionTrend, winRate, totalDeaths } = agg;
      const prompt = `あなたはLoLの成長コーチです。あるプレイヤーの直近${analyses.length}試合の集計データから、繰り返し現れる課題を1つに絞り込み、今週の練習フォーカスを提案してください。

${formatMainRoleLine(agg)}
デス時間帯の分布（回数）: 序盤${phaseCount.序盤} / 中盤${phaseCount.中盤} / 終盤${phaseCount.終盤}
${formatDeathContextBlock(agg)}
繰り返し狩られている相手: ${topKillers.map((k) => `${k.champion}(${k.count})`).join(', ') || 'なし'}
再発している弱点: ${topWeaknesses.map((w) => `${w.label}(${w.count})`).join(', ') || 'なし'}
CS/min傾向: 直近${csTrend.recent} ← 以前${csTrend.older}
Vision/min傾向: 直近${visionTrend.recent} ← 以前${visionTrend.older}
勝率: ${winRate}%

上記の「主にプレイしているロール」に即した具体的なアドバイスにすること（実際のロールと矛盾する助言をしないこと）。
日本語300字程度で、(1)最も繰り返している課題の指摘、(2)その原因の仮説、(3)今週意識すべきフォーカスを1つだけ、具体的に述べてください。`;
      const summary = await callGemini(prompt, { temperature: 0.7, maxOutputTokens: 2048 });

      return NextResponse.json({
        mode: 'trends', enough: true, count: analyses.length,
        winRate, totalDeaths, deathPhases: phaseCount, topKillers, topWeaknesses, csTrend, visionTrend, summary,
      });
    }

    return NextResponse.json({ error: 'mode は history か trends を指定してください' }, { status: 400 });
  } catch (e: any) {
    console.error('[coach/reviews] Error:', e);
    return NextResponse.json({ error: e.message || '取得に失敗しました' }, { status: 500 });
  }
}
