/**
 * 📢 Discord 連携サービス (Proxy via Worker)
 */

/**
 * チーム分け結果を整形して Worker (Proxy) 経由で Discord へ送信する
 */
function postTeamsToDiscord(teamBlue, teamRed, spectators = []) {
  const url = KTM_WORKER_URL + "/announce-match";
  
  const payload = {
    teamBlue: teamBlue,
    teamRed: teamRed,
    spectators: spectators
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-gas-secret': INTERNAL_GAS_SECRET
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code !== 200) {
      const errText = response.getContentText();
      console.error('Worker Proxy Error: ' + code + ' - ' + errText);
      throw new Error('Proxy Server Error (' + code + '): ' + errText);
    }
    return code;
  } catch (e) {
    console.error('Discord Proxy Error: ' + e.message);
    throw e;
  }
}

/**
 * 汎用的なEmbed投稿 (Worker経由)
 */
function postEmbedToDiscord(embeds, channelId = null, content = "") {
  const url = KTM_WORKER_URL + "/post-report";
  
  const payload = {
    embeds: embeds,
    content: content,
    channelId: channelId
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-gas-secret': INTERNAL_GAS_SECRET
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code !== 200) {
      console.error('Worker PostReport Error: ' + code + ' - ' + response.getContentText());
    }
    return code;
  } catch (e) {
    console.error('Discord PostReport Error: ' + e.message);
  }
}
