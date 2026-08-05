"use client";

import { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Edit3, Save, X, RefreshCw, CheckCircle, AlertTriangle, BookOpen, ChevronRight, FileText } from 'lucide-react';

interface DesignDoc {
  title: string;
  content: string;
  filename: string;
}

export default function DesignEditor() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<Record<string, DesignDoc>>({});
  // 内部システム設計書は管理者専用(#③)。保存側APIは既に守られているが、GETに認証チェックが
  // 無くUIも誰にでも編集画面を見せていたため、champions/pageと同じ認証ガードを追加する
  // (2026-08-05発覚)。
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then((res) => res.json())
      .then((data) => setIsAuthenticated(!!data.valid))
      .catch(() => setIsAuthenticated(false));
  }, []);
  const [isEditing, setIsEditing] = useState(false);
  const [activeKey, setActiveKey] = useState<string>('overview');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | '', text: string }>({ type: '', text: '' });
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 選択中の設計書
  const activeDoc = useMemo(() => {
    return docs[activeKey] || docs['overview'] || { title: '未設定', content: '', filename: '' };
  }, [docs, activeKey]);

  // 編集中の内容を保持するテンポラリバッファ
  const [editTitle, setEditTitle] = useState(activeDoc.title);
  const [editContent, setEditContent] = useState(activeDoc.content);

  // マウント時に API から設計書データをフェッチして初期化
  useEffect(() => {
    if (isAuthenticated !== true) return;
    const loadDocs = async () => {
      try {
        const res = await fetch('/api/design', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.docs && Object.keys(data.docs).length > 0) {
            setDocs(data.docs);
          } else {
            setErrorMsg('APIレスポンスの docs が空オブジェクトです。');
          }
        } else {
          setErrorMsg(`APIフェッチ失敗 (Status: ${res.status} ${res.statusText})`);
        }
      } catch (err: any) {
        console.error('Failed to fetch design docs:', err);
        setErrorMsg(`クライアント側例外: ${err.message || err}`);
      } finally {
        setLoading(false);
        setMounted(true);
      }
    };
    loadDocs();
  }, [isAuthenticated]);

  // 選択ドキュメントが変化した際にエディタバッファを自動同期
  useEffect(() => {
    if (!mounted) return;
    setEditTitle(activeDoc.title);
    setEditContent(activeDoc.content);
  }, [activeDoc, mounted]);

  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] bg-white/60 backdrop-blur-md rounded-3xl border border-black/10 p-12 max-w-7xl mx-auto shadow-2xl">
        <RefreshCw className="w-8 h-8 animate-spin text-[#c89b3c] mb-4" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] bg-white/60 backdrop-blur-md rounded-3xl border border-black/10 p-12 max-w-7xl mx-auto shadow-2xl text-center max-w-sm">
        <div className="text-4xl mb-4">🔑</div>
        <h2 className="text-lg font-bold mb-2 text-stone-900">認証が必要です</h2>
        <p className="text-sm text-stone-500 mb-6 leading-relaxed">システム設計書は管理者専用です。管理者パスコードでログインしてから再度アクセスしてください。</p>
        <a href="/login" className="inline-block w-full rounded-xl bg-[#c89b3c] px-5 py-3 text-sm font-semibold text-black transition hover:bg-yellow-400">ログインページへ</a>
      </div>
    );
  }

  if (!mounted || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] bg-white/60 backdrop-blur-md rounded-3xl border border-black/10 p-12 max-w-7xl mx-auto shadow-2xl">
        <RefreshCw className="w-8 h-8 animate-spin text-[#c89b3c] mb-4" />
        <span className="text-xs text-gray-500 font-bold">設計書モジュールをロード中...</span>
      </div>
    );
  }

  const handleStartEdit = () => {
    setEditTitle(activeDoc.title);
    setEditContent(activeDoc.content);
    setIsEditing(true);
    setStatus({ type: '', text: '' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus({ type: '', text: '' });
    try {
      const res = await fetch('/api/admin/design', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: activeKey,
          filename: activeDoc.filename,
          title: editTitle,
          content: editContent 
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存に失敗しました。');

      // ローカル状態を更新
      setDocs(prev => ({
        ...prev,
        [activeKey]: {
          ...prev[activeKey],
          title: editTitle,
          content: editContent
        }
      }));
      setIsEditing(false);
      setStatus({ 
        type: 'success', 
        text: `✅ 「${activeDoc.title}」を保存しました！バックグラウンドで自動デプロイが開始されました。` 
      });
    } catch (err: any) {
      setStatus({ type: 'error', text: `❌ エラー: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* 操作ヘッダーパネル */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/70 backdrop-blur-md border border-black/10 rounded-2xl p-4 md:px-8 shadow-xl gap-4">
        <div>
          <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-[#c89b3c] to-yellow-700 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#c89b3c]" />
            <span>SOVEREIGN SYSTEM DESIGN</span>
          </h2>
          <p className="text-xs text-gray-500">
            {isEditing ? `「${activeDoc.title}」を編集中です。変更後は自動デプロイされます。` : "各機能ごとの個別詳細設計書プレビュー"}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!isEditing ? (
            <button
              onClick={handleStartEdit}
              className="flex items-center justify-center gap-2 bg-[#c89b3c]/10 border border-[#c89b3c] hover:bg-[#c89b3c] hover:text-black text-[#c89b3c] px-4 py-2 rounded-xl font-bold text-xs transition-all duration-300 cursor-pointer w-full sm:w-auto"
            >
              <Edit3 size={16} />
              この機能の設計書を編集する
            </button>
          ) : (
            <>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer w-full sm:w-auto"
              >
                <X size={16} />
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white px-5 py-2 rounded-xl font-bold text-xs transition shadow-lg shadow-indigo-500/20 cursor-pointer w-full sm:w-auto"
              >
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "保存中..." : "保存して本番適用"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ステータスバナー */}
      {status.text && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 border animate-fade-in ${
          status.type === 'error'
            ? 'bg-red-100 text-red-700 border-red-200'
            : 'bg-green-100 text-green-700 border-green-200'
        }`}>
          {status.type === 'error' ? <AlertTriangle className="flex-shrink-0" size={20} /> : <CheckCircle className="flex-shrink-0" size={20} />}
          <p className="text-xs font-bold whitespace-pre-wrap">{status.text}</p>
        </div>
      )}

      {/* メインレイアウト */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        
        {/* 機能別目次サイドメニュー (左側) */}
        {!isEditing && (
          <aside className="w-full md:w-72 shrink-0 bg-white/60 backdrop-blur-md rounded-3xl border border-black/10 p-4 space-y-1.5 shadow-xl">
            <div className="px-3 py-2 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-black/5 mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-gray-500" />
              <span>機能別設計書一覧</span>
            </div>
            <div className="space-y-1 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
              {Object.entries(docs).map(([key, sec]) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveKey(key);
                    setStatus({ type: '', text: '' });
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group ${
                    activeKey === key
                      ? 'bg-[#c89b3c]/15 border border-[#c89b3c]/30 text-yellow-800'
                      : 'border border-transparent text-gray-500 hover:text-stone-900 hover:bg-black/[0.03]'
                  }`}
                >
                  <span className="truncate pr-2">{sec.title}</span>
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                    activeKey === key ? 'text-yellow-800 translate-x-0.5' : 'text-gray-500 group-hover:text-gray-700'
                  }`} />
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* コンテンツ描画エリア (右側) */}
        <div className="flex-1 w-full bg-white/60 backdrop-blur-md rounded-3xl border border-black/10 p-6 md:p-12 shadow-2xl overflow-x-hidden">
          {Object.keys(docs).length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <AlertTriangle className="w-12 h-12 text-[#c89b3c] mx-auto animate-bounce" />
              <h3 className="text-sm font-black text-yellow-200">設計書ファイルが読み込めませんでした</h3>
              <p className="text-xs text-red-400 font-mono bg-red-950/20 py-2.5 px-4 rounded-xl border border-red-900/30 max-w-lg mx-auto leading-relaxed">
                {errorMsg || '詳細なエラー情報はありません。'}
              </p>
              <p className="text-[10px] text-gray-500 max-w-md mx-auto leading-relaxed">
                サーバー上の public/design_docs フォルダ内の配置、または API (/api/design) の応答状態を確認してください。
              </p>
            </div>
          ) : !isEditing ? (
            // プレビュー表示モード
            <div className="prose prose-invert prose-purple max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold to-primary mb-8 pb-4 border-b border-black/10 mt-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl font-bold text-amber-800 mt-8 mb-4 pb-2 border-b border-black/10 flex items-center gap-2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-lg font-bold text-[#00cfef] mt-6 mb-3" {...props} />,
                  p: ({node, ...props}) => <p className="text-stone-700 leading-relaxed mb-4 text-xs md:text-sm" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc list-inside pl-4 mb-4 text-stone-700 space-y-1.5 text-xs md:text-sm" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal list-inside pl-4 mb-4 text-stone-700 space-y-1.5 text-xs md:text-sm" {...props} />,
                  li: ({node, ...props}) => <li className="mb-1 text-stone-700" {...props} />,
                  a: ({node, ...props}) => <a className="text-[#00cfef] hover:underline font-bold" target="_blank" rel="noopener noreferrer" {...props} />,
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#c89b3c] bg-[#c89b3c]/5 pl-4 py-2 my-4 rounded-r-xl italic text-stone-600" {...props} />,
                  code: ({node, className, children, ...props}) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const inline = !match;
                    return inline ? (
                      <code className="bg-black/5 px-1.5 py-0.5 rounded text-gold font-mono text-xs" {...props}>{children}</code>
                    ) : (
                      <pre className="bg-stone-50 border border-black/10 rounded-2xl p-4 overflow-x-auto my-4 font-mono text-xs text-stone-700 leading-relaxed shadow-inner"><code className={className} {...props}>{children}</code></pre>
                    );
                  },
                  table: ({node, ...props}) => <div className="overflow-x-auto my-4 rounded-2xl border border-black/10 bg-black/2"><table className="w-full text-left border-collapse" {...props} /></div>,
                  thead: ({node, ...props}) => <thead className="bg-black/5 border-b border-black/10 text-gold font-bold text-[10px] uppercase tracking-wider" {...props} />,
                  tbody: ({node, ...props}) => <tbody className="divide-y divide-black/5" {...props} />,
                  tr: ({node, ...props}) => <tr className="hover:bg-black/5 transition-colors" {...props} />,
                  th: ({node, ...props}) => <th className="px-4 py-3 font-black text-xs" {...props} />,
                  td: ({node, ...props}) => <td className="px-4 py-3 text-xs text-stone-700" {...props} />,
                }}
              >
                {activeDoc.content}
              </ReactMarkdown>
            </div>
          ) : (
            // 編集エディタモード
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-black/10">
                <span className="text-xs font-bold text-stone-500 flex items-center gap-1.5">
                  <Edit3 size={14} /> Markdown エディタ: {activeDoc.title}
                </span>
                <span className="text-[10px] bg-black/5 px-2 py-0.5 rounded-full border border-black/10 text-stone-500 font-mono">
                  {editContent.length} 文字
                </span>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gold font-bold">タイトル設定</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full bg-white border border-black/10 rounded-xl p-3 text-sm text-stone-900 focus:outline-none focus:border-[#c89b3c] transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gold font-bold">本文 (Markdown)</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  disabled={saving}
                  className="w-full min-h-[60vh] bg-stone-50 border border-black/10 rounded-2xl p-6 font-mono text-sm text-stone-800 leading-relaxed focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner resize-y"
                  placeholder="# 設計書をここに入力..."
                />
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
