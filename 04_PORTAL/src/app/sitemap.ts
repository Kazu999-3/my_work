import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ktm-portal.vercel.app';

  // /championsは閲覧含め管理者専用ページのため、robots.tsのdisallowと矛盾しないよう
  // 一般公開のsitemapには載せない(2026-08-06発覚)。
  const routes = [
    '',
    '/balancer',
    '/leaderboard',
    '/changelog',
    '/synergy',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: route === '' || route === '/balancer' ? 'daily' : 'weekly',
    priority: route === '' || route === '/balancer' ? 1.0 : 0.8,
  }));
}
