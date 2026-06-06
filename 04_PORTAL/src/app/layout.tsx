import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "../components/Sidebar";

export const metadata: Metadata = {
  title: "Sovereign Command Center",
  description: "Advanced analytics and automation portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased bg-[#06070a] text-white flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0 pb-20 md:pb-0">
          {children}
        </div>
      </body>
    </html>
  );
}
