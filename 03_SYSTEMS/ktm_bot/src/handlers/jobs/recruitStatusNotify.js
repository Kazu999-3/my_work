import { CONFIG } from '../../config.js';
import { fetchSupabase } from '../../utils/supabase.js';
import { parseMessageData } from '../../utils/helpers.js';
import { fetchWithRetry } from '../../utils/api.js';
import { getKtmRank, formatRankDistribution, formatMmrWithRank, getHighestLaneMmr } from '../../utils/ktmRank.js';
import { RECRUITMENT_COLORS } from '../../utils/recruitmentStatus.js';

// 募集状況の通知
// 2026-10-07: handlers/scheduled.js（1,441行）から分割。処理は分割前と同じ。

/**
 * 直前通知（募集ベース）: Discordイベントではなく「実際に立っている募集」を見て、
 * 現在の参加人数を通知する。10人に足りなければ通知ロールをメンションして欠員アラート。
 * 二重投稿防止のため、直近3時間に同一タイトルのbot投稿があればスキップする。
 */
async function sendRecruitStatusNotification(env) {
  try {
    // 対象は「これから開始する未来の募集（現在時刻〜24時間以内）」のopen募集。
    // すでに開始時刻を過ぎた古い募集に対する10分間隔Cronの誤爆通知を完全に防止。
    const nowMs = Date.now();
    const fromIso = new Date(nowMs).toISOString(); // 現在時刻以降のみ
    const toIso = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
    const rows = await fetchSupabase(
      env, 'recruitments',
      `status=eq.open&start_at=gte.${encodeURIComponent(fromIso)}&start_at=lte.${encodeURIComponent(toIso)}&order=start_at.asc&limit=5&select=discord_message_id,discord_channel_id,start_at,max_count`
    );
    if (!rows || rows.length === 0) {
      console.log('[RecruitStatus] 直近（未来24時間以内）のオープンな募集がないため通知をスキップします。');
      return;
    }

    for (const r of rows) {
      if (!r.discord_message_id || !r.discord_channel_id) continue;
      // 募集メッセージを取得して参加者を解析
      const msgRes = await fetchWithRetry(
        `https://discord.com/api/v10/channels/${r.discord_channel_id}/messages/${r.discord_message_id}`,
        { headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` } }
      );
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();
      const metadata = parseMessageData(msg);
      if (!metadata) continue;

      const joined = metadata.joined || [];
      const max = metadata.maxCount || r.max_count || 10;
      const shortage = Math.max(0, max - joined.length);
      const startJst = r.start_at
        ? new Date(new Date(r.start_at).getTime() + 9 * 3600 * 1000).toISOString().slice(11, 16)
        : (metadata.time || '');

      // 参加者ごとのMMRを引いて、名前一覧にランクを併記しつつ分布も出す
      const mmrById = new Map();
      if (joined.length > 0) {
        try {
          const idsStr = joined.map((i) => `"${i}"`).join(',');
          const ps = await fetchSupabase(env, 'ktm_players', `discord_id=in.(${idsStr})&select=discord_id,mmr,mmr_top,mmr_jg,mmr_mid,mmr_adc,mmr_sup`);
          for (const p of (ps || [])) {
            const hMmr = getHighestLaneMmr(p);
            if (hMmr > 0) mmrById.set(String(p.discord_id), hMmr);
          }
        } catch (e) {
          console.warn('[RecruitStatus] MMR取得に失敗:', e);
        }
      }

      const nameList = joined.length > 0
        ? joined.map((id, i) => {
            const idx = String(i + 1).padStart(2, '0');
            const mmr = mmrById.get(String(id));
            // 例: 01. @かず — 1450（ゴールド相当）
            return `${idx}. <@${id}> — ${formatMmrWithRank(mmr)}`;
          }).join('\n')
        : '（まだ参加者がいません）';

      // 参加者のランク分布（サッと構成を掴む用）
      let tierLine = '';
      if (mmrById.size > 0) {
        const mmrs = [...mmrById.values()];
        const unknown = joined.length - mmrs.length; // 名簿未登録
        const dist = formatRankDistribution(mmrs, unknown);
        if (dist) {
          tierLine = `\n\n**ランク内訳**: ${dist}`;
          if (mmrs.length >= 2) {
            const hi = getKtmRank(Math.max(...mmrs));
            const lo = getKtmRank(Math.min(...mmrs));
            if (hi.name !== lo.name) tierLine += `　幅: ${lo.short}〜${hi.short}`;
          }
        }
      }

      const title = shortage > 0
        ? `⚠️ カスタム募集中 — あと${shortage}名！`
        : `✅ カスタム募集 — メンバー確定（${joined.length}/${max}）`;

      // 二重投稿防止。
      // ★ メンバー確定の通知は参加者へメンションが飛ぶため、募集中の通知(3時間窓)と同じ基準だと
      //   満員のまま10分間隔cronが回り続ける間、3時間おきに全員へ鳴り直してしまう。
      //   確定通知だけは走査範囲と期間を広げ、同じ募集カードへの確定返信が1件でもあれば送らない。
      const isConfirmed = shortage === 0;
      const dupLimit = isConfirmed ? 50 : 10;
      const dupWindowMs = isConfirmed ? 7 * 24 * 60 * 60 * 1000 : 3 * 60 * 60 * 1000;
      const recentRes = await fetchWithRetry(
        `https://discord.com/api/v10/channels/${r.discord_channel_id}/messages?limit=${dupLimit}`,
        { headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` } }
      );
      if (recentRes.ok) {
        const recent = await recentRes.json();
        const since = nowMs - dupWindowMs;
        const duplicated = recent.find((m) => {
          if (!m.author?.bot || new Date(m.timestamp).getTime() <= since) return false;
          if (m.embeds?.[0]?.title === title) return true;
          // 確定タイトルには人数が入るので、この募集への確定返信かどうかでも照合する
          return isConfirmed
            && m.message_reference?.message_id === r.discord_message_id
            && (m.embeds?.[0]?.title || '').startsWith('✅ カスタム募集');
        });
        if (duplicated) {
          console.log('[RecruitStatus] 同一通知が直近にあるためスキップ');
          continue;
        }
      }

      const embed = {
        title,
        description: `**開催予定: ${startJst}${startJst ? ' (JST)' : ''}**\n現在の参加者 **${joined.length}/${max}** 名\n\n${nameList}${tierLine}`,
        color: shortage > 0 ? RECRUITMENT_COLORS.recruiting : RECRUITMENT_COLORS.confirmed,
        footer: { text: 'KTM Bot | 募集状況のお知らせ' },
        timestamp: new Date().toISOString()
      };

      // 募集メッセージへの返信としてぶら下げ、チャンネルの流れに通知が散らばらないようにする
      const body = {
        embeds: [embed],
        message_reference: { message_id: r.discord_message_id, fail_if_not_exists: false }
      };
      // 人数不足のときだけ通知ロールをメンションして能動的に呼ぶ
      if (shortage > 0 && CONFIG.NOTIFICATION_ROLE_ID) {
        body.content = `<@&${CONFIG.NOTIFICATION_ROLE_ID}> 🔥 **あと${shortage}名でカスタム開催です！** 参加できる方は上の募集メッセージから参加ボタンを押してください！`;
        body.allowed_mentions = { roles: [CONFIG.NOTIFICATION_ROLE_ID] };
      } else if (shortage === 0 && joined.length > 0) {
        // メンバー確定は当事者だけに通知する(ロール購読者全員に鳴らさない)。
        // 以前は確定時にcontent自体が無く、揃ったことが誰にも通知されていなかった。
        const confirmIds = [...new Set(joined)].filter(Boolean).slice(0, 100);
        body.content = `✅ **メンバーが揃いました！** 開始までに準備をお願いします。\n通知: ${confirmIds.map((id) => `<@${id}>`).join(' ')}`;
        body.allowed_mentions = { users: confirmIds };
      }

      const sendRes = await fetchWithRetry(
        `https://discord.com/api/v10/channels/${r.discord_channel_id}/messages`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );
      if (!sendRes.ok) {
        console.error(`[RecruitStatus] 送信失敗: ${sendRes.status} ${await sendRes.text()}`);
      } else {
        console.log(`[RecruitStatus] 通知しました（${joined.length}/${max}）`);
      }
    }
  } catch (err) {
    console.error('[RecruitStatus] error:', err);
  }
}
