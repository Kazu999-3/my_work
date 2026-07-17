import { CONFIG, getPortalUrl } from '../config.js';
import { fetchGAS, patchInteractionResponse, sendDiscordMessage } from '../utils/api.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed, getPortalComponents, getPortalEmbed } from '../ui/embeds.js';
import { getPlayersByNames, fetchSupabase, upsertPlayer } from '../utils/supabase.js';
import { parseMessageData } from '../utils/helpers.js';

export function handleRecruitDirect(interaction) {
  const options = interaction.data.options || [];
  const getOpt = (name) => options.find(o => o.name === name)?.value;

  const mode = getOpt('mode') || 'カスタム';
  const time = getOpt('time') || '';
  const max = parseInt(getOpt('max') || (mode === 'カスタム' ? 10 : 5));
  const memo = getOpt('memo') || '';
  const userId = interaction.member.user.id;

  const initialJoined = [userId];
  const names = {};
  names[userId] = interaction.member.user.global_name || interaction.member.user.username;

  const resolvedUsers = interaction.data.resolved?.users || {};
  for (let i = 1; i <= 5; i++) {
    const pId = getOpt(`player${i}`);
    if (pId && !initialJoined.includes(pId)) {
      initialJoined.push(pId);
      const user = resolvedUsers[pId];
      if (user) {
        names[pId] = user.global_name || user.username || "Unknown";
      }
    }
  }

  const metadata = {
    mode, time, maxCount: max, memo,
    owner: userId, joined: initialJoined, spectating: [], 
    roles: { Top: null, Jg: null, Mid: null, Adc: null, Sup: null }, names: names
  };

  return Response.json({
    type: 4,
    data: {
      content: createMessageContent(metadata),
      embeds: [createRecruitEmbed(metadata)],
      components: createRecruitButtons(metadata)
    }
  });
}




