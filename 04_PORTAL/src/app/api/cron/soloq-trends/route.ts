import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchPuuidByRiotId } from '../../../../lib/riot';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';
import { computeTrendAggregates, formatMainRoleLine, formatDeathContextBlock } from '../../../../lib/coachTrends';

// ============================================================
// 週次「傾向」ダイジェストDM
//
// coach_analyses（soloq-coach Cronが試合ごとに自動で貯めている構造化ログ）を
// 週1回集計し、繰り返している課題と今週のフォーカスをDiscord DMで送る。
// これまで「傾向」タブはポータルを開いて手動でボタンを押さないと見られなかったが、
// これで見なくても自動で届くようになる。
// 認証: Vercel Cron は Authorization: Bearer CRON_SECRET を付与する。
// ============================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function getSetting(key: string): Promise<any> {
  const { data } = await supabase.from('ktm_settings').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}

export async function GET(req: Request) {
  // CRON_SECRET未設定時fail-openパターンの修正(2026-08-05発覚、api/cron/route.tsと同じ修正)。
  // Gemini呼び出しを伴うため、外部から連打されるとクォータ枯渇に直結する。
  const auth = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = (req.headers.get('user-agent') || '').includes('vercel-cron');
  const bearerOk = !!cronSecret && auth === `Bearer ${cronSecret}`;
  if (!bearerOk && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiKey = process.env.RIOT_API_KEY!;
    const gameName = process.env.RIOT_GAME_NAME!;
    const tagLine = process.env.RIOT_TAG_LINE!;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!apiKey || !gameName || !tagLine) return NextResponse.json({ error: 'Riot環境変数が未設定' }, { status: 500 });

    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);

    const { data: rows } = await supabase
      .from('coach_analyses')
      .select('*')
      .eq('puuid', puuid)
      .order('created_at', { ascending: false })
      .limit(30);

    const analyses = rows || [];
    if (analyses.length < 3) {
      return NextResponse.json({ notEnough: true, count: analyses.length });
    }

    const agg = computeTrendAggregates(analyses);
    const trendPrompt = `あなたはLoLの成長コーチです。あるプレイヤーの直近${analyses.length}試合の集計データから、繰り返し現れる課題を1つに絞り込み、今週の練習フォーカスを提案してください。

${formatMainRoleLine(agg)}
デス時間帯の分布（回数）: 序盤${agg.deathPhases.序盤} / 中盤${agg.deathPhases.中盤} / 終盤${agg.deathPhases.終盤}
${formatDeathContextBlock(agg)}
繰り返し狩られている相手: ${agg.topKillers.map((k) => `${k.champion}(${k.count})`).join(', ') || 'なし'}
再発している弱点: ${agg.topWeaknesses.map((w) => `${w.label}(${w.count})`).join(', ') || 'なし'}
CS/min傾向: 直近${agg.csTrend.recent} ← 以前${agg.csTrend.older}
勝率: ${agg.winRate}%

上記の「主にプレイしているロール」に即した具体的なアドバイスにすること（実際のロールと矛盾する助言をしないこと）。
日本語300字程度で、(1)最も繰り返している課題の指摘、(2)その原因の仮説、(3)今週意識すべきフォーカスを1つだけ、具体的に述べてください。`;
    const summary = await callGeminiWithRetry(trendPrompt, {
      model: 'gemini-3.1-flash-lite',
      temperature: 0.6,
      maxOutputTokens: 512,
      maxRetries: 2,
      cacheKey: `weekly-trends:${puuid}:${analyses.length}`,
    });

    const ownerId = await getSetting('owner_discord_id');
    if (botToken && ownerId) {
      try {
        const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
          method: 'POST',
          headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient_id: ownerId }),
        });
        const dm = await dmRes.json();
        if (dm?.id) {
          await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: '📈 今週の傾向レポート',
                color: 3900151,
                description: `直近${analyses.length}試合・勝率${agg.winRate}%\n\n${summary}`,
                footer: { text: 'KTM パーソナルコーチ | 週次ダイジェスト' },
              }],
            }),
          });
        }
      } catch (e) {
        console.warn('[soloq-trends] DM送信失敗:', e);
      }
    }

    return NextResponse.json({ success: true, count: analyses.length, winRate: agg.winRate });
  } catch (err: any) {
    console.error('[soloq-trends] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
