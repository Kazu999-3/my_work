import { CONFIG } from '../../config.js';
import { fetchSupabase } from '../../utils/supabase.js';
import { fetchWithRetry, fetchPortalAPI } from '../../utils/api.js';
import { buildDayRecruitEmbed, buildDayRecruitComponents } from '../../ui/embeds.js';
import { createRecruitment, markRecruitmentStatus } from '../../utils/recruitPermission.js';
import { notifyAdminError } from '../../utils/alert.js';
import { computeDayStatus, getDayDef, detectDayKey, extractEntryLines, DAY_CAPACITY, DAY_DEFS, resolveWeekendTargets, buildRecruitmentContent } from '../../utils/recruitmentStatus.js';
import { cleanupStaleAdhocRecruitments } from './maintenance.js';

// 週末の定期募集カード（投稿・受付終了・旧形式からの移行・リセット・集計）と古いリマインドの掃除
// 2026-10-07: handlers/scheduled.js（1,441行）から分割。処理は分割前と同じ。

/**
 * 直近の週末（土曜21:00 / 日曜21:00）の定期カスタム募集カードを専用チャンネルへ自動投稿する(#85)。
 * 毎週水曜 12:00 JST に発火。
 *
 * ★ 2026-09-23: 1枚のカードに土日を同居させる構成をやめ、土曜カード/日曜カードの
 *   2メッセージへ完全に分離した。旧構成は「※土曜と日曜は別々の募集です」と文章で
 *   断っていただけで、実態としては
 *   ・6個のボタンが1メッセージに同居して押し間違えやすい
 *   ・recruitments へ登録されるレコードが土曜分の1件だけで、日曜側はDB上存在せず、
 *     リマインド・20:00開催判定・ポータル通知が構造的に機能しない
 *   という問題が残っていた（「生成経路はあるが誰も拾っていない」孤立パターン）。
 *
 * 二重投稿防止は recruitments.start_at を使って「日ごと」に行うため、
 * Cloudflare cron と GitHub Actions バックアップが何度重複発火しても安全。
 */
export async function postWeeklyRecruitment(env, options = {}) {
  try {
    const targetChannelId = CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID || "1528646515533287497";
    const targets = resolveWeekendTargets();

    // 1. 前回の定期カスタム募集を DB および Discord 上で締め切る
    //    今週分(targets)は除外する。バックアップキックで2回目以降が走ったとき、
    //    直前に投稿したばかりのカードを自分で閉じてしまうのを防ぐ。
    const recentMessages = await fetchRecentBotMessages(env, targetChannelId);
    await closePreviousPeriodicRecruitments(env, targetChannelId, targets, recentMessages);
    await cleanupStaleAdhocRecruitments(env);

    // 2. 土曜・日曜のカードをそれぞれ投稿する（片方が失敗しても、もう片方は投稿する）
    let posted = 0;
    for (const target of targets) {
      const ok = await postDayRecruitmentCard(env, targetChannelId, target, { recentMessages });
      if (ok) posted += 1;
    }
    console.log(`[WeeklyRecruit] 定期カスタム募集カードを ${posted}/${targets.length} 件投稿しました`);

    if (posted > 0 && options.isBackupKick) {
      await notifyAdminError(
        env,
        `定期カスタム募集をバックアップ経路から投稿しました (${posted}件)`,
        {
          detail: 'Cloudflareの本命cron(水曜12:00 JST)が空振りしています。Workers側のcron設定と実行ログを確認してください。',
          source: 'postWeeklyRecruitment',
        }
      ).catch(() => {});
    }
  } catch (err) {
    console.error('[WeeklyRecruit] error:', err);
  }
}

const CHANNEL_SCAN_LIMIT = 100;

// Cloudflare Workers はリクエストあたりのサブリクエスト数に上限がある（無料プランで50）。
// 上限を超えると以降の fetch がすべて失敗するため、1回の実行で触る旧カードの枚数を絞る。
// 2026-09-23、旧カードを大量に処理した結果、続く日曜カードの投稿が丸ごと飛んだ。

export const MAX_CARDS_PER_RUN = 4;

