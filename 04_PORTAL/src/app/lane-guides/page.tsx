'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Map as MapIcon } from 'lucide-react';
import { Spinner, EmptyState } from '../../components/Feedback';

// レーン別ガイドの閲覧ページ（管理者専用）。
// 攻略ライブラリのマクロ記事をレーンごとに1本へ統合したものを読む場所。
// 元データ(personal_knowledge・matchup_sentinel等)は辞典と同様に管理者専用のため、
// このページも同じ扱いに揃える(2026-08-05)。
export default function LaneGuidesPage() {
  const [data, setData] = useState<any>(null);
  const [active, setActive] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then((res) => res.json())
      .then((d) => setIsAuthenticated(!!d.valid))
      .catch(() => setIsAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/admin/lane-guides', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.guides?.length > 0) setActive(d.guides[0].lane);
      })
      .catch(() => setData({ guides: [], lanes: [] }));
  }, [isAuthenticated]);

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Spinner label="読み込み中..." /></div>;
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm rounded-2xl border border-black/10 bg-black/[0.03] p-8 backdrop-blur">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="text-lg font-bold mb-2 text-stone-900">認証が必要です</h2>
          <p className="text-sm text-stone-500 mb-6 leading-relaxed">
            レーン別ガイドは管理者専用です。管理者パスコードでログインしてから再度アクセスしてください。
          </p>
          <a
            href="/login"
            className="inline-block w-full rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-500"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

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

            {/* ⏱ 時間帯別マクロチェックリスト */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 shadow-xs">
              <h3 className="text-xs font-black text-amber-900 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <span>⏱</span> 試合中タイムライン・マクロチェックポイント
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                  <span className="text-[10px] font-mono font-extrabold text-amber-700 block">3:30 〜</span>
                  <strong className="text-stone-900 block mt-0.5">初動スカトル ＆ レーン介入</strong>
                  <p className="text-[11px] text-stone-500 mt-1">JGの位置を視界で特定し、ガンク回避または合流準備</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                  <span className="text-[10px] font-mono font-extrabold text-amber-700 block">8:00 〜</span>
                  <strong className="text-stone-900 block mt-0.5">ヴォイドグラブ出現</strong>
                  <p className="text-[11px] text-stone-500 mt-1">Top/Midのプライオリティを活かしてオブジェクト確保</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                  <span className="text-[10px] font-mono font-extrabold text-amber-700 block">14:00 〜</span>
                  <strong className="text-stone-900 block mt-0.5">タワープレート消滅</strong>
                  <p className="text-[11px] text-stone-500 mt-1">Bot/Midローテーション開始。サイドレーンの管理</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                  <span className="text-[10px] font-mono font-extrabold text-amber-700 block">20:00 〜</span>
                  <strong className="text-stone-900 block mt-0.5">バロンナッシャー出現</strong>
                  <p className="text-[11px] text-stone-500 mt-1">視界制圧と人数有利（ピックアップ）からのバロン決戦</p>
                </div>
              </div>
            </div>

            {current && (
              <article className="bg-white border border-stone-200/90 rounded-3xl p-6 md:p-8 shadow-xs">
                <h2 className="text-2xl font-black text-stone-900 mb-1">{current.title}</h2>
                <p className="text-[11px] text-stone-500 mb-6 flex items-center gap-2 flex-wrap">
                  <span>{current.source_count}本の記事を統合 ／ 更新: {new Date(current.updated_at).toLocaleDateString('ja-JP')}</span>
                  {(() => {
                    const days = (Date.now() - new Date(current.updated_at).getTime()) / 86400000;
                    return days <= 3 ? (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                        NEW
                      </span>
                    ) : null;
                  })()}
                </p>
                <div className="prose prose-sm max-w-none prose-headings:text-amber-700 prose-strong:text-stone-900 prose-li:text-stone-700 leading-relaxed">
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
