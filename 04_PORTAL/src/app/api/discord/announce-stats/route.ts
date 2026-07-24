import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { players } = await request.json();
    const webhookUrl = process.env.DISCORD_KTM_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json({ error: 'Discord Webhook URLが設定されていません。' }, { status: 500 });
    }

    if (!players || !Array.isArray(players) || players.length === 0) {
      return NextResponse.json({ error: 'プレイヤーリストが空です。' }, { status: 400 });
    }

    // 1. アクティブ（参加者）の集計
    // is_active === true かつ見学固定(is_spectator_fixed)ではない人をカウント
    const activePlayers = players.filter((p: any) => p.is_active && !p.is_spectator_fixed);
    const activeCount = activePlayers.length;

    if (activeCount === 0) {
      return NextResponse.json({ error: 'アクティブな参加プレイヤーがいません。' }, { status: 400 });
    }

    // 2. 平均レートの計算
    const totalMmr = activePlayers.reduce((sum: number, p: any) => sum + (p.mmr ? Number(p.mmr) : 1200), 0);
    const avgMmr = Math.round(totalMmr / activeCount);

    // 3. 希望レーン被り集計 (第一希望)
    const laneCount: Record<string, string[]> = { TOP: [], JG: [], MID: [], ADC: [], SUP: [], ALL: [], FILL: [] };
    activePlayers.forEach((p: any) => {
      const primary = (p.role_preferences?.primary || 'ALL').toUpperCase();
      const name = p.name;
      if (laneCount[primary] !== undefined) {
        laneCount[primary].push(name);
      } else {
        laneCount['ALL'].push(name);
      }
    });

    const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
    const icons: Record<string, string> = { TOP: '🛡️', JG: '🌲', MID: '🔥', ADC: '🏹', SUP: '✨' };
    
    let laneStatusText = roles.map(role => {
      const names = laneCount[role] || [];
      const count = names.length;
      const warning = count >= 3 ? ' ⚠️被り！' : '';
      return `${icons[role]} **${role}**: ${count}人 ${names.length > 0 ? `(${names.join(', ')})` : ''}${warning}`;
    }).join('\n');

    // ALL/FILL の集計があれば追記
    const fillCount = (laneCount['ALL']?.length || 0) + (laneCount['FILL']?.length || 0);
    if (fillCount > 0) {
      const fillNames = [...(laneCount['ALL'] || []), ...(laneCount['FILL'] || [])];
      laneStatusText += `\n🔄 **FILL/ALL**: ${fillCount}人 (${fillNames.join(', ')})`;
    }

    // 参加者一覧のフォーマット
    const playerNamesList = activePlayers.map((p: any) => p.name).join(', ');

    // 4. Discord Webhook ペイロードの組み立て
    const payload = {
      content: `📢 **KTMカスタム 参加・希望ロール募集状況 (現在 ${activeCount}人)** 📢`,
      embeds: [
        {
          title: "⚔️ 本日のカスタム参加者スタッツ",
          color: activeCount >= 10 ? 3066993 : 15105570, // 10人揃えば緑、未満ならオレンジ
          fields: [
            {
              name: `👥 参加メンバー (${activeCount}人)`,
              value: playerNamesList || 'なし',
              inline: false
            },
            {
              name: "📊 平均KTM内部レート（KTM内戦ランク）",
              value: `**${avgMmr} KTM-MMR**\n*(※SoloQ公式ランクではなくKTMカスタム内戦の戦績基準: Gold=1500, Silver=1350)*`,
              inline: true
            },
            {
              name: "🔔 ステータス",
              value: activeCount >= 10 ? "✅ 10人揃いました！チーム分け可能です。" : `⏳ あと **${10 - activeCount}人** で開催可能です！`,
              inline: true
            },
            {
              name: "🔥 各ロールの希望状況 (第一希望)",
              value: laneStatusText,
              inline: false
            }
          ],
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
      const errText = await res.text();
      throw new Error(`Discord Webhook error: ${errText}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Discord Announce Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
