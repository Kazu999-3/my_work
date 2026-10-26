/**
 * KTM Sovereign - LoLカスタム試合 自動リザルト記録スクリプト (KTM Match Watcher)
 * 
 * 【概要】
 * LoLクライアント（LCU）のローカルAPIをバックグラウンドで常駐監視し、
 * カスタムマッチ終了時に10人全員の詳細スタッツ（KDA、与ダメ、被ダメ、CS、視界、ゴールド等）を
 * 自動取得してKTMポータル（/api/match/record）へ自動送信・記録します。
 * 
 * 【特徴】
 * - スクショ撮影・アップロードが不要（完全全自動・試合終了から約3秒で記録）
 * - 本スクリプトが起動していない時は、既存のポータル手動/OCR記録画面がそのまま使えます（ハイブリッド運用）
 */

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ログファイルへの同時書き込み設定
const LOG_FILE = path.resolve(__dirname, '../logs/match_watcher.log');
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function writeLogFile(prefix, ...args) {
  try {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    const line = `[${new Date().toISOString()}] ${prefix} ${text}\n`;
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch {}
}

console.log = (...args) => {
  try {
    originalConsoleLog(...args);
  } catch {}
  writeLogFile('[INFO]', ...args);
};

console.error = (...args) => {
  try {
    originalConsoleError(...args);
  } catch {}
  writeLogFile('[ERROR]', ...args);
};

// 未捕捉エラーをログに記録
process.on('uncaughtException', (err) => {
  writeLogFile('[FATAL_UNCAUGHT]', err?.stack || err?.message || String(err));
});
process.on('unhandledRejection', (reason) => {
  writeLogFile('[FATAL_UNHANDLED]', reason?.stack || reason?.message || String(reason));
});

// 二重起動防止 (PIDファイルによる単一プロセス常駐)
const LOCK_FILE = path.resolve(__dirname, '../.ktm_watcher.pid');
function ensureSingleInstance() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const existingPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8').trim(), 10);
      if (existingPid && !isNaN(existingPid)) {
        process.kill(existingPid, 0); // 稼働中なら例外が発生しない
        console.log(`⚠️ 既に KTM Match Watcher が実行中です (PID: ${existingPid})。重複起動を防止するため終了します。`);
        process.exit(0);
      }
    } catch {
      // プロセスが存在しない（前回異常終了の残骸）場合は上書き
    }
  }

  fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8');

  const cleanup = () => {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        const cur = fs.readFileSync(LOCK_FILE, 'utf8').trim();
        if (cur === String(process.pid)) {
          fs.unlinkSync(LOCK_FILE);
        }
      }
    } catch {}
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
}

ensureSingleInstance();

// .env.local から設定を読み込み
function loadEnv() {
  const envPath = path.resolve(__dirname, '../04_PORTAL/.env.local');
  const env = {};
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
  }
  return env;
}

const env = loadEnv();
const PORTAL_URL = process.env.KTM_PORTAL_URL || env.NEXT_PUBLIC_APP_URL || 'https://ktm-sovereign-portal.vercel.app';
const BOT_SECRET = process.env.PORTAL_BOT_SECRET || env.PORTAL_BOT_SECRET || '';

// 自己署名証明書を許可するHTTPS Agent
const lcuAgent = new https.Agent({ rejectUnauthorized: false });

// 記録済みゲームIDのセット（二重送信防止）
const recordedGameIds = new Set();

// ロール文字列の正規化マッピング
function normalizeRole(position, champRole) {
  const p = (position || '').toUpperCase();
  if (p === 'TOP') return 'TOP';
  if (p === 'JUNGLE') return 'JG';
  if (p === 'MIDDLE') return 'MID';
  if (p === 'BOTTOM') return 'ADC';
  if (p === 'UTILITY') return 'SUP';
  return champRole || 'MID';
}

/**
 * Windows上で起動中のLeagueClientUxプロセスから通信情報（ポートと認証トークン）を抽出
 */
function getLcuAuth() {
  try {
    const cmd = 'powershell -Command "Get-CimInstance Win32_Process -Filter \\"name = \'LeagueClientUx.exe\'\\" | Select-Object -ExpandProperty CommandLine"';
    const output = execSync(cmd, { encoding: 'utf8', timeout: 4000 });
    if (!output) return null;

    const portMatch = output.match(/--app-port=([0-9]+)/);
    const tokenMatch = output.match(/--remoting-auth-token=([a-zA-Z0-9_-]+)/);

    if (portMatch && tokenMatch) {
      return {
        port: portMatch[1],
        token: tokenMatch[1],
        authHeader: 'Basic ' + Buffer.from(`riot:${tokenMatch[1]}`).toString('base64'),
      };
    }
  } catch {
    // プロセス未起動または取得エラー
  }

  // フォールバック: 標準インストール先の lockfile を探索
  const commonPaths = [
    'C:\\Riot Games\\League of Legends\\lockfile',
    'D:\\Riot Games\\League of Legends\\lockfile',
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8').trim();
        const parts = content.split(':');
        if (parts.length >= 5) {
          return {
            port: parts[2],
            token: parts[3],
            authHeader: 'Basic ' + Buffer.from(`riot:${parts[3]}`).toString('base64'),
          };
        }
      } catch {}
    }
  }

  return null;
}

