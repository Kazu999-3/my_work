import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.resolve('.'),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ddragon.leagueoflegends.com',
      },
    ],
  },
};

export default nextConfig;
