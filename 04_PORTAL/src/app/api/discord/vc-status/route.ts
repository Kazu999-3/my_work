import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Discord ボイスチャンネルの動的リネーム API
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { status, channelId: customChannelId, defaultName } = body;

    // ステータス指定（例: 'game1' | 'game2' | 'reset' | カスタム文字列）
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = customChannelId || process.env.DISCORD_CUSTOM_VC_ID || process.env.DISCORD_VOICE_CHANNEL_ID || '1548675524086472796';

    if (!botToken) {
      return NextResponse.json({
        success: false,
        error: 'DISCORD_BOT_TOKEN が環境変数に設定されていません。'
      }, { status: 500 });
    }

    let newStatusText = '';
    let fallbackChannelName = '';

    if (status === 'game1') {
      newStatusText = '🎮 1戦目進行中 (途中交代歓迎)';
      fallbackChannelName = '🔊 🎮カスタムVC (1戦目)';
    } else if (status === 'game2') {
      newStatusText = '🎮 2戦目進行中 (途中交代歓迎)';
      fallbackChannelName = '🔊 🎮カスタムVC (2戦目)';
    } else if (status === 'game3') {
      newStatusText = '🔥 3戦目進行中 (最終決戦)';
      fallbackChannelName = '🔊 🎮カスタムVC (3戦目)';
    } else if (status === 'reset') {
      newStatusText = '';
      fallbackChannelName = defaultName || '🔊 🎮カスタムVC';
    } else if (typeof status === 'string' && status.trim()) {
      newStatusText = status.trim();
      fallbackChannelName = status.trim();
    } else {
      return NextResponse.json({ error: '有効なステータスを指定してください。' }, { status: 400 });
    }

    // 1. Discord公式の「ボイスステータス（VC内のステータスコメント）」を設定 (PUT /channels/{channel_id}/voice-status)
    // チャンネル名をリネームせず、VC横・参加者上の吹き出しにステータスを表示するため、チャンネル幅を圧迫しない。
    let voiceStatusSuccess = false;
    try {
      const vsRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/voice-status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatusText
        })
      });
      if (vsRes.ok) {
        voiceStatusSuccess = true;
      }
    } catch (vsErr) {
      console.warn('[vc-status PUT] voice-status error:', vsErr);
    }

    // 2. ボイスステータスAPIが利用できない場合のフォールバック（またはリセット時）
    // ステータス設定が成功していればチャンネル名のリネーム（レート制限10分2回・幅圧迫）はスキップする
    if (!voiceStatusSuccess) {
      const discordRes = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: fallbackChannelName
        })
      });

      if (!discordRes.ok) {
        const errData = await discordRes.json().catch(() => ({}));
        console.error('[vc-status POST] Discord API error:', errData);
        if (discordRes.status === 429) {
          return NextResponse.json({
            success: false,
            error: 'Discordのレートリミット（10分間に2回まで）に達しました。'
          }, { status: 429 });
        }
        return NextResponse.json({
          success: false,
          error: errData.message || 'Discord VCステータスの更新に失敗しました。'
        }, { status: discordRes.status });
      }
    }

    return NextResponse.json({
      success: true,
      channelId,
      statusText: newStatusText,
      message: newStatusText ? `Discord VCステータスを「${newStatusText}」に設定しました！` : 'Discord VCステータスをクリアしました！'
    });
  } catch (error: any) {
    console.error('[vc-status POST] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
