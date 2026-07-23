import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.RIOT_API_KEY;
    
    // Supabaseの全プレイヤー情報を取得
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name, riot_id, discord_id, puuid')
      .not('puuid', 'is', null);

    if (error || !players || players.length === 0) {
      // フォールバック用サンプルデータ
      return NextResponse.json({
        ranking: [
          {
            rank: 1,
            player_name: "Kazu999",
            title: "ドラゴンバースト神",
            description: "エピックモンスター横取り回数が日本上位 0.05%",
            percentile_display: "上位 0.05%",
            level: "CHALLENGER"
          },
          {
            rank: 2,
            player_name: "MemberB",
            title: "ノーデス完全勝利",
            description: "デス数0での勝利達成率が上位 0.12%",
            percentile_display: "上位 0.12%",
            level: "GRANDMASTER"
          }
        ]
      });
    }

    // 各プレイヤーの Riot Challenges API データを並列取得
    const rankingResults: any[] = [];
    const patch = '14.10.1';
    
    // DDragonのチャレンジ日本語名マスターデータを取得
    let challengeMeta: Record<number, any> = {};
    try {
      const metaRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${patch}/data/ja_JP/challenges.json`, { next: { revalidate: 86400 } });
      if (metaRes.ok) {
        const metaList = await metaRes.json();
        metaList.forEach((item: any) => {
          challengeMeta[item.id] = item;
        });
      }
    } catch (e) {
      console.warn('Failed to fetch DDragon challenge meta:', e);
    }

    await Promise.all(
      players.map(async (player: any) => {
        if (!player.puuid || !apiKey) return;
        try {
          const res = await fetch(`https://jp1.api.riotgames.com/lol/challenge/v1/player-data/${player.puuid}`, {
            headers: { 'X-Riot-Token': apiKey },
            next: { revalidate: 3600 }
          });
          if (!res.ok) return;
          const cData = await res.json();
          if (!cData.challenges) return;

          let bestChallenge: any = null;
          for (const item of cData.challenges) {
            const p = item.percentile;
            if (p > 0 && p <= 0.3 && item.level !== 'NONE') {
              if (!bestChallenge || p < bestChallenge.percentile) {
                const meta = challengeMeta[item.challengeId] || {};
                // position (順位) が存在すればそれを使い、無ければパーセンタイル(上位%)と想定アクティブ数(約10万人)から概算順位を算出
                const explicitRank = item.position || (item.rank ? item.rank : null);
                const estimatedRank = Math.max(1, Math.round(p * 120000));
                const nationalRank = explicitRank || estimatedRank;

                bestChallenge = {
                  challengeId: item.challengeId,
                  name: meta.name || '激レア実績',
                  description: meta.shortDescription || meta.description || '特別な実績を達成しました',
                  percentile: p,
                  top_percent_display: `上位 ${(p * 100).toFixed(2)}%`,
                  level: item.level,
                  value: item.value,
                  national_rank: nationalRank,
                  national_rank_display: explicitRank ? `全国 ${explicitRank} 位` : `全国 約 ${nationalRank} 位`
                };
              }
            }
          }

          if (bestChallenge) {
            rankingResults.push({
              player_name: player.name || player.riot_id,
              discord_id: player.discord_id,
              identity: bestChallenge
            });
          }
        } catch (err) {
          console.error(`Failed fetching challenges for ${player.name}:`, err);
        }
      })
    );

    // パーセンタイルが小さい順（全日本上位%が高い順）にソート
    rankingResults.sort((a, b) => a.identity.percentile - b.identity.percentile);

    const formattedRanking = rankingResults.map((item, index) => ({
      rank: index + 1,
      player_name: item.player_name,
      discord_id: item.discord_id,
      title: item.identity.name,
      description: item.identity.description,
      percentile_display: item.identity.top_percent_display,
      level: item.identity.level,
      raw_percentile: item.identity.percentile,
      value: item.identity.value,
      value_display: typeof item.identity.value === 'number' ? item.identity.value.toLocaleString('ja-JP') : item.identity.value,
      national_rank: item.identity.national_rank,
      national_rank_display: item.identity.national_rank_display
    }));

    return NextResponse.json({
      ranking: formattedRanking,
      top_identity: formattedRanking[0] || null
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
