import { NextResponse } from 'next/server';
import { fetchPuuidByRiotId, fetchRecentMatchIds } from '../../../../lib/riot';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// ============================================================
// 診断: カスタムゲームが Match-V5 のマッチ履歴に含まれるか実機確認 (課題: カスタム戦績の自動取り込み検証)
//
// 旧Match-V4ではカスタム戦が履歴に出なかったためスクショ登録運用にしていたが、
// 現行Match-V5では queueId=0 のカスタム戦が by-puuid/ids に含まれるという報告がある。
// このエンドポイントは実際に直近マッチのqueueId/gameModeを列挙し、カスタム戦(queueId=0
// または gameMode=CUSTOM_GAME)が取得できるかを返す。取得できれば自動取り込みへ移行できる。
//
// 呼び出し: 管理者ログイン状態で GET /api/admin/riot-custom-check?count=30
// ============================================================

const RIOT_ASIA = 'https://asia.api.riotgames.com';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const count = Math.min(50, Math.max(5, Number(searchParams.get('count')) || 30));
    const apiKey = process.env.RIOT_API_KEY!;
    const gameName = searchParams.get('gameName') || process.env.RIOT_GAME_NAME!;
    const tagLine = searchParams.get('tagLine') || process.env.RIOT_TAG_LINE!;
    if (!apiKey || !gameName || !tagLine) {
      return NextResponse.json({ error: 'Riot API環境変数(RIOT_API_KEY/GAME_NAME/TAG_LINE)が未設定です。' }, { status: 500 });
    }

    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);
    // queueフィルタなしで直近の全マッチIDを取得（カスタムが混ざるかを見たいため）
    const matchIds = await fetchRecentMatchIds(puuid, apiKey, count);

    // 各マッチの queueId / gameMode / gameType を生fetchで確認
    const details = await Promise.all(
      matchIds.map(async (id) => {
        try {
          const res = await fetch(`${RIOT_ASIA}/lol/match/v5/matches/${id}?api_key=${apiKey}`, { cache: 'no-store' });
          if (!res.ok) return { id, error: res.status };
          const d = await res.json();
          return {
            id,
            queueId: d.info?.queueId,
            gameMode: d.info?.gameMode,
            gameType: d.info?.gameType,
            players: d.info?.participants?.length ?? 0,
            durationMin: Math.round((d.info?.gameDuration ?? 0) / 60),
          };
        } catch (e: any) {
          return { id, error: e.message };
        }
      })
    );

    const ok = details.filter((d: any) => !d.error);
    // カスタム戦の判定: queueId=0 もしくは gameMode/gameType が CUSTOM_GAME
    const customs = ok.filter((d: any) => d.queueId === 0 || d.gameMode === 'CUSTOM_GAME' || d.gameType === 'CUSTOM_GAME');
    // queueId分布
    const queueDist: Record<string, number> = {};
    for (const d of ok as any[]) {
      const key = `${d.queueId}`;
      queueDist[key] = (queueDist[key] || 0) + 1;
    }

    return NextResponse.json({
      puuid_prefix: puuid.slice(0, 8) + '…',
      checkedMatches: matchIds.length,
      customGamesFound: customs.length,
      canAutoImport: customs.length > 0,
      customs: customs.slice(0, 10),
      queueDistribution: queueDist,
      sample: details.slice(0, 10),
      note: customs.length > 0
        ? '✅ カスタム戦がMatch-V5で取得できます。スクショ登録を自動取り込みに置換可能です。'
        : '⚠️ 直近の履歴にカスタム戦が見つかりませんでした。最近カスタムをプレイした状態で再実行してください（10人フルパーティのカスタムのみ記録される可能性があります）。',
    });
  } catch (err: any) {
    console.error('[riot-custom-check] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
