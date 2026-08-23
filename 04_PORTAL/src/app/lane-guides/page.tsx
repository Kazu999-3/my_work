'use client';

import { useEffect, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Map as MapIcon, Sparkles, RefreshCw, CheckCircle2, X, Eye, BookHeart, FileText, SplitSquareVertical, Columns } from 'lucide-react';
import Link from 'next/link';
import { Spinner, EmptyState } from '../../components/Feedback';
import { diffLines, diffSummary, diffSideBySide, type DiffLine, type SideBySideLine } from '../../lib/diffUtils';

export default function LaneGuidesPage() {
  const [data, setData] = useState<any>(null);
  const [active, setActive] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  // AI清書・体系化リライト状態
  const [refining, setRefining] = useState(false);
  const [savingRefined, setSavingRefined] = useState(false);
  const [refinePreview, setRefinePreview] = useState<{
    lane: string;
    title: string;
    refinedBody: string;
    originalBody: string;
    sourceCount: number;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then((res) => res.json())
      .then((d) => setIsAuthenticated(!!d.valid))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const fetchGuides = () => {
    if (!isAuthenticated) return;
    fetch('/api/admin/lane-guides', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.guides?.length > 0 && !active) setActive(d.guides[0].lane);
      })
      .catch(() => setData({ guides: [], lanes: [] }));
  };

  useEffect(() => {
    fetchGuides();
  }, [isAuthenticated]);

  // AI清書プレビューの取得
  const handleStartRefine = async (laneKey: string) => {
    setRefining(true);
    try {
      const res = await fetch('/api/admin/lane-guides/refine', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lane: laneKey, dryRun: true }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || '清書の生成に失敗しました');
      setRefinePreview({
        lane: d.lane,
        title: d.title,
        refinedBody: d.refinedBody,
        originalBody: d.originalBody,
        sourceCount: d.sourceCount,
      });
    } catch (e: any) {
      showToast(`❌ 清書エラー: ${e.message}`, 'error');
    } finally {
      setRefining(false);
    }
  };

  // 清書結果の確定保存
  const handleConfirmRefine = async () => {
    if (!refinePreview) return;
    setSavingRefined(true);
    try {
      const res = await fetch('/api/admin/lane-guides/refine', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lane: refinePreview.lane, dryRun: false }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || '保存に失敗しました');
      showToast('✨ AI清書版をガイドへ反映しました！', 'success');
      setRefinePreview(null);
      fetchGuides();
    } catch (e: any) {
      showToast(`❌ 保存エラー: ${e.message}`, 'error');
    } finally {
      setSavingRefined(false);
    }
  };

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
        {/* トースト通知 */}
        {toastMessage && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold animate-fade-in ${
            toastMessage.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}>
            {toastMessage.text}
          </div>
        )}

        {/* ヘッダー */}
        <div className="border-b border-black/10 pb-6 flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div>
            <h1 className="text-3xl font-bold text-stone-900 flex items-center gap-3">
              <MapIcon className="h-8 w-8 text-amber-600" />
              レーン別ガイド
            </h1>
            <p className="text-stone-500 mt-2 text-sm">
              攻略ライブラリの記事から、<strong className="text-amber-700">レーンごとの立ち回り・マクロ</strong>を1本に統合したガイドです。
              どのレーンでも通用する判断・考え方は<strong className="text-amber-700">「全レーン共通」</strong>にまとまっています。
            </p>
          </div>
          <Link
            href="/champions"
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 border border-stone-200"
          >
            <BookHeart size={14} className="text-[#c89b3c]" />
            <span>チャンピオン辞典へ</span>
          </Link>
        </div>

        {guides.length === 0 ? (
          <EmptyState
            title="まだガイドが作成されていません"
            message="管理者が「レーン別ガイドへ統合」を実行すると、ここに各レーンのガイドが並びます。"
          />
        ) : (
          <>
            <div className="flex gap-2 flex-wrap items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                {guides.map((g: any) => (
                  <button
                    key={g.lane}
                    onClick={() => setActive(g.lane)}
                    className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
                      active === g.lane ? 'bg-amber-600 text-white shadow-xs' : 'bg-black/5 text-stone-500 hover:text-stone-900 hover:bg-black/10'
                    }`}
                  >
                    {laneLabel(g.lane)}
                  </button>
                ))}
              </div>

              {/* ✨ AI清書・体系化ボタン */}
              {current && (
                <button
                  type="button"
                  onClick={() => handleStartRefine(current.lane)}
                  disabled={refining}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50"
                  title="蓄積された知見の重複を排除し、序盤・中盤・終盤の美しい章立てで清書します"
                >
                  {refining ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  <span>{refining ? 'AIが清書・整理中...' : '✨ 蓄積知見をAI清書・体系化'}</span>
                </button>
              )}
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
                <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-6 flex-wrap gap-2">
                  <div>
                    <h2 className="text-2xl font-black text-stone-900 mb-1">{current.title}</h2>
                    <p className="text-[11px] text-stone-500 flex items-center gap-2 flex-wrap">
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
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStartRefine(current.lane)}
                    disabled={refining}
                    className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    <Sparkles size={12} className="text-amber-600" />
                    <span>清書・体系化を実行</span>
                  </button>
                </div>
                <div className="prose prose-sm max-w-none prose-headings:text-amber-800 prose-strong:text-stone-900 prose-li:text-stone-700 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{current.body}</ReactMarkdown>
                </div>
              </article>
            )}
          </>
        )}

        {/* ✨ AI清書 差分プレビューモーダル (Markdown並列比較 ＆ 行Diff ＆ 完成プレビュー) */}
        {refinePreview && (() => {
          const sbsRows = diffSideBySide(refinePreview.originalBody, refinePreview.refinedBody);
          const summary = diffSummary(refinePreview.originalBody, refinePreview.refinedBody);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-sm animate-fade-in">
              <div className="bg-[#fcfbf9] border border-stone-200 rounded-3xl w-full max-w-6xl max-h-[92vh] overflow-hidden p-6 shadow-2xl flex flex-col space-y-4">
                {/* ヘッダー */}
                <div className="flex items-center justify-between border-b border-stone-200 pb-3 flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-black text-stone-900 flex items-center gap-2">
                        <Sparkles size={22} className="text-amber-600" />
                        <span>レーンガイド AI清書・体系化プレビュー</span>
                      </h3>
                      <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
                        {refinePreview.title}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      散らばっていた複数の知見を、序盤・中盤・終盤の章立てに再構成し、重複を排除しました。
                    </p>
                  </div>
                  <button
                    onClick={() => setRefinePreview(null)}
                    disabled={savingRefined}
                    className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* 💡 AI整理の要約バー */}
                <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl px-4 py-2 text-xs flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-amber-900 font-bold">
                    <span>💡 整理ポイント:</span>
                    <span className="font-normal text-amber-800">
                      パッチワーク状の【追記知見】を統合 ➔ 序盤・中盤・終盤・マクロの5大章立てに再構成
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-stone-600">
                    <span>清書前: {refinePreview.originalBody.length} 文字</span>
                    <span>➔</span>
                    <span className="text-amber-700 font-black">清書後: {refinePreview.refinedBody.length} 文字</span>
                  </div>
                </div>

                {/* 📄 左右並列 Markdown ドキュメント比較（文章としてそのまま読める！） */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden min-h-[45vh] max-h-[55vh]">
                  {/* 左列: 清書前の蓄積データ */}
                  <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 shadow-2xs flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2 mb-3 shrink-0">
                      <span className="text-xs font-black text-stone-600 flex items-center gap-1.5">
                        <span>📄</span> 清書前（蓄積された生知見）
                      </span>
                      <span className="text-[10px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded font-mono font-bold">
                        {refinePreview.sourceCount || 0} 本の記事から統合
                      </span>
                    </div>
                    <div className="prose prose-xs max-w-none text-stone-600 overflow-y-auto pr-2 leading-relaxed flex-1 prose-headings:text-stone-800">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{refinePreview.originalBody}</ReactMarkdown>
                    </div>
                  </div>

                  {/* 右列: 清書後の完成攻略ガイド */}
                  <div className="bg-white border-2 border-amber-400/80 rounded-2xl p-4 shadow-md flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-amber-100 pb-2 mb-3 shrink-0">
                      <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-600" />
                        <span>清書後（AI体系化リライト完成版）</span>
                      </span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-mono font-black">
                        完全体系化
                      </span>
                    </div>
                    <div className="prose prose-xs max-w-none prose-headings:text-amber-800 prose-strong:text-stone-900 text-stone-800 overflow-y-auto pr-2 leading-relaxed flex-1 font-medium">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{refinePreview.refinedBody}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                {/* フッターアクション */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-stone-200 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setRefinePreview(null)}
                    disabled={savingRefined}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-500 hover:bg-stone-100 transition"
                  >
                    破棄して閉じる
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRefine}
                    disabled={savingRefined}
                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-md shadow-amber-600/20 disabled:opacity-50"
                  >
                    {savingRefined ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    <span>{savingRefined ? '反映処理中...' : '✨ この清書版でガイドを更新する'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
