import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { fetchPuuidByRiotId } from '@/lib/riot';
import { callGemini } from '@/lib/geminiClient';
import { computeTrendAggregates, formatMainRoleLine, formatDeathContextBlock } from '@/lib/coachTrends';
import { auditPlayerHabits, DeathEvent } from '@/lib/coachHabitBreaker';

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

      // 2026年オブジェクト直前スローデス等の悪癖診断を実行
      const allDeaths: DeathEvent[] = [];
      for (const a of analyses) {
        for (const ev of (a.death_timeline || []) as any[]) {
          const sec = typeof ev.timestampSec === 'number'
            ? ev.timestampSec
            : typeof ev.timestamp === 'number'
            ? Math.floor(ev.timestamp / 1000)
            : 0;
          allDeaths.push({
            timestampSec: sec,
            phase: ev.phase,
            killer: ev.killer,
            teamGoldDiffAtDeath: ev.teamGoldDiffAtDeath,
          });
        }
      }
      const habitAudit = auditPlayerHabits(allDeaths, agg.mainRole);

      const prompt = `あなたはLoL 2026年最新シーズン（Season 16 / パッチ26.x）の超一流辛口・即効性重視のAIコーチ（Veigar v2スタイル）です。
プレイヤーの直近${analyses.length}試合の客観的データと「悪癖診断エンジン」の結果から、勝率を劇的に引き上げるための【たった1つの致命的悪癖の破壊】と【次戦の絶対行動ルール】を断定してください。

【プレイヤー情報】
${formatMainRoleLine(agg)}
・勝率: ${winRate}% (総デス数: ${totalDeaths})
・デス時間帯: 序盤${phaseCount.序盤} / 中盤${phaseCount.中盤} / 終盤${phaseCount.終盤}
${formatDeathContextBlock(agg)}
・CS/min推移: 直近${csTrend.recent} ← 以前${csTrend.older}
・Vision/min推移: 直近${visionTrend.recent} ← 以前${visionTrend.older}
・狩られた敵: ${topKillers.map((k) => `${k.champion}(${k.count})`).join(', ') || 'なし'}
・頻出課題: ${topWeaknesses.map((w) => `${w.label}(${w.count})`).join(', ') || 'なし'}

【2026年悪癖診断エンジン判定結果】
・主要悪癖コード: ${habitAudit.primaryHabitTrap.code} (${habitAudit.primaryHabitTrap.severity})
・タイトル: ${habitAudit.primaryHabitTrap.title}
・診断要約: ${habitAudit.primaryHabitTrap.description}
・オブジェクト直前45秒以内のスローデス: 計${habitAudit.objectiveThrowDeaths.length}回
${habitAudit.objectiveThrowDeaths.slice(0, 3).map((d) => `  - ${d.deathFormatted} (${d.objective} 湧き${d.secondsBeforeSpawn}秒前)`).join('\n')}
・推奨アクションルール: ${habitAudit.primaryHabitTrap.nextGameActionRule}

【回答フォーマット（厳格な制約）】
※「意識しましょう」「状況に応じて」等の曖昧な逃げ言葉は絶対禁止。
※神話アイテムや旧シーズン・旧仕様（旧3:30カニ、旧5分/10分幼虫、旧アタカン等）の概念は一切出さず、2026年公式最新基準（スカトル初湧き02:55、ドラゴン05:00、ヴォイドグラブ08:00単発湧き、ヘラルド15:00、バロン20:00）で語ること。
※日本語300〜400字程度で、以下の構成で出力してください：

1. 【断定：あなたの首を絞めているたった1つの悪癖】
データに基づき、なぜ負けに直結しているかを容赦なく言語化。
2. 【2026年メカニズム解説】
なぜその行動が2026年のメタ（02:55スカトル前倒し、08:00幼虫1回限定など）で致命傷になるのかの論理的根拠。
3. 【次戦の絶対合言葉（アクションルール）】
次の試合のロード画面で唱える「具体的トリガー＋行動」を1行で提示。`;

      const summary = await callGemini(prompt, { temperature: 0.7, maxOutputTokens: 2048 });

      return NextResponse.json({
        mode: 'trends',
        enough: true,
        count: analyses.length,
        winRate,
        totalDeaths,
        deathPhases: phaseCount,
        topKillers,
        topWeaknesses,
        csTrend,
        visionTrend,
        habitAudit,
        summary,
      });
    }

    return NextResponse.json({ error: 'mode は history か trends を指定してください' }, { status: 400 });
  } catch (e: any) {
    console.error('[coach/reviews] Error:', e);
    return NextResponse.json({ error: e.message || '取得に失敗しました' }, { status: 500 });
  }
}
