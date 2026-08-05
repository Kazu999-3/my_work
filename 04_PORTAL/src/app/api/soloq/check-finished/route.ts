import { NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchRecentMatchIds } from '../../../../lib/riot';
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
    const isNewMatch = !!lastKnownMatchId && lastKnownMatchId !== latestMatchId;

    return NextResponse.json({
      isNewMatch,
      latestMatchId,
    });
  } catch (err: any) {
    // 「新しい試合は無い」のか「取得自体に失敗した」のかを区別できないと、Riot APIキー
    // 失効やDB障害が起きても自動ポップアップが永遠に出なくなるだけで気づけなかった
    // (2026-08-05発覚)。呼び出し元(coach/page.tsx)が連続失敗を検知できるようerrorを含める。
    console.warn('[soloq/check-finished] error:', err);
    return NextResponse.json({ isNewMatch: false, error: err.message || '取得に失敗しました' });
  }
}
