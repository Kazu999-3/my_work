import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// yt-dlp 実行ファイルのパス解決
function getYtdlpPath(): string {
  try {
    const parts = ['d:', 'my_work', '.venv', 'Scripts', 'yt-dlp.exe'];
    const directPath = parts.join(path.sep);
    if (fs.existsSync(directPath)) return directPath;
  } catch {}
  return 'yt-dlp';
}

interface YtdlpVideo {
  id: string;
  title: string;
  url?: string;
  webpage_url?: string;
  duration?: number;
  uploader?: string;
  channel?: string;
}

function searchYoutubeVideos(query: string, maxResults = 3): Promise<YtdlpVideo[]> {
  const ytdlp = getYtdlpPath();
  return new Promise((resolve) => {
    execFile(
      ytdlp,
      [`ytsearch${maxResults}:${query}`, '--dump-json', '--flat-playlist'],
      { timeout: 35000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          console.warn(`[yt-dlp search error for "${query}"]:`, error.message);
          return resolve([]);
        }
        const lines = (stdout || '').trim().split('\n').filter(Boolean);
        const results: YtdlpVideo[] = [];
        for (const line of lines) {
          try {
            results.push(JSON.parse(line));
          } catch {
            // ignore JSON parse error for individual line
          }
        }
        resolve(results);
      }
    );
  });
}

