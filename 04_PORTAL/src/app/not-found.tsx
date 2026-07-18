import Link from 'next/link';
import { Compass, Home } from 'lucide-react';

// 404ページ（#64）。存在しないURLに来たときの共通画面。
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#06070a] px-6 text-center text-white">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-[#c89b3c]">
        <Compass size={38} />
      </div>
      <div>
        <p className="text-5xl font-black tracking-tight text-[#c89b3c]">404</p>
        <p className="mt-3 text-sm font-bold text-gray-300">ページが見つかりませんでした</p>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-gray-500">
          URLが変更されたか、削除された可能性があります。下のボタンからホームに戻れます。
        </p>
      </div>
      <Link
        href="/balancer"
        className="inline-flex items-center gap-2 rounded-xl border border-[#c89b3c]/30 bg-[#c89b3c]/10 px-5 py-2.5 text-xs font-black text-[#c89b3c] transition-all hover:bg-[#c89b3c]/20"
      >
        <Home size={14} /> ホームへ戻る
      </Link>
    </div>
  );
}
