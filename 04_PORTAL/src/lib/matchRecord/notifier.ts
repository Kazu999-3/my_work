import { syncPlayersDiscordRoles } from '../discordRoleSync';
import { updateCustomVoiceChannelStatus } from '../discordNotify';
import { buildMatchupField, resultEmbedColor } from '../matchResultMessage';
import { generateMatchNews, buildMatchNewsField } from '../matchNews';
import { discordFetch } from '../discordFetch';

export const DEFAULT_RESULTS_CHANNEL_ID = '1487077567939743995'; // ✍🏻カスタムログ

export interface NotifyMatchResultParams {
  supabase: any;
  newMatchId: string | number;
  winningTeam: 'BLUE' | 'RED';
  results: any[];
  gameDuration?: number;
  isExhibition?: boolean;
  isFinalMatch?: boolean;
  balanceSatisfaction?: 'good' | 'normal' | 'bad' | null;
  payoutWinners: Array<{ name: string; payout: number; multiplier: number; streak?: number }>;
  statsMap: Record<string, { roleGames: Record<string, number>, totalGames: number, totalWins: number }>;
  afterHook?: (fn: () => Promise<void>) => void;
}

/**
 * 試合後の非同期副作用（通知・VCステータス・対面カルテ・ロール同期）を実行する
 */
