import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teamBlue, teamRed, spectators, balanceReport } = body;

    if (!teamBlue || !teamRed) {
      return NextResponse.json({ error: 'チームデータが不足しています。' }, { status: 400 });
    }

    const webhookUrl = process.env.DISCORD_KTM_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json({ error: 'サーバーにWebhook URLが設定されていません。(.env.local を確認してください)' }, { status: 500 });
    }

    const formatTeam = (team: any[]) => {
      const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
      const icons: Record<string, string> = {
        TOP: '🛡️', JG: '🌲', MID: '🔥', ADC: '🏹', SUP: '✨'
      };
      return roles.map(r => {
        const p = team.find(player => player.currentRole === r);
        return p ? `${icons[r]} **${r}**: ${p.name}` : `${icons[r]} **${r}**: -`;
      }).join('\n');
    };

    const payload: any = {
      content: "チーム分けが完了しました！",
      embeds: [
        {
          title: "⚔️ KTM チーム分け結果",
          description: "本日も熱い戦いを期待しています🔥",
          color: 16753920, // 琥珀色
          fields: [
            {
              name: `🟦 BLUE TEAM`,
              value: formatTeam(teamBlue),
              inline: true
            },
            {
              name: `🟥 RED TEAM`,
              value: formatTeam(teamRed),
              inline: true
            }
          ],
          footer: {
            text: `👀 観戦: ${spectators && spectators.length > 0 ? spectators.join(', ') : 'なし'}`
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

    if (balanceReport && Array.isArray(balanceReport)) {
      payload.embeds.push({
        title: "📊 チーム分けの理由と分析",
        description: balanceReport.map((r: string) => `> ${r}`).join('\n\n'),
        color: 3447003, // 青系
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
    return NextResponse.json({ error: error.message || 'Discordへの送信に失敗しました。' }, { status: 500 });
  }
}
