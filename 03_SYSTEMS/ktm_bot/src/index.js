import { verifySignature } from './utils/security.js';
import { handleAnnounceMatch, handleLaneCommand, handleRecruitDirect, handleSetIgn, handleStatsCommand, handleWelcomeCommand } from './handlers/commands.js';
import { handleButtonInteraction } from './handlers/components.js';
import { handleModalSubmit } from './handlers/modals.js';
import { handleScheduledEvent } from './handlers/scheduled.js';
import { syncPeriodicCardContents } from './handlers/jobs/periodicCards.js';
import { notifyAdminError } from './utils/alert.js';


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const DISCORD_TOKEN = env.DISCORD_TOKEN;
    
    // チャンネル上の既存募集メッセージの本文を最新化するワンショットエンドポイント
    if (url.pathname === '/sync-periodic-content') {
      try {
        const results = await syncPeriodicCardContents({ ...env, DISCORD_TOKEN });
        return new Response(JSON.stringify({ ok: true, results }, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // GAS からのプロキシ通知リクエストを処理
    if (url.pathname === '/announce-match' && request.method === 'POST') {
      const gasSecret = request.headers.get('x-gas-secret');
      const expectedSecret = env.INTERNAL_GAS_SECRET;
      if (!expectedSecret) {
        console.error("INTERNAL_GAS_SECRET is not configured; rejecting request.");
        return new Response('Unauthorized', { status: 401 });
      }
      
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
      const expectedSecret = env.INTERNAL_GAS_SECRET;
      if (!expectedSecret) {
        console.error("INTERNAL_GAS_SECRET is not configured; rejecting request.");
        return new Response('Unauthorized', { status: 401 });
      }
      
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

    // 手動で Scheduled Event をキックする管理者用エンドポイント
    if (url.pathname === '/trigger-scheduled' && request.method === 'GET') {
      const authKey = url.searchParams.get('key');
      const expectedSecret = env.INTERNAL_GAS_SECRET;
      if (!expectedSecret) {
        console.error("INTERNAL_GAS_SECRET is not configured; rejecting request.");
        return new Response('Unauthorized', { status: 401 });
      }
      
      if (authKey !== expectedSecret) {
        console.error(`Unauthorized trigger attempt: key=${authKey}`);
        return new Response('Unauthorized', { status: 401 });
      }

      const mode = url.searchParams.get('mode') || "";

      // ── アラート経路の自己診断 (2026-09-29追加) ──────────────────────────
      // エラー通知は「壊れていても誰も気づけない」のが最大の弱点。
      // エラー管理チャンネルが消えている / Botに投稿権限が無い / チャンネルIDが古い、
      // のいずれでも通知は静かに失敗し、それを知らせる手段が無い（通知が壊れているので）。
      // このモードは実際に1通送り、**HTTPレスポンスで配送結果を返す**。
      // Discordに届かなかった場合でも、curlの応答を見れば壊れていることが分かる。
      //   例) curl "$WORKER_URL/trigger-scheduled?key=$KEY&mode=selftest_alert"
      if (mode === 'selftest_alert') {
        const result = await notifyAdminError(
          { ...env, DISCORD_TOKEN },
          new Error('これはアラート経路の自己診断メッセージです（実際の障害ではありません）'),
          { action: 'selftest_alert' }
        );
        const ok = !!result?.delivered;
        const body = [
          ok ? '✅ アラート経路は生きています。' : '❌ アラートが配送できませんでした。',
          `via=${result?.via ?? 'unknown'}`,
          result?.channelId ? `channelId=${result.channelId}` : null,
          result?.status ? `httpStatus=${result.status}` : null,
          result?.error ? `error=${result.error}` : null,
          '',
          ok
            ? 'Discordのエラー管理チャンネルに診断メッセージが届いているか確認してください。'
            : 'チャンネルの存在・BotのSend Messages権限・CONFIG.ERROR_LOG_CHANNEL_ID の値を確認してください。'
        ].filter(Boolean).join('\n');
        return new Response(body, { status: ok ? 200 : 500 });
      }

      try {
        await handleScheduledEvent({ cron: "manual", mode }, { ...env, DISCORD_TOKEN }, ctx);
        return new Response(`Scheduled event triggered successfully (mode: ${mode})`, { status: 200 });
      } catch (e) {
        console.error("Manual trigger error:", e);
        return new Response(`Manual trigger error: ${e.message}`, { status: 500 });
      }
    }

    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const body = await request.text();

    const DISCORD_PUBLIC_KEY = env.DISCORD_PUBLIC_KEY || "76e0b420148ce039566dd37ee6dd9f23840d701e1d95920d8b001c6779378915";
    const isVerified = await verifySignature(body, signature, timestamp, DISCORD_PUBLIC_KEY);
    if (!isVerified) return new Response('Invalid signature', { status: 401 });

    // ★ 2026-10-07: catch 側の管理者通知でも参照するため try の外で宣言する。以前は try の中の const で、
    // catch から参照すると ReferenceError になり（内側の catch に吸収され）、エラー通知が一度も送られていなかった。
    let interaction = null;
    try {
      interaction = JSON.parse(body);
      
      // Ping
      if (interaction.type === 1) {
        return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });
      }

      // Application Command
      if (interaction.type === 2) {
        const name = interaction.data.name;
        const context = { ...env, DISCORD_TOKEN }; // トークンを注入
        // ⚠️ 2026-09-29: コマンドを21名称 → 7名称へ整理した（ユーザー判断）。
        //
        // 【機能ごと削除】/welcome /welcome-panel（/portal と中身が完全に同じだった）、
        //   /roulette（チャンピオン抽選）、/memo、/patch。実装ファイルも削除済み。
        // 【エイリアス廃止】1機能に複数名称を登録していたため、Discordの選択欄に21個並び
        //   初見のメンバーがどれを選ぶべきか判断できなかった。主名称1つに統一:
        //     /panel /command /ktm_portal → /portal
        //     /bet        → /coins    （/bet は「賭ける」と誤解されるのに残高表示だった）
        //     /rich       → /casino
        //     /send-coins → /tip
        //     /award      → /ranking
        //
        // 🚨 コードを消しただけでは Discord 側の登録は消えない（＝押しても無反応の
        //   幽霊コマンドになる）。`03_SYSTEMS/TOOLS/unregister_discord_commands.mjs` で
        //   登録解除まで行うこと。
        if (name === 'ign') return await handleSetIgn(interaction, context, ctx);
        if (name === 'recruit') return handleRecruitDirect(interaction, context, ctx);
        if (name === 'stats') return handleStatsCommand(interaction, context, ctx);
        if (name === 'lane') return handleLaneCommand(interaction, context, ctx);
        if (name === 'ranking') {
          const { handleRankingCommand } = await import('./handlers/ranking.js');
          return await handleRankingCommand(interaction, context, ctx);
        }
        if (name === 'coins') {
          const { handleCoinsCommand } = await import('./handlers/bet.js');
          return await handleCoinsCommand(interaction, context, ctx);
        }
        if (name === 'casino') {
          const { handleCasinoCommand } = await import('./handlers/bet.js');
          return await handleCasinoCommand(interaction, context, ctx);
        }
        if (name === 'tip') {
          const { handleTipCommand } = await import('./handlers/bet.js');
          return await handleTipCommand(interaction, context, ctx);
        }
        if (name === 'welcome') {
          return await handleWelcomeCommand(interaction, context, ctx);
        }
      }

      // Message Component (Buttons/Select Menus)
      if (interaction.type === 3) {
        const customId = interaction.data?.custom_id || '';
        if (customId.startsWith('bet_team:')) {
          const { handleBetButton } = await import('./handlers/bet.js');
          return handleBetButton(interaction, { ...env, DISCORD_TOKEN }, ctx);
        }
        return await handleButtonInteraction(interaction, { ...env, DISCORD_TOKEN }, ctx);
      }

      // Modal Submit
      if (interaction.type === 5) {
        const customId = interaction.data?.custom_id || '';
        if (customId.startsWith('bet_modal:')) {
          const { handleBetModalSubmit } = await import('./handlers/bet.js');
          return await handleBetModalSubmit(interaction, { ...env, DISCORD_TOKEN }, ctx);
        }
        return await handleModalSubmit(interaction, { ...env, DISCORD_TOKEN }, ctx);
      }

    } catch (err) {
      console.error("Interaction Error:", err);
      // 管理者へアラート通知
      try {
        const interactionData = interaction?.data;
        const context = {
          command: interactionData?.name,
          customId: interactionData?.custom_id,
          userId: interaction?.member?.user?.id || interaction?.user?.id
        };
        ctx?.waitUntil?.(notifyAdminError(env, err, context));
      } catch (alertErr) {
        console.error("Alert dispatch failed:", alertErr);
      }

      const errBody = JSON.stringify({ 
        type: 4, 
        data: { content: `⚠️ **システムエラーが発生しました**: ${err.message}\n管理者に自動通知されました。時間をおいてもう一度お試しください。`, flags: 64 } 
      });
      return new Response(errBody, { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      type: 4,
      data: { content: "⚠️ 不明なコマンドです。パネルを開き直してもう一度お試しください。", flags: 64 }
    }), { headers: { 'Content-Type': 'application/json' } });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        await handleScheduledEvent(event, env, ctx);
      } catch (err) {
        console.error("Scheduled Event Error:", err);
        await notifyAdminError(env, err, { action: 'scheduled', cron: event?.cron });
      }
    })());
  }
};

