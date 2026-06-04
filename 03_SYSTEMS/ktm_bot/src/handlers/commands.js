import { CONFIG } from '../config.js';
import { fetchGAS, patchInteractionResponse, sendDiscordMessage } from '../utils/api.js';
import { createMessageContent, createRecruitButtons, createRecruitEmbed, getPortalComponents, getPortalEmbed } from '../ui/embeds.js';
import { getPlayersByNames } from '../utils/supabase.js';
import { performAutoBalance } from '../utils/balancer.js';
import { fetchSupabase, upsertPlayer } from '../utils/supabase.js';

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

export function handlePortalCommand(interaction) {
  const userId = interaction.member.user.id;
  if (userId !== CONFIG.ADMIN_ID) return Response.json({ type: 4, data: { content: "⚠️ **権限エラー**: このコマンドは管理者（王）のみ実行可能です。", flags: 64 } });
  return Response.json({ type: 4, data: { embeds: [getPortalEmbed()], components: getPortalComponents(userId) } });
}

export async function handleBalanceCommand(interaction, env, ctx) {
  const GUILD_ID = interaction.guild_id || "1485636149379858567";
  const widgetUrl = `https://discord.com/api/guilds/${GUILD_ID}/widget.json`;
  try {
    const res = await fetch(widgetUrl);
    if (!res.ok) throw new Error("ウィジェットが見つかりません。サーバー設定で有効化してください。");
    const data = await res.json();
    const vcMembers = (data.members || []).filter(m => m.channel_id).map(m => m.nick || m.username);
    if (vcMembers.length !== 10) throw new Error(`VCに10名必要です（現在: ${vcMembers.length}名）`);
    return await executeBalance(interaction, vcMembers, env, ctx);
  } catch (err) {
    return Response.json({ type: 4, data: { content: `⚠️ **エラー**: ${err.message}`, flags: 64 } });
  }
}

export async function executeBalance(interaction, names, env, ctx, isUpdate = false) {
  ctx.waitUntil(performBalance(interaction, names, env, ctx, isUpdate));
  
  if (interaction.type === 3) {
    return Response.json({ type: 6 }); // DEFERRED_UPDATE_MESSAGE (既存メッセージをDeferred更新)
  }
  return Response.json({ type: 5 }); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
}

