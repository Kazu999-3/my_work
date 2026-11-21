const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../04_PORTAL/.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const idx = line.indexOf('=');
    if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  });
}

console.log("DISCORD_RESULTS_WEBHOOK_URL:", env.DISCORD_RESULTS_WEBHOOK_URL ? "SET" : "NOT SET");
console.log("DISCORD_WEBHOOK_URL:", env.DISCORD_WEBHOOK_URL ? "SET" : "NOT SET");
console.log("DISCORD_BOT_TOKEN:", env.DISCORD_BOT_TOKEN ? "SET" : "NOT SET");
