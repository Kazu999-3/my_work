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
  id: number;
  title: string;
  champion: string | null;
  patch: string | null;
  content_free: string | null;
  content_paid: string | null;
  promo_text: string | null;
  status: string;
  source_skill: string | null;
  created_at: string;
  note_url: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  views: number | null;
  likes: number | null;
  sales_count: number | null;
  sales_amount: number | null;
  metrics_updated_at: string | null;
}

interface NoteStats {
  publishedCount: number;
  totalViews: number;
  totalLikes: number;
  totalSalesCount: number;
  totalSalesAmount: number;
  topByViews: { id: number; title: string; champion: string | null; views: number | null; likes: number | null; note_url: string | null }[];
}

export default function NoteAnalytics() {
  const [reports, setReports] = useState<Report[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [noteStats, setNoteStats] = useState<NoteStats | null>(null);
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
      if (data.noteStats) setNoteStats(data.noteStats);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const parseReportData = (content: string) => {
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

  const handleDraftChange = (id: string) => {
    const draft = drafts.find(d => String(d.id) === id);
    if (draft) {
      setSelectedDraft(draft);
    }
  };

  // 公開管理・成績の手入力(課題#54)。noteに公式APIが無く、過去の自動スクレイピング
  // (note_analytics_daemon.py)も不安定で廃止済みのため、手入力方式にしている。
  const [noteUrlInput, setNoteUrlInput] = useState('');
  const [scheduledInput, setScheduledInput] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [metricsInput, setMetricsInput] = useState({ views: '', likes: '', sales_count: '', sales_amount: '' });
  const [savingPublish, setSavingPublish] = useState(false);
  const [savingMetrics, setSavingMetrics] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  useEffect(() => {
    setNoteUrlInput(selectedDraft?.note_url || '');
    setScheduledInput(selectedDraft?.scheduled_at ? selectedDraft.scheduled_at.slice(0, 10) : '');
    setMetricsInput({
      views: selectedDraft?.views != null ? String(selectedDraft.views) : '',
      likes: selectedDraft?.likes != null ? String(selectedDraft.likes) : '',
      sales_count: selectedDraft?.sales_count != null ? String(selectedDraft.sales_count) : '',
      sales_amount: selectedDraft?.sales_amount != null ? String(selectedDraft.sales_amount) : '',
    });
    setPublishMsg(null);
  }, [selectedDraft?.id]);

  const applyDraftPatch = (id: number, patch: Partial<Draft>) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
    setSelectedDraft(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
  };

  const markPublished = async () => {
    if (!selectedDraft || !noteUrlInput.trim()) return;
    setSavingPublish(true); setPublishMsg(null);
    try {
      const res = await fetch(`/api/admin/note-articles/${selectedDraft.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_url: noteUrlInput.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '更新に失敗しました');
      applyDraftPatch(selectedDraft.id, d.article);
      setPublishMsg('✅ 公開済みにしました');
    } catch (e: any) { setPublishMsg('❌ ' + e.message); }
    finally { setSavingPublish(false); }
  };

  const saveSchedule = async () => {
    if (!selectedDraft) return;
    setSavingSchedule(true); setPublishMsg(null);
    try {
      const res = await fetch(`/api/admin/note-articles/${selectedDraft.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: scheduledInput || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '更新に失敗しました');
      applyDraftPatch(selectedDraft.id, d.article);
      setPublishMsg(scheduledInput ? '✅ 配信予定日を設定しました' : '✅ 配信予定日を解除しました');
    } catch (e: any) { setPublishMsg('❌ ' + e.message); }
    finally { setSavingSchedule(false); }
  };

  const saveMetrics = async () => {
    if (!selectedDraft) return;
    setSavingMetrics(true); setPublishMsg(null);
    try {
      const body: Record<string, any> = {};
      (['views', 'likes', 'sales_count', 'sales_amount'] as const).forEach((k) => {
        if (metricsInput[k] !== '') body[k] = Number(metricsInput[k]);
      });
      const res = await fetch(`/api/admin/note-articles/${selectedDraft.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '更新に失敗しました');
      applyDraftPatch(selectedDraft.id, d.article);
      setPublishMsg('✅ 成績を更新しました');
    } catch (e: any) { setPublishMsg('❌ ' + e.message); }
    finally { setSavingMetrics(false); }
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
        return <h1 key={pIdx} className="text-3xl font-black text-stone-900 tracking-tight pt-4 mt-6">{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={pIdx} className="text-xl font-black text-stone-900 border-b border-black/5 pb-2 pt-4 mt-6 flex items-center gap-2">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={pIdx} className="text-base font-black text-stone-900 pt-2 mt-4">{line.replace('### ', '')}</h3>;
      }

      // テーブルのハンドリング
      if (line.startsWith('|')) {
        const rows = line.split('\n').map(row => row.trim()).filter(row => row);
        if (rows.length > 2) {
          const headers = rows[0].split('|').map(h => h.trim()).filter((h, i) => i > 0 && i < rows[0].split('|').length - 1);
          const bodyRows = rows.slice(2).map(r => r.split('|').map(c => c.trim()).filter((c, i) => i > 0 && i < r.split('|').length - 1));
          return (
            <div key={pIdx} className="overflow-x-auto my-6 bg-black/[0.03] rounded-2xl border border-black/5">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/10 bg-black/[0.03]">
                    {headers.map((h, i) => (
                      <th key={i} className="p-3 font-bold text-stone-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((r, ri) => (
                    <tr key={ri} className="border-b border-black/5 hover:bg-black/[0.02] transition-colors font-mono">
                      {r.map((cell, ci) => (
                        <td key={ci} className="p-3 text-stone-600">{cell}</td>
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
              <li key={liIdx} className="text-stone-700 leading-relaxed">
                {li.replace(/^[\-\*]\s+/, '')}
              </li>
            ))}
          </ul>
        );
      }

      // アラートのハンドリング (GitHub-style alert: [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION])
      if (line.includes('> [!NOTE]') || line.includes('> [!TIP]') || line.includes('> [!IMPORTANT]') || line.includes('> [!WARNING]') || line.includes('> [!CAUTION]')) {
        let borderColor = 'border-indigo-400';
        let bgColor = 'bg-indigo-50';
        let textColor = 'text-indigo-800';
        let iconColor = 'text-indigo-600';

        if (line.includes('[!TIP]')) {
          borderColor = 'border-emerald-400';
          bgColor = 'bg-emerald-50';
          textColor = 'text-emerald-800';
          iconColor = 'text-emerald-600';
        } else if (line.includes('[!IMPORTANT]')) {
          borderColor = 'border-purple-400';
          bgColor = 'bg-purple-50';
          textColor = 'text-purple-800';
          iconColor = 'text-purple-600';
        } else if (line.includes('[!WARNING]')) {
          borderColor = 'border-amber-400';
          bgColor = 'bg-amber-50';
          textColor = 'text-amber-800';
          iconColor = 'text-amber-600';
        } else if (line.includes('[!CAUTION]')) {
          borderColor = 'border-rose-400';
          bgColor = 'bg-rose-50';
          textColor = 'text-rose-800';
          iconColor = 'text-rose-600';
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
      return <p key={pIdx} className="leading-relaxed text-stone-600">{line}</p>;
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
    <div className="min-h-screen bg-background text-stone-900 font-sans pb-12 relative overflow-hidden">

      {/* 光彩エフェクトの配置 */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-500/5 blur-[120px] pointer-events-none z-0"></div>

      <header className="border-b border-black/5 bg-white/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="p-2.5 rounded-xl bg-black/[0.03] border border-black/5 hover:bg-black/5 hover:border-black/10 transition-all text-stone-500 hover:text-stone-900 flex items-center justify-center">
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-stone-800 via-indigo-600 to-indigo-700 bg-clip-text text-transparent tracking-tight flex items-center gap-2">
                Note Analytics
              </h1>
              <p className="text-xs text-stone-500 font-bold">アクセス・売上状況とAI改善アドバイス</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {activeTab === 'analytics' && reports.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500 font-bold">レポート履歴:</span>
                <select
                  onChange={(e) => handleReportChange(e.target.value)}
                  value={selectedReport?.date || ''}
                  className="bg-white border border-black/10 text-stone-700 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500/50 transition-colors cursor-pointer font-mono"
                >
                  {reports.map(r => (
                    <option key={r.date} value={r.date}>{r.date}</option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'drafts' && drafts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500 font-bold">下書き一覧:</span>
                <select
                  onChange={(e) => handleDraftChange(e.target.value)}
                  value={selectedDraft ? String(selectedDraft.id) : ''}
                  className="bg-white border border-black/10 text-stone-700 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500/50 transition-colors cursor-pointer font-mono max-w-xs"
                >
                  {drafts.map(d => (
                    <option key={d.id} value={d.id}>{d.status === 'published' ? '✅' : '📝'} {d.title}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => fetchReports(true)}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-black/[0.03] border border-black/5 hover:bg-black/5 hover:border-black/10 transition-all text-stone-500 hover:text-stone-900 flex items-center justify-center disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        
        {/* 切り替えタブの導入 */}
        <div className="flex border-b border-black/5 mb-8 gap-2">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'border-indigo-600 text-stone-900 bg-indigo-50'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            <TrendingUp size={16} />
            📊 noteアクセス分析
          </button>
          <button
            onClick={() => setActiveTab('drafts')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'drafts'
                ? 'border-indigo-600 text-stone-900 bg-indigo-50'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            <FileText size={16} />
            ✍️ 記事下書きプレビュー
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
            <p className="text-sm text-stone-500 font-bold font-mono">Loading note stats data...</p>
          </div>
        ) : activeTab === 'analytics' ? (
          // === 分析エリア: 手入力の実データ(noteStats)を主指標にする。
          // 旧`note_analytics_daemon.py`のスクレイピングは構造変化に弱く廃止済みで、
          // レポートファイルは6週間以上前のものが1本残っているだけの死んだ経路だった。 ===
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            {/* メトリクスカードグリッド（手入力の実データ集計） */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: '合計PV数', value: noteStats ? String(noteStats.totalViews) : '—', icon: TrendingUp, color: 'text-indigo-700', bg: 'from-indigo-500/10' },
                { name: '合計スキ数', value: noteStats ? String(noteStats.totalLikes) : '—', icon: Heart, color: 'text-rose-700', bg: 'from-rose-500/10' },
                { name: '合計売上', value: noteStats ? `¥${noteStats.totalSalesAmount.toLocaleString()}` : '—', icon: Users, color: 'text-emerald-700', bg: 'from-emerald-500/10' },
                { name: '公開済み記事数', value: noteStats ? `${noteStats.publishedCount}本` : '—', icon: Layers, color: 'text-blue-700', bg: 'from-blue-500/10' }
              ].map((m, idx) => (
                <div key={idx} className="glass-panel rounded-3xl p-6 border border-black/5 bg-gradient-to-br to-transparent relative overflow-hidden group hover:border-black/10 transition-colors">
                  <div className={`absolute top-0 left-0 w-24 h-24 bg-gradient-to-br ${m.bg} to-transparent rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform`}></div>
                  <div className="flex justify-between items-center mb-4 relative z-10">
                    <span className="text-xs text-stone-500 font-bold">{m.name}</span>
                    <m.icon className={`${m.color} bg-black/[0.03] p-2 rounded-xl border border-black/5`} size={36} />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-3xl font-black text-stone-900 tracking-tight font-mono">{m.value}</h3>
                  </div>
                </div>
              ))}
            </motion.div>
            <p className="text-[10px] text-stone-500 -mt-2">
              ※ noteに公式APIが無いため、上記は「✍️ 記事下書きプレビュー」タブで公開済み記事に手入力した閲覧数・スキ・売上の合計です。
            </p>

            {/* 反応の良い記事 TOP5（今後の執筆の参考にする） */}
            <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-6 border border-black/5 bg-black/[0.03]">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-black/5">
                <Heart className="text-rose-700 bg-rose-100 p-2 rounded-xl border border-rose-200" size={36} />
                <div>
                  <h3 className="text-lg font-black text-stone-900">🏆 反応の良い記事 TOP5</h3>
                  <p className="text-[10px] text-stone-500 font-bold">閲覧数が多い記事。傾向を次の記事の参考にする</p>
                </div>
              </div>
              {!noteStats || noteStats.topByViews.length === 0 ? (
                <p className="text-sm text-stone-500 text-center py-6">公開済みで閲覧数を入力した記事がまだありません。</p>
              ) : (
                <div className="space-y-2">
                  {noteStats.topByViews.map((a, idx) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 bg-black/[0.03] p-3 rounded-xl border border-black/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-black text-stone-500 w-5 shrink-0">#{idx + 1}</span>
                        <div className="min-w-0">
                          {a.note_url ? (
                            <a href={a.note_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-stone-800 hover:text-indigo-600 hover:underline truncate block">{a.title}</a>
                          ) : (
                            <span className="text-sm font-bold text-stone-800 truncate block">{a.title}</span>
                          )}
                          {a.champion && <span className="text-[10px] text-stone-500">{a.champion}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-stone-500 shrink-0 font-mono">
                        <span>👁️ {a.views ?? 0}</span>
                        <span>❤️ {a.likes ?? 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* 旧レポート(note_analytics_daemon.py出力)。廃止済みのため参考程度に残すのみ */}
            {reports.length > 0 && (
              <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-6 border border-black/5 bg-black/[0.03]">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5">
                  <FileText className="text-indigo-700 bg-indigo-100 p-2 rounded-xl border border-indigo-200" size={36} />
                  <div>
                    <h3 className="text-lg font-black text-stone-900">📋 過去のレポート ({selectedReport?.date})</h3>
                    <p className="text-[10px] text-stone-500 font-bold">{selectedReport?.fileName}（旧スクレイピング方式・廃止済み。参考用に表示のみ）</p>
                  </div>
                </div>

                {actionPlan && (
                  <div className="bg-black/[0.05] rounded-2xl border border-black/5 p-4 text-sm leading-relaxed text-stone-700 whitespace-pre-wrap font-sans mb-6 flex items-start gap-3">
                    <Lightbulb className="text-yellow-600 shrink-0 mt-0.5" size={18} />
                    <div>{actionPlan}</div>
                  </div>
                )}

                <div className="prose max-w-none text-sm leading-relaxed text-stone-700 space-y-6">
                  {renderMarkdown(mainContent)}
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          // === 記事下書きプレビュー表示エリア ===
          drafts.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 border border-black/5 text-center bg-black/[0.03] max-w-xl mx-auto mt-16">
              <AlertCircle size={48} className="text-amber-600 mx-auto mb-4 animate-bounce" />
              <h3 className="text-xl font-black text-stone-900 mb-2">下書き原稿が見つかりません</h3>
              <p className="text-xs text-stone-600 leading-relaxed mb-6">
                `note_articles` テーブルにまだ記事が投入されていません。sovereign-factory等のスキルでnote記事を書くと、ここに自動で表示されます。
              </p>
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-6"
            >
              {/* 配信スケジュール: 予定日が入っている下書きを直近順に一覧表示 */}
              {drafts.some(d => d.scheduled_at) && (
                <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-4 border border-black/5 bg-black/[0.03]">
                  <h3 className="text-sm font-black text-stone-900 mb-3 flex items-center gap-2">📅 配信スケジュール</h3>
                  <div className="space-y-1.5">
                    {[...drafts]
                      .filter(d => d.scheduled_at)
                      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
                      .map(d => (
                        <button
                          key={d.id}
                          onClick={() => setSelectedDraft(d)}
                          className="w-full flex items-center justify-between gap-3 bg-black/[0.03] hover:bg-black/5 p-2.5 rounded-xl border border-black/5 text-left transition-colors"
                        >
                          <span className="text-xs font-bold text-stone-800 truncate">{d.title}</span>
                          <span className="text-xs font-mono text-indigo-700 shrink-0">{new Date(d.scheduled_at!).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}</span>
                        </button>
                      ))}
                  </div>
                </motion.div>
              )}

              <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-6 border border-black/5 bg-black/[0.03]">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-black/5">
                  <div className="flex items-center gap-3">
                    <FileText className="text-indigo-700 bg-indigo-100 p-2 rounded-xl border border-indigo-200" size={36} />
                    <div>
                      <h3 className="text-lg font-black text-stone-900">✍️ {selectedDraft?.title}</h3>
                      <p className="text-[10px] text-stone-500 font-bold flex items-center gap-2">
                        {selectedDraft?.champion && <span>{selectedDraft.champion}</span>}
                        {selectedDraft?.patch && <span>Patch {selectedDraft.patch}</span>}
                        <span className="px-2 py-0.5 rounded-full bg-black/[0.03] border border-black/10">{selectedDraft?.status}</span>
                        {selectedDraft?.source_skill && <span>via {selectedDraft.source_skill}</span>}
                      </p>
                    </div>
                  </div>

                  {selectedDraft && (
                    <button
                      onClick={() => copyToClipboard(`${selectedDraft.content_free || ''}\n\n---\n✂️ ここから有料 ✂️\n---\n\n${selectedDraft.content_paid || ''}`)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-black/5 hover:border-black/10 transition-all text-xs font-bold ${
                        isCopied
                          ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                          : 'bg-black/[0.03] hover:bg-black/5 text-stone-700 hover:text-stone-900'
                      }`}
                    >
                      {isCopied ? <CheckCircle size={14} /> : <Copy size={14} />}
                      {isCopied ? 'コピー完了！' : '原稿をコピー'}
                    </button>
                  )}
                </div>

                {/* 公開管理・成績（手入力）。noteに公式APIが無いため手入力方式。 */}
                {selectedDraft && (
                  <div className="mb-6 glass-panel rounded-2xl p-4 border border-black/5 bg-black/[0.03] space-y-4">
                    {selectedDraft.status === 'published' ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold">公開済み</span>
                            {selectedDraft.note_url && (
                              <a href={selectedDraft.note_url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline truncate max-w-xs">
                                {selectedDraft.note_url}
                              </a>
                            )}
                            {selectedDraft.published_at && (
                              <span className="text-stone-500">公開日: {new Date(selectedDraft.published_at).toLocaleDateString('ja-JP')}</span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {([
                            ['views', '閲覧数'],
                            ['likes', 'スキ'],
                            ['sales_count', '販売数'],
                            ['sales_amount', '売上(円)'],
                          ] as const).map(([key, label]) => (
                            <div key={key}>
                              <label className="text-[10px] text-stone-500 block mb-1">{label}</label>
                              <input
                                type="number"
                                value={metricsInput[key]}
                                onChange={(e) => setMetricsInput((p) => ({ ...p, [key]: e.target.value }))}
                                className="w-full bg-white border border-black/10 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 outline-none focus:border-indigo-500/50"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={saveMetrics}
                            disabled={savingMetrics}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {savingMetrics ? '更新中...' : '成績を更新'}
                          </button>
                          {selectedDraft.metrics_updated_at && (
                            <span className="text-[10px] text-stone-500">最終更新: {new Date(selectedDraft.metrics_updated_at).toLocaleString('ja-JP')}</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs text-stone-600 font-bold shrink-0">配信予定日:</span>
                        <input
                          type="date"
                          value={scheduledInput}
                          onChange={(e) => setScheduledInput(e.target.value)}
                          className="bg-white border border-black/10 rounded-lg px-3 py-1.5 text-xs text-stone-800 outline-none focus:border-indigo-500/50"
                        />
                        <button
                          onClick={saveSchedule}
                          disabled={savingSchedule}
                          className="px-4 py-2 rounded-xl bg-black/[0.03] hover:bg-black/5 border border-black/10 text-stone-600 hover:text-stone-900 text-xs font-bold transition-all disabled:opacity-50 shrink-0"
                        >
                          {savingSchedule ? '保存中...' : '予定日を保存'}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs text-stone-600 font-bold shrink-0">noteに公開したら記録:</span>
                        <input
                          type="url"
                          placeholder="https://note.com/..."
                          value={noteUrlInput}
                          onChange={(e) => setNoteUrlInput(e.target.value)}
                          className="flex-1 min-w-[200px] bg-white border border-black/10 rounded-lg px-3 py-1.5 text-xs text-stone-800 outline-none focus:border-indigo-500/50"
                        />
                        <button
                          onClick={markPublished}
                          disabled={savingPublish || !noteUrlInput.trim()}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-50 shrink-0"
                        >
                          {savingPublish ? '登録中...' : '公開済みにする'}
                        </button>
                      </div>
                      </div>
                    )}
                    {publishMsg && <p className="text-xs">{publishMsg}</p>}
                  </div>
                )}

                {/* Markdownプレビュー表示（無料/有料を分けて表示） */}
                {selectedDraft && (
                  <div className="prose max-w-none text-sm leading-relaxed text-stone-700 space-y-6">
                    {renderMarkdown(selectedDraft.content_free || '')}
                    {selectedDraft.content_paid && (
                      <>
                        <div className="my-6 text-center text-[10px] font-bold text-amber-700 tracking-widest border-t border-b border-amber-200 py-2">
                          ✂️ ここから有料部分 ✂️
                        </div>
                        {renderMarkdown(selectedDraft.content_paid)}
                      </>
                    )}
                    {selectedDraft.promo_text && (
                      <div className="mt-8 glass-panel rounded-2xl p-4 border border-black/5 bg-black/[0.03]">
                        <h4 className="text-xs font-black text-stone-600 mb-2">📱 X投稿用</h4>
                        <p className="text-xs text-stone-600 whitespace-pre-wrap font-mono">{selectedDraft.promo_text}</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )
        )}
      </main>
    </div>
  );
}
