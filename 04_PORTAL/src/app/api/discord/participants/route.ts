import { NextResponse } from 'next/server';
import { resolveDisplayName } from '../../../../lib/discordName';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export const revalidate = 30; // 30秒間キャッシュしてDiscord APIへのリクエストを削減

/**
 * 直近20件のチャンネルメッセージをEmbedタイトル/フッターの文字列一致で走査する旧実装は、
 * Bot側の文言（「募集」「確定」「モード: カスタム」）が変わると静かに壊れる作りだった。
 * recruitments テーブル（②で新設）に owner・status が正規に記録されるようになったので、
 * まずDBから「現在open状態の募集」のmessage_idを引き、それを直接1件取得する方式に変更する。
 * 参加者(joined)のロスター自体はまだDiscord埋め込みメタデータにしか無いため、
 * そこだけは引き続きメッセージ本文/Embedから抽出する。
 */
export async function GET() {
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const DISCORD_CHANNEL_ID = process.env.DISCORD_KTM_CHANNEL_ID;

  if (!DISCORD_BOT_TOKEN) {
    return NextResponse.json({ error: 'Discord BOT Token is not configured' }, { status: 500 });
  }
  if (!DISCORD_CHANNEL_ID) {
    return NextResponse.json({ error: '環境変数 DISCORD_KTM_CHANNEL_ID が設定されていません。.env.local に追記してください。' }, { status: 500 });
  }

  try {
    // 1. recruitmentsテーブルから直近のopen状態の募集を取得（あればそのmessage_idを使う）
    let targetMsg: any = null;
    const { data: openRecruitment } = await supabase
      .from('recruitments')
      .select('discord_message_id')
      .eq('discord_channel_id', DISCORD_CHANNEL_ID)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openRecruitment?.discord_message_id) {
      const singleRes = await fetch(
        `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages/${openRecruitment.discord_message_id}`,
        { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
      );
      if (singleRes.ok) {
        targetMsg = await singleRes.json();
      }
    }

    // 2. DB側にレコードがない/取得できなかった場合のみ、旧来のメッセージ走査にフォールバックする
    //    （recruitmentsテーブルへの書き込みがまだ行われていないbotバージョンとの後方互換のため）
    if (!targetMsg) {
      const msgsRes = await fetch(`https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages?limit=20`, {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        },
      });

      if (!msgsRes.ok) {
        const errText = await msgsRes.text();
        return NextResponse.json({ error: `Failed to fetch messages: ${errText}` }, { status: msgsRes.status });
      }

      const messages = await msgsRes.json();

      // Embedのタイトル/フッターの固定文言一致だけでは、定期カスタム(postWeeklyRecruitment)の
      // 実際の文言(title="⚔️ KTM 定期カスタム開催告知 [...]"、footer="日時: ... | 主催: KTM運営")
      // が「募集」「確定」「モード: カスタム」のどれにも一致せず、このメッセージ自体は
      // チャンネルに存在するのに永久にヒットしなかった(2026-08-10発覚)。定期カスタム側の
      // 実際の文言と、本文(content)に必ず含まれる「【定期カスタム募集】」も判定に加える。
      //
      // さらに「モード: カスタム」の完全一致だけを見ていたが、実際にBotが生成する募集は
      // 「モード: ノーマル」がデフォルトで(modals.js)、ほとんどのユーザー作成の募集は
      // ノーマルモードのまま作られている。ここでの「カスタム」はゲームモード名ではなく
      // 「Discordで募集されたKTMのカスタムゲーム」全般を指す言葉として使われているため、
      // モードの値(ノーマル/カスタム/ARAM/定期カスタム)を問わず、embeds.js/scheduled.jsが
      // 生成する「モード: X | 募集主: ...」または「主催: KTM運営」という構造そのもので
      // 判定する(2026-08-15発覚。直近20件が全て「モード: ノーマル」で作成されており、
      // Discord参加者取得ボタンが常に「見つかりませんでした」になっていた)。
      targetMsg = messages.find((m: any) => {
        const embed = m.embeds?.[0];
        if (!embed) return false;
        const title = embed.title || '';
        const footerText = embed.footer?.text || '';
        const isRecruitTitle = title.includes('募集') || title.includes('確定') || title.includes('定期カスタム') || title.includes('開催告知');
        const isKtmRecruitmentFooter = /モード: \S+/.test(footerText) || footerText.includes('主催: KTM運営');
        if (isRecruitTitle && isKtmRecruitmentFooter) return true;
        if (m.content && (m.content.includes('カスタム募集') || m.content.includes('定期カスタム'))) return true;
        return false;
      });
    }

    if (!targetMsg) {
      return NextResponse.json({ error: '直近のメッセージに「カスタム募集」のメッセージが見つかりませんでした。' }, { status: 404 });
    }

    const activeDiscordIds = new Set<string>();

    // 2. Discord Scheduled Events から「興味あり」表明メンバーの Discord ID をマージ
    const guildId = process.env.DISCORD_GUILD_ID;
    if (guildId) {
      try {
        console.log(`Fetching scheduled events from guild: ${guildId}`);
        const eventsRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events`, {
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          },
        });

        if (eventsRes.ok) {
          const scheduledEvents = await eventsRes.json();
          // アクティブなイベント（ステータスが1: SCHEDULED または 2: ACTIVE）をフィルタリング
          const targetEvents = scheduledEvents.filter((e: any) => {
            const isActive = e.status === 1 || e.status === 2;
            const isTarget = e.name && (e.name.includes("【定期】") || e.name.includes("カスタム"));
            return isActive && isTarget;
          });

          for (const ev of targetEvents) {
            console.log(`Fetching interested users for scheduled event: ${ev.name} (${ev.id})`);
            const usersRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/scheduled-events/${ev.id}/users?limit=100&with_member=true`, {
              headers: {
                Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              },
            });
            if (usersRes.ok) {
              const eventUsers = await usersRes.json();
              eventUsers.forEach((eu: any) => {
                if (eu.user && eu.user.id) {
                  activeDiscordIds.add(eu.user.id);
                }
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch scheduled event participants:', err);
      }
    }

    // 3. 参加者リストはBotがメッセージ内（例: メンション文字列やEmbedのフィールド）に記録していると想定
    // ここでは一番確実な、BotがEmbed内またはメッセージ本文に <@DiscordID> 形式で並べているものを抽出する
    // Embedのフィールドを舐めてメンションを探す
    const embed = targetMsg.embeds[0];
    
    const extractMentions = (text: string) => {
      if (!text) return;
      const regex = /<@!?(\d+)>/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        activeDiscordIds.add(match[1]);
      }
    };

    // 説明文 (description) に参加者リストが書かれている
    extractMentions(embed.description);

    // フィールドにもあれば抽出
    embed.fields?.forEach((f: any) => {
      extractMentions(f.value);
    });

    // もし本文側にもあれば抽出
    extractMentions(targetMsg.content);

    // 抽出したID群から最新の表示名を取得する。
    // 管理ダッシュボード(/api/discord/members)と同じく「サーバーニックネーム優先」で解決し、
    // 両ページで名前が一致するようにする（ニックネーム → global_name → username）。
    const guildIdForNames = process.env.DISCORD_GUILD_ID;
    const participantIds = Array.from(activeDiscordIds);
    const participants = await Promise.all(
      participantIds.map(async (id) => {
        try {
          // まずギルドメンバーとして取得（nick が取れる）
          if (guildIdForNames) {
            const memRes = await fetch(`https://discord.com/api/v10/guilds/${guildIdForNames}/members/${id}`, {
              headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
            });
            if (memRes.ok) {
              const m = await memRes.json();
              return { id, name: resolveDisplayName(m) };
            }
          }
          // フォールバック: グローバルユーザー
          const userRes = await fetch(`https://discord.com/api/v10/users/${id}`, {
            headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            return { id, name: userData.global_name || userData.username || "Unknown" };
          }
        } catch (e) {
          console.error(`Failed to fetch member/user ${id}`, e);
        }
        return { id: id, name: "Unknown" }; // 取得失敗時のフォールバック
      })
    );

    return NextResponse.json({ 
      success: true, 
      messageId: targetMsg.id,
      title: embed.title,
      activeDiscordIds: participantIds,
      participants: participants
    });

  } catch (error: any) {
    console.error('Discord Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
