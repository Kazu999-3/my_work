import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { getChampionSearchVariations } from '../../../lib/championNames';

// ============================================================
// 横断検索 (課題: 辞典 + 攻略ライブラリ + マッチアップメモ を1つの検索窓で)
//
// これまで知識が3箇所に分散していた:
//   ・チャンピオン辞典/マッチアップメモ … matchup_sentinel (enemy=GLOBAL が辞典、それ以外が対面メモ)
//   ・攻略ライブラリ/ナレッジ           … personal_knowledge
// このAPIはキーワード1つで両テーブルを横断検索し、種別ごとに整形して返す。
// 読み取り専用（anonキー）。
// ============================================================

export const dynamic = 'force-dynamic';

function snippet(text: string | null, q: string, len = 160): string {
  if (!text) return '';
  const clean = text.replace(/[#*`>|]/g, '').replace(/\s+/g, ' ').trim();
  const idx = clean.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return clean.slice(0, len);
  const start = Math.max(0, idx - 40);
  return (start > 0 ? '…' : '') + clean.slice(start, start + len);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 2) {
      return NextResponse.json({ results: [], message: '2文字以上で検索してください。' });
    }

    // チャンピオン名の表記揺れを展開（Graves/グレイブス 等）
    const variations = Array.from(new Set([q, ...getChampionSearchVariations(q)]));
    const like = (col: string) => variations.map((v) => `${col}.ilike.%${v}%`).join(',');

    const [knowledgeRes, sentinelRes] = await Promise.all([
      supabase
        .from('personal_knowledge')
        .select('id, title, content, raw_content, champion, tags, created_at')
        .or(`${like('title')},${like('content')},${like('champion')}`)
        .not('tags', 'cs', '{__DELETED__}')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('matchup_sentinel')
        .select('id, matchup_id, champion, enemy, title, strategy')
        .or(`${like('champion')},${like('enemy')},${like('title')},${like('strategy')}`)
        .not('strategy', 'is', null)
        .not('strategy', 'eq', '')
        .limit(30),
    ]);

    const results: any[] = [];

    for (const k of knowledgeRes.data || []) {
      if (k.tags && Array.isArray(k.tags) && k.tags.includes('__DELETED__')) continue;
      results.push({
        source: 'ナレッジ',
        title: k.title,
        champion: k.champion && k.champion !== 'Unknown' ? k.champion : null,
        snippet: snippet(k.raw_content || k.content, q),
        url: `/admin/knowledge?article=${k.id}`,
        date: k.created_at,
      });
    }

    for (const s of sentinelRes.data || []) {
      const isDict = s.enemy === 'GLOBAL' || (s.matchup_id || '').includes('GLOBAL');
      results.push({
        source: isDict ? 'チャンピオン辞典' : 'マッチアップメモ',
        title: s.title || `${s.champion}${isDict ? ' 基本戦略' : ` vs ${s.enemy}`}`,
        champion: s.champion,
        enemy: isDict ? null : s.enemy,
        snippet: snippet(s.strategy, q),
        url: `/champions?select=${encodeURIComponent(s.champion)}`,
        date: null,
      });
    }

    return NextResponse.json({ query: q, count: results.length, results });
  } catch (err: any) {
    console.error('[search] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
