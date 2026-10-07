import { CONFIG } from '../../config.js';
import { patchInteractionResponse } from '../../utils/api.js';
import { fetchSupabase } from '../../utils/supabase.js';
import { handleStatsCommand } from '../commands.js';
import { getPortalComponents, getPortalEmbed, getPlaystyleEmbed, getPlaystyleComponents } from '../../ui/embeds.js';
import { getAdminDiscordIds } from '../../utils/recruitPermission.js';

// サモナー名登録・レーン・戦績、ナレッジ承認、募集/ハブ/プレイスタイル（ロール選択）
// 2026-10-07: handlers/components.js（1,486行）のボタン処理から分割。処理は分割前と同じ（元の判定順のまま）。
/** 該当するボタンなら応答を返し、該当しなければ undefined（次の処理へ）を返す */
export async function handlePortalBasicsButtons(interaction, env, ctx, { customId, userId, appId, token, botToken }) {
  if (customId === 'portal_ign') {
    return Response.json({
      type: 9,
      data: {
        title: "📝 サモナー名 (Riot ID) 登録",
        custom_id: "portal_ign_modal",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "ign",
                label: "LoL サモナー名 (Name#Tag)",
                style: 1,
                placeholder: "例: Faker#KR1 / りくや#JP1",
                required: true,
                max_length: 50
              }
            ]
          }
        ]
      }
    });
  }

  if (customId === 'portal_lane') {
    return Response.json({
      type: 9,
      data: {
        title: "📍 希望レーン・NGレーンの設定",
        custom_id: "portal_lane_modal",
        components: [
          { type: 1, components: [{ type: 4, custom_id: "main", label: "メインレーン", style: 1, placeholder: "TOP / JG / MID / ADC / SUP / ALL", required: true }] },
          { type: 1, components: [{ type: 4, custom_id: "sub", label: "サブレーン (2番目に得意)", style: 1, placeholder: "TOP / JG / MID / ADC / SUP", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "weight", label: "こだわり度 (1:絶対, 2:通常, 3:柔軟)", style: 1, placeholder: "1, 2, または 3 (未入力は2)", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "ng1", label: "NGレーン1 (行きたくないレーン)", style: 1, placeholder: "TOP / JG / MID / ADC / SUP", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "ng2", label: "NGレーン2", style: 1, placeholder: "TOP / JG / MID / ADC / SUP", required: false }] }
        ]
      }
    });
  }

  if (customId === 'portal_stats') {
    return handleStatsCommand(interaction, env, ctx);
  }

  // ⚠️ 2026-09-29: portal_roulette ボタンのハンドラを削除した（/roulette 機能ごと削除・ユーザー判断）。
  // handlers/roulette.js も削除済み。このcustom_idを持つ古いメッセージが残っていた場合は
  // 下のフォールスルーで「不明な操作です」が返る（無言で落ちない）。

  // 📚 YouTube解析ナレッジのワンクリック承認
  if (customId.startsWith('approve_knowledge:')) {
    const adminIds = getAdminDiscordIds(env);
    if (!adminIds.includes(userId)) {
      return Response.json({
        type: 4,
        data: { content: '❌ ナレッジの承認権限がありません（管理者のみ操作可能）。', flags: 64 }
      });
    }

    const articleId = customId.split(':')[1];
    try {
      await fetchSupabase(env, 'personal_knowledge', `id=eq.${articleId}`, 'PATCH', {
        review_status: 'verified'
      });

      const memberName = interaction.member?.nick || interaction.user?.global_name || interaction.user?.username || '管理者';
      const updatedComponents = [
        {
          type: 1,
          components: [
            {
              type: 2,
              label: `✅ 承認済み (by ${memberName})`,
              style: 3,
              disabled: true,
              custom_id: `approved_noop:${articleId}`
            },
            {
              type: 2,
              label: '🌐 ポータルで確認',
              style: 5,
              url: `${CONFIG.PORTAL_URL}/admin/knowledge`
            }
          ]
        }
      ];

      return Response.json({
        type: 7, // UPDATE_MESSAGE
        data: {
          components: updatedComponents
        }
      });
    } catch (e) {
      console.error('[approve_knowledge] 承認処理エラー:', e);
      return Response.json({
        type: 4,
        data: { content: `❌ 承認処理に失敗しました: ${e?.message || e}`, flags: 64 }
      });
    }
  }

  if (customId === 'portal_recruit') {
    return Response.json({
      type: 9,
      data: {
        title: "⚔️ メンバー募集の作成",
        custom_id: "portal_recruit_modal",
        components: [
          { type: 1, components: [{ type: 4, custom_id: "mode", label: "ゲームモード", style: 1, placeholder: "ノーマル / カスタム / ARAM", required: true }] },
          { type: 1, components: [{ type: 4, custom_id: "time", label: "開始予定時刻", style: 1, placeholder: "21:00〜 / 今から", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "max", label: "募集人数 (通常は 5 または 10)", style: 1, placeholder: "5 or 10", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "memo", label: "一言メモ", style: 1, placeholder: "初心者歓迎！ VCあり", required: false }] }
        ]
      }
    });
  }

  // 👑 全機能ポータルパネルの表示（エフェメラル）
  if (customId === 'portal_hub') {
    const portalUrl = CONFIG.PORTAL_URL;
    return Response.json({
      type: 4,
      data: {
        embeds: [getPortalEmbed()],
        components: getPortalComponents(userId, portalUrl),
        flags: 64 // 押した本人のみに表示
      }
    });
  }

  // 🎯 プレイスタイル設定パネルの表示（エフェメラル）
  if (customId === 'portal_playstyle') {
    return Response.json({
      type: 4,
      data: {
        embeds: [getPlaystyleEmbed()],
        components: getPlaystyleComponents(),
        flags: 64 // 押した本人のみに表示
      }
    });
  }

  // 🎯 プレイスタイル・志向性ロールのトグル付与/解除
  if (customId.startsWith('playstyle_role:')) {
    const roleKey = customId.split(':')[1];
    const guildId = interaction.guild_id;
    if (!guildId) {
      return Response.json({ type: 4, data: { content: "⚠️ サーバーIDが取得できませんでした。", flags: 64 } });
    }

    const PLAYSTYLE_NAMES = {
      soloq: '🥊 ソロキュー奮闘中',
      flex: '🤝 フレックス希望',
      aram: '❄️ ARAM・サクッと勢',
      casual: '☕ エンジョイ・まったり',
      learner: '📖 教わりたい'
    };
    const roleLabel = PLAYSTYLE_NAMES[roleKey] || roleKey;

    ctx.waitUntil((async () => {
      try {
        // DB (ktm_settings) から playstyle_roles を取得
        const settings = await fetchSupabase(env, 'ktm_settings', 'key=eq.discord_role_sync');
        const config = settings?.[0]?.value;
        const roleId = config?.playstyle_roles?.[roleKey];

        if (!roleId) {
          await patchInteractionResponse(appId, token, {
            content: `⚠️ ロール『${roleLabel}』のIDがまだ設定されていません。\nポータルの管理画面（🎭 ロール連携）から作成・同期を実行してください。`
          });
          return;
        }

        const userRoles = interaction.member?.roles || [];
        const hasRole = userRoles.includes(roleId);

        if (hasRole) {
          // 解除 (DELETE)
          const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bot ${botToken}` }
          });
          if (!res.ok) throw new Error(`Role removal failed: ${res.status} ${await res.text()}`);
          await patchInteractionResponse(appId, token, {
            content: `🗑️ **『${roleLabel}』を解除しました。**\nいつでもボタンから再度付与できます。`
          });
        } else {
          // 付与 (PUT)
          const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
            method: "PUT",
            headers: { "Authorization": `Bot ${botToken}`, "Content-Length": "0" }
          });
          if (!res.ok) throw new Error(`Role assignment failed: ${res.status} ${await res.text()}`);
          await patchInteractionResponse(appId, token, {
            content: `✅ **『${roleLabel}』を付与しました！**\n名簿やプロフィールに反映されます。`
          });
        }
      } catch (err) {
        console.error("[playstyle_role] Error:", err);
        try {
          await patchInteractionResponse(appId, token, {
            content: `❌ **ロール操作エラー**: ${err.message}\nBotのロール権限の順位を確認してください。`
          });
        } catch (_) {}
      }
    })());

    return Response.json({
      type: 5,
      data: { flags: 64 }
    });
  }


  return undefined;
}
