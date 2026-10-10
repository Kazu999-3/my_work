import { sendDiscordMessage, sendInteractionFollowup } from '../../utils/api.js';
import { fetchSupabase } from '../../utils/supabase.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed } from '../../ui/embeds.js';
import { parseMessageData } from '../../utils/helpers.js';
import { getAdminDiscordIds, markRecruitmentStatus } from '../../utils/recruitPermission.js';
import { getPlayerActiveMark } from '../../utils/ktmRank.js';
import { notifyAdminError } from '../../utils/alert.js';
import { recordRecruitmentActivity } from '../../utils/recruitmentAudit.js';

// 募集カードの操作（参加・ロール参加・観戦・離脱・締切・削除・編集・代理追加・10人化）。どのボタンにも該当しなかった場合の最後の処理
// 2026-10-07: handlers/components.js（1,486行）のボタン処理から分割。処理は分割前と同じ（元の判定順のまま）。
export async function handleRecruitCardButtons(interaction, env, ctx, { customId, userId, appId, token, botToken }) {
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

  let auditAction = null;
  let auditStyle = null;

  if (customId.startsWith('upgrade_to_10')) {
    if (!canManageRecruitment) return Response.json({ type: 4, data: { content: "⚠️ 募集主または管理者のみ拡張可能です。", flags: 64 } });
    metadata.mode = 'カスタム'; metadata.maxCount = 10;
  } else if (customId.startsWith('join_any')) {
    await refreshJoinMetadata();
    if (metadata.joined.includes(userId) && !Object.values(metadata.roles).includes(userId)) {
      // 二度押しで離脱
      metadata.joined = metadata.joined.filter(id => id !== userId);
      auditAction = 'LEAVE';
    } else if (metadata.joined.length < metadata.maxCount) {
      if (!metadata.joined.includes(userId)) {
        metadata.joined.push(userId);
        // 初参加(レーン未設定)ならセットアップ案内をDM
        ctx.waitUntil(sendOnboardingIfNeeded(env, userId));
        auditAction = 'JOIN';
        auditStyle = 'any';
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
      auditAction = 'LEAVE';
    } else {
      Object.keys(metadata.roles).forEach(r => { if (metadata.roles[r] === userId) metadata.roles[r] = null; });
      if (!metadata.roles[role] && metadata.joined.length < metadata.maxCount) {
        metadata.roles[role] = userId; metadata.names[userId] = userName;
        if (!metadata.joined.includes(userId)) metadata.joined.push(userId);
        metadata.spectating = metadata.spectating.filter(id => id !== userId);
        auditAction = 'JOIN';
        auditStyle = role;
      }
    }
  } else if (customId.startsWith('toggle_spectate')) {
    await refreshJoinMetadata();
    if (!metadata.spectating) metadata.spectating = [];
    if (metadata.spectating.includes(userId)) {
      metadata.spectating = metadata.spectating.filter(id => id !== userId);
      auditAction = 'LEAVE';
      auditStyle = 'spectate';
    } else {
      metadata.spectating.push(userId);
      metadata.joined = metadata.joined.filter(id => id !== userId);
      Object.keys(metadata.roles).forEach(r => { if (metadata.roles[r] === userId) metadata.roles[r] = null; });
      metadata.names[userId] = userName;
      auditAction = 'JOIN';
      auditStyle = 'spectate';
    }
  } else if (customId.startsWith('leave_recruit')) {
    await refreshJoinMetadata();
    const wasIn = (metadata.joined || []).includes(userId) || (metadata.spectating || []).includes(userId) || Object.values(metadata.roles || {}).includes(userId);
    metadata.joined = metadata.joined.filter(id => id !== userId);
    if (metadata.spectating) {
      metadata.spectating = metadata.spectating.filter(id => id !== userId);
    }
    Object.keys(metadata.roles).forEach(r => { if (metadata.roles[r] === userId) metadata.roles[r] = null; });
    if (wasIn) {
      auditAction = 'LEAVE';
    }
  }

  // 監査ログを非同期記録
  if (auditAction) {
    ctx.waitUntil(
      recordRecruitmentActivity(env, {
        messageId: interaction.message.id,
        recruitmentType: 'spontaneous',
        channelId: interaction.channel_id,
        userId,
        userName,
        action: auditAction,
        style: auditStyle,
        metadata: { mode: metadata.mode, maxCount: metadata.maxCount }
      })
    );
  }

  // 参加者・見学者のアクティブマーク（👑、🔰、🌱、⏳等）および希望レーンを補完
  if (!metadata.badges) metadata.badges = {};
  if (!metadata.lanes) metadata.lanes = {};
  const allParticipantIds = [...new Set([...(metadata.joined || []), ...(metadata.spectating || [])])];
  const missingInfoIds = allParticipantIds.filter(id => !metadata.badges[id] || !metadata.lanes[id]);
  if (missingInfoIds.length > 0) {
    try {
      const idsStr = missingInfoIds.map(i => `"${i}"`).join(',');
      const pRows = await fetchSupabase(env, 'ktm_players', `discord_id=in.(${idsStr})&select=discord_id,games_top,games_jg,games_mid,games_adc,games_sup,total_games,metadata,days_since_last_match,role_preferences`);
      const pMap = new Map((pRows || []).map(p => [String(p.discord_id), p]));
      for (const id of missingInfoIds) {
        const p = pMap.get(String(id));
        if (!metadata.badges[id]) metadata.badges[id] = getPlayerActiveMark(p);
        if (!metadata.lanes[id]) {
          let pr = p?.role_preferences?.primary;
          if (typeof p?.role_preferences === 'string') {
            try { pr = JSON.parse(p.role_preferences)?.primary; } catch {}
          }
          metadata.lanes[id] = (pr && pr !== '指定なし' && pr !== 'なし') ? pr.toUpperCase() : 'ALL';
        }
      }
    } catch (e) {
      console.warn('badges/lanes fetch error:', e);
    }
  }

  // カスタム募集の場合、参加者一覧（metadata.joined）を希望レーン順にソート
  if (metadata.mode === 'カスタム' && Array.isArray(metadata.joined) && metadata.joined.length > 1) {
    const lanePriority = { TOP: 1, JG: 2, MID: 3, ADC: 4, BOT: 4, SUP: 5, ALL: 6 };
    metadata.joined.sort((a, b) => {
      const lA = lanePriority[metadata.lanes?.[a]] || 6;
      const lB = lanePriority[metadata.lanes?.[b]] || 6;
      return lA - lB;
    });
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
        const { fetchSupabase } = await import('../../utils/supabase.js');
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
        const { fetchPortalAPI } = await import('../../utils/api.js');
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
    const { fetchSupabase } = await import('../../utils/supabase.js');
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
    if (!p) missing.push('・名簿への登録 → 案内メッセージ（`/welcome`）の緑「🎮 サモナー名 ＆ 希望レーン登録」を押すだけで自動登録されます（管理者を待つ必要はありません）');
    if (!p || !p.role_preferences?.primary) missing.push('・**希望レーンの設定** → `/lane` コマンド、または案内メッセージの「📍 レーン設定変更」ボタン');
    if (p && !p.ign) missing.push('・Riot IDの登録 → `/ign` コマンド（任意。ソロQ戦績と連携できます）');

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
