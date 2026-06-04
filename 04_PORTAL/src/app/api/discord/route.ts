import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teamBlue, teamRed, spectators, balanceReport } = body;

    if (!teamBlue || !teamRed) {
      return NextResponse.json({ error: '繝√・繝繝・・繧ｿ縺御ｸ崎ｶｳ縺励※縺・∪縺吶・ }, { status: 400 });
    }

    const webhookUrl = process.env.DISCORD_KTM_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json({ error: '繧ｵ繝ｼ繝舌・縺ｫWebhook URL縺瑚ｨｭ螳壹＆繧後※縺・∪縺帙ｓ縲・.env.local 繧堤｢ｺ隱阪＠縺ｦ縺上□縺輔＞)' }, { status: 500 });
    }

    const formatTeam = (team: any[]) => {
      const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
      return roles.map(r => {
        const p = team.find(player => player.currentRole === r);
        return p ? `**${r}**: ${p.name}` : `**${r}**: -`;
      }).join('\n');
    };

    const payload: any = {
      content: "<@&ROLE_ID_HERE> 繝√・繝蛻・￠縺悟ｮ御ｺ・＠縺ｾ縺励◆・・, // 蠢・ｦ√↓蠢懊§縺ｦ繝｡繝ｳ繧ｷ繝ｧ繝ｳ逕ｨ繝ｭ繝ｼ繝ｫID繧定ｨｭ螳・      embeds: [
        {
          title: "笞費ｸ・KTM 繝√・繝蛻・￠邨先棡",
          description: "譛ｬ譌･繧ら・縺・姶縺・ｒ譛溷ｾ・＠縺ｦ縺・∪縺咀沐･",
          color: 16753920, // 逅･迴濶ｲ
          fields: [
            {
              name: `洶 BLUE TEAM`,
              value: formatTeam(teamBlue),
              inline: true
            },
            {
              name: `衍 RED TEAM`,
              value: formatTeam(teamRed),
              inline: true
            }
          ],
          footer: {
            text: `隕ｳ謌ｦ: ${spectators && spectators.length > 0 ? spectators.join(', ') : '縺ｪ縺・}`
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

    if (balanceReport && Array.isArray(balanceReport)) {
      payload.embeds.push({
        title: "投 繝√・繝蛻・￠縺ｮ逅・罰縺ｨ蛻・梵",
        description: balanceReport.join('\n'),
        color: 3447003, // 髱堤ｳｻ
        fields: [],
        footer: { text: '' },
        timestamp: ''
      });
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Discord API Error: ${res.status} ${res.statusText}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Discord Webhook Error:', error);
    return NextResponse.json({ error: error.message || 'Discord縺ｸ縺ｮ騾∽ｿ｡縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・ }, { status: 500 });
  }
}
