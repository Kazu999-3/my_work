import { NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchRecentMatchIds, fetchMatchDetails } from '../../../../lib/riot';
import { verifyAdminSession } from '../../../../lib/adminAuth';

export async function POST(request: Request) {
  try {
    const authResult = await verifyAdminSession(request);
    if (!authResult.ok) {
      // 管理者セッション切れは「新しい試合が無い」のと見た目が同じ{isNewMatch:false}
      // だけを返していたため、呼び出し元のmatchDetectFailCount(3回連続失敗で警告)が
      // 検知できず、まさに直したはずの「理由不明のまま自動ポップアップが永久停止する」
      // 状態に逆戻りしていた(2026-08-05発覚)。errorを含めて失敗として扱わせる。
      return NextResponse.json({ isNewMatch: false, error: 'セッションが切れています。再ログインしてください。' });
    }

    const body = await request.json().catch(() => ({}));
    const { ign = '', lastKnownMatchId = '' } = body;

    if (!ign || !ign.includes('#')) {
      return NextResponse.json({ isNewMatch: false });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ isNewMatch: false });
    }

    const [gameName, tagLine] = ign.split('#');
    const puuid = await fetchPuuidByRiotId(gameName.trim(), tagLine.trim(), apiKey);

    const matchIds = await fetchRecentMatchIds(puuid, apiKey, 1, 420);
    if (!matchIds || matchIds.length === 0) {
      return NextResponse.json({ isNewMatch: false });
    }

    const latestMatchId = matchIds[0];
    // 未振り返りの試合IDと一致しないかどうか(=「まだ振り返っていない」)の候補判定。
    // 実際に表示するかは、下で「直近にプレーしたか(RECENCY_LIMIT_MS以内)」も満たすかで最終決定する。
    const isUnreflectedCandidate = !!lastKnownMatchId && lastKnownMatchId !== latestMatchId;

    // ティルト診断ポップアップが勝敗を無視して常に「敗因」を尋ねていた問題(2026-08-10発覚)の
    // 修正用。新しい試合を検知した時だけ試合詳細を取得し、勝敗をポップアップ側の分岐に渡す。
    let win: boolean | null = null;
    // 試合詳細を取得できない場合は直近性を判定できないため、旧来どおり候補判定のまま
    // 表示する(fail-open)。ここで安易にfalseへ倒すと、詳細取得が一時的に失敗しただけの
    // 直近試合が「既読」(lastKnownMatchId更新)扱いになり、二度とポップアップされなくなる。
    let isNewMatch = isUnreflectedCandidate;
    if (isUnreflectedCandidate) {
      try {
        const matchDetails = await fetchMatchDetails(latestMatchId, apiKey);
        const me = matchDetails.participants.find((p) => p.puuid === puuid);
        win = me ? me.win : null;

        // 「直近ソロキューをしてる」条件(2026-08-10追記): 未振り返りの試合が見つかっても、
        // それが数時間・数日前のものだと「試合終了：メンタル＆ティルト高精度診断」という
        // 即時反応前提のポップアップとして文脈が合わない。試合終了(開始+所要時間)から
        // RECENCY_LIMIT_MS以内の場合のみ「直近」とみなして自動表示する。
        // それより古い未振り返り試合は、通常の「振り返りを記録する」導線から手動で扱う。
        const RECENCY_LIMIT_MS = 60 * 60 * 1000; // 60分
        const gameEndTimestamp = matchDetails.gameStartTimestamp + matchDetails.gameDuration * 1000;
        isNewMatch = Date.now() - gameEndTimestamp <= RECENCY_LIMIT_MS;
      } catch (e) {
        console.warn('[soloq/check-finished] 試合詳細の取得に失敗（直近性は未確認のまま候補判定を維持）:', e);
      }
    }

    return NextResponse.json({
      isNewMatch,
      latestMatchId,
      win,
    });
  } catch (err: any) {
    // 「新しい試合は無い」のか「取得自体に失敗した」のかを区別できないと、Riot APIキー
    // 失効やDB障害が起きても自動ポップアップが永遠に出なくなるだけで気づけなかった
    // (2026-08-05発覚)。呼び出し元(coach/page.tsx)が連続失敗を検知できるようerrorを含める。
    console.warn('[soloq/check-finished] error:', err);
    return NextResponse.json({ isNewMatch: false, error: err.message || '取得に失敗しました' });
  }
}
