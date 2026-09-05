import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { CHANGELOG } from '../../lib/changelog';

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background text-stone-800 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* ヘッダー */}
        <div className="bg-white/80 backdrop-blur-sm border border-stone-200/90 rounded-2xl p-5 shadow-xs">
          <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900 flex items-center gap-2.5">
            <ScrollText className="h-7 w-7 text-cyan-600" />
            更新情報 ＆ リリースノート
          </h1>
          <p className="text-stone-500 mt-1 text-xs font-bold">
            KTMポータル・戦術オーバーレイ・BOTの最新アップデート一覧です 🚀
          </p>
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
