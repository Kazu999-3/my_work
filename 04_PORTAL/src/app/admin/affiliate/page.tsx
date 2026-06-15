"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Coins, TrendingUp, Terminal, Brain, Save, Plus, Trash2, 
  Play, RefreshCw, FileText, Check, AlertCircle, Edit, ChevronRight, HelpCircle
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

export default function AffiliateAdminPage() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'links' | 'batch' | 'knowledge'>('analytics');
  
  // 1. 分析データ
  const [aiFeedback, setAiFeedback] = useState<any>({
    popular_keywords: [],
    recommended_tools: [],
    analysis: ""
  });
  const [pvHistory, setPvHistory] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // 2. アフィリエイトリンク
  const [links, setLinks] = useState<Record<string, string>>({});
  const [newLinkKey, setNewLinkKey] = useState('');
  const [newLinkValue, setNewLinkValue] = useState('');
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [linkMessage, setLinkMessage] = useState({ text: '', type: 'success' });

  // 3. バッチ実行
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchLogs, setBatchLogs] = useState('');
  const [isDryRun, setIsDryRun] = useState(true);
  const [startingBatch, setStartingBatch] = useState(false);
  const [refreshingBatch, setRefreshingBatch] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 4. 副業ナレッジ
  const [knowledge, setKnowledge] = useState('');
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [knowledgeMessage, setKnowledgeMessage] = useState({ text: '', type: 'success' });
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // データのフェッチ
  useEffect(() => {
    fetchAnalytics();
    fetchLinks();
    fetchKnowledge();
    checkBatchStatus();

    // バッチ動作中はログを5秒ごとにポーリング
    let interval: any;
    if (isBatchRunning) {
      interval = setInterval(() => {
        checkBatchStatus(true);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBatchRunning]);

  // ログ自動スクロール
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [batchLogs]);

  // Analytics取得
  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch('/api/admin/affiliate/analytics');
      const data = await res.json();
      if (data.aiFeedback) setAiFeedback(data.aiFeedback);
      if (data.pvHistory) setPvHistory(data.pvHistory);
    } catch (e) {
      console.error('Error fetching analytics:', e);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Links取得
  const fetchLinks = async () => {
    try {
      const res = await fetch('/api/admin/affiliate/links');
      const data = await res.json();
      setLinks(data);
    } catch (e) {
      console.error('Error fetching links:', e);
    }
  };

  // ナレッジ取得
  const fetchKnowledge = async () => {
    try {
      const res = await fetch('/api/admin/affiliate/knowledge');
      const data = await res.json();
      if (data.content) setKnowledge(data.content);
    } catch (e) {
      console.error('Error fetching knowledge:', e);
    }
  };

  // バッチステータスチェック
  const checkBatchStatus = async (silent = false) => {
    if (!silent) setRefreshingBatch(true);
    try {
      const res = await fetch('/api/admin/affiliate/generate');
      const data = await res.json();
      setIsBatchRunning(data.isRunning);
      if (data.logs) setBatchLogs(data.logs);
    } catch (e) {
      console.error('Error checking batch status:', e);
    } finally {
      setRefreshingBatch(false);
    }
  };

  // リンクの変更ハンドラ
  const handleLinkChange = (key: string, value: string) => {
    setLinks(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // リンクの削除
  const handleDeleteLink = (keyToDelete: string) => {
    const updated = { ...links };
    delete updated[keyToDelete];
    setLinks(updated);
    setIsEditingLinks(true); // 変更があったフラグ
  };

  // リンクの追加
  const handleAddLink = () => {
    if (!newLinkKey.trim() || !newLinkValue.trim()) return;
    if (!newLinkValue.startsWith('http://') && !newLinkValue.startsWith('https://')) {
      alert('URLは http:// または https:// で始まっている必要があります。');
      return;
    }
    setLinks(prev => ({
      ...prev,
      [newLinkKey.trim()]: newLinkValue.trim()
    }));
    setNewLinkKey('');
    setNewLinkValue('');
    setIsEditingLinks(true);
  };

  // リンクの保存
  const saveLinks = async () => {
    setSavingLinks(true);
    setLinkMessage({ text: '', type: 'success' });
    try {
      const res = await fetch('/api/admin/affiliate/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(links)
      });
      const data = await res.json();
      if (data.success) {
        setLinkMessage({ text: 'アフィリエイトリンクを保存しました！', type: 'success' });
        setIsEditingLinks(false);
      } else {
        setLinkMessage({ text: data.error || '保存に失敗しました。', type: 'error' });
      }
    } catch (e: any) {
      setLinkMessage({ text: `保存中にエラーが発生しました: ${e.message}`, type: 'error' });
    } finally {
      setSavingLinks(false);
    }
  };

  // バッチの実行開始
  const startBatch = async () => {
    if (isBatchRunning) return;
    if (!confirm(isDryRun ? 'テスト実行（ドライラン）を開始しますか？' : '本番実行を開始します。note.comへ下書き保存、Xへプロモ投稿が行われます。よろしいですか？')) {
      return;
    }
    
    setStartingBatch(true);
    try {
      const res = await fetch('/api/admin/affiliate/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: isDryRun })
      });
      const data = await res.json();
      if (data.success) {
        setIsBatchRunning(true);
        checkBatchStatus();
      } else {
        alert(`バッチ起動エラー: ${data.error}`);
      }
    } catch (e: any) {
      alert(`通信エラー: ${e.message}`);
    } finally {
      setStartingBatch(false);
    }
  };

  // ナレッジの保存
  const saveKnowledge = async () => {
    setSavingKnowledge(true);
    setKnowledgeMessage({ text: '', type: 'success' });
    try {
      const res = await fetch('/api/admin/affiliate/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: knowledge })
      });
      const data = await res.json();
      if (data.success) {
        setKnowledgeMessage({ text: '副業ナレッジを保存しました！', type: 'success' });
      } else {
        setKnowledgeMessage({ text: data.error || '保存に失敗しました。', type: 'error' });
      }
    } catch (e: any) {
      setKnowledgeMessage({ text: `保存中にエラーが発生しました: ${e.message}`, type: 'error' });
    } finally {
      setSavingKnowledge(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto flex flex-col gap-8 relative overflow-hidden text-gray-100">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[45vw] h-[45vw] rounded-full bg-emerald-600/5 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-teal-600/5 blur-[150px] animate-pulse" style={{ animationDelay: '3s' }}></div>
      </div>

      {/* Header */}
      <motion.header 
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Coins size={28} className="text-emerald-400" />
            <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200">
              副業アフィリエイト管理
            </h1>
          </div>
          <p className="text-gray-400 text-sm font-medium">
            AI自動アフィリエイトバッチ、note.comアクセス分析、案件管理、ノウハウナレッジの一元管理
          </p>
        </div>

        {/* System Status Indicator */}
        <div className="flex items-center gap-3 bg-black/40 border border-white/5 px-4 py-2 rounded-2xl">
          <div className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBatchRunning ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isBatchRunning ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`}></span>
          </div>
          <span className="text-xs font-bold font-mono">
            {isBatchRunning ? 'BATCH RUNNING' : 'SYSTEM IDLE'}
          </span>
        </div>
      </motion.header>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 gap-2 overflow-x-auto pb-px">
        {[
          { id: 'analytics', label: '📊 アクセス分析' },
          { id: 'links', label: '🔗 リンク管理' },
          { id: 'batch', label: '🚀 自動バッチ実行' },
          { id: 'knowledge', label: '🧠 副業ナレッジ' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-3 px-6 font-bold text-sm rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
              activeTab === tab.id
                ? 'bg-white/5 border-emerald-400 text-emerald-400 shadow-inner'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-[400px]">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: Analytics */}
          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {loadingAnalytics ? (
                <div className="flex items-center justify-center py-20 text-gray-400">
                  <RefreshCw size={24} className="animate-spin text-emerald-400 mr-3" />
                  データを取得中...
                </div>
              ) : (
                <>
                  {/* AI Analysis Cards */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="glass-panel lg:col-span-2 p-6 border border-white/5 rounded-3xl bg-gradient-to-br from-emerald-500/5 to-transparent flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <Brain size={20} className="text-emerald-400" />
                          <h3 className="text-lg font-black text-white">Gemini AI によるトレンド分析</h3>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                          {aiFeedback.analysis}
                        </p>
                      </div>
                      <div className="mt-4 text-xs text-gray-500 flex justify-between border-t border-white/5 pt-4">
                        <span>生成元: D:/my_work/02_FACTORY/note_analytics_feedback.json</span>
                        <button onClick={fetchAnalytics} className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold">
                          <RefreshCw size={10} /> リフレッシュ
                        </button>
                      </div>
                    </div>

                    <div className="glass-panel p-6 border border-white/5 rounded-3xl bg-gradient-to-br from-teal-500/5 to-transparent space-y-5">
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">🔥 人気のキーワード</h4>
                        <div className="flex flex-wrap gap-2">
                          {aiFeedback.popular_keywords.map((kw: string, i: number) => (
                            <span key={i} className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-full font-bold">
                              {kw}
                            </span>
                          ))}
                          {aiFeedback.popular_keywords.length === 0 && <span className="text-xs text-gray-500">データなし</span>}
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">🚀 推奨アフィリエイトツール</h4>
                        <div className="space-y-2">
                          {aiFeedback.recommended_tools.map((tool: string, i: number) => (
                            <div key={i} className="flex items-center justify-between bg-black/20 p-2.5 rounded-xl border border-white/5 text-xs font-bold">
                              <span>{tool}</span>
                              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">推奨</span>
                            </div>
                          ))}
                          {aiFeedback.recommended_tools.length === 0 && <span className="text-xs text-gray-500">データなし</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PV History Table */}
                  <div className="glass-panel p-6 border border-white/5 rounded-3xl bg-gradient-to-b from-white/[0.03] to-transparent">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-400" />
                        note 記事アクセスランキング（直近）
                      </h3>
                      <span className="text-xs text-gray-400 font-medium">履歴数: {pvHistory.length} 件</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-gray-400 font-bold">
                            <th className="pb-3 pr-4">記事タイトル</th>
                            <th className="pb-3 px-4 w-28 text-right">PV数</th>
                            <th className="pb-3 px-4 w-24 text-right">スキ数</th>
                            <th className="pb-3 px-4 w-24 text-right">コメント</th>
                            <th className="pb-3 pl-4 w-32 text-right">計測日</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-medium">
                          {pvHistory.map((row, idx) => (
                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3.5 pr-4 max-w-md truncate text-gray-200" title={row.title}>
                                {row.title}
                              </td>
                              <td className="py-3.5 px-4 text-right text-emerald-400 font-bold font-mono">
                                {row.pv.toLocaleString()}
                              </td>
                              <td className="py-3.5 px-4 text-right text-rose-400 font-mono">
                                {row.likes}
                              </td>
                              <td className="py-3.5 px-4 text-right text-blue-400 font-mono">
                                {row.comments}
                              </td>
                              <td className="py-3.5 pl-4 text-right text-gray-500 font-mono text-xs">
                                {row.recorded_date}
                              </td>
                            </tr>
                          ))}
                          {pvHistory.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-10 text-center text-gray-500">
                                統計データが存在しません。
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* TAB 2: Links */}
          {activeTab === 'links' && (
            <motion.div
              key="links"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="glass-panel p-6 border border-white/5 rounded-3xl bg-gradient-to-b from-white/[0.03] to-transparent space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black text-white">アフィリエイト・紹介用URLの管理</h3>
                  <p className="text-xs text-gray-400 mt-1">紹介するツール名とアフィリエイトリンクを紐付けます（保存先: D:/my_work/02_FACTORY/affiliate_links.json）</p>
                </div>
                
                <div className="flex items-center gap-3">
                  {isEditingLinks && (
                    <span className="text-xs text-amber-400 font-bold animate-pulse">※未保存の変更があります</span>
                  )}
                  <button
                    onClick={saveLinks}
                    disabled={savingLinks || Object.keys(links).length === 0}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-800 disabled:text-gray-500 text-black py-2 px-5 rounded-2xl font-black text-xs transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    {savingLinks ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    リンクの保存
                  </button>
                </div>
              </div>

              {linkMessage.text && (
                <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-2.5 ${
                  linkMessage.type === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}>
                  {linkMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  {linkMessage.text}
                </div>
              )}

              {/* Grid / Inputs for keys & values */}
              <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
                {Object.entries(links).map(([key, value]) => (
                  <div key={key} className="flex flex-col md:flex-row gap-3 bg-black/20 p-4 rounded-2xl border border-white/5 items-stretch md:items-center">
                    <div className="md:w-1/4">
                      <span className="text-sm font-black text-gray-200 block truncate" title={key}>{key}</span>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => {
                          handleLinkChange(key, e.target.value);
                          setIsEditingLinks(true);
                        }}
                        placeholder="アフィリエイトリンクを入力 (https://...)"
                        className="w-full bg-black/40 border border-white/10 focus:border-emerald-500/50 rounded-xl px-4 py-2 text-xs font-mono text-emerald-300 focus:outline-none transition-colors"
                      />
                    </div>
                    <button
                      onClick={() => handleDeleteLink(key)}
                      className="p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 border border-transparent hover:border-rose-500/20"
                      title="削除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                {Object.keys(links).length === 0 && (
                  <div className="text-center py-10 text-gray-500 text-sm">
                    アフィリエイトリンクがありません。以下から追加してください。
                  </div>
                )}
              </div>

              {/* Add New Link Form */}
              <div className="border-t border-white/10 pt-5 space-y-4">
                <h4 className="text-sm font-bold text-gray-300">🆕 新しいリンクの追加</h4>
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="ツール名 (例: Notion)"
                    value={newLinkKey}
                    onChange={(e) => setNewLinkKey(e.target.value)}
                    className="md:w-1/4 bg-black/40 border border-white/10 focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none transition-colors text-white"
                  />
                  <input
                    type="text"
                    placeholder="アフィリエイト紹介用URL (例: https://px.a8.net/svt/...)"
                    value={newLinkValue}
                    onChange={(e) => setNewLinkValue(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none transition-colors text-emerald-300"
                  />
                  <button
                    onClick={handleAddLink}
                    disabled={!newLinkKey.trim() || !newLinkValue.trim()}
                    className="bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 hover:border-transparent text-emerald-300 hover:text-black font-black text-xs py-2.5 px-6 rounded-xl transition-all disabled:opacity-40 disabled:hover:bg-emerald-500/10 disabled:hover:text-emerald-300 cursor-pointer"
                  >
                    追加する
                  </button>
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 3: Batch */}
          {activeTab === 'batch' && (
            <motion.div
              key="batch"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              
              {/* Controls Panel */}
              <div className="glass-panel p-6 border border-white/5 rounded-3xl bg-gradient-to-br from-emerald-500/5 to-transparent space-y-6 flex flex-col justify-between">
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <Terminal size={20} className="text-emerald-400" />
                    <h3 className="text-lg font-black text-white">自動記事生成バッチ操作</h3>
                  </div>
                  
                  <p className="text-xs text-gray-400 leading-relaxed">
                    バッチを実行すると、以下の流れが自律実行されます。<br />
                    1. トレンドITツールの自動収集 (ToolScout)<br />
                    2. アフィリエイト紹介用記事の生成 (ToolForge)<br />
                    3. note.com への下書き自動保存 (Publisher)<br />
                    4. X (Twitter) 用宣伝スレッドの作成と自動投稿 (Publisher)
                  </p>

                  <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3">
                    <label className="flex items-start gap-3 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDryRun}
                        onChange={(e) => setIsDryRun(e.target.checked)}
                        disabled={isBatchRunning}
                        className="mt-1 accent-emerald-500"
                      />
                      <div>
                        <span className="text-xs font-black block">ドライランで実行する (推奨)</span>
                        <span className="text-[10px] text-gray-500">記事の自動生成とXスレッド構築は行いますが、noteへの下書き保存やXへの実投稿は行いません。</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-3 mt-6">
                  {isBatchRunning ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4 rounded-2xl flex items-start gap-2.5 text-xs font-bold">
                      <RefreshCw size={14} className="animate-spin mt-0.5 shrink-0" />
                      <div>
                        <span>バッチが実行中です...</span>
                        <span className="block text-[10px] text-gray-500 mt-1">隣のログモニターで進行状況をリアルタイムに確認できます。</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={startBatch}
                      disabled={startingBatch}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-black py-3.5 px-6 rounded-2xl font-black text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      <Play size={16} fill="black" />
                      アフィリエイトバッチを実行
                    </button>
                  )}
                  
                  <button
                    onClick={() => checkBatchStatus()}
                    disabled={refreshingBatch}
                    className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 py-2.5 px-6 rounded-xl font-bold text-xs transition-all cursor-pointer border border-white/5"
                  >
                    <RefreshCw size={12} className={refreshingBatch ? 'animate-spin' : ''} />
                    ログとステータスを更新
                  </button>
                </div>
              </div>

              {/* Log Terminal Panel */}
              <div className="lg:col-span-2 glass-panel p-6 border border-white/5 rounded-3xl bg-black/50 flex flex-col h-[500px]">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Terminal size={14} className="text-gray-500" />
                    Console Output Log
                  </h4>
                  {isBatchRunning && (
                    <span className="text-[10px] font-black text-amber-400 animate-pulse bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      STREAMING
                    </span>
                  )}
                </div>

                {/* Terminal Window */}
                <div className="flex-1 bg-black/60 rounded-2xl p-4 overflow-y-auto font-mono text-[11px] leading-relaxed border border-white/5 custom-scrollbar text-gray-300 whitespace-pre-wrap">
                  {batchLogs}
                  <div ref={logEndRef} />
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 4: Knowledge */}
          {activeTab === 'knowledge' && (
            <motion.div
              key="knowledge"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="glass-panel p-6 border border-white/5 rounded-3xl bg-gradient-to-b from-white/[0.03] to-transparent space-y-5 flex flex-col"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black text-white">💰 副業アフィリエイト運営ナレッジ</h3>
                  <p className="text-xs text-gray-400 mt-1">運営ノウハウや売れる記事構成テンプレートなどのルールを編集・保存します</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-xs py-2 px-4 rounded-xl transition-all cursor-pointer"
                  >
                    {isPreviewMode ? '✏️ エディタ表示' : '👁️ プレビュー表示'}
                  </button>

                  <button
                    onClick={saveKnowledge}
                    disabled={savingKnowledge}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-800 disabled:text-gray-500 text-black py-2.5 px-6 rounded-2xl font-black text-xs transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    {savingKnowledge ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    ナレッジを保存
                  </button>
                </div>
              </div>

              {knowledgeMessage.text && (
                <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-2.5 ${
                  knowledgeMessage.type === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}>
                  {knowledgeMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  {knowledgeMessage.text}
                </div>
              )}

              {/* Editor / Preview Area */}
              <div className="flex-1 min-h-[400px] flex">
                {isPreviewMode ? (
                  <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 overflow-y-auto text-sm leading-relaxed text-gray-300 prose prose-invert max-w-none font-medium">
                    {/* 簡易Markdownレンダラー。行頭が#や-の場合に対応 */}
                    {knowledge.split('\n').map((line, idx) => {
                      if (line.startsWith('# ')) {
                        return <h1 key={idx} className="text-2xl font-black text-white mt-5 mb-3 border-b border-white/10 pb-2">{line.replace('# ', '')}</h1>;
                      }
                      if (line.startsWith('## ')) {
                        return <h2 key={idx} className="text-xl font-bold text-emerald-300 mt-4 mb-2">{line.replace('## ', '')}</h2>;
                      }
                      if (line.startsWith('### ')) {
                        return <h3 key={idx} className="text-lg font-bold text-white mt-3 mb-1">{line.replace('### ', '')}</h3>;
                      }
                      if (line.startsWith('- ') || line.startsWith('* ')) {
                        return <li key={idx} className="ml-4 list-disc my-1">{line.substring(2)}</li>;
                      }
                      if (line.trim() === '') {
                        return <div key={idx} className="h-2" />;
                      }
                      return <p key={idx} className="my-1.5">{line}</p>;
                    })}
                  </div>
                ) : (
                  <textarea
                    value={knowledge}
                    onChange={(e) => setKnowledge(e.target.value)}
                    placeholder="ここにMarkdown形式でアフィリエイト運営ナレッジを記述してください..."
                    className="w-full bg-black/40 border border-white/10 focus:border-emerald-500/50 rounded-2xl p-6 text-sm font-mono text-gray-200 focus:outline-none transition-colors resize-y min-h-[450px] custom-scrollbar"
                  />
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
