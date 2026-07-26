/**
 * ktm_bot（Cloudflare Workers）からポータルAPIを叩く経路の認証。
 *
 * ktm_bot の fetchPortalAPI はこれまで一切の認証ヘッダーを送っておらず、
 * riot/match-sync・player/update-lane・player/update-puuid 等が事実上
 * 無認証で誰でも叩ける状態だった（discordIdさえ分かれば任意プレイヤーの
 * データを書き換え可能等）。
 *
 * PORTAL_BOT_SECRET が未設定の間は意図的に fail-open（チェックをスキップ）
 * にしてある。Vercel側とCloudflare Workers側（ktm_bot の env.PORTAL_BOT_SECRET）
 * の両方に同じ値を設定した時点で自動的に有効化される。設定するまでは今と
 * 同じ挙動のまま。
 */
export function verifyBotSecret(req: Request): { ok: boolean; error?: string } {
  const expected = process.env.PORTAL_BOT_SECRET;
  if (!expected) {
    // 未設定の間は有効化しない（意図的なfail-open）。設定済みなら必須にする。
    return { ok: true };
  }
  const provided = req.headers.get('x-bot-secret');
  if (provided !== expected) {
    return { ok: false, error: 'Unauthorized (invalid bot secret)' };
  }
  return { ok: true };
}