/**
 * LCU API へ GET リクエスト
 */
function fetchLcu(endpoint, auth) {
  return new Promise((resolve) => {
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
      timeout: 3000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/**
 * ポータル (/api/match/record) へリザルトデータをPOST
 */
async function sendToPortal(payload) {
  const url = new URL('/api/match/record', PORTAL_URL);
  console.log(`\n📡 ポータルへ送信中: ${url.href}`);

  const bodyStr = JSON.stringify(payload);
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
      ...(BOT_SECRET ? { 'x-bot-secret': BOT_SECRET } : {}),
    },
    timeout: 15000,
  };

  const client = url.protocol === 'https:' ? https : (await import('node:http')).default;

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ success: true, raw: data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('送信タイムアウト')); });
    req.write(bodyStr);
    req.end();
  });
}

/**
 * 試合終了リザルト (EOG Stats Block) をパースしてポータル用ペイロードに変換
 */
function parseEogStats(eogData) {
  if (!eogData || !eogData.teams || eogData.teams.length < 2) return null;

  const blueTeam = eogData.teams.find((t) => t.teamId === 100);
  const redTeam = eogData.teams.find((t) => t.teamId === 200);
  if (!blueTeam || !redTeam) return null;

  const winningTeam = blueTeam.isWinningTeam || blueTeam.win === 'Win' ? 'BLUE' : 'RED';
  const gameDuration = Number(eogData.gameLength) || Number(eogData.gameDuration) || 0;

  // 10人のプレイヤー情報を抽出
  const allPlayers = [];
  for (const team of [blueTeam, redTeam]) {
    const teamSide = team.teamId === 100 ? 'BLUE' : 'RED';
    const players = team.players || [];
    for (const p of players) {
      const stats = p.stats || {};
      const rawName = p.summonerName || p.gameName || '不明サモナー';
      // タグ付き（例: 名前#JP1）の場合はサモナー名のみを優先
      const cleanName = rawName.split('#')[0].trim();

      const items = [
        Number(stats.ITEM0 || 0),
        Number(stats.ITEM1 || 0),
        Number(stats.ITEM2 || 0),
        Number(stats.ITEM3 || 0),
        Number(stats.ITEM4 || 0),
        Number(stats.ITEM5 || 0),
        Number(stats.ITEM6 || 0), // トリンケット
      ];
      const spells = [
        Number(p.spell1Id || stats.SPELL1_ID || 0),
        Number(p.spell2Id || stats.SPELL2_ID || 0),
      ];

      allPlayers.push({
        name: cleanName,
        team: teamSide,
        role: normalizeRole(p.selectedPosition || stats.POSITION, null),
        champion_name: p.championName || 'Champion',
        kills: Number(stats.CHAMPIONS_KILLED || stats.kills || 0),
        deaths: Number(stats.NUM_DEATHS || stats.deaths || 0),
        assists: Number(stats.ASSISTS || stats.assists || 0),
        vision: Number(stats.VISION_SCORE || stats.visionScore || 0),
        damage_dealt: Number(stats.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS || stats.totalDamageDealtToChampions || 0),
        damage_taken: Number(stats.TOTAL_DAMAGE_TAKEN || stats.totalDamageTaken || 0),
        heal_shield: Number((stats.TOTAL_HEAL || 0) + (stats.TOTAL_DAMAGE_SHIELDED_ON_TEAMMATES || 0)),
        objective_damage: Number(stats.DAMAGE_DEALT_TO_OBJECTIVES || stats.damageDealtToObjectives || 0),
        building_damage: Number(stats.DAMAGE_DEALT_TO_BUILDINGS || stats.damageDealtToBuildings || 0),
        damage_mitigated: Number(stats.DAMAGE_SELF_MITIGATED || stats.damageSelfMitigated || 0),
        cc_time: Number(stats.TIME_CCING_OTHERS || stats.timeCCingOthers || 0),
        cs: Number((stats.MINIONS_KILLED || 0) + (stats.NEUTRAL_MINIONS_KILLED || 0)),
        gold: Number(stats.GOLD_EARNED || stats.goldEarned || 0),
        penta_kills: Number(stats.LARGEST_MULTI_KILL === 5 ? 1 : (stats.PENTA_KILLS || 0)),
        solo_kills: Number(stats.SOLO_KILLS || stats.soloKills || 0),
        time_dead: Number(stats.TOTAL_TIME_SPENT_DEAD || stats.totalTimeSpentDead || 0),
        turrets_killed: Number(stats.TURRETS_KILLED || stats.turretsKilled || 0),
        items,
        spells,
      });
    }
  }

  // ゲームモード判定
  const isCustomGame = eogData.gameType === 'CUSTOM_GAME' || eogData.queueId === 0 || (!eogData.queueId && allPlayers.length === 10);
  const isRankedSolo = eogData.queueId === 420;

  if (!isCustomGame && !isRankedSolo) {
    console.log(`[KTM Watcher] カスタム戦またはソロQ以外のゲームモード（Queue: ${eogData.queueId || '不明'}）のためスキップします。`);
    return null;
  }

  if (isCustomGame && allPlayers.length !== 10) {
    console.warn(`[KTM Watcher] カスタム戦のプレイヤー数が10人ではありません (${allPlayers.length}人)。スキップします。`);
    return null;
  }

  // ロール重複の簡易調整（同一チームでロールが被った場合の保険）
  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  for (const side of ['BLUE', 'RED']) {
    const sidePlayers = allPlayers.filter((p) => p.team === side);
    const assignedRoles = new Set();
    for (const p of sidePlayers) {
      if (!assignedRoles.has(p.role) && roles.includes(p.role)) {
        assignedRoles.add(p.role);
      } else {
        // 未割り当てのロールを順次割り当て
        const remaining = roles.find((r) => !assignedRoles.has(r));
        if (remaining) {
          p.role = remaining;
          assignedRoles.add(remaining);
        }
      }
    }
  }

  return {
    winningTeam,
    gameDuration,
    riotMatchId: eogData.gameId ? String(eogData.gameId) : undefined,
    participants: allPlayers,
  };
}

