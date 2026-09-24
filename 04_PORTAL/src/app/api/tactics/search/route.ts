import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export interface TacticsSearchResult {
  id: string;
  type: 'bible' | 'video';
  champion: string;
  championJa: string;
  section: string;
  title: string;
  snippet: string;
  tags: string[];
  score: number;
}

// チャンピオン名英語 ➔ 日本語辞書（主要）
const CHAMPION_JA: Record<string, string> = {
  Aatrox: 'エイトロックス', Akali: 'アカリ', Akshan: 'アクシャン', Alistar: 'アリスター',
  Ambessa: 'アンベッサ', Amumu: 'アムム', Belveth: 'ベル＝ヴェス', Brand: 'ブランド',
  Caitlyn: 'ケイトリン', Darius: 'ダリウス', Diana: 'ダイアナ', Fiora: 'フィオラ',
  Graves: 'グレイブス', JarvanIV: 'ジャーヴァンIV', Jax: 'ジャックス', Khazix: 'カ＝ジックス',
  Kindred: 'キンドレッド', LeeSin: 'リー・シン', Lillia: 'リリア', MonkeyKing: 'ウーコン',
  Nocturne: 'ノクターン', Renekton: 'レネクトン', Shyvana: 'シヴァーナ', Talon: 'タロン',
  Vi: 'ヴァイ', Viego: 'ヴィエゴ', XinZhao: 'シン・ジャオ', Yorick: 'ヨリック',
  Yuumi: 'ユーミ', Zyra: 'ザイラ'
};

function extractSnippet(text: string, keyword: string, snippetLength = 120): string {
  const lowerText = text.toLowerCase();
  const lowerKw = keyword.toLowerCase();
  const idx = lowerText.indexOf(lowerKw);
  if (idx === -1) {
    return text.slice(0, snippetLength).trim() + (text.length > snippetLength ? '...' : '');
  }

  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + lowerKw.length + snippetLength - 40);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

interface CachedTacticsItem {
  id: string;
  type: 'bible' | 'video';
  champion: string;
  championJa: string;
  section: string;
  title: string;
  body: string;
  fullTextLower: string;
  headerLower: string;
  tags: string[];
}

// インメモリキャッシュ (TTL: 5分)
let cachedItems: CachedTacticsItem[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function loadTacticsItems(repoRoot: string): CachedTacticsItem[] {
  const now = Date.now();
  if (cachedItems && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedItems;
  }

  const items: CachedTacticsItem[] = [];
  const tacticsDir = path.join(repoRoot, '01_INTEL', 'tactics');
  const kireiDir = path.join(repoRoot, '02_FACTORY', '_LOL', 'bible', 'kirei_bible');

  // 1. 戦術バイブル（01_INTEL/tactics/）を走査
  if (fs.existsSync(tacticsDir)) {
    const files = fs.readdirSync(tacticsDir).filter(f => f.endsWith('_tactics_bible.md'));
    for (const f of files) {
      const filePath = path.join(tacticsDir, f);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const champIdMatch = f.match(/^([a-z0-9]+)_tactics_bible\.md$/i);
        const rawChampId = champIdMatch ? champIdMatch[1] : '';
        const champKey = Object.keys(CHAMPION_JA).find(
          k => k.toLowerCase() === rawChampId.toLowerCase()
        ) || rawChampId;
        const champJa = CHAMPION_JA[champKey] || champKey;

        // セクション単位に分割 (## 見出し)
        const sections = raw.split(/\n(?=##\s+)/);
        for (const sec of sections) {
          const lines = sec.trim().split('\n');
          const header = lines[0].replace(/^##\s+/, '').trim();
          const body = lines.slice(1).join('\n');

          items.push({
            id: `bible-${rawChampId}-${header.slice(0, 20)}`,
            type: 'bible',
            champion: champKey,
            championJa: champJa,
            section: header,
            title: `${champJa} (${champKey}) - ${header}`,
            body,
            fullTextLower: sec.toLowerCase(),
            headerLower: header.toLowerCase(),
            tags: ['戦術バイブル', champJa, header.split(' ')[0]],
          });
        }
      } catch (err) {
        console.warn(`[tactics/search] Failed to load ${f}:`, err);
      }
    }
  }

  // 2. Kirei Bible（02_FACTORY/_LOL/bible/kirei_bible/INDEX.md）を走査
  const kireiIndex = path.join(kireiDir, 'INDEX.md');
  if (fs.existsSync(kireiIndex)) {
    try {
      const kireiRaw = fs.readFileSync(kireiIndex, 'utf-8');
      const lines = kireiRaw.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('- [') && !line.startsWith('* [')) continue;

        const titleMatch = line.match(/\[(.*?)\]\((.*?)\)/);
        const title = titleMatch ? titleMatch[1] : line;
        const champName = line.match(/\b([A-Z][a-zA-Z]+)\b/)?.[1] || 'LoL';

        items.push({
          id: `video-kirei-${i}`,
          type: 'video',
          champion: champName,
          championJa: CHAMPION_JA[champName] || champName,
          section: '動画解析Tips',
          title: `実演解析: ${title}`,
          body: line.replace(/^[-*]\s*/, ''),
          fullTextLower: line.toLowerCase(),
          headerLower: title.toLowerCase(),
          tags: ['動画Tips', champName],
        });
      }
    } catch (err) {
      console.warn('[tactics/search] Failed to load kirei index:', err);
    }
  }

  cachedItems = items;
  lastCacheTime = now;
  return items;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').trim();
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));

    if (!query || query.length < 2) {
      return NextResponse.json({
        query,
        total: 0,
        results: [],
        message: '2文字以上の検索キーワードを入力してください'
      });
    }

    const repoRoot = path.resolve(process.cwd(), '..');
    const items = loadTacticsItems(repoRoot);

    const results: TacticsSearchResult[] = [];
    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery.split(/\s+/).filter(Boolean);

    for (const item of items) {
      let score = 0;
      let matched = false;

      for (const w of queryWords) {
        if (item.headerLower.includes(w)) {
          score += 15;
          matched = true;
        }
        if (item.fullTextLower.includes(w)) {
          const count = item.fullTextLower.split(w).length - 1;
          score += Math.min(10, count * 3);
          matched = true;
        }
      }

      // チャンピオン名（英・日）がヒットした場合
      if (item.champion.toLowerCase().includes(lowerQuery) || item.championJa.includes(lowerQuery)) {
        score += 8;
        matched = true;
      }

      if (matched && score > 0) {
        results.push({
          id: item.id,
          type: item.type,
          champion: item.champion,
          championJa: item.championJa,
          section: item.section,
          title: item.title,
          snippet: extractSnippet(item.body || item.section, queryWords[0] || query),
          tags: item.tags,
          score,
        });
      }
    }

    // スコア降順ソート
    results.sort((a, b) => b.score - a.score);

    const paginated = results.slice(0, limit);

    return NextResponse.json({
      success: true,
      query,
      total: results.length,
      limit,
      results: paginated,
      cached: Date.now() - lastCacheTime < CACHE_TTL_MS,
    });
  } catch (err: any) {
    console.error('[tactics/search] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
