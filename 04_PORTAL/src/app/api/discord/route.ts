import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teamBlue, teamRed, spectators } = body;

    if (!teamBlue || !teamRed) {
      return NextResponse.json({ error: 'チームデータが不足しています。' }, { status: 400 });
    }

    const webhookUrl = process.env.DISCORD_KTM_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json({ error: 'サーバーにWebhook URLが設定されていません。(.env.local を確認してください)' }, { status: 500 });
    }

    const formatTeam = (team: any[]) => {
      const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
      return roles.map(r => {
        const p = team.find(player => player.currentRole === r);
        return p ? `**${r}**: ${p.name} (${p.mmr})` : `**${r}**: -`;
      }).join('\n');
    };

    const avgBlue = Math.round(teamBlue.reduce((s:number, p:any) => s + p.mmr, 0) / 5);
    const avgRed = Math.round(teamRed.reduce((s:number, p:any) => s + p.mmr, 0) / 5);

    const payload = {
      content: "<@&ROLE_ID_HERE> チーム分けが完了しました！", // 必要に応じてメンション用ロールIDを設定
      embeds: [
        {
          title: "⚔️ KTM チーム分け結果",
          description: "本日も熱い戦いを期待しています🔥",
          color: 16753920, // 琥珀色
          fields: [
            {
              name: `🟦 BLUE TEAM (Avg: ${avgBlue})`,
              value: formatTeam(teamBlue),
              inline: true
            },
            {
              name: `🟥 RED TEAM (Avg: ${avgRed})`,
              value: formatTeam(teamRed),
              inline: true
            }
          ],
          footer: {
            text: `観戦: ${spectators && spectators.length > 0 ? spectators.join(', ') : 'なし'}`
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

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
    return NextResponse.json({ error: error.message || 'Discordへの送信に失敗しました。' }, { status: 500 });
  }
}
