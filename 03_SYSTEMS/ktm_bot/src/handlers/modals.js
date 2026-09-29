import { CONFIG, getPortalUrl } from '../config.js';
import { sendDiscordMessage } from '../utils/api.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed } from '../ui/embeds.js';
import { parseMessageData, parseStartTime } from '../utils/helpers.js';
import { createRecruitment } from '../utils/recruitPermission.js';

export async function handleModalSubmit(interaction, env, ctx) {
  const customId = interaction.data.custom_id;
  const userId = interaction.member.user.id;

  if (customId === 'portal_recruit_modal') {
    const getVal = (cid) => {
      const row = interaction.data.components.find(c => c.components[0].custom_id === cid);
      return row ? row.components[0].value.trim() : "";
    };
    const rawMode = getVal('mode');
    const mode = (rawMode === 'ノーマル' || rawMode === 'カスタム' || rawMode === 'ARAM') ? rawMode : 'ノーマル';
    const maxCount = parseInt(getVal('max')) || (mode === 'カスタム' ? 10 : 5);
    // 作成者の表示名を names に入れておく。これが無いと募集メッセージが「募集主: 不明」になっていた。
    const ownerName = interaction.member?.nick || interaction.member?.user?.global_name || interaction.member?.user?.username || "不明";
    // createdAt: 投稿時刻を固定保存。これが無いと参加/編集の再描画のたびに日時が「現在時刻」に上書きされていた。
    const metadata = { mode, time: getVal('time'), maxCount, memo: getVal('memo'), owner: userId, createdAt: new Date().toISOString(), joined: [], spectating: [], roles: { Top: null, Jg: null, Mid: null, Adc: null, Sup: null }, names: { [userId]: ownerName } };
    ctx.waitUntil((async () => {
      const res = await sendDiscordMessage(`channels/${CONFIG.RECRUIT_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { content: createMessageContent(metadata), embeds: [createRecruitEmbed(metadata)], components: createRecruitButtons(metadata) });
      try {
        const sentMessage = await res.clone().json();
        // 埋め込みメタデータに加えて recruitments テーブルにも正規に記録する（課題②）。
        // これにより owner 判定が埋め込みJSONのパースだけに依存しなくなる。
        await createRecruitment(env, {
          messageId: sentMessage.id,
          channelId: CONFIG.RECRUIT_CHANNEL_ID,
          ownerDiscordId: userId,
          mode,
          maxCount,
          startAt: parseStartTime(getVal('time')), // 開始予定時刻を解釈できればリマインド対象に
        });
      } catch (e) {
        console.error("recruitments テーブルへの記録に失敗しました（埋め込みメタデータ側は投稿済み）:", e);
      }
      // Web Push通知(#54)。失敗しても無視。
      try {
        const { fetchPortalAPI } = await import('../utils/api.js');
        await fetchPortalAPI(env, '/api/push/notify-recruit', { mode, time: getVal('time') });
      } catch (e) { /* push未設定でもOK */ }
    })());
    return Response.json({ type: 4, data: { content: "✅ **募集を #募集板 に投下しました！**", flags: 64 } });
  }

  if (customId === 'portal_register_modal') {
    const getVal = (cid) => {
      const row = interaction.data.components.find(c => c.components[0].custom_id === cid);
      return row ? row.components[0].value.trim() : "";
    };
    const ign = getVal('ign');
    let main = getVal('main').toUpperCase();
    let sub = getVal('sub').toUpperCase();
    if (main === 'ALL') sub = '-';
    const weightRaw = getVal('weight');
    const weight = weightRaw ? parseInt(weightRaw) : undefined;
    const ng1 = getVal('ng1').toUpperCase();

    const discordName = interaction.member?.nick || interaction.member?.user?.global_name || interaction.member?.user?.username;
    const appId = interaction.application_id;
    const token = interaction.token;

    ctx.waitUntil((async () => {
      try {
        const { fetchPortalAPI, patchInteractionResponse } = await import('../utils/api.js');
        // サモナー名(Riot ID)と希望レーンを一括で名簿作成・更新
        const data = await fetchPortalAPI(env, '/api/player/update-puuid', {
          discordId: userId,
          discordName: discordName,
          ign: ign,
          main: main,
          sub: sub || undefined,
          ng1: ng1 || undefined,
          weight: weight,
        });

        if (data.status === "SUCCESS") {
          const rankMsg = data.rankTier ? ` (現在のランク: **${data.rankTier}** を同期)` : '';
          await patchInteractionResponse(appId, token, {
            content: `🎉 **初期プレイヤー登録が完了しました！**\n\n👤 **サモナー名**: \`${ign}\`${rankMsg}\n📍 **希望レーン**: メイン: \`${main}\` / サブ: \`${sub || 'なし'}\`${ng1 ? ` / NG: \`${ng1}\`` : ''}\n\n👉 これでカスタム対戦や募集にそのまま参加できます！チーム分け時にあなたの希望が最大限考慮されます 🎮`
          });
        } else {
          await patchInteractionResponse(appId, token, {
            content: `⚠️ **登録中にエラーが発生しました**: ${data.message}\n※サモナー名の形式（例: \`名前#JP1\`）をご確認の上、再度お試しください。`
          });
        }
      } catch (err) {
        console.error("Modal Register Error:", err);
        try {
          const { patchInteractionResponse } = await import('../utils/api.js');
          await patchInteractionResponse(appId, token, {
            content: `❌ **登録に失敗しました**: ${err.message}\n👉 サモナー名（\`名前#Tag\`）が正しいかご確認の上、再度お試しください。`
          });
        } catch (e2) {}
      }
    })());

    return Response.json({
      type: 4,
      data: { content: "⌛ Riot API と連携してプレイヤー登録＆希望レーンを設定しています。少々お待ちください...", flags: 64 }
    });
  }

  if (customId === 'portal_ign_modal') {
    const ign = interaction.data.components.find(c => c.components[0].custom_id === 'ign').components[0].value;
    const discordName = interaction.member.user.global_name || interaction.member.user.username;
    const appId = interaction.application_id;
    const token = interaction.token;
    
    ctx.waitUntil((async () => {
      try {
        const { fetchPortalAPI, patchInteractionResponse } = await import('../utils/api.js');
        // Next.js ポータル API経由で IGN と PUUID を登録する（未登録でも自動作成）
        const data = await fetchPortalAPI(env, '/api/player/update-puuid', {
          discordId: userId,
          discordName: discordName,
          ign: ign
        });
        if (data.status === "SUCCESS") {
          const rankMsg = data.rankTier ? ` (現在のランク: **${data.rankTier}** を同期)` : '';
          await patchInteractionResponse(appId, token, { 
            content: `✅ LoL IGN を **${ign}** に設定し、Riot API との紐付けを完了しました！${rankMsg}\n👉 続いて「📍 レーン設定」を行うとチーム分けで希望が通りやすくなります。` 
          });
        } else {
          await patchInteractionResponse(appId, token, { content: `⚠️ 登録中にエラーが発生しました: ${data.message}` });
        }
      } catch (err) {
        console.error("Modal SetIGN Error:", err);
        try {
          const { patchInteractionResponse } = await import('../utils/api.js');
          await patchInteractionResponse(appId, token, { content: `❌ **IGN登録に失敗しました**: ${err.message}\n👉 時間をおいて再度お試しください。繰り返す場合は管理者へ連絡を。` });
        } catch (e2) { /* noop */ }
      }
    })());
    
    return Response.json({ 
      type: 4, 
      data: { content: "⌛ IGNの登録を開始しました。処理完了まで少々お待ちください...", flags: 64 } 
    });
  }

  if (customId === 'portal_lane_modal') {
    const getVal = (cid) => {
      const row = interaction.data.components.find(c => c.components[0].custom_id === cid);
      return row ? row.components[0].value.trim().toUpperCase() : "";
    };
    let main = getVal('main'), sub = getVal('sub'), ng1 = getVal('ng1'), ng2 = getVal('ng2');
    if (main === 'ALL') {
      sub = '-';
    }
    const weightRaw = interaction.data.components.find(c => c.components[0].custom_id === 'weight')?.components[0].value;
    const weight = weightRaw ? parseInt(weightRaw) : undefined;
    
    const discordName = interaction.member.user.global_name || interaction.member.user.username;
    ctx.waitUntil((async () => {
      try {
        // ktm_players はRLSでanon直書き不可。サーバーAPI(サービスロール)経由で更新する。
        const { fetchPortalAPI } = await import('../utils/api.js');
        await fetchPortalAPI(env, '/api/player/update-lane', {
          discordId: userId, discordName, main, sub, ng1, ng2, weight,
        });
      } catch (err) {
        console.error("Modal Lane Update Error:", err);
      }
    })());

    return Response.json({ 
      type: 4, 
      data: { content: `✅ **レーン設定を受付ました**\nメイン:${main} / サブ:${sub} / NG1:${ng1} / NG2:${ng2}\n※反映まで数秒かかる場合があります。`, flags: 64 } 
    });
  }

  if (customId === 'admin_fix_match_modal') {
    if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ 管理者のみ実行可能です。", flags: 64 } });
    const winner = interaction.data.components[0].components[0].value.toUpperCase();
    const { fetchPortalAPI } = await import('../utils/api.js');
    await fetchPortalAPI(env, '/api/admin/fix-match', { winner });
    return Response.json({ type: 4, data: { content: `✅ 直近の試合を **${winner} 勝利** に更新しました。`, flags: 64 } });
  }

  if (customId === 'admin_adjust_mmr_modal') {
    if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ 管理者のみ実行可能です。", flags: 64 } });
    const getVal = (cid) => interaction.data.components[0].components[0] ? interaction.data.components.find(c => c.components[0].custom_id === cid)?.components[0]?.value : null;
    const { fetchPortalAPI } = await import('../utils/api.js');
    // カスタムモーダルの値取得が若干不安定な場合を考慮し安全に取得（すでに元のコードがあるのでそれに準拠）
    const targetName = interaction.data.components.find(c => c.components[0].custom_id === 'target').components[0].value;
    const role = interaction.data.components.find(c => c.components[0].custom_id === 'role').components[0].value;
    const amount = interaction.data.components.find(c => c.components[0].custom_id === 'amount').components[0].value;

    await fetchPortalAPI(env, '/api/admin/adjust-mmr', { targetName, role, amount });
    return Response.json({ type: 4, data: { content: `✅ ${targetName} の ${role} MMRを更新しました。`, flags: 64 } });
  }

  // ⚠️ 2026-09-29: ここにあった `broadcast_modal:`（参加者への一括連絡）を削除した。
  //
  // 削除理由:
  //  1. **到達不能だった**。このモーダルを開くボタン `broadcast_start:` は
  //     `_tests_v3/TEST_SPEC_WORKER.md`（2026-04-17付）に記載があるだけで、
  //     現在のソースには存在しない。つまり誰も使えない死んだコードだった。
  //  2. **復活させると危険な作りだった**。権限チェックが一切無いのに、送信される文面は
  //     「📣 **募集主からの連絡**」と名乗り、参加者・観戦者・募集主の全員へメンションする。
  //     ボタンを付け直した人が気づかないまま、**募集主を騙って全員に通知を飛ばせる**
  //     機能になっていた（他の管理者モーダルは `userId !== CONFIG.ADMIN_ID` で守っている）。
  //  3. 送信失敗が `console.error` だけで、ユーザーには無条件に「✅ 送信しました」を返していた。
  //
  // 同種の連絡が必要になった場合は、**権限チェック（募集主 or 管理者）を必ず入れ、
  // 送信結果を確認してから成功を報告する**こと。

  if (customId === 'mentorship_pupil_modal' || customId === 'mentorship_mentor_modal') {
    const isMentor = customId === 'mentorship_mentor_modal';
    const getVal = (cid) => {
      const row = interaction.data.components.find(c => c.components[0].custom_id === cid);
      return row ? row.components[0].value.trim() : "";
    };

    const lanesRaw = getVal('lanes');
    const parsedLanes = lanesRaw
      ? lanesRaw.split(/[,/、\s]+/).map(s => s.toUpperCase()).filter(Boolean)
      : ['MID'];
    // 師弟関係は単一レーンに絞り込む（先頭の1つのみ採用）
    const lanes = parsedLanes.length > 0 ? [parsedLanes[0]] : ['MID'];
    
    const champsRaw = getVal('champions');
    const champions = champsRaw
      ? champsRaw.split(/[,/、\s]+/).filter(Boolean)
      : [];

    const bio = getVal('bio');
    const targetRank = isMentor ? undefined : (getVal('target_rank') || undefined);
    const activeHours = isMentor ? (getVal('active_hours') || undefined) : undefined;

    const discordName = interaction.member?.nick || interaction.member?.user?.global_name || interaction.member?.user?.username || "Player";

    ctx.waitUntil((async () => {
      try {
        const { fetchPortalAPI } = await import('../utils/api.js');
        await fetchPortalAPI(env, '/api/mentorship/profiles', {
          role_type: isMentor ? 'MENTOR' : 'PUPIL',
          lanes,
          champions,
          target_rank: targetRank,
          active_hours: activeHours,
          bio,
          status: 'OPEN',
          discord_id: userId,
          player_name: discordName,
        });
      } catch (err) {
        console.error('[MentorshipModal] Error saving profile:', err);
      }
    })());

    const roleName = isMentor ? '師匠（指導者）' : '弟子（修行希望）';
    return Response.json({
      type: 4,
      data: {
        content: `✅ **${roleName}として師弟掲示板にエントリーしました！**\n#🤝師弟募集 のダッシュボードと新着カードに反映されます。相性の良いペアが見つかるのをお楽しみに！`,
        flags: 64
      }
    });
  }

  if (customId.startsWith('edit_recruit_modal:')) {
    const getVal = (cid) => interaction.data.components.find(c => c.components[0].custom_id === cid).components[0].value;
    const metadata = parseMessageData(interaction.message);
    
    metadata.mode = getVal('mode');
    metadata.time = getVal('time');
    metadata.maxCount = parseInt(getVal('max')) || metadata.maxCount;
    metadata.memo = getVal('memo');
    
    return Response.json({
      type: 7, 
      data: {
        content: createMessageContent(metadata),
        embeds: [createRecruitEmbed(metadata)],
        components: createRecruitButtons(metadata)
      }
    });
  }

  return Response.json({ type: 4, data: { content: "⚠️ 不明な操作です。パネルを開き直してもう一度お試しください。", flags: 64 } });
}
