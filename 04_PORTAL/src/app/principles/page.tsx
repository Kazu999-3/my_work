'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen } from 'lucide-react';
import { Spinner, EmptyState } from '../../components/Feedback';

// 汎用原則の閲覧ページ（メンバー向け）。
// チャンピオン固有の話を除いた「どのチャンプでも通用する判断・マクロ」を読む場所。
export default function PrinciplesPage() {
  const [data, setData] = useState<any>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/principles')
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.principles?.length > 0) setActive(d.principles[0].theme);
      })
      .catch(() => setData({ principles: [], themes: [] }));
  }, []);

  if (!data) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><Spinner label="読み込み中..." /></div>;
  }

  const principles = data.principles || [];
  const current = principles.find((p: any) => p.theme === active);
  const themeLabel = (key: string) => (data.themes || []).find((t: any) => t.key === key)?.label || key;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="border-b border-gray-800 pb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-emerald-400" />
            上達の原則
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            チャンピオン辞典やメモから、<strong className="text-emerald-300">特定のチャンプに依存しない判断・マクロ・考え方</strong>だけを抽出したテキストです。
          </p>
        </div>

        {principles.length === 0 ? (
          <EmptyState
            title="まだ原則が作成されていません"
            message="管理者が「上達の原則を生成」を実行すると、ここに読み物が並びます。"
          />
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {principles.map((p: any) => (
                <button
                  key={p.theme}
                  onClick={() => setActive(p.theme)}
                  className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
                    active === p.theme
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {themeLabel(p.theme)}
                </button>
              ))}
            </div>

            {current && (
              <article className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8">
                <h2 className="text-2xl font-black text-white mb-1">{current.title}</h2>
                <p className="text-[11px] text-gray-500 mb-6">
                  {current.source_count}件のメモ・辞典から抽出 ／ 更新: {new Date(current.generated_at).toLocaleDateString('ja-JP')}
                </p>
                <div className="prose prose-invert prose-sm max-w-none prose-headings:text-emerald-300 prose-strong:text-white prose-li:text-gray-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{current.body}</ReactMarkdown>
                </div>
              </article>
            )}
          </>
        )}
      </div>
    </div>
  );
}