// ─────────────────────────────────────────────────────────────
// GET: 未開拓チャンピオン一覧と統計の取得
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアント未初期化' }, { status: 500 });
    }

    // 1. champions_summary.json を読み込み
    const summaryPath = path.resolve(process.cwd(), 'src/data/champions_summary.json');
    let champions: any[] = [];
    if (fs.existsSync(summaryPath)) {
      champions = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    }

    // 2. personal_knowledge から最新の記事数を集計
    const { data: pkData, error: pkErr } = await supabase
      .from('personal_knowledge')
      .select('champion');

    if (pkErr) throw pkErr;

    const countMap: Record<string, number> = {};
    (pkData || []).forEach((row: { champion: string | null }) => {
      if (row.champion) {
        const champKey = row.champion.toLowerCase();
        countMap[champKey] = (countMap[champKey] || 0) + 1;
      }
    });

    // 3. キュー（youtube_queue）に待機中・処理中の動画数もチェック
    const { data: queueData } = await supabase
      .from('youtube_queue')
      .select('title')
      .in('status', ['pending', 'running', 'processing']);

    const queueTitles = (queueData || []).map((q: { title: string }) => q.title.toLowerCase());

    // 4. 各チャンピオンの統計を結合
    const enriched = champions.map((c: any) => {
      const champKey = c.id.toLowerCase();
      const articleCount = countMap[champKey] || 0;
      // キューに入っているか簡易判定
      const hasPendingQueue = queueTitles.some((t: string) =>
        t.includes(c.id.toLowerCase()) || (c.jpName && t.includes(c.jpName.toLowerCase()))
      );

      return {
        id: c.id,
        name: c.name,
        jpName: c.jpName,
        roles: c.roles || [],
        articleCount,
        hasPendingQueue,
      };
    });

    // 未開拓（記事0件）
    const zeroArticles = enriched.filter((c: any) => c.articleCount === 0);
    // 少数（1件のみ）
    const lowArticles = enriched.filter((c: any) => c.articleCount === 1);

    // ロール別集計 ('TOP', 'JG', 'MID', 'BOT', 'SUP')
    const roles = ['TOP', 'JG', 'MID', 'BOT', 'SUP'];
    const roleStats: Record<string, { total: number; zero: number }> = {};
    roles.forEach((r) => {
      const inRole = enriched.filter((c: any) => c.roles.includes(r));
      const zeroInRole = inRole.filter((c: any) => c.articleCount === 0);
      roleStats[r] = { total: inRole.length, zero: zeroInRole.length };
    });

    return NextResponse.json({
      success: true,
      totalChampions: enriched.length,
      zeroCount: zeroArticles.length,
      lowCount: lowArticles.length,
      roleStats,
      zeroArticles: zeroArticles.sort((a: any, b: any) => a.jpName.localeCompare(b.jpName)),
      lowArticles: lowArticles.sort((a: any, b: any) => a.jpName.localeCompare(b.jpName)),
    });
  } catch (e: any) {
    console.error('[scout-champion] GET Error:', e);
    return NextResponse.json({ error: e.message || '取得に失敗しました' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// POST: 未開拓チャンピオンの解説動画をオンデマンド検索＆キュー投入
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアント未初期化' }, { status: 500 });
    }

    const body = await req.json();
    const { championId, limit = 2, action, role } = body;

    // ─────────────────────────────────────────────────────────
    // 一括補給アクション (action === 'batch')
    // ─────────────────────────────────────────────────────────
    if (action === 'batch') {
      const summaryPath = path.resolve(process.cwd(), 'src/data/champions_summary.json');
      let champions: any[] = [];
      if (fs.existsSync(summaryPath)) {
        champions = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      }

      const { data: pkData } = await supabase.from('personal_knowledge').select('champion');
      const countMap: Record<string, number> = {};
      (pkData || []).forEach((row: { champion: string | null }) => {
        if (row.champion) countMap[row.champion.toLowerCase()] = (countMap[row.champion.toLowerCase()] || 0) + 1;
      });

      // 記事0件かつ指定ロール（あれば）のチャンピオンを最大3〜5体選定
      let targets = champions.filter((c: any) => (countMap[c.id.toLowerCase()] || 0) === 0);
      if (role && role !== 'ALL') {
        const normRole = role === 'ADC' ? 'BOT' : role === 'JUNGLE' ? 'JG' : role === 'SUPPORT' ? 'SUP' : role;
        targets = targets.filter((c: any) => c.roles?.includes(normRole) || c.roles?.includes(role));
      }
      targets = targets.slice(0, 3); // 一度に過大な負荷を避けるため最大3体

      const addedList: any[] = [];

      for (const t of targets) {
        const query = `LoL ${t.id} guide high elo`;
        const videos = await searchYoutubeVideos(query, 2);

        for (const v of videos) {
          const videoId = v.id;
          if (!videoId) continue;
          const url = v.url || v.webpage_url || `https://www.youtube.com/watch?v=${videoId}`;

          // 重複チェック
          const { data: existing } = await supabase
            .from('youtube_queue')
            .select('id')
            .eq('id', videoId)
            .maybeSingle();

          if (existing) continue;

          const payload = {
            id: videoId,
            title: v.title,
            url,
            status: 'pending',
            channel_name: v.uploader || v.channel || `[Scout] ${t.jpName}`,
            duration_sec: v.duration || null,
            date_added: Math.floor(Date.now() / 1000),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { error: insErr } = await supabase.from('youtube_queue').insert(payload);
          if (!insErr) {
            addedList.push({ champion: t.jpName, ...payload });
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `${targets.length}体の未開拓チャンピオンから計${addedList.length}本の解説動画をキューに追加しました`,
        addedCount: addedList.length,
        addedVideos: addedList,
      });
    }

    // ─────────────────────────────────────────────────────────
    // 個別チャンピオン補給アクション
    // ─────────────────────────────────────────────────────────
    if (!championId || typeof championId !== 'string') {
      return NextResponse.json({ error: 'championId が必要です' }, { status: 400 });
    }

    const query = `LoL ${championId} guide high elo`;
    const videos = await searchYoutubeVideos(query, limit);

    if (!videos || videos.length === 0) {
      return NextResponse.json({
        success: false,
        message: `${championId} の解説動画が見つかりませんでした`,
        addedCount: 0,
      });
    }

    const addedList: any[] = [];

    for (const v of videos) {
      const videoId = v.id;
      if (!videoId) continue;
      const url = v.url || v.webpage_url || `https://www.youtube.com/watch?v=${videoId}`;

      // 重複チェック
      const { data: existing } = await supabase
        .from('youtube_queue')
        .select('id')
        .eq('id', videoId)
        .maybeSingle();

      if (existing) continue;

      const payload = {
        id: videoId,
        title: v.title,
        url,
        status: 'pending',
        channel_name: v.uploader || v.channel || `[Scout] ${championId}`,
        duration_sec: v.duration || null,
        date_added: Math.floor(Date.now() / 1000),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: insErr } = await supabase.from('youtube_queue').insert(payload);
      if (!insErr) {
        addedList.push(payload);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${championId} の解説動画を ${addedList.length} 本キューに追加しました`,
      addedCount: addedList.length,
      addedVideos: addedList,
    });
  } catch (e: any) {
    console.error('[scout-champion] POST Error:', e);
    return NextResponse.json({ error: e.message || 'スカウト処理に失敗しました' }, { status: 500 });
  }
}