/**
 * チャンネルの直近メッセージからBotの投稿を取得する。
 *
 * ★ 2026-09-23: `recruitments` テーブルが実測で全件0行だったため、DBを唯一の
 *   手がかりにしている処理はすべて空振りする。Botの書き込みが成立していない
 *   （`recruitPermission.js` にも「ベストエフォート作成」と書かれている）ので、
 *   募集カードの所在はDBではなく Discord を正とし、DBは補助に格下げした。
 */
export async function fetchRecentBotMessages(env, channelId) {
  try {
    const res = await fetchWithRetry(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=${CHANNEL_SCAN_LIMIT}`,
      { headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` } }
    );
    if (!res.ok) return [];
    const msgs = await res.json();
    return Array.isArray(msgs) ? msgs.filter((m) => m.author?.bot) : [];
  } catch (e) {
    console.warn('[Recruit] チャンネル走査に失敗:', e);
    return [];
  }
}

/** 受付終了済みのカードか */
export function isClosedCard(msg) {
  return (msg.embeds?.[0]?.title || '').startsWith(CLOSED_PREFIX);
}

/** 新形式（参加者フィールド1つ）の、指定した日のカードを探す */
function findDayCard(messages, target) {
  const def = getDayDef(target.dayKey);
  return messages.find((m) => {
    const embed = m.embeds?.[0];
    if (!embed || isClosedCard(m)) return false;
    const title = embed.title || '';
    if (!title.includes(def.name) || !title.includes(target.label)) return false;
    // 旧形式(土日同居)は参加者フィールドが2つ以上あるので除外する
    return (embed.fields || []).filter((f) => detectDayKey(f.name) !== null).length < 2;
  }) || null;
}

/** 旧形式（1枚に土日が同居）のカードを探す */
function findLegacyCards(messages) {
  return messages.filter((m) => {
    const embed = m.embeds?.[0];
    if (!embed || isClosedCard(m)) return false;
    return (embed.fields || []).filter((f) => detectDayKey(f.name) !== null).length >= 2;
  });
}

const CLOSED_PREFIX = '🔒 [受付終了]';

/** 定期カスタムのカード1枚を受付終了にする（タイトルに印・灰色・ボタン無効化・DBもclosed） */
export async function closePeriodicCard(env, channelId, messageId) {
  const url = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`;
  const res = await fetchWithRetry(url, { headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` } });
  if (!res.ok) throw new Error(`カードの取得に失敗 (HTTP ${res.status})`);
  const m = await res.json();
  if (isClosedCard(m)) return;
  const closedEmbed = { ...m.embeds[0], title: markTitleClosed(m.embeds?.[0]?.title || ''), color: 0x7f8c8d };
  const disabledComponents = (m.components || []).map((row) => ({
    ...row,
    components: row.components.map((btn) => ({ ...btn, disabled: true }))
  }));
  const patch = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [closedEmbed], components: disabledComponents })
  });
  if (!patch.ok) throw new Error(`カードの更新に失敗 (HTTP ${patch.status})`);
  await markRecruitmentStatus(env, messageId, 'closed').catch(() => {});
}

/** 受付終了の見出しを付ける。既に付いていれば二重に付けない（移行の再実行対策） */
export function markTitleClosed(title) {
  const t = (title || '').trim();
  return t.startsWith(CLOSED_PREFIX) ? t : `${CLOSED_PREFIX} ${t}`.trim();
}

/**
 * 募集レコードを id 指定で更新する。
 *
 * ★ 2026-09-23: この関数は以前から2箇所で呼ばれていたにもかかわらず、コードベースの
 *   どこにも定義が無く、呼ばれるたびに ReferenceError になっていた。
 *   呼び出し元が try/catch で例外を握りつぶしていたため表面化せず、
 *   「毎週水曜に前回の募集を締め切る」処理が一度も成功していなかった
 *   （＝ status=open の定期カスタムが毎週溜まり続け、旧カードのボタンも押せるまま）。
 *   `.catch()` を付けても ReferenceError は Promise の拒否ではなく同期例外なので
 *   捕まえられない、という点も発覚が遅れた理由。
 */
async function updateRecruitment(env, id, patch) {
  return fetchSupabase(env, 'recruitments', `id=eq.${id}`, 'PATCH', {
    ...patch,
    updated_at: new Date().toISOString(),
  });
}

