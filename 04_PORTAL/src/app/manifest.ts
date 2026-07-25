import type { MetadataRoute } from 'next';

// Chrome PWA インストール基準適合マニフェスト（id, purpose: 'any', scope 完全対応）
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'KTM ポータル',
    short_name: 'KTM',
    description: 'KTMカスタム運営・LoLパーソナルコーチ・攻略辞典ポータル',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#06070a',
    theme_color: '#06070a',
    lang: 'ja',
    prefer_related_applications: false,
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
