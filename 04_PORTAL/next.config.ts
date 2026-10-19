import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 2026-10-19: 他サイトの iframe に埋め込めないようにする（管理画面を透明に重ねてボタンを押させるクリックジャッキング対策）。
  // 自分のページを iframe で使っている箇所は無い（OBS のブラウザソースは直接開くので影響しない）
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  outputFileTracingIncludes: {
    '/api/admin/design': ['./public/design_docs/**/*'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ddragon.leagueoflegends.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
    ],
  },
};

export default nextConfig;