/**
 * 前回の定期カスタム募集カードを締め切る（Discord上のボタンを無効化し、DBも closed にする）。
 *
 * ★ 2026-09-23: 対象の特定をDBからチャンネル走査へ切り替えた。`recruitments` は実測で
 *   全件0行であり、DBを頼りにすると「締め切り対象なし」で毎回素通りしてしまう。
 *   また旧実装は `status=open` を無条件に全件閉じていたため、メンバーが自分で立てた
 *   進行中のアドホック募集まで毎週水曜に「[受付終了]」にしていた。
 *   現在は「このチャンネルにある定期カスタムのカードのうち、今週分ではないもの」だけを閉じる。
 */
async function closePreviousPeriodicRecruitments(env, channelId, targets, messages) {
  try {
    const recent = messages || await fetchRecentBotMessages(env, channelId);
    const keepLabels = new Set(targets.map((t) => t.label));
    const dayNames = Object.values(DAY_DEFS).map((d) => d.name);

    const stale = recent.filter((m) => {
      const embed = m.embeds?.[0];
      if (!embed || isClosedCard(m)) return false;
      const title = embed.title || '';

      // 旧形式（1枚に土日同居）のカードは無条件に対象
      const dayFieldCount = (embed.fields || []).filter((f) => detectDayKey(f.name) !== null).length;
      if (dayFieldCount >= 2) return true;

      // 新形式のカードは、今週分の日付ラベルを持たないものだけ対象
      if (!dayNames.some((n) => title.includes(n))) return false;
      return ![...keepLabels].some((label) => title.includes(label));
    });

    if (stale.length === 0) {
      console.log('[WeeklyRecruit] 締め切るべき前回のカードはありません');
      return;
    }

    // サブリクエスト上限対策。1回で捌ききれない分は次回の実行に回す。
    for (const msg of stale.slice(0, MAX_CARDS_PER_RUN)) {
      try {
        // ★ 過去カードの物理削除: チャンネルに古い募集が残って今週分と混ざるのを完全に防止する
        await fetchWithRetry(`https://discord.com/api/v10/channels/${msg.channel_id || channelId}/messages/${msg.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
        }).catch((e) => console.warn(`[WeeklyRecruit] ${msg.id} のカード削除に失敗:`, e));

        // DB側も閉じる（行が無ければ何も起きない。ベストエフォート）
        await markRecruitmentStatus(env, msg.id, 'closed')
          .catch((e) => console.warn(`[WeeklyRecruit] ${msg.id} のDB締め切りに失敗:`, e));
      } catch (e) {
        console.warn('[WeeklyRecruit] 旧カードの削除処理でエラー:', e);
      }
    }
    console.log(`[WeeklyRecruit] 前回のカード${stale.length}件を削除しました（最新カードのみに維持）`);
  } catch (closeErr) {
    console.warn('[WeeklyRecruit] 前回の募集締め切り処理のエラー:', closeErr);
    // この処理は2026-09-23まで、存在しない updateRecruitment を呼んで毎回死んでいたのに
    // ここで握りつぶされて誰も気づかなかった（結果、先週以前のカードが開いたまま溜まり
    // 移行時に16名が合算される事故になった）。同じ轍を踏まないよう通知する。
    await notifyAdminError(env, closeErr, { action: 'closePreviousPeriodicRecruitments(前回カードの締め切り)' });
  }
}

/**
 * 1日分の募集カードを投稿し、recruitments へ登録する。投稿したら true。
 * @param {{seedLines?: string[], skipDuplicateCheck?: boolean}} [options]
 *   seedLines: 旧カードからの移行時に、既存の参加者行をそのまま引き継ぐ
 *   skipDuplicateCheck: 移行時のみ true（同じ start_at の旧レコードが残っているため）
 */
async function postDayRecruitmentCard(env, channelId, target, options = {}) {
  const { def, label, startAtIso, dayKey } = target;
  const seedLines = options.seedLines || [];

  // 二重投稿防止。DBは当てにできない（recruitments が実測で0行）ため、
  // チャンネルに同じ日のカードが既に出ていないかを正として判定する。
  if (!options.skipDuplicateCheck) {
    const messages = options.recentMessages || await fetchRecentBotMessages(env, channelId);
    if (findDayCard(messages, target)) {
      console.log(`[WeeklyRecruit] ${label}のカードは既にチャンネルに存在するためスキップ（二重発火防止）`);
      return false;
    }
  }

  const embed = buildDayRecruitEmbed(target, seedLines);
  const components = buildDayRecruitComponents(dayKey);
  const content = buildRecruitmentContent(target, CONFIG.NOTIFICATION_ROLE_ID);

  const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      embeds: [embed],
      components,
      allowed_mentions: { roles: [CONFIG.NOTIFICATION_ROLE_ID] }
    })
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error(`[WeeklyRecruit] ${label}の募集投稿に失敗: ${res.status} ${detail}`);
    // 無言で欠けると「片方の曜日だけカードが無い」状態に誰も気づけないため通知する。
    await notifyAdminError(env, `${def.name}(${label})の募集カード投稿に失敗しました`, {
      status: res.status,
      detail: detail.slice(0, 500),
      source: 'postDayRecruitmentCard',
    }).catch(() => {});
    return false;
  }
  const sent = await res.json();

  // DB登録はベストエフォート。ここが失敗しても、もう一方の曜日のカード投稿まで
  // 巻き添えで止まらないように必ず捕まえる（2026-09-23、書き込みが通っていないことが実測で判明）。
  await createRecruitment(env, {
    messageId: sent.id,
    channelId,
    ownerDiscordId: CONFIG.ADMIN_ID,
    mode: '定期カスタム',
    maxCount: DAY_CAPACITY,
    startAt: startAtIso,
  }).catch((e) => console.error(`[WeeklyRecruit] ${label} のrecruitments登録に失敗（カード投稿は成功）:`, e));
  console.log(`[WeeklyRecruit] ${def.name} ${label} の募集を投稿しました (msg ${sent.id})`);

  try {
    await fetchPortalAPI(env, '/api/push/notify-recruit', {
      mode: '定期カスタム',
      time: `${label} 21:00`,
    }).catch(() => {});
  } catch (e) {}

  return true;
}

/**
 * 旧形式（1枚のカードに土日が同居）の募集カードを、土日2枚の新形式へ移行する一度きりの処理。
 * 既存の参加者をそのまま新カードへ引き継ぎ、旧カードは受付終了にしてボタンを無効化する。
 * /trigger-scheduled?key=...&mode=weekly_recruit_migrate から手動でキックする。
 *
 * ★ 2026-09-23: 対象の特定をDBからチャンネル走査へ切り替えた。初版は
 *   `recruitments` の open 行を起点にしていたが、同テーブルは実測で全件0行であり
 *   （Botからの書き込みが成立していない）、旧カードが目の前にあるのに
 *   「移行対象なし」で何もせず終了していた。募集カードの所在はDiscordを正とする。
 */
export async function migrateLegacyPeriodicCards(env) {
  try {
    const channelId = CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID;
    const messages = await fetchRecentBotMessages(env, channelId);
    const legacyCards = findLegacyCards(messages);

    if (legacyCards.length === 0) {
      console.log('[Migrate] 移行対象の旧形式カードはありませんでした');
      return;
    }

    // ★ 引き継ぎ元は「最新の旧カード1枚」だけにする。
    //   走査範囲(直近100件)には先週以前のカードも含まれており、全部から参加者を
    //   集めると別の週のエントリーまで合算されてしまう（実際に土曜が16名になった）。
    //   締め切り対象は最新以外にも広げるが、Cloudflare Workersの
    //   サブリクエスト上限(無料プランで50)に当たると以降のfetchが全て失敗するため、
    //   1回あたりの処理件数に上限を設ける（日曜カードの投稿が飛んだ原因）。
    const seeds = { sat: [], sun: [] };
    const primary = legacyCards[0];

    for (const f of primary.embeds?.[0]?.fields || []) {
      const key = detectDayKey(f.name);
      if (key) seeds[key].push(...extractEntryLines(f.value));
    }
    console.log(`[Migrate] 引き継ぎ元: ${primary.id}（土${seeds.sat.length}名 / 日${seeds.sun.length}名）`);

    for (const msg of legacyCards.slice(0, MAX_CARDS_PER_RUN)) {
      try {
        // 旧カードを受付終了にする
        const closedEmbed = { ...msg.embeds[0] };
        closedEmbed.title = markTitleClosed(closedEmbed.title);
        closedEmbed.description = '⚠️ このカードは土曜／日曜それぞれの新しい募集カードへ移行しました。参加は新しいカードからお願いします。';
        closedEmbed.color = 0x7f8c8d;
        const disabled = (msg.components || []).map((r) => ({
          ...r, components: r.components.map((b) => ({ ...b, disabled: true }))
        }));

        await fetchWithRetry(`https://discord.com/api/v10/channels/${msg.channel_id || channelId}/messages/${msg.id}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [closedEmbed], components: disabled })
        }).catch((e) => console.warn(`[Migrate] ${msg.id} の受付終了表示に失敗:`, e));

        await markRecruitmentStatus(env, msg.id, 'closed')
          .catch((e) => console.warn(`[Migrate] ${msg.id} のDB締め切りに失敗（行が無い可能性）:`, e));

        console.log(`[Migrate] 旧カード ${msg.id} を受付終了にしました`);
      } catch (e) {
        console.warn(`[Migrate] ${msg.id} の処理に失敗:`, e);
      }
    }

    // 同一ユーザーが複数行に載っている場合は先勝ちで1行に寄せる
    const dedupe = (lines) => {
      const seen = new Set();
      const out = [];
      for (const line of lines) {
        const id = line.match(/<@(\d+)>/)?.[1];
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(line);
      }
      return out;
    };

    for (const target of resolveWeekendTargets()) {
      const seedLines = dedupe(seeds[target.dayKey] || []);
      console.log(`[Migrate] ${target.label} の新カードを投稿します（引き継ぎ${seedLines.length}名）`);
      await postDayRecruitmentCard(env, channelId, target, {
        seedLines,
        skipDuplicateCheck: true,
      });
    }
    console.log('[Migrate] 新形式カードへの移行が完了しました');
  } catch (err) {
    console.error('[Migrate] error:', err);
  }
}

