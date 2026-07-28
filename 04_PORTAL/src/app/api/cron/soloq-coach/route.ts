import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchPuuidByRiotId, fetchRankedSoloMatchIds } from '../../../../lib/riot';
import { runPostGameReview } from '../../../../lib/coachPostGame';
import { createAdminNotification } from '../../../../lib/notify';

// ============================================================
// ソロQ試合後の自動分析DM (課題#47)
//
// Vercel Cron(日次)が叩く。オーナーの最新ランク戦が前回分析済みと違えば、
// コーチページの「🔍 試合後」ボタンと同じ本格分析(弱点判定・デス発生タイミング・
// 対面ナレッジ込み)を実行してcoach_analysesへ保存し、Discord DMで送る。
// 以前はここだけ簡易版(KDA/CSのみ)の別ロジックだったため、手動でボタンを
// 押さない限り「傾向」タブの集計データが一切増えなかった。今はこのCronが
// 自動でcoach_analysesを埋めるので、「振り返り」も「傾向」も自動的に貯まる。
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
    // ランクソロのみ（直近10試合から未分析の試合を全件検出）
    const matchIds = await fetchRankedSoloMatchIds(puuid, apiKey, 10);
    if (!matchIds.length) return NextResponse.json({ noGame: true });

    const lastAnalyzed = await getSetting('soloq_last_analyzed_match');
    
    // lastAnalyzed の位置を特定し、それ以降（最新側）にプレイされた未分析マッチを古い順に抽出
    let unanalyzed: string[] = [];
    if (!lastAnalyzed) {
      unanalyzed = [matchIds[0]]; // 初回は最新1件
    } else {
      const idx = matchIds.indexOf(lastAnalyzed);
      if (idx === -1) {
        // 直近10件に含まれないくらい古い場合は最新3件を対象
        unanalyzed = matchIds.slice(0, 3).reverse();
      } else if (idx > 0) {
        // lastAnalyzed より新しくプレイされた全試合を古い順（過去→最新）に並べ替え
        unanalyzed = matchIds.slice(0, idx).reverse();
      }
    }

    if (!unanalyzed.length) return NextResponse.json({ noNew: true, latest: matchIds[0] });

    const ownerId = await getSetting('owner_discord_id');
    const analyzedList: string[] = [];

    // 未分析の全試合を順次、本格分析(coach_analysesへの保存込み)＆DM送信
    for (const targetMatchId of unanalyzed) {
      try {
        const review = await runPostGameReview({ matchId: targetMatchId });
        const { result, weaknesses, advice } = review;

        // オーナーへDM送信
        if (botToken && ownerId) {
          try {
            const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
              method: 'POST',
              headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ recipient_id: ownerId }),
            });
            const dm = await dmRes.json();
            if (dm?.id) {
              const weaknessLine = weaknesses.length > 0 ? `\n⚠️ ${weaknesses.join(' / ')}` : '';
              await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  embeds: [{
                    title: `${result.win ? '🏆' : '💀'} ソロQ振り返り (${result.champion})`,
                    color: result.win ? 3447003 : 15158332,
                    description: `**KDA** ${result.kda} (${result.kdaRatio})　**CS/min** ${result.csPerMin}${weaknessLine}\n\n💡 ${advice}`.slice(0, 4000),
                    footer: { text: `KTM パーソナルコーチ | Match ${targetMatchId}` },
                  }],
                }),
              });
            }
          } catch (e) {
            console.warn('[soloq-coach] DM送信失敗:', e);
          }
        }

        // ポータル通知（履歴保存＋"admin" scope購読者へのプッシュ）。
        // createAdminNotification経由にすることで、コーチのベル通知一覧にも残る。
        try {
          const weaknessLine2 = weaknesses.length > 0 ? `⚠️ ${weaknesses.join(' / ')}\n\n` : '';
          await createAdminNotification({
            type: 'coach_review',
            title: `${result.win ? '🏆' : '💀'} ソロQ振り返り (${result.champion})`,
            body: `KDA ${result.kda} (${result.kdaRatio}) / CS ${result.csPerMin}\n${weaknessLine2}${advice}`.slice(0, 500),
            url: '/coach',
            icon: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${result.champion}_0.jpg`,
            data: { matchId: targetMatchId, champion: result.champion, win: result.win },
          });
        } catch (e) {
          console.warn('[soloq-coach] ポータル通知の送信に失敗:', e);
        }

        await setSetting('soloq_last_analyzed_match', targetMatchId);
        analyzedList.push(targetMatchId);
      } catch (matchErr) {
        console.error(`[soloq-coach] Match ${targetMatchId} processing error:`, matchErr);
      }
    }

    return NextResponse.json({ success: true, count: analyzedList.length, analyzed: analyzedList });
  } catch (err: any) {
    console.error('[soloq-coach] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
