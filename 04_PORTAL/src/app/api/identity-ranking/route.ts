import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.RIOT_API_KEY;
    
    // Supabaseの全KTMプレイヤー情報を取得
    const { data: players, error } = await supabase
      .from('ktm_players')
      .select('id, name, discord_id, puuid, riot_id, opgg_url');

    if (error || !players || players.length === 0) {
      console.warn('No players found in ktm_players table or error:', error);
      return NextResponse.json({ ranking: [] });
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
        if (!apiKey) return;
        let puuid = player.puuid;

        // 1. PUUIDが未設定の場合は opgg_url, riot_id, name から自動抽出・解決を試みる
        if (!puuid) {
          let gameName = '';
          let tagLine = '';

          // opgg_url 例: https://www.op.gg/summoners/jp/Kazu999-JP1
          if (player.opgg_url && player.opgg_url.includes('/summoners/jp/')) {
            const part = player.opgg_url.split('/summoners/jp/')[1]?.split('?')[0];
            if (part && part.includes('-')) {
              const lastDashIndex = part.lastIndexOf('-');
              gameName = decodeURIComponent(part.substring(0, lastDashIndex));
              tagLine = decodeURIComponent(part.substring(lastDashIndex + 1));
            }
          }

          // riot_id や name 例: "Kazu999#JP1"
          if (!gameName) {
            const rawId = player.riot_id || player.name || '';
            if (rawId.includes('#')) {
              const parts = rawId.split('#');
              gameName = parts[0];
              tagLine = parts[1];
            }
          }

          if (gameName && tagLine) {
            try {
              const accRes = await fetch(`https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`, {
                headers: { 'X-Riot-Token': apiKey },
                next: { revalidate: 86400 }
              });
              if (accRes.ok) {
                const accData = await accRes.json();
                puuid = accData.puuid;
              }
            } catch (e) {
              // ignore
            }
          }
        }

        if (!puuid) return;

        try {
          const res = await fetch(`https://jp1.api.riotgames.com/lol/challenge/v1/player-data/${puuid}`, {
            headers: { 'X-Riot-Token': apiKey },
            next: { revalidate: 3600 }
          });
          if (!res.ok) return;
          const cData = await res.json();
          if (!cData.challenges) return;

          const playerChallenges: any[] = [];
          for (const item of cData.challenges) {
            const p = item.percentile;
            if (p > 0 && p <= 0.4 && item.level !== 'NONE') {
              const meta = challengeMeta[item.challengeId] || {};
              const explicitRank = item.position || (item.rank ? item.rank : null);
              const estimatedRank = Math.max(1, Math.round(p * 120000));
              const nationalRank = explicitRank || estimatedRank;

              playerChallenges.push({
                challengeId: item.challengeId,
                name: meta.name || '激レア実績',
                description: meta.shortDescription || meta.description || '特別な実績を達成しました',
                percentile: p,
                top_percent_display: `上位 ${(p * 100).toFixed(2)}%`,
                level: item.level,
                value: item.value,
                national_rank: nationalRank,
                national_rank_display: explicitRank ? `全国 ${explicitRank} 位` : `全国 約 ${nationalRank} 位`
              });
            }
          }

          if (playerChallenges.length > 0) {
            // パーセンタイル順（激レア順）にソート
            playerChallenges.sort((a, b) => a.percentile - b.percentile);

            // トップ5件まで取得
            const top5 = playerChallenges.slice(0, 5);
            
            // 全体フラットランキングに追加
            top5.forEach(ch => {
              rankingResults.push({
                player_name: player.name || player.riot_id,
                discord_id: player.discord_id,
                identity: ch,
                all_identities: top5
              });
            });
          }
        } catch (err) {
          console.error(`Failed fetching challenges for ${player.name}:`, err);
        }
      })
    );

    // パーセンタイルが小さい順（全日本上位%が高い順）に全体ソート
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
      national_rank_display: item.identity.national_rank_display,
      sub_identities: item.all_identities.filter((sub: any) => sub.challengeId !== item.identity.challengeId)
    }));

    return NextResponse.json({
      ranking: formattedRanking,
      top_identity: formattedRanking[0] || null
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
