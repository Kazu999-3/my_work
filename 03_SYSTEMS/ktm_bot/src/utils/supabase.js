/** 
 * Supabase への軽量なRESTアクセスユーティリティ (Cloudflare Workers用)
 */

export async function fetchSupabase(env, table, query = "", method = "GET", body = null) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
  const headers = {
    "apikey": env.SUPABASE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase Error (${method} ${table}): ${res.status} ${errText}`);
  }
  
  if (method !== "DELETE") {
    return await res.json();
  }
  return null;
}

export async function getPlayersByNames(env, names) {
  if (!names || names.length === 0) return [];
  // PostgREST で in 句を使って取得
  const namesStr = names.map(n => `"${encodeURIComponent(n)}"`).join(',');
  const query = `name=in.(${namesStr})`;
  return await fetchSupabase(env, 'ktm_players', query);
}

export async function upsertPlayer(env, player) {
  const headers = {
    "apikey": env.SUPABASE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };

  let url;
  let method;
  
  // 送信用のペイロードをコピーして作成
  const payload = { ...player };

  if (player.id) {
    url = `${env.SUPABASE_URL}/rest/v1/ktm_players?id=eq.${player.id}`;
    method = "PATCH";
    // UPDATE時にGENERATED ALWAYSのカラムが含まれているとエラーになるため削除
    delete payload.id;
    delete payload.created_at;
  } else {
    url = `${env.SUPABASE_URL}/rest/v1/ktm_players`;
    method = "POST";
  }
  
  const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase ${method} Error: ${res.status} ${errText}`);
  }
  return await res.json();
}
