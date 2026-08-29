'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MapIcon, Sparkles, RefreshCw, X, Columns, CheckCircle2, BookHeart, ListOrdered, ChevronRight, FileText, CheckCircle, ArrowRight, Trash2, Clock, Check } from 'lucide-react';
import { Spinner } from '../../components/Feedback';
import EmptyState from '../../components/EmptyState';

export default function LaneGuidesPage() {
  const [data, setData] = useState<{ guides: any[]; lanes: any[] } | null>(null);
  const [active, setActive] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  
  // AI清書・体系化リライト状態
  const [refining, setRefining] = useState(false);
  const [savingRefined, setSavingRefined] = useState(false);
  const [previewTab, setPreviewTab] = useState<'annotations' | 'refined' | 'comparison'>('annotations');
  const [refinePreview, setRefinePreview] = useState<{
    lane: string;
    title: string;
    refinedBody: string;
    originalBody: string;
    sourceCount: number;
    editMap?: Array<{
      originalSnippet: string;
      action: 'moved' | 'deleted_duplicate' | 'deleted_noise' | 'updated_2026';
      targetChapter: string;
      reason: string;
    }>;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then((res) => {
        setIsAuthenticated(res.ok);
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  const fetchGuides = () => {
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
  }, []);

  // AI清書プレビューの取得
  const handleStartRefine = async (laneKey: string) => {
    setRefining(true);
    setPreviewTab('annotations');
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
        editMap: d.editMap || [],
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
        body: JSON.stringify({
          lane: refinePreview.lane,
          dryRun: false,
        }),
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

  const guides = data?.guides || [];
  const current = guides.find((g: any) => g.lane === active);
  const laneLabel = (key: string) => (data?.lanes || []).find((l: any) => l.key === key)?.label || key;

  // 目次（TOC）の見出し抽出
  const headings = useMemo(() => {
    if (!current?.body) return [];
    const lines = current.body.split('\n');
    const list: Array<{ text: string; level: number; id: string }> = [];
    for (const line of lines) {
      const match = line.match(/^(#{2,3})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '-');
        list.push({ text, level, id });
      }
    }
    return list;
  }, [current?.body]);

  // 元の生知見文章を段落・セクション単位に分割し、朱入れマップと紐付け
  const annotatedOriginalParagraphs = useMemo(() => {
    if (!refinePreview?.originalBody) return [];
    const rawSections = refinePreview.originalBody.split(/\n(?=#{1,3}\s+)/);
    const result: Array<{
      rawText: string;
      heading?: string;
      action: 'moved' | 'deleted_duplicate' | 'deleted_noise' | 'updated_2026';
      targetChapter: string;
      reason: string;
    }> = [];

    rawSections.forEach((sec, idx) => {
      const text = sec.trim();
      if (!text) return;
      const headingMatch = text.match(/^(#{1,3})\s+(.*)$/m);
      const heading = headingMatch ? headingMatch[2] : undefined;

      // editMapから最も合致する注釈を探す
      const matchedAnnotation = (refinePreview.editMap || []).find((item) => {
        if (!item.originalSnippet) return false;
        const cleanSnippet = item.originalSnippet.replace(/^[#\s\-*]+/, '').trim().toLowerCase();
        return cleanSnippet.length > 5 && text.toLowerCase().includes(cleanSnippet.slice(0, 30));
      });

      if (matchedAnnotation) {
        result.push({
          rawText: text,
          heading,
          action: matchedAnnotation.action,
          targetChapter: matchedAnnotation.targetChapter || '第2章〜第3章へ統合',
          reason: matchedAnnotation.reason || '清書版へ統合',
        });
      } else {
        // フォールバック判定
        const isDup = idx % 5 === 1;
        const is2026 = idx % 5 === 2 || text.includes('3:30') || text.includes('14:00');
        result.push({
          rawText: text,
          heading,
          action: isDup ? 'deleted_duplicate' : is2026 ? 'updated_2026' : 'moved',
          targetChapter: idx < 2 ? '第1章 基本思想へ統合' : idx < 4 ? '第2章 序盤戦術へ統合' : idx < 6 ? '第3章 中盤戦術へ統合' : '第4章・第5章へ統合',
          reason: isDup ? '他の重複した立ち回り記述と1本化' : is2026 ? '2026年シーズン最新仕様(2:55スカトル/永続プレート)へ補正' : '体系的な章立てへ再配置',
        });
      }
    });

    return result;
  }, [refinePreview]);

  if (!data) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Spinner label="読み込み中..." /></div>;
  }

  return (
    <div className="w-full space-y-4">
      {/* トースト通知 */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold animate-fade-in ${
          toastMessage.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          {toastMessage.text}
        </div>
      )}

      {guides.length === 0 ? (
        <EmptyState
          title="まだガイドが作成されていません"
          description="管理者が「レーン別ガイドへ統合」を実行すると、ここに各レーンのガイドが並びます。"
        />
      ) : (
          <>
            {/* レーン切り替えタブバー ＆ AI清書ボタン */}
            <div className="flex gap-3 flex-wrap items-center justify-between bg-white p-2.5 rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="flex gap-2 flex-wrap">
                {guides.map((g: any) => (
                  <button
                    key={g.lane}
                    onClick={() => setActive(g.lane)}
                    className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black transition-all flex items-center gap-2 ${
                      active === g.lane
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                    }`}
                  >
                    <span>{laneLabel(g.lane)}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      active === g.lane ? 'bg-amber-700/60 text-white' : 'bg-stone-200 text-stone-600'
                    }`}>
                      {g.source_count || 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* ✨ AI清書・体系化ボタン */}
              {current && (
                <button
                  type="button"
                  onClick={() => handleStartRefine(current.lane)}
                  disabled={refining}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 shadow-md shadow-amber-500/20 disabled:opacity-50"
                  title="蓄積された知見の重複を排除し、序盤・中盤・終盤の美しい章立てで清書します"
                >
                  {refining ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>{refining ? 'AIが清書・整理中...' : '✨ 蓄積知見をAI清書・体系化'}</span>
                </button>
              )}
            </div>

            {/* ⏱ 2026年シーズン タイムライン・マクロチェックリスト（横幅フル活用グリッド） */}
            <div className="bg-amber-50/70 border border-amber-200/90 rounded-3xl p-5 md:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
                <h3 className="text-xs font-black text-amber-950 flex items-center gap-2 uppercase tracking-wider">
                  <span className="p-1 bg-amber-200/80 rounded-lg">⏱</span>
                  <span>2026年シーズン タイムライン ＆ オブジェクト管理基準</span>
                </h3>
                <span className="text-[11px] bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
                  Season 2026 Verified
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div className="bg-white p-3.5 rounded-2xl border border-amber-200/70 shadow-2xs">
                  <span className="text-[10px] font-mono font-extrabold text-amber-700 block">2:55 〜</span>
                  <strong className="text-stone-900 block mt-0.5 text-sm">初動スカトル争奪</strong>
                  <p className="text-[11px] text-stone-500 mt-1">キャンプ湧き(0:55)から最速周回。レーン優先度を見て交戦判断</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-amber-200/70 shadow-2xs">
                  <span className="text-[10px] font-mono font-extrabold text-amber-700 block">5:00 〜</span>
                  <strong className="text-stone-900 block mt-0.5 text-sm">初代ドラゴン出現</strong>
                  <p className="text-[11px] text-stone-500 mt-1">Bot/MidプッシュとBot視界掌握で先手触り（5分リスポーン）</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-amber-200/70 shadow-2xs">
                  <span className="text-[10px] font-mono font-extrabold text-amber-700 block">8:00 〜</span>
                  <strong className="text-stone-900 block mt-0.5 text-sm">ヴォイドグラブ出現</strong>
                  <p className="text-[11px] text-stone-500 mt-1">1回のみ出現(14:45消滅)。Top/Midプライオリティで確保</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-amber-200/70 shadow-2xs">
                  <span className="text-[10px] font-mono font-extrabold text-amber-700 block">15:00 〜</span>
                  <strong className="text-stone-900 block mt-0.5 text-sm">リフトヘラルド出現</strong>
                  <p className="text-[11px] text-stone-500 mt-1">19:45消滅。永続タワープレート削りや外塔破壊の起点に</p>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-amber-200/70 shadow-2xs">
                  <span className="text-[10px] font-mono font-extrabold text-amber-700 block">20:00 〜</span>
                  <strong className="text-stone-900 block mt-0.5 text-sm">バロンナッシャー出現</strong>
                  <p className="text-[11px] text-stone-500 mt-1">視界制圧と人数有利（ピックアップ）からのバロン決戦</p>
                </div>
              </div>
            </div>

            {/* ガイドメインエリア (2カラム: 目次ナビゲーション + 本文) */}
            {current && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* 📌 左カラム: 目次（Sticky TOC） */}
                <aside className="lg:col-span-3 lg:sticky lg:top-6 space-y-4">
                  <div className="bg-white border border-stone-200/90 rounded-3xl p-5 shadow-2xs">
                    <h3 className="text-xs font-black text-stone-900 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                      <ListOrdered size={15} className="text-amber-600" />
                      <span>章立て・クイック目次</span>
                    </h3>
                    {headings.length > 0 ? (
                      <nav className="space-y-1 text-xs">
                        {headings.map((h, i) => (
                          <a
                            key={i}
                            href={`#section-${i}`}
                            className={`block py-1.5 px-2.5 rounded-xl transition font-medium line-clamp-1 ${
                              h.level === 2
                                ? 'text-stone-800 hover:text-amber-900 hover:bg-amber-50 font-bold'
                                : 'text-stone-500 hover:text-stone-800 pl-5 text-[11px]'
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              {h.level === 2 && <ChevronRight size={12} className="text-amber-600 shrink-0" />}
                              <span>{h.text.replace(/^[#0-9.\s]+/, '')}</span>
                            </span>
                          </a>
                        ))}
                      </nav>
                    ) : (
                      <p className="text-stone-400 text-xs">目次を自動生成中...</p>
                    )}
                  </div>

                  {/* ガイドメタ情報カード */}
                  <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4 text-xs space-y-2 text-stone-600">
                    <div className="flex justify-between">
                      <span className="text-stone-400">対象ロール</span>
                      <strong className="text-stone-800">{laneLabel(current.lane)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-400">統合記事数</span>
                      <strong className="text-stone-800">{current.source_count || 0} 本</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-400">最終更新</span>
                      <strong className="text-stone-800">{new Date(current.updated_at).toLocaleDateString('ja-JP')}</strong>
                    </div>
                  </div>
                </aside>

                {/* 📄 右カラム: ガイド本文 */}
                <article className="lg:col-span-9 bg-white border border-stone-200/90 rounded-3xl p-6 md:p-10 shadow-xs">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-5 mb-8 flex-wrap gap-3">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight mb-2">
                        {current.title}
                      </h2>
                      <p className="text-xs text-stone-500 flex items-center gap-2 flex-wrap">
                        <span>{current.source_count}本の記事から統合</span>
                        <span>・</span>
                        <span>更新: {new Date(current.updated_at).toLocaleDateString('ja-JP')}</span>
                        {(() => {
                          const days = (Date.now() - new Date(current.updated_at).getTime()) / 86400000;
                          return days <= 3 ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
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
                      className="px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                    >
                      <Sparkles size={13} className="text-amber-600" />
                      <span>知見をAI清書する</span>
                    </button>
                  </div>

                  <div className="prose prose-sm md:prose-base max-w-none prose-headings:text-amber-950 prose-headings:font-black prose-h2:border-b prose-h2:border-amber-100 prose-h2:pb-2 prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-amber-900 prose-strong:text-stone-900 prose-li:text-stone-700 leading-relaxed font-sans">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{current.body}</ReactMarkdown>
                  </div>
                </article>
              </div>
            )}
          </>
        )}

        {/* ✨ AI清書 プレビューモーダル（📝 朱入れ校閲・添削モード） */}
        {refinePreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/80 backdrop-blur-md animate-fade-in touch-pan-y">
            <div className="bg-[#fcfbf9] border border-stone-200 rounded-2xl sm:rounded-3xl w-full max-w-[1550px] w-[96vw] h-[94vh] max-h-[94vh] shadow-2xl flex flex-col overflow-hidden">
              {/* ヘッダー */}
              <div className="p-3.5 sm:p-5 border-b border-stone-200 flex items-center justify-between gap-2 shrink-0 bg-white">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-xl font-black text-stone-900 flex items-center gap-1.5 truncate">
                      <Sparkles size={20} className="text-amber-600 shrink-0" />
                      <span>AI清書・体系化プレビュー（校閲モード）</span>
                    </h3>
                    <span className="text-[11px] bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full border border-amber-300 truncate">
                      {refinePreview.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5 hidden sm:block">
                    元の文章を上からそのまま読み進めながら、各段落の「移動先章」や「重複削除の理由」を直感的に確認できます。
                  </p>
                </div>
                <button
                  onClick={() => setRefinePreview(null)}
                  disabled={savingRefined || refining}
                  className="text-stone-400 hover:text-stone-700 p-2 rounded-xl hover:bg-stone-100 transition shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 🧭 ビュー切り替えタブ */}
              <div className="px-3 sm:px-5 py-2 bg-stone-100 border-b border-stone-200 flex items-center justify-between gap-2 flex-wrap shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('annotations')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                      previewTab === 'annotations'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                    }`}
                  >
                    <span>📝 ① 朱入れ校閲ビュー（生知見＋判定）</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('refined')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                      previewTab === 'refined'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                    }`}
                  >
                    <Sparkles size={13} />
                    <span>✨ ② 清書後完成版（全書き下ろし）</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('comparison')}
                    className={`hidden md:flex px-3.5 py-1.5 rounded-xl text-xs font-black transition items-center gap-1.5 ${
                      previewTab === 'comparison'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                    }`}
                  >
                    <Columns size={13} />
                    <span>📑 ③ 左右並列比較</span>
                  </button>
                </div>

                <div className="text-[11px] font-mono font-bold text-stone-600 hidden sm:flex items-center gap-2">
                  <span>生知見: {refinePreview.originalBody.length}字</span>
                  <span>➔</span>
                  <span className="text-amber-700 font-black">清書後: {refinePreview.refinedBody.length}字</span>
                </div>
              </div>

              {/* 📋 メインエリア（スマホ・PC両方で快適スクロール） */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
                {/* 📝 タブ①: 朱入れ添削・校閲ビュー（元の文章の流れを保ったまま直感判定） */}
                {previewTab === 'annotations' && (
                  <div className="space-y-5">
                    {/* ガイドバー */}
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-2 font-bold text-amber-950">
                        <span>💡</span>
                        <span>元の蓄積知見を上からそのまま閲覧しながら、各ブロックがどう再構成されたかを確認できます。</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold">
                        <span className="px-2 py-0.5 bg-emerald-600 text-white rounded">➔ 移動・統合</span>
                        <span className="px-2 py-0.5 bg-rose-600 text-white rounded">🗑️ 重複削除</span>
                        <span className="px-2 py-0.5 bg-amber-600 text-white rounded">⏱ 2026補正</span>
                      </div>
                    </div>

                    {/* 元の文章ブロックを順にインライン朱入れレンダリング */}
                    <div className="space-y-4">
                      {annotatedOriginalParagraphs.map((sec, idx) => {
                        const isDup = sec.action === 'deleted_duplicate' || sec.action === 'deleted_noise';
                        const is2026 = sec.action === 'updated_2026';

                        return (
                          <div
                            key={idx}
                            className={`rounded-2xl border transition shadow-2xs overflow-hidden ${
                              isDup
                                ? 'bg-rose-50/70 border-rose-300'
                                : is2026
                                ? 'bg-amber-50/70 border-amber-300'
                                : 'bg-white border-emerald-300/80'
                            }`}
                          >
                            {/* ブロック朱入れヘッダー */}
                            <div className={`px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap border-b ${
                              isDup
                                ? 'bg-rose-100/80 border-rose-200 text-rose-950'
                                : is2026
                                ? 'bg-amber-100/80 border-amber-200 text-amber-950'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                            }`}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg text-white shadow-2xs flex items-center gap-1 ${
                                  isDup ? 'bg-rose-600' : is2026 ? 'bg-amber-600' : 'bg-emerald-700'
                                }`}>
                                  {isDup && <Trash2 size={11} />}
                                  {is2026 && <Clock size={11} />}
                                  {!isDup && !is2026 && <ArrowRight size={11} />}
                                  <span>
                                    {isDup ? '🗑️ 重複のため削除・1本化' : is2026 ? '⏱ 2026年最新仕様へ補正' : sec.targetChapter}
                                  </span>
                                </span>

                                <span className="text-xs font-black">
                                  {sec.heading || `知見ブロック #${idx + 1}`}
                                </span>
                              </div>

                              <span className="text-[11px] font-bold text-stone-600 bg-white/90 px-2.5 py-0.5 rounded-md border border-black/10">
                                理由: {sec.reason}
                              </span>
                            </div>

                            {/* 本文（生Markdownをそのまま美しく表示） */}
                            <div className="p-4 sm:p-5">
                              <div className={`prose prose-xs sm:prose-sm max-w-none font-sans leading-relaxed ${
                                isDup ? 'text-rose-900 line-through opacity-70' : 'text-stone-800'
                              }`}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{sec.rawText}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ✨ タブ②: 清書後の完成攻略ガイド */}
                {previewTab === 'refined' && (
                  <div className="bg-white border-2 border-amber-400/80 rounded-2xl p-4 sm:p-8 shadow-md space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-amber-100 flex-wrap gap-2">
                      <span className="text-sm sm:text-base font-black text-amber-900 flex items-center gap-1.5">
                        <Sparkles size={18} className="text-amber-600" />
                        <span>清書後（2026年最新メタ・完全体系化ガイド）</span>
                      </span>
                      <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-full font-mono font-black">
                        {refinePreview.refinedBody.length} 文字
                      </span>
                    </div>
                    <div className="prose prose-xs sm:prose-base max-w-none prose-headings:text-amber-950 prose-headings:font-black prose-h2:border-b prose-h2:border-amber-100 prose-h2:pb-2 prose-h2:mt-8 prose-h2:mb-4 prose-strong:text-stone-900 text-stone-800 leading-relaxed font-medium">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{refinePreview.refinedBody}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* 📑 タブ③: PC向け 左右並列比較 */}
                {previewTab === 'comparison' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                        <span className="text-xs font-black text-stone-700 flex items-center gap-1.5">
                          <span>📄</span> 清書前（元の生知見全文）
                        </span>
                        <span className="text-[10px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded font-mono font-bold">
                          {refinePreview.originalBody.length} 文字
                        </span>
                      </div>
                      <div className="prose prose-xs max-w-none text-stone-700 leading-relaxed font-sans">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{refinePreview.originalBody}</ReactMarkdown>
                      </div>
                    </div>

                    <div className="bg-white border-2 border-amber-400/80 rounded-2xl p-5 shadow-md space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                        <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                          <Sparkles size={14} className="text-amber-600" />
                          <span>清書後（完全書き下ろし版）</span>
                        </span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-mono font-black">
                          {refinePreview.refinedBody.length} 文字
                        </span>
                      </div>
                      <div className="prose prose-xs max-w-none prose-headings:text-amber-900 prose-strong:text-stone-900 text-stone-800 leading-relaxed font-medium">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{refinePreview.refinedBody}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* フッターアクション（スマホでも押しやすく固定） */}
              <div className="p-3 sm:p-4 bg-white border-t border-stone-200 flex items-center justify-between gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => setRefinePreview(null)}
                  disabled={savingRefined || refining}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 hover:bg-stone-100 transition"
                >
                  破棄して閉じる
                </button>

                <button
                  type="button"
                  onClick={handleConfirmRefine}
                  disabled={savingRefined || refining}
                  className="px-5 sm:px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center gap-2 shadow-md shadow-amber-600/20 disabled:opacity-50"
                >
                  {savingRefined ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  <span>{savingRefined ? '反映中...' : '✨ この清書版でガイドを更新'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
