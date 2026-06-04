import { CONFIG } from '../config.js';
import { fetchGAS, fetchPortalAPI, sendDiscordMessage, sendInteractionFollowup } from './api.js';

/** parseMessageData: 元メッセージから募集のメタデータを復元する */
export function parseMessageData(message) {
  const content = message.content || "";
  const embed = message.embeds?.[0] || {};
  const footer = embed.footer?.text || "";
  const desc = embed.description || "";

  const timeMatch = content.match(/⏰ \*\*開始予定\*\*: ([\s\S]*?)(?=\n💬 \*\*メモ\*\*|$)/);
  const memoMatch = content.match(/💬 \*\*メモ\*\*: ([\s\S]*)/);

  // 1. サムネイルURLのクエリパラメータから復元を試行 (新方式)
  let data = null;
  const thumbUrl = embed.thumbnail?.url || "";
  if (thumbUrl.includes('metadata=')) {
    try {
      const encodedData = thumbUrl.split('metadata=')[1];
      data = JSON.parse(decodeURIComponent(encodedData));
    } catch (e) { console.error("Thumbnail metadata decode error:", e); }
  }
  
  if (!data) {
    // 2. 旧方式（隠しリンク）からの復元を試行 (互換性維持)
    const metaMatch = desc.match(/\[[\u200b\u17b5]*\]\(http:\/\/metadata\?owner=([^&)]+)(?:&names=([^)]+))?\)/);
    
    data = {
      owner: metaMatch ? metaMatch[1] : "不明",
      maxCount: parseInt(embed.title?.match(/\[\d+\/(\d+)\]/)?.[1] || 10),
      mode: footer.match(/モード: ([^ |\[\n\u200b]+)/)?.[1] || "カスタム",
      time: timeMatch ? timeMatch[1].trim() : "",
      memo: memoMatch ? memoMatch[1].trim() : "",
      joined: [],
      spectating: [],
      roles: { Top: null, Jg: null, Mid: null, Adc: null, Sup: null },
      names: {}
    };

    // Descriptionからメンバーとロールを抽出
    let isSpectatorSection = false;
    desc.split('\n').forEach(line => {
      if (line.includes('SPECTATORS') || line.includes('カスタム待機')) {
        isSpectatorSection = true;
        return;
      }
      const ids = line.match(/<@(\d+)>/g); if (!ids) return;
      ids.forEach(m => {
        const id = m.match(/\d+/)[0];
        if (isSpectatorSection) {
          data.spectating.push(id);
        } else {
          data.joined.push(id);
          ['Top', 'Jg', 'Mid', 'Adc', 'Sup'].forEach(r => { if (line.includes(r)) data.roles[r] = id; });
        }
        data.names[id] = "ユーザー";
      });
    });
    data.joined = [...new Set(data.joined)];

    // 旧リンク内のID→名前マッピングを復元
    if (metaMatch && metaMatch[2]) {
      try {
        const decodedNames = decodeURIComponent(metaMatch[2]);
        decodedNames.split(',').forEach(pair => {
          const eqIdx = pair.indexOf('=');
          if (eqIdx > 0) {
            const id = pair.substring(0, eqIdx);
            const name = pair.substring(eqIdx + 1);
            if (id && name) data.names[id] = name;
          }
        });
      } catch (e) { console.error("Old metadata decode error:", e); }
    }
  }

  if (message.mentions) message.mentions.forEach(u => data.names[u.id] = u.global_name || u.username);
  return data;
}

/** 自動マッチ終了処理の流れ */
export async function handleAutoMatchEnd(interaction, players, winnerTeam, env, ctx) {
  const appId = interaction.application_id;
  const token = interaction.token;

  ctx.waitUntil((async () => {
    try {
      const { fetchPortalAPI } = await import('./api.js');
      const payload = {
        winningTeam: winnerTeam,
        gameDuration: 0,
        participants: players.map(p => ({
          name: p.name,
          team: p.team,
          role: p.role,
          kills: 0,
          deaths: 0,
          assists: 0
        }))
      };

      const resultData = await fetchPortalAPI(env, '/api/match/record', payload);
      
      // 3分後に match-sync を実行
      if (resultData && resultData.matchId) {
        setTimeout(async () => {
          try {
            console.log(`Triggering match-sync for matchId: ${resultData.matchId}`);
            await fetchPortalAPI(env, '/api/riot/match-sync', { matchId: resultData.matchId });
          } catch (err) {
            console.error("Match Sync Delayed Error:", err);
          }
        }, 180000);
      }
    } catch (err) { 
      console.error("AutoLog Error:", err); 
    }
  })());

  const updatedEmbed = interaction.message.embeds[0];
  updatedEmbed.title = `✅ 試合終了: ${winnerTeam} 勝利で記録されました`;
  updatedEmbed.color = winnerTeam === 'BLUE' ? 0x3498db : 0xe74c3c;
  
  if (!updatedEmbed.footer) updatedEmbed.footer = {};
  updatedEmbed.footer.text = `✅ 記録完了 | 約3分後にリザルト自動取得... (ID: ${Math.floor(Date.now() / 1000).toString(16)})`;

  // 勝利報告後のメッセージに「次の試合を振る」ボタンを表示
  const postMatchComponents = [{
    type: 1,
    components: [
      { type: 2, label: "🔄 次の試合を振る", style: 3, custom_id: "rebalance" }
    ]
  }];

  return Response.json({ 
    type: 7, 
    data: { embeds: [updatedEmbed], components: postMatchComponents } 
  });
}
