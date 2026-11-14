import { NextResponse } from 'next/server';
import { takePostCooldown } from '../../../../lib/postCooldown';

export const dynamic = 'force-dynamic';

// チーム用VC（BLUE / RED）のデフォルトID
const DEFAULT_VC_CHANNEL_IDS = [
  '1485636150725972104', // 🟦 TEAM-BLUE
  '1487066156547444737', // 🟥 TEAM-RED
];

// Discord ボイスチャンネルの動的ステータス（吹き出し）API
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { status } = body;

    const botToken = process.env.DISCORD_BOT_TOKEN;
    const configuredVc = process.env.DISCORD_CUSTOM_VC_ID || process.env.DISCORD_VOICE_CHANNEL_ID;
    const targetChannelIds = configuredVc ? [configuredVc] : DEFAULT_VC_CHANNEL_IDS;

    // 連打防止（10秒クールダウン）
    const wait = await takePostCooldown('discord_vc_status_cooldown', 10 * 1000);
    if (wait !== null) {
      return NextResponse.json({ success: false, error: `${wait}秒ほど待ってから試してください。` }, { status: 429 });
    }

    if (!botToken) {
      return NextResponse.json({
        success: false,
        error: 'DISCORD_BOT_TOKEN が環境変数に設定されていません。'
      }, { status: 500 });
    }

    let newStatusText = '';

    if (status === 'game1') {
      newStatusText = '🎮 1戦目進行中 (途中交代歓迎)';
    } else if (status === 'game2') {
      newStatusText = '🎮 2戦目進行中 (途中交代歓迎)';
    } else if (status === 'game3') {
      newStatusText = '🔥 3戦目進行中 (最終決戦)';
    } else if (status === 'game4') {
      newStatusText = '⚔️ 4戦目進行中 (延長戦)';
    } else if (status === 'mayhem') {
      newStatusText = '🎪 締めメイヘム中！';
    } else if (status === 'reset') {
      newStatusText = '';
    } else if (typeof status === 'string' && status.trim()) {
      newStatusText = status.trim().slice(0, 40);
    } else {
      return NextResponse.json({ error: '有効なステータスを指定してください。' }, { status: 400 });
    }

    // Discord公式「ボイスステータス (PUT /channels/{channel_id}/voice-status)」を設定
    // チャンネル名自体はリネームせず、VC横の吹き出しコメントにのみ進行状況を表示してチャンネル名を保護
    const results = await Promise.all(
      targetChannelIds.map(async (cid) => {
        try {
          const vsRes = await fetch(`https://discord.com/api/v10/channels/${cid}/voice-status`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bot ${botToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatusText })
          });
          return { channelId: cid, ok: vsRes.ok, status: vsRes.status };
        } catch (err: any) {
          return { channelId: cid, ok: false, error: err.message };
        }
      })
    );

    const anySuccess = results.some(r => r.ok);
    if (!anySuccess) {
      console.warn('[vc-status POST] All voice-status updates failed:', results);
      return NextResponse.json({
        success: false,
        error: 'Discord VCステータスの更新に失敗しました（Botの権限またはチャンネル設定を確認してください）。'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      channels: results,
      statusText: newStatusText,
      message: newStatusText
        ? `Discord VC（TEAM-BLUE / RED）に「${newStatusText}」を設定しました！`
        : 'Discord VCステータスをクリアしました！'
    });
  } catch (error: any) {
    console.error('[vc-status POST] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
