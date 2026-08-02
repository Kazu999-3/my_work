'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Map as MapIcon } from 'lucide-react';
import { Spinner, EmptyState } from '../../components/Feedback';

// レーン別ガイドの閲覧ページ（メンバー向け）。
// 攻略ライブラリのマクロ記事をレーンごとに1本へ統合したものを読む場所。
export default function LaneGuidesPage() {
  const [data, setData] = useState<any>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/lane-guides')
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.guides?.length > 0) setActive(d.guides[0].lane);
      })
      .catch(() => setData({ guides: [], lanes: [] }));
  }, []);

  if (!data) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Spinner label="読み込み中..." /></div>;
  }

  const guides = data.guides || [];
  const current = guides.find((g: any) => g.lane === active);
  const laneLabel = (key: string) => (data.lanes || []).find((l: any) => l.key === key)?.label || key;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="border-b border-black/10 pb-6">
          <h1 className="text-3xl font-bold text-stone-900 flex items-center gap-3">
            <MapIcon className="h-8 w-8 text-amber-600" />
            レーン別ガイド
          </h1>
          <p className="text-stone-500 mt-2 text-sm">
            攻略ライブラリの記事から、<strong className="text-amber-700">レーンごとの立ち回り・マクロ</strong>を1本に統合したガイドです。
            どのレーンでも通用する判断・考え方は<strong className="text-amber-700">「全レーン共通」</strong>にまとまっています。
          </p>
        </div>

        {guides.length === 0 ? (
          <EmptyState
            title="まだガイドが作成されていません"
            message="管理者が「レーン別ガイドへ統合」を実行すると、ここに各レーンのガイドが並びます。"
          />
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {guides.map((g: any) => (
                <button
                  key={g.lane}
                  onClick={() => setActive(g.lane)}
                  className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
                    active === g.lane ? 'bg-amber-600 text-white' : 'bg-black/5 text-stone-500 hover:text-stone-900 hover:bg-black/10'
                  }`}
                >
                  {laneLabel(g.lane)}
                </button>
              ))}
            </div>

            {current && (
              <article className="bg-white/60 border border-black/10 rounded-2xl p-6 md:p-8">
                <h2 className="text-2xl font-black text-stone-900 mb-1">{current.title}</h2>
                <p className="text-[11px] text-stone-500 mb-6 flex items-center gap-2 flex-wrap">
                  <span>{current.source_count}本の記事を統合 ／ 更新: {new Date(current.updated_at).toLocaleDateString('ja-JP')}</span>
                  {(() => {
                    // 直近に更新されたガイドは気付けるようにしておく
                    const days = (Date.now() - new Date(current.updated_at).getTime()) / 86400000;
                    return days <= 3 ? (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                        NEW
                      </span>
                    ) : null;
                  })()}
                </p>
                <div className="prose prose-sm max-w-none prose-headings:text-amber-700 prose-strong:text-stone-900 prose-li:text-stone-700">
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
