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
    let newPlayerNames: string[] = [];
    if (allNames.length > 0) {
      const { data: knownPlayers, error: knownErr } = await supabase
        .from('ktm_players')
        .select('name, games_top, games_jg, games_mid, games_adc, games_sup')
        .in('name', allNames);
      if (knownErr) {
        // 名簿を読めない時に「全員初参加」と誤表示しない（🔰は付けずに投稿を続ける）
        console.warn('[discord route] 名簿の取得に失敗したため🔰判定をスキップします:', knownErr.message);
      }
      const knownSet = new Set((knownPlayers || []).map((p: any) => p.name));
      const unknown = allNames.filter((n) => !knownSet.has(n));
      if (!knownErr && unknown.length > 0) {
        console.warn('[discord route] 未登録プレイヤーが含まれています（ゲスト許容）:', unknown);
      }

      // 初参加（通算0戦）プレイヤーを特定（未登録ゲストも初参加扱い）。
      // 2026-10-16: 以前は存在しない列（total_games / stats）を select しておりクエリ自体が失敗、
      // 全員が「名簿に無い＝初参加」扱いになってマッチアップ通知の全員に🔰が付いていた。
      // 通算試合数はレーン別試合数の合計（ktm_match_participants の件数と一致することを確認済み）。
      const totalGames = (p: any) =>
        (p.games_top || 0) + (p.games_jg || 0) + (p.games_mid || 0) + (p.games_adc || 0) + (p.games_sup || 0);
      const zeroGamePlayers = (knownPlayers || [])
        .filter((p: any) => totalGames(p) === 0)
        .map((p: any) => p.name);
      newPlayerNames = knownErr ? [] : [...zeroGamePlayers, ...unknown];
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

    const newPlayerSet = new Set(newPlayerNames);

    const formatMatchup = (role: string) => {
      const icons: Record<string, string> = {
        TOP: '🛡️', JG: '🌲', MID: '🔥', ADC: '🏹', SUP: '✨'
      };
      const pBlue = teamBlue.find((p: any) => (p.currentRole || p.role) === role);
      const pRed = teamRed.find((p: any) => (p.currentRole || p.role) === role);
      
      // ハンデ参加者には🎗️、初参加者には🔰を付けて全員に分かるようにする
      const mark = (n: string) => {
        let res = n;
        if (newPlayerSet.has(n)) res += ' 🔰';
        if (handicapSet.has(n)) res += ' 🎗️';
        return res;
      };
      const blueName = pBlue ? mark(pBlue.name) : "-";
      const redName = pRed ? mark(pRed.name) : "-";
      
      // スマホでも見やすいVS形式: 🛡️ **TOP**: `BluePlayer` 🆚 `RedPlayer`
      return `${icons[role]} **${role}**: \`${blueName}\` 🆚 \`${redName}\``;
    };

    const matchupsText = ['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(formatMatchup).join('\n\n');
    
    // MMRの平均を計算
    const blueAvgMmr = Math.round(teamBlue.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / (teamBlue.length || 1));
    const redAvgMmr = Math.round(teamRed.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / (teamRed.length || 1));

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

    // 初参加者がいる場合のウェルカムメッセージ
    const welcomeHeader = newPlayerNames.length > 0
      ? `✨ **本日初参加のメンバーが参戦しています（🔰 ${newPlayerNames.join('さん、')}さん）！VCに入ったら温かく迎えてあげてください🎉**\n`
      : '';

    const payload: any = {
      content: `${welcomeHeader}🔥 **KTM チーム分けが完了しました！** 🔥\n準備ができたらロビーに参加してください。`,
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
            },
            ...(spectators && spectators.length > 0 ? [{
              name: `👀 観戦・待機枠 (${spectators.length}名)`,
              value: spectators.map((s: any) => typeof s === 'string' ? s : s.name).join('、'),
              inline: false
            }] : [])
          ],
          footer: {
            text: (newPlayerNames.length > 0 ? `🔰初参加: ${newPlayerNames.join(', ')}` : '')
              + (handicapSet.size > 0 ? ` ｜ 🎗️ ハンデ参加: ${Array.from(handicapSet).join(', ')}` : '')
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
        const icon = '🔥';
        const typeLabel = '好敵手ライバル対決';
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
          title: "⚔️ 対戦データ（ライバル・直接対決・名コンビ）",
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
    // ★ 観戦投票（勝敗予想）の締め切りカウントダウンは、Discordにチーム発表を送信した時刻（announcedAt）を起点とする
    try {
      const nowIso = new Date().toISOString();
      const balanceResultPayload = {
        teamBlue,
        teamRed,
        spectators,
        blueWinRate: Number(pBlue.toFixed(4)),
        isExhibition: false,
        announcedAt: nowIso
      };

      // 直近の未処理 balancer_pending があれば、最新のチーム構成と発表時刻で更新する
      // （バランサー下書き時の古い initialCreatedAt を Discord発表時刻でリセットし、ここから15分とする）
      const { data: existingPending } = await supabase
        .from('edge_tasks')
        .select('id, payload')
        .eq('task_type', 'balancer_pending')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPending) {
        await supabase
          .from('edge_tasks')
          .update({
            payload: {
              ...existingPending.payload,
              balanceResult: balanceResultPayload,
              announcedAt: nowIso,
              initialCreatedAt: nowIso, // Discord送信時刻で締め切りカウントダウンの起点を確定
            },
            status: 'pending'
          })
          .eq('id', existingPending.id);
      } else {
        await supabase
          .from('edge_tasks')
          .insert({
            task_type: 'balancer_pending',
            payload: {
              balanceResult: balanceResultPayload,
              announcedAt: nowIso,
              initialCreatedAt: nowIso,
            },
            status: 'pending'
          });
      }
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

    // 待機者の Pity（spectator_pity）は試合の記録時（/api/match/record）に1回だけ付ける。以前はここでも +10 しており、
    // 投稿のたびに加算され、無認証なので誰でも自分を待機者にして加算できた（2026-10-19）

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Discord Webhook Error:', error);
    return NextResponse.json({ error: error.message || 'Discordへの送信に失敗しました。' }, { status: 500 });
  }
}
