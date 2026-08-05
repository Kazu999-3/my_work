import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ktm-portal.vercel.app';

  const routes = [
    '',
    '/balancer',
    '/champions',
    '/leaderboard',
    '/search',
    '/changelog',
    '/synergy',
    '/stats',
    '/design',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: route === '' || route === '/balancer' || route === '/champions' ? 'daily' : 'weekly',
    priority: route === '' || route === '/balancer' ? 1.0 : 0.8,
  }));
}