export function handleStatsCommand(interaction, env, ctx) {
  const discordId = interaction.member.user.id;
  const appId = interaction.application_id;
  const token = interaction.token;

  const discordName = interaction.member.user.global_name || interaction.member.user.username;
  ctx.waitUntil((async () => {
    try {
      const { fetchPortalAPI } = await import('../utils/api.js');
      const data = await fetchPortalAPI(env, "/api/player/stats", { discordId, discordName });
      if (data.status === "NOT_FOUND") {
         await patchInteractionResponse(appId, token, { content: "⚠️ あなたの戦績がまだ登録されていません。\n👉 **次の手順で登録できます**\n1. パネルの「📍 レーン設定」で希望レーンを登録\n2. 一度カスタムに参加して対戦する\n3. 「📝 サモナー名登録」でRiot IDを紐付けるとランクも同期されます" });
         return;
      }
      const s = data.stats;
      const recentIcons = s.recent.map(m => m.win ? "🟦" : "🟥").reverse().join("");
      const embed = {
        title: `📊 戦績板: ${data.player}`,
        fields: [
          { name: "🏆 総合", value: `${s.total.g}戦 ${s.total.w}勝 勝率${(s.total.w/s.total.g*100).toFixed(1)}%`, inline: true },
          { name: "🕒 直近5試合", value: recentIcons || "データなし", inline: true },
          { name: "🏮 現在の不運度 (Pity)", value: `**${data.pity || 0}** pts`, inline: true },
          { name: "📍 ポジション別 (MMR)", value: Object.entries(s.roles).map(([r, rs]) => {
              const mmr = data.mmrs[r] || 1200;
              return `${r}: **${mmr}** (${rs.g}戦 Win:${rs.g > 0 ? (rs.w/rs.g*100).toFixed(0) : 0}%)`;
            }).join("\n"), inline: false }
        ],
        color: 0x3498db
      };
      
      if (data.rivalry && (data.rivalry.nemesis || data.rivalry.prey)) {
        let rivalryText = "";
        if (data.rivalry.nemesis) rivalryText += `💀 よくキルされる相手: **${data.rivalry.nemesis.name}** (${data.rivalry.nemesis.count}回)\n`;
        if (data.rivalry.prey) rivalryText += `🔥 よくキルする相手: **${data.rivalry.prey.name}** (${data.rivalry.prey.count}回)`;
        embed.fields.push({ name: "⚔️ 宿命のライバル", value: rivalryText || "データなし", inline: false });
      }

      // OP.GG リンクの生成 (Riot ID が登録されている場合)
      const components = [];
      if (data.lolIgn && data.lolIgn.includes("#")) {
        const [name, tag] = data.lolIgn.split("#");
        const opggUrl = `https://www.op.gg/summoners/jp/${encodeURIComponent(name)}-${encodeURIComponent(tag)}`;
        components.push({
          type: 1,
          components: [{ type: 2, label: "🌐 OP.GG で詳細を見る", style: 5, url: opggUrl }]
        });
      }

      await sendDiscordMessage(`channels/${CONFIG.STATS_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { embeds: [embed] });
      await patchInteractionResponse(appId, token, { content: "✅ #戦績板 に発表しました！", components });
    } catch (e) { 
      console.error(e); 
      try {
        await patchInteractionResponse(appId, token, { content: `⚠️ エラーが発生しました: ${e.message}` });
      } catch (innerErr) {
        // do nothing
      }
    }
  })());
  return Response.json({ type: 5, data: { flags: 64 } });
}

export async function handleAnnounceMatch(payload, env, ctx) {
  const { teamBlue = [], teamRed = [], spectators = [] } = payload || {};
  console.log("Received AnnounceMatch Payload:", JSON.stringify({ blue: teamBlue.length, red: teamRed.length, spec: spectators.length }));

  // Discord 埋め込みの制限（値が空だとエラーになる）への対策
  // 案L: レーン判定インジケーター付き表示（スプレッドシート経由の場合は mainLane がない可能性あり）
  const renderTeam = (team) => {
    if (!Array.isArray(team) || team.length === 0) return "なし";
    return team.map(p => {
      const role   = String(p.role || p.currentRole || "???").trim();
      const name   = String(p.name || "Unknown").trim();
      const main   = String(p.mainLane || "").toUpperCase();
      const sub    = String(p.subLane  || "").toUpperCase();
      const isMain = main === role || main === 'ALL' || main === '';
      const isSub  = !isMain && sub === role;
      const icon   = isMain ? '✅' : (isSub ? '🔄' : '⚠️');
      const note   = (!isMain && main && main !== 'ALL') ? ` (本来:${main})` : '';
      return `\`${role.padEnd(3)}\` ${icon} ${name}${note}`;
    }).join("\n") || "なし";
  };

  const embed = {
    title: "⚔️ チーム分けの結果 (from Spreadsheet)",
    color: 0x2ecc71,
    fields: [
      { 
        name: "🟦 Team A (Blue)", 
        value: renderTeam(teamBlue), 
        inline: true 
      },
      { 
        name: "🟥 Team B (Red)", 
        value: renderTeam(teamRed), 
        inline: true 
      }
    ],
    footer: { text: "KTM Bot | Spreadsheet Proxy" },
    timestamp: new Date().toISOString()
  };

  if (Array.isArray(spectators) && spectators.length > 0) {
    embed.fields.push({ 
      name: "⏳ カスタム待機", 
      value: spectators.map(n => String(n).trim()).join(", ") || "なし", 
      inline: false 
    });
  }

  const components = [
    {
      type: 1,
      components: [
        { type: 2, label: "🕵️ OP.GG スカウティング", style: 2, custom_id: "opgg_scout" }
      ]
    }
  ];

  try {
    const res = await sendDiscordMessage(`channels/${CONFIG.MATCH_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { embeds: [embed], components });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Discord send error:", res.status, errorText);
      return new Response(JSON.stringify({ status: "ERROR", message: `Discord API Error: ${res.status} - ${errorText}` }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    return Response.json({ status: "SUCCESS" });
  } catch (err) {
    console.error("handleAnnounceMatch unexpected error:", err.message);
    return new Response(JSON.stringify({ status: "ERROR", message: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export function handleLaneCommand(interaction, env, ctx) {
  const options = interaction.data.options || [];
  if (options.length > 0) {
    const getOpt = (name) => options.find(o => o.name === name)?.value;
    let main = getOpt('main'), sub = getOpt('sub') || "", ng1 = getOpt('ng1') || "", ng2 = getOpt('ng2') || "";
    if (main === 'ALL') {
      sub = '-';
    }
    const weight = getOpt('weight'); 
    const allowHigher = getOpt('allow_higher');
    const userId = interaction.member.user.id;
    const appId = interaction.application_id;
    const token = interaction.token;

    const discordName = interaction.member.user.global_name || interaction.member.user.username;
    ctx.waitUntil((async () => {
      try {
        // 現在のプレイヤー情報を取得し、マージしてUpsertする
        let existingData = await fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}`);
        let player = existingData && existingData.length > 0 ? existingData[0] : null;
        
        if (!player) {
          // 名前（またはニックネーム）で既存のプレイヤーを探す
          const nameEscaped = encodeURIComponent(discordName);
          const dataByName = await fetchSupabase(env, 'ktm_players', `name=eq.${nameEscaped}`);
          if (dataByName && dataByName.length > 0) {
            player = dataByName[0];
            // Discord ID を紐付ける
            player.discord_id = userId;
          }
        }
        
        if (!player) {
          // 既存プレイヤーが無ければ新規作成
          player = { discord_id: userId, name: discordName, is_active: true };
        }
        
        player.role_preferences = player.role_preferences || {};
        if (main) player.role_preferences.primary = main;
        if (sub) player.role_preferences.secondary = sub;
        if (ng1) player.ng_lane_1 = ng1;
        if (ng2) player.ng_lane_2 = ng2;
        if (weight) player.weight = parseInt(weight);
        if (allowHigher !== undefined) player.allow_higher = allowHigher === 'true' || allowHigher === true;
        
        await upsertPlayer(env, player);
        await patchInteractionResponse(appId, token, { content: `✅ **引数からレーン設定を完了しました**\nメイン:${main} / サブ:${sub} / こだわり:${weight || "未指定"} / 格上許可:${allowHigher !== undefined ? allowHigher : "未指定"}` });
      } catch (err) { 
        console.error("Lane Update Error:", err); 
        await patchInteractionResponse(appId, token, { content: `❌ **エラーが発生しました:** ${err.message}` }).catch(e => console.error("Error reporting failed:", e));
      }
    })());
    return Response.json({ type: 5 });
  }

  return Response.json({
    type: 9,
    data: {
      title: "📍 希望レーン・NGレーンの設定",
      custom_id: "portal_lane_modal",
      components: [
        { type: 1, components: [{ type: 4, custom_id: "main", label: "メインレーン", style: 1, placeholder: "TOP/JG/MID/ADC/SUP/ALL", required: true }] },
        { type: 1, components: [{ type: 4, custom_id: "sub", label: "サブレーン", style: 1, required: false }] },
        { type: 1, components: [{ type: 4, custom_id: "weight", label: "こだわり度 (1:絶対, 2:通常, 3:柔軟)", style: 1, placeholder: "1, 2, or 3", required: false }] },
        { type: 1, components: [{ type: 4, custom_id: "ng1", label: "NGレーン1", style: 1, required: false }] },
        { type: 1, components: [{ type: 4, custom_id: "ng2", label: "NGレーン2", style: 1, required: false }] }
      ]
    }
  });
}

