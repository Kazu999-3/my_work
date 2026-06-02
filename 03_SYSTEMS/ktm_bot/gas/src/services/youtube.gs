/**
 * 📹 YouTube 連携サービス
 * プレイリスト内の動画をタスクとして管理し、解析完了後に自動削除する機能を支える。
 */

/**
 * 設定されたすべてのプレイリストから未処理の動画を取得する
 * @returns {Array} 動画タスクの配列
 */
function getYouTubePlaylistTasks() {
  const tasks = [];
  
  if (typeof YOUTUBE_SETTINGS === 'undefined' || !YOUTUBE_SETTINGS.WATCH_PLAYLIST_IDS) {
    console.error("YOUTUBE_SETTINGS が定義されていないか、WATCH_PLAYLIST_IDS が空です。");
    return tasks;
  }

  YOUTUBE_SETTINGS.WATCH_PLAYLIST_IDS.forEach(playlistId => {
    console.log(`[YouTube] プレイリストのスキャンを開始: ${playlistId}`);
    
    // デフォルトのプレースホルダーはスキップ
    if (!playlistId || playlistId.startsWith('PLxxxxxxxx')) {
      console.log(`[YouTube] プレースホルダーをスキップしました。`);
      return;
    }

    try {
      // プレイリスト自体の存在確認
      const plInfo = YouTube.Playlists.list('snippet', { id: playlistId });
      if (plInfo.items && plInfo.items.length > 0) {
        console.log(`[YouTube] プレイリスト名: ${plInfo.items[0].snippet.title}`);
      } else {
        console.warn(`[YouTube] プレイリストID ${playlistId} が見つかりません。`);
      }

      // プレイリストのアイテムを取得
      let nextPageToken = '';
      let itemCount = 0;
      do {
        const response = YouTube.PlaylistItems.list('snippet,contentDetails', {
          playlistId: playlistId,
          maxResults: 50,
          pageToken: nextPageToken
        });

        if (response.items && response.items.length > 0) {
          itemCount += response.items.length;
          response.items.forEach(item => {
            tasks.push({
              videoId: item.contentDetails.videoId,
              title: item.snippet.title,
              playlistItemId: item.id,
              playlistId: playlistId,
              publishedAt: item.snippet.publishedAt,
              description: item.snippet.description
            });
          });
        }
        nextPageToken = response.nextPageToken;
      } while (nextPageToken);

      console.log(`[YouTube] プレイリスト(${playlistId})から ${itemCount} 件の動画を取得しました。`);

    } catch (e) {
      console.error(`[YouTube] プレイリスト(${playlistId})の取得中にエラー: ${e.message}`);
      if (e.message.includes('404')) {
        console.error("-> プレイリストが見つかりません。IDが正しいか、または公開設定を確認してください。");
      }
    }
  });

  return tasks;
}

/**
 * プレイリストから指定されたアイテムを削除する
 * @param {string} playlistItemId 削除対象のアイテムID (videoIdではない)
 * @returns {boolean} 成功ならtrue
 */
function removeYouTubePlaylistItem(itemIdOrVideoId) {
  if (!itemIdOrVideoId) {
    throw new Error("ID が指定されていません。");
  }

  let playlistItemId = itemIdOrVideoId;

  // もし 11 桁（VideoID）の場合は、プレイリスト内を検索してアイテムIDを特定する
  if (itemIdOrVideoId.length === 11) {
    console.log(`[YouTube] videoId(${itemIdOrVideoId}) からアイテムIDを検索中...`);
    const tasks = getYouTubePlaylistTasks();
    const found = tasks.find(t => t.videoId === itemIdOrVideoId);
    if (found) {
      playlistItemId = found.playlistItemId;
      console.log(`[YouTube] アイテムIDを特定しました: ${playlistItemId}`);
    } else {
      const allIds = tasks.map(t => t.videoId).join(', ');
      console.warn(`[YouTube] プレイリスト内に videoId(${itemIdOrVideoId}) が見つかりませんでした。取得できたID一覧: [${allIds}]`);
      return false; 
    }
  }

  try {
    YouTube.PlaylistItems.remove(playlistItemId);
    console.log(`YouTubeプレイリストからアイテムを削除しました: ${playlistItemId}`);
    return true;
  } catch (e) {
    console.error(`YouTubeプレイリストアイテム(${playlistItemId})の削除中にエラー: ${e.message}`);
    throw e;
  }
}

/**
 * スプレッドシートメニューからYouTube連携の承認を促す
 */
function uiAuthorizeYouTube() {
  const ui = SpreadsheetApp.getUi();
  const playlistId = YOUTUBE_SETTINGS.WATCH_PLAYLIST_IDS[0];
  
  // システムの承認ダイアログを強制表示させるため、あえてエラーをキャッチしない
  const plInfo = YouTube.Playlists.list('snippet', { id: playlistId });
  
  if (plInfo.items && plInfo.items.length > 0) {
    ui.alert('✅ YouTube認証成功', `連携を確認しました。\nプレイリスト名: ${plInfo.items[0].snippet.title}`, ui.ButtonSet.OK);
  } else {
    ui.alert('⚠️ 認証は完了しましたが、プレイリストが見つかりません。', `ID: ${playlistId}`, ui.ButtonSet.OK);
  }
}
