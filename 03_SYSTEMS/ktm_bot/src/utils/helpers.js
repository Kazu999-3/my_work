
// ============================================================
// レーン希望・こだわり度の入力検証（2026-09-29 新設）
//
// 【なぜ必要か】
// モーダルの自由入力をそのままポータルへ送っていた。ポータル側も値を検証せず
// `role_preferences.primary` にそのまま保存する。
// バランサーは `ROLES.includes(mainRole)` で弾くのでデータは壊れないが、
// **無効な値は永久に無視される**。つまり「とっぷ」と入力しても
// 「🎉 登録完了！希望レーン: とっぷ」と成功表示され、本人は希望が通らない理由が分からない。
// weight も NaN チェックだけで範囲制限が無く、999 を入れても「受付ました」になる
// （パネルの説明は「1:絶対, 2:通常, 3:柔軟」）。
// サーバーが安全に無視する以上データ破壊は起きないので、**入口で弾いて理由を伝える**のが正解。
// ============================================================

/** バランサーが実際に解釈できるレーン値（`04_PORTAL/src/lib/balancer.ts` の ROLES と対応） */
export const VALID_LANES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
/** メイン希望では「全部やれる」を許可する。サブ・NGでは「なし」を意味する '-' を許可する。 */
const MAIN_EXTRA = ['ALL'];
const OPTIONAL_EXTRA = ['-', 'なし', 'ナシ', 'NONE'];

/**
 * レーン入力を正規化する。
 * @param {string} raw 入力値
 * @param {{ allowAll?: boolean, allowEmpty?: boolean }} opts
 * @returns {{ value: string|undefined, error: string|null }}
 */
export function normalizeLaneInput(raw, opts = {}) {
  const { allowAll = false, allowEmpty = true } = opts;
  const s = String(raw ?? '').trim().toUpperCase();

  if (!s) {
    return allowEmpty ? { value: undefined, error: null } : { value: undefined, error: 'レーンを入力してください。' };
  }
  // 「なし」系の表記は未指定として扱う
  if (OPTIONAL_EXTRA.includes(s)) return { value: '-', error: null };
  if (allowAll && MAIN_EXTRA.includes(s)) return { value: 'ALL', error: null };

  // よくある別表記を吸収する（BOT=ADC は LoLの慣習、TOPの全角など）
  const alias = { BOT: 'ADC', BOTTOM: 'ADC', JUNGLE: 'JG', JUNG: 'JG', MIDDLE: 'MID', SUPPORT: 'SUP', SUPP: 'SUP' };
  const normalized = alias[s] || s;

  if (VALID_LANES.includes(normalized)) return { value: normalized, error: null };

  const allowed = [...VALID_LANES, ...(allowAll ? MAIN_EXTRA : []), '-'].join(' / ');
  return { value: undefined, error: `「${raw}」はレーンとして認識できません。次のいずれかで入力してください: ${allowed}` };
}

/**
 * こだわり度(weight)を正規化する。1〜3の整数のみ許可する。
 * @returns {{ value: number|undefined, error: string|null }}
 */
export function normalizeWeightInput(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { value: undefined, error: null };
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) {
    return { value: undefined, error: `こだわり度は数字で入力してください（1=絶対 / 2=通常 / 3=柔軟）。入力値: 「${raw}」` };
  }
  if (n < 1 || n > 3) {
    return { value: undefined, error: `こだわり度は 1〜3 で入力してください（1=絶対 / 2=通常 / 3=柔軟）。入力値: ${n}` };
  }
  return { value: n, error: null };
}

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

  // rawInput または memo のテキストを走査対象にする
  let text = (rawInput && typeof rawInput === 'string') ? rawInput.trim() : '';
  if (!text && memo && typeof memo === 'string') {
    text = memo.trim();
    memo = null; // 後で残りテキストを再代入
  }

  if (text) {
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
    if (remainingText) {
      memo = remainingText;
    }
  }

  // デフォルト値補完 (ニュートラルはノーマル5人・今から)
  if (!mode) {
    mode = (max === 10) ? 'カスタム' : 'ノーマル';
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

// handleAutoMatchEnd（Discordの勝敗ボタン→試合記録・精算・Riot取り込みの予約）は、勝敗ボタンを作る処理が
// Bot の書き直し時に無くなり呼ばれていなかったため 2026-10-07 に削除（試合の記録は 04 の記録画面が行う）。
