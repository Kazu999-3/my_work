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
