// ============================================================
// KTM Bot: ランキング ＆ 月次アワード機能 (/ranking, /award)
// ============================================================

import { CONFIG } from '../config.js';
import { fetchSupabase } from '../utils/supabase.js';
import { getTierEmoji } from '../utils/ktmRank.js';

/**
 * ランキング・リーダーボードEmbedを生成
 */
export async function handleRankingCommand(interaction, env, ctx) {
  const appId = interaction.application_id;
  const token = interaction.token;

  ctx.waitUntil((async () => {
    try {
      // プレイヤーデータと試合参加者データを取得
      const [players, participants, matches] = await Promise.all([
        fetchSupabase(env, 'ktm_players', 'select=discord_id,name,mmr,mmr_top,mmr_jg,mmr_mid,mmr_adc,mmr_sup&order=mmr.desc&limit=50'),
        fetchSupabase(env, 'ktm_match_participants', 'select=player_name,discord_id,role,team,match_id&limit=1000'),
        fetchSupabase(env, 'ktm_matches', 'select=id,winning_team,created_at&limit=200')
      ]);

      const matchWinMap = new Map();
      (matches || []).forEach(m => matchWinMap.set(m.id, m.winning_team));

      // プレイヤーごとの戦績集計
      const statsMap = new Map();
      (players || []).forEach(p => {
        statsMap.set(p.name, {
          name: p.name,
          discordId: p.discord_id,
          mmr: p.mmr || 1000,
          games: 0,
          wins: 0,
          roles: { TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0 }
        });
      });

      (participants || []).forEach(pt => {
        const entry = statsMap.get(pt.player_name);
        if (entry) {
          entry.games++;
          const winner = matchWinMap.get(pt.match_id);
          if (winner && winner === pt.team) {
            entry.wins++;
          }
          const r = (pt.role || '').toUpperCase();
          if (entry.roles[r] !== undefined) {
            entry.roles[r]++;
          }
        }
      });

      const playerList = Array.from(statsMap.values()).filter(p => p.games > 0);

      // 1. 総合最多勝利ランキング TOP 5
      const mostWins = [...playerList].sort((a, b) => b.wins - a.wins).slice(0, 5);
      const winLines = mostWins.map((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`${i + 1}.\``;
        const wr = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0;
        return `${medal} **${p.name}**: **${p.wins}勝** / ${p.games}戦 (勝率 ${wr}%)`;
      });

      // 2. 勝率ランキング (5試合以上) TOP 5
      const qualified = playerList.filter(p => p.games >= 3);
      const bestWinrate = [...qualified].sort((a, b) => (b.wins / b.games) - (a.wins / a.games)).slice(0, 5);
      const wrLines = bestWinrate.map((p, i) => {
        const medal = i === 0 ? '👑' : i === 1 ? '⭐' : i === 2 ? '✨' : `\`${i + 1}.\``;
        const wr = Math.round((p.wins / p.games) * 100);
        return `${medal} **${p.name}**: **勝率 ${wr}%** (${p.wins}勝 ${p.games - p.wins}敗)`;
      });

      // 3. 最多参加 (皆勤賞) TOP 3
      const mostGames = [...playerList].sort((a, b) => b.games - a.games).slice(0, 3);
      const gameLines = mostGames.map((p, i) => {
        return `🎖️ **${p.name}**: **${p.games}試合** 参戦`;
      });

      const embed = {
        title: "🏆 KTM カスタム リーダーボード ＆ 殿堂入り",
        description: `サーバー内の対戦戦績に基づいた最新ランキングです！\nWebポータルで詳細な全順位・ロール別MMRを確認できます。`,
        color: 0xf1c40f, // ゴールド
        fields: [
          {
            name: "🔥 最多勝利ランキング (TOP 5)",
            value: winLines.length > 0 ? winLines.join('\n') : "データ集計中...",
            inline: false
          },
          {
            name: "💎 最高勝率ランキング (3試合以上・TOP 5)",
            value: wrLines.length > 0 ? wrLines.join('\n') : "データ集計中...",
            inline: false
          },
          {
            name: "🎖️ コミットメント賞 (最多マッチ参戦 TOP 3)",
            value: gameLines.length > 0 ? gameLines.join('\n') : "データ集計中...",
            inline: false
          }
        ],
        footer: { text: "KTM Sovereign OS | リーダーボード" },
        timestamp: new Date().toISOString()
      };

      const components = [
        {
          type: 1,
          components: [
            {
              type: 2,
              label: "🌐 Webポータルで全ランキングを見る",
              style: 5,
              url: `${CONFIG.PORTAL_URL}/leaderboard`
            },
            {
              type: 2,
              label: "📊 マイ戦績を確認",
              style: 2,
              custom_id: "portal_stats"
            }
          ]
        }
      ];

      const { patchInteractionResponse } = await import('../utils/api.js');
      await patchInteractionResponse(appId, token, { embeds: [embed], components });

    } catch (err) {
      console.error("handleRankingCommand error:", err);
      const { patchInteractionResponse } = await import('../utils/api.js');
      await patchInteractionResponse(appId, token, { content: `⚠️ ランキング集計エラー: ${err.message}` });
    }
  })());

  // 処理中応答 (type 5)
  return Response.json({ type: 5 });
}

