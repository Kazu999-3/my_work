import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ktm-portal.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /design・/search・/champions・/coach・/ktm-adminは「本来非公開(閲覧含め管理者専用)の
        // つもりだが、ページ自体はクライアント側のfetch('/api/auth/verify')判定のみでガードされて
        // おり、/adminプレフィックスにも一致しないため実装上は無認証でも到達できる」ページ。
        // 認証追加が本筋だが、検索エンジンへの露出を増幅しないための保険として除外する
        // (2026-08-06発覚: /design・/searchだけが対象になっており、同じ理由が当てはまる
        // /champions・/coach・/ktm-adminが漏れていた)。
        disallow: ['/admin/', '/api/admin/', '/design', '/search', '/champions', '/coach', '/ktm-admin'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
