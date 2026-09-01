import { CONFIG } from '../config.js';
import { fetchGAS, fetchPortalAPI, sendDiscordMessage, sendInteractionFollowup } from './api.js';
import { fetchSupabase } from './supabase.js';

/**
 * parseSmartRecruitInput: フリー入力テキストや省略入力をスマートに解釈して募集パラメータを生成
 * 例: "21:00" -> { mode: 'カスタム', time: '21:00〜', max: 10 }
 * 例: "21:30 ノーマル 楽しく" -> { mode: 'ノーマル', time: '21:30〜', max: 5, memo: '楽しく' }
 * 例: "5" -> { mode: 'ノーマル', time: '今から', max: 5 }
 * 例: "ARAM" -> { mode: 'ARAM', time: '今から', max: 5 }
 */
export function parseSmartRecruitInput(rawInput, explicitOptions = {}) {
  let mode = explicitOptions.mode || null;
  let time = explicitOptions.time || null;
  let max = explicitOptions.max ? parseInt(explicitOptions.max, 10) : null;
  let memo = explicitOptions.memo || null;

  if (rawInput && typeof rawInput === 'string') {
    let text = rawInput.trim();

    // 1. モード判定
    if (!mode) {
      if (/aram|アラム/i.test(text)) {
        mode = 'ARAM';
        if (!max) max = 5;
        text = text.replace(/aram|アラム/gi, '');
      } else if (/ノーマル|normal|flex|フレク|ランク/i.test(text)) {
        mode = 'ノーマル';
        if (!max) max = 5;
        text = text.replace(/ノーマル|normal|flex|フレク|ランク/gi, '');
      } else if (/カスタム|custom|内戦/i.test(text)) {
        mode = 'カスタム';
        if (!max) max = 10;
        text = text.replace(/カスタム|custom|内戦/gi, '');
      }
    }

    // 2. 人数判定
    if (!max) {
      const maxMatch = text.match(/\b(10|5|[2-9])\s*人?(?:募集)?\b/);
      if (maxMatch) {
        max = parseInt(maxMatch[1], 10);
        text = text.replace(maxMatch[0], '');
      }
    }

    // 3. 時刻判定
    if (!time) {
      if (/今から|今すぐ|いまから|now/i.test(text)) {
        time = '今から';
        text = text.replace(/今から|今すぐ|いまから|now/gi, '');
      } else {
        const timeMatch = text.match(/(\d{1,2}[:：]\d{2}(?:〜|~)?|\d{1,2}時(?:半|\d{1,2}分)?(?:〜|~)?|\b(?:2[0-3]|1[89])\b)/);
        if (timeMatch) {
          let t = timeMatch[1].replace('：', ':');
          if (/^\d{1,2}$/.test(t)) {
            t = `${t}:00〜`;
          } else if (!t.endsWith('〜') && !t.endsWith('~')) {
            t = `${t}〜`;
          }
          time = t;
          text = text.replace(timeMatch[0], '');
        }
      }
    }

    // 4. 残りのテキストをメモとして扱う
    const remainingText = text.replace(/\s+/g, ' ').trim();
    if (remainingText && !memo) {
      memo = remainingText;
    }
  }

  // デフォルト値補完
  if (!mode) {
    mode = (max === 5) ? 'ノーマル' : 'カスタム';
  }
  if (!max) {
    max = (mode === 'カスタム') ? 10 : 5;
  }
  if (!time) {
    time = '今から';
  }

  return { mode, time, max, memo: memo || '' };
}

/**
 * parseStartTime: 募集の「開始予定時刻」テキスト(JST)を解釈してISO(UTC)文字列を返す。
 * 対応例: "21:00" / "21時" / "土曜21時" / "明日21:00" / "7/25 21時" / "2100"。
 * 解釈できない(例: "今夜"/"未定"/空)場合は null を返す＝リマインド対象外。
 */