/**
 * 毎月1日に自動投稿する「月間アワード発表Embed」を生成
 */
export async function generateMonthlyAwardEmbed(env) {
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthLabel = `${lastMonth.getFullYear()}年 ${lastMonth.getMonth() + 1}月`;

    const [players, participants, matches] = await Promise.all([
      fetchSupabase(env, 'ktm_players', 'select=discord_id,name,mmr&limit=50'),
      fetchSupabase(env, 'ktm_match_participants', 'select=player_name,discord_id,role,team,match_id&limit=1000'),
      fetchSupabase(env, 'ktm_matches', 'select=id,winning_team,created_at&limit=200')
    ]);

    const matchWinMap = new Map();
    (matches || []).forEach(m => matchWinMap.set(m.id, m.winning_team));

    const statsMap = new Map();
    (players || []).forEach(p => {
      statsMap.set(p.name, {
        name: p.name,
        discordId: p.discord_id,
        games: 0,
        wins: 0
      });
    });

    (participants || []).forEach(pt => {
      const entry = statsMap.get(pt.player_name);
      if (entry) {
        entry.games++;
        if (matchWinMap.get(pt.match_id) === pt.team) {
          entry.wins++;
        }
      }
    });

    const list = Array.from(statsMap.values()).filter(p => p.games >= 2);
    if (list.length === 0) return null;

    // MVP: 最多勝利
    const mvp = [...list].sort((a, b) => b.wins - a.wins)[0];
    // 勝率王 (3戦以上)
    const wrKing = [...list.filter(p => p.games >= 3)].sort((a, b) => (b.wins / b.games) - (a.wins / a.games))[0];
    // 皆勤賞: 最多参加
    const attendanceKing = [...list].sort((a, b) => b.games - a.games)[0];

    return {
      title: `👑 KTM 月間アワード表彰 [${monthLabel}]`,
      description: `先月1ヶ月間にカスタムマッチで大活躍したメンバーを表彰します！🎉\n素晴らしいプレイとコミュニティへの参加、ありがとうございました！`,
      color: 0xc2650f, // KTMアンバー/ゴールド
      fields: [
        {
          name: "🏆 【月間MVP（最多勝キャリー）】",
          value: mvp ? `👑 **${mvp.name}** 選手\n▫ 通算 **${mvp.wins}勝** / ${mvp.games}戦中 (勝率 ${Math.round(mvp.wins/mvp.games*100)}%)\n*「チームを勝利へ導き続けた文句なしの月間最優秀プレイヤー！」*` : "該当者なし",
          inline: false
        },
        {
          name: "💎 【最高勝率キング】",
          value: wrKing ? `⭐ **${wrKing.name}** 選手\n▫ 勝率 **${Math.round(wrKing.wins/wrKing.games*100)}%** (${wrKing.wins}勝 ${wrKing.games - wrKing.wins}敗)\n*「圧倒的な勝率で高い安定感を見せつけた名手！」*` : "該当者なし",
          inline: false
        },
        {
          name: "🎖️ 【月間皆勤賞（コミュニティ功労賞）】",
          value: attendanceKing ? `🎖️ **${attendanceKing.name}** 選手\n▫ 総参戦数 **${attendanceKing.games}試合**\n*「誰よりもカスタムを盛り上げてくれた情熱のプレイヤー！」*` : "該当者なし",
          inline: false
        }
      ],
      footer: { text: `KTM Sovereign OS | ${monthLabel} 表彰式` },
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    console.error("generateMonthlyAwardEmbed error:", e);
    return null;
  }
}
