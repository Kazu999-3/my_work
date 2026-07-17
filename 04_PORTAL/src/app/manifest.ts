import type { MetadataRoute } from 'next';

// PWAマニフェスト（課題#48）。Next.jsが /manifest.webmanifest として配信する。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KTM ポータル',
    short_name: 'KTM',
    description: 'KTMカスタム運営・LoLパーソナルコーチ・攻略辞典ポータル',
    start_url: '/',
    display: 'standalone',
    background_color: '#06070a',
    theme_color: '#0e0e1a',
    lang: 'ja',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
