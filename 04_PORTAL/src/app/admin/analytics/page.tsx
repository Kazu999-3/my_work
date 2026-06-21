"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Users, Heart, Layers, ArrowLeft, RefreshCw, AlertCircle, FileText, CheckCircle, Lightbulb, Copy } from 'lucide-react';
import Link from 'next/link';

interface Report {
  date: string;
  fileName: string;
  content: string;
}

interface Draft {
  name: string;
  fileName: string;
  content: string;
}

export default function NoteAnalytics() {
  const [reports, setReports] = useState<Report[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [metrics, setMetrics] = useState({ pv: '0', likes: '0', cvr: '0.0', articles: '0' });
  const [actionPlan, setActionPlan] = useState('');
  const [mainContent, setMainContent] = useState('');
  const [activeTab, setActiveTab] = useState<'analytics' | 'drafts'>('analytics');
  const [isCopied, setIsCopied] = useState(false);

  const fetchReports = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/analytics');
      const data = await res.json();
      if (data.reports && data.reports.length > 0) {
        setReports(data.reports);
        // デフォルトで最新のレポートを選択
        const latest = data.reports[0];
        setSelectedReport(latest);
        parseReportData(latest.content);
      }
      if (data.drafts && data.drafts.length > 0) {
        setDrafts(data.drafts);
        // デフォルトで最新の下書きを選択
        setSelectedDraft(data.drafts[0]);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const parseReportData = (content: string) => {
    // 主要メトリクスの抽出
    const pvMatch = content.match(/(?:合計PV数|合計PV|PV数)\s*:\s*\*?([\d,]+)\*?/i);
    const likesMatch = content.match(/(?:合計スキ数|合計スキ|スキ数)\s*:\s*\*?([\d,]+)\*?/i);
    const cvrMatch = content.match(/(?:平均CVR|CVR)\s*:\s*\*?([\d.]+)\s*%?\*?/i);
    const articlesMatch = content.match(/(?:総記事数|記事数)\s*:\s*\*?(\d+)\*?/i);

    setMetrics({
      pv: pvMatch ? pvMatch[1] : '0',
      likes: likesMatch ? likesMatch[1] : '0',
      cvr: cvrMatch ? cvrMatch[1] : '0.0',
      articles: articlesMatch ? articlesMatch[1] : '0'
    });

    // 🎯 次のAI改善アクションプラン の抽出
    const parts = content.split(/## 🎯\s*次のAI改善アクションプラン/i);
    if (parts.length > 1) {
      const plan = parts[1].split(/##/)[0].trim();
      setActionPlan(plan);
      // メインコンテンツ（🎯 以前の部分）
      setMainContent(parts[0].trim());
    } else {
      setActionPlan('');
      setMainContent(content);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleReportChange = (date: string) => {
    const report = reports.find(r => r.date === date);
    if (report) {
      setSelectedReport(report);
      parseReportData(report.content);
    }
  };

  const handleDraftChange = (name: string) => {
    const draft = drafts.find(d => d.name === name);
    if (draft) {
      setSelectedDraft(draft);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const renderMarkdown = (content: string) => {
    if (!content) return null;
    return content.split('\n\n').map((paragraph, pIdx) => {
      const line = paragraph.trim();
      if (!line) return null;

      // 見出しのハンドリング
      if (line.startsWith('# ')) {
        return <h1 key={pIdx} className="text-3xl font-black text-white tracking-tight pt-4 mt-6">{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={pIdx} className="text-xl font-black text-white border-b border-white/5 pb-2 pt-4 mt-6 flex items-center gap-2">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={pIdx} className="text-base font-black text-white pt-2 mt-4">{line.replace('### ', '')}</h3>;
      }

      // テーブルのハンドリング
      if (line.startsWith('|')) {
        const rows = line.split('\n').map(row => row.trim()).filter(row => row);
        if (rows.length > 2) {
          const headers = rows[0].split('|').map(h => h.trim()).filter((h, i) => i > 0 && i < rows[0].split('|').length - 1);
          const bodyRows = rows.slice(2).map(r => r.split('|').map(c => c.trim()).filter((c, i) => i > 0 && i < r.split('|').length - 1));
          return (
            <div key={pIdx} className="overflow-x-auto my-6 bg-black/20 rounded-2xl border border-white/5">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    {headers.map((h, i) => (
                      <th key={i} className="p-3 font-bold text-gray-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((r, ri) => (
                    <tr key={ri} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors font-mono">
                      {r.map((cell, ci) => (
                        <td key={ci} className="p-3 text-gray-300">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
      }

      // リストのハンドリング
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const listItems = line.split('\n');
        return (
          <ul key={pIdx} className="list-disc list-inside pl-4 space-y-2 my-4">
            {listItems.map((li, liIdx) => (
              <li key={liIdx} className="text-gray-300 leading-relaxed">
                {li.replace(/^[\-\*]\s+/, '')}
              </li>
            ))}
          </ul>
        );
      }

      // アラートのハンドリング (GitHub-style alert: [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION])
      if (line.includes('> [!NOTE]') || line.includes('> [!TIP]') || line.includes('> [!IMPORTANT]') || line.includes('> [!WARNING]') || line.includes('> [!CAUTION]')) {
        let borderColor = 'border-indigo-500';
        let bgColor = 'bg-indigo-500/5';
        let textColor = 'text-indigo-200';
        let iconColor = 'text-indigo-400';

        if (line.includes('[!TIP]')) {
          borderColor = 'border-emerald-500';
          bgColor = 'bg-emerald-500/5';
          textColor = 'text-emerald-200';
          iconColor = 'text-emerald-400';
        } else if (line.includes('[!IMPORTANT]')) {
          borderColor = 'border-purple-500';
          bgColor = 'bg-purple-500/5';
          textColor = 'text-purple-200';
          iconColor = 'text-purple-400';
        } else if (line.includes('[!WARNING]')) {
          borderColor = 'border-amber-500';
          bgColor = 'bg-amber-500/5';
          textColor = 'text-amber-200';
          iconColor = 'text-amber-400';
        } else if (line.includes('[!CAUTION]')) {
          borderColor = 'border-rose-500';
          bgColor = 'bg-rose-500/5';
          textColor = 'text-rose-200';
          iconColor = 'text-rose-400';
        }

        const cleanText = line
          .replace(/>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n*>?\s*/i, '')
          .replace(/^>\s*/gm, '');

        return (
          <div key={pIdx} className={`p-4 ${bgColor} border-l-4 ${borderColor} rounded-r-xl my-4 text-xs flex items-start gap-3`}>
            <AlertCircle className={`${iconColor} mt-0.5 shrink-0`} size={16} />
            <div className={`${textColor} leading-relaxed whitespace-pre-wrap`}>{cleanText}</div>
          </div>
        );
      }

      // 普通の段落
      return <p key={pIdx} className="leading-relaxed text-gray-400">{line}</p>;
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 80 } }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-gray-100 font-sans pb-12 relative overflow-hidden">
      
      {/* 光彩エフェクトの配置 */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-500/5 blur-[120px] pointer-events-none z-0"></div>

      <header className="border-b border-white/5 bg-slate-950/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-gray-400 hover:text-white flex items-center justify-center">
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent tracking-tight flex items-center gap-2">
                Note Analytics
              </h1>
              <p className="text-xs text-gray-500 font-bold">アクセス・売上状況とAI改善アドバイス</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {activeTab === 'analytics' && reports.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-bold">レポート履歴:</span>
                <select 
                  onChange={(e) => handleReportChange(e.target.value)}
                  value={selectedReport?.date || ''}
                  className="bg-slate-900/80 border border-white/10 text-gray-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500/50 transition-colors cursor-pointer font-mono"
                >
                  {reports.map(r => (
                    <option key={r.date} value={r.date}>{r.date}</option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'drafts' && drafts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-bold">下書き一覧:</span>
                <select 
                  onChange={(e) => handleDraftChange(e.target.value)}
                  value={selectedDraft?.name || ''}
                  className="bg-slate-900/80 border border-white/10 text-gray-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500/50 transition-colors cursor-pointer font-mono"
                >
                  {drafts.map(d => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button 
              onClick={() => fetchReports(true)} 
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-gray-400 hover:text-white flex items-center justify-center disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        
        {/* 切り替えタブの導入 */}
        <div className="flex border-b border-white/5 mb-8 gap-2">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'border-indigo-500 text-white bg-indigo-500/5'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <TrendingUp size={16} />
            📊 noteアクセス分析
          </button>
          <button
            onClick={() => setActiveTab('drafts')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'drafts'
                ? 'border-indigo-500 text-white bg-indigo-500/5'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <FileText size={16} />
            ✍️ 記事下書きプレビュー
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
            <p className="text-sm text-gray-500 font-bold font-mono">Loading note stats data...</p>
          </div>
        ) : activeTab === 'analytics' ? (
          // === 分析レポート表示エリア ===
          reports.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 border border-white/5 text-center bg-black/20 max-w-xl mx-auto mt-16">
              <AlertCircle size={48} className="text-yellow-500 mx-auto mb-4 animate-bounce" />
              <h3 className="text-xl font-black text-white mb-2">レポートデータが見つかりません</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-6">
                `note_analytics_daemon.py` がまだ実行されていないか、レポートファイルが出力されていません。SRE Daemon経由の定期稼働、または手動実行してください。
              </p>
              <Link href="/admin/dashboard" className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)] inline-block">
                ダッシュボードへ戻る
              </Link>
            </div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-6"
            >
              {/* メトリクスカードグリッド */}
              <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: '合計PV数', value: metrics.pv, icon: TrendingUp, color: 'text-indigo-400', bg: 'from-indigo-500/10' },
                  { name: '合計スキ数', value: metrics.likes, icon: Heart, color: 'text-rose-400', bg: 'from-rose-500/10' },
                  { name: '平均反応率 (CVR)', value: `${metrics.cvr}%`, icon: Users, color: 'text-emerald-400', bg: 'from-emerald-500/10' },
                  { name: '集計記事数', value: `${metrics.articles}本`, icon: Layers, color: 'text-blue-400', bg: 'from-blue-500/10' }
                ].map((m, idx) => (
                  <div key={idx} className="glass-panel rounded-3xl p-6 border border-white/5 bg-gradient-to-br to-transparent relative overflow-hidden group hover:border-white/10 transition-colors">
                    <div className={`absolute top-0 left-0 w-24 h-24 bg-gradient-to-br ${m.bg} to-transparent rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform`}></div>
                    <div className="flex justify-between items-center mb-4 relative z-10">
                      <span className="text-xs text-gray-500 font-bold">{m.name}</span>
                      <m.icon className={`${m.color} bg-white/5 p-2 rounded-xl border border-white/5`} size={36} />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-3xl font-black text-white tracking-tight font-mono">{m.value}</h3>
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* AI改善アクションプラン */}
              {actionPlan && (
                <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-6 border border-rose-500/10 bg-gradient-to-br from-rose-500/5 via-indigo-500/5 to-transparent relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-4">
                    <Lightbulb className="text-yellow-400 bg-yellow-500/10 p-2 rounded-xl border border-yellow-500/20" size={36} />
                    <div>
                      <h3 className="text-lg font-black text-white">🎯 次のAI改善アクションプラン</h3>
                      <p className="text-[10px] text-gray-500 font-bold">データから導き出された最も効果的な打ち手</p>
                    </div>
                  </div>
                  
                  <div className="bg-black/40 rounded-2xl border border-white/5 p-4 text-sm leading-relaxed text-gray-300 whitespace-pre-wrap font-sans">
                    {actionPlan}
                  </div>
                </motion.div>
              )}

              {/* 分析詳細レポート */}
              <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-6 border border-white/5 bg-black/10">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                  <FileText className="text-indigo-400 bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20" size={36} />
                  <div>
                    <h3 className="text-lg font-black text-white">📋 分析詳細レポート ({selectedReport?.date})</h3>
                    <p className="text-[10px] text-gray-500 font-bold">{selectedReport?.fileName}</p>
                  </div>
                </div>

                <div className="prose prose-invert max-w-none text-sm leading-relaxed text-gray-300 space-y-6">
                  {renderMarkdown(mainContent)}
                </div>
              </motion.div>
            </motion.div>
          )
        ) : (
          // === 記事下書きプレビュー表示エリア ===
          drafts.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 border border-white/5 text-center bg-black/20 max-w-xl mx-auto mt-16">
              <AlertCircle size={48} className="text-yellow-500 mx-auto mb-4 animate-bounce" />
              <h3 className="text-xl font-black text-white mb-2">下書き原稿が見つかりません</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-6">
                `02_FACTORY/note_drafts/` ディレクトリ配下に Markdown の下書き原稿が存在しません。
              </p>
            </div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-6"
            >
              <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-6 border border-white/5 bg-black/10">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <FileText className="text-indigo-400 bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20" size={36} />
                    <div>
                      <h3 className="text-lg font-black text-white">✍️ 記事下書きプレビュー: {selectedDraft?.name}</h3>
                      <p className="text-[10px] text-gray-500 font-bold">{selectedDraft?.fileName}</p>
                    </div>
                  </div>
                  
                  {selectedDraft && (
                    <button
                      onClick={() => copyToClipboard(selectedDraft.content)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/5 hover:border-white/10 transition-all text-xs font-bold ${
                        isCopied 
                          ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400' 
                          : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white'
                      }`}
                    >
                      {isCopied ? <CheckCircle size={14} /> : <Copy size={14} />}
                      {isCopied ? 'コピー完了！' : '原稿をコピー'}
                    </button>
                  )}
                </div>

                {/* Markdownプレビュー表示 */}
                <div className="prose prose-invert max-w-none text-sm leading-relaxed text-gray-300 space-y-6">
                  {selectedDraft && renderMarkdown(selectedDraft.content)}
                </div>
              </motion.div>
            </motion.div>
          )
        )}
      </main>
    </div>
  );
}
