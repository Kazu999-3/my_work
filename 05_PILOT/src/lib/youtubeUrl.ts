// YouTube のチャンネル/プレイリストURLの正規化（2026-10-06、/api/youtube/watch から共通化）。
// 共有ボタン由来の ?si=... などの追跡パラメータを落とす。プレイリストは list= だけ残す。
// 2026-10-01 に ?si= 付きのチャンネルURLの解決タスクが2回続けて失敗し、同じチャンネルの ?si 無しURLは成功していた。
// 「要対応」の判定や再実行がURLを文字列のまま比べていたため、登録済みなのに失敗が残り続けていた。

export type YoutubeWatchKind = 'channel' | 'playlist';

export function normalizeYoutubeUrl(raw: string, kind: YoutubeWatchKind): string {
  try {
    const u = new URL(String(raw).trim());
    if (kind === 'playlist') {
      const list = u.searchParams.get('list');
      return list ? `https://www.youtube.com/playlist?list=${list}` : String(raw).trim();
    }
    return `${u.origin}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return String(raw).trim();
  }
}

const RESOLVE_KIND: Record<string, YoutubeWatchKind> = {
  resolve_youtube_channel: 'channel',
  resolve_youtube_playlist: 'playlist',
};

/** 登録系タスクの payload.url を正規化した payload を返す（それ以外のタスクはそのまま） */
export function normalizeTaskPayload(taskType: string, payload: any): any {
  const kind = RESOLVE_KIND[taskType];
  if (!kind || !payload || typeof payload.url !== 'string') return payload || {};
  return { ...payload, url: normalizeYoutubeUrl(payload.url, kind) };
}

/** 同じ依頼かどうかを判定するキー（登録系はURLを正規化してから比べる） */
export function taskKey(taskType: string, payload: any): string {
  return `${taskType}|${JSON.stringify(normalizeTaskPayload(taskType, payload))}`;
}
