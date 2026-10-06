import { CONFIG } from '../config.js';
import { patchInteractionResponse, sendDiscordMessage, sendInteractionFollowup } from '../utils/api.js';
import { fetchSupabase } from '../utils/supabase.js';
import { handleLaneCommand, handleStatsCommand } from './commands.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed, extractPlayersFromEmbed, getPortalComponents, getPortalEmbed, getPlaystyleEmbed, getPlaystyleComponents, handleHelpPage, applyDayCardState } from '../ui/embeds.js';
import { parseMessageData, handleAutoMatchEnd } from '../utils/helpers.js';
import { getAdminDiscordIds, markRecruitmentStatus } from '../utils/recruitPermission.js';
import { getKtmRank, getHighestLaneMmr, getPlayerExperienceBadge, getPlayerActiveMark } from '../utils/ktmRank.js';
import { detectDayKey, getDayDef, extractEntryLines, resolveWeekendTargets, buildRecruitmentContent, computeDayStatus, DAY_CAPACITY, RANK_SHORT_JP_MAP, RANK_JP_MAP } from '../utils/recruitmentStatus.js';
import { cleanupOldReminderMessages } from './scheduled.js';
import { notifyAdminError } from '../utils/alert.js';

// ⚠️ 2026-09-29: ここにあったローカルの RANK_JP_MAP を削除し、
// recruitmentStatus.js の export 版へ一本化した（下の import 行に追加済み）。
// 同じ11キーの対応表が **3箇所**（ここ / recruitmentStatus.js / ktmRank.js の RANK_JP）に
// 完全同一の内容で重複しており、片方を直しても他方が古いまま残る構造だった
// （例: 「ダイヤ」を「ダイヤモンド」に変えると募集カードと戦績表示で表記が食い違う）。

/**
 * 旧形式（1枚のカードに土曜・日曜のフィールドが同居）の募集カードかどうか。
 * 新形式のカードは参加者フィールドが1つだけで、曜日はタイトル側が持つ。
 * 旧カードに新ロジックで書き込むと、もう一方の曜日の参加者一覧が消えるため、
 * 移行が終わるまでは書き込まずに案内だけ返す。
 */
function isLegacyPeriodicCard(message) {
  const fields = message?.embeds?.[0]?.fields || [];
  return fields.filter((f) => detectDayKey(f.name) !== null).length >= 2;
}

/** 新形式カードから参加者行を取り出す */
function readDayEntryLines(embed) {
  return extractEntryLines(embed?.fields?.[0]?.value);
}

