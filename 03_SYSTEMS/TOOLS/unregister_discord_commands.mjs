/**
 * Discord スラッシュコマンドの登録解除ツール（2026-09-29 新設）
 *
 * 【なぜ必要か】
 * コードからハンドラを消しても Discord 側の登録は残る。残ったコマンドは選択欄に出続け、
 * 押しても何も起きない「幽霊コマンド」になる。実際に `/anchan_chat` がその状態と疑われた
 * （登録スクリプトが 99_ARCHIVE に残っているのに実装が無い）。
 *
 * 【なぜ一括PUTではないのか】
 * Discord の一括登録(PUT)は「渡したリストに無いコマンドを全削除」する。現状把握が不十分な
 * まま実行すると生きているコマンドを消す。そこで**名前を明示した個別DELETE**にしてある。
 * リストに無いものには一切触らない。
 *
 * 【使い方】
 *   # 1. まず何が登録されているか見る（削除しない）
 *   node 03_SYSTEMS/TOOLS/unregister_discord_commands.mjs --list
 *
 *   # 2. 削除対象を確認（まだ削除しない・既定はドライラン）
 *   node 03_SYSTEMS/TOOLS/unregister_discord_commands.mjs
 *
 *   # 3. 実際に削除する
 *   node 03_SYSTEMS/TOOLS/unregister_discord_commands.mjs --apply
 *
 * トークンは DISCORD_TOKEN / DISCORD_BOT_TOKEN 環境変数、または
 * 03_SYSTEMS/ktm_bot/.dev.vars、d:/my_work/.env から読む。
 */
import fs from 'fs';
import path from 'path';

// ── 2026-09-29 の整理で不要になったコマンド名 ──────────────────────────
// 「機能ごと削除」したもの
const REMOVED_FEATURES = ['welcome', 'welcome-panel', 'roulette', 'memo', 'patch', 'balance', 'forge'];
// 「エイリアス廃止」で主名称へ統合したもの（残すのは portal / coins / casino / tip / ranking）
const REMOVED_ALIASES = ['panel', 'command', 'ktm_portal', 'bet', 'rich', 'send-coins', 'award'];
// 実装が存在しない幽霊コマンド（99_ARCHIVE に登録スクリプトだけ残っていた）
const GHOST_COMMANDS = ['anchan_chat'];

const TARGETS = [...REMOVED_FEATURES, ...REMOVED_ALIASES, ...GHOST_COMMANDS];

/** 現在も使うコマンド。誤って消さないための安全ネット。 */
const KEEP = ['portal', 'ign', 'lane', 'recruit', 'stats', 'ranking', 'coins', 'casino', 'tip', 'roles'];

function readTokenFromFile(file, keys) {
  try {
    if (!fs.existsSync(file)) return null;
    const text = fs.readFileSync(file, 'utf-8');
    for (const key of keys) {
      const m = text.match(new RegExp(`^\\s*${key}\\s*=\\s*"?([^\\r\\n"]+)`, 'm'));
      if (m) return m[1].trim();
    }
  } catch {
    /* noop */
  }
  return null;
}

function resolveToken() {
  return (
    process.env.DISCORD_TOKEN ||
    process.env.DISCORD_BOT_TOKEN ||
    readTokenFromFile(path.join('03_SYSTEMS', 'ktm_bot', '.dev.vars'), ['DISCORD_TOKEN']) ||
    readTokenFromFile('.env', ['DISCORD_BOT_TOKEN', 'DISCORD_TOKEN']) ||
    null
  );
}

async function api(token, urlPath, method = 'GET') {
  const res = await fetch(`https://discord.com/api/v10${urlPath}`, {
    method,
    headers: { Authorization: `Bot ${token}` }
  });
  if (method === 'DELETE') return { ok: res.ok, status: res.status };
  if (!res.ok) throw new Error(`${method} ${urlPath} → HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');
  const apply = args.includes('--apply');

  const token = resolveToken();
  if (!token) {
    console.error('DISCORD_TOKEN が見つかりません。環境変数か 03_SYSTEMS/ktm_bot/.dev.vars に設定してください。');
    process.exit(1);
  }

  const me = await api(token, '/users/@me');
  const appId = me.id;
  console.log(`Bot: ${me.username} (AppId: ${appId})\n`);

  // グローバル ＋ 参加中の全ギルドを走査する。片方だけ消して片方が残る事故を防ぐ。
  const scopes = [{ label: 'グローバル', path: `/applications/${appId}/commands` }];
  const guilds = await api(token, '/users/@me/guilds');
  for (const g of guilds) {
    scopes.push({
      label: `ギルド ${g.name} (${g.id})`,
      path: `/applications/${appId}/guilds/${g.id}/commands`
    });
  }

  let totalDeleted = 0;
  let totalTargets = 0;

  for (const scope of scopes) {
    const cmds = await api(token, scope.path);
    if (!Array.isArray(cmds)) continue;

    console.log(`=== ${scope.label} : 登録 ${cmds.length}件 ===`);
    for (const c of cmds) {
      const isTarget = TARGETS.includes(c.name);
      const isKeep = KEEP.includes(c.name);
      const mark = isTarget ? '🗑️ 削除対象' : isKeep ? '✅ 維持' : '❓ リスト外(触らない)';
      console.log(`  ${mark}  /${c.name}  ${c.description || ''}`);
    }

    if (listOnly) {
      console.log('');
      continue;
    }

    const targets = cmds.filter((c) => TARGETS.includes(c.name) && !KEEP.includes(c.name));
    totalTargets += targets.length;

    for (const c of targets) {
      if (!apply) {
        console.log(`  [ドライラン] /${c.name} を削除します（--apply で実行）`);
        continue;
      }
      const r = await api(token, `${scope.path}/${c.id}`, 'DELETE');
      if (r.ok) {
        console.log(`  ✔ 削除しました: /${c.name}`);
        totalDeleted++;
      } else {
        console.error(`  ✖ 削除失敗: /${c.name} (HTTP ${r.status})`);
      }
      // レート制限対策（コマンド削除は緩いが念のため）
      await new Promise((r2) => setTimeout(r2, 300));
    }
    console.log('');
  }

  if (listOnly) return;
  if (apply) {
    console.log(`完了: ${totalDeleted}件を削除しました。`);
  } else {
    console.log(`ドライラン終了: 削除対象は ${totalTargets}件です。実行するには --apply を付けてください。`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
