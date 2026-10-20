import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchPuuidByRiotId, fetchRankedSoloMatchIds } from '../../../../lib/riot';
import { runPostGameReview } from '../../../../lib/coachPostGame';
import { createAdminNotification } from '../../../../lib/notify';

// ============================================================
// ソロQ試合後の自動分析 (課題#47)
//
// Vercel Cron(日次)が叩く。オーナーの最新ランク戦が前回分析済みと違えば、
// コーチページの「🔍 試合後」ボタンと同じ本格分析(弱点判定・デス発生タイミング・
// 対面ナレッジ込み)を実行してcoach_analysesへ保存し、ポータル通知(ベル+プッシュ)で知らせる。
// 以前はここだけ簡易版(KDA/CSのみ)の別ロジックだったため、手動でボタンを
// 押さない限り「傾向」タブの集計データが一切増えなかった。今はこのCronが
// 自動でcoach_analysesを埋めるので、「振り返り」も「傾向」も自動的に貯まる。
// Discord DM通知は不要とのことで廃止済み(ポータル通知のみ)。
// 状態(最後に分析した試合ID)は ktm_settings に保存し、二重通知を防ぐ。
// 認証: Vercel Cron は Authorization: Bearer CRON_SECRET を付与する。
// ============================================================

export const dynamic = 'force-dynamic';
// 未分析の試合を順にGeminiで分析するため、複数試合が溜まると60秒では足りずに打ち切られていた（2026-10-15、
// Vercel の 60秒タイムアウトとして記録）。待ち時間は課金対象のCPU時間にほぼならないので上限を広げる。
export const maxDuration = 300;

async function getSetting(key: string): Promise<any> {
  const { data } = await supabase.from('ktm_settings').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}
async function setSetting(key: string, value: any) {
  await supabase.from('ktm_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

export async function GET(req: Request) {
  // CRON_SECRET未設定時fail-openパターンの修正(2026-08-05発覚、api/cron/route.tsと同じ修正)。
  // Gemini呼び出しを伴うため、外部から連打されるとクォータ枯渇に直結する。
  const auth = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  const bearerOk = !!cronSecret && auth === `Bearer ${cronSecret}`;
  // 2026-09-29: User-Agent に `vercel-cron` が含まれるだけで通す経路を撤去（誰でも偽装できるため
  // 認証として機能していなかった）。Vercel は CRON_SECRET 設定時にCron実行で自動的に
  // Bearer を付けるため、vercel.json の定期実行はそのまま動く。
  if (!bearerOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiKey = process.env.RIOT_API_KEY!;
    const gameName = process.env.RIOT_GAME_NAME!;
    const tagLine = process.env.RIOT_TAG_LINE!;
    if (!apiKey || !gameName || !tagLine) return NextResponse.json({ error: 'Riot環境変数が未設定' }, { status: 500 });

    // puuid は Riot ID が変わらない限り同じなので保存して使い回す。2026-10-20: 毎時 Riot ID から引き直しており、
    // 他の同期と重なった回に回数制限（429）で 500 になっていた（毎朝の健康診断に毎日出ていた）
    const riotId = `${gameName}#${tagLine}`;
    const cached = await getSetting('soloq_owner_puuid');
    let puuid: string = cached?.riotId === riotId && cached?.puuid ? cached.puuid : '';
    if (!puuid) {
      try {
        puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);
      } catch (e: any) {
        if (/Too Many Requests/i.test(e?.message || '')) {
          return NextResponse.json({ skipped: true, reason: 'Riot APIの回数制限。次の回に回します' });
        }
        throw e;
      }
      await setSetting('soloq_owner_puuid', { riotId, puuid });
    }
    // ランクソロのみ（直近10試合から未分析の試合を全件検出）。失敗時は空配列が返る
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

    const analyzedList: string[] = [];

    // 未分析の全試合を順次、本格分析(coach_analysesへの保存込み)＆ポータル通知
    for (const targetMatchId of unanalyzed) {
      try {
        const review = await runPostGameReview({ matchId: targetMatchId });
        const { result, weaknesses, advice } = review;

        // 試合終了ごとに対面メモを書いてもらうための深リンク。対面(enemyChampion)が
        // 特定できた場合のみ、対面メモの新規作成フォームへ試合結果・KDA・試合IDを
        // 引き継いで自動プリフィルする（MatchupMemoTabのURLパラメータ処理を再利用）。
        // 2026-09-30: リンク先を実在するタブへ修正した。
        // それまでは `?tab=matchup-memo` を指していたが、そのタブは2026-09-17の
        // スリム化で削除されており、しかもコーチページは tab パラメータを読んでいなかった。
        // 結果、通知を押すと常に「試合前」に着地し、対面メモを書くという目的を果たせず
        // role/result/kda/matchId も捨てられていた（直近30日で14件がこの状態）。
        // メモ編集は「試合後」タブの PostGameDeepAnalyticsDashboard にあるので、
        // そのタブと対象試合(matchId)を開くリンクにする。
        const matchupMemoPath = result.enemyChampion
          ? `/coach?tab=postgame&matchId=${encodeURIComponent(targetMatchId)}&champion=${encodeURIComponent(result.champion)}&enemy=${encodeURIComponent(result.enemyChampion)}`
          : `/coach?tab=postgame&matchId=${encodeURIComponent(targetMatchId)}`;

        // ポータル通知（履歴保存＋"admin" scope購読者へのプッシュ）。
        // createAdminNotification経由にすることで、コーチのベル通知一覧にも残る。
        // クリック先を対面メモの深リンクにすることで、試合終了のたびにその対面の
        // メモをその場で書けるようにする。
        try {
          const weaknessLine2 = weaknesses.length > 0 ? `⚠️ ${weaknesses.join(' / ')}\n\n` : '';
          await createAdminNotification({
            type: 'coach_review',
            title: `${result.win ? '🏆' : '💀'} ソロQ振り返り (${result.champion})`,
            body: `KDA ${result.kda} (${result.kdaRatio}) / CS ${result.csPerMin}\n${weaknessLine2}${advice}`.slice(0, 500),
            url: matchupMemoPath,
            icon: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${result.champion}_0.jpg`,
            data: { matchId: targetMatchId, champion: result.champion, enemyChampion: result.enemyChampion, win: result.win },
          });
        } catch (e) {
          console.warn('[soloq-coach] ポータル通知の送信に失敗:', e);
        }

        await setSetting('soloq_last_analyzed_match', targetMatchId);
        analyzedList.push(targetMatchId);
      } catch (matchErr: any) {
        console.error(`[soloq-coach] Match ${targetMatchId} processing error:`, matchErr);
        // 一時的な失敗（Gemini/Riotのレート制限・高負荷）なら、ここで打ち切って次回この試合から再試行する。
        // 2026-10-15: 続行すると後ろの試合の成功で soloq_last_analyzed_match が先へ進み、
        // 失敗した試合が二度と分析されなくなっていた（10/12〜14 にレート制限で3回失敗）。
        // 恒久的な失敗（試合データ不正等）は打ち切ると毎回詰まるので、従来通り飛ばす。
        if (/レート制限|高負荷|429|503|Too Many Requests|RESOURCE_EXHAUSTED|fetch failed|timeout/i.test(matchErr?.message || '')) {
          break;
        }
      }
    }

    return NextResponse.json({ success: true, count: analyzedList.length, analyzed: analyzedList });
  } catch (err: any) {
    console.error('[soloq-coach] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
