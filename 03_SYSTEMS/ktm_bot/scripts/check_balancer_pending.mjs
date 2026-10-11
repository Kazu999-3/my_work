import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../../04_PORTAL/.env.local');
const dotenv = fs.readFileSync(envPath, 'utf8');

const urlMatch = dotenv.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = dotenv.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const url = urlMatch[1].trim().replace(/^['"]|['"]$/g, '');
const key = keyMatch[1].trim().replace(/^['"]|['"]$/g, '');

async function checkPendingTasks() {
  const res = await fetch(`${url}/rest/v1/edge_tasks?task_type=eq.balancer_pending&order=created_at.desc&limit=5`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const tasks = await res.json();
  console.log(`balancer_pending 件数: ${tasks.length}`);
  tasks.forEach(t => {
    console.log(`- ID: ${t.id} | status: ${t.status} | created: ${t.created_at}`);
    console.log(`  Blue:`, t.payload?.balanceResult?.teamBlue?.map((p: any) => p.name));
    console.log(`  Red:`, t.payload?.balanceResult?.teamRed?.map((p: any) => p.name));
  });
}

checkPendingTasks();
