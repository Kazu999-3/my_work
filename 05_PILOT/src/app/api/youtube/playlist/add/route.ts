import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// YouTube Data API (プレイリスト書き込み)用のアクセストークンを
// 保存済みのリフレッシュトークンから動的に発行（旧ポータル完全互換）
async function getYoutubeAccessToken(): Promise<string | null> {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      console.warn('⚠️ [YouTube API] アクセストークン更新失敗:', await res.text());
      return null;
    }
    const data = await res.json();
    return data.access_token || null;
  } catch (err) {
    console.warn('⚠️ [YouTube API] アクセストークン更新エラー:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const videoId = String(body.videoId || '').trim();
    const targetPlaylistId = String(body.playlistId || process.env.YOUTUBE_TARGET_PLAYLIST_ID || 'PLPiEXmmDzgcs').trim();

    if (!videoId || videoId.length !== 11) {
      return NextResponse.json({ error: '有効な YouTube videoId (11桁) が必要です' }, { status: 400 });
    }

    if (!targetPlaylistId) {
      return NextResponse.json({ error: '追加先のプレイリストIDが指定されていません' }, { status: 400 });
    }

    const accessToken = await getYoutubeAccessToken();
    if (!accessToken) {
      return NextResponse.json({
        error: 'YouTube OAuth認証情報が未設定です（環境変数 YOUTUBE_OAUTH_REFRESH_TOKEN / CLIENT_ID / CLIENT_SECRET を確認してください）',
        needsAuth: true,
      }, { status: 401 });
    }

    // YouTube Data API v3 playlistItems.insert 呼び出し
    const insertRes = await fetch(
      'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            playlistId: targetPlaylistId,
            resourceId: { kind: 'youtube#video', videoId },
          },
        }),
      }
    );

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      let errJson: any = null;
      try {
        errJson = JSON.parse(errText);
      } catch {}

      const reason = errJson?.error?.errors?.[0]?.reason || '';
      // すでにプレイリスト内に存在している場合 (duplicate / videoAlreadyInPlaylist)
      if (reason === 'videoAlreadyInPlaylist' || errText.includes('already exists') || insertRes.status === 409) {
        return NextResponse.json({
          success: true,
          alreadyInPlaylist: true,
          message: 'すでにプレイリストに追加されています ✓',
          playlistId: targetPlaylistId,
          videoId,
        });
      }

      console.warn(`⚠️ [YouTube API] プレイリスト追加失敗 (${videoId}):`, errText);
      return NextResponse.json({
        error: `YouTube API エラー (${insertRes.status}): ${errJson?.error?.message || errText.slice(0, 150)}`,
      }, { status: insertRes.status });
    }

    const resData = await insertRes.json();
    return NextResponse.json({
      success: true,
      message: 'YouTubeプレイリストに追加しました！ ✓',
      playlistItemId: resData.id,
      playlistId: targetPlaylistId,
      videoId,
    });
  } catch (err: any) {
    console.error('⚠️ [YouTube API] プレイリスト追加処理中例外:', err);
    return NextResponse.json({ error: err.message || '内部エラーが発生しました' }, { status: 500 });
  }
}
