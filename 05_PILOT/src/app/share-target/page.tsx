'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Share2, CheckCircle2, AlertCircle, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

function ShareTargetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('共有データを受信中...');
  const [manualUrl, setManualUrl] = useState<string>('');
  const [detectedTitle, setDetectedTitle] = useState<string>('');
  // PCのブックマークレットから小窓で開かれた場合。登録後に自動で閉じて元の動画画面に戻す
  const isPopup = searchParams?.get('popup') === '1';

  useEffect(() => {
    if (!searchParams) return;

    // プレイリストのまとめて登録（ブックマークレットが ids=動画ID,動画ID,... を渡す）
    const rawIds = searchParams.get('ids') || '';
    if (rawIds) {
      handleBulkSubmit(rawIds.split(',').filter(Boolean), searchParams.get('title') || '');
      return;
    }

    const rawTitle = searchParams.get('title') || '';
    const rawText = searchParams.get('text') || '';
    const rawUrl = searchParams.get('url') || '';

    // text または url から最初の http(s) URL を抽出
    const combined = `${rawUrl} ${rawText}`.trim();
    const urlMatch = combined.match(/https?:\/\/[^\s]+/i);
    const targetUrl = urlMatch ? urlMatch[0] : '';

    if (targetUrl) {
      setDetectedTitle(rawTitle);
      handleAutoSubmit(targetUrl, rawTitle);
    } else {
      setStatus('idle');
      setMessage('URLが見つかりませんでした。URLを直接入力してください。');
    }
  }, [searchParams]);

  const handleAutoSubmit = async (url: string, title?: string) => {
    setStatus('processing');
    setMessage('🚀 戦術解析キューへ登録中...');

    try {
      const res = await fetch('/api/youtube/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('success');
        setMessage(data.message || '✅ 解析キューに追加しました！バックグラウンドで自動解析を開始します。');

        if (isPopup) {
          setTimeout(() => window.close(), 1500);
        } else {
          // 2秒後に自動でライブラリへ遷移
          setTimeout(() => {
            router.push('/library');
          }, 2200);
        }
      } else {
        setStatus('error');
        setMessage(data.error || 'キューへの登録に失敗しました');
        setManualUrl(url);
      }
    } catch (e: any) {
      setStatus('error');
      setMessage(e.message || '通信エラーが発生しました');
      setManualUrl(url);
    }
  };

  const handleBulkSubmit = async (videoIds: string[], playlistTitle: string) => {
    setStatus('processing');
    setMessage(`🚀 プレイリストの${videoIds.length}本を登録中...`);
    try {
      const res = await fetch('/api/youtube/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds, source: playlistTitle }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'まとめて登録に失敗しました');
      setStatus('success');
      setMessage(data.message);
      // 件数を確認できるよう、単体登録より少し長く表示してから閉じる
      if (isPopup) setTimeout(() => window.close(), 3000);
    } catch (e: any) {
      setStatus('error');
      setMessage(e.message || '通信エラーが発生しました');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl.trim()) return;
    handleAutoSubmit(manualUrl.trim(), detectedTitle);
  };

  return (
    <div className="min-h-screen bg-[#0d0d10] text-[#f1f5f9] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#16161c] border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* 背景の装飾光 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* ヘッダーアイコン */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Share2 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wide text-white uppercase">
              戦術インポート・クイック投函
            </h1>
            <p className="text-[11px] text-slate-400">YouTube動画を解析キューへ登録</p>
          </div>
        </div>

        {/* 状態に応じたメイン表示 */}
        <div className="space-y-4">
          {status === 'processing' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-xs font-bold text-slate-300">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-6 space-y-3 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-emerald-300 leading-relaxed px-2">
                {message}
              </p>
              <p className="text-[10px] text-slate-500">{isPopup ? 'この画面は自動で閉じます...' : '間もなくライブラリへ自動移動します...'}</p>
              <Link
                href="/library"
                className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-bold"
              >
                今すぐライブラリを開く <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {(status === 'error' || status === 'idle') && (
            <div className="space-y-4">
              {status === 'error' && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-200">{message}</p>
                </div>
              )}

              <form onSubmit={handleManualSubmit} className="space-y-3">
                <label className="block text-[11px] font-bold text-slate-300">
                  YouTube動画のURL
                </label>
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-[#101014] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                />
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-indigo-600/20"
                >
                  <Sparkles className="w-3.5 h-3.5" /> 解析キューに登録する
                </button>
              </form>

              <div className="pt-2 text-center">
                <Link href="/" className="text-xs text-slate-400 hover:text-white transition-colors">
                  ← コックピットトップへ戻る
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShareTargetPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center text-slate-400 text-xs">
        受信準備中...
      </div>
    }>
      <ShareTargetContent />
    </Suspense>
  );
}
