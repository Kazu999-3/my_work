import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { normalizeLoLTerms } from '../../../../../lib/dataDragonMaster';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FACT_FIELDS = [
  'strengths',
  'weaknesses',
  'power_spikes',
  'build_runes',
  'strategy',
  'must_ban_champions',
  'pick_recommendation',
] as const;

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { dryRun = false } = await req.json().catch(() => ({ dryRun: false }));

    let factsUpdated = 0;
    let matchupsUpdated = 0;
    let knowledgeUpdated = 0;
    const diffSamples: Array<{ table: string; key: string; field: string; before: string; after: string }> = [];

    // 1. champion_facts のクレンジング
    const { data: facts, error: factsErr } = await supabase
      .from('champion_facts')
      .select('*');

    if (!factsErr && Array.isArray(facts)) {
      for (const fact of facts) {
        const champ = fact.champion;
        let hasDiff = false;
        const updates: Record<string, string> = {};

        for (const field of FACT_FIELDS) {
          const original = fact[field];
          if (typeof original === 'string' && original.trim()) {
            const normalized = normalizeLoLTerms(original, champ);
            if (normalized !== original) {
              hasDiff = true;
              updates[field] = normalized;
              if (diffSamples.length < 15) {
                diffSamples.push({
                  table: 'champion_facts',
                  key: `${champ} (${fact.role || 'GLOBAL'})`,
                  field,
                  before: original.slice(0, 100),
                  after: normalized.slice(0, 100),
                });
              }
            }
          }
        }

        if (hasDiff) {
          factsUpdated++;
          if (!dryRun) {
            updates.updated_at = new Date().toISOString();
            await supabase
              .from('champion_facts')
              .update(updates)
              .eq('id', fact.id);
          }
        }
      }
    }

    // 2. matchup_sentinel のクレンジング
    const { data: matchups, error: matchupsErr } = await supabase
      .from('matchup_sentinel')
      .select('id, matchup_id, champion, enemy, title, strategy');

    if (!matchupsErr && Array.isArray(matchups)) {
      for (const m of matchups) {
        const champ = m.champion || '';
        let hasDiff = false;
        const updates: Record<string, string> = {};

        if (typeof m.title === 'string' && m.title.trim()) {
          const normalizedTitle = normalizeLoLTerms(m.title, champ);
          if (normalizedTitle !== m.title) {
            hasDiff = true;
            updates.title = normalizedTitle;
            if (diffSamples.length < 15) {
              diffSamples.push({
                table: 'matchup_sentinel',
                key: m.matchup_id || String(m.id),
                field: 'title',
                before: m.title.slice(0, 100),
                after: normalizedTitle.slice(0, 100),
              });
            }
          }
        }

        if (typeof m.strategy === 'string' && m.strategy.trim()) {
          const normalizedStrategy = normalizeLoLTerms(m.strategy, champ);
          if (normalizedStrategy !== m.strategy) {
            hasDiff = true;
            updates.strategy = normalizedStrategy;
            if (diffSamples.length < 15) {
              diffSamples.push({
                table: 'matchup_sentinel',
                key: m.matchup_id || String(m.id),
                field: 'strategy',
                before: m.strategy.slice(0, 100),
                after: normalizedStrategy.slice(0, 100),
              });
            }
          }
        }

        if (hasDiff) {
          matchupsUpdated++;
          if (!dryRun) {
            await supabase
              .from('matchup_sentinel')
              .update(updates)
              .eq('id', m.id);
          }
        }
      }
    }

    // 3. personal_knowledge (攻略ライブラリ) のクレンジング
    const { data: articles, error: articlesErr } = await supabase
      .from('personal_knowledge')
      .select('id, champion, title, content');

    if (!articlesErr && Array.isArray(articles)) {
      for (const a of articles) {
        const champ = a.champion || '';
        let hasDiff = false;
        const updates: Record<string, string> = {};

        if (typeof a.title === 'string' && a.title.trim()) {
          const normalizedTitle = normalizeLoLTerms(a.title, champ);
          if (normalizedTitle !== a.title) {
            hasDiff = true;
            updates.title = normalizedTitle;
          }
        }

        if (typeof a.content === 'string' && a.content.trim()) {
          const normalizedContent = normalizeLoLTerms(a.content, champ);
          if (normalizedContent !== a.content) {
            hasDiff = true;
            updates.content = normalizedContent;
          }
        }

        if (hasDiff) {
          knowledgeUpdated++;
          if (!dryRun) {
            await supabase
              .from('personal_knowledge')
              .update(updates)
              .eq('id', a.id);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        factsUpdated,
        matchupsUpdated,
        knowledgeUpdated,
        totalUpdates: factsUpdated + matchupsUpdated + knowledgeUpdated,
      },
      diffSamples,
    });
  } catch (err: any) {
    console.error('cleanse-terms error:', err);
    return NextResponse.json({ error: err.message || '用語正規化処理に失敗しました' }, { status: 500 });
  }
}
