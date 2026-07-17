import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import PwaRegister from "../components/PwaRegister";

export const metadata: Metadata = {
  title: "Sovereign Command Center",
  description: "Advanced analytics and automation portal",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "KTM" },
};

export const viewport: Viewport = {
  themeColor: "#0e0e1a",
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
        <Sidebar />
        <div className="flex-1 min-w-0 pb-20 md:pb-0">
          {children}
        </div>
      </body>
    </html>
  );
}
