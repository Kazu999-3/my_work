import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ktm-portal.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /design・/champions・/coach・/ktm-adminは「本来非公開(閲覧含め管理者専用)の
        // 管理機能」であり、Googleインデックスに露出するとログイン画面で弾かれるだけの
        // ゴミページが検索結果に並ぶため、robots.txtでクロール自体を明示的に拒否する。
        disallow: ['/admin/', '/api/admin/', '/design', '/champions', '/coach', '/ktm-admin'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
