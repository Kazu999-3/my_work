import type { Metadata, Viewport } from 'next';
import './globals.css';
import GlobalNavbar from '@/components/GlobalNavbar';

export const metadata: Metadata = {
  title: 'KTM PILOT | LoL個人戦術コックピット',
  description: '全173体チャンピオン辞典・Lv6キルラインAIコーチ・スタッツ深層分析を統合した個人戦術コックピット',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'KTM PILOT',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#101012',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body className="min-h-screen bg-[#0a0d14] text-slate-100 antialiased selection:bg-amber-500/30 flex flex-col pb-16 md:pb-0">
        <GlobalNavbar />
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
