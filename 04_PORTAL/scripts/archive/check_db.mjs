import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bhohvjlksezkyujroiow.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function simulateAPI(genre, queryStr) {
  try {
    let dbQuery = supabase.from('personal_knowledge').select('*');

    if (genre && genre !== 'all') {
      dbQuery = dbQuery.eq('genre', genre);
    }

    // queryStrが「空文字」や「null」の場合のシミュレーション
    if (queryStr) {
      dbQuery = dbQuery.or(`title.ilike.%${queryStr}%,content.ilike.%${queryStr}%,raw_content.ilike.%${queryStr}%`);
    }

    dbQuery = dbQuery.order('created_at', { ascending: false });

    const { data, error } = await dbQuery;
    if (error) throw error;
    console.log(`[API Sim] genre='${genre}', query='${queryStr}' => 件数: ${data.length} 件`);
    if (data.length > 0) {
      console.log(`[API Sim] 先頭データのタイトル: "${data[0].title}", ジャンル: "${data[0].genre}"`);
    }
  } catch (err) {
    console.error('❌ シミュレーションエラー:', err);
  }
}

async function run() {
  try {
    const { data: nullContent, error: err1 } = await supabase
      .from('personal_knowledge')
      .select('*')
      .is('content', null);

    if (err1) throw err1;
    console.log(`[Null Check] contentがnullのレコード数: ${nullContent.length} 件`);
    if (nullContent.length > 0) {
      console.log('サンプル:', JSON.stringify(nullContent.slice(0, 3), null, 2));
    }

    const { data: nullTitle, error: err2 } = await supabase
      .from('personal_knowledge')
      .select('*')
      .is('title', null);
    if (err2) throw err2;
    console.log(`[Null Check] titleがnullのレコード数: ${nullTitle.length} 件`);

  } catch (e) {
    console.error(e);
  }
}

run();
