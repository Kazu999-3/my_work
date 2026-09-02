import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { CHANGELOG } from '../../lib/changelog';

// メンバー向け更新履歴ページ(#83)
export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background text-stone-800 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 戻るリンク */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-700 hover:text-stone-900 font-bold text-xs shadow-2xs hover:bg-stone-50 transition"
          >
            <span>←</span>
            <span>ポータルトップへ戻る</span>
          </Link>
        </div>

        <div className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-stone-900 flex items-center gap-3">
            <ScrollText className="h-7 w-7 md:h-8 md:w-8 text-cyan-600" />
            更新情報
          </h1>
          <p className="text-stone-500 mt-2 text-xs md:text-sm font-medium">KTMポータル・BOTの最近のアップデート一覧です。</p>
        </div>

        <div className="space-y-6">
          {CHANGELOG.map((entry) => (
            <div key={entry.date + entry.title} className="bg-white border border-stone-200 rounded-2xl p-6 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-indigo-500"></div>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h2 className="text-lg font-black text-stone-900">{entry.title}</h2>
                <span className="text-xs font-mono text-stone-500">{entry.date}</span>
              </div>
              <ul className="space-y-1.5">
                {entry.items.map((item, i) => (
                  <li key={i} className="text-sm text-stone-700 leading-relaxed">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
