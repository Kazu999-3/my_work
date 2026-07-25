import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import PwaRegister from "../components/PwaRegister";
import Toaster from "../components/Toaster";

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
  themeColor: "#06070a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased bg-[#06070a] text-white flex min-h-screen">
        <PwaRegister />
        <Toaster />
        <Sidebar />
        <div className="flex-1 min-w-0 pb-20 md:pb-0">
          {children}
        </div>
      </body>
    </html>
  );
}
