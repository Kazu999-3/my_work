import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Discord ボイスチャンネルの動的リネーム API
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { status, channelId: customChannelId, defaultName } = body;

    // ステータス指定（例: 'game1' | 'game2' | 'reset' | カスタム文字列）
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = customChannelId || process.env.DISCORD_CUSTOM_VC_ID || process.env.DISCORD_VOICE_CHANNEL_ID;

    if (!botToken) {
      return NextResponse.json({
        success: false,
        error: 'DISCORD_BOT_TOKEN が環境変数に設定されていません。'
      }, { status: 500 });
    }

    if (!channelId) {
      return NextResponse.json({
        success: false,
        error: '対象のDiscordボイスチャンネルID（DISCORD_CUSTOM_VC_ID）が環境変数に設定されていません。'
      }, { status: 400 });
    }

    let newChannelName = '';
    if (status === 'game1') {
      newChannelName = '🔊 カスタム【1戦目進行中・途中交代歓迎】';
    } else if (status === 'game2') {
      newChannelName = '🔊 カスタム【2戦目進行中・途中交代歓迎】';
    } else if (status === 'game3') {
      newChannelName = '🔊 カスタム【3戦目進行中・最終決戦】';
    } else if (status === 'reset') {
      newChannelName = defaultName || '🔊 🎮カスタムVC';
    } else if (typeof status === 'string' && status.trim()) {
      newChannelName = status.trim();
    } else {
      return NextResponse.json({ error: '有効なステータスを指定してください。' }, { status: 400 });
    }

    // Discord REST API を呼び出してチャンネル名を更新 (PATCH /channels/{channel_id})
    const discordRes = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: newChannelName
      })
    });

    if (!discordRes.ok) {
      const errData = await discordRes.json().catch(() => ({}));
      console.error('[vc-status POST] Discord API error:', errData);
      
      // Discordのレートリミット (10分に2回まで) の場合
      if (discordRes.status === 429) {
        return NextResponse.json({
          success: false,
          error: 'Discordのチャンネル名変更レートリミット（10分間に2回まで）に達しました。少し時間を置いてから再度お試しください。'
        }, { status: 429 });
      }

      return NextResponse.json({
        success: false,
        error: errData.message || 'Discordチャンネル名の変更に失敗しました。'
      }, { status: discordRes.status });
    }

    const updatedChannel = await discordRes.json();

    return NextResponse.json({
      success: true,
      channelId,
      channelName: updatedChannel.name,
      message: `VCチャンネル名を「${updatedChannel.name}」に更新しました！`
    });
  } catch (error: any) {
    console.error('[vc-status POST] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
