"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getChampIcon } from '../../../lib/ddragonClient';
import { Shield, Target, ChevronLeft, ChevronDown, ChevronUp, Swords, Plus, X, Save, Trash2, Activity, Award, Zap, AlertCircle, CheckCircle, ArrowLeftRight, History, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import ChampSelect from '../../../components/ChampSelect';
import { Spinner } from '../../../components/Feedback';

const EMPTY_MEMO = {
  champion: '', enemy: '', role: 'Jungle', title: '',
  difficulty: 3, winCondition: '', earlyGame: '', powerSpikes: '',
  buildRunes: '', firstClear: '', counterJg: '', result: '',
  strategy: '', csd15: 0,
};

export default function MatchupTab() {
  const [matchups, setMatchups] = useState<any[]>([]);
  const [mySearch, setMySearch] = useState('');
  const [enemySearch, setEnemySearch] = useState('');
  const [sortOrder, setSortOrder] = useState('updated_desc');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [memo, setMemo] = useState<any>({ ...EMPTY_MEMO });
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL'); // ALL | Win | Lose
  const [difficultyFilter, setDifficultyFilter] = useState(0); // 0=ALL, 1..5
  const [champMap, setChampMap] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'list' | 'champion'>('list');
  const [expandedChamp, setExpandedChamp] = useState<string | null>(null);
  const [paramsProcessed, setParamsProcessed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [champStats, setChampStats] = useState<Record<string, any>>({});
  const [champFacts, setChampFacts] = useState<Record<string, any>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('matchup_sentinel')
        .select('id, matchup_id, champion, enemy, role, title, strategy, raw_data, created_at')
        .neq('enemy', 'GLOBAL')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      setMatchups((data || []).filter((m: any) => m.champion && m.enemy && m.enemy !== 'GLOBAL'));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    fetch('/api/champions/stats')
      .then(r => r.json())
      .then(data => {
        if (data.success) setChampStats(data.stats);
      })
      .catch(console.error);

    supabase.from('champion_facts')
      .select('champion, weaknesses, power_spikes, counter_champions, must_ban_champions')
      .eq('archived', false)
      .then(({ data }: { data: any[] | null }) => {
        if (data) {
          const fm: Record<string, any> = {};
          data.forEach((f: any) => { fm[String(f.champion).toLowerCase()] = f; });
          setChampFacts(fm);
        }
      });

    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(r => r.json())
      .then(versions => fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/ja_JP/champion.json`))
      .then(r => r.json())
      .then(d => {
        const m: Record<string, string> = {};
        Object.values(d.data).forEach((c: any) => m[c.id.toLowerCase()] = c.name);
        setChampMap(m);
      }).catch(console.error);
  }, []);

  useEffect(() => {
    if (loading || paramsProcessed || matchups.length === 0) return;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const champParam = params.get('champion');
      const enemyParam = params.get('enemy');

      if (champParam || enemyParam) {
        setParamsProcessed(true);
        if (champParam) setMySearch(champParam);
        if (enemyParam) setEnemySearch(enemyParam);

        const found = matchups.find(
          m =>
            m.champion?.toLowerCase() === champParam?.toLowerCase() &&
            m.enemy?.toLowerCase() === enemyParam?.toLowerCase()
        );

        if (found) {
          handleEdit(found);
        } else {
          setMemo({
            ...EMPTY_MEMO,
            champion: champParam || '',
            enemy: enemyParam || '',
            role: 'Jungle',
            title: `${champParam || ''} vs ${enemyParam || ''} (Jungle)`,
            difficulty: 3,
            winCondition: '',
            earlyGame: '',
            powerSpikes: '',
            buildRunes: '',
            firstClear: '',
            counterJg: '',
            result: '',
            strategy: '',
          });
          setShowForm(true);
        }
      }
    }
  }, [loading, matchups, paramsProcessed]);

  const isMatch = useCallback((name: string, q: string) => {
    if (!q.trim()) return true;
    if (!name) return false;
    const lowerN = name.toLowerCase();
    const lowerQ = q.toLowerCase();
    if (lowerN.includes(lowerQ)) return true;
    const jpName = champMap[lowerN.replace(/[^a-z0-9]/g, '')] || '';
    if (jpName.includes(lowerQ)) return true;
    const hiraToKata = lowerQ.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
    return jpName.includes(hiraToKata);
  }, [champMap]);

  const applyRoleFilter = useCallback((list: any[]) => {
    if (roleFilter === 'ALL') return list;
    return list.filter(m => {
      let role = (m.raw_data?.role || m.role || 'UNKNOWN').toUpperCase();
      if (role === 'UTILITY') role = 'SUPPORT';
      if (role === 'BOTTOM') role = 'BOT';
      return role === roleFilter;
    });
  }, [roleFilter]);

  const results = useMemo(() => {
    let filtered = matchups.filter(m => isMatch(m.champion, mySearch) && isMatch(m.enemy, enemySearch));
    if (resultFilter !== 'ALL') filtered = filtered.filter(m => String(m.raw_data?.result || '').toLowerCase() === resultFilter.toLowerCase());
    if (difficultyFilter > 0) filtered = filtered.filter(m => (m.raw_data?.difficulty || 0) === difficultyFilter);
    filtered.sort((a, b) => {
      if (sortOrder === 'updated_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOrder === 'updated_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortOrder === 'difficulty_desc') return (b.raw_data?.difficulty || 0) - (a.raw_data?.difficulty || 0);
      if (sortOrder === 'difficulty_asc') return (a.raw_data?.difficulty || 0) - (b.raw_data?.difficulty || 0);
      return 0;
    });
    return applyRoleFilter(filtered);
  }, [mySearch, enemySearch, matchups, isMatch, sortOrder, applyRoleFilter, resultFilter, difficultyFilter]);

  const championGroups = useMemo(() => {
    const filtered = applyRoleFilter(
      matchups.filter(m => {
        if (!mySearch.trim()) return true;
        return isMatch(m.champion, mySearch);
      })
    );
    const groups: Record<string, any[]> = {};
    filtered.forEach(m => {
      if (!groups[m.champion]) groups[m.champion] = [];
      groups[m.champion].push(m);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [matchups, mySearch, isMatch, applyRoleFilter]);

  const set = (k: string, v: any) => setMemo((p: any) => ({ ...p, [k]: v }));

  const [aiDrafting, setAiDrafting] = useState(false);
  const generateDraft = async () => {
    if (!memo.champion || !memo.enemy) { alert('自分と相手のチャンピオンを入力してください'); return; }
    setAiDrafting(true);
    try {
      const res = await fetch('/api/matchup/draft', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champion: memo.champion, enemy: memo.enemy, role: memo.role }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || '生成に失敗しました');
      setMemo((p: any) => ({
        ...p,
        winCondition: d.draft.winCondition || p.winCondition,
        earlyGame: d.draft.earlyGame || p.earlyGame,
        powerSpikes: d.draft.powerSpikes || p.powerSpikes,
        buildRunes: d.draft.buildRunes || p.buildRunes,
        counterJg: d.draft.counterJg || p.counterJg,
      }));
      setShowDetails(true);
    } catch (e: any) {
      alert('AI下書きに失敗: ' + e.message);
    } finally {
      setAiDrafting(false);
    }
  };
  
  const saveMemo = async () => {
    if (!memo.champion || !memo.enemy) return alert('チャンピオン名を入力してください');
    setSaving(true);
    
    const mergedRawData = memo.original_raw_data ? { ...memo.original_raw_data, ...memo } : { source: 'manual', ...memo };
    delete mergedRawData.original_raw_data;
    delete mergedRawData.id;
    delete mergedRawData.matchup_id;
    delete mergedRawData.created_at;

    const data = {
      champion: memo.champion, enemy: memo.enemy,
      title: memo.title || `${memo.champion} vs ${memo.enemy} (${memo.role})`,
      strategy: memo.strategy, raw_data: mergedRawData,
      matchup_id: memo.matchup_id || `manual_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
  
    const { error } = await supabase.from('matchup_sentinel').upsert(data, { onConflict: 'matchup_id' });
    if (!error) { fetchData(); setMemo({ ...EMPTY_MEMO }); setShowForm(false); setShowDetails(false); } 
    else alert('保存失敗: ' + error.message);
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('このマッチアップメモを完全に削除しますか？')) return;
    const { error } = await supabase.from('matchup_sentinel').delete().eq('id', id);
    if (!error) { setMatchups(prev => prev.filter(m => m.id !== id)); setSelected(null); }
  };

  const handleEdit = (m: any) => {
    const rd = m.raw_data || {};
    let rl = (rd.role || m.role || 'Jungle').toUpperCase();
    if (rl === 'UTILITY') rl = 'Support'; else if (rl === 'BOTTOM') rl = 'Bot';
    else rl = rl.charAt(0) + rl.slice(1).toLowerCase();

    setMemo({
      id: m.id, matchup_id: m.matchup_id, original_raw_data: rd,
      champion: m.champion, enemy: m.enemy, role: rl, title: m.title, difficulty: rd.difficulty || 3,
      winCondition: rd.winCondition || '', earlyGame: rd.earlyGame || '',
      firstClear: rd.firstClear || '', counterJg: rd.counterJg || '', powerSpikes: rd.powerSpikes || '',
      buildRunes: rd.buildRunes || '', result: rd.result || '', strategy: m.strategy || '',
      csd15: rd.csd15 !== undefined ? rd.csd15 : 0
    });
    setShowForm(true); setSelected(null);
  };

  const [periodDays, setPeriodDays] = useState(0);
  const [pairStats, setPairStats] = useState<any>(null);
  const [weakList, setWeakList] = useState<any[] | null>(null);
  const [recentMatchups, setRecentMatchups] = useState<any[] | null>(null);

  useEffect(() => {
    if (!mySearch || !enemySearch) { setPairStats(null); return; }
    const ctrl = new AbortController();
    fetch(`/api/matchup/insights?kind=pair&my=${encodeURIComponent(mySearch)}&enemy=${encodeURIComponent(enemySearch)}&days=${periodDays}`, { signal: ctrl.signal })
      .then(r => r.json()).then(d => { if (d.success) setPairStats(d); }).catch(() => {});
    return () => ctrl.abort();
  }, [mySearch, enemySearch, periodDays]);

  useEffect(() => {
    if (weakList === null) {
      fetch(`/api/matchup/insights?kind=weak&days=${periodDays}`).then(r => r.json())
        .then(d => setWeakList(d.success ? d.weak : [])).catch(() => setWeakList([]));
    }
    if (recentMatchups === null) {
      fetch('/api/matchup/insights?kind=recent').then(r => r.json())
        .then(d => setRecentMatchups(d.success ? d.recent : [])).catch(() => setRecentMatchups([]));
    }
  }, []);

  useEffect(() => { setWeakList(null); }, [periodDays]);

  const startMemoFromLog = (m: any) => {
    setMySearch(m.my || '');
    setEnemySearch(m.enemy || '');
    setMemo({ ...EMPTY_MEMO, champion: m.my || '', enemy: m.enemy || '', role: m.role || 'TOP' });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ビュー切替 & 5v5シミュレータ案内リンク */}
      <div className="flex items-center justify-between flex-wrap gap-4 glass-panel p-4 rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-[#00cfef] text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            対面メモ一覧 ({matchups.length})
          </button>
          <button
            onClick={() => setViewMode('champion')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'champion' ? 'bg-[#00cfef] text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            チャンピオン別
          </button>
        </div>
        <Link href="/matchups" className="text-sm font-bold text-[#a78bfa] hover:text-white transition-colors flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#a78bfa]/10 border border-[#a78bfa]/20">
          <Zap size={16} /> 5v5 AIシミュレータへ →
        </Link>
      </div>

      {/* 検索・フィルター領域 */}
      <div className="glass-panel p-4 md:p-6 rounded-2xl flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <ChampSelect value={mySearch} onChange={setMySearch} placeholder="自分: キーワード/チャンプ" className="w-full" />
          </div>
          <span className="text-gray-500 font-bold">vs</span>
          <div className="flex-1 min-w-[200px]">
            <ChampSelect value={enemySearch} onChange={setEnemySearch} placeholder="相手: キーワード/チャンプ" className="w-full" />
          </div>
          <button
            onClick={() => {
              setMemo({
                ...EMPTY_MEMO,
                champion: mySearch || '',
                enemy: enemySearch || '',
                role: 'Jungle',
                title: `${mySearch || ''} vs ${enemySearch || ''} (Jungle)`,
              });
              setShowForm(true);
            }}
            className="px-5 py-3 bg-[#00cfef] text-black font-black rounded-xl hover:shadow-[0_0_20px_rgba(0,207,239,0.4)] transition-all flex items-center gap-2 text-sm shrink-0"
          >
            <Plus size={18} /> 新規メモ作成
          </button>
        </div>
      </div>

      {/* メモ入力フォーム Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
          <div className="glass-panel p-6 md:p-8 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Swords className="text-[#00cfef]" /> {memo.id ? 'マッチアップメモを編集' : '新規マッチアップメモ作成'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">自分のチャンピオン</label>
                <ChampSelect value={memo.champion} onChange={v => set('champion', v)} placeholder="Yone" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">相手のチャンピオン</label>
                <ChampSelect value={memo.enemy} onChange={v => set('enemy', v)} placeholder="Yasuo" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={generateDraft}
                disabled={aiDrafting}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                {aiDrafting ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />} AI下書きを自動生成
              </button>
              <button onClick={() => setShowDetails(!showDetails)} className="text-xs text-gray-400 hover:text-white underline">
                {showDetails ? '詳細入力をたたむ' : '詳細入力項目を開く'}
              </button>
            </div>

            {showDetails && (
              <div className="space-y-4 pt-2 border-t border-white/5">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">勝利条件 (Win Condition)</label>
                  <textarea value={memo.winCondition} onChange={e => set('winCondition', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none h-20" placeholder="序盤のウェーブ管理とLv6でのオールイン..." />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">序盤の立ち回り (Early Game)</label>
                  <textarea value={memo.earlyGame} onChange={e => set('earlyGame', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none h-20" placeholder="Lv3トレードでのスキル回し..." />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">立ち回り・フリーメモ (Markdown)</label>
              <textarea value={memo.strategy} onChange={e => set('strategy', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none h-32" placeholder="詳細な攻略メモ..." />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl glass-panel text-gray-400 hover:text-white text-sm font-bold">キャンセル</button>
              <button onClick={saveMemo} disabled={saving} className="px-6 py-2.5 rounded-xl bg-[#00cfef] text-black font-black text-sm hover:shadow-[0_0_15px_rgba(0,207,239,0.4)] flex items-center gap-2">
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />} 保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* リスト・一覧表示 */}
      {loading ? (
        <Spinner label="マッチアップメモを読み込み中..." />
      ) : viewMode === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((m: any) => (
            <div key={m.id} className="glass-panel glass-panel-hover p-5 rounded-2xl flex flex-col justify-between gap-4 relative group border-t-2 border-white/5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img src={getChampIcon(m.champion)} alt={m.champion} className="w-10 h-10 rounded-full border border-[#00cfef]" />
                  <span className="text-xs font-black text-gray-500">VS</span>
                  <img src={getChampIcon(m.enemy)} alt={m.enemy} className="w-10 h-10 rounded-full border border-rose-500" />
                  <div>
                    <h4 className="text-sm font-bold text-white">{m.champion} vs {m.enemy}</h4>
                    <span className="text-[10px] text-gray-500 font-mono">{m.role}</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(m)} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white"><Shield size={14} /></button>
                  <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"><Trash2 size={14} /></button>
                </div>
              </div>

              {m.strategy && (
                <div className="text-xs text-gray-300 line-clamp-3 bg-black/20 p-3 rounded-xl border border-white/5">
                  <ReactMarkdown>{m.strategy}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* チャンピオン別グループ表示 */
        <div className="space-y-4">
          {championGroups.map(([champName, list]) => (
            <div key={champName} className="glass-panel p-5 rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                <img src={getChampIcon(champName)} alt={champName} className="w-10 h-10 rounded-full border border-[#00cfef]" />
                <h3 className="text-base font-bold text-white">{champName} <span className="text-xs text-gray-400">({list.length}件の対面)</span></h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((m: any) => (
                  <div key={m.id} onClick={() => handleEdit(m)} className="p-3 rounded-xl bg-black/30 border border-white/5 hover:border-[#00cfef]/30 cursor-pointer flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={getChampIcon(m.enemy)} alt={m.enemy} className="w-8 h-8 rounded-full border border-rose-500/40" />
                      <span className="text-xs font-bold text-gray-200">vs {m.enemy}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{new Date(m.created_at).toLocaleDateString('ja-JP')}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
