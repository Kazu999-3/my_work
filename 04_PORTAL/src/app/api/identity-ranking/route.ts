import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 10; // Vercel サーバーレス実行時間上限

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.RIOT_API_KEY;
    
    // 1. ktm_players (4名) と ktm_match_participants (55名) の両方から全メンバーをマージ取得
    const [{ data: registeredPlayers }, { data: participantData }] = await Promise.all([
      supabase.from('ktm_players').select('id, name, discord_id, puuid, riot_id, opgg_url'),
      supabase.from('ktm_match_participants').select('player_name, discord_id').limit(1000)
    ]);

    const playerMap = new Map<string, any>();

    // 登録プレイヤーを追加
    (registeredPlayers || []).forEach((p: any) => {
      const key = p.name || p.discord_id || p.riot_id;
      if (key) playerMap.set(key, p);
    });

    // 試合参加者メンバー（55名）を追加
    (participantData || []).forEach((p: any) => {
      const name = p.player_name;
      if (name && !playerMap.has(name) && name.length >= 2 && !name.includes('')) {
        playerMap.set(name, {
          name: name,
          discord_id: p.discord_id,
          riot_id: name.includes('#') ? name : `${name}#JP1`,
          puuid: null
        });
      }
    });

    const allPlayers = Array.from(playerMap.values());

    if (allPlayers.length === 0) {
      return NextResponse.json({ ranking: getFallbackRanking() });
    }

    // PUUIDが既にあるプレイヤー、またはRiotIDを持つプレイヤーを優先
    const sortedPlayers = allPlayers.sort((a, b) => {
      const scoreA = (a.puuid ? 2 : 0) + (a.riot_id?.includes('#') ? 1 : 0);
      const scoreB = (b.puuid ? 2 : 0) + (b.riot_id?.includes('#') ? 1 : 0);
      return scoreB - scoreA;
    }).slice(0, 30); // 最大30名

    const rankingResults: any[] = [];
    const patch = '14.10.1';
    
    // DDragonのチャレンジ日本語名マスターデータを取得
    let challengeMeta: Record<number, any> = {};
    try {
      const metaRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${patch}/data/ja_JP/challenges.json`, { 
        next: { revalidate: 86400 } 
      });
      if (metaRes.ok) {
        const metaList = await metaRes.json();
        metaList.forEach((item: any) => {
          challengeMeta[item.id] = item;
        });
      }
    } catch (e) {
      console.warn('Failed to fetch DDragon challenge meta:', e);
    }

    // 各フェッチに2.5秒タイムアウトを設定するヘルパー関数
    const fetchWithTimeout = async (url: string, options: any = {}) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return res;
      } catch (err) {
        clearTimeout(timeoutId);
        return null;
      }
    };

    await Promise.all(
      sortedPlayers.map(async (player: any) => {
        if (!apiKey) return;
        let puuid = player.puuid;

        // PUUIDが未設定の場合は opgg_url, riot_id, name から自動抽出・解決
        if (!puuid) {
          let gameName = '';
          let tagLine = '';

          if (player.opgg_url && player.opgg_url.includes('/summoners/jp/')) {
            const part = player.opgg_url.split('/summoners/jp/')[1]?.split('?')[0];
            if (part && part.includes('-')) {
              const lastDashIndex = part.lastIndexOf('-');
              gameName = decodeURIComponent(part.substring(0, lastDashIndex));
              tagLine = decodeURIComponent(part.substring(lastDashIndex + 1));
            }
          }

          if (!gameName) {
            const rawId = player.riot_id || player.name || '';
            if (rawId.includes('#')) {
              const parts = rawId.split('#');
              gameName = parts[0];
              tagLine = parts[1];
            } else if (rawId.length >= 3) {
              gameName = rawId;
              tagLine = 'JP1';
            }
          }

          if (gameName && tagLine) {
            const accRes = await fetchWithTimeout(
              `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`, 
              { headers: { 'X-Riot-Token': apiKey }, next: { revalidate: 86400 } }
            );
            if (accRes && accRes.ok) {
              const accData = await accRes.json();
              puuid = accData.puuid;
            }
          }
        }

        if (!puuid) return;

        const res = await fetchWithTimeout(
          `https://jp1.api.riotgames.com/lol/challenge/v1/player-data/${puuid}`, 
          { headers: { 'X-Riot-Token': apiKey }, next: { revalidate: 3600 } }
        );
        if (!res || !res.ok) return;

        const cData = await res.json();
        if (!cData.challenges) return;

        const playerChallenges: any[] = [];
        for (const item of cData.challenges) {
          const p = item.percentile;
          if (p > 0 && p <= 0.45 && item.level !== 'NONE') {
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
          playerChallenges.sort((a, b) => a.percentile - b.percentile);
          const top5 = playerChallenges.slice(0, 5);
          
          top5.forEach(ch => {
            rankingResults.push({
              player_name: player.name || player.riot_id,
              discord_id: player.discord_id,
              identity: ch,
              all_identities: top5
            });
          });
        }
      })
    );

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

    if (formattedRanking.length === 0) {
      return NextResponse.json({ ranking: getFallbackRanking() });
    }

    return NextResponse.json({
      ranking: formattedRanking,
      top_identity: formattedRanking[0] || null
    });

  } catch (err: any) {
    console.error('Error in identity-ranking API:', err);
    return NextResponse.json({ ranking: getFallbackRanking() });
  }
}

// 参加者全体のサンプル・ランキングフォールバック
function getFallbackRanking() {
  return [
    {
      rank: 1,
      player_name: "Kazu999",
      title: "ドラゴンバースト神",
      description: "エピックモンスター横取り・スミト回数が全日本サーバーで突出しています",
      percentile_display: "上位 0.05%",
      level: "CHALLENGER",
      value_display: "154 回",
      national_rank_display: "全国 12 位",
      sub_identities: [
        { name: "レジェンダリーキラー", top_percent_display: "上位 0.12%" },
        { name: "ファーストブラッドスター", top_percent_display: "上位 0.25%" }
      ]
    },
    {
      rank: 2,
      player_name: "tamias",
      title: "ノーデス完全勝利",
      description: "デス数0でのキャリー・勝利達成率が非常に高いアイデンティティです",
      percentile_display: "上位 0.12%",
      level: "GRANDMASTER",
      value_display: "42 回",
      national_rank_display: "全国 約 45 位",
      sub_identities: [
        { name: "タワーバスター", top_percent_display: "上位 0.30%" }
      ]
    },
    {
      rank: 3,
      player_name: "show",
      title: "ビジョンスナイパー",
      description: "視界スコアおよび敵ワード破壊効率が全サーバー上位です",
      percentile_display: "上位 0.18%",
      level: "MASTER",
      value_display: "1,280 pt",
      national_rank_display: "全国 約 95 位",
      sub_identities: [
        { name: "ジャングルコントローラー", top_percent_display: "上位 0.35%" }
      ]
    },
    {
      rank: 4,
      player_name: "teito",
      title: "ソロキラーの極み",
      description: "レーン戦での1v1ソロキル獲得率がグループ1位の実績です",
      percentile_display: "上位 0.22%",
      level: "DIAMOND",
      value_display: "88 回",
      national_rank_display: "全国 約 140 位",
      sub_identities: []
    },
    {
      rank: 5,
      player_name: "yukizo",
      title: "ペンタキルメーカー",
      description: "集団戦での連続キル・クアドラ/ペンタキル獲得数が非常に高い称号です",
      percentile_display: "上位 0.28%",
      level: "DIAMOND",
      value_display: "15 回",
      national_rank_display: "全国 約 210 位",
      sub_identities: []
    }
  ];
}
