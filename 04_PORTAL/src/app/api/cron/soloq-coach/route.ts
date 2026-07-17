import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchPuuidByRiotId, fetchRecentMatchIds, fetchMatchDetails } from '../../../../lib/riot';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

// ============================================================
// ソロQ試合後の自動分析DM (課題#47)
//
// Vercel Cron(日次)が叩く。オーナーの最新ランク戦が前回分析済みと違えば、
// 軽い分析(KDA/CS/デス + 短いGeminiアドバイス)を作ってDiscord DMで送る。
// 状態(最後に分析した試合ID)は ktm_settings に保存し、二重通知を防ぐ。
// 認証: Vercel Cron は Authorization: Bearer CRON_SECRET を付与する。
// ============================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function getSetting(key: string): Promise<any> {
  const { data } = await supabase.from('ktm_settings').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}
async function setSetting(key: string, value: any) {
  await supabase.from('ktm_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

export async function GET(req: Request) {
  // CRON_SECRET 認証（既存の /api/cron と同じ方式）
  const auth = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiKey = process.env.RIOT_API_KEY!;
    const gameName = process.env.RIOT_GAME_NAME!;
    const tagLine = process.env.RIOT_TAG_LINE!;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!apiKey || !gameName || !tagLine) return NextResponse.json({ error: 'Riot環境変数が未設定' }, { status: 500 });

    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);
    const matchIds = await fetchRecentMatchIds(puuid, apiKey, 1, 420).catch(() => fetchRecentMatchIds(puuid, apiKey, 1));
    if (!matchIds.length) return NextResponse.json({ noGame: true });

    const latest = matchIds[0];
    const lastAnalyzed = await getSetting('soloq_last_analyzed_match');
    if (lastAnalyzed === latest) return NextResponse.json({ noNew: true, latest });

    const match = await fetchMatchDetails(latest, apiKey);
    const me = match.participants.find((p: any) => p.puuid === puuid);
    if (!me) { await setSetting('soloq_last_analyzed_match', latest); return NextResponse.json({ error: '自分のデータなし', latest }); }

    const gameMins = match.gameDuration / 60;
    const csPerMin = ((me.totalMinionsKilled + me.neutralMinionsKilled) / gameMins).toFixed(1);
    const kda = me.deaths === 0 ? 'Perfect' : ((me.kills + me.assists) / me.deaths).toFixed(2);

    const prompt = `あなたはLoLコーチです。以下の1試合の結果に対し、次の試合で意識すべき点を日本語120字以内で1つだけ、具体的に助言してください。
チャンピオン: ${me.championName} / 結果: ${me.win ? '勝利' : '敗北'} / KDA: ${me.kills}/${me.deaths}/${me.assists}(比${kda}) / CS/min: ${csPerMin} / 試合時間: ${Math.floor(gameMins)}分`;
    const advice = await callGeminiWithRetry(prompt, { model: 'gemini-3.1-flash-lite', temperature: 0.6, maxOutputTokens: 256, maxRetries: 2, cacheKey: `soloqdm:${latest}` });

    // オーナーへDM送信
    let dmSent = false;
    const ownerId = await getSetting('owner_discord_id');
    if (botToken && ownerId) {
      try {
        const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
          method: 'POST',
          headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient_id: ownerId }),
        });
        const dm = await dmRes.json();
        if (dm?.id) {
          await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: `${me.win ? '🏆' : '💀'} ソロQ振り返り (${me.championName})`,
                color: me.win ? 3447003 : 15158332,
                description: `**KDA** ${me.kills}/${me.deaths}/${me.assists} (${kda})　**CS/min** ${csPerMin}\n\n💡 ${advice}`,
                footer: { text: 'KTM パーソナルコーチ | 自動分析' },
              }],
            }),
          });
          dmSent = true;
        }
      } catch (e) {
        console.warn('[soloq-coach] DM送信失敗:', e);
      }
    }

    await setSetting('soloq_last_analyzed_match', latest);
    return NextResponse.json({ success: true, analyzed: latest, champion: me.championName, dmSent });
  } catch (err: any) {
    console.error('[soloq-coach] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