export async function handleSetIgn(interaction, env, ctx) {
  const options = interaction.data?.options || [];
  const ign = options.find(o => o.name === 'name' || o.name === 'サモナー名')?.value;
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const appId = interaction.application_id;
  const token = interaction.token;

  if (!ign) {
    const errorBody = JSON.stringify({ type: 4, data: { content: "⚠️ サモナー名を入力してください。", flags: 64 } });
    return new Response(errorBody, { headers: { 'Content-Type': 'application/json' } });
  }

  const discordName = (interaction.member?.user || interaction.user).global_name || (interaction.member?.user || interaction.user).username;
  ctx.waitUntil((async () => {
    try {
      const existingData = await fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}`);
      if (!existingData || existingData.length === 0) {
          await patchInteractionResponse(appId, token, { content: "⚠️ 名簿にあなたの Discord ID が見わたりませんでした。新メンバー同期を待つか、一度対戦に参加してください。" });
      } else {
          // Next.js ポータル API経由で IGN と PUUID を登録する
          const res = await fetch(`${getPortalUrl(env)}/api/player/update-puuid`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ discordId: userId, ign: ign })
          });
          const data = await res.json();
          if (data.status === "SUCCESS") {
            await patchInteractionResponse(appId, token, { content: `✅ LoL IGN を **${ign}** に設定し、Riot API との紐付け(PUUID)を完了しました！これ以降、ランク情報が自動同期されます。` });
          } else {
            await patchInteractionResponse(appId, token, { content: `⚠️ IGNは登録されましたが、PUUIDの取得に失敗しました: ${data.message}` });
          }
      }
    } catch (err) {
      console.error("SetIGN Error:", err);
      await patchInteractionResponse(appId, token, { content: `❌ 登録中にエラーが発生しました: ${err.message}` });
    }
  })());
  
  const successBody = JSON.stringify({ 
    type: 4, 
    data: { content: "⌛ IGNの登録を開始しました。処理完了まで少々お待ちください...", flags: 64 } 
  });
  return new Response(successBody, { headers: { 'Content-Type': 'application/json' } });
}



export async function handleMemoCommand(interaction, env, ctx) {
  const options = interaction.data?.options || [];
  const content = options.find(o => o.name === 'content' || o.name === '内容')?.value;
  const appId = interaction.application_id;
  const token = interaction.token;

  if (!content) {
    return Response.json({ type: 4, data: { content: "⚠️ メモ内容またはURLを入力してください。", flags: 64 } });
  }

  ctx.waitUntil((async () => {
    try {
      const portalUrl = getPortalUrl(env);
      const payload = {};
      if (content.startsWith('http://') || content.startsWith('https://')) {
        payload.url = content;
      } else {
        payload.text = content;
      }

      const res = await fetch(`${portalUrl}/api/admin/knowledge/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await patchInteractionResponse(appId, token, { 
          content: `🧠 **ナレッジベースに登録・要約しました！**\n**タイトル**: ${data.data.title}\n**ジャンル**: ${data.data.genre}\n**要約**: ${data.data.content}`
        });
      } else {
        await patchInteractionResponse(appId, token, { 
          content: `❌ **登録に失敗しました**: ${data.error || "未知のエラー"}`
        });
      }
    } catch (err) {
      console.error("Memo command error:", err);
      await patchInteractionResponse(appId, token, { 
        content: `❌ **通信エラー**: ${err.message}`
      });
    }
  })());

  return Response.json({ 
    type: 4, 
    data: { content: "🧠 AIがナレッジベースへの分類・要約処理を行っています。少々お待ちください...", flags: 64 } 
  });
}
