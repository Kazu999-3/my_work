import { CONFIG } from '../config.js';
import { patchInteractionResponse } from '../utils/api.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed } from '../ui/embeds.js';
import { parseMessageData } from '../utils/helpers.js';
import { notifyAdminError } from '../utils/alert.js';
import { handleRegistrationMentorshipButtons } from './buttons/registrationMentorship.js';
import { handlePortalBasicsButtons } from './buttons/portalBasics.js';
import { handleNotifySubstituteButtons } from './buttons/notifySubstitute.js';
import { handlePeriodicRecruitButtons } from './buttons/periodicRecruit.js';
import { handleAdminQuickButtons } from './buttons/adminQuickActions.js';
import { handleRecruitCardButtons } from './buttons/recruitCard.js';

// ボタン・セレクトの振り分け。各処理は ./buttons/ にある（2026-10-07 に1,486行から分割。処理と判定順は分割前と同じ）。

// ⚠️ 2026-09-29: ここにあったローカルの RANK_JP_MAP を削除し、
// recruitmentStatus.js の export 版へ一本化した（下の import 行に追加済み）。
// 同じ11キーの対応表が **3箇所**（ここ / recruitmentStatus.js / ktmRank.js の RANK_JP）に
// 完全同一の内容で重複しており、片方を直しても他方が古いまま残る構造だった

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
  const shared = { customId, userId, appId, token, botToken };
  // 元の判定順のまま、該当するグループが応答を返した時点で終わる（同じIDを複数のグループが扱う場合も、先のグループが優先される）
  for (const handle of [
    handleRegistrationMentorshipButtons,
    handlePortalBasicsButtons,
    handleNotifySubstituteButtons,
    handlePeriodicRecruitButtons,
    handleAdminQuickButtons,
  ]) {
    const res = await handle(interaction, env, ctx, shared);
    if (res !== undefined) return res;
  }
  return handleRecruitCardButtons(interaction, env, ctx, shared);
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