export async function performBalance(interaction, names, env, ctx, isUpdate = false) {
  const appId = interaction.application_id;
  const token = interaction.token;
  const authorId = interaction.member?.user?.id || interaction.user?.id;

  try {
    // ステップ1:「計算中」表示
    if (isUpdate) {
      // リバランスボタン → MATCHチャンネルに直接「計算中」を投稿（ボットトークン使用）
      await sendDiscordMessage(`channels/${CONFIG.MATCH_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", {
        embeds: [{
          title: "⚙️ チーム分け計算中...",
          description: "最適なチームを計算しています。しばらくお待ちください。",
          color: 0xf39c12,
          footer: { text: "KTM Balancer | 処理中..." }
        }]
      });
    } else {
      // 初回チーム分け → @original（思考中メッセージ）を更新
      await patchInteractionResponse(appId, token, {
        embeds: [{
          title: "⚙️ チーム分け計算中...",
          description: "最適なチームを計算しています。しばらくお待ちください。",
          color: 0xf39c12,
          footer: { text: "KTM Balancer | 処理中..." }
        }],
        components: []
      });
    }

    // ステップ2: Cloudflare Workers内で直接チームバランス計算を行う (GAS依存の脱却)
    let validNames = [...new Set(
      (names || []).map(n => String(n).trim()).filter(n => n && n !== "ユーザー" && n !== "不明")
    )];
    
    // SupabaseからプレイヤーのMMRやレーン設定を取得
    let playersData = [];
    try {
      playersData = await getPlayersByNames(env, validNames);
    } catch (e) {
      throw new Error(`データベース通信エラー: ${e.message}`);
    }

    // データベースにいない未登録ユーザーの仮データ補完
    const dbNames = playersData.map(p => p.name);
    for (const vName of validNames) {
      if (!dbNames.includes(vName)) {
        playersData.push({
          name: vName,
          discord_id: "unknown",
          mmr: 1000,
          role_preferences: { primary: "FILL", secondary: "FILL" }
        });
      }
    }

    // KTMチームバランス計算アルゴリズムの実行
    const data = performAutoBalance(playersData);
    const result = data.result;
    
    const embed = {
      title: "⚔️ チーム分けの結果 (KTM Balancer)",
      color: 0x2ecc71,
      fields: [
        {
          name: "🟦 Team A (Blue)",
          value: result.assignA.map(p => {
            const isMain = p.mainLane === p.currentRole || p.mainLane === 'ALL';
            const isSub  = !isMain && p.subLane === p.currentRole;
            const icon   = isMain ? '✅' : (isSub ? '🔄' : '⚠️');
            const note   = (!isMain && p.mainLane && p.mainLane !== 'ALL') ? ` (本来:${p.mainLane})` : '';
            return `\`${p.currentRole.padEnd(3)}\` ${icon} ${p.name}${note}`;
          }).join("\n"),
          inline: true
        },
        {
          name: "🟥 Team B (Red)",
          value: result.assignB.map(p => {
            const isMain = p.mainLane === p.currentRole || p.mainLane === 'ALL';
            const isSub  = !isMain && p.subLane === p.currentRole;
            const icon   = isMain ? '✅' : (isSub ? '🔄' : '⚠️');
            const note   = (!isMain && p.mainLane && p.mainLane !== 'ALL') ? ` (本来:${p.mainLane})` : '';
            return `\`${p.currentRole.padEnd(3)}\` ${icon} ${p.name}${note}`;
          }).join("\n"),
          inline: true
        }
      ],
      footer: { text: `勝率平準化適用済み | ID: ${Math.floor(Date.now() / 1000).toString(16)}` },
      timestamp: new Date().toISOString()
    };

    if (data.spectators && data.spectators.length > 0) {
      embed.fields.push({ name: "⏳ カスタム待機", value: data.spectators.join(", "), inline: false });
    }

    const components = [
      {
        type: 1,
        components: [
          { type: 2, label: "🟦 BLUE 勝利", style: 1, custom_id: `win_blue:${authorId}` },
          { type: 2, label: "🟥 RED 勝利", style: 4, custom_id: `win_red:${authorId}` },
          { type: 2, label: "🔄 次の試合を振る", style: 3, custom_id: "rebalance" },
          { type: 2, label: "🕵️ OP.GG スカウティング", style: 2, custom_id: "opgg_scout" }
        ]
      }
    ];

    if (isUpdate) {
      // リバランスボタン → MATCHチャンネルに直接投稿（ボットトークン使用）
      await sendDiscordMessage(`channels/${CONFIG.MATCH_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { embeds: [embed], components });
    } else {
      // 初回チーム分け → MATCHチャンネルに通知 + @originalを結果で更新
      await sendDiscordMessage(`channels/${CONFIG.MATCH_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", { content: "🆕 **MATCH START**: 新しい試合が組まれました。", embeds: [embed] });
      await patchInteractionResponse(appId, token, { embeds: [embed], components });
    }

  } catch (err) {
    console.error("PerformBalance Error:", err);
    try {
      if (isUpdate) {
        // リバランス中のエラーもMATCHチャンネルに直接投稿
        await sendDiscordMessage(`channels/${CONFIG.MATCH_CHANNEL_ID}/messages`, env.DISCORD_TOKEN, "POST", {
          embeds: [{
            title: "❌ チーム分けエラー",
            description: `\`\`\`\n${err.message}\n\`\`\``,
            color: 0xe74c3c,
            footer: { text: "再度お試しください" }
          }]
        });
      } else {
        await patchInteractionResponse(appId, token, {
          embeds: [{
            title: "❌ チーム分けエラー",
            description: `\`\`\`\n${err.message}\n\`\`\``,
            color: 0xe74c3c,
            footer: { text: "再度お試しください" }
          }],
          components: []
        });
      }
    } catch (innerErr) {
      console.error("Error reporting failed:", innerErr);
    }
  }
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
         await patchInteractionResponse(appId, token, { content: "⚠️ あなたの Discord ID が登録されていません。" });
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
    } catch (e) { console.error(e); }
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
        { type: 2, label: "🟦 BLUE 勝利", style: 1, custom_id: "win_blue:admin" },
        { type: 2, label: "🟥 RED 勝利", style: 4, custom_id: "win_red:admin" },
        { type: 2, label: "🔄 次の試合を振る", style: 3, custom_id: "rebalance" },
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
    const main = getOpt('main'), sub = getOpt('sub') || "", ng1 = getOpt('ng1') || "", ng2 = getOpt('ng2') || "";
    const weight = getOpt('weight'); 
    const allowHigher = getOpt('allow_higher');
    const userId = interaction.member.user.id;
    const appId = interaction.application_id;
    const token = interaction.token;

    const discordName = interaction.member.user.global_name || interaction.member.user.username;
    ctx.waitUntil((async () => {
      try {
        // 現在のプレイヤー情報を取得し、マージしてUpsertする
        const existingData = await fetchSupabase(env, 'ktm_players', `discord_id=eq.${userId}`);
        const player = existingData && existingData.length > 0 ? existingData[0] : { discord_id: userId, name: discordName, is_active: true };
        
        player.role_preferences = player.role_preferences || {};
        if (main) player.role_preferences.primary = main;
        if (sub) player.role_preferences.secondary = sub;
        if (ng1) player.ng_lane_1 = ng1;
        if (ng2) player.ng_lane_2 = ng2;
        if (weight) player.weight = parseInt(weight);
        if (allowHigher !== undefined) player.allow_higher = allowHigher === 'true' || allowHigher === true;
        
        await upsertPlayer(env, player);
        await patchInteractionResponse(appId, token, { content: `✅ **引数からレーン設定を完了しました**\nメイン:${main} / サブ:${sub} / こだわり:${weight || "未指定"} / 格上許可:${allowHigher !== undefined ? allowHigher : "未指定"}` });
      } catch (err) { console.error("Lane Update Error:", err); }
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
          const player = existingData[0];
          player.ign = ign;
          await upsertPlayer(env, player);
          await patchInteractionResponse(appId, token, { content: `✅ LoL IGN を **${ign}** に設定しました。これ以降、ランク情報が自動同期されます。` });
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


