import { NextResponse } from 'next/server';

/**
 * 参照系APIのCDNキャッシュ付きレスポンス。
 *
 * ★ 2026-09-22 新設の背景:
 * ポータルのAPIは102本が `force-dynamic` で、同じデータでも毎回Supabaseを叩いていた
 * （実測: /api/champions/dictionary-overview 1,061ms、/api/leaderboard 698ms）。
 *
 * 当初 `export const revalidate = N` を付けたが**効かなかった**。supabase-js が内部の
 * fetch を no-store で実行するため Next.js から見てルートが常に動的と判定され、
 * ビルド時に「couldn't be rendered statically」の警告が出るだけでキャッシュされない。
 * そのため Cache-Control を明示してCDN(Vercel Edge)側でキャッシュさせる方式にした。
 *
 * ⚠️ 適用してよいのは「認証不要」かつ「多少古くても支障がない」GETのみ。
 * カジノの残高、バランサーの参加者リスト、進行中の試合など即時性が要るものには使わないこと。
 * CDNキャッシュは全ユーザー共通のため、個人向けデータに付けると他人の値が見える事故になる。
 */
export function cachedJson(data: unknown, sMaxAge = 60, swr = 300) {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
    },
  });
}
