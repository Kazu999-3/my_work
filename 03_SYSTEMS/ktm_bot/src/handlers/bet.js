// ============================================================
// KTM Bot: 勝敗ベット ＆ KTMコインハンドラー
// ============================================================

import { CONFIG } from '../config.js';
import { fetchPortalAPI, patchInteractionResponse } from '../utils/api.js';

/**
 * 自分の所持コイン・戦績を表示 (/coins, /bet)
 */
export async function handleCoinsCommand(interaction, env, ctx) {
  const discordId = interaction.member?.user?.id || interaction.user?.id;
  const playerName = interaction.member?.user?.global_name || interaction.member?.user?.username || '不明';
  const appId = interaction.application_id;
  const token = interaction.token;

  ctx.waitUntil((async () => {
    try {
      const data = await fetchPortalAPI(env, `/api/bet?discordId=${discordId}&name=${encodeURIComponent(playerName)}`);

      // ⚠️ 2026-09-29 是正: 以前は `data?.userCoins ?? 1000` で、**取得に失敗しても
      // 1000コインを実際の残高として表示**していた（新規プレイヤーの初期値と同じ数字なので
      // 誤解に気づけない）。お金の表示で推測値を出さない。取れなければ取れないと言う。
      const coins = typeof data?.userCoins === 'number' ? data.userCoins : null;
      if (coins === null) {
        await patchInteractionResponse(appId, token, {
          content: '⚠️ 残高を取得できませんでした。時間をおいて再度お試しください。'
        });
        return;
      }

      const embed = {
        title: `🪙 KTMウォレット: ${playerName}`,
        description: `あなたの現在の所持コインとベット情報です。`,
        color: 0xf1c40f,
        fields: [
          {
            name: "💰 所持KTMコイン",
            value: `**${coins.toLocaleString()}** コイン`,
            inline: true
          },
          {
            // ⚠️ 2026-09-29 是正: 以前は「試合参加: +50〜100」と書いていたが、これは
            // **募集参加ボーナス**(bet/recruit-reward: カスタム100/他50)の額で、
            // **試合参加賞は+100固定**(match/record)。2つの別制度を混同していた。
            // 実装の値と突き合わせて書き直した。変更時はここも直すこと。
            name: "🎮 コインの貯め方",
            value:
              `▫ 募集を立てる: **+200**（カスタム） / **+100**（ノーマル等）\n` +
              `▫ 募集に参加: **+100**（カスタム） / **+50**（ノーマル等）\n` +
              `▫ 試合に参加: **+100**\n` +
              `▫ カスタム勝利: **+150**（勝つと参加賞と合わせて +250）\n` +
              `▫ MVP・各賞: **+200**\n` +
              `▫ 勝敗ベット的中: **オッズ倍率配当**`,
            inline: false
          }
        ],
        footer: { text: "KTM Sovereign Casino" },
        timestamp: new Date().toISOString()
      };

      const components = [
        {
          type: 1,
          components: [
            {
              type: 2,
              label: "🎲 Webポータルでベット・長者番付を見る",
              style: 5,
              url: `${CONFIG.PORTAL_URL}/casino`
            }
          ]
        }
      ];

      await patchInteractionResponse(appId, token, { embeds: [embed], components });
    } catch (e) {
      await patchInteractionResponse(appId, token, { content: `⚠️ コイン取得エラー: ${e.message}` });
    }
  })());

  return Response.json({ type: 5, data: { flags: 64 } });
}

/**
 * 長者番付 TOP10 を表示 (/casino, /rich)
 */
export async function handleCasinoCommand(interaction, env, ctx) {
  const appId = interaction.application_id;
  const token = interaction.token;

  ctx.waitUntil((async () => {
    try {
      const data = await fetchPortalAPI(env, '/api/bet');
      const ranking = data?.ranking || [];

      const lines = ranking.map((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`${i + 1}.\``;
        // ⚠️ 2026-09-29 是正: 以前は `p.coins ?? 1000` で、コイン数が欠けている行に
        // **1000コインという架空の数字**を入れて表示していた（順位表なので特に誤解を招く）。
        const coinText = typeof p.coins === 'number' ? `**${p.coins.toLocaleString()}** コイン` : '（取得できませんでした）';
        return `${medal} **${p.name}**: ${coinText} (${p.rank || 'UNRANKED'})`;
      });

      const embed = {
        title: "👑 KTM 長者番付 TOP 10 (コイン富豪ランキング)",
        description: `サーバー内で最もコインを稼いだ富豪プレイヤー一覧です！\n勝敗予想ベットやカスタムでの活躍でランキング上位を目指そう！`,
        color: 0xc2650f,
        fields: [
          {
            name: "🏆 コインランキング",
            value: lines.length > 0 ? lines.join('\n') : "データ集計中...",
            inline: false
          }
        ],
        footer: { text: "KTM Sovereign Casino" },
        timestamp: new Date().toISOString()
      };

      const components = [
        {
          type: 1,
          components: [
            {
              type: 2,
              label: "🎲 Webカジノへアクセス",
              style: 5,
              url: `${CONFIG.PORTAL_URL}/casino`
            }
          ]
        }
      ];

      await patchInteractionResponse(appId, token, { embeds: [embed], components });
    } catch (e) {
      await patchInteractionResponse(appId, token, { content: `⚠️ ランキング取得エラー: ${e.message}` });
    }
  })());

  return Response.json({ type: 5 });
}