export function parseStartTime(text) {
  if (!text) return null;
  const raw = String(text).trim();
  const half = raw.replace(/[０-９：]/g, (c) => {
    const map = { '０': '0', '１': '1', '２': '2', '３': '3', '４': '4', '５': '5', '６': '6', '７': '7', '８': '8', '９': '9', '：': ':' };
    return map[c] || c;
  });

  let hh = null, mm = 0, m;
  if ((m = half.match(/(\d{1,2}):(\d{2})/))) { hh = +m[1]; mm = +m[2]; }
  else if ((m = half.match(/(\d{1,2})\s*時\s*(?:(\d{1,2})\s*分?)?/))) { hh = +m[1]; mm = m[2] ? +m[2] : 0; }
  else if ((m = half.match(/^(\d{2})(\d{2})$/))) { hh = +m[1]; mm = +m[2]; }
  else if ((m = half.match(/^(\d{1,2})$/))) { hh = +m[1]; mm = 0; }
  if (hh === null || hh > 23 || mm > 59) return null;

  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  let targetYear = jstNow.getUTCFullYear();
  let targetMonth = jstNow.getUTCMonth(); // 0-11
  let targetDate = jstNow.getUTCDate();

  // 日付・曜日キーワードの解析
  if (/明日|あした/i.test(raw)) {
    targetDate += 1;
  } else if (/明後日|あさって/i.test(raw)) {
    targetDate += 2;
  } else if ((m = raw.match(/(?:(\d{1,2})\s*月\s*)?(\d{1,2})\s*日/)) || (m = raw.match(/(\d{1,2})\/(\d{1,2})/))) {
    if (m[1]) targetMonth = parseInt(m[1]) - 1;
    targetDate = parseInt(m[2]);
  } else if ((m = raw.match(/(月|火|水|木|金|土|日)曜?/))) {
    const dayMap = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };
    const targetDay = dayMap[m[1]];
    const currentDay = jstNow.getUTCDay();
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7; // 指定曜日が過ぎているか本日なら次の週の同曜日にセット
    targetDate += diff;
  }

  // JST日時を UTC Date へ変換 (Date.UTCがオーバーフローを自動吸収)
  let startUtc = Date.UTC(targetYear, targetMonth, targetDate, hh - 9, mm, 0, 0);

  // 日付キーワード指定がなく、計算された時刻が現在より過去なら翌日へ補正
  if (!/明日|あした|明後日|あさって|月|日|曜/.test(raw) && startUtc <= now.getTime()) {
    startUtc += 24 * 3600 * 1000;
  }

  return new Date(startUtc).toISOString();
}

