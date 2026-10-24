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
        cs: Number((stats.MINIONS_KILLED || 0) + (stats.NEUTRAL_MINIONS_KILLED || 0)),
        gold: Number(stats.GOLD_EARNED || stats.goldEarned || 0),
        penta_kills: Number(stats.LARGEST_MULTI_KILL === 5 ? 1 : (stats.PENTA_KILLS || 0)),
      });
    }
  }

  if (allPlayers.length !== 10) {
    console.warn(`[KTM Watcher] プレイヤー数が10人ではありません (${allPlayers.length}人)。カスタム戦以外はスキップします。`);
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
  console.clear();
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
                    const res = await sendToPortal(payload);
                    recordedGameIds.add(gameId);
                    console.log('====================================================');
                    console.log('🎉 【自動記録完了】試合結果がポータルへ正常に送信されました！');
                    console.log(`🏆 勝利チーム: ${payload.winningTeam}`);
                    console.log(`⏱️ 試合時間: 約${Math.round(payload.gameDuration / 60)}分`);
                    console.log('📰 KTMスポーツ号外＆Discord通知も自動発行されました！');
                    console.log('====================================================\n');
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