/**
 * メイン監視ループ
 */
async function main() {
  if (process.stdout?.isTTY) {
    try { console.clear(); } catch {}
  }
  console.log('====================================================');
  console.log('   🎮 KTM Sovereign - Match Watcher (自動リザルト記録)');
  console.log('====================================================');
  console.log(`🌐 送信先ポータル: ${PORTAL_URL}`);
  console.log(`🔑 認証キー: ${BOT_SECRET ? '設定済み (OK)' : '未設定 (開発モード)'}`);
  console.log('----------------------------------------------------');
  console.log('👀 LoLクライアント（LCU）の起動を待機中...');

  let lastPhase = '';
  let auth = null;

  while (true) {
    try {
      // 1. LCU認証情報の確認
      if (!auth) {
        auth = getLcuAuth();
        if (auth) {
          console.log(`\n✨ LoLクライアントを検出しました！ (Port: ${auth.port})`);
          console.log('⏳ 試合終了の検知待機中（最小化のまま放置OK）...\n');
        }
      }

      if (auth) {
        // 2. ゲームフェーズの確認
        const phase = await fetchLcu('/lol-gameflow/v1/gameflow-phase', auth);

        if (phase === null) {
          // クライアント切断
          console.log('\n⚠️ LoLクライアントとの通信が切れました。再接続を待機します...');
          auth = null;
          lastPhase = '';
        } else {
          if (phase !== lastPhase) {
            console.log(`[状態変化] Gameflow Phase: ${phase}`);
            lastPhase = phase;
          }

          // 3. 試合終了フェーズ（EndOfGame / PreEndOfGame / WaitingForStats）の検知
          if (phase === 'EndOfGame' || phase === 'PreEndOfGame' || phase === 'WaitingForStats') {
            const eogData = await fetchLcu('/lol-end-of-game/v1/eog-stats-block', auth);

            if (eogData && eogData.gameId) {
              const gameId = String(eogData.gameId);

              if (!recordedGameIds.has(gameId)) {
                console.log(`\n🎯 試合終了リザルトをキャッチしました！ (Game ID: ${gameId})`);
                const payload = parseEogStats(eogData);

                if (payload) {
                  try {
                    const isRankedSolo = eogData.queueId === 420;
                    if (isRankedSolo) {
                      console.log('🎮 【ソロキュー検知】Ranked Soloの試合結果を検出しました！');
                      recordedGameIds.add(gameId);
                      console.log(`⏱️ 試合時間: 約${Math.round(payload.gameDuration / 60)}分 / 参加者: ${payload.participants.length}名`);
                      console.log('💡 ソロキュー戦績はRiot API同期および専属AIコーチのギャップ分析に反映されます。');
                    } else {
                      const res = await sendToPortal(payload);
                      recordedGameIds.add(gameId);
                      console.log('====================================================');
                      console.log('🎉 【自動記録完了】カスタム試合結果がポータルへ正常に送信されました！');
                      console.log(`🏆 勝利チーム: ${payload.winningTeam}`);
                      console.log(`⏱️ 試合時間: 約${Math.round(payload.gameDuration / 60)}分`);
                      console.log('📰 KTMスポーツ号外＆Discord通知も自動発行されました！');
                      console.log('====================================================\n');
                    }
                  } catch (err) {
                    console.error('❌ ポータルへの送信エラー:', err.message);
                    console.log('※ 3秒後に再試行します...');
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // 予期せぬエラー
    }

    // 3秒間隔でポーリング
    await new Promise((r) => setTimeout(r, 3000));
  }
}

main().catch(console.error);