/** parseMessageData: 元メッセージから募集のメタデータを復元する */
export function parseMessageData(message) {
  const content = message.content || "";
  const embed = message.embeds?.[0] || {};
  const footer = embed.footer?.text || "";
  const desc = embed.description || "";

  const timeMatch = content.match(/⏰ \*\*開始予定\*\*: ([\s\S]*?)(?=\n💬 \*\*メモ\*\*|$)/);
  const memoMatch = content.match(/💬 \*\*メモ\*\*: ([\s\S]*)/);

  // 1. サムネイルURLのクエリパラメータから復元を試行 (新方式)
  let data = null;
  const thumbUrl = embed.thumbnail?.url || "";
  if (thumbUrl.includes('metadata=')) {
    try {
      const encodedData = thumbUrl.split('metadata=')[1];
      data = JSON.parse(decodeURIComponent(encodedData));
    } catch (e) { console.error("Thumbnail metadata decode error:", e); }
  }
  
  if (!data) {
    // 2. 旧方式（隠しリンク）からの復元を試行 (互換性維持)
    const metaMatch = desc.match(/\[[\u200b\u17b5]*\]\(http:\/\/metadata\?owner=([^&)]+)(?:&names=([^)]+))?\)/);
    
    data = {
      owner: metaMatch ? metaMatch[1] : "不明",
      maxCount: parseInt(embed.title?.match(/\[\d+\/(\d+)\]/)?.[1] || 10),
      mode: footer.match(/モード: ([^ |\[\n\u200b]+)/)?.[1] || "カスタム",
      time: timeMatch ? timeMatch[1].trim() : "",
      memo: memoMatch ? memoMatch[1].trim() : "",
      joined: [],
      spectating: [],
      roles: { Top: null, Jg: null, Mid: null, Adc: null, Sup: null },
      names: {}
    };

    // Descriptionからメンバーとロールを抽出
    let isSpectatorSection = false;
    desc.split('\n').forEach(line => {
      if (line.includes('SPECTATORS') || line.includes('カスタム待機')) {
        isSpectatorSection = true;
        return;
      }
      const ids = line.match(/<@(\d+)>/g); if (!ids) return;
      ids.forEach(m => {
        const id = m.match(/\d+/)[0];
        if (isSpectatorSection) {
          data.spectating.push(id);
        } else {
          data.joined.push(id);
          ['Top', 'Jg', 'Mid', 'Adc', 'Sup'].forEach(r => { if (line.includes(r)) data.roles[r] = id; });
        }
        data.names[id] = "ユーザー";
      });
    });
    data.joined = [...new Set(data.joined)];

    // 旧リンク内のID→名前マッピングを復元
    if (metaMatch && metaMatch[2]) {
      try {
        const decodedNames = decodeURIComponent(metaMatch[2]);
        decodedNames.split(',').forEach(pair => {
          const eqIdx = pair.indexOf('=');
          if (eqIdx > 0) {
            const id = pair.substring(0, eqIdx);
            const name = pair.substring(eqIdx + 1);
            if (id && name) data.names[id] = name;
          }
        });
      } catch (e) { console.error("Old metadata decode error:", e); }
    }
  }

  if (message.mentions) message.mentions.forEach(u => data.names[u.id] = u.global_name || u.username);
  return data;
}

/** 自動マッチ終了処理の流れ */
export async function handleAutoMatchEnd(interaction, players, winnerTeam, env, ctx) {
  const appId = interaction.application_id;
  const token = interaction.token;

  ctx.waitUntil((async () => {
    try {
      const { fetchPortalAPI } = await import('./api.js');
      const payload = {
        winningTeam: winnerTeam,
        gameDuration: 0,
        participants: players.map(p => ({
          name: p.name,
          team: p.team,
          role: p.role,
          kills: 0,
          deaths: 0,
          assists: 0
        }))
      };

      const resultData = await fetchPortalAPI(env, '/api/match/record', payload);

      // 3分後の match-sync 実行を予約する。ctx.waitUntil+setTimeoutはワーカーの
      // 生存期間を延ばさず実行保証がないため、10分おきcron(scheduled.js)が拾う
      // 永続キューに積む。
      if (resultData && resultData.matchId) {
        try {
          await fetchSupabase(env, 'pending_match_sync', '', 'POST', {
            match_id: resultData.matchId,
            run_after: new Date(Date.now() + 180000).toISOString(),
          });
        } catch (err) {
          console.error("Failed to schedule pending match-sync:", err);
        }
      }
    } catch (err) { 
      console.error("AutoLog Error:", err); 
    }
  })());

  const updatedEmbed = interaction.message.embeds[0];
  updatedEmbed.title = `✅ 試合終了: ${winnerTeam} 勝利で記録されました`;
  updatedEmbed.color = winnerTeam === 'BLUE' ? 0x3498db : 0xe74c3c;
  
  if (!updatedEmbed.footer) updatedEmbed.footer = {};
  updatedEmbed.footer.text = `✅ 記録完了 | 約3分後にリザルト自動取得... (ID: ${Math.floor(Date.now() / 1000).toString(16)})`;

  return Response.json({ 
    type: 7, 
    data: { embeds: [updatedEmbed], components: [] } 
  });
}
