'use client';

import { useState } from 'react';
import { RefreshCw, AlertTriangle, Sparkles, Globe, BookOpen } from 'lucide-react';

/**
 * 辞典のAI支援パネル。
 *  - 矛盾検出: 辞典の主張（苦手/BAN推奨）と実戦データ(matchup_log)の食い違いを洗い出す
 *  - メモ要約: 散らばった対面メモを「このチャンプの要点」に集約
 */
export default function DictInsightsPanel() {
  const [issues, setIssues] = useState<any[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [champion, setChampion] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 自動リサーチ（OP.GG）
  const [researchChamp, setResearchChamp] = useState('');
  const [researchRole, setResearchRole] = useState('JG');
  const [research, setResearch] = useState<any>(null);
  const [researching, setResearching] = useState(false);

  // 汎用原則の生成
  const [genning, setGenning] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<any>(null);
  const genPrinciple = async (theme: string) => {
    setGenning(theme); setError(null); setGenResult(null);
    try {
      const res = await fetch('/api/admin/principles', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '生成に失敗しました');
      setGenResult(d);
    } catch (e: any) { setError(e.message); } finally { setGenning(null); }
  };

  const runResearch = async (save: boolean) => {
    if (!researchChamp.trim()) return;
    setResearching(true); setError(null);
    if (!save) setResearch(null);
    try {
      const res = await fetch('/api/admin/dict-research', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champion: researchChamp.trim(), role: researchRole, save }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'リサーチに失敗しました');
      setResearch(d);
    } catch (e: any) { setError(e.message); } finally { setResearching(false); }
  };

  const call = async (body: any) => {
    const res = await fetch('/api/admin/dict-insights', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || '失敗しました');
    return d;
  };

  const checkContradiction = async () => {
    setChecking(true); setError(null);
    try {
      const d = await call({ kind: 'contradiction' });
      setIssues(d.issues);
    } catch (e: any) { setError(e.message); } finally { setChecking(false); }
  };

  const runSummarize = async () => {
    if (!champion.trim()) return;
    setSummarizing(true); setError(null); setSummary(null);
    try {
      const d = await call({ kind: 'summarize', champion: champion.trim() });
      setSummary(d);
    } catch (e: any) { setError(e.message); } finally { setSummarizing(false); }
  };

  const typeLabel: Record<string, { label: string; cls: string }> = {
    counter_but_winning: { label: '苦手と書いてあるが勝ってる', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
    ban_but_dominating: { label: 'BAN推奨だが圧倒してる', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
    losing_but_unlisted: { label: '苦戦してるが辞典に記載なし', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>}

      {/* 矛盾検出 */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className="font-black text-white flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" /> 辞典の矛盾検出
          </h3>
          <button onClick={checkContradiction} disabled={checking}
            className="flex items-center gap-1.5 text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/25 disabled:opacity-50">
            {checking ? <RefreshCw size={13} className="animate-spin" /> : <AlertTriangle size={13} />} 検出実行
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">辞典の「苦手対面」「BAN推奨」と、実際のカスタム戦績を突き合わせて食い違いを探します（3戦以上のみ対象）。</p>
        {issues === null ? (
          <p className="text-xs text-gray-600">「検出実行」を押すと結果が出ます。</p>
        ) : issues.length === 0 ? (
          <p className="text-xs text-emerald-400">✅ 矛盾は見つかりませんでした。</p>
        ) : (
          <div className="space-y-2">
            {issues.map((it, i) => (
              <div key={i} className={`rounded-xl border px-3 py-2 ${typeLabel[it.type]?.cls || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-black">{it.champion} vs {it.enemy}</span>
                  <span className="text-[10px] opacity-70">{typeLabel[it.type]?.label}</span>
                  <span className="ml-auto font-mono text-[10px]">{it.games}戦 / {it.winRate}%</span>
                </div>
                <p className="text-[11px] opacity-90 mt-1">{it.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 汎用原則の生成 */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-black text-white flex items-center gap-2 mb-3">
          <BookOpen size={16} className="text-emerald-400" /> 上達の原則を生成
        </h3>
        <p className="text-[11px] text-gray-500 mb-3">
          辞典・メモから<strong className="text-emerald-300">チャンピオン固有の話を除いた</strong>「判断・マクロ・考え方」だけを抽出し、テーマ別の読み物を作ります。
          生成結果は <a href="/principles" className="text-emerald-400 hover:underline">上達の原則ページ</a> で全メンバーが読めます。
        </p>
        <div className="flex gap-2 flex-wrap">
          {([
            ['macro', 'マクロ・試合運び'], ['laning', 'レーン戦'], ['objective', 'オブジェクト/集団戦'],
            ['vision', '視界とマップ'], ['mindset', '判断力・メンタル'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => genPrinciple(key)} disabled={!!genning}
              className="text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-lg hover:bg-emerald-500/25 disabled:opacity-50">
              {genning === key ? '生成中...' : label}
            </button>
          ))}
        </div>
        {genResult && (
          <div className="mt-3 text-xs bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-emerald-300 font-black mb-1">✅ {genResult.principle?.title}</p>
            <p className="text-gray-500 text-[10px] mb-2">{genResult.sourceCount}件の素材から生成しました</p>
            <div className="text-gray-300 whitespace-pre-wrap max-h-60 overflow-y-auto">{genResult.principle?.body}</div>
          </div>
        )}
      </div>

      {/* 自動リサーチ（OP.GG） */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-black text-white flex items-center gap-2 mb-3">
          <Globe size={16} className="text-cyan-400" /> 自動リサーチ（LoLalytics統計）
        </h3>
        <p className="text-[11px] text-gray-500 mb-3">現パッチの勝率・ティア順位・得意/苦手対面・コアビルド・オブジェクト傾向を取得し、辞典の下書きを作ります。</p>
        <div className="flex gap-2 mb-3 flex-wrap">
          <input value={researchChamp} onChange={e => setResearchChamp(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runResearch(false); }}
            placeholder="チャンピオン名（英語ID 例: Graves）"
            className="flex-1 min-w-[180px] bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
          <select value={researchRole} onChange={e => setResearchRole(e.target.value)}
            className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
            {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={() => runResearch(false)} disabled={researching || !researchChamp.trim()}
            className="flex items-center gap-1.5 text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-4 py-2 rounded-lg hover:bg-cyan-500/25 disabled:opacity-50">
            {researching ? <RefreshCw size={13} className="animate-spin" /> : <Globe size={13} />} リサーチ
          </button>
        </div>
        {research && (
          <div className="space-y-2 text-xs bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-cyan-300 font-black">🌐 {research.champion}</span>
              {research.patch && <span className="text-[10px] text-gray-500">Patch {research.patch}</span>}
              {research.tier && <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded font-bold">{research.tier}</span>}
              {research.rank && <span className="text-[10px] text-gray-400">順位 {research.rank}</span>}
            </div>
            <div className="flex gap-4 flex-wrap text-[11px]">
              {research.winRate && <span>勝率 <b className="text-emerald-400">{research.winRate}</b></span>}
              {research.pickRate && <span>ピック率 <b className="text-sky-400">{research.pickRate}</b></span>}
              {research.banRate && <span>BAN率 <b className="text-rose-400">{research.banRate}</b></span>}
              {research.expertWinRate && <span>上位帯 <b className="text-amber-400">{research.expertWinRate}</b></span>}
            </div>
            {([
              ['強み', research.strengths], ['弱み', research.weaknesses],
              ['パワースパイク', research.power_spikes], ['ビルド/ルーン', research.build_runes],
              ['苦手対面', research.counter_champions], ['得意対面', research.strong_against],
              ['オブジェクト傾向', research.objectives], ['総評', research.summary],
            ] as const).filter(([, v]) => v).map(([label, val]) => (
              <div key={label}><span className="text-gray-500">{label}: </span><span className="text-gray-300">{val}</span></div>
            ))}
            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              <button onClick={() => runResearch(true)} disabled={researching}
                className="text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg disabled:opacity-50">
                この内容で辞典に保存
              </button>
              {research.saved && <span className="text-emerald-400 text-[11px]">✅ 保存しました</span>}
              {research.sourceUrl && <a href={research.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-gray-500 hover:text-cyan-400 ml-auto">出典を開く ↗</a>}
            </div>
          </div>
        )}
      </div>

      {/* メモの自動要約 */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-black text-white flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-indigo-400" /> 対面メモの自動要約
        </h3>
        <p className="text-[11px] text-gray-500 mb-3">そのチャンピオンの対面メモをまとめて読み込み、共通する要点・繰り返す失敗パターンを抽出します。</p>
        <div className="flex gap-2 mb-3">
          <input value={champion} onChange={e => setChampion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runSummarize(); }}
            placeholder="チャンピオン名（英語ID 例: Graves）"
            className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
          <button onClick={runSummarize} disabled={summarizing || !champion.trim()}
            className="flex items-center gap-1.5 text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-4 py-2 rounded-lg hover:bg-indigo-500/25 disabled:opacity-50">
            {summarizing ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />} 要約
          </button>
        </div>
        {summary && (
          <div className="space-y-3 text-xs bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
            <p className="text-indigo-300 font-black">📝 {summary.champion} の要点（メモ{summary.memoCount}件から集約）</p>
            {summary.summary && <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">{summary.summary}</div>}
            {summary.commonMistakes && (
              <div className="border-t border-white/5 pt-2">
                <span className="text-rose-300 font-bold">⚠️ 繰り返す失敗: </span>
                <span className="text-gray-300">{summary.commonMistakes}</span>
              </div>
            )}
            {Array.isArray(summary.keyTips) && summary.keyTips.length > 0 && (
              <div className="border-t border-white/5 pt-2">
                <p className="text-emerald-300 font-bold mb-1">✨ 重要な指針</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-300">
                  {summary.keyTips.map((t: string, i: number) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
