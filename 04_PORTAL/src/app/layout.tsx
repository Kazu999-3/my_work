import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import PwaRegister from "../components/PwaRegister";
import Toaster from "../components/Toaster";
import BackButton from "../components/BackButton";

export const metadata: Metadata = {
  title: {
    default: "KTM ポータル | LoL対戦バランサー＆攻略辞典・パーソナルコーチ",
    template: "%s | KTM ポータル",
  },
  description: "KTMカスタム対戦の公平なチーム分けバランサー、最新パッチ対面攻略辞典、MMR個人分析・パーソナルコーチングポータル。",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "KTM" },
  openGraph: {
    title: "KTM ポータル | LoL対戦バランサー＆攻略辞典",
    description: "KTMカスタム対戦のチーム分けバランサー、最新パッチ攻略辞典、個人分析ポータル。",
    siteName: "KTM ポータル",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KTM ポータル | LoL対戦バランサー＆攻略辞典",
    description: "KTMカスタム対戦のチーム分けバランサー、最新パッチ攻略辞典、個人分析ポータル。",
  },
};

export const viewport: Viewport = {
  themeColor: "#eae4d4",
};

import BackToTop from "../components/BackToTop";

import OfflineNotifier from "../components/OfflineNotifier";

import BottomNav from "../components/BottomNav";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        {/* 
          beforeinstallprompt を React hydration 前にグローバルキャッチ。
          Chrome はページ読み込み直後（React マウント前）にこのイベントを発火するため、
          useEffect 内のリスナーでは取りこぼす。ここでグローバル変数に退避しておく。
        */}
        <Script id="pwa-early-catch" strategy="beforeInteractive">{`
          window.__pwaPrompt = null;
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.__pwaPrompt = e;
          });
        `}</Script>
      </head>
      <body className="antialiased bg-background text-foreground flex min-h-screen">
        <PwaRegister />
        <Toaster />
        <OfflineNotifier />
        <Sidebar />
        <div className="flex-1 min-w-0 overflow-x-hidden pb-20 md:pb-0">
          <BackButton />
          {children}
        </div>
        <BackToTop />
      </body>
    </html>
  );
}