export async function performMatchNotifications(params: NotifyMatchResultParams) {
  const {
    supabase,
    newMatchId,
    winningTeam,
    results,
    gameDuration,
    isExhibition,
    isFinalMatch,
    balanceSatisfaction,
    payoutWinners,
    statsMap,
    afterHook
  } = params;

  // 1. チーム分け満足度
  if (balanceSatisfaction === 'good' || balanceSatisfaction === 'normal' || balanceSatisfaction === 'bad') {
    try {
      const { error: satDbErr } = await supabase
        .from('balancer_predictions')
        .update({
          satisfaction_up: balanceSatisfaction === 'good' ? 1 : 0,
          satisfaction_down: balanceSatisfaction === 'bad' ? 1 : 0,
          satisfaction_updated_at: new Date().toISOString(),
        })
        .eq('match_id', newMatchId);
      if (satDbErr) {
        console.error('[matchRecord/notifier] 満足度の保存に失敗:', satDbErr.message);
      }
    } catch (satErr: any) {
      console.warn('[matchRecord/notifier] 満足度の保存に失敗（続行）:', satErr?.message);
    }
  }

  // 2. 対面カルテ（matchup_log）
  try {
    const logRows: any[] = [];
    for (const r of results) {
      const opp = results.find((o: any) => o.role === r.role && o.team !== r.team);
      if (!opp) continue;
      logRows.push({
        match_id: newMatchId,
        discord_id: r.dbPlayer?.discord_id || null,
        player_name: r.name,
        role: r.role,
        my_champion: r.champion_name || null,
        enemy_champion: opp.champion_name || null,
        is_win: r.team === winningTeam,
        kills: r.kills || 0,
        deaths: r.deaths || 0,
        assists: r.assists || 0,
      });
    }
    if (logRows.length > 0) {
      await supabase.from('matchup_log').insert(logRows);
    }
  } catch (logErr: any) {
    console.warn('[matchRecord/notifier] matchup_log の保存に失敗（続行）:', logErr?.message);
  }

  // 3. Discord ロール自動同期
  try {
    const participantPlayerIds = results
      .map((r: any) => r.dbPlayer?.id)
      .filter((id: any) => typeof id === 'number');

    if (participantPlayerIds.length > 0) {
      syncPlayersDiscordRoles({ playerIds: participantPlayerIds }).catch((syncErr) => {
        console.warn('[matchRecord/notifier] Discordロール同期エラー（続行）:', syncErr?.message);
      });
    }
  } catch (roleErr: any) {
    console.warn('[matchRecord/notifier] Discordロール同期呼び出し失敗（続行）:', roleErr?.message);
  }

  // 4. Discord VCステータス更新（最終戦ならクリア、通常なら「インターバル・交代募集中」）
  try {
    const targetStatus = isFinalMatch ? '' : 'インターバル・交代募集中';
    await updateCustomVoiceChannelStatus(targetStatus);
  } catch (vcErr) {
    console.warn('[matchRecord/notifier] VC名更新エラー（続行）:', vcErr);
  }

  // 5. Web Push 通知
  try {
    const { sendPushToAll } = await import('../../app/api/push/send/route');
    await sendPushToAll({
      title: '🏆 試合結果が記録されました',
      body: `${winningTeam === 'BLUE' ? '🟦 BLUE' : '🟥 RED'} チームの勝利！詳細はポータルで確認できます。`,
      url: '/history',
    });
  } catch (pushErr: any) {
    console.warn('[matchRecord/notifier] push skipped:', pushErr?.message);
  }

  // 6. Discord 結果速報 送信 (Webhook または Bot 直接送信フォールバック)
  try {
    const webhookUrl = process.env.DISCORD_RESULTS_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const resultsChannelId = process.env.DISCORD_RESULTS_CHANNEL_ID || DEFAULT_RESULTS_CHANNEL_ID;

    if (webhookUrl || (botToken && resultsChannelId)) {
      const matchupField = buildMatchupField(results as any, winningTeam, !!isExhibition);
      const betPayoutSummary = payoutWinners.length > 0
        ? payoutWinners.map(w => `・\`${w.name}\`: **+${w.payout.toLocaleString()}🪙** 獲得！(x${w.multiplier}倍)`).join('\n')
        : '的中者なし (または受付中のベットなし)';

      const newsInput = {
        matchId: newMatchId,
        winningTeam,
        gameDuration,
        participants: results.map((r: any) => ({
          name: r.name,
          team: r.team,
          role: r.role,
          champion_name: r.champion_name,
          kills: r.kills || 0,
          deaths: r.deaths || 0,
          assists: r.assists || 0,
          penta_kills: Number(r.penta_kills) || 0,
          mmrDelta: r.mmrDelta || 0,
          playerMmr: r.currentMmr || 1200,
          damage_dealt: r.damage_dealt || 0,
          damage_taken: r.damage_taken || 0,
          vision: r.vision_score || 0,
          cs: r.cs || 0,
          gold: r.gold || 0,
          time_dead: r.time_dead || 0,
          solo_kills: r.solo_kills || 0,
          cc_time: r.cc_time || 0,
          building_damage: r.building_damage || 0,
          items: r.items || [],
          spells: r.spells || [],
          isFirstTime: (statsMap[r.name]?.totalGames || 0) === 0,
          totalGames: statsMap[r.name]?.totalGames || 0,
        })),
      };

      const saveNews = (article: any) =>
        supabase.from('edge_tasks').insert({
          task_type: 'ktm_match_news',
          payload: { matchId: newMatchId, winningTeam, article },
          status: 'completed',
        });

      let newsArticle: any = null;
      try {
        newsArticle = await generateMatchNews(newsInput);
        await saveNews(newsArticle);

        try {
          await supabase.from('edge_tasks').insert({
            task_type: 'ktm_match_detail_stats',
            payload: {
              matchId: newMatchId,
              winningTeam,
              gameDuration,
              participants: results.map((r: any) => ({
                name: r.name,
                team: r.team,
                role: r.role,
                champion_name: r.champion_name,
                kills: r.kills || 0,
                deaths: r.deaths || 0,
                assists: r.assists || 0,
                damage_dealt: r.damage_dealt || 0,
                damage_taken: r.damage_taken || 0,
                damage_mitigated: r.damage_mitigated || 0,
                objective_damage: r.objective_damage || 0,
                building_damage: r.building_damage || 0,
                heal_shield: r.heal_shield || 0,
                cc_time: r.cc_time || 0,
                cs: r.cs || 0,
                gold: r.gold || 0,
                vision: r.vision_score || 0,
                solo_kills: r.solo_kills || 0,
                time_dead: r.time_dead || 0,
                turrets_killed: r.turrets_killed || 0,
                items: r.items || [],
                spells: r.spells || [],
                penta_kills: r.penta_kills || 0,
                playerMmr: r.currentMmr || 1200,
                mmrDelta: r.mmrDelta || 0,
              })),
            },
            status: 'completed',
          });
        } catch (detailErr) {
          console.warn('[matchRecord/notifier] 詳細スタッツ保存エラー（続行）:', detailErr);
        }
      } catch (newsErr) {
        console.warn('[matchRecord/notifier] AIニュース生成スキップ（続行）:', newsErr);
      }

      const fieldsList = [
        ...(newsArticle ? [buildMatchNewsField(newsArticle)] : []),
        matchupField,
        {
          name: "💰 勝敗予想カジノ 配当結果",
          value: betPayoutSummary,
          inline: false
        }
      ];

      const payload = isExhibition ? {
        content: "🎪 **【KTMお祭りカスタム速報】エキシビション対決が終了しました！** 🎪\n🛡️ **完全戦績保護適用**: 全員の公式MMR・通算勝率はノーカウント（±0）で保護されました！\n🪙 参加賞（+100pt）＆勝利ボーナス（+150pt）および勝敗予想配当を付与しました！",
        embeds: [{
          title: "🎪 お祭りカスタム 試合リザルト (戦績ノーカウント保護)",
          color: 0xf59e0b,
          fields: fieldsList,
          footer: { text: 'KTM Sovereign Festival Match • Official MMR Protected' },
          timestamp: new Date().toISOString()
        }]
      } : {
        content: "📜 **KTM 試合結果が記録されました！** 📜\n各プレイヤーのMMRが更新されました。",
        embeds: [{
          title: "⚔️ 試合リザルト",
          color: resultEmbedColor(winningTeam),
          fields: fieldsList
        }]
      };

      let sentMsg: { id?: string; channel_id?: string } | null = null;

      // A. Webhook による送信
      if (webhookUrl) {
        try {
          const sep = webhookUrl.includes('?') ? '&' : '?';
          const whRes = await discordFetch(`${webhookUrl}${sep}wait=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (whRes.ok) {
            sentMsg = await whRes.json();
          }
        } catch (err) {
          console.error('[matchRecord/notifier] Webhook送信エラー:', err);
        }
      }

      // B. Bot Token による直接送信フォールバック（Webhook未設定または失敗時）
      if (!sentMsg && botToken && resultsChannelId) {
        try {
          const botRes = await discordFetch(`https://discord.com/api/v10/channels/${resultsChannelId}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bot ${botToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          if (botRes.ok) {
            sentMsg = await botRes.json();
          } else {
            console.error('[matchRecord/notifier] Bot送信失敗:', botRes.status, await botRes.text());
          }
        } catch (err) {
          console.error('[matchRecord/notifier] Bot送信エラー:', err);
        }
      }

      if (sentMsg?.id) {
        const msgId = sentMsg.id;
        const channelId = sentMsg.channel_id || resultsChannelId;

        if (!newsArticle && afterHook) {
          const resultEmbed = payload.embeds[0];
          afterHook(async () => {
            try {
              await new Promise((r) => setTimeout(r, 20_000));
              const article = await generateMatchNews(newsInput, { maxRetries: 4 });
              await saveNews(article);
              const patchPayload = {
                embeds: [{ ...resultEmbed, fields: [buildMatchNewsField(article), ...resultEmbed.fields] }],
              };
              if (webhookUrl) {
                await discordFetch(`${webhookUrl}/messages/${msgId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(patchPayload),
                });
              } else if (botToken && channelId) {
                await discordFetch(`https://discord.com/api/v10/channels/${channelId}/messages/${msgId}`, {
                  method: 'PATCH',
                  headers: {
                    Authorization: `Bot ${botToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(patchPayload),
                });
              }
            } catch (retryErr) {
              console.warn('[matchRecord/notifier] 号外の後追い追記失敗:', retryErr);
            }
          });
        }

        await supabase.from('ktm_matches').update({ result_message_id: msgId }).eq('id', newMatchId);
        await supabase.from('balancer_predictions').update({ result_message_id: msgId, result_channel_id: channelId }).eq('match_id', newMatchId);
      }
    }
  } catch (discordErr) {
    console.error('[matchRecord/notifier] Failed to send discord notification:', discordErr);
  }
}
