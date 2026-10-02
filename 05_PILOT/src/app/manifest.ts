import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KTM PILOT - LoL戦術コックピット',
    short_name: 'PILOT',
    description: '全173体チャンピオン辞典・Lv6キルラインAIコーチ・スタッツ深層分析を統合した個人戦術コックピット',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#101012',
    theme_color: '#101012',
    lang: 'ja',
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
    // Web Share Target API: スマホのYouTube/Xから共有先として認識させる
    share_target: {
      action: '/share-target',
      method: 'GET',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
      },
    },
  } as any;
}