/**
 * ベットボタン押下時のモーダル展開
 */
export function handleBetButton(interaction, env, ctx) {
  const customId = interaction.data.custom_id; // e.g. "bet_team:BLUE" or "bet_team:RED"
  const team = customId.split(':')[1] || 'BLUE';

  return Response.json({
    type: 9,
    data: {
      title: `🎲 ${team} チームに勝敗ベット`,
      custom_id: `bet_modal:${team}`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "amount",
              label: "賭け金 (KTMコイン)",
              style: 1,
              placeholder: "例: 100 / 300 / 500",
              required: true,
              value: "100"
            }
          ]
        }
      ]
    }
  });
}

/**
 * ベットモーダル送信処理
 */
export async function handleBetModalSubmit(interaction, env, ctx) {
  const customId = interaction.data.custom_id; // "bet_modal:BLUE"
  const team = customId.split(':')[1] || 'BLUE';
  const amountStr = interaction.data.components[0].components[0].value;
  const amount = parseInt(amountStr, 10) || 100;

  const discordId = interaction.member?.user?.id || interaction.user?.id;
  const playerName = interaction.member?.user?.global_name || interaction.member?.user?.username || '不明';

  const appId = interaction.application_id;
  const token = interaction.token;

  ctx.waitUntil((async () => {
    const { sendInteractionFollowup } = await import('../utils/api.js');
    try {
      const res = await fetchPortalAPI(env, '/api/bet', {
        discordId,
        playerName,
        team,
        amount
      });

      if (res && res.success) {
        await sendInteractionFollowup(appId, token, {
          content: `🎉 **【ベット完了】** <@${discordId}> さんが **【${team} チーム】** に **${res.amount}コイン** を賭けました！（残高: ${res.remainingCoins}コイン）`
        });
        return;
      }

      // ⚠️ 2026-09-29 是正: 以前はここに分岐が無く、**失敗すると何も返らなかった**。
      // ユーザーには「⌛ベット処理中です...」が残ったままで、残高不足・受付終了・
      // 認証エラーのいずれで失敗したのか分からず、賭けが成立したのかも判断できなかった。
      // （同じファイルの handleTipCommand は最初から失敗を伝えていたので不整合でもあった）
      await patchInteractionResponse(appId, token, {
        content: `❌ **ベットできませんでした**: ${res?.error || 'コインが不足しているか、受付が終了している可能性があります。'}\n※コインは引かれていません。`
      });
    } catch (e) {
      console.error("Bet submit error:", e);
      await patchInteractionResponse(appId, token, {
        content: `❌ **ベット処理でエラーが発生しました**: ${e.message}\n※コインが引かれたかはポータルの残高で確認してください。`
      }).catch(() => {});
      const { notifyAdminError } = await import('../utils/alert.js');
      await notifyAdminError(env, e, { action: 'handleBetModalSubmit', customId });
    }
  })());

  return Response.json({
    type: 4,
    data: {
      content: `⌛ 【${team} チーム】に ${amount}コイン をベット処理中です...`,
      flags: 64
    }
  });
}

/**
 * 仲間へコインをチップ（投げ銭）する (/tip)
 */
export async function handleTipCommand(interaction, env, ctx) {
  const options = interaction.data?.options || [];
  const targetUserOption = options.find(o => o.name === 'user');
  const amountOption = options.find(o => o.name === 'amount');
  const messageOption = options.find(o => o.name === 'message');

  const toDiscordId = targetUserOption?.value;
  const amount = amountOption?.value || 100;
  const tipMsg = messageOption?.value || 'ナイスキャリー！';

  const fromDiscordId = interaction.member?.user?.id || interaction.user?.id;
  const fromName = interaction.member?.user?.global_name || interaction.member?.user?.username || '不明';

  if (!toDiscordId) {
    return Response.json({
      type: 4,
      data: { content: '⚠️ 送り先のユーザーを指定してください。', flags: 64 }
    });
  }

  if (toDiscordId === fromDiscordId) {
    return Response.json({
      type: 4,
      data: { content: '⚠️ 自分自身にはチップを送れません。', flags: 64 }
    });
  }

  const appId = interaction.application_id;
  const token = interaction.token;

  ctx.waitUntil((async () => {
    try {
      const res = await fetchPortalAPI(env, '/api/bet/tip', {
        fromDiscordId,
        fromName,
        toDiscordId,
        amount,
        message: tipMsg
      });

      if (res && res.success) {
        await patchInteractionResponse(appId, token, {
          content: `🎉 **【チップ送金完了】** <@${fromDiscordId}> さんが <@${toDiscordId}> さんに **${amount}コイン** を贈りました！\n💬 「${tipMsg}」`
        });
      } else {
        await patchInteractionResponse(appId, token, {
          content: `❌ **チップ送信失敗**: ${res?.error || 'コインが不足しているかエラーが発生しました。'}`
        });
      }
    } catch (e) {
      await patchInteractionResponse(appId, token, {
        content: `❌ **エラー**: ${e.message}`
      });
    }
  })());

  return Response.json({ type: 5 });
}

