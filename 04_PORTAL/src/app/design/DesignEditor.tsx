"use client";

import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Edit3, Save, X, RefreshCw, CheckCircle, AlertTriangle, BookOpen, ChevronRight, FileText } from 'lucide-react';
import { DesignDoc } from './systemDesignMarkdown';

export default function DesignEditor({ initialDocs }: { initialDocs: Record<string, DesignDoc> }) {
  const [docs, setDocs] = useState<Record<string, DesignDoc>>(initialDocs);
  const [isEditing, setIsEditing] = useState(false);
  const [activeKey, setActiveKey] = useState<string>('overview');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | '', text: string }>({ type: '', text: '' });

  // 選択中の設計書
  const activeDoc = useMemo(() => {
    return docs[activeKey] || docs['overview'] || { title: '未設定', content: '', filename: '' };
  }, [docs, activeKey]);

  // 編集中の内容を保持するテンポラリバッファ
  const [editTitle, setEditTitle] = useState(activeDoc.title);
  const [editContent, setEditContent] = useState(activeDoc.content);

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
        method: 'POST',
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#0f111a]/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:px-8 shadow-xl gap-4">
        <div>
          <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-[#c89b3c] to-yellow-200 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#c89b3c]" />
            <span>SOVEREIGN SYSTEM DESIGN</span>
          </h2>
          <p className="text-xs text-gray-400">
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
                className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer w-full sm:w-auto"
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
            ? 'bg-red-900/20 text-red-400 border-red-800/50' 
            : 'bg-green-900/20 text-green-400 border-green-800/50'
        }`}>
          {status.type === 'error' ? <AlertTriangle className="flex-shrink-0" size={20} /> : <CheckCircle className="flex-shrink-0" size={20} />}
          <p className="text-xs font-bold whitespace-pre-wrap">{status.text}</p>
        </div>
      )}

      {/* メインレイアウト */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        
        {/* 機能別目次サイドメニュー (左側) */}
        {!isEditing && (
          <aside className="w-full md:w-72 shrink-0 bg-[#0f111a]/40 backdrop-blur-md rounded-3xl border border-white/10 p-4 space-y-1.5 shadow-xl">
            <div className="px-3 py-2 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 mb-2 flex items-center gap-1.5">
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
                      ? 'bg-[#c89b3c]/15 border border-[#c89b3c]/30 text-yellow-200'
                      : 'border border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="truncate pr-2">{sec.title}</span>
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                    activeKey === key ? 'text-yellow-200 translate-x-0.5' : 'text-gray-600 group-hover:text-gray-300'
                  }`} />
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* コンテンツ描画エリア (右側) */}
        <div className="flex-1 w-full bg-[#0f111a]/40 backdrop-blur-md rounded-3xl border border-white/10 p-6 md:p-12 shadow-2xl overflow-x-hidden">
          {!isEditing ? (
            // プレビュー表示モード
            <div className="prose prose-invert prose-purple max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#c89b3c] to-yellow-200 mb-8 pb-4 border-b border-white/10 mt-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl font-bold text-yellow-100 mt-8 mb-4 pb-2 border-b border-white/5 flex items-center gap-2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-lg font-bold text-[#00cfef] mt-6 mb-3" {...props} />,
                  p: ({node, ...props}) => <p className="text-gray-300 leading-relaxed mb-4 text-xs md:text-sm" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc list-inside pl-4 mb-4 text-gray-300 space-y-1.5 text-xs md:text-sm" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal list-inside pl-4 mb-4 text-gray-300 space-y-1.5 text-xs md:text-sm" {...props} />,
                  li: ({node, ...props}) => <li className="mb-1 text-gray-300" {...props} />,
                  a: ({node, ...props}) => <a className="text-[#00cfef] hover:underline font-bold" target="_blank" rel="noopener noreferrer" {...props} />,
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#c89b3c] bg-[#c89b3c]/5 pl-4 py-2 my-4 rounded-r-xl italic text-gray-400" {...props} />,
                  code: ({node, className, children, ...props}) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const inline = !match;
                    return inline ? (
                      <code className="bg-white/10 px-1.5 py-0.5 rounded text-[#c89b3c] font-mono text-xs" {...props}>{children}</code>
                    ) : (
                      <pre className="bg-[#0b0c13] border border-white/10 rounded-2xl p-4 overflow-x-auto my-4 font-mono text-xs text-gray-300 leading-relaxed shadow-inner"><code className={className} {...props}>{children}</code></pre>
                    );
                  },
                  table: ({node, ...props}) => <div className="overflow-x-auto my-4 rounded-2xl border border-white/10 bg-[#08090f]/60"><table className="w-full text-left border-collapse" {...props} /></div>,
                  thead: ({node, ...props}) => <thead className="bg-white/5 border-b border-white/10 text-[#c89b3c] font-bold text-[10px] uppercase tracking-wider" {...props} />,
                  tbody: ({node, ...props}) => <tbody className="divide-y divide-white/5" {...props} />,
                  tr: ({node, ...props}) => <tr className="hover:bg-white/5 transition-colors" {...props} />,
                  th: ({node, ...props}) => <th className="px-4 py-3 font-black text-xs" {...props} />,
                  td: ({node, ...props}) => <td className="px-4 py-3 text-xs text-gray-300" {...props} />,
                }}
              >
                {activeDoc.content}
              </ReactMarkdown>
            </div>
          ) : (
            // 編集エディタモード
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                  <Edit3 size={14} /> Markdown エディタ: {activeDoc.title}
                </span>
                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full border border-white/10 text-gray-500 font-mono">
                  {editContent.length} 文字
                </span>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-[#c89b3c] font-bold">タイトル設定</label>
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={e => setEditTitle(e.target.value)} 
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#c89b3c] transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-[#c89b3c] font-bold">本文 (Markdown)</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  disabled={saving}
                  className="w-full min-h-[60vh] bg-[#07080d] border border-white/10 rounded-2xl p-6 font-mono text-sm text-gray-300 leading-relaxed focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner resize-y"
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
