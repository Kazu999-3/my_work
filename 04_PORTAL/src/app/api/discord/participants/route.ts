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
    
    // Embedのタイトルに「募集」または「確定」が含まれ、かつフッターからモードが「カスタム」であることを判定
    const targetMsg = messages.find((m: any) => {
      if (m.embeds && m.embeds.length > 0) {
        const embed = m.embeds[0];
        // embedのタイトルが募集関連であり、かつフッターに「カスタム」が含まれるものを探す
        const isRecruit = embed.title && (embed.title.includes('募集') || embed.title.includes('確定'));
        const isCustom = embed.footer?.text?.includes('モード: カスタム');
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
