import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

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

    const formatMatchup = (role: string) => {
      const icons: Record<string, string> = {
        TOP: '🛡️', JG: '🌲', MID: '🔥', ADC: '🏹', SUP: '✨'
      };
      const pBlue = teamBlue.find((p: any) => p.currentRole === role);
      const pRed = teamRed.find((p: any) => p.currentRole === role);
      
      const blueName = pBlue ? pBlue.name : "-";
      const redName = pRed ? pRed.name : "-";
      
      // スマホでも見やすいVS形式: 🛡️ **TOP**: `BluePlayer` 🆚 `RedPlayer`
      return `${icons[role]} **${role}**: \`${blueName}\` 🆚 \`${redName}\``;
    };

    const matchupsText = ['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(formatMatchup).join('\n\n');
    
    // MMRの平均を計算
    const blueAvgMmr = Math.round(teamBlue.reduce((s: number, p: any) => s + (p.mmr || 1000), 0) / 5);
    const redAvgMmr = Math.round(teamRed.reduce((s: number, p: any) => s + (p.mmr || 1000), 0) / 5);

    const payload: any = {
      content: "🔥 **KTM チーム分けが完了しました！** 🔥\n準備ができたらロビーに参加してください。",
      embeds: [
        {
          title: "⚔️ 本日のマッチアップ",
          description: "左側が `🟦 BLUE TEAM`、右側が `🟥 RED TEAM` です。",
          color: 16753920, // 琥珀色
          fields: [
            {
              name: `🟦 BLUE (Avg: ${blueAvgMmr})  🆚  🟥 RED (Avg: ${redAvgMmr})`,
              value: matchupsText,
              inline: false
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

    // --- ここから待機PITY(spectator_pity)の自動更新処理 ---
    try {
      // 1. 出場者の spectator_pity を 0 にリセット
      const playingNames = [...teamBlue, ...teamRed].map((p: any) => p.name);
      if (playingNames.length > 0) {
        await supabase
          .from('ktm_players')
          .update({ spectator_pity: 0 })
          .in('name', playingNames);
      }

      // 2. 観戦者の spectator_pity を +1
      if (spectators && spectators.length > 0) {
        const { data: specData } = await supabase
          .from('ktm_players')
          .select('id, name, spectator_pity')
          .in('name', spectators);

        if (specData) {
          for (const spec of specData) {
            await supabase
              .from('ktm_players')
              .update({ spectator_pity: (spec.spectator_pity || 0) + 1 })
              .eq('id', spec.id);
          }
        }
      }
    } catch (dbError) {
      console.error('Spectator Pity Update Error:', dbError);
      // Pity更新エラーはDiscord通知自体には影響させないため握りつぶす
    }
    // --- ここまで ---

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Discord Webhook Error:', error);
    return NextResponse.json({ error: error.message || 'Discordへの送信に失敗しました。' }, { status: 500 });
  }
}