/**
 * 今週の定期カスタムのカードを作り直す（手動キック専用: mode=weekly_recruit_reset）。
 *
 * 移行が途中で失敗してカードが中途半端な状態になったときの立て直し用。
 * ① 直近の旧形式カード（受付終了済みでも可）から参加者を引き継ぎ元として拾う
 * ② チャンネルに出ている定期カスタムのカードをすべて受付終了にする
 * ③ 土曜・日曜のカードを新しく投稿し直す
 *
 * ★ 2026-09-23: 初回の移行で「先週以前のカードまで参加者を合算して土曜が16名になり、
 *   さらにサブリクエスト上限に当たって日曜カードが投稿されなかった」状態の復旧用に追加した。
 */
export async function resetPeriodicCards(env) {
  try {
    const channelId = CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID;
    const messages = await fetchRecentBotMessages(env, channelId);

    // ① 引き継ぎ元（受付終了済みも対象に含める。移行済みなら既に閉じているため）
    const seeds = { sat: [], sun: [] };
    const legacy = messages.find((m) => {
      const embed = m.embeds?.[0];
      if (!embed) return false;
      return (embed.fields || []).filter((f) => detectDayKey(f.name) !== null).length >= 2;
    });
    if (legacy) {
      for (const f of legacy.embeds[0].fields || []) {
        const key = detectDayKey(f.name);
        if (key) seeds[key].push(...extractEntryLines(f.value));
      }
      console.log(`[Reset] 引き継ぎ元: ${legacy.id}（土${seeds.sat.length}名 / 日${seeds.sun.length}名）`);
    } else {
      console.log('[Reset] 引き継ぎ元の旧形式カードは見つかりませんでした（空のカードを作り直します）');
    }

    // ② 出ている定期カスタムのカードをすべて閉じる
    const dayNames = Object.values(DAY_DEFS).map((d) => d.name);
    const openCards = messages.filter((m) => {
      const embed = m.embeds?.[0];
      if (!embed || isClosedCard(m)) return false;
      const title = embed.title || '';
      const dayFieldCount = (embed.fields || []).filter((f) => detectDayKey(f.name) !== null).length;
      return dayFieldCount >= 2 || dayNames.some((n) => title.includes(n));
    });

    for (const msg of openCards.slice(0, MAX_CARDS_PER_RUN)) {
      try {
        const closedEmbed = { ...msg.embeds[0] };
        closedEmbed.title = markTitleClosed(closedEmbed.title);
        closedEmbed.color = 0x7f8c8d;
        const disabled = (msg.components || []).map((r) => ({
          ...r, components: r.components.map((b) => ({ ...b, disabled: true }))
        }));
        await fetchWithRetry(`https://discord.com/api/v10/channels/${msg.channel_id || channelId}/messages/${msg.id}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [closedEmbed], components: disabled })
        }).catch((e) => console.warn(`[Reset] ${msg.id} の受付終了表示に失敗:`, e));
        console.log(`[Reset] ${msg.id} を受付終了にしました`);
      } catch (e) {
        console.warn(`[Reset] ${msg.id} の処理に失敗:`, e);
      }
    }

    // ③ 作り直す
    const dedupe = (lines) => {
      const seen = new Set();
      const out = [];
      for (const line of lines) {
        const id = line.match(/<@(\d+)>/)?.[1];
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(line);
      }
      return out;
    };

    for (const target of resolveWeekendTargets()) {
      const seedLines = dedupe(seeds[target.dayKey] || []);
      console.log(`[Reset] ${target.label} のカードを投稿します（引き継ぎ${seedLines.length}名）`);
      await postDayRecruitmentCard(env, channelId, target, { seedLines, skipDuplicateCheck: true });
    }
    console.log('[Reset] 作り直しが完了しました');
  } catch (err) {
    console.error('[Reset] error:', err);
  }
}

/**
 * その日の募集カードと現在の参加人数を取得する。
 *
 * ★ 2026-09-23: 探索の主経路をチャンネル走査にした。以前は `recruitments` の
 *   start_at で引いていたが、同テーブルは実測で全件0行であり（Botからの書き込みが
 *   成立していない）、中間アナウンスも20:00開催判定も常に「カードが見つかりません」で
 *   空振りする。DBが直った場合に備えて、走査で見つからなかったときだけDBを試す。
 */
export async function loadDayRecruitmentSummary(env, target, messages) {
  const channelId = CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID;

  // 1. Discordのチャンネルから直接探す（こちらが正）
  try {
    const recent = messages || await fetchRecentBotMessages(env, channelId);
    const card = findDayCard(recent, target);
    if (card) {
      const lines = extractEntryLines(card.embeds?.[0]?.fields?.[0]?.value);
      return {
        target,
        messageId: card.id,
        channelId: card.channel_id || channelId,
        message: card,
        lines,
        status: computeDayStatus(lines),
      };
    }
  } catch (e) {
    console.warn(`[Recruit] ${target.label}のチャンネル走査に失敗:`, e);
  }

  // 2. 走査で見つからない場合のみDBを当たる（カードが100件より前へ流れた場合の保険）
  try {
    const rows = await fetchSupabase(
      env, 'recruitments',
      `mode=eq.${encodeURIComponent('定期カスタム')}&start_at=eq.${encodeURIComponent(target.startAtIso)}` +
      `&select=id,discord_message_id,discord_channel_id,status&order=created_at.desc&limit=1`
    );
    if (!rows || rows.length === 0) {
      console.log(`[Recruit] ${target.label}の募集カードが見つかりません（チャンネル・DBとも）`);
      return null;
    }

    const row = rows[0];
    const msgRes = await fetchWithRetry(
      `https://discord.com/api/v10/channels/${row.discord_channel_id}/messages/${row.discord_message_id}`,
      { headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` } }
    );
    if (!msgRes.ok) {
      console.warn(`[Recruit] ${target.label}の募集カード(${row.discord_message_id})を取得できませんでした: ${msgRes.status}`);
      return null;
    }

    const message = await msgRes.json();
    const lines = extractEntryLines(message.embeds?.[0]?.fields?.[0]?.value);

    return {
      target,
      recruitId: row.id,
      messageId: row.discord_message_id,
      channelId: row.discord_channel_id,
      message,
      lines,
      status: computeDayStatus(lines, DAY_CAPACITY, target.dayKey),
    };
  } catch (e) {
    console.warn(`[Recruit] ${target.label}の募集カード取得に失敗:`, e);
    return null;
  }
}

/** チャンネルIDから Guild ID を解決する（メッセージリンクの組み立て用） */
export async function resolveGuildId(env, channelId) {
  try {
    const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
    });
    if (!res.ok) return null;
    return (await res.json()).guild_id || null;
  } catch (e) {
    return null;
  }
}

/**
 * 金曜19:00 / 土曜17:00 / 日曜17:00 の中間アナウンス（残り枠リマインド）。
 *
 * ★ 2026-09-23に全面的に作り直した。以前はこの通知が募集カードの参加者一覧・
 *   経験層分析まで丸ごと複製したEmbedを毎回投稿しており、同じ情報が週3回
 *   チャンネルへ積み上がっていた。さらに通知側にも参加ボタンが付いていたため、
 *   「押されたメッセージ」と「本来のカード」の間で fields を丸ごとコピーし合う
 *   同期処理が必要になり、カードを2枚に分けると土曜の内容が日曜カードを
 *   上書きする事故の温床になる。
 *   現在は「各日の残り枠 ＋ 募集カードへのリンク」だけを伝える1通に絞り、
 *   参加はカード側のボタンに一本化している。
 */
export async function cleanupOldReminderMessages(env, channelId) {
  try {
    const res = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages?limit=25`, {
      headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` }
    });
    if (!res.ok) return;
    const messages = await res.json();
    for (const m of messages) {
      if (!m.author?.bot) continue;
      const embedTitle = m.embeds?.[0]?.title || '';
      if (embedTitle.includes('KTM 土曜・本戦カスタム') || embedTitle.includes('KTM 日曜・お祭りカスタム')) {
        continue;
      }
      const isReminderEmbed = embedTitle.includes('週末カスタム 残り枠のお知らせ');
      const isShortfallContent = m.content && (
        m.content.includes('あと1名で開催確定！') ||
        m.content.includes('助っ人をピンポイント募集中') ||
        m.content.includes('状況案内:') ||
        m.content.includes('判定結果:') ||
        m.content.includes('参加できる方はエントリーをお願いします')
      );

      if (isReminderEmbed || isShortfallContent) {
        console.log(`[Cleanup] 古いBotリマインド/催促メッセージを削除: ${m.id}`);
        await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages/${m.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` }
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[Cleanup] リマインドメッセージ掃除エラー:', err);
  }
}

/**
 * チャンネル上の現在の定期カスタム募集カード（土曜・日曜）のメッセージ本文（content）を、
 * 最新の buildRecruitmentContent() に同期・更新する。
 * （※サイレント更新: allowed_mentions: { parse: [] } で不要な通知音を防止）
 */
export async function syncPeriodicCardContents(env) {
  const channelId = CONFIG.PERIODIC_RECRUIT_CHANNEL_ID || CONFIG.RECRUIT_CHANNEL_ID;
  const messages = await fetchRecentBotMessages(env, channelId);
  const targets = resolveWeekendTargets();
  const results = [];

  for (const target of targets) {
    const card = findDayCard(messages, target);
    if (!card) {
      results.push({ dayKey: target.dayKey, status: 'not_found', label: target.label });
      continue;
    }

    const newContent = buildRecruitmentContent(target, CONFIG.NOTIFICATION_ROLE_ID);
    const patchRes = await fetchWithRetry(`https://discord.com/api/v10/channels/${channelId}/messages/${card.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bot ${env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: newContent,
        allowed_mentions: { parse: [] } // サイレント更新
      }),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text().catch(() => '');
      console.error(`[SyncContent] ${target.label} の本文更新に失敗: ${patchRes.status} ${errText}`);
      results.push({ dayKey: target.dayKey, status: 'error', code: patchRes.status, detail: errText });
    } else {
      console.log(`[SyncContent] ${target.label} の本文を最新化しました (msg ${card.id})`);
      results.push({ dayKey: target.dayKey, status: 'updated', messageId: card.id });
    }
  }

  return results;
}
