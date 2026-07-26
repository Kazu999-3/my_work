const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function trace() {
  const { data, error } = await supabase.from('ktm_match_participants').select('match_id, role, mmr_before, mmr_after').eq('player_name', 'かずき').eq('role', 'JG').order('match_id', { ascending: true });
  console.log(data);
}
trace();
