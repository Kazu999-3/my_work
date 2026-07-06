const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync("../.env", 'utf8');
const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].replace(/["']/g, '').trim() : '';
};

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseKey = getEnvVar('SUPABASE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const { data, error } = await supabase
      .from('ktm_players')
      .select('id, name')
      .is('name', null);

    if (error) throw error;

    console.log("NULL ktm_players.name count:", data.length);
    if (data.length > 0) {
      console.log("Sample NULL players:", data);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

check();
