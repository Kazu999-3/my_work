const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('ktm_players').select('name, highest_rank, role_preferences').in('name', ['かずき', 'gori', 'こんぺい']);
  console.log(JSON.stringify(data, null, 2), error);
}
check();
