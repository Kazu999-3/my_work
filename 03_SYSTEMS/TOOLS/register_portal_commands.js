// KTM Bot のスラッシュコマンドを Discord に登録する。
//
// 2026-10-19: 以前は /welcome だけを登録する作りで、/coins /casino /tip /ranking はボットに処理があるのに
// Discord に登録されておらず、メンバーが使えなかった。コードの定義（ktm_bot/src/commandDefinitions.js）を
// 正として、KTM サーバー向けのコマンドを「定義の通りにまとめて置き換える」形にした。
//   - 全体向け（グローバル）に登録済みのコマンド（例: /ign）は、二重に出ないようサーバー向けから除く
//   - 定義に無いサーバー向けのコマンドは消える（まとめて置き換えるため）
//
// 使い方（リポジトリの直下で）:
//   node 03_SYSTEMS/TOOLS/register_portal_commands.js            … 何が登録されるかを表示するだけ
//   node 03_SYSTEMS/TOOLS/register_portal_commands.js --apply    … 実際に登録する
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const GUILD_ID = '1485636149379858567';

function readToken() {
  if (process.env.DISCORD_TOKEN) return process.env.DISCORD_TOKEN;
  const candidates = [
    ['03_SYSTEMS/ktm_bot/.dev.vars', /DISCORD_TOKEN="?([^\r\n"]+)/],
    ['04_PORTAL/.env.local', /DISCORD_BOT_TOKEN="?([^\r\n"]+)/],
  ];
  for (const [file, re] of candidates) {
    if (!fs.existsSync(file)) continue;
    const m = fs.readFileSync(file, 'utf-8').match(re);
    if (m) return m[1];
  }
  throw new Error('Discord のボットのトークンが見つかりません（DISCORD_TOKEN か .dev.vars / .env.local）');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const token = readToken();
  const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };

  const defsPath = path.resolve('03_SYSTEMS/ktm_bot/src/commandDefinitions.js');
  const { COMMAND_DEFINITIONS, validateCommandDefinitions } = await import(pathToFileURL(defsPath).href);
  const problems = validateCommandDefinitions(COMMAND_DEFINITIONS);
  if (problems.length > 0) throw new Error(`定義に問題があります: ${JSON.stringify(problems)}`);

  const me = await (await fetch('https://discord.com/api/v10/users/@me', { headers })).json();
  const appId = me.id;

  const globalCmds = await (await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, { headers })).json();
  const globalNames = new Set((Array.isArray(globalCmds) ? globalCmds : []).map((c) => c.name));
  const guildDefs = COMMAND_DEFINITIONS.filter((d) => !globalNames.has(d.name));

  console.log(`全体向けに登録済み（サーバー向けからは除く）: ${[...globalNames].join(' ') || 'なし'}`);
  console.log(`サーバー向けに登録する: ${guildDefs.map((d) => d.name).join(' ')}`);
  if (!apply) {
    console.log('（表示だけ。実際に登録するには --apply を付けて実行）');
    return;
  }

  const res = await fetch(`https://discord.com/api/v10/applications/${appId}/guilds/${GUILD_ID}/commands`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(guildDefs),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`登録に失敗しました（${res.status}）: ${JSON.stringify(data).slice(0, 300)}`);
  console.log(`登録しました（${res.status}）: ${data.map((c) => c.name).join(' ')}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
