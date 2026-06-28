import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
  
  if (!supabaseKey) {
    return NextResponse.json({ error: 'Supabase Service Role Key is not configured' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: articles, error: fetchError } = await supabase
      .from('personal_knowledge')
      .select('title, content, raw_content, champion');

    if (fetchError) throw fetchError;

    let syncCount = 0;
    const fakeChampions = ["", "Unknown", "その他", "[YouTube]", "YouTube", "Jungle", "jg", "lol", "ARTICLE", "draft", "SYSTEM", "LIVE", "GLOBAL", "test", "sns", "macro"];

    for (const article of (articles || [])) {
      const rawChamp = article.champion || '';
      const editChampions = rawChamp.split(',').map((c: string) => c.trim()).filter((c: string) => c && c.toLowerCase() !== 'unknown');
      const validChampions = editChampions.filter((c: string) => c && !fakeChampions.includes(c) && !fakeChampions.includes(c.toLowerCase()));

      if (validChampions.length > 0) {
        const title = article.title || '';
        const content = article.raw_content || article.content || '';

        for (const championName of validChampions) {
          const matchupId = `champ_${championName}_global`;
          
          const { data: existingData } = await supabase
            .from('matchup_sentinel')
            .select('raw_data, strategy')
            .eq('matchup_id', matchupId)
            .maybeSingle();

          const rawData = existingData?.raw_data || {};
          const existingStrategy = existingData?.strategy || '';

          const header = `## 【記事】${title}`;
          let newStrategy = existingStrategy;

          if (!existingStrategy.trim()) {
            newStrategy = `${header}\n\n${content}`;
          } else if (existingStrategy.includes(header)) {
            const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`## 【記事】${escapeRegExp(title)}\\s*\\n[\\s\\S]*?(?=\\n---|$)`);
            newStrategy = existingStrategy.replace(pattern, `${header}\n\n${content}`);
          } else {
            newStrategy = `${existingStrategy}\n\n---\n\n${header}\n\n${content}`;
          }

          const { error: upsertError } = await supabase.from('matchup_sentinel').upsert({
            matchup_id: matchupId,
            champion: championName,
            enemy: 'GLOBAL',
            strategy: newStrategy,
            raw_data: {
              ...rawData,
              source: 'champ_db',
              role: 'GLOBAL'
            }
          }, { onConflict: 'matchup_id' });
          
          if (upsertError) throw upsertError;
          syncCount++;
        }
      }
    }

    return NextResponse.json({ success: true, synced: syncCount });
  } catch (err: any) {
    console.error('Sync Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}