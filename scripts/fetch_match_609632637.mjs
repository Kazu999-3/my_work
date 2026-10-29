import https from 'node:https';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const lcuAgent = new https.Agent({ rejectUnauthorized: false });

function getLcuAuth() {
  const output = execSync('powershell -Command "(Get-CimInstance Win32_Process -Filter \\"name like \'LeagueClientUx%\'\\").CommandLine"', { encoding: 'utf8' });
  const portMatch = output.match(/--app-port=([0-9]+)/);
  const tokenMatch = output.match(/--remoting-auth-token=([a-zA-Z0-9_-]+)/);
  if (portMatch && tokenMatch) {
    return {
      port: portMatch[1],
      token: tokenMatch[1],
      authHeader: 'Basic ' + Buffer.from(`riot:${tokenMatch[1]}`).toString('base64'),
    };
  }
  return null;
}

const auth = getLcuAuth();
if (!auth) {
  console.error('LCU not found');
  process.exit(1);
}
console.log('LCU Connected, Port:', auth.port);

function fetchLcu(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: auth.port,
      path: endpoint,
      method: 'GET',
      headers: {
        Authorization: auth.authHeader,
        Accept: 'application/json',
      },
      agent: lcuAgent,
      timeout: 5000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        console.log(`[GET ${endpoint}] Status:`, res.statusCode);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ raw: data });
          }
        } else {
          resolve({ error: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const gameId = '609617813';
  console.log(`\n🔍 Fetching REAL custom match ${gameId}...`);
  
  // 1. /lol-match-history/v1/games/{gameId}
  const res1 = await fetchLcu(`/lol-match-history/v1/games/${gameId}`);
  if (res1 && !res1.error) {
    console.log('✅ Found match via /lol-match-history/v1/games/');
    fs.writeFileSync('d:/my_work/scripts/match_609617813_raw.json', JSON.stringify(res1, null, 2), 'utf8');
    console.log('🎉 Successfully saved d:/my_work/scripts/match_609617813_raw.json');
    return;
  }

  // 2. /lol-match-history/v1/products/lol/current-schema/matches/{gameId}
  const res2 = await fetchLcu(`/lol-match-history/v1/products/lol/current-schema/matches/${gameId}`);
  if (res2 && !res2.error) {
    console.log('✅ Found match via /lol-match-history/v1/products/lol/current-schema/matches/');
    fs.writeFileSync('scripts/match_609632637_raw.json', JSON.stringify(res2, null, 2), 'utf8');
    return;
  }

  // 3. 自分の現在の召喚士情報から対戦履歴リストを取得
  const me = await fetchLcu('/lol-summoner/v1/current-summoner');
  console.log('Current Summoner:', me ? me.displayName || me.gameName : 'null');
  if (me && me.puuid) {
    const history = await fetchLcu(`/lol-match-history/v1/products/lol/current-schema/matches-by-puuid/${me.puuid}`);
    console.log('History fetched, games count:', history?.games?.games?.length);
    fs.writeFileSync('scripts/my_match_history.json', JSON.stringify(history, null, 2), 'utf8');
  }
}

run().catch(console.error);
