// 「📋 URL投函」: クリップボードの YouTube URL（読めなければ手入力）を動画解析キューへ追加する。
// 2026-10-07: page.tsx で同じ送信処理が3回コピーされていたのを1つにまとめた（動作は分割前と同じ）。

async function postToQueue(url: string) {
  const res = await fetch('/api/youtube/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const d = await res.json();
  if (res.ok && d.success) {
    alert(d.message || '✅ 解析キューに追加しました！');
  } else {
    alert(d.error || 'キュー追加に失敗しました');
  }
}

function askManually(): string | null {
  const manual = prompt('YouTubeのURLを入力してください（Xの投稿は「ナレッジ取り込み」から）:');
  return manual ? manual.trim() : null;
}

export async function enqueueYoutubeFromClipboard(): Promise<void> {
  let url: string | null = null;
  try {
    const clip = await navigator.clipboard.readText();
    url = clip.match(/https?:\/\/[^\s]+/i)?.[0] || askManually();
  } catch {
    // クリップボードの読み取りが許可されていない等
    url = askManually();
  }
  if (!url) return;
  try {
    await postToQueue(url);
  } catch {
    alert('キュー追加に失敗しました（通信エラー）');
  }
}
