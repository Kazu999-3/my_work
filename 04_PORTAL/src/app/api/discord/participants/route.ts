import { NextResponse } from 'next/server';

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
    // 1. 指定チャンネルの直近のメッセージを取得
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
    
    // 自作Botが出した「カスタム募集」のメッセージを探す
    // Embedのタイトルに「募集」が含まれ、かつ本文等からモードが「カスタム」であることを判定
    const targetMsg = messages.find((m: any) => {
      if (m.embeds && m.embeds.length > 0) {
        const embed = m.embeds[0];
        // embedのタイトルが募集関連であり、かつフィールドや説明に「カスタム」が含まれるものを探す
        const isRecruit = embed.title && embed.title.includes('募集');
        const isCustom = embed.fields?.some((f: any) => f.name.includes('モード') && f.value.includes('カスタム'));
        return isRecruit && isCustom;
      }
      return false;
    });

    if (!targetMsg) {
      return NextResponse.json({ error: '直近のメッセージに「カスタム募集」のメッセージが見つかりませんでした。' }, { status: 404 });
    }

    const activeDiscordIds = new Set<string>();

    // 参加者リストはBotがメッセージ内（例: メンション文字列やEmbedのフィールド）に記録していると想定
    // ここでは一番確実な、BotがEmbed内またはメッセージ本文に <@DiscordID> 形式で並べているものを抽出する
    // Embedのフィールドを舐めてメンションを探す
    const embed = targetMsg.embeds[0];
    
    // 通常、募集Embedには参加者リストが含まれる
    embed.fields?.forEach((f: any) => {
      // <@123456789> の形式を抽出
      const regex = /<@!?(\d+)>/g;
      let match;
      while ((match = regex.exec(f.value)) !== null) {
        activeDiscordIds.add(match[1]);
      }
    });

    // もし本文側にもあれば抽出
    if (targetMsg.content) {
      const regex = /<@!?(\d+)>/g;
      let match;
      while ((match = regex.exec(targetMsg.content)) !== null) {
        activeDiscordIds.add(match[1]);
      }
    }

    return NextResponse.json({ 
      success: true, 
      messageId: targetMsg.id,
      title: embed.title,
      activeDiscordIds: Array.from(activeDiscordIds) 
    });

  } catch (error: any) {
    console.error('Discord Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
