import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FAKE_CHAMPIONS = ["", "Unknown", "その他", "[YouTube]", "YouTube", "Jungle", "jg", "lol", "ARTICLE", "draft", "SYSTEM", "LIVE", "GLOBAL", "test", "sns", "macro"];
const CHUNK_SIZE = 15; // 1リクエストあたりの処理記事数（Vercelのサーバーレスタイムアウトを避けるため）

// ==========================================================================
// 攻略ライブラリ(personal_knowledge) → チャンピオン辞典(matchup_sentinel) 一括同期
//
// 【改善前の問題点】
// 1. 進捗が見えない: 全記事を1回のリクエストで直列処理していたため、記事数が
//    多いと数十秒〜タイムアウトするまで画面には「同期中...」しか表示されず、
//    今どこまで進んでいるのか・完了したのかが分からなかった。
// 2. 低速: 記事 × チャンピオンの組み合わせごとに select→upsert を直列実行して
//    いたため、同じチャンピオンに紐づく記事が複数あってもDB往復が毎回発生していた。
// 3. 削除済み記事の再処理: __DELETED__ タグが付いた記事も除外されておらず、
//    実行するたびに無駄な処理が発生していた。
//
// 【今回の変更】
// - offset/limit によるチャンク処理に変更し、クライアント側で進捗(N/M件)を
//   表示しながら繰り返し呼び出せるようにした。
// - チャンク内では記事をチャンピオン単位でグルーピングし、対象チャンピオンごとに
//   select→マージ→upsert を1回にまとめて実行（Promise.allで並列化）。
// - __DELETED__ タグの記事はクエリ側で除外。
// ==========================================================================
export async function POST(req: Request) {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

  if (!supabaseKey) {
    return NextResponse.json({ error: 'Supabase Service Role Key is not configured' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const offset = Number.isFinite(body?.offset) ? Number(body.offset) : 0;
    const limit = Number.isFinite(body?.limit) ? Number(body.limit) : CHUNK_SIZE;

    // __DELETED__ 済みの記事は同期対象から除外し、無駄な再処理を防ぐ
    // （tagsがNULLの記事まで誤って除外しないよう、is.null との or 条件にしている）
    const { data: articles, error: fetchError, count: totalArticles } = await supabase
      .from('personal_knowledge')
      .select('title, content, raw_content, champion', { count: 'exact' })
      .or('tags.is.null,tags.not.cs.{__DELETED__}')
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);

    if (fetchError) throw fetchError;

    // チャンピオン単位でグルーピング（同じチャンピオンに複数記事があってもDB往復を1回にまとめるため）
    const byChampion = new Map<string, { title: string; content: string }[]>();
    for (const article of (articles || [])) {
      const rawChamp = article.champion || '';
      const editChampions = rawChamp.split(',').map((c: string) => c.trim()).filter((c: string) => c && c.toLowerCase() !== 'unknown');
      const validChampions = editChampions.filter((c: string) => c && !FAKE_CHAMPIONS.includes(c) && !FAKE_CHAMPIONS.includes(c.toLowerCase()));

      if (validChampions.length === 0) continue;
      const title = article.title || '';
      const content = article.raw_content || article.content || '';

      for (const championName of validChampions) {
        const list = byChampion.get(championName) || [];
        list.push({ title, content });
        byChampion.set(championName, list);
      }
    }

    // チャンピオンごとに並列で select → マージ → upsert
    let syncedChampionCount = 0;
    await Promise.all(Array.from(byChampion.entries()).map(async ([championName, items]) => {
      const matchupId = `champ_${championName}_global`;

      const { data: existingData } = await supabase
        .from('matchup_sentinel')
        .select('raw_data, strategy')
        .eq('matchup_id', matchupId)
        .maybeSingle();

      const rawData = existingData?.raw_data || {};
      let newStrategy = existingData?.strategy || '';

      const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // このチャンク内の同一チャンピオン向け記事をまとめて1本の strategy にマージ
      for (const { title, content } of items) {
        const header = `## 【記事】${title}`;
        if (!newStrategy.trim()) {
          newStrategy = `${header}\n\n${content}`;
        } else if (newStrategy.includes(header)) {
          const pattern = new RegExp(`## 【記事】${escapeRegExp(title)}\\s*\\n[\\s\\S]*?(?=\\n---|$)`);
          newStrategy = newStrategy.replace(pattern, `${header}\n\n${content}`);
        } else {
          newStrategy = `${newStrategy}\n\n---\n\n${header}\n\n${content}`;
        }
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
      syncedChampionCount++;
    }));

    const processedCount = (articles || []).length;
    const nextOffset = offset + processedCount;
    const done = processedCount < limit || nextOffset >= (totalArticles || 0);

    return NextResponse.json({
      success: true,
      processed: processedCount,
      syncedChampions: syncedChampionCount,
      totalArticles: totalArticles || 0,
      nextOffset: done ? null : nextOffset,
      done
    });
  } catch (err: any) {
    console.error('Sync Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
