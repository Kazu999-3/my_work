const SUPABASE_URL = "https://bhohvjlksezkyujroiow.supabase.co";
const SUPABASE_KEY = "sb_publishable_zK4-ZkkBDqbsCjsvKC4iWQ_r64dCIw_";

async function findKazuki() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ktm_players?select=id,discord_id,name,ign,role_preferences`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const players = await res.json();
  console.log("All players in DB:", players.length);
  const matched = players.filter(p => 
    (p.name && p.name.includes("かず")) || 
    (p.ign && p.ign.includes("Kazu")) || 
    (p.ign && p.ign.includes("kaz")) ||
    (p.name && p.name.includes("kazu"))
  );
  console.log("Matched players for 'かずき/Kazu':", JSON.stringify(matched, null, 2));
}

findKazuki();
