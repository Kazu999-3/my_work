import { verifySignature } from './utils/security.js';
import { handleAnnounceMatch, handleLaneCommand, handleRecruitDirect, handleSetIgn, handleStatsCommand, handleMemoCommand } from './handlers/commands.js';
import { handleButtonInteraction } from './handlers/components.js';
import { handleModalSubmit } from './handlers/modals.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const DISCORD_TOKEN = env.DISCORD_TOKEN;
    
    // GAS からのプロキシ通知リクエストを処理
    if (url.pathname === '/announce-match' && request.method === 'POST') {
      const gasSecret = request.headers.get('x-gas-secret');
      const expectedSecret = env.INTERNAL_GAS_SECRET || "ktm_v3_internal_secret_2026";
      
      if (gasSecret !== expectedSecret) {
        console.error(`Unauthorized GAS request: received=${gasSecret}, expected=${expectedSecret}`);
        return new Response('Unauthorized', { status: 401 });
      }
      const payload = await request.json();
      return await handleAnnounceMatch(payload, { ...env, DISCORD_TOKEN }, ctx);
    }
    
    // GAS からのリザルトレポート制作用エンドポイント
    if (url.pathname === '/post-report' && request.method === 'POST') {
      const gasSecret = request.headers.get('x-gas-secret');
      const expectedSecret = env.INTERNAL_GAS_SECRET || "ktm_v3_internal_secret_2026";
      
      if (gasSecret !== expectedSecret) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      const payload = await request.json();
      const channelId = payload.channelId || "1485636511679651871"; // #マッチ結果板
      
      const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${DISCORD_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: payload.content || "",
          embeds: payload.embeds || []
        })
      });
      
      if (!res.ok) {
        return new Response(`Discord Error: ${await res.text()}`, { status: 500 });
      }
      return new Response('OK', { status: 200 });
    }

    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const body = await request.text();

    const DISCORD_PUBLIC_KEY = env.DISCORD_PUBLIC_KEY || "76e0b420148ce039566dd37ee6dd9f23840d701e1d95920d8b001c6779378915";
    const isVerified = await verifySignature(body, signature, timestamp, DISCORD_PUBLIC_KEY);
    if (!isVerified) return new Response('Invalid signature', { status: 401 });

    try {
      const interaction = JSON.parse(body);
      
      // Ping
      if (interaction.type === 1) {
        return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });
      }

      // Application Command
      if (interaction.type === 2) {
        const name = interaction.data.name;
        const context = { ...env, DISCORD_TOKEN }; // トークンを注入
        if (name === 'ign') return await handleSetIgn(interaction, context, ctx);
        if (name === 'recruit') return handleRecruitDirect(interaction);
        if (name === 'stats') return handleStatsCommand(interaction, context, ctx);
        if (name === 'lane') return handleLaneCommand(interaction, context, ctx);
        if (name === 'memo') return await handleMemoCommand(interaction, context, ctx);
        if (name === 'panel') {
          return Response.json({
            type: 4,
            data: {
              content: "🎛️ **KTM 総合コントロールパネル**\n使いたい機能のボタンを押してください。",
              embeds: [],
              components: (await import('./ui/embeds.js')).getPortalComponents(interaction.member?.user?.id || interaction.user?.id)
            }
          });
        }
      }

      // Message Component (Buttons/Select Menus)
      if (interaction.type === 3) return await handleButtonInteraction(interaction, { ...env, DISCORD_TOKEN }, ctx);

      // Modal Submit
      if (interaction.type === 5) return await handleModalSubmit(interaction, { ...env, DISCORD_TOKEN }, ctx);

    } catch (err) {
      console.error("Interaction Error:", err);
      const errBody = JSON.stringify({ 
        type: 4, 
        data: { content: `⚠️ **緊急エラー**: ${err.message}\n\`\`\`${err.stack}\`\`\``, flags: 64 } 
      });
      return new Response(errBody, { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });
  },
};
