import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60; // 項目マージのAI呼び出しを含むため延長

const FAKE_CHAMPIONS = ["", "Unknown", "その他", "[YouTube]", "YouTube", "Jungle", "jg", "lol", "ARTICLE", "draft", "SYSTEM", "LIVE", "GLOBAL", "test", "sns", "macro"];
// 1リクエストあたりの処理記事数。項目マージ(AI呼び出し)が入るため小さめにしてタイムアウトを避ける。
const CHUNK_SIZE = 8;

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
  // ===== 管理者セッション or CRON_SECRET(クラウドワーカー#88用) =====
  const cronOk = !!process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk) {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }
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
      .select('id, title, content, raw_content, champion', { count: 'exact' })
      .or('tags.is.null,tags.not.cs.{__DELETED__}')
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);

    if (fetchError) throw fetchError;

    // チャンピオン単位でグルーピング（同じチャンピオンに複数記事があってもDB往復を1回にまとめるため）
    const byChampion = new Map<string, { title: string; content: string }[]>();
    // 個別の「辞典へ移動」と同じ後処理（champion_notes追加・ライブラリから削除）を行うため、
    // 辞典に振り分けられた記事を控えておく。
    const movedArticles: { id: any; title: string; content: string; champions: string[] }[] = [];

    for (const article of (articles || [])) {
      const rawChamp = article.champion || '';
      const editChampions = rawChamp.split(',').map((c: string) => c.trim()).filter((c: string) => c && c.toLowerCase() !== 'unknown');
      const validChampions = editChampions.filter((c: string) => c && !FAKE_CHAMPIONS.includes(c) && !FAKE_CHAMPIONS.includes(c.toLowerCase()));

      if (validChampions.length === 0) continue;
      const title = article.title || '';
      const content = article.raw_content || article.content || '';

      movedArticles.push({ id: article.id, title, content, champions: validChampions });

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

    // ===== 個別の「辞典へ移動」と同じ後処理 =====
    // 以前は一括同期だと辞典へのマージだけで、champion_notesへの反映もライブラリからの
    // 削除も行われず、同じ記事が何度も同期対象になっていた。個別移動と挙動を揃える。
    let movedCount = 0;
    const moveErrors: string[] = [];
    // 項目マージはAI呼び出しを伴うため、1チャンクあたりの実行数を制限する
    // （全件で回すとサーバーレスのタイムアウトに達する）。溢れた分は次回の同期で処理される。
    let mergeBudget = 5;
    if (movedArticles.length > 0) {
      // 項目マージの実行数を正しく制限するため、並列ではなく逐次で処理する
      for (const a of movedArticles) {
        try {
          // 1) 構造化テーブル champion_notes へ反映（同記事の重複は source_article_id で排除）
          await supabase.from('champion_notes').delete().eq('source_article_id', a.id);
          const rows = a.champions.map((champion) => ({
            champion,
            title: a.title || '(無題)',
            body: a.content,
            source: 'article',
            source_article_id: a.id,
          }));
          if (rows.length > 0) {
            const { error: insErr } = await supabase.from('champion_notes').insert(rows);
            if (insErr) throw new Error(`champion_notes: ${insErr.message}`);
          }

          // 2) 構造化項目（強み/弱み等）も記事内容でマージ更新する（上書きではなく追記）。
          //    件数が多いと時間がかかるため、本文が十分な長さの記事のみ対象。
          if (a.content && a.content.length >= 200 && mergeBudget > 0) {
            mergeBudget--;
            try {
              const origin = new URL(req.url).origin;
              await fetch(`${origin}/api/admin/champion-facts/merge`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  // サーバー間呼び出しのため、受け取ったCookieをそのまま引き継ぐ
                  cookie: req.headers.get('cookie') || '',
                },
                body: JSON.stringify({ champions: a.champions, title: a.title, body: a.content, articleId: a.id }),
              });
            } catch (mergeErr) {
              console.warn(`[knowledge/sync] 記事${a.id}の項目マージに失敗:`, mergeErr);
            }
          }

          // 3) ライブラリからは削除扱いにする（__DELETED__ タグ）
          const { error: delErr } = await supabase
            .from('personal_knowledge').update({ tags: ['__DELETED__'] }).eq('id', a.id);
          if (delErr) throw new Error(`personal_knowledge: ${delErr.message}`);
          movedCount++;
        } catch (moveErr: any) {
          // 握りつぶすと「なぜ失敗したか」が分からなくなるため、理由を集約して返す
          console.warn(`[knowledge/sync] 記事${a.id}の移動処理に失敗:`, moveErr?.message);
          if (moveErrors.length < 3) moveErrors.push(`記事${a.id}: ${moveErr?.message}`);
        }
      }
    }

    const processedCount = (articles || []).length;
    const nextOffset = offset + processedCount;
    const done = processedCount < limit || nextOffset >= (totalArticles || 0);

    return NextResponse.json({
      success: true,
      processed: processedCount,
      moved: movedCount, // 辞典へ移動（＝ライブラリから削除）した記事数
      moveErrors,        // 移動に失敗した理由（最大3件。UIで原因を確認できるように）
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
