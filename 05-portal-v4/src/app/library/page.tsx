"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Book, ChevronLeft, ChevronDown, ChevronUp, Clock, User, Sparkles, Pencil, Save, X, Trash2, Search, Terminal, Copy, Activity } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';

export default function LibraryPage() {
  const [articles, setArticles] = useState<any[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [groupMode, setGroupMode] = useState<'champion' | 'keyword'>('champion');
  const [sortOrder, setSortOrder] = useState('updated_desc');

  useEffect(() => { fetchArticles(); }, []);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('bible_articles').select('*').order('created_at', { ascending: false });
      if (!error && data) setArticles(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = articles.filter(a =>
      a.title.toLowerCase().includes(q) || 
      a.champion?.toLowerCase().includes(q) ||
      (a.keywords && a.keywords.some((k: string) => k.toLowerCase().includes(q)))
    );

    const groups: Record<string, any[]> = {};
    if (groupMode === 'champion') {
      filtered.forEach(a => { const key = a.champion || 'その他'; if (!groups[key]) groups[key] = []; groups[key].push(a); });
    } else {
      filtered.forEach(a => {
        const keys = (a.keywords && a.keywords.length > 0) ? a.keywords : ['未分類'];
        keys.forEach((k: string) => { if (!groups[k]) groups[k] = []; groups[k].push(a); });
      });
    }
    
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        if (sortOrder === 'updated_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortOrder === 'updated_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return a.title.localeCompare(b.title);
      });
    });

    return Object.entries(groups).sort((a, b) => {
      if (sortOrder === 'updated_desc') return Math.max(...b[1].map(x => new Date(x.created_at).getTime())) - Math.max(...a[1].map(x => new Date(x.created_at).getTime()));
      if (sortOrder === 'updated_asc') return Math.min(...a[1].map(x => new Date(x.created_at).getTime())) - Math.min(...b[1].map(x => new Date(x.created_at).getTime()));
      return a[0].localeCompare(b[0]);
    });
  }, [articles, search, groupMode, sortOrder]);

  const toggleGroup = (key: string) => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const startEditing = () => { setEditContent(selectedArticle.content); setEditing(true); };
  const cancelEditing = () => { setEditing(false); setEditContent(''); };

  const saveArticle = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from('bible_articles').update({ content: editContent, created_at: now }).eq('id', selectedArticle.id);
    if (!error) {
      const updated = { ...selectedArticle, content: editContent, created_at: now };
      setSelectedArticle(updated);
      setArticles(prev => prev.map(a => a.id === selectedArticle.id ? updated : a));
      setEditing(false);
    } else { alert('保存失敗: ' + error.message); }
    setSaving(false);
  };

  const deleteArticle = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('この記事を削除しますか？')) return;
    const { error } = await supabase.from('bible_articles').delete().eq('id', id);
    if (!error) {
      setArticles(prev => prev.filter(a => a.id !== id));
      if (selectedArticle?.id === id) setSelectedArticle(null);
    }
  };

  const copyPublishCommand = (championName: string) => {
    const cmd = `py d:\\my_work\\02_ENGINE\\TOOLS\\publish_local_article.py "${championName}"`;
    navigator.clipboard.writeText(cmd);
    alert('コマンドをコピーしました！ターミナルに貼り付けて実行してください。\n' + cmd);
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  if (selectedArticle) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 md:p-12 max-w-5xl mx-auto flex flex-col gap-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <button onClick={() => { setSelectedArticle(null); setEditing(false); }} className="flex items-center gap-2 text-[#a78bfa] font-bold hover:text-white transition-colors">
            <ChevronLeft size={18} /> 一覧へ戻る
          </button>
          <div className="flex gap-2 flex-wrap">
            {!editing ? (
              <button onClick={startEditing} className="px-4 py-2 glass-panel glass-panel-hover text-[#a78bfa] rounded-xl text-sm font-bold flex items-center gap-2"><Pencil size={14} /> 編集する</button>
            ) : (
              <>
                <button onClick={cancelEditing} className="px-4 py-2 glass-panel text-gray-400 hover:text-white rounded-xl text-sm font-bold flex items-center gap-2"><X size={14} /> キャンセル</button>
                <button onClick={saveArticle} disabled={saving} className="px-4 py-2 bg-white text-black hover:-translate-y-0.5 shadow-lg shadow-white/20 rounded-xl text-sm font-black flex items-center gap-2 transition-all"><Save size={14} /> {saving ? '保存中...' : '保存する'}</button>
              </>
            )}
            <button onClick={() => copyPublishCommand(selectedArticle.champion || selectedArticle.title.split(' ')[0])} className="px-4 py-2 glass-panel glass-panel-hover text-[#00cfef] rounded-xl text-sm font-bold flex items-center gap-2"><Terminal size={14} /> 投稿コマンドをコピー</button>
            <button onClick={(e) => deleteArticle(selectedArticle.id, e)} className="px-4 py-2 glass-panel glass-panel-hover text-red-400 rounded-xl text-sm font-bold flex items-center gap-2"><Trash2 size={14} /> 削除</button>
          </div>
        </div>

        <div className="glass-panel rounded-3xl overflow-hidden relative group">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#a78bfa]/10 rounded-full blur-3xl"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#a78bfa] to-[#c89b3c]"></div>
          <div className="p-10 relative z-10">
            <header className="mb-10 pb-8 border-b border-white/10">
              <div className="flex items-center gap-2 text-[#a78bfa] font-mono text-xs mb-4 tracking-[0.15em] uppercase font-black"><Sparkles size={14} /> 攻略記事</div>
              <h1 className="text-4xl md:text-5xl font-black leading-tight font-mono mb-6 text-white">{selectedArticle.title.replace(/_/g, ' ')}</h1>
              <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full font-bold uppercase tracking-widest border border-white/5"><User size={14} className="text-[#a78bfa]" /> AI AGENT</span>
                <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full font-bold uppercase tracking-widest border border-white/5"><Clock size={14} className="text-[#a78bfa]" /> {new Date(selectedArticle.created_at).toLocaleString('ja-JP')}</span>
              </div>
            </header>

            {editing ? (
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full min-h-[600px] p-6 bg-black/50 border border-[#a78bfa]/30 rounded-2xl text-sm leading-loose font-mono outline-none focus:border-[#a78bfa]/60 shadow-inner text-gray-200 transition-colors" />
            ) : (
              <div className="prose prose-invert prose-purple max-w-none text-[15px] leading-loose text-gray-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedArticle.content}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto flex flex-col gap-8">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 flex items-center gap-4">
          <Book className="text-[#a78bfa]" size={36} /> <span className="text-gradient text-gradient-purple">攻略ライブラリ</span>
        </h1>
        <p className="text-[#a78bfa] font-medium text-glow flex items-center gap-2">
          <Activity size={18} className="animate-pulse" /> AI生成済みの攻略記事データベース
        </p>
      </motion.header>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a78bfa]" size={20} />
          <input type="text" placeholder="キーワード、チャンピオン名で検索..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full glass-panel border-2 border-transparent focus:border-[#a78bfa]/50 rounded-2xl py-4 pl-12 pr-4 text-white font-bold outline-none transition-colors shadow-lg" />
        </div>
        
        <div className="flex gap-3 flex-wrap">
          <div className="flex glass-panel p-1 rounded-2xl items-center">
            <button onClick={() => setGroupMode('champion')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${groupMode === 'champion' ? 'bg-[#a78bfa] text-black shadow-lg shadow-[#a78bfa]/20' : 'text-gray-400 hover:text-white'}`}>チャンピオン別</button>
            <button onClick={() => setGroupMode('keyword')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${groupMode === 'keyword' ? 'bg-[#a78bfa] text-black shadow-lg shadow-[#a78bfa]/20' : 'text-gray-400 hover:text-white'}`}>キーワード別</button>
          </div>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="glass-panel rounded-2xl px-5 font-bold text-[#a78bfa] outline-none min-w-[160px] appearance-none cursor-pointer text-center">
            <option value="updated_desc">更新日が新しい順</option>
            <option value="updated_asc">更新日が古い順</option>
            <option value="name_asc">名前順</option>
          </select>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center items-center py-20"><div className="w-8 h-8 border-4 border-[#a78bfa] border-t-transparent rounded-full animate-spin"></div></div>
      ) : grouped.length > 0 ? (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
          {grouped.map(([groupName, items]) => (
            <motion.div variants={itemVariants} key={groupName} className="glass-panel rounded-2xl overflow-hidden group">
              <button onClick={() => toggleGroup(groupName)} className="w-full flex items-center gap-4 p-5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-left border-b border-white/5">
                <span className="text-[#a78bfa] transition-transform duration-300" style={{ transform: collapsedGroups[groupName] ? 'rotate(-90deg)' : 'rotate(0)' }}><ChevronDown size={20} /></span>
                <span className="bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/30 px-4 py-1.5 rounded-lg font-black font-mono tracking-wider shadow-[0_0_10px_rgba(167,139,250,0.1)]">{groupName}</span>
                <span className="text-gray-500 text-sm font-bold">({items.length} 記事)</span>
              </button>

              <AnimatePresence>
                {!collapsedGroups[groupName] && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="divide-y divide-white/5 overflow-hidden">
                    {items.map(article => (
                      <div key={article.id} onClick={() => setSelectedArticle(article)} className="p-5 hover:bg-white/[0.03] cursor-pointer transition-colors flex justify-between items-center group/item">
                        <div className="flex flex-col gap-2">
                          <h3 className="font-bold text-gray-200 group-hover/item:text-[#a78bfa] transition-colors">{article.title.replace(/_/g, ' ')}</h3>
                          <div className="flex gap-2 flex-wrap">
                            {article.keywords?.map((kw: string, kidx: number) => (
                              <span key={kidx} className="text-[10px] text-gray-400 bg-black/40 border border-white/5 px-2 py-1 rounded-md">{kw}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-xs text-gray-500 font-mono flex items-center gap-2"><Clock size={14} className="text-[#a78bfa]/50" /> {new Date(article.created_at).toLocaleDateString('ja-JP')}</div>
                          <button onClick={(e) => deleteArticle(article.id, e)} className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all p-2 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-24 text-center glass-panel rounded-2xl flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-[#a78bfa]/10 rounded-full flex items-center justify-center mb-4">
            <Book size={32} className="text-[#a78bfa]" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{search ? `「${search}」に一致する記事なし` : 'まだ記事がありません'}</h3>
        </motion.div>
      )}
    </div>
  );
}
