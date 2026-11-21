import { NextResponse } from 'next/server';
import { getDDragonMaster } from '../../../../lib/dataDragonMaster';
import { DDRAGON_FALLBACK_PATCH } from '../../../../lib/ddragonClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. まずローカルのマスター辞書を試行 (高速・オフライン耐性)
    const masterDict = getDDragonMaster();
    if (masterDict?.champions) {
      const champions = Object.values(masterDict.champions).map((c: any) => ({
        id: c.id,
        name: c.name_ja || c.name || c.id,
      }));

      return NextResponse.json(
        { ok: true, count: champions.length, champions },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
          },
        }
      );
    }

    // 2. ローカル辞書がない場合は DDragon 公式 CDN にフォールバック
    let latestPatch = DDRAGON_FALLBACK_PATCH;
    try {
      const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', { next: { revalidate: 86400 } });
      if (vRes.ok) {
        const versions = await vRes.json();
        if (Array.isArray(versions) && versions.length > 0) {
          latestPatch = versions[0];
        }
      }
    } catch {
      // フォールバック継続
    }

    const cRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestPatch}/data/ja_JP/champion.json`, { next: { revalidate: 86400 } });
    if (!cRes.ok) {
      throw new Error(`DDragon fetch failed with status: ${cRes.status}`);
    }

    const cData = await cRes.json();
    const champions = Object.values(cData.data || {}).map((c: any) => ({
      id: c.id,
      name: c.name,
    }));

    return NextResponse.json(
      { ok: true, count: champions.length, champions },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
        },
      }
    );
  } catch (err: any) {
    console.error('[/api/riot/champions] Failed to fetch champions:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to load champions' },
      { status: 500 }
    );
  }
}