export async function handleButtonInteraction(interaction, env, ctx) {
  let customId = interaction.data.custom_id;
  const userId = interaction.member?.user?.id || interaction.user?.id;

  // 募集主メニュー（セレクト）を、既存のボタン用アクションIDに読み替えて以降の処理をそのまま再利用する。
  // これで権限チェック等の既存ロジックを一切変えずにUIだけセレクト化できる。
  if (customId.startsWith('recruit_manage:') && Array.isArray(interaction.data.values) && interaction.data.values.length > 0) {
    const owner = customId.split(':')[1];
    const val = interaction.data.values[0];
    const map = { edit: 'edit_recruit_init', upgrade: 'upgrade_to_10', proxy: 'proxy_add_init', close: 'close', close_silent: 'close_silent', delete: 'delete_recruit' };
    if (map[val]) customId = `${map[val]}:${owner}`;
  } else if (customId.startsWith('recruit_manage:')) {
    // 何も選ばれずに閉じられた場合は募集メッセージをそのまま維持
    const metadata = parseMessageData(interaction.message);
    return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
  }

  // ロール選択セレクト（旧: Top/Jg/Mid/Adc/Sup の5ボタン）を、既存の join_role:role:owner
  // 用のIDに読み替えて以降の処理をそのまま再利用する(#①)。
  if (customId.startsWith('join_role_select:') && Array.isArray(interaction.data.values) && interaction.data.values.length > 0) {
    const owner = customId.split(':')[1];
    const role = interaction.data.values[0];
    customId = `join_role:${role}:${owner}`;
  } else if (customId.startsWith('join_role_select:')) {
    // 何も選ばれずに閉じられた場合は募集メッセージをそのまま維持
    const metadata = parseMessageData(interaction.message);
    return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
  }
  const appId = interaction.application_id;
  const token = interaction.token;
  const botToken = env.DISCORD_TOKEN;

  // 🎛️ ポータル・ウェルカム用共通ボタンハンドラー
  if (customId === 'portal_register') {
    return Response.json({
      type: 9,
      data: {
        title: "🎮 サモナー名 ＆ 希望レーン一括登録",
        custom_id: "portal_register_modal",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "ign",
                label: "LoL サモナー名 (Riot ID: 名前#Tag)",
                style: 1,
                placeholder: "例: りくや#JP1 / Faker#KR1",
                required: true,
                max_length: 50
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "main",
                label: "メインレーン",
                style: 1,
                placeholder: "TOP / JG / MID / ADC / SUP / ALL",
                required: true,
                max_length: 10
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "sub",
                label: "サブレーン (2番目に得意なレーン)",
                style: 1,
                placeholder: "TOP / JG / MID / ADC / SUP / なし",
                required: false,
                max_length: 10
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "weight",
                label: "こだわり度 (1:絶対, 2:通常, 3:柔軟)",
                style: 1,
                placeholder: "1, 2, または 3 (未入力は2)",
                required: false,
                max_length: 2
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "ng1",
                label: "NGレーン (行きたくないレーン)",
                style: 1,
                placeholder: "TOP / JG / MID / ADC / SUP (未入力可)",
                required: false,
                max_length: 10
              }
            ]
          }
        ]
      }
    });
  }

  // 🎓 師弟マッチング：弟子登録モーダル
  if (customId === 'mentorship_apply_pupil') {
    return Response.json({
      type: 9,
      data: {
        title: "🌱 師弟マッチング：弟子入り登録 (修行希望)",
        custom_id: "mentorship_pupil_modal",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "lanes",
                label: "希望レーン (1つ選択)",
                style: 1,
                placeholder: "TOP / JG / MID / BOT / SUP のいずれか1つ",
                required: true,
                max_length: 10
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "target_rank",
                label: "目標ランク (目指したいランク)",
                style: 1,
                placeholder: "例: ゴールド / プラチナ / エメラルド",
                required: false,
                max_length: 20
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "champions",
                label: "練習したいチャンピオン (カンマ区切り)",
                style: 1,
                placeholder: "例: ヤスオ, ヨネ, アーリ",
                required: false,
                max_length: 50
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "bio",
                label: "学びたいこと・悩み・ひとこと意気込み",
                style: 2,
                placeholder: "例: CSの取り方やウェーブ管理を安定させたいです！週末夜に通話できます。",
                required: true,
                max_length: 500
              }
            ]
          }
        ]
      }
    });
  }

  // 🥋 師弟マッチング：師匠登録モーダル
  if (customId === 'mentorship_apply_mentor') {
    return Response.json({
      type: 9,
      data: {
        title: "🥋 師弟マッチング：師匠登録 (指導者)",
        custom_id: "mentorship_mentor_modal",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "lanes",
                label: "指導レーン (1つ選択)",
                style: 1,
                placeholder: "TOP / JG / MID / BOT / SUP のいずれか1つ",
                required: true,
                max_length: 10
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "champions",
                label: "得意チャンピオン (カンマ区切り)",
                style: 1,
                placeholder: "例: リー・シン, ジャルヴァンIV, ザック",
                required: false,
                max_length: 50
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "active_hours",
                label: "活動・指導可能時間帯",
                style: 1,
                placeholder: "例: 平日21:00〜24:00 / 週末",
                required: false,
                max_length: 50
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "bio",
                label: "指導方針・アドバイスできる内容",
                style: 2,
                placeholder: "例: リプレイ添削やレーン戦の立ち回りを優しく教えます。初心者歓迎です！",
                required: true,
                max_length: 500
              }
            ]
          }
        ]
      }
    });
  }

  // 🤝 師弟マッチング：弟子カードから師匠を引き受ける (未登録先輩でも即ペア成立)
  //
  // ⚠️ 2026-09-29: ボタン押下で即APIを呼ぶ「ワンポチ」だったが、**ひとことを一切送れなかった**。
  // サーバー側(CLAIM_MENTOR)は元から `message` を受け取る実装なのに画面から渡しておらず、
  // 結果として**立候補した師匠全員が同じ定型文の自己紹介**になり、弟子側は
  // 「どんな人が引き受けてくれたのか」が分からなかった（マッチングの要が機能していない）。
  // 弟子からの申請は最初からメッセージを書けたので非対称でもあった。
  // → 一度モーダルを挟んでひとことを受け取る（任意。空欄なら従来どおり成立する）。
  if (customId.startsWith('mentorship_claim_pupil:')) {
    const pupilProfileId = customId.split(':')[1];
    return Response.json({
      type: 9,
      data: {
        title: '🎓 指導を引き受ける',
        custom_id: `mentorship_claim_modal:${pupilProfileId}`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'message',
                label: 'お相手へのひとこと（任意）',
                style: 2,
                placeholder: '例: JGのルート設計を中心に見ます。週末の夜なら通話できます',
                required: false,
                max_length: 300
              }
            ]
          }
        ]
      }
    });
  }

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
      lane_practice: '🛡️ 不慣れレーン練習中',
      champ_practice: '🧪 キャラ練習中',
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

  if (customId === 'toggle_recruit_notification') {
    const roleId = CONFIG.NOTIFICATION_ROLE_ID;
    if (!roleId) {
      return Response.json({ type: 4, data: { content: "⚠️ 通知ロールIDが設定されていません。", flags: 64 } });
    }

    const guildId = interaction.guild_id;
    if (!guildId) {
      return Response.json({ type: 4, data: { content: "⚠️ サーバーIDが取得できませんでした。", flags: 64 } });
    }

    const userRoles = interaction.member?.roles || [];
    const hasRole = userRoles.includes(roleId);

    ctx.waitUntil((async () => {
      try {
        if (hasRole) {
          // ロール削除
          const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bot ${botToken}`
            }
          });
          if (!res.ok) throw new Error(`Role removal failed: ${res.status} ${await res.text()}`);
          await patchInteractionResponse(appId, token, { content: "🔔 **募集通知ロールを解除しました。**\n以降、メンバー募集時の通知は届きません。" });
        } else {
          // ロール付与
          const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
            method: "PUT",
            headers: {
              "Authorization": `Bot ${botToken}`,
              "Content-Length": "0"
            }
          });
          if (!res.ok) throw new Error(`Role assignment failed: ${res.status} ${await res.text()}`);
          await patchInteractionResponse(appId, token, { content: "🔔 **募集通知ロールを付与しました！**\n以降、メンバー募集時に通知（メンション）が届くようになります。" });
        }
      } catch (err) {
        console.error("Toggle Role Error:", err);
        try {
          await patchInteractionResponse(appId, token, { content: `❌ **ロール操作エラー**: ${err.message}\nBotのロール権限の順位を確認してください。` });
        } catch (e) {
          // 意図的に空: これは「エラーをユーザーへ伝える処理」自体の失敗。
          // ここで更に通知を試みても同じ経路で失敗する可能性が高く、打てる手が無い。
          // 外側のcatchがエラー内容をログに残しており、ユーザーにはロール操作の失敗が見えている。
        }
      }
    })());

    return Response.json({ type: 5, data: { flags: 64 } });
  }

  // 代替クイック募集ボタン（ノーマル / ARAM・メイヘム）
  if (customId === 'quick_substitute_normal' || customId === 'quick_substitute_aram') {
    const isNormal = customId === 'quick_substitute_normal';
    const modeLabel = isNormal ? '🎮 代替ノーマル' : '🔥 代替ARAM/メイヘム';
    const userMention = `<@${userId}>`;

    ctx.waitUntil((async () => {
      try {
        const msgId = interaction.message.id;
        const channelId = interaction.channel_id;

        const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${msgId}`, {
          headers: { "Authorization": `Bot ${botToken}` }
        });
        if (!msgRes.ok) return;
        const msg = await msgRes.json();
        let content = msg.content || '';

        let targetLines = content.split('\n');
        const userLineIdx = targetLines.findIndex(l => l.includes(userMention));

        if (userLineIdx >= 0) {
          // 既にエントリーしている場合は解除
          targetLines = targetLines.filter(l => !l.includes(userMention));
        } else {
          // エントリー追加
          targetLines.push(`- ${userMention} (${modeLabel})`);
        }

        const count = targetLines.filter(l => l.startsWith('- <@')).length;
        const updatedContent = targetLines.join('\n');

        // ボタンのラベルを更新（現在の参加人数）
        const components = msg.components?.map(row => ({
          ...row,
          components: row.components.map(btn => {
            if (btn.custom_id === customId) {
              return { ...btn, label: isNormal ? `🎮 ノーマル行く人！ (${count}/5)` : `🔥 ARAM / メイヘムやる人！ (${count}/5)` };
            }
            return btn;
          })
        })) || msg.components;

        await sendDiscordMessage(`channels/${channelId}/messages/${msgId}`, botToken, "PATCH", {
          content: updatedContent,
          components
        });
      } catch (e) {
        console.error('quick_substitute error:', e);
      }
    })());

    return Response.json({ type: 5, data: { flags: 64 } });
  }

  if (customId.startsWith('join_periodic')) {
    // join_periodic_auto:style   : 土曜・本戦カスタム
    // join_periodic_sunday:style : 日曜・お祭りカスタム
    // style: 'full' | 'single' | 'late'
    //
    // ★ 2026-09-23: 募集カードを土日の2枚に分離したため、この処理は
    //   「押されたカード1枚だけ」を更新する。
    //   以前は1枚のカードに土日のフィールドが同居していた関係で、チャンネル内の
    //   「タイトルに定期カスタムを含むBot投稿」を最大100件走査して fields を丸ごと
    //   コピーして回る同期処理を持っていた。カードが2枚になるとこの同期は
    //   土曜カードの内容で日曜カードを上書きしてしまうため、完全に廃止した。
    const [prefix, rawStyle] = customId.split(':');
    const dayKey = detectDayKey(prefix) || 'sat';
    const def = getDayDef(dayKey);
    const participationStyle = rawStyle || 'full';

    let styleBadge = " 🟢フル";
    if (participationStyle === 'single') styleBadge = " ⏱️1戦のみ";
    else if (participationStyle === 'late') styleBadge = " 🌙途中参加(2戦目〜)";

    const userMention = `<@${userId}>`;

    if (isLegacyPeriodicCard(interaction.message)) {
      return Response.json({
        type: 4,
        data: {
          content: "⚠️ この募集カードは旧形式のため、こちらからは参加を受け付けられません。\n同じチャンネルに投稿されている **土曜／日曜それぞれの募集カード** からエントリーをお願いします🙏",
          flags: 64
        }
      });
    }

    ctx.waitUntil((async () => {
      try {
        const msgId = interaction.message.id;
        const channelId = interaction.channel_id;

        const [msgRes, playerRow] = await Promise.all([
          fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${msgId}`, {
            headers: { "Authorization": `Bot ${botToken}` }
          }),
          fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}&select=mmr,mmr_top,mmr_jg,mmr_mid,mmr_adc,mmr_sup,role_preferences,name,games_top,games_jg,games_mid,games_adc,games_sup,metadata`)
            .then((rows) => (rows && rows.length > 0 ? rows[0] : null))
            .catch((e) => { console.warn('join_periodic: 名簿取得に失敗:', e); return null; }),
        ]);

        if (!msgRes.ok) throw new Error("メッセージ取得失敗");
        const msg = await msgRes.json();
        if (!msg.embeds || msg.embeds.length === 0) throw new Error("Embedが見つかりません");

        const targetEmbed = { ...msg.embeds[0] };

        // --- 参加者行のバッジを組み立てる ---
        const expBadgeStr = ` ${getPlayerExperienceBadge(playerRow).short}`;

        // ランク表記は土曜（最多ランク帯を基準にチーム分けする）でのみ意味を持つ。
        // 日曜はランク不問・MMR変動なしなので出さない。
        let rankStr = "";
        if (def.showRank && playerRow) {
          const tier = getKtmRank(getHighestLaneMmr(playerRow) ?? 0);
          if (tier && tier.name) {
            const shortName = RANK_SHORT_JP_MAP[tier.name] || RANK_JP_MAP[tier.name] || tier.name;
            rankStr = ` 【${shortName}】`;
          }
        }

        let lanePrefStr = "";
        try {
          let pref = playerRow?.role_preferences;
          if (typeof pref === 'string') {
            try { pref = JSON.parse(pref); } catch (e) {}
          }
          if (pref && (pref.primary || pref.secondary)) {
            const p1 = pref.primary && pref.primary !== '指定なし' && pref.primary !== 'なし' ? pref.primary : '';
            const p2 = pref.secondary && pref.secondary !== '指定なし' && pref.secondary !== 'なし' ? pref.secondary : '';
            if (p1 && p2) {
              lanePrefStr = ` 【${p1}/${p2}】`;
            } else if (p1 || p2) {
              lanePrefStr = ` 【${p1 || p2}】`;
            }
          }
        } catch (e) {
          console.warn("role_preferences parse error:", e);
        }

        const entryLine = `- ${userMention}${styleBadge}${expBadgeStr}${rankStr}${lanePrefStr}`;

        // --- 参加者一覧の更新（辞退なら削除、通常ならトグル/スタイル変更）---
        const currentLines = readDayEntryLines(targetEmbed);
        const existingLine = currentLines.find((l) => l.includes(userMention));
        const nextLines = currentLines.filter((l) => !l.includes(userMention));

        if (participationStyle !== 'leave') {
          if (!existingLine || !existingLine.includes(styleBadge)) {
            nextLines.push(entryLine);
          }
        }

        const { status: nextStatus } = applyDayCardState(targetEmbed, dayKey, nextLines);

        const [satTarget, sunTarget] = resolveWeekendTargets();
        const currentTarget = dayKey === 'sun' ? sunTarget : satTarget;
        const newContent = currentTarget ? buildRecruitmentContent(currentTarget, CONFIG.NOTIFICATION_ROLE_ID) : undefined;

        await sendDiscordMessage(`channels/${channelId}/messages/${msgId}`, botToken, "PATCH", {
          ...(newContent ? { content: newContent } : {}),
          embeds: [targetEmbed],
          components: interaction.message.components,
          allowed_mentions: { roles: [] }
        });

        // ★ あと1名になった瞬間にラストワン促進の返信を自動投稿
        // ⚠️ この行は2026-09-26〜09-29の間、未定義の識別子3つ(computeDayStatus /
        // DAY_CAPACITY のimport漏れ ＋ 存在しない targetDayKey)で ReferenceError を投げており、
        // 下の catch が握りつぶしていたため「あと1名」促進が一度も投稿されていなかった。
        // 参加者一覧のPATCH(上)は例外より前なので成功しており、外から見ると正常に見えていた。
        const prevStatus = computeDayStatus(currentLines, DAY_CAPACITY, dayKey);
        let promptContent = null;
        const rankNote = (def.key === 'sat' && nextStatus.dominantTierInfo?.rangeText)
          ? `（${nextStatus.dominantTierInfo.rangeText}対象）`
          : '';

        if (nextStatus.breakdown?.hasBreakdown) {
          const m1JustOne = nextStatus.breakdown.match1Remaining === 1 && (!existingLine || prevStatus.breakdown?.match1Remaining !== 1);
          const m2JustOne = nextStatus.breakdown.match2Remaining === 1 && (!existingLine || prevStatus.breakdown?.match2Remaining !== 1);

          if (m1JustOne) {
            promptContent = `🔥 **【${def.shortName}: 第1試合があと1名で開催確定！${rankNote}】** 21:00からの開幕戦にエントリーしませんか？✨`;
          } else if (m2JustOne && nextStatus.breakdown.isMatch1Ready) {
            promptContent = `🔥 **【${def.shortName}: 第2試合があと1名で10名到達！${rankNote}】** 2戦目からの途中合流で参加しませんか？✨`;
          }
        } else if (nextStatus.remaining === 1 && (!existingLine || prevStatus.remaining !== 1)) {
          promptContent = `🔥 **【${def.shortName}: あと1名で開催確定！${rankNote}】** どなたか最後の1枠で参加しませんか？✨`;
        }

        if (promptContent) {
          await cleanupOldReminderMessages(env, channelId);
          await sendDiscordMessage(`channels/${channelId}/messages`, botToken, "POST", {
            content: promptContent,
            message_reference: { message_id: msgId, fail_if_not_exists: false }
          }).catch((e) => console.warn("あと1名リマインドの送信失敗:", e));
        }
      } catch (err) {
        console.error("join_periodic error:", err);
        // ⚠️ このcatchが2026-09-26〜09-29の間、computeDayStatus の ReferenceError を
        // 3日間握りつぶしていた（「あと1名で開催確定」促進が一度も出なかった）。
        // 参加者一覧のPATCHは例外より前で成功するため、外から見ると正常に見えてしまう。
        // 同じ見落としを防ぐため管理者へ通知する。
        await notifyAdminError(env, err, { action: 'join_periodic(定期カスタムの参加ボタン)', customId });
      }
    })());

    // 自分にだけ見えるメッセージを出さず、静かにコンポーネントのみリアルタイム更新
    return Response.json({ type: 6 });
  }

  if (customId.startsWith('proxy_add_init:')) {
    const ownerId = customId.split(':')[1];
    if (userId !== ownerId) return Response.json({ type: 4, data: { content: "⚠️ 募集主のみ代理追加が可能です。", flags: 64 } });
    return Response.json({
      type: 4, data: {
        content: "📋 **追加したいメンバーを選択してください**", flags: 64,
        components: [{ type: 1, components: [{ type: 5, custom_id: `proxy_add_submit:${ownerId}:${interaction.message.id}`, placeholder: "ユーザーを選択...", min_values: 1, max_values: 5 }] }]
      }
    });
  }

  if (customId.startsWith('proxy_add_submit:')) {
    const [,, origMsgId] = customId.split(':');
    const targetUserIds = interaction.data.values || [];
    const resolvedUsers = interaction.data.resolved?.users || {};
    
    // タイムアウト回避のため、重い処理は ctx.waitUntil に逃がす
    ctx.waitUntil((async () => {
      try {
        const msgRes = await fetch(`https://discord.com/api/v10/channels/${interaction.channel_id}/messages/${origMsgId}`, { headers: { "Authorization": `Bot ${botToken}` } });
        if (!msgRes.ok) throw new Error("元メッセージの取得に失敗しました。");
        
        const origMsg = await msgRes.json();
        const metadata = parseMessageData(origMsg);
        
        let addedCount = 0;
        targetUserIds.forEach(tId => {
          if (metadata.joined.length < metadata.maxCount && !metadata.joined.includes(tId)) {
            metadata.joined.push(tId);
            metadata.names[tId] = resolvedUsers[tId]?.global_name || resolvedUsers[tId]?.username || "Unknown";
            metadata.spectating = metadata.spectating.filter(id => id !== tId);
            addedCount++;
          }
        });

        if (addedCount > 0) {
          await sendDiscordMessage(`channels/${interaction.channel_id}/messages/${origMsgId}`, botToken, "PATCH", {
            content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata)
          });
          // 完了通知（フォローアップ）
          await sendInteractionFollowup(appId, token, { content: `✅ <@${userId}> がメンバーを ${addedCount} 名追加しました。`, flags: 0 });
        }
      } catch (err) {
        console.error("ProxyAdd Error:", err);
        await sendInteractionFollowup(appId, token, { content: `❌ **エラー**: ${err.message}`, flags: 64 });
      }
    })());

    // 即座にレスポンスを返す (type: 7 は現在操作している ephemeral メッセージを更新/消去する)
    return Response.json({ type: 7, data: { content: "⌛ メンバーを追加処理中です...", components: [] } });
  }

  const isPortalAction = customId.startsWith('portal_') || customId.startsWith('admin_');
  if (isPortalAction && !customId.startsWith('admin_fix_match_submit') && customId !== 'portal_menu_cancel') {
    const value = customId;
    const channelId = interaction.channel_id;
    const messageId = interaction.message.id;
    // resetPortal is not needed for buttons since they don't hold "selected" state, but we can still patch the message if we want, or do nothing.
    
    if (value === 'portal_recruit') return Response.json({
      type: 9, data: {
        title: "⚔️ 新規メンバー募集の設定", custom_id: "portal_recruit_modal",
        components: [
          { type: 1, components: [{ type: 4, custom_id: "mode", label: "モード", style: 1, value: "ノーマル", required: true }] },
          { type: 1, components: [{ type: 4, custom_id: "time", label: "開始予定時刻", style: 1, required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "max", label: "最大人数", style: 1, value: "5", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "memo", label: "一言メモ", style: 2, required: false }] }
        ]
      }
    });
    if (value === 'portal_stats') return handleStatsCommand(interaction, env, ctx);
    if (value === 'portal_lane') return handleLaneCommand(interaction, env, ctx);
    if (value === 'portal_ign') return Response.json({ type: 9, data: { title: "📝 サモナー名登録", custom_id: "portal_ign_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "ign", label: "サモナー名 (Riot ID#Tag)", style: 1, placeholder: "Faker#KR1", required: true }] }] } });
    
    if (value === 'admin_fix_match') {
      if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ 管理者のみ実行可能です。", flags: 64 } });
      return Response.json({ type: 9, data: { title: "🛠️ 勝敗修正", custom_id: "admin_fix_match_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "winner", label: "正しい勝利チーム", style: 1, required: true }] }] } });
    }
    if (value === 'admin_adjust_mmr') {
      if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ 管理者のみ実行可能です。", flags: 64 } });
      return Response.json({ type: 9, data: { title: "🛠️ MMR 手動調整", custom_id: "admin_adjust_mmr_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "target", label: "対象名", style: 1, required: true }] }, { type: 1, components: [{ type: 4, custom_id: "role", label: "ロール", style: 1, required: true }] }, { type: 1, components: [{ type: 4, custom_id: "amount", label: "新しいMMR", style: 1, required: true }] }] } });
    }
    if (value === 'portal_help') return Response.json({ type: 4, data: { ...handleHelpPage(), flags: 64 } });
    
    if (value === 'admin_sync_ranks') {
      if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ 管理者のみ実行可能です。", flags: 64 } });
      const discordName = interaction.member?.user?.global_name || interaction.member?.user?.username;
      ctx.waitUntil((async () => {
        try {
          const { fetchPortalAPI } = await import('../utils/api.js');
          const gasData = await fetchPortalAPI(env, '/api/riot/sync-ranks', { discordName });
          await patchInteractionResponse(appId, token, { content: `✅ **同期完了**: ${gasData.message}`, components: [] });
        } catch (err) {
          await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
          await sendInteractionFollowup(appId, token, { content: `❌ **同期エラー**: ${err.message}`, flags: 64 });
        }
      })());
      return Response.json({ type: 7, data: { content: "⌛ Riot API と同期中です（最大5分）...", components: [] } });
    }
    if (value === 'admin_init_mmr') {
      return Response.json({
        type: 4, data: {
          content: "🛡️ **MMRの一括初期化を実行しますか？**",
          components: [{ type: 1, components: [{ type: 2, label: "⚠️ 全員上書き", style: 4, custom_id: "exec_init_mmr:all" }, { type: 2, label: "✅ 未設定のみ", style: 3, custom_id: "exec_init_mmr:new_only" }, { type: 2, label: "キャンセル", style: 2, custom_id: "portal_menu_cancel" }] }],
          flags: 64
        }
      });
    }
  }

  // 即募集(D-08): デフォルト設定でその場で募集を投下
  if (customId.startsWith('quick_recruit:')) {
    const [, qMode, qMax] = customId.split(':');
    const ownerName = interaction.member?.nick || interaction.member?.user?.global_name || interaction.member?.user?.username || "不明";
    const metadata = {
      mode: qMode, time: '', maxCount: parseInt(qMax) || 10, memo: '',
      owner: userId, createdAt: new Date().toISOString(), joined: [], spectating: [],
      roles: { Top: null, Jg: null, Mid: null, Adc: null, Sup: null }, names: { [userId]: ownerName }
    };
    const quickAppId = interaction.application_id;
    const quickToken = interaction.token;

    ctx.waitUntil((async () => {
      const { patchInteractionResponse } = await import('../utils/api.js');
      try {
        const res = await sendDiscordMessage(`channels/${CONFIG.RECRUIT_CHANNEL_ID}/messages`, botToken, "POST", {
          content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata)
        });

        // ⚠️ 2026-09-29 是正: 以前は成否を確認せず、無条件に「⚡ 投下しました！」を返していた。
        // カード投稿が失敗すると**募集が存在しないのに成功表示**になり、募集主は来ない人を待つ。
        // `sendDiscordMessage` は失敗時も throw せずレスポンスを返すため、明示的に確認する。
        // （portal_recruit_modal と同じ問題。本日5件目の「waitUntil＋無条件✅」パターン）
        if (!res.ok) {
          let detail = `HTTP ${res.status}`;
          try { detail += `: ${(await res.clone().text()).slice(0, 200)}`; } catch { /* noop */ }
          await patchInteractionResponse(quickAppId, quickToken, {
            content: `❌ **募集の投稿に失敗しました**（${detail}）\n※募集は作成されていません。時間をおいてもう一度お試しください。`
          }).catch(() => {});
          await notifyAdminError(env, new Error(`クイック即募集のカード投稿に失敗: ${detail}`), {
            action: 'quick_recruit（クイック即募集）', customId, userId
          });
          return;
        }

        await patchInteractionResponse(quickAppId, quickToken, {
          content: `⚡ **${qMode}${qMax}人の募集を #募集板 に投下しました！**（時刻やメモは募集カードの「⚙️ 募集を編集」ボタンから後で設定できます）`
        }).catch(() => {});

        const sentMessage = await res.clone().json();
        const { createRecruitment } = await import('../utils/recruitPermission.js');
        await createRecruitment(env, {
          messageId: sentMessage.id, channelId: CONFIG.RECRUIT_CHANNEL_ID,
          ownerDiscordId: userId, mode: qMode, maxCount: parseInt(qMax) || 10,
        });
        const { fetchPortalAPI } = await import('../utils/api.js');
        await fetchPortalAPI(env, '/api/push/notify-recruit', { mode: qMode, time: '' }).catch(() => {});
      } catch (e) {
        console.error("quick_recruit error:", e);
        await patchInteractionResponse(quickAppId, quickToken, {
          content: `❌ **募集の投稿でエラーが発生しました**: ${e.message}\n※#募集板 にカードが出ているか確認してください。`
        }).catch(() => {});
        await notifyAdminError(env, e, { action: 'quick_recruit（クイック即募集）', customId, userId });
      }
    })());
    // 成否が確定するまで断定しない（結果は上の waitUntil が上書きする）
    return Response.json({ type: 5, data: { flags: 64 } });
  }

  if (customId === 'portal_menu_cancel') return Response.json({ type: 7, data: { content: "✅ 操作をキャンセルしました。", components: [] } });

  if (customId.startsWith('exec_init_mmr:')) {
    if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ この操作は管理者のみ実行可能です。", flags: 64 } });
    const isOverwriteAll = (customId.split(':')[1] === 'all');
    ctx.waitUntil((async () => {
      try {
        const { fetchPortalAPI } = await import('../utils/api.js');
        const gasData = await fetchPortalAPI(env, '/api/admin/init-mmr', { isOverwriteAll });
        await patchInteractionResponse(appId, token, { content: `✅ **実行完了**: ${gasData.message}`, components: [] });
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content: `❌ **エラー**: ${err.message}`, flags: 64 });
      }
    })());
    return Response.json({ type: 7, data: { content: "⌛ 処理を開始しました。少々お待ちください...", components: [] } });
  }

  if (customId.startsWith('win_blue:') || customId.startsWith('win_red:')) {
    const winner = customId.startsWith('win_blue') ? "BLUE" : "RED";
    const players = extractPlayersFromEmbed(interaction.message.embeds[0]);
    return await handleAutoMatchEnd(interaction, players, winner, env, ctx);
  }

  if (customId === 'opgg_scout') {
    const players = extractPlayersFromEmbed(interaction.message.embeds[0]);
    if (players.length === 0) return Response.json({ type: 4, data: { content: "⚠️ プレイヤー情報が見つかりません。", flags: 64 } });
    
    const teamA = players.filter(p => p.team === 'BLUE').map(p => p.name);
    const teamB = players.filter(p => p.team === 'RED').map(p => p.name);
    
    ctx.waitUntil((async () => {
      try {
        const { getPlayersByNames } = await import('../utils/supabase.js');
        const allNames = [...teamA, ...teamB];
        const playersData = await getPlayersByNames(env, allNames);
        
        const getIgn = (name) => {
          const p = playersData.find(pd => pd.name === name);
          return p && p.ign && p.ign.includes('#') ? encodeURIComponent(p.ign) : null;
        };

        const blueIgns = teamA.map(getIgn).filter(ign => ign !== null);
        const redIgns = teamB.map(getIgn).filter(ign => ign !== null);

        let content = "🕵️ **OP.GG スカウティングレポート**\n以下のリンクから両チームの詳細な戦績を確認できます。\n\n";
        
        if (blueIgns.length > 0) {
          content += `🟦 **TEAM BLUE**\nhttps://www.op.gg/multisearch/jp?summoners=${blueIgns.join(encodeURIComponent(','))}\n\n`;
        } else {
          content += `🟦 **TEAM BLUE**: 登録されているIGNがありません\n\n`;
        }
        
        if (redIgns.length > 0) {
          content += `🟥 **TEAM RED**\nhttps://www.op.gg/multisearch/jp?summoners=${redIgns.join(encodeURIComponent(','))}`;
        } else {
          content += `🟥 **TEAM RED**: 登録されているIGNがありません`;
        }
        
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content: content, flags: 64 });
      } catch (err) {
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, { method: "DELETE" });
        await sendInteractionFollowup(appId, token, { content: `❌ **エラー**: ${err.message}`, flags: 64 });
      }
    })());
    
    return Response.json({ type: 5, data: { flags: 64 } });
  }



  // 募集パネル操作
  const metadata = parseMessageData(interaction.message);
  const userName = interaction.member.user.global_name || interaction.member.user.username;
  if (customId.includes(':')) metadata.owner = customId.split(':').pop();

  // 募集主 または システム管理者(env.ADMIN_DISCORD_IDS)を編集・削除許可対象とする（課題②）
  const adminIds = getAdminDiscordIds(env);
  const canManageRecruitment = userId === metadata.owner || adminIds.includes(userId);

  if (customId.startsWith('delete_recruit')) {
    if (!canManageRecruitment) return Response.json({ type: 4, data: { content: "⚠️ 募集主または管理者のみ削除可能です。", flags: 64 } });
    ctx.waitUntil((async () => {
      try {
        await markRecruitmentStatus(env, interaction.message.id, 'deleted');
        const targetIds = [...new Set([metadata.owner, ...(metadata.joined || [])])].filter(Boolean);
        if (targetIds.length > 0) {
          const mentions = targetIds.map(id => `<@${id}>`).join(" ");
          const channelId = interaction.channel_id || interaction.channel?.id;
          const notifyContent = `🗑️ **【募集終了】募集主により募集が削除（解散）されました。**\n参加者の皆様、エントリーありがとうございました。\n通知: ${mentions}`;
          if (channelId && botToken) {
            await sendDiscordMessage(`channels/${channelId}/messages`, botToken, "POST", {
              content: notifyContent,
              message_reference: { message_id: interaction.message.id },
              allowed_mentions: { users: targetIds }
            }).catch(e => console.error("募集削除通知の送信に失敗:", e));
          }
        }
      } catch (e) {
        console.error("recruitments テーブルの削除反映に失敗:", e);
      }
    })());
    return Response.json({ type: 7, data: { content: "🗑️ この募集は削除されました。", embeds: [], components: [] } });
  }

  if (customId.startsWith('edit_recruit_init')) {
    if (!canManageRecruitment) return Response.json({ type: 4, data: { content: "⚠️ 募集主または管理者のみ編集可能です。", flags: 64 } });
    return Response.json({
      type: 9, data: {
        title: "⚙️ 募集内容の編集", custom_id: `edit_recruit_modal:${metadata.owner}`,
        components: [
          { type: 1, components: [{ type: 4, custom_id: "mode", label: "モード", style: 1, value: metadata.mode, required: true }] },
          { type: 1, components: [{ type: 4, custom_id: "time", label: "開始予定時刻", style: 1, value: metadata.time || "", required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "max", label: "最大人数", style: 1, value: metadata.maxCount.toString(), required: false }] },
          { type: 1, components: [{ type: 4, custom_id: "memo", label: "一言メモ", style: 2, value: metadata.memo || "", required: false }] }
        ]
      }
    });
  }

  if (customId.startsWith('proxy_add_init')) {
    if (!canManageRecruitment) return Response.json({ type: 4, data: { content: "⚠️ 募集主または管理者のみ代理追加可能です。", flags: 64 } });
    return Response.json({
      type: 9, data: {
        title: "➕ メンバーの代理追加", custom_id: `proxy_add_modal:${metadata.owner}`,
        components: [
          { type: 1, components: [{ type: 4, custom_id: "player_name", label: "プレイヤー名（または Discord 表示名）", style: 1, placeholder: "例: 助っ人A / たろう", required: true }] },
          { type: 1, components: [{ type: 4, custom_id: "role", label: "参加ロール（任意: TOP/JG/MID/ADC/SUP）", style: 1, placeholder: "空欄なら「指定なし」", required: false }] }
        ]
      }
    });
  }

  // join_any/join_role は同時押しされやすく、interaction.message は「押した瞬間」の
  // スナップショットで古くなりがちなので、直前にメッセージを取り直して競合の窓を狭める
  // （完全な排他制御ではないが、join_periodicと同じ緩和策）。
  const refreshJoinMetadata = async () => {
    try {
      const freshRes = await fetch(`https://discord.com/api/v10/channels/${interaction.channel_id}/messages/${interaction.message.id}`, {
        headers: { "Authorization": `Bot ${botToken}` }
      });
      if (freshRes.ok) {
        Object.assign(metadata, parseMessageData(await freshRes.json()));
      }
    } catch (e) {
      console.warn("join: 最新状態の再取得に失敗、インタラクションのスナップショットで続行:", e);
    }
  };

  if (customId.startsWith('upgrade_to_10')) {
    if (!canManageRecruitment) return Response.json({ type: 4, data: { content: "⚠️ 募集主または管理者のみ拡張可能です。", flags: 64 } });
    metadata.mode = 'カスタム'; metadata.maxCount = 10;
  } else if (customId.startsWith('join_any')) {
    await refreshJoinMetadata();
    if (metadata.joined.includes(userId) && !Object.values(metadata.roles).includes(userId)) {
      // 二度押しで離脱
      metadata.joined = metadata.joined.filter(id => id !== userId);
    } else if (metadata.joined.length < metadata.maxCount) {
      if (!metadata.joined.includes(userId)) {
        metadata.joined.push(userId);
        // 初参加(レーン未設定)ならセットアップ案内をDM
        ctx.waitUntil(sendOnboardingIfNeeded(env, userId));
      }
      metadata.names[userId] = userName;
      metadata.spectating = metadata.spectating.filter(id => id !== userId);
      Object.keys(metadata.roles).forEach(r => { if (metadata.roles[r] === userId) metadata.roles[r] = null; });
    }
  } else if (customId.startsWith('join_role:')) {
    const role = customId.split(':')[1];
    await refreshJoinMetadata();
    if (metadata.roles[role] === userId) {
      // 二度押しで離脱
      metadata.roles[role] = null;
      metadata.joined = metadata.joined.filter(id => id !== userId);
    } else {
      Object.keys(metadata.roles).forEach(r => { if (metadata.roles[r] === userId) metadata.roles[r] = null; });
      if (!metadata.roles[role] && metadata.joined.length < metadata.maxCount) {
        metadata.roles[role] = userId; metadata.names[userId] = userName;
        if (!metadata.joined.includes(userId)) metadata.joined.push(userId);
        metadata.spectating = metadata.spectating.filter(id => id !== userId);
      }
    }
  } else if (customId.startsWith('toggle_spectate')) {
    await refreshJoinMetadata();
    if (!metadata.spectating) metadata.spectating = [];
    if (metadata.spectating.includes(userId)) {
      metadata.spectating = metadata.spectating.filter(id => id !== userId);
    } else {
      metadata.spectating.push(userId);
      metadata.joined = metadata.joined.filter(id => id !== userId);
      Object.keys(metadata.roles).forEach(r => { if (metadata.roles[r] === userId) metadata.roles[r] = null; });
      metadata.names[userId] = userName;
    }
  } else if (customId.startsWith('leave_recruit')) {
    await refreshJoinMetadata();
    metadata.joined = metadata.joined.filter(id => id !== userId);
    if (metadata.spectating) {
      metadata.spectating = metadata.spectating.filter(id => id !== userId);
    }
    Object.keys(metadata.roles).forEach(r => { if (metadata.roles[r] === userId) metadata.roles[r] = null; });
  }

  // 参加者・見学者のアクティブマーク（👑、🔰、🌱、⏳等）を補完
  if (!metadata.badges) metadata.badges = {};
  const allParticipantIds = [...new Set([...(metadata.joined || []), ...(metadata.spectating || [])])];
  const missingBadgeIds = allParticipantIds.filter(id => !metadata.badges[id]);
  if (missingBadgeIds.length > 0) {
    try {
      const idsStr = missingBadgeIds.map(i => `"${i}"`).join(',');
      const pRows = await fetchSupabase(env, 'ktm_players', `discord_id=in.(${idsStr})&select=discord_id,games_top,games_jg,games_mid,games_adc,games_sup,total_games,metadata,days_since_last_match`);
      const pMap = new Map((pRows || []).map(p => [String(p.discord_id), p]));
      for (const id of missingBadgeIds) {
        metadata.badges[id] = getPlayerActiveMark(pMap.get(String(id)));
      }
    } catch (e) {
      console.warn('badges fetch error:', e);
    }
  }

  if (customId.startsWith('close_silent') || customId.startsWith('close')) {
    if (!canManageRecruitment) return Response.json({ type: 4, data: { content: "⚠️ 募集主または管理者のみ募集終了可能です。", flags: 64 } });
    const isSilent = customId.startsWith('close_silent');

    // 募集終了→ボタンなしで閉じる（サイレント以外は参加者に解散・締切通知メッセージを送信）
    // recruitmentsテーブルのstatusも'closed'に反映し、ポータル側が古い募集を
    // 「進行中」として拾い続けないようにする。
    ctx.waitUntil((async () => {
      try {
        await markRecruitmentStatus(env, interaction.message.id, 'closed');
        if (!isSilent) {
          const targetIds = [...new Set([metadata.owner, ...(metadata.joined || [])])].filter(Boolean);
          if (targetIds.length > 0) {
            const mentions = targetIds.map(id => `<@${id}>`).join(" ");
            const isFull = (metadata.joined || []).length >= (metadata.maxCount || 5);
            const channelId = interaction.channel_id || interaction.channel?.id;
            const notifyContent = isFull
              ? `🏁 **【募集終了】** 募集が締め切られました。\n通知: ${mentions}`
              : `⚠️ **【募集終了】人が集まらなかったため、この募集は終了（解散）となりました。**\n参加者の皆様、エントリーありがとうございました！またの機会にご参加ください。\n通知: ${mentions}`;
            
            if (channelId && botToken) {
              await sendDiscordMessage(`channels/${channelId}/messages`, botToken, "POST", {
                content: notifyContent,
                message_reference: { message_id: interaction.message.id },
                allowed_mentions: { users: targetIds }
              }).catch(e => console.error("募集終了通知の送信に失敗:", e));
            } else {
              await sendInteractionFollowup(appId, token, {
                content: notifyContent,
                allowed_mentions: { users: targetIds }
              }).catch(e => console.error("募集終了Followup送信に失敗:", e));
            }
          }
        }
      } catch (e) {
        console.error("recruitments テーブルの終了反映に失敗:", e);
      }
    })());
    const embed = createRecruitEmbed(metadata);
    embed.title = isSilent ? "🔕 募集終了" : "🚨 募集終了";
    embed.color = 0xff0000;
    return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [embed], components: [] } });
  }

  // 自動締切 & メンション (チーム分けは手動ボタンで実行)
  if (metadata.joined.length >= metadata.maxCount && (customId.startsWith('join_any') || customId.startsWith('join_role:'))) {
    ctx.waitUntil((async () => {
      const mentions = [...new Set([metadata.owner, ...metadata.joined])].map(id => `<@${id}>`).join(" ");

      // 満員時に参加者の希望レーン状況をまとめて投稿（チーム分けの参考に）。
      // ポータルでチーム分けするカスタムのみ対象。ノーマル/ARAMでは不要。
      let laneEmbed = null;
      try {
        if (metadata.mode !== 'カスタム') throw new Error('skip:not-custom');
        const { fetchSupabase } = await import('../utils/supabase.js');
        const ids = [...new Set([metadata.owner, ...metadata.joined])];
        const idsStr = ids.map((i) => `"${i}"`).join(',');
        const dbPlayers = await fetchSupabase(env, 'ktm_players', `discord_id=in.(${idsStr})&select=discord_id,name,role_preferences,ng_lane_1,ng_lane_2`);
        const roleCount = { TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0, ALL: 0 };
        const lines = ids.map((id) => {
          const p = (dbPlayers || []).find((x) => x.discord_id === id);
          const nm = metadata.names[id] || p?.name || '不明';
          if (!p || !p.role_preferences?.primary) return `▫️ **${nm}**: 未設定（/lane か「📍レーン設定」で登録を！）`;
          const pr = (p.role_preferences.primary || '-').toUpperCase();
          const sc = (p.role_preferences.secondary || '-').toUpperCase();
          if (roleCount[pr] !== undefined) roleCount[pr]++;
          const ng = [p.ng_lane_1, p.ng_lane_2].filter((v) => v && v !== '-').join(',');
          return `▫️ **${nm}**: ${pr} / ${sc}${ng ? `（NG: ${ng}）` : ''}`;
        });
        // レーン希望を「メイン＋サブ」でカバー人数として集計し、不足レーンを一目で分かるようにする
        const cover = { TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0 };
        (dbPlayers || []).forEach((p) => {
          const pr = (p.role_preferences?.primary || '').toUpperCase();
          const sc = (p.role_preferences?.secondary || '').toUpperCase();
          ['TOP', 'JG', 'MID', 'ADC', 'SUP'].forEach((r) => {
            if (pr === r || sc === r || pr === 'ALL' || sc === 'ALL') cover[r]++;
          });
        });
        const bar = (n) => (n === 0 ? '🚨不足' : n === 1 ? '⚠️1人' : `${n}人`);
        const countLine =
          `**レーン希望（第一希望 / 対応可能）**\n` +
          `\`TOP\` ${roleCount.TOP} / ${bar(cover.TOP)}　\`JG \` ${roleCount.JG} / ${bar(cover.JG)}　\`MID\` ${roleCount.MID} / ${bar(cover.MID)}\n` +
          `\`ADC\` ${roleCount.ADC} / ${bar(cover.ADC)}　\`SUP\` ${roleCount.SUP} / ${bar(cover.SUP)}` +
          (roleCount.ALL ? `　（ALL希望 ${roleCount.ALL}名）` : '');

        // ランク内訳の表示は定期募集(定期カスタム)のみに限定し、都度募集(この募集パネル)には出さない(#③)
        laneEmbed = {
          title: '📍 参加者の希望レーン状況',
          description: `${countLine}\n\n${lines.join('\n')}`,
          color: 0x3498db,
          footer: { text: '表記: メイン / サブ（NG）。ポータルのチーム分けで自動考慮されます。' }
        };
      } catch (e) {
        if (String(e?.message) !== 'skip:not-custom') console.warn('lane summary failed:', e);
      }

      // 🪙 募集成立ボーナス（募集主+100〜200、参加者+50〜100）
      try {
        const { fetchPortalAPI } = await import('../utils/api.js');
        await fetchPortalAPI(env, '/api/bet/recruit-reward', {
          mode: metadata.mode,
          ownerDiscordId: metadata.owner,
          ownerName: metadata.names[metadata.owner],
          joinedDiscordIds: metadata.joined,
          joinedNames: metadata.joined.map(id => metadata.names[id]).filter(Boolean)
        });
      } catch (rewardErr) {
        console.warn('Recruit reward API error:', rewardErr);
      }

      // ノーマル/ARAM募集は満員確定と同時にDBのrecruitmentsステータスもclosedに更新（通知なし・内部状態整理）
      if (metadata.mode === 'ノーマル' || metadata.mode === 'ARAM') {
        await markRecruitmentStatus(env, interaction.message.id, 'closed').catch(() => {});
      }

      // 確定通知は募集パネルへの「返信」としてぶら下げ、メンションは参加者＋募集主に限定する。
      // 独立メッセージ(Followup)のままだとチャンネルの流れから浮くうえ、allowed_mentions未指定のため
      // content内のメンションが無条件に解決されていた(削除・終了通知は既にこの方式に統一済み)。
      const notifyIds = [...new Set([metadata.owner, ...metadata.joined])].filter(Boolean).slice(0, 100);
      const notifyBody = {
        content: `⚔️ **メンバー確定！** 対戦準備を開始してください。\n通知: ${mentions}`,
        ...(laneEmbed ? { embeds: [laneEmbed] } : {}),
        allowed_mentions: { users: notifyIds }
      };
      const notifyChannelId = interaction.channel_id || interaction.channel?.id;
      let notifyReplied = false;
      if (notifyChannelId && botToken) {
        const res = await sendDiscordMessage(`channels/${notifyChannelId}/messages`, botToken, "POST", {
          ...notifyBody,
          message_reference: { message_id: interaction.message.id, fail_if_not_exists: false }
        }).catch((e) => { console.error("メンバー確定通知の返信送信に失敗:", e); return null; });
        // sendDiscordMessage は失敗してもthrowせずresを返すため、ok判定は必須
        notifyReplied = !!(res && res.ok);
      }
      // 返信に失敗した場合だけ従来どおりFollowupで送り、通知そのものは落とさない
      if (!notifyReplied) {
        await sendInteractionFollowup(appId, token, notifyBody)
          .catch((e) => console.error("メンバー確定通知のFollowup送信に失敗:", e));
      }
    })());
    
    const closingMessage = (metadata.mode === 'ノーマル' || metadata.mode === 'ARAM')
      ? "\n🚨 **定員に達しました。対戦準備を開始してください！**" 
      : "\n🚨 **定員に達したため締め切りました。ポータル画面からチーム分けを行ってください。**";
      
    return Response.json({ type: 7, data: { content: createMessageContent(metadata) + closingMessage, embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
  }

  // ★ あと1名になった瞬間にラストワン促進の返信を自動投稿（ノーマル/カスタム共用）
  if (metadata.joined.length === metadata.maxCount - 1 && (customId.startsWith('join_any') || customId.startsWith('join_role:'))) {
    ctx.waitUntil((async () => {
      try {
        const channelId = interaction.channel_id || interaction.channel?.id;
        if (!channelId || !botToken) return;
        const targetPrompt = metadata.mode === 'ノーマル'
          ? `🔥 **【あと1名で出発できます！】** どなたか最後の1枠で合流しませんか？🎮`
          : `🔥 **【あと1名で確定！】** どなたか最後の1枠で参加しませんか？✨`;
        await sendDiscordMessage(`channels/${channelId}/messages`, botToken, "POST", {
          content: targetPrompt,
          message_reference: { message_id: interaction.message.id, fail_if_not_exists: false }
        }).catch(() => {});
      } catch (e) {
        // ⚠️ ここは定期カスタム側(join_periodic)と同じ「あと1名」促進処理。
        // そちらは同型のcatchで ReferenceError を3日間隠していた(2026-09-26〜29)ため、
        // 空catchのままにせず通知する。残り1枠のときだけ走るので乱発しない。
        console.error("あと1名促進(ノーマル)の処理エラー:", e);
        await notifyAdminError(env, e, { action: 'あと1名促進(ノーマル募集)', customId });
      }
    })());
  }

  // ランク帯の内訳表示は定期募集のみに限定するため、都度募集のここでは付与しない(#③)
  return Response.json({ type: 7, data: { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) } });
}

/**
 * 初参加者へのオンボーディングDM。
 * 名簿にレーン希望が未設定のまま参加すると、チーム分けでMMR未設定扱いになり
 * バランスが崩れる。参加ボタンを押した時点で本人に案内を送って予防する。
 */
async function sendOnboardingIfNeeded(env, userId) {
  try {
    const { fetchSupabase } = await import('../utils/supabase.js');
    const rows = await fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}&select=role_preferences,ign`);
    const p = rows && rows[0];
    // 既にレーン希望が設定済みなら何もしない
    if (p && p.role_preferences && p.role_preferences.primary) return;

    // ⚠️ 2026-09-29 是正: 案内していたボタン名が実在しなかった。
    //   「🆔 IGN登録」→ 実際のラベルは「📝 サモナー名変更」（この名前のボタンは存在しない）
    //   「📍レーン設定」→ 実際は「📍 レーン設定変更」
    // 新規の人はDMの通りに探して見つけられない。実ラベル（ui/embeds.js の
    // getPortalComponents）と一致させる。**ボタン名を変えたらここも直すこと。**
    //
    // また「名簿への登録は管理者がDiscord同期を実行すると…」と案内していたが、
    // パネルの説明文は「未登録の方も自動で名簿作成＆ランク同期されます」と書いており
    // **矛盾していた**。実際は緑の「🎮 サモナー名 ＆ 希望レーン登録」を押せば自分で完結する。
    // 管理者待ちだと思わせて止めてしまうのを避け、自分で進める案内に統一した。
    const missing = [];
    if (!p) missing.push('・名簿への登録 → `/portal` を実行し、緑の「🎮 サモナー名 ＆ 希望レーン登録」を押すだけで自動登録されます（管理者を待つ必要はありません）');
    if (!p || !p.role_preferences?.primary) missing.push('・**希望レーンの設定** → `/lane` コマンド、または `/portal` の「📍 レーン設定変更」ボタン');
    if (p && !p.ign) missing.push('・Riot IDの登録 → `/portal` の「📝 サモナー名変更」ボタン（任意。ソロQ戦績と連携できます）');

    const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_id: userId })
    });
    if (!dmRes.ok) return;
    const dm = await dmRes.json();
    await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '👋 KTMカスタムへの参加ありがとうございます！',
          description: `より良いチーム分けのために、以下の設定をお願いします：\n\n${missing.join('\n')}\n\n設定しておくと、あなたの希望レーンや「こだわり度」「格上許可」がチーム分けに反映されます。`,
          // 0x00cfef（シアン）は `.claude/rules/ui-conventions.md` の「寒色系ネオン禁止」に反するため
          // Hextechゴールド（#C89B3C 系）へ変更（2026-09-29）
          color: 0xc2650f,
          footer: { text: 'この案内は設定が完了すると表示されなくなります' }
        }]
      })
    });
  } catch (e) {
    console.warn('[Onboarding] DM送信スキップ:', e?.message);
  }
}

/**
 * 弟子カードからの「指導を引き受ける」を実行する（2026-09-29 切り出し）。
 *
 * 以前はボタン押下で即APIを呼んでいたが、**ひとことを送れない**のが問題だった
 * （サーバー側は元から `message` を受け取る実装なのに画面から渡していなかったため、
 * 立候補した師匠全員が同じ定型文の自己紹介になっていた）。
 * ボタン → モーダル → ここ の流れに変えたため、modals.js から呼べるよう関数化してある。
 *
 * @param {object} interaction モーダル送信のinteraction
 * @param {object} env Workers env（DISCORD_TOKEN注入済み）
 * @param {object} ctx waitUntil用
 * @param {string} pupilProfileId 対象の弟子プロフィールID
 * @param {string} message 引き受け時のひとこと（空文字可）
 */
export async function executeMentorshipClaim(interaction, env, ctx, pupilProfileId, message = '') {
  const appId = interaction.application_id;
  const token = interaction.token;
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const portalUrl = CONFIG.PORTAL_URL;
  const userName = interaction.member?.nick || interaction.member?.user?.global_name || interaction.member?.user?.username || '先輩';

  ctx.waitUntil((async () => {
    try {
      const res = await fetch(`${portalUrl}/api/mentorship/matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // サーバーサイド・ボット実行用の認証ヘッダー
          // ⚠️ ポータル側は SYSTEM_SYNC_KEY / SUPABASE_SERVICE_ROLE_KEY / DISCORD_BOT_TOKEN の
          // 3つを受け付ける実装で、高価値な秘密情報をAPIトークンに流用している点は
          // TODO.md に改善候補として記録済み（専用の SYSTEM_SYNC_KEY へ絞るべき）。
          'x-system-key': env.SYSTEM_SYNC_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '',
        },
        body: JSON.stringify({
          action: 'CLAIM_MENTOR',
          targetProfileId: pupilProfileId,
          message: (message || '').trim(),
          sessionUser: {
            discordId: userId,
            displayName: userName,
            username: interaction.member?.user?.username,
          },
        }),
      });

      const data = await res.json();
      if (data.ok) {
        const threadMsg = data.threadUrl ? `\n\n💬 **[🎓 専用指導チャットはこちら](${data.threadUrl})**` : '';
        await patchInteractionResponse(appId, token, {
          content: `🎉 **【師弟ペア結成完了！】**\n指導を引き受けていただきありがとうございます！✨\n両名にボーナス **+300コイン** を進呈しました！🪙${threadMsg}`,
        });
      } else {
        await patchInteractionResponse(appId, token, {
          content: `⚠️ ペア結成に失敗しました: ${data.error || '不明なエラー'}`,
        });
      }
    } catch (err) {
      console.error('[mentorship_claim] error:', err);
      await patchInteractionResponse(appId, token, {
        content: `❌ 通信エラーが発生しました。時間をおいて再試行してください。`,
      });
      await notifyAdminError(env, err, { action: '師弟: 指導引き受け(CLAIM_MENTOR)', userId });
    }
  })());
}

