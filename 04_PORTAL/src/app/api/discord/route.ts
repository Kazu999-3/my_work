import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../lib/supabaseAdmin';
import { calculateNemesisClash } from '../../../lib/nemesisClash';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teamBlue, teamRed, spectators, balanceReport, handicaps } = body;
    const handicapSet = new Set<string>(Array.isArray(handicaps) ? handicaps : []);

    if (!teamBlue || !teamRed) {
      return NextResponse.json({ error: 'チームデータが不足しています。' }, { status: 400 });
    }

    // このエンドポイントは仲間内メンバーが自分でも操作する運用のため認証は掛けない設計
    // (api/players/saveと同じ意図的な公開API)。ただし本番Discordチャンネルへの投稿内容が
    // 完全にクライアント任せで、実在しない名前でも自由記述で投稿できてしまっていたため、
    // 実在の登録プレイヤー名かどうかだけは検証する(2026-08-05発覚)。
    const allNames = [...teamBlue, ...teamRed, ...(spectators || [])].map((p: any) => typeof p === 'string' ? p : p.name).filter(Boolean);
    if (allNames.length > 0) {
      const { data: knownPlayers } = await supabase.from('ktm_players').select('name').in('name', allNames);
      const knownSet = new Set((knownPlayers || []).map((p: any) => p.name));
      const unknown = allNames.filter((n) => !knownSet.has(n));
      if (unknown.length > 0) {
        return NextResponse.json({ error: `登録されていないプレイヤー名が含まれています: ${unknown.join(', ')}` }, { status: 400 });
      }
    }

    // ⚠️ 2026-09-29 追加: 連投対策のクールダウン。
    // 名前検証（上記・2026-08-05対応）で「実在しないプレイヤーを含む投稿」は防げるが、
    // **実在名を使った連投は防げなかった**。無認証なのでチャンネルを埋め尽くせる状態だった。
    // 既に同じ問題へ対処済みの `match/analyze-image` と同じ edge_tasks ベースの方式に揃える。
    // チーム分け結果の投稿は本来1試合に1回なので、30秒あれば通常利用は妨げない。
    const COOLDOWN_MS = 30 * 1000;
    const COOLDOWN_TASK = 'discord_post_cooldown';
    try {
      const { data: lastPost } = await supabase
        .from('edge_tasks')
        .select('created_at')
        .eq('task_type', COOLDOWN_TASK)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastPost?.created_at) {
        const elapsed = Date.now() - new Date(lastPost.created_at).getTime();
        if (elapsed < COOLDOWN_MS) {
          const wait = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
          return NextResponse.json(
            { error: `連続投稿を防ぐため${wait}秒ほどお待ちください。` },
            { status: 429 }
          );
        }
      }
      await supabase.from('edge_tasks').insert({
        task_type: COOLDOWN_TASK,
        status: 'completed',
        payload: { at: new Date().toISOString() },
      });
    } catch (cdErr) {
      // クールダウン判定の失敗で投稿自体を止めない（本来の機能を優先する）
      console.warn('[discord] クールダウン判定に失敗（投稿は続行）:', cdErr);
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
      
      // ハンデ参加者には🎗️を付けて、制約付き参加であることを全員に分かるようにする
      const mark = (n: string) => (handicapSet.has(n) ? `${n} 🎗️` : n);
      const blueName = pBlue ? mark(pBlue.name) : "-";
      const redName = pRed ? mark(pRed.name) : "-";
      
      // スマホでも見やすいVS形式: 🛡️ **TOP**: `BluePlayer` 🆚 `RedPlayer`
      return `${icons[role]} **${role}**: \`${blueName}\` 🆚 \`${redName}\``;
    };

    const matchupsText = ['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(formatMatchup).join('\n\n');
    
    // MMRの平均を計算
    const blueAvgMmr = Math.round(teamBlue.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / 5);
    const redAvgMmr = Math.round(teamRed.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / 5);

    // 勝利予想(#79): balancer/pending と同じElo式
    const pBlue = 1 / (1 + Math.pow(10, (redAvgMmr - blueAvgMmr) / 400));
    const bluePct = Math.round(pBlue * 100);
    const redPct = 100 - bluePct;
    const barLen = 10;
    const blueBars = Math.round((bluePct / 100) * barLen);
    const winBar = '🟦'.repeat(blueBars) + '🟥'.repeat(barLen - blueBars);

    const handicapText = (body.handicaps && Array.isArray(body.handicaps) && body.handicaps.length > 0)
      ? `\n🎗️ 格差ハンデ適用: ` + body.handicaps.map((h: any) => `${h.targetName}選手（${h.rule} / -${h.mmrPenalty}MMR）`).join('、')
      : '';

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
            },
            {
              name: `🔮 勝利予想: BLUE ${bluePct}% 🆚 RED ${redPct}%`,
              value: `${winBar}\n※MMRベースのElo予測（50%に近いほど接戦）`,
              inline: false
            }
          ],
          footer: {
            text: `👀 観戦: ${spectators && spectators.length > 0 ? spectators.join(', ') : 'なし'}`
              + (handicapSet.size > 0 ? `\n🎗️ ハンデ参加(オフロール等の制約付き): ${Array.from(handicapSet).join(', ')}` : '')
              + handicapText
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

    // ⚔️ 因縁・ライバル対決 ＆ 黄金デュオ速報（Nemesis Clash）を算出
    try {
      const clashData = await calculateNemesisClash(teamBlue, teamRed);
      const clashFields: any[] = [];

      // 1. 注目因縁（Featured Clash）
      if (clashData.featuredClash) {
        const fc = clashData.featuredClash;
        const icon = fc.type === 'NEMESIS' ? '💥' : '🔥';
        const typeLabel = fc.type === 'NEMESIS' ? '因縁リベンジマッチ' : '好敵手ライバル対決';
        clashFields.push({
          name: `${icon} 【${typeLabel}】${fc.bluePlayer} 🆚 ${fc.redPlayer}`,
          value: `> **${fc.headline}**\n> ${fc.subtext}\n> （通算対戦: \`${fc.bluePlayer} ${fc.blueWins}勝\` 🆚 \`${fc.redWins}勝 ${fc.redPlayer}\`）`,
          inline: false
        });
      }

      // 2. レーン直接対決（3戦以上または勝ち越し）
      const notableLaneClashes = (clashData.laneClashes || []).filter(c => c.games >= 2);
      if (notableLaneClashes.length > 0) {
        const lines = notableLaneClashes.map(c => 
          `・**[${c.role}]** \`${c.bluePlayer}\` (${c.blueWins}勝) 🆚 (${c.redWins}勝) \`${c.redPlayer}\` ➔ ${c.headline}`
        );
        clashFields.push({
          name: "📍 レーン別 直接対決レコード",
          value: lines.join('\n'),
          inline: false
        });
      }

      // 3. チーム内の黄金デュオ
      if (clashData.goldenDuos && clashData.goldenDuos.length > 0) {
        const duoLines = clashData.goldenDuos.map(d => 
          `・${d.teamSide === 'BLUE' ? '🟦' : '🟥'} **${d.player1}** ＆ **${d.player2}**: ${d.label}`
        );
        clashFields.push({
          name: "🤝 注目の名コンビ・黄金デュオ",
          value: duoLines.join('\n'),
          inline: false
        });
      }

      if (clashFields.length > 0) {
        payload.embeds.push({
          title: "⚔️ 本日の因縁・ライバル対決速報",
          description: "過去のKTMカスタム対戦データから算出した直接対決＆シナジー情報です！",
          color: 0xe056fd, // 鮮やかなパープル・ピンク系
          fields: clashFields,
        });
      }
    } catch (clashErr) {
      console.warn('[discord route] Failed to calculate nemesis clash:', clashErr);
    }

    if (balanceReport && Array.isArray(balanceReport)) {
      payload.embeds.push({
        title: "📊 チーム分けの理由と分析",
        description: balanceReport.map((r: string) => `> ${r}`).join('\n\n'),
        color: 3447003, // 青系
      });
    }

    // 🎲 勝敗予想受付用: edge_tasks に pending マッチを自動保存/更新
    try {
      const balanceResultPayload = {
        teamBlue,
        teamRed,
        spectators,
        blueWinRate: Number(pBlue.toFixed(4)),
        isExhibition: false,
        announcedAt: new Date().toISOString()
      };

      await supabase
        .from('edge_tasks')
        .insert({
          task_type: 'balancer_pending',
          payload: { balanceResult: balanceResultPayload },
          status: 'pending'
        });
    } catch (pendErr) {
      console.warn('[discord route] Failed to auto-save balancer_pending:', pendErr);
    }

    const portalBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://my-work-8jbd.vercel.app';

    // 🎲 勝敗ベットボタンを追加
    payload.components = [
      {
        type: 1,
        components: [
          {
            type: 2,
            label: "🟦 BLUE にベット",
            style: 1,
            custom_id: "bet_team:BLUE"
          },
          {
            type: 2,
            label: "🟥 RED にベット",
            style: 4,
            custom_id: "bet_team:RED"
          },
          {
            type: 2,
            label: "🎲 Webカジノ / 番付",
            style: 5,
            url: `${portalBaseUrl}/casino`
          }
        ]
      }
    ];

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

      // 2. 観戦者の spectator_pity を +10
      // 以前はSELECT→計算→UPDATEの非アトミック処理で、同時リクエスト時に加算が
      // 失われる競合状態があったため、DB側で加算するRPC(increment_ktm_spectator_pity)に置き換えた。
      if (spectators && spectators.length > 0) {
        const { error: pityError } = await supabase.rpc('increment_ktm_spectator_pity', {
          p_names: spectators,
          p_amount: 10,
        });
        if (pityError) console.warn('[discord] spectator_pity加算に失敗（続行）:', pityError);
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
