import { NextResponse } from 'next/server';
import https from 'https';

export const dynamic = 'force-dynamic';

// 自己署名SSL証明書を許容するエージェント (Riot Client 127.0.0.1:2999 用)
const agent = new https.Agent({
  rejectUnauthorized: false
});

export async function GET() {
  try {
    const url = 'https://127.0.0.1:2999/liveclientdata/allgamedata';

    // Node.jsのhttpsリクエストで取得 (ブラウザのCORS・証明書エラーを完全バイパス)
    const data = await new Promise((resolve, reject) => {
      const req = https.get(url, { agent, timeout: 1500 }, (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      });

      req.on('error', () => { resolve(null); });
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });

    if (!data) {
      return NextResponse.json({ inGame: false });
    }

    const activePlayer = (data as any).activePlayer;
    const allPlayers = (data as any).allPlayers || [];
    const events = (data as any).events?.Events || [];
    const gameData = (data as any).gameData || {};

    const activeSummonerName = activePlayer?.summonerName || '';
    const myPlayer = allPlayers.find((p: any) => p.summonerName === activeSummonerName) || allPlayers[0];

    const myTeam = myPlayer?.team;
    const myPos = myPlayer?.position;
    const enemyPlayer = allPlayers.find((p: any) => p.team !== myTeam && p.position === myPos && myPos && myPos !== 'NONE') ||
                        allPlayers.find((p: any) => p.team !== myTeam);

    // 対面の Riot ID。HUD 側がこれで /api/lol/habit-radar（直近試合の実測）を引く。
    // 2026-10-16: 以前はここで全対面に同じ固定値（ワード切れ2:48・リコール5:15・初デス4:10）を入れて
    // 「対面の癖」と表示していた。出典の無い秒数で、スカウターの実測とも繋がっていなかったため廃止。
    const enemyRiotId: string | null = enemyPlayer
      ? (enemyPlayer.riotId ||
         (enemyPlayer.riotIdGameName && enemyPlayer.riotIdTagLine
           ? `${enemyPlayer.riotIdGameName}#${enemyPlayer.riotIdTagLine}`
           : (String(enemyPlayer.summonerName || '').includes('#') ? enemyPlayer.summonerName : null)))
      : null;

    return NextResponse.json({
      inGame: true,
      gameTimeSec: Math.floor(gameData.gameTime || 0),
      activePlayer: {
        championName: myPlayer?.championName || activePlayer?.championName || 'Unknown',
        summonerName: activeSummonerName,
        level: activePlayer?.level || 1,
        currentGold: Math.floor(activePlayer?.currentGold || 0),
        kills: myPlayer?.scores?.kills || 0,
        deaths: myPlayer?.scores?.deaths || 0,
        assists: myPlayer?.scores?.assists || 0,
        cs: myPlayer?.scores?.creepScore || 0,
        wardScore: myPlayer?.scores?.wardScore || 0,
      },
      enemyPlayer: enemyPlayer ? {
        championName: enemyPlayer.championName,
        summonerName: enemyPlayer.summonerName,
        position: enemyPlayer.position,
        kills: enemyPlayer.scores?.kills || 0,
        deaths: enemyPlayer.scores?.deaths || 0,
        assists: enemyPlayer.scores?.assists || 0,
        cs: enemyPlayer.scores?.creepScore || 0,
        riotId: enemyRiotId,
      } : null,
      allPlayers: allPlayers.map((p: any) => ({
        championName: p.championName,
        team: p.team, // 'ORDER' (Blue) | 'CHAOS' (Red)
        position: p.position,
        kills: p.scores?.kills || 0,
        deaths: p.scores?.deaths || 0,
        assists: p.scores?.assists || 0,
        cs: p.scores?.creepScore || 0,
        items: (p.items || []).map((it: any) => it.itemID)
      })),
      recentEvents: events.slice(-5)
    });
  } catch {
    return NextResponse.json({ inGame: false });
  }
}
