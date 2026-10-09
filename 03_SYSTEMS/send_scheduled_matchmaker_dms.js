/**
 * send_scheduled_matchmaker_dms.js
 * けいろん・ましゃる宛てのシークレットお見合い案内DM（最新後輩ファースト仕様）を送信する
 */
const fs = require('fs');
const path = require('path');

let env = {};
const envPaths = [
  path.join('d:/my_work/04_PORTAL/.env.local'),
  path.join('d:/my_work/04_PORTAL/.env'),
  path.join('d:/my_work/.env')
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    for (const l of lines) {
      const trimmed = l.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        let v = trimmed.slice(idx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        env[k] = v;
      }
    }
  }
}

const botToken = env.DISCORD_BOT_TOKEN;
const portalUrl = env.NEXT_PUBLIC_PORTAL_URL || env.PORTAL_BASE_URL || 'https://sovereign-portal.vercel.app';

// けいろん・ましゃるJasonの対象マッチ情報
const targets = [
  {
    pupil: {
      name: 'けいろん',
      discordId: '408278454283272192',
      primaryLane: 'SUPPORT',
      rank: 'SILVER'
    },
    mentors: [
      {
        matchId: '61c0a4af-10e0-44ca-a825-075bcc11631d',
        name: 'yukizo',
        discordId: '1003955326573355040',
        lanes: ['SUPPORT', 'ADC'],
        rank: 'PLATINUM',
        matchScore: 90,
        reasons: ['同レーン（SUPPORT）完全合致', '教わるのに最適な実力差（PLATINUM ✕ SILVER）']
      }
    ]
  },
  {
    pupil: {
      name: 'ましゃるJason',
      discordId: '176577957895077889',
      primaryLane: 'BOT',
      rank: 'SILVER'
    },
    mentors: [
      {
        matchId: '9c9a329b-d462-41ef-a32e-e237a8fd506a',
        name: 'show',
        discordId: '298840213986476032',
        lanes: ['BOT'],
        rank: 'EMERALD',
        matchScore: 75,
        reasons: ['同レーン（ADC/BOT）完全合致', '教わるのに最適な実力差（EMERALD ✕ SILVER）']
      },
      {
        matchId: '65ef491b-d001-495c-8d73-748416551db7',
        name: 'yukizo',
        discordId: '1003955326573355040',
        lanes: ['SUPPORT', 'ADC'],
        rank: 'PLATINUM',
        matchScore: 60,
        reasons: ['サブ担当レーン（SUPPORT）合致', '教わるのに最適な実力差（PLATINUM ✕ SILVER）']
      }
    ]
  }
];

async function sendDirectMessage(discordId, payload) {
  // 1. DMチャンネル取得
  const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ recipient_id: discordId })
  });

  if (!dmRes.ok) {
    const errText = await dmRes.text();
    throw new Error(`DM channel open failed (${dmRes.status}): ${errText}`);
  }

  const dmChannel = await dmRes.json();

  // 2. メッセージ送信
  const sendRes = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text();
    throw new Error(`DM send failed (${sendRes.status}): ${errText}`);
  }

  return await sendRes.json();
}

async function run() {
  console.log(`[${new Date().toISOString()}] Starting scheduled mentorship DM delivery...`);

  for (const t of targets) {
    console.log(`Sending to ${t.pupil.name} (${t.pupil.discordId})...`);

    const mentorBlocks = t.mentors.map((m, idx) => {
      const numIcons = ['①', '②', '③'];
      const num = numIcons[idx] || `${idx + 1}.`;
      const champs = m.champions?.length > 0 ? `🛡️ **得意**: ${m.champions.slice(0, 4).join(', ')}\n` : '';
      const reasons = m.reasons?.map((r) => `・${r}`).join('\n');
      return (
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `**${num} ${m.name} 先輩** (${m.lanes.join('/')} / ${m.rank}) ★相性 **${m.matchScore}%**\n` +
        champs +
        `💡 **相性理由**:\n${reasons}`
      );
    }).join('\n\n');

    const pupilEmbed = {
      title: `🎒 【教えて先輩！】あなたへのお見合い便が届きました`,
      description:
        `こんにちは、**${t.pupil.name}** さん！\n` +
        `ポータルの名簿データに合わせて、今週相談に乗ってくれる先輩を**${t.mentors.length}名**ご紹介します！✨\n\n` +
        mentorBlocks +
        `\n\n━━━━━━━━━━━━━━━━━━━━\n` +
        `🔒 **安心ルール（完全非公開）**:\n` +
        `**「見送る」を押しても、相手には一切通知されません。**\n` +
        `気になる先輩がいたら、下のボタンからワンタップで繋がれます！`,
      color: 0x10b981, // Emerald
      footer: {
        text: 'KTM シークレットお見合い便 • 完全ダブルオプトイン・見送り無通知'
      }
    };

    const mentorButtons = t.mentors.map((m, idx) => {
      const numIcons = ['①', '②', '③'];
      const num = numIcons[idx] || `${idx + 1}`;
      return {
        type: 2, // Button
        style: 3, // Green (Success)
        label: `🤝 ${num} ${m.name}先輩と話す`,
        custom_id: `secret_match_accept:${m.matchId}`
      };
    });

    const actionRow2 = {
      type: 1,
      components: [
        {
          type: 2,
          style: 2, // Grey
          label: '🍃 今回はすべて見送る',
          custom_id: `secret_match_decline_all:${t.pupil.discordId}`
        },
        {
          type: 2,
          style: 5, // Link
          label: '🌐 ポータルで見る',
          url: `${portalUrl}/mentorship`
        }
      ]
    };

    try {
      const res = await sendDirectMessage(t.pupil.discordId, {
        embeds: [pupilEmbed],
        components: [
          { type: 1, components: mentorButtons },
          actionRow2
        ]
      });
      console.log(`✅ Success for ${t.pupil.name}: Message ID ${res.id}`);
    } catch (err) {
      console.error(`❌ Failed for ${t.pupil.name}:`, err.message);
    }
  }

  console.log('Finished scheduled delivery.');
}

run().catch(console.error);
