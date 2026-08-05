import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ktm-portal.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /design・/searchは「本来非公開のつもりだが実装上は無認証で到達可能」なページ
        // (認証追加が本筋だが、検索エンジンへの露出を増幅しないための保険として除外)。
        disallow: ['/admin/', '/api/admin/', '/design', '/search'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
