/**
 * Discord API 向けのリトライ付き fetch。
 *
 * 【なぜ必要か】
 * ポータル側の Discord 通知（`discordNotify.ts` / `discordMentorship.ts`）は、これまで
 * 素の `fetch` を17箇所で直接呼んでおり、**429（レート制限）を一切処理していなかった**。
 * Discord のレート制限は「チャンネルあたり5req/5秒」程度で、エラーログ通知のように
 * 障害時にまとめて発火する経路や、師弟ダッシュボードの連続更新で現実的に当たる。
 * 当たった瞬間その通知は捨てられ、`console.warn` だけが残る
 * （Vercel のログは追えるが、気づく仕組みが無い＝今日1日繰り返し直してきた
 * 「無言で失敗する」型そのもの）。
 *
 * KTM Bot 側（`03_SYSTEMS/ktm_bot/src/utils/api.js` の `fetchWithRetry`）には
 * 同じ問題に対する実績ある実装が既にある（「参加ボタン連打でレート制限に当たった瞬間に
 * 定期通知がまるごとスキップされた」という実害を受けて追加されたもの）。
 * ここはその移植で、挙動を意図的に揃えてある。
 *
 * 【リトライする条件】
 * - 429（Retry-After ヘッダを尊重する）
 * - 5xx（Discord 側の一時障害）
 * - ネットワーク例外
 * 4xx（401/403/404 等）はリトライしない。鍵違い・権限不足・対象消滅は待っても直らない。
 */

/** 429/5xx/ネットワーク例外を指数的に待って再試行する。最終試行のレスポンスはそのまま返す。 */
export async function discordFetch(
  url: string,
  options: RequestInit = {},
  retries = 3,
  baseDelayMs = 600
): Promise<Response> {
  let lastRes: Response | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, options);

      if (res.status === 429 || res.status >= 500) {
        lastRes = res;
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * (attempt + 1);
        if (attempt < retries - 1) {
          console.warn(
            `[discordFetch] ${res.status} を受けたため ${wait}ms 待って再試行します (${attempt + 1}/${retries - 1})`
          );
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        // 最終試行 → 呼び出し側が res.ok で判定できるようそのまま返す
        return res;
      }

      return res; // 成功 or リトライ不要な4xx
    } catch (e) {
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }

  // ループを抜けるのは retries<1 の場合のみ。型を満たすためのフォールバック。
  if (lastRes) return lastRes;
  return fetch(url, options);
}
