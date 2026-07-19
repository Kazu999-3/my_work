import { NextResponse } from 'next/server';

// チーム分け4案(A/B/C/D)をまとめてDiscordへ投稿する(#77)。
// メンバーは🇦🇧🇨🇩リアクションで希望を表明→管理者がポータルで採用案を確定して「Discord通知」する運用。
export async function POST(request: Request) {
  try {
    const { proposals } = await request.json();
    if (!Array.isArray(proposals) || proposals.length === 0) {
      return NextResponse.json({ error: '案データがありません。' }, { status: 400 });
    }

    const webhookUrl = process.env.DISCORD_KTM_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json({ error: 'サーバーにWebhook URLが設定されていません。' }, { status: 500 });
    }

    const icons: Record<string, string> = { TOP: '🛡️', JG: '🌲', MID: '🔥', ADC: '🏹', SUP: '✨' };
    const colors = [0x3498db, 0x2ecc71, 0xf1c40f, 0xe67e22]; // A青 B緑 C黄 D橙
    const letters = ['🇦', '🇧', '🇨', '🇩'];

    const embeds = proposals.slice(0, 4).map((prop: any, i: number) => {
      const matchups = ['TOP', 'JG', 'MID', 'ADC', 'SUP'].map((role) => {
        const b = (prop.teamBlue || []).find((p: any) => p.currentRole === role);
        const r = (prop.teamRed || []).find((p: any) => p.currentRole === role);
        return `${icons[role]} \`${b?.name || '-'}\` 🆚 \`${r?.name || '-'}\``;
      }).join('\n');

      const all = [...(prop.teamBlue || []), ...(prop.teamRed || [])];
      const mainCount = all.filter((p: any) => p.currentRole === p.mainLane || p.mainLane === 'ALL' || p.isFixed).length;

      const blueAvg = (prop.teamBlue || []).reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / 5;
      const redAvg = (prop.teamRed || []).reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / 5;
      const bluePct = Math.round((1 / (1 + Math.pow(10, (redAvg - blueAvg) / 400))) * 100);

      return {
        title: `${letters[i]} ${prop.title || `案${prop.id || i + 1}`}`,
        description: matchups,
        color: colors[i % colors.length],
        footer: {
          text: `MMR差: ${prop.mmrDiff ?? '-'} | 第一希望: ${mainCount}/10人 | 勝利予想 B${bluePct}%:R${100 - bluePct}%`,
        },
      };
    });

    const payload = {
      content: '🗳️ **チーム分け候補が出ました！** 好みの案にリアクション（🇦🇧🇨🇩）で投票してください。\n採用案は後ほど「チーム分け完了」で通知されます。',
      embeds,
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: `Discord送信に失敗: ${res.status} ${t}` }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[discord/proposals] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
