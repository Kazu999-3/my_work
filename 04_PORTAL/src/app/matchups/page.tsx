"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getChampIcon } from '../../lib/ddragonClient';
import { Shield, Target, ChevronLeft, ChevronDown, ChevronUp, Swords, Plus, X, Save, Trash2, Activity, Award, Zap, AlertCircle, CheckCircle, ArrowLeftRight, History, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import ChampSelect from '../../components/ChampSelect';

const EMPTY_MEMO = {
  champion: '', enemy: '', role: 'Jungle', title: '',
  difficulty: 3, winCondition: '', earlyGame: '', powerSpikes: '',
  buildRunes: '', firstClear: '', counterJg: '', result: '',
  strategy: '', csd15: 0,
};

export default function MatchupsPage() {
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
  const [viewMode, setViewMode] = useState<'list' | 'champion' | 'simulator'>('list');
  const [expandedChamp, setExpandedChamp] = useState<string | null>(null);
  const [paramsProcessed, setParamsProcessed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [champStats, setChampStats] = useState<Record<string, any>>({});
  // 相手チャンプの辞典データ（弱点・カウンター等）。メモが無くても即座に対策を出すため(即戦力)。
  const [champFacts, setChampFacts] = useState<Record<string, any>>({});

  // 5v5 AIシミュレータ用ステート
  const [blueChamps, setBlueChamps] = useState<Record<string, string>>({
    TOP: '', JG: '', MID: '', BOT: '', SUP: ''
  });
  const [redChamps, setRedChamps] = useState<Record<string, string>>({
    TOP: '', JG: '', MID: '', BOT: '', SUP: ''
  });
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<any>(null);
  const [simStatus, setSimStatus] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('matchup_sentinel').select('*').order('created_at', { ascending: false });
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

    // 辞典の弱点・カウンター情報を軽量に取得（相手対策の即時表示用）
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

  // URLパラメータ（champion, enemy）の連携処理
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

        // 既存のマッチアップを検索
        const found = matchups.find(
          m =>
            m.champion?.toLowerCase() === champParam?.toLowerCase() &&
            m.enemy?.toLowerCase() === enemyParam?.toLowerCase()
        );

        if (found) {
          handleEdit(found);
        } else {
          // 新規作成フォームをパラメータ付きで開く
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

  // チャンピオン名マッチング（一覧・チャンピオン別ビュー共通）
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

  // ロールフィルタ適用
  const applyRoleFilter = useCallback((list: any[]) => {
    if (roleFilter === 'ALL') return list;
    return list.filter(m => {
      let role = (m.raw_data?.role || m.role || 'UNKNOWN').toUpperCase();
      if (role === 'UTILITY') role = 'SUPPORT';
      if (role === 'BOTTOM') role = 'BOT';
      return role === roleFilter;
    });
  }, [roleFilter]);

  // 一覧ビュー用のフィルタ結果
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

  // チャンピオン別ビュー用のグループ化
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
    // マッチアップ数が多い順にソート
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [matchups, mySearch, isMatch, applyRoleFilter]);

  const set = (k: string, v: any) => setMemo((p: any) => ({ ...p, [k]: v }));
  
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

  const startSimulation = async () => {
    // 全て選択されているか検証
    const roles = ['TOP', 'JG', 'MID', 'BOT', 'SUP'] as const;
    const blueMissing = roles.filter(r => !blueChamps[r]);
    const redMissing = roles.filter(r => !redChamps[r]);
    
    if (blueMissing.length > 0 || redMissing.length > 0) {
      alert('すべてのポジション（味方5名、敵5名）のチャンピオンを選択してください。');
      return;
    }

    setSimLoading(true);
    setSimError(null);
    setSimResult(null);
    setSimStatus('5v5シミュレーションタスクを登録中...');

    try {
      const res = await fetch('/api/match/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blue: blueChamps,
          red: redChamps
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'シミュレーションタスクの登録に失敗しました。');
      }

      const taskId = data.task_id;
      setSimStatus('10名のスキル・相性データを集計中...');
      
      // ポーリング開始
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > 50) { // 最大75秒
          clearInterval(interval);
          setSimError('シミュレーションがタイムアウトしました。もう一度お試しください。');
          setSimLoading(false);
          return;
        }

        // 進行状況のテキスト変化
        if (attempts === 5) setSimStatus('各レーンの主導権バランスを計算中...');
        if (attempts === 12) setSimStatus('チーム構成スタイルとシナジーを分析中...');
        if (attempts === 20) setSimStatus('勝利条件と時間帯別ゲームプランを構築中...');

        const { data: task, error } = await supabase
          .from('edge_tasks')
          .select('status, result, error_message')
          .eq('id', taskId)
          .single();

        if (error) {
          clearInterval(interval);
          setSimError(`タスク監視エラー: ${error.message}`);
          setSimLoading(false);
          return;
        }

        if (task.status === 'completed') {
          clearInterval(interval);
          setSimResult(task.result);
          setSimLoading(false);
        } else if (task.status === 'failed') {
          clearInterval(interval);
          setSimError(task.error_message || 'AI 5v5シミュレーションの実行中にエラーが発生しました。');
          setSimLoading(false);
        }
      }, 1500);

    } catch (err: any) {
      setSimError(err.message || '通信エラーが発生しました。');
      setSimLoading(false);
    }
  };

  // 直近の試合(ktm_matches)からチーム構成をシミュレータに自動入力する(実戦データ連携)
  const [loadingRecent, setLoadingRecent] = useState(false);
  const normSimRole = (r: string): 'TOP' | 'JG' | 'MID' | 'BOT' | 'SUP' | null => {
    const u = String(r || '').toUpperCase();
    if (u.startsWith('TOP')) return 'TOP';
    if (u.startsWith('JG') || u.startsWith('JUNG')) return 'JG';
    if (u.startsWith('MID')) return 'MID';
    if (u.startsWith('BOT') || u === 'ADC' || u.startsWith('BOTTOM') || u === 'CARRY') return 'BOT';
    if (u.startsWith('SUP') || u === 'UTILITY') return 'SUP';
    return null;
  };
  const loadFromRecentMatch = async () => {
    setLoadingRecent(true);
    setSimError(null);
    try {
      const { data, error } = await supabase
        .from('ktm_matches')
        .select('id, created_at, ktm_match_participants ( team, role, champion_name )')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const parts: any[] = (data && data[0]?.ktm_match_participants) || [];
      if (parts.length === 0) { setSimError('直近の試合データが見つかりませんでした。'); return; }
      const blue: Record<string, string> = { TOP: '', JG: '', MID: '', BOT: '', SUP: '' };
      const red: Record<string, string> = { TOP: '', JG: '', MID: '', BOT: '', SUP: '' };
      let filled = 0;
      parts.forEach((p) => {
        const role = normSimRole(p.role);
        if (!role || !p.champion_name) return;
        if (p.team === 'BLUE') { blue[role] = p.champion_name; filled++; }
        else if (p.team === 'RED') { red[role] = p.champion_name; filled++; }
      });
      if (filled === 0) { setSimError('直近の試合にチャンピオン情報が無く、読み込めませんでした。'); return; }
      setBlueChamps(blue);
      setRedChamps(red);
    } catch (e: any) {
      setSimError('直近の試合の読み込みに失敗しました: ' + e.message);
    } finally {
      setLoadingRecent(false);
    }
  };

  // AIシミュレーターのレンダリング
  const renderSimulator = () => {
    const roles = ['TOP', 'JG', 'MID', 'BOT', 'SUP'] as const;

    return (
      <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
        {/* 入力パネル (Blue vs Red) */}
        <div className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden border-t-2 border-[#a78bfa]/20">
          <div className="absolute -right-20 -top-20 w-48 h-48 bg-[#a78bfa]/5 rounded-full blur-3xl"></div>
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <h3 className="text-[#a78bfa] font-black text-lg flex items-center gap-2">
              <Swords size={20} /> 5v5 チーム構成＆勝利プラン・アナライザー
            </h3>
            <button
              onClick={loadFromRecentMatch}
              disabled={loadingRecent || simLoading}
              title="直近の試合のチーム構成を読み込む"
              className="glass-panel glass-panel-hover rounded-xl px-4 py-2 text-xs font-bold text-[#00cfef] flex items-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
            >
              {loadingRecent ? <RefreshCw size={14} className="animate-spin" /> : <History size={14} />} 直近の試合から読み込む
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-9 gap-6 items-center">
            {/* Blue Side */}
            <div className="lg:col-span-4 space-y-4 bg-blue-500/5 p-5 rounded-2xl border border-blue-500/10">
              <h4 className="font-black text-sm text-blue-400 tracking-wider uppercase mb-3 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></div> Blue Side (味方)
              </h4>
              {roles.map(role => (
                <div key={role} className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{role}</label>
                  <ChampSelect 
                    value={blueChamps[role]} 
                    onChange={(val) => setBlueChamps(prev => ({ ...prev, [role]: val }))} 
                    placeholder="チャンピオンを選択" 
                    className="border-blue-500/20 focus:border-blue-500/50" 
                  />
                </div>
              ))}
            </div>

            {/* VS Divider */}
            <div className="lg:col-span-1 flex flex-col items-center justify-center py-4">
              <span className="text-2xl font-black italic text-gray-500 tracking-widest">VS</span>
              <div className="w-px h-20 bg-gradient-to-b from-transparent via-gray-700 to-transparent hidden lg:block my-4"></div>
            </div>

            {/* Red Side */}
            <div className="lg:col-span-4 space-y-4 bg-red-500/5 p-5 rounded-2xl border border-red-500/10">
              <h4 className="font-black text-sm text-red-400 tracking-wider uppercase mb-3 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse"></div> Red Side (敵)
              </h4>
              {roles.map(role => (
                <div key={role} className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{role}</label>
                  <ChampSelect 
                    value={redChamps[role]} 
                    onChange={(val) => setRedChamps(prev => ({ ...prev, [role]: val }))} 
                    placeholder="チャンピオンを選択" 
                    className="border-red-500/20 focus:border-red-500/50" 
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="text-right mt-8 border-t border-white/5 pt-6">
            <button
              onClick={startSimulation}
              disabled={simLoading || Object.values(blueChamps).some(v => !v) || Object.values(redChamps).some(v => !v)}
              className="px-8 py-4 bg-gradient-to-r from-[#a78bfa] to-[#818cf8] text-black font-black rounded-xl hover:shadow-[0_0_25px_rgba(167,139,250,0.4)] transition-all flex items-center gap-3 ml-auto disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Zap size={18} /> 構成相性 ＆ 勝利プランを分析
            </button>
          </div>
        </div>

        {/* エラー表示 */}
        {simError && (
          <div className="glass-panel p-6 border-l-4 border-red-500 rounded-2xl flex items-center gap-4 text-red-400">
            <AlertCircle size={24} />
            <div>
              <h4 className="font-bold">分析エラー</h4>
              <p className="text-sm">{simError}</p>
            </div>
          </div>
        )}

        {/* ローディング */}
        {simLoading && (
          <div className="glass-panel py-20 rounded-2xl flex flex-col items-center justify-center gap-6">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <Swords className="text-[#a78bfa] animate-spin absolute animate-duration-3000" size={56} />
              <div className="absolute inset-0 border-4 border-t-[#a78bfa] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-center">
              <h4 className="text-lg font-black text-white animate-pulse mb-1">{simStatus}</h4>
              <p className="text-xs text-gray-500 font-mono">通常 15秒〜25秒 で完了します</p>
            </div>
          </div>
        )}

        {/* シミュレーション結果表示 */}
        {simResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-8">
            
            {/* 1. 各レーンの主導権マップ */}
            <div className="glass-panel p-6 md:p-8 rounded-3xl relative">
              <h3 className="text-white font-black text-base mb-6 flex items-center gap-2">
                <Activity className="text-[#00cfef]" size={20} /> ⚖️ 各レーン主導権分析 (Lane Priority Map)
              </h3>
              
              <div className="divide-y divide-white/5 space-y-4">
                {roles.map(role => {
                  const laneData = simResult.lanes[role] || { priority: 'EVEN', reason: '' };
                  
                  // プライオリティ表示判定
                  const getPriorityLabel = () => {
                    if (laneData.priority === 'BLUE_PRIORITY') {
                      return { text: '味方有利 (Blue)', style: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
                    }
                    if (laneData.priority === 'RED_PRIORITY') {
                      return { text: '敵有利 (Red)', style: 'bg-red-500/20 text-red-400 border-red-500/30' };
                    }
                    return { text: '互角 (Even)', style: 'bg-gray-500/10 text-gray-400 border-gray-600/30' };
                  };
                  const label = getPriorityLabel();

                  return (
                    <div key={role} className="flex flex-col md:flex-row md:items-center gap-4 pt-4 first:pt-0">
                      {/* ポジションと両チャンプ */}
                      <div className="flex items-center gap-3 w-full md:w-[240px] shrink-0">
                        <span className="w-10 text-xs font-black text-gray-400 font-mono tracking-wider">{role}</span>
                        <div className="flex items-center gap-1.5">
                          <img 
                            src={getChampIcon(blueChamps[role])} 
                            className="w-8 h-8 rounded-full border border-blue-500/30" 
                            alt={blueChamps[role]} 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://ddragon.leagueoflegends.com/cdn/16.13.1/img/profileicon/29.png';
                            }}
                          />
                          <span className="text-[10px] text-gray-500 font-black italic">VS</span>
                          <img 
                            src={getChampIcon(redChamps[role])} 
                            className="w-8 h-8 rounded-full border border-red-500/30" 
                            alt={redChamps[role]} 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://ddragon.leagueoflegends.com/cdn/16.13.1/img/profileicon/29.png';
                            }}
                          />
                        </div>
                      </div>

                      {/* 有利ステータス */}
                      <div className="shrink-0 w-[140px]">
                        <span className={`px-3 py-1 rounded-full border text-[10px] font-black inline-block ${label.style}`}>
                          {label.text}
                        </span>
                      </div>

                      {/* 理由解説 */}
                      <p className="text-xs text-gray-300 leading-relaxed flex-1">
                        {laneData.reason}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. 両チームの構成タイプ ＆ シナジー分析 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Blue Side */}
              <div className="glass-panel p-6 rounded-2xl border-l-4 border-blue-500/50">
                <h4 className="text-blue-400 font-black text-sm mb-4 flex items-center gap-2">
                  🛡️ Blue Side 構成分析
                </h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">構成タイプ</span>
                    <p className="text-sm font-black text-white mt-0.5">{simResult.blue_team.composition_style}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">強みと狙い</span>
                    <p className="text-xs text-gray-300 leading-relaxed mt-0.5">{simResult.blue_team.strengths}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">弱点・警戒点</span>
                    <p className="text-xs text-gray-300 leading-relaxed mt-0.5">{simResult.blue_team.weaknesses}</p>
                  </div>
                </div>
              </div>

              {/* Red Side */}
              <div className="glass-panel p-6 rounded-2xl border-l-4 border-red-500/50">
                <h4 className="text-red-400 font-black text-sm mb-4 flex items-center gap-2">
                  ⚔️ Red Side 構成分析
                </h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">構成タイプ</span>
                    <p className="text-sm font-black text-white mt-0.5">{simResult.red_team.composition_style}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">強みと狙い</span>
                    <p className="text-xs text-gray-300 leading-relaxed mt-0.5">{simResult.red_team.strengths}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">弱点・警戒点</span>
                    <p className="text-xs text-gray-300 leading-relaxed mt-0.5">{simResult.red_team.weaknesses}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 勝利へのロードマップ（時間帯別のチーム戦術） */}
            <div className="glass-panel p-6 md:p-8 rounded-3xl">
              <h3 className="text-white font-black text-base mb-6 flex items-center gap-2">
                <Target className="text-[#a78bfa]" size={20} /> 🗺️ 勝利へのロードマップ (Game Plan)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Early */}
                <div className="glass-panel p-5 rounded-2xl border-t-2 border-amber-500/30 flex flex-col gap-2">
                  <span className="text-xs font-black text-amber-400">序盤 (〜Lv6 / オブジェクト戦準備)</span>
                  <p className="text-xs leading-relaxed text-gray-300">{simResult.game_plan.early}</p>
                </div>
                {/* Mid */}
                <div className="glass-panel p-5 rounded-2xl border-t-2 border-purple-500/30 flex flex-col gap-2">
                  <span className="text-xs font-black text-purple-400">中盤 (1stタワー破壊 / サイドプッシュ開始)</span>
                  <p className="text-xs leading-relaxed text-gray-300">{simResult.game_plan.mid}</p>
                </div>
                {/* Late */}
                <div className="glass-panel p-5 rounded-2xl border-t-2 border-emerald-500/30 flex flex-col gap-2">
                  <span className="text-xs font-black text-emerald-400">終盤 (集団戦 / ソウル・バロン決戦)</span>
                  <p className="text-xs leading-relaxed text-gray-300">{simResult.game_plan.late}</p>
                </div>
              </div>
            </div>

            {/* 4. 勝利条件 (Win Conditions) */}
            <div className="glass-panel p-6 md:p-8 rounded-3xl border-b-2 border-[#c89b3c]/20">
              <h3 className="text-[#c89b3c] font-black text-base mb-6 flex items-center gap-2">
                <Award size={22} /> 🎯 勝利条件 (Win Conditions)
              </h3>
              <ul className="space-y-4">
                {simResult.win_conditions && simResult.win_conditions.map((cond: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-4 text-sm text-gray-200">
                    <div className="w-6 h-6 rounded-full bg-[#c89b3c]/15 text-[#c89b3c] border border-[#c89b3c]/30 flex items-center justify-center shrink-0 text-xs font-bold font-mono">
                      {idx + 1}
                    </div>
                    <span className="pt-0.5 font-bold leading-relaxed">{cond}</span>
                  </li>
                ))}
              </ul>
            </div>

          </motion.div>
        )}
      </div>
    );
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 100 } } };

  // 詳細ビュー
  if (selected) {
    const m = selected; const rd = m.raw_data || {};
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 md:p-12 max-w-5xl mx-auto flex flex-col gap-8">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-[#00cfef] font-bold w-fit hover:text-white transition-colors">
          <ChevronLeft size={18} /> 検索に戻る
        </button>
        <div className="glass-panel rounded-2xl overflow-hidden relative group">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-[#00cfef]/10 rounded-full blur-3xl"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c89b3c] via-[#00cfef] to-[#a78bfa]"></div>
          
          <div className="p-8 relative z-10">
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <Badge name={m.champion} color="border-[#c89b3c] text-[#c89b3c] bg-[#c89b3c]/10" />
              <span className="text-[#00cfef] font-black italic">VS</span>
              <Badge name={m.enemy} color="border-[#00cfef] text-[#00cfef] bg-[#00cfef]/10" />
              {rd.difficulty > 0 && <span className="text-xl">{'⭐'.repeat(rd.difficulty)}</span>}
              {rd.result && (
                <span className={`px-3 py-1 rounded-lg text-xs font-black ${String(rd.result).toLowerCase() === 'win' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'}`}>
                  {rd.result}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
              <h1 className="text-3xl font-black font-mono">{m.title}</h1>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(m)} className="px-4 py-2 glass-panel glass-panel-hover text-green-400 rounded-lg text-sm font-bold flex items-center gap-2">
                  📝 編集
                </button>
                <button onClick={() => handleDelete(m.id)} className="px-4 py-2 glass-panel glass-panel-hover text-red-400 rounded-lg text-sm font-bold flex items-center gap-2">
                  <Trash2 size={14} /> 削除
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {rd.csd15 !== undefined && rd.csd15 !== 0 && (
                <div className="glass-panel border-l-4 rounded-r-xl p-4 border-indigo-500">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2 text-indigo-400">
                    <span>📊</span> 15分段階のCS差 (CSD@15)
                  </h3>
                  <p className="text-lg font-black font-mono text-white">
                    {rd.csd15 > 0 ? `+${rd.csd15}` : rd.csd15}
                  </p>
                </div>
              )}
              {rd.winCondition && <InfoBlock title="勝ち筋" icon="🎯" text={rd.winCondition} color="text-[#c89b3c] border-[#c89b3c]" />}
              {rd.earlyGame && <InfoBlock title="序盤の動き (Lv1-6)" icon="⚔️" text={rd.earlyGame} color="text-[#00cfef] border-[#00cfef]" />}
              {rd.firstClear && <InfoBlock title="ルート / 警戒スキル" icon="🚨" text={rd.firstClear} color="text-[#a78bfa] border-[#a78bfa]" />}
              {rd.counterJg && <InfoBlock title="ガンク警戒 / ダイブ" icon="⚠️" text={rd.counterJg} color="text-[#f59e0b] border-[#f59e0b]" />}
              {rd.powerSpikes && <InfoBlock title="パワースパイク" icon="⚡" text={rd.powerSpikes} color="text-[#ef4444] border-[#ef4444]" />}
              {rd.buildRunes && <InfoBlock title="ビルド / ルーン" icon="🛡️" text={rd.buildRunes} color="text-[#22d3ee] border-[#22d3ee]" />}
              {m.strategy && <InfoBlock title="反省メモ" icon="📝" text={m.strategy} color="text-gray-400 border-gray-600" />}
              
              {/* KTMカスタムマッチ対面直接対決データ分析の表示 */}
              {champStats[m.champion] && (() => {
                const history = champStats[m.champion].match_history?.filter((h: any) => h.enemy_champion === m.enemy) || [];
                const trendHistory = [...history].reverse();
                
                // プレイヤー別の集計ロジック
                const playerAgg: Record<string, { games: number, wins: number, kills: number, deaths: number, assists: number, role: string }> = {};
                history.forEach((h: any) => {
                  const name = h.player_name;
                  if (!playerAgg[name]) {
                    playerAgg[name] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, role: h.role || 'UNKNOWN' };
                  }
                  const a = playerAgg[name];
                  a.games += 1;
                  if (h.is_win) a.wins += 1;
                  const parts = String(h.score).split('/').map(Number);
                  a.kills += parts[0] || 0;
                  a.deaths += parts[1] || 0;
                  a.assists += parts[2] || 0;
                });

                return (
                  <div className="glass-panel border-l-4 rounded-r-xl p-6 border-amber-500 bg-amber-500/5 mt-6 space-y-6">
                    {/* ヘッダー */}
                    <div className="flex justify-between items-center border-b border-white/5 pb-3 flex-wrap gap-2">
                      <h3 className="text-sm font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                        <Swords size={16} /> KTM直接対決データ分析 ({m.champion} vs {m.enemy})
                      </h3>
                      {champStats[m.champion].matchup_stats?.[m.enemy] ? (
                        <span className="text-xs font-mono font-black px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-md">
                          対面勝率: {champStats[m.champion].matchup_stats[m.enemy].win_rate}% ({champStats[m.champion].matchup_stats[m.enemy].games}戦)
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500 font-bold">直接対戦データ未記録</span>
                      )}
                    </div>

                    {history.length > 0 ? (
                      <>
                        {/* 1. 勝敗推移タイムライン (トレンド) */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">📈 直近の勝敗トレンド (時系列)</span>
                          <div className="flex items-center gap-2 overflow-x-auto py-2 pr-4 scrollbar-thin">
                            {trendHistory.map((h: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 shrink-0">
                                <div className={`flex flex-col items-center px-4 py-2.5 rounded-xl border ${h.is_win ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                  <span className={`w-3 h-3 rounded-full ${h.is_win ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]'}`}></span>
                                  <span className="text-[10px] font-bold text-white mt-1.5">{h.player_name}</span>
                                  <span className="text-[8px] text-gray-400 font-mono mt-0.5">{new Date(h.created_at).toLocaleDateString('ja-JP', {month: '2-digit', day: '2-digit'})}</span>
                                </div>
                                {idx < trendHistory.length - 1 && <span className="text-gray-600 font-bold text-sm">➔</span>}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 2. プレイヤー/ロール別の集計サマリーテーブル */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">📊 プレイヤー別の集計サマリー</span>
                          <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/40">
                            <table className="w-full min-w-[480px] text-left border-collapse text-[11px]">
                              <thead>
                                <tr className="bg-white/5 text-gray-400 font-bold tracking-wider uppercase border-b border-white/5 text-[9px]">
                                  <th className="p-3">プレイヤー</th>
                                  <th className="p-3 text-center">ロール</th>
                                  <th className="p-3 text-center">試合数</th>
                                  <th className="p-3 text-center">勝率</th>
                                  <th className="p-3 text-center">平均KDA</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 font-medium">
                                {Object.entries(playerAgg).map(([name, pa]: any) => {
                                  const winRate = Math.round((pa.wins / pa.games) * 100);
                                  const kda = pa.deaths > 0 ? Math.round(((pa.kills + pa.assists) / pa.deaths) * 10) / 10 : (pa.kills + pa.assists);
                                  return (
                                    <tr key={name} className="hover:bg-white/[0.02] transition-colors">
                                      <td className="p-3 font-bold text-white">{name}</td>
                                      <td className="p-3 text-center font-mono text-gray-400">{pa.role}</td>
                                      <td className="p-3 text-center text-gray-300 font-bold">{pa.games}</td>
                                      <td className={`p-3 text-center font-black ${winRate >= 60 ? 'text-green-400' : winRate <= 40 ? 'text-red-400' : 'text-gray-300'}`}>
                                        {winRate}% ({pa.wins}W)
                                      </td>
                                      <td className="p-3 text-center font-mono">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${kda >= 3.0 ? 'bg-green-500/10 text-green-400' : kda <= 1.5 ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-300'}`}>
                                          {kda} KDA
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* 3. AIによる対戦データ分析サマリー */}
                        {champStats[m.champion].matchup_stats?.[m.enemy] && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">💡 対面分析アドバイス (過去データに基づく)</span>
                            <p className="text-xs text-gray-200 leading-relaxed font-semibold italic bg-black/20 p-3 rounded-lg border border-white/5">
                              " {champStats[m.champion].matchup_stats[m.enemy].analysis_summary} "
                            </p>
                          </div>
                        )}

                        {/* 4. 対面個別試合履歴 (日付の降順) */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">⚔️ 対面個別試合履歴 (日付順)</span>
                          <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/40">
                            <table className="w-full min-w-[480px] text-left border-collapse text-[11px]">
                              <thead>
                                <tr className="bg-white/5 text-gray-400 font-bold tracking-wider uppercase border-b border-white/5 text-[9px]">
                                  <th className="p-3">試合日</th>
                                  <th className="p-3">使用プレイヤー</th>
                                  <th className="p-3 text-center">ロール</th>
                                  <th className="p-3 text-center">スコア (KDA)</th>
                                  <th className="p-3 text-center">勝敗</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 font-medium">
                                {history.map((h: any, idx: number) => {
                                  const parts = String(h.score).split('/').map(Number);
                                  const kills = parts[0] || 0;
                                  const deaths = parts[1] || 0;
                                  const assists = parts[2] || 0;
                                  const kda = deaths > 0 ? Math.round(((kills + assists) / deaths) * 10) / 10 : (kills + assists);
                                  
                                  return (
                                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                      <td className="p-3 font-mono text-gray-300">
                                        {new Date(h.created_at).toLocaleDateString('ja-JP', {
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit'
                                        })}
                                      </td>
                                      <td className="p-3 font-bold text-white">{h.player_name}</td>
                                      <td className="p-3 text-center font-mono text-gray-400">{h.role}</td>
                                      <td className="p-3 text-center font-mono font-bold text-gray-300">
                                        <span className="text-green-400">{kills}</span>/
                                        <span className="text-red-400">{deaths}</span>/
                                        <span className="text-yellow-400">{assists}</span>
                                        <span className="text-[10px] text-gray-500 ml-1.5">({kda} KDA)</span>
                                      </td>
                                      <td className="p-3 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${h.is_win ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                          {h.is_win ? 'WIN' : 'LOSE'}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-400 leading-relaxed py-2">
                        <p className="mb-2">⚠️ KTMカスタムマッチにおける {m.champion} vs {m.enemy} の直接対面データはまだ登録されていません。</p>
                        <p className="text-gray-500 italic">全体の勝率統計: 勝率 {champStats[m.champion].win_rate}% (総プレイ {champStats[m.champion].pick_count}戦, 平均KDA {champStats[m.champion].avg_kda})</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 相手チャンプの辞典対策（メモが無くても即座に弱点/カウンターを提示） */}
              {(() => {
                const f = champFacts[String(m.enemy).toLowerCase()];
                if (!f || (!f.weaknesses && !f.power_spikes && !f.counter_champions && !f.must_ban_champions)) return null;
                return (
                  <div className="glass-panel border-l-4 rounded-r-xl p-5 border-[#00cfef] bg-[#00cfef]/5 mt-2 space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#00cfef] flex items-center gap-2">
                      <Shield size={16} /> 相手（{m.enemy}）の弱点・対策
                      <span className="text-[9px] text-gray-500 normal-case tracking-normal">辞典より</span>
                    </h3>
                    {f.weaknesses && <p className="text-xs text-gray-200 leading-relaxed"><span className="text-gray-500">弱み: </span>{f.weaknesses}</p>}
                    {f.power_spikes && <p className="text-xs text-gray-200 leading-relaxed"><span className="text-gray-500">危険な時間帯: </span>{f.power_spikes}</p>}
                    {f.counter_champions && <p className="text-xs text-gray-200 leading-relaxed"><span className="text-gray-500">刺さるカウンター: </span>{f.counter_champions}</p>}
                    {f.must_ban_champions && <p className="text-xs text-gray-200 leading-relaxed"><span className="text-gray-500">BAN推奨: </span>{f.must_ban_champions}</p>}
                  </div>
                );
              })()}
            </div>

            <div className="mt-8 text-xs text-gray-500 font-mono flex items-center gap-2">
              <Activity size={12} className="text-[#00cfef]" /> 更新: {new Date(m.created_at).toLocaleString('ja-JP')} | ソース: {rd.source || 'unknown'}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // メイン一覧ビュー
  return (
    <div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto flex flex-col gap-8">
      
      <motion.header 
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 flex items-center gap-4">
            <Swords className="text-[#00cfef]" size={36} /> <span className="text-gradient">バトルサーチ</span>
          </h1>
          <p className="text-[var(--color-primary)] font-medium text-glow flex items-center gap-2">
            <Activity size={18} className="animate-pulse" /> 対面チャンプ名を入力して対策を表示
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* ビュー切替トグル */}
          <div className="glass-panel rounded-full p-1 flex">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 ${viewMode === 'list' ? 'bg-[#00cfef]/20 text-[#00cfef] shadow-[0_0_10px_rgba(0,207,239,0.2)]' : 'text-gray-400 hover:text-white'}`}
            >
              📋 一覧
            </button>
            <button
              onClick={() => setViewMode('champion')}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 ${viewMode === 'champion' ? 'bg-[#c89b3c]/20 text-[#c89b3c] shadow-[0_0_10px_rgba(200,155,60,0.2)]' : 'text-gray-400 hover:text-white'}`}
            >
              🎯 チャンピオン別
            </button>
            <button
              onClick={() => setViewMode('simulator')}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 ${viewMode === 'simulator' ? 'bg-[#a78bfa]/20 text-[#a78bfa] shadow-[0_0_10px_rgba(167,139,250,0.2)]' : 'text-gray-400 hover:text-white'}`}
            >
              ⚔️ AIシミュレータ
            </button>
          </div>
          {viewMode !== 'simulator' && (
            <button 
              onClick={() => setShowForm(!showForm)} 
              className="glass-panel glass-panel-hover rounded-full px-6 py-2.5 font-bold text-sm flex items-center gap-2 text-[#00cfef]"
            >
              {showForm ? <><X size={16} /> 閉じる</> : <><Plus size={16} /> メモ追加</>}
            </button>
          )}
        </div>
      </motion.header>

      {showForm && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel p-6 rounded-2xl border-l-4 border-[#00cfef] relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#00cfef]/10 rounded-full blur-2xl"></div>
          <h3 className="text-[#00cfef] font-bold mb-4 font-mono relative z-10">新規マッチアップメモ</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 relative z-10">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">自分のチャンプ *</label>
              <ChampSelect value={memo.champion} onChange={v => set('champion', v)} placeholder="Yone" className="border-[#00cfef]/30 focus:border-[#00cfef]/60" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">相手のチャンプ *</label>
              <ChampSelect value={memo.enemy} onChange={v => set('enemy', v)} placeholder="Yasuo" className="border-[#00cfef]/30 focus:border-[#00cfef]/60" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">ロール</label>
              <select value={memo.role} onChange={e => set('role', e.target.value)} className="w-full bg-[var(--color-surface)] border border-white/5 rounded-xl p-3 text-white outline-none">
                <option>Jungle</option><option>Top</option><option>Mid</option><option>Bot</option><option>Support</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 relative z-10">
            <Inp label="タイトル (任意)" val={memo.title} set={v => set('title', v)} />
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">戦績</label>
              <div className="flex gap-2">
                {['Win', 'Lose'].map(r => (
                  <button key={r} onClick={() => set('result', r)} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${memo.result === r ? (r === 'Win' ? 'bg-green-500/20 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]') : 'bg-[var(--color-surface)] text-gray-400 hover:bg-[var(--color-surface-hover)]'}`}>
                    {r === 'Win' ? '勝ち' : '負け'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* 詳細設定アコーディオン */}
          <div className="mb-4 border border-white/5 bg-black/10 rounded-xl overflow-hidden relative z-10">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full px-4 py-3 flex items-center justify-between font-bold text-xs text-gray-400 hover:text-white transition-colors select-none"
            >
              <span>{showDetails ? '▼ 詳細設定を閉じる' : '▶ 詳細設定を開く（難易度、CS差、勝ち筋など）'}</span>
            </button>
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-4 border-t border-white/5 space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">難易度 (1〜5)</label>
                      <select value={memo.difficulty} onChange={e => set('difficulty', parseInt(e.target.value))} className="w-full bg-[var(--color-surface)] border border-white/5 rounded-xl p-3 text-white outline-none">
                        <option value="1">⭐ (とても簡単)</option>
                        <option value="2">⭐⭐ (簡単)</option>
                        <option value="3">⭐⭐⭐ (普通)</option>
                        <option value="4">⭐⭐⭐⭐ (難しい)</option>
                        <option value="5">⭐⭐⭐⭐⭐ (極めて困難)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">15分段階のCS差 (CSD@15)</label>
                      <input
                        type="number"
                        placeholder="例: 15 (勝っている) / -10 (負けている)"
                        value={memo.csd15}
                        onChange={e => set('csd15', parseInt(e.target.value) || 0)}
                        className="w-full bg-[var(--color-surface)] border border-white/5 focus:border-[#00cfef]/50 rounded-xl p-3 text-white outline-none transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">🎯 勝ち筋</label>
                    <textarea value={memo.winCondition} onChange={e => set('winCondition', e.target.value)} className="w-full bg-[var(--color-surface)] border border-white/5 focus:border-[#00cfef]/50 rounded-xl p-3 text-white outline-none min-h-[80px]" placeholder="対面との主要勝機、意識すべきポイント..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">⚔️ 序盤の動き (Lv1-6)</label>
                    <textarea value={memo.earlyGame} onChange={e => set('earlyGame', e.target.value)} className="w-full bg-[var(--color-surface)] border border-white/5 focus:border-[#00cfef]/50 rounded-xl p-3 text-white outline-none min-h-[80px]" placeholder="Lv1での配置、ウェーブコントロール、Lv3/6での仕掛け方..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">🚨 ルート / 警戒スキル</label>
                    <textarea value={memo.firstClear} onChange={e => set('firstClear', e.target.value)} className="w-full bg-[var(--color-surface)] border border-white/5 focus:border-[#00cfef]/50 rounded-xl p-3 text-white outline-none min-h-[80px]" placeholder="相手のジャングル周回ルート予測、避けるべきスキル..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">⚠️ ガンク警戒 / ダイブ</label>
                    <textarea value={memo.counterJg} onChange={e => set('counterJg', e.target.value)} className="w-full bg-[var(--color-surface)] border border-white/5 focus:border-[#00cfef]/50 rounded-xl p-3 text-white outline-none min-h-[80px]" placeholder="何分頃にガンクされやすいか、カウンタージャングルの狙いどころ..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">⚡ パワースパイク</label>
                      <textarea value={memo.powerSpikes} onChange={e => set('powerSpikes', e.target.value)} className="w-full bg-[var(--color-surface)] border border-white/5 focus:border-[#00cfef]/50 rounded-xl p-3 text-white outline-none min-h-[80px]" placeholder="相手が強い時間帯、コアアイテム完成時..." />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">🛡️ ビルド / ルーン</label>
                      <textarea value={memo.buildRunes} onChange={e => set('buildRunes', e.target.value)} className="w-full bg-[var(--color-surface)] border border-white/5 focus:border-[#00cfef]/50 rounded-xl p-3 text-white outline-none min-h-[80px]" placeholder="推奨ビルド、対面用の対抗ルーン..." />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mb-4 relative z-10">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">📝 反省メモ / 自由記述</label>
            <textarea value={memo.strategy} onChange={e => set('strategy', e.target.value)} className="w-full bg-[var(--color-surface)] border border-white/5 focus:border-[#00cfef]/50 rounded-xl p-3 text-white outline-none min-h-[100px] transition-colors" placeholder="次回はこうする、今回の敗因など..." />
          </div>
          <div className="text-right relative z-10">
            <button onClick={saveMemo} disabled={saving} className="px-6 py-3 bg-[#00cfef] text-black font-black rounded-xl hover:shadow-[0_0_15px_rgba(0,207,239,0.5)] transition-all flex items-center gap-2 ml-auto">
              <Save size={16} /> {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </motion.div>
      )}

      {/* 検索バー（ビューモードで切替） */}
      {viewMode === 'list' ? (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c89b3c] z-10" size={20} />
            <ChampSelect value={mySearch} onChange={setMySearch} placeholder="自分のチャンプ (例: Yone)" className="pl-12 py-4 border-2 border-transparent focus:border-[#c89b3c]/50 shadow-lg" />
          </div>
          <button
            onClick={() => { setMySearch(enemySearch); setEnemySearch(mySearch); }}
            title="自分と相手を入れ替え"
            className="glass-panel glass-panel-hover rounded-2xl px-4 flex items-center justify-center text-[#00cfef] shrink-0 active:scale-95 transition-transform"
          >
            <ArrowLeftRight size={18} />
          </button>
          <div className="relative flex-1 min-w-[200px]">
            <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00cfef] z-10" size={20} />
            <ChampSelect value={enemySearch} onChange={setEnemySearch} placeholder="相手のチャンプ (例: Yasuo)" className="pl-12 py-4 border-2 border-transparent focus:border-[#00cfef]/50 shadow-lg" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="glass-panel rounded-2xl px-6 font-bold text-[#c89b3c] outline-none min-w-[140px] appearance-none cursor-pointer text-center">
            <option value="ALL">ALL ROLES</option>
            <option value="TOP">TOP</option><option value="JUNGLE">JUNGLE</option><option value="MID">MID</option><option value="BOT">BOT</option><option value="SUPPORT">SUPPORT</option>
          </select>
          <select value={resultFilter} onChange={e => setResultFilter(e.target.value)} className="glass-panel rounded-2xl px-5 font-bold text-emerald-300 outline-none min-w-[110px] appearance-none cursor-pointer text-center">
            <option value="ALL">勝敗: 全て</option>
            <option value="Win">勝ち</option>
            <option value="Lose">負け</option>
          </select>
          <select value={difficultyFilter} onChange={e => setDifficultyFilter(parseInt(e.target.value))} className="glass-panel rounded-2xl px-5 font-bold text-rose-300 outline-none min-w-[120px] appearance-none cursor-pointer text-center">
            <option value="0">難易度: 全て</option>
            <option value="1">⭐</option><option value="2">⭐⭐</option><option value="3">⭐⭐⭐</option><option value="4">⭐⭐⭐⭐</option><option value="5">⭐⭐⭐⭐⭐</option>
          </select>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="glass-panel rounded-2xl px-5 font-bold text-[#00cfef] outline-none min-w-[130px] appearance-none cursor-pointer text-center">
            <option value="updated_desc">新しい順</option>
            <option value="updated_asc">古い順</option>
            <option value="difficulty_desc">難易度が高い順</option>
            <option value="difficulty_asc">難易度が低い順</option>
          </select>
        </motion.div>
      ) : (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c89b3c] z-10" size={20} />
            <ChampSelect value={mySearch} onChange={setMySearch} placeholder="チャンピオン名で絞り込み (例: Yone)" className="pl-12 py-4 border-2 border-transparent focus:border-[#c89b3c]/50 shadow-lg" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="glass-panel rounded-2xl px-6 font-bold text-[#c89b3c] outline-none min-w-[140px] appearance-none cursor-pointer text-center">
            <option value="ALL">ALL ROLES</option>
            <option value="TOP">TOP</option><option value="JUNGLE">JUNGLE</option><option value="MID">MID</option><option value="BOT">BOT</option><option value="SUPPORT">SUPPORT</option>
          </select>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20"><div className="w-8 h-8 border-4 border-[#00cfef] border-t-transparent rounded-full animate-spin"></div></div>
      ) : viewMode === 'simulator' ? (
        renderSimulator()
      ) : viewMode === 'list' ? (
        /* ===== 一覧ビュー（既存） ===== */
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map(m => (
            <motion.div variants={itemVariants} key={m.id} onClick={() => setSelected(m)} className="glass-panel glass-panel-hover rounded-2xl overflow-hidden cursor-pointer group flex flex-col">
              <div className="bg-black/30 p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <img src={getChampIcon(m.champion)} className="w-10 h-10 rounded-full border border-white/10" alt={m.champion} />
                  <span className="font-bold text-[#c89b3c]">{m.champion}</span>
                </div>
                <div className="text-center px-2">
                  <span className="text-[10px] font-black italic text-gray-500 tracking-wider">VS</span>
                </div>
                <div className="flex items-center gap-3 flex-1 justify-end">
                  <span className="font-bold text-[#00cfef]">{m.enemy}</span>
                  <img src={getChampIcon(m.enemy)} className="w-10 h-10 rounded-full border border-white/10" alt={m.enemy} />
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-sm leading-tight text-white group-hover:text-[#00cfef] transition-colors">{m.title}</h3>
                  {m.raw_data?.result && (
                    <span className={`text-[10px] font-black px-2 py-1 rounded-md ml-2 shrink-0 ${String(m.raw_data.result).toLowerCase() === 'win' ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]' : 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]'}`}>
                      {String(m.raw_data.result).toLowerCase() === 'win' ? 'WIN' : 'LOSE'}
                    </span>
                  )}
                </div>
                {(m.raw_data?.winCondition || m.strategy) && (
                  <div className="text-xs text-gray-400 italic line-clamp-2 mt-auto bg-[var(--color-surface)] p-3 rounded-xl border border-white/5 shadow-inner">
                    "{m.raw_data?.winCondition || m.strategy}"
                  </div>
                )}
                <div className="mt-4 text-[10px] text-gray-500 font-mono flex justify-between items-center">
                  <span>{new Date(m.created_at).toLocaleDateString('ja-JP')}</span>
                  <span className="text-[#00cfef] font-bold opacity-0 group-hover:opacity-100 transition-opacity">詳細を見る →</span>
                </div>
              </div>
            </motion.div>
          ))}
          
          {results.length === 0 && (
            <motion.div variants={itemVariants} className="col-span-full py-20 text-center glass-panel rounded-2xl flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-[#00cfef]/10 rounded-full flex items-center justify-center mb-4">
                <Shield size={32} className="text-[#00cfef]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">マッチアップが見つかりません</h3>
              <p className="text-sm text-gray-400">条件を変えるか、新しいメモを追加してください</p>
            </motion.div>
          )}
        </motion.div>
      ) : (
        /* ===== チャンピオン別ビュー ===== */
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col gap-4">
          {championGroups.map(([champName, matchupList]) => {
            // 勝率計算
            const wins = matchupList.filter(m => String(m.raw_data?.result).toLowerCase() === 'win').length;
            const losses = matchupList.filter(m => String(m.raw_data?.result).toLowerCase() === 'lose').length;
            const total = wins + losses;
            const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
            const isExpanded = expandedChamp === champName;

            // 対面ごとに集約
            const enemyGroups: Record<string, any[]> = {};
            matchupList.forEach(m => {
              if (!enemyGroups[m.enemy]) enemyGroups[m.enemy] = [];
              enemyGroups[m.enemy].push(m);
            });
            // 勝率順でソート（KTM勝率を最優先、なければメモ勝率）
            const sortedEnemies = Object.entries(enemyGroups).sort((a, b) => {
              const aEnemy = a[0];
              const bEnemy = b[0];

              // aの勝率算出
              const aKtm = champStats[champName]?.matchup_stats?.[aEnemy];
              let aRate = 50;
              if (aKtm && aKtm.games > 0) {
                aRate = aKtm.win_rate;
              } else {
                const aWins = a[1].filter(m => String(m.raw_data?.result).toLowerCase() === 'win').length;
                aRate = Math.round((aWins / a[1].length) * 100);
              }

              // bの勝率算出
              const bKtm = champStats[champName]?.matchup_stats?.[bEnemy];
              let bRate = 50;
              if (bKtm && bKtm.games > 0) {
                bRate = bKtm.win_rate;
              } else {
                const bWins = b[1].filter(m => String(m.raw_data?.result).toLowerCase() === 'win').length;
                bRate = Math.round((bWins / b[1].length) * 100);
              }

              return bRate - aRate;
            });

            return (
              <motion.div variants={itemVariants} key={champName} className="glass-panel rounded-2xl overflow-hidden">
                {/* チャンピオンカード（グループヘッダー） */}
                <button
                  onClick={() => setExpandedChamp(isExpanded ? null : champName)}
                  className="w-full p-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <img src={getChampIcon(champName)} className="w-12 h-12 rounded-full border-2 border-[#c89b3c]/50 shadow-[0_0_12px_rgba(200,155,60,0.3)]" alt={champName} />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-lg text-[#c89b3c]">{champName}</span>
                      <span className="text-xs text-gray-400 font-mono">{matchupList.length} マッチアップ</span>
                    </div>
                  </div>
                  <div className="text-gray-400 transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>
                    <ChevronDown size={20} />
                  </div>
                </button>

                {/* 対面リスト（アコーディオン展開） */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      {/* KTMカスタムマッチ統計の表示 */}
                      {champStats[champName] && (() => {
                        const history = champStats[champName].match_history || [];
                        const trendHistory = [...history].reverse().slice(-5); // 直近最大5件
                        
                        // プレイヤー別の集計ロジック
                        const playerAgg: Record<string, { games: number, wins: number, kills: number, deaths: number, assists: number, role: string }> = {};
                        history.forEach((h: any) => {
                          const name = h.player_name;
                          if (!playerAgg[name]) {
                            playerAgg[name] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, role: h.role || 'UNKNOWN' };
                          }
                          const a = playerAgg[name];
                          a.games += 1;
                          if (h.is_win) a.wins += 1;
                          const parts = String(h.score).split('/').map(Number);
                          a.kills += parts[0] || 0;
                          a.deaths += parts[1] || 0;
                          a.assists += parts[2] || 0;
                        });

                        return (
                          <div className="bg-black/20 border-t border-b border-white/5 p-5 mb-4 flex flex-col gap-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-3 flex-wrap">
                              <div className="flex items-center gap-3 flex-wrap">
                                <h4 className="font-bold text-xs text-[#00cfef] flex items-center gap-1.5 uppercase tracking-widest">
                                  <Award size={14} /> KTMカスタムマッチ統計 (全体実績)
                                </h4>
                                {champStats[champName].pick_count > 0 && (
                                  <span className="text-[10px] font-black font-mono px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md">
                                    KTM勝率: {champStats[champName].win_rate}% ({champStats[champName].pick_count}戦, 平均KDA: {champStats[champName].avg_kda})
                                  </span>
                                )}
                              </div>
                              {champStats[champName].top_players?.length > 0 && (
                                <span className="text-[10px] text-gray-400 font-mono">
                                  主な使用者: <strong className="text-gray-200">{champStats[champName].top_players.map((p: any) => `${p.player_name} (${p.games}戦 ${p.win_rate}%勝率)`).join(', ')}</strong>
                                </span>
                              )}
                            </div>
                            
                            {history.length > 0 ? (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* 勝敗トレンド */}
                                <div className="space-y-1.5">
                                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">📈 直近の勝敗トレンド</span>
                                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                                    {trendHistory.map((h: any, idx: number) => (
                                      <div key={idx} className="flex items-center gap-2 shrink-0">
                                        <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg border ${h.is_win ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                          <span className={`w-2 h-2 rounded-full ${h.is_win ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]'}`}></span>
                                          <span className="text-[9px] font-bold text-white mt-1">{h.player_name}</span>
                                          <span className="text-[8px] text-gray-400 font-mono mt-0.5">{h.enemy_champion ? `vs ${h.enemy_champion}` : ''}</span>
                                        </div>
                                        {idx < trendHistory.length - 1 && <span className="text-gray-700 font-bold text-xs">➔</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* 集計テーブル */}
                                <div className="space-y-1.5">
                                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">📊 プレイヤー集計</span>
                                  <div className="overflow-hidden rounded-lg border border-white/5 bg-black/40">
                                    <table className="w-full text-left border-collapse text-[10px]">
                                      <thead>
                                        <tr className="bg-white/5 text-gray-400 font-bold tracking-wider uppercase border-b border-white/5 text-[8px]">
                                          <th className="p-2">プレイヤー</th>
                                          <th className="p-2 text-center">ロール</th>
                                          <th className="p-2 text-center">試合数</th>
                                          <th className="p-2 text-center">勝率</th>
                                          <th className="p-2 text-center">平均KDA</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/5 font-medium">
                                        {Object.entries(playerAgg).slice(0, 3).map(([name, pa]: any) => {
                                          const winRate = Math.round((pa.wins / pa.games) * 100);
                                          const kda = pa.deaths > 0 ? Math.round(((pa.kills + pa.assists) / pa.deaths) * 10) / 10 : (pa.kills + pa.assists);
                                          return (
                                            <tr key={name} className="hover:bg-white/[0.02] transition-colors">
                                              <td className="p-2 font-bold text-white">{name}</td>
                                              <td className="p-2 text-center font-mono text-gray-500">{pa.role}</td>
                                              <td className="p-2 text-center text-gray-300 font-bold">{pa.games}</td>
                                              <td className={`p-2 text-center font-black ${winRate >= 60 ? 'text-green-400' : winRate <= 40 ? 'text-red-400' : 'text-gray-300'}`}>
                                                {winRate}%
                                              </td>
                                              <td className="p-2 text-center font-mono">
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${kda >= 3.0 ? 'bg-green-500/10 text-green-400' : kda <= 1.5 ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-300'}`}>
                                                  {kda}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500 italic">過去のKTMでのプレイ履歴はありません</span>
                            )}

                            {/* 個別試合リスト (日付の降順) */}
                            {history.length > 0 && (
                              <div className="space-y-1.5 col-span-full border-t border-white/5 pt-3 mt-1">
                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">⚔️ 直近の個別試合履歴 (日付順)</span>
                                <div className="overflow-hidden rounded-lg border border-white/5 bg-black/40">
                                  <table className="w-full text-left border-collapse text-[10px]">
                                    <thead>
                                      <tr className="bg-white/5 text-gray-400 font-bold tracking-wider uppercase border-b border-white/5 text-[8px]">
                                        <th className="p-2">試合日</th>
                                        <th className="p-2">プレイヤー</th>
                                        <th className="p-2 text-center">対面相手</th>
                                        <th className="p-2 text-center">スコア (KDA)</th>
                                        <th className="p-2 text-center">勝敗</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 font-medium">
                                      {history.slice(0, 5).map((h: any, idx: number) => {
                                        const parts = String(h.score).split('/').map(Number);
                                        const kills = parts[0] || 0;
                                        const deaths = parts[1] || 0;
                                        const assists = parts[2] || 0;
                                        const kda = deaths > 0 ? Math.round(((kills + assists) / deaths) * 10) / 10 : (kills + assists);
                                        return (
                                          <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-2 font-mono text-gray-400">
                                              {new Date(h.created_at).toLocaleDateString('ja-JP')}
                                            </td>
                                            <td className="p-2 font-bold text-white">{h.player_name}</td>
                                            <td className="p-2 text-center text-amber-400 font-bold">{h.enemy_champion}</td>
                                            <td className="p-2 text-center font-mono text-gray-300">
                                              <span className="text-green-400">{kills}</span>/
                                              <span className="text-red-400">{deaths}</span>/
                                              <span className="text-yellow-400">{assists}</span>
                                              <span className="text-gray-500 ml-1">({kda})</span>
                                            </td>
                                            <td className="p-2 text-center">
                                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${h.is_win ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                {h.is_win ? 'WIN' : 'LOSE'}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {sortedEnemies.map(([enemyName, enemyMatchups]) => {
                          const eWins = enemyMatchups.filter(m => String(m.raw_data?.result).toLowerCase() === 'win').length;
                          const eLosses = enemyMatchups.filter(m => String(m.raw_data?.result).toLowerCase() === 'lose').length;
                          return enemyMatchups.map(m => {
                            const rd = m.raw_data || {};
                            const isWin = String(rd.result).toLowerCase() === 'win';
                            const isLose = String(rd.result).toLowerCase() === 'lose';
                            const summary = (rd.winCondition || m.strategy || '').slice(0, 50);

                            // 動的な有利・不利の決定
                            const ktmMatchup = champStats[champName]?.matchup_stats?.[m.enemy];
                            let winRate = 50;
                            let hasData = false;
                            if (ktmMatchup && ktmMatchup.games > 0) {
                              winRate = ktmMatchup.win_rate;
                              hasData = true;
                            } else {
                              const eTotal = eWins + eLosses;
                              if (eTotal > 0) {
                                winRate = Math.round((eWins / eTotal) * 100);
                                hasData = true;
                              }
                            }

                            const isFavored = winRate >= 60;
                            const isUnfavored = winRate <= 40;
                            
                            const cardBorderColor = isFavored ? 'border-l-green-500 bg-green-500/5 hover:bg-[#22c55e]/10' : 
                                                   isUnfavored ? 'border-l-red-500 bg-red-500/5 hover:bg-[#ef4444]/10' : 
                                                   'border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10';

                            return (
                              <motion.div
                                key={m.id}
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                onClick={() => setSelected(m)}
                                className={`border-l-4 ${cardBorderColor} rounded-r-xl p-3 cursor-pointer transition-colors group/item flex items-center gap-3`}
                              >
                                <img src={getChampIcon(m.enemy)} className="w-9 h-9 rounded-full border border-white/10 shrink-0" alt={m.enemy} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <span className="font-bold text-sm text-[#00cfef]">{m.enemy}</span>
                                    {rd.difficulty > 0 && <span className="text-[10px]">{'⭐'.repeat(rd.difficulty)}</span>}
                                    {hasData && (
                                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                                        isFavored ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 
                                        isUnfavored ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 
                                        'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                      }`}>
                                        {isFavored ? '🟢 有利' : isUnfavored ? '🔴 不利' : '🟡 互角'}
                                      </span>
                                    )}
                                  </div>
                                  {summary && (
                                    <p className="text-[11px] text-gray-400 truncate italic">"{summary}{(rd.winCondition || m.strategy || '').length > 50 ? '…' : ''}"</p>
                                  )}
                                </div>
                                <div className="shrink-0 flex items-center gap-3">
                                  {(() => {
                                    // 1. KTMカスタムマッチの対面勝率があれば最優先で使用
                                    const ktmMatchup = champStats[champName]?.matchup_stats?.[m.enemy];
                                    if (ktmMatchup && ktmMatchup.games > 0) {
                                      const winRate = ktmMatchup.win_rate;
                                      return (
                                        <div className={`px-2 py-1 rounded-md border flex flex-col items-center justify-center min-w-[65px] ${winRate >= 60 ? 'bg-green-500/10 text-green-400 border-green-500/20' : winRate <= 40 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                          <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider scale-90 leading-none">KTM {ktmMatchup.games}戦</span>
                                          <span className="font-mono text-xs font-black mt-0.5 leading-none">{winRate}%</span>
                                        </div>
                                      );
                                    }
                                    
                                    // 2. なければメモの勝敗結果から勝率を算出して表示
                                    const eTotal = eWins + eLosses;
                                    const memoWinRate = eTotal > 0 ? Math.round((eWins / eTotal) * 100) : null;
                                    if (memoWinRate !== null) {
                                      return (
                                        <div className={`px-2 py-1 rounded-md border flex flex-col items-center justify-center min-w-[65px] ${memoWinRate >= 60 ? 'bg-green-500/10 text-green-400 border-green-500/20' : memoWinRate <= 40 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-gray-500/10 text-gray-300 border-white/5'}`}>
                                          <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider scale-90 leading-none">メモ {eTotal}戦</span>
                                          <span className="font-mono text-xs font-black mt-0.5 leading-none">{memoWinRate}%</span>
                                        </div>
                                      );
                                    }

                                    // 3. どちらもなければ元のメモの単体勝敗結果を出す
                                    if (rd.result) {
                                      return (
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-md ${isWin ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]' : isLose ? 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]' : 'bg-gray-500/20 text-gray-400'}`}>
                                          {isWin ? 'WIN' : 'LOSE'}
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                  <span className="text-[#00cfef] text-xs font-bold opacity-0 group-hover/item:opacity-100 transition-opacity">→</span>
                                </div>
                              </motion.div>
                            );
                          });
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {championGroups.length === 0 && (
            <motion.div variants={itemVariants} className="py-20 text-center glass-panel rounded-2xl flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-[#c89b3c]/10 rounded-full flex items-center justify-center mb-4">
                <Target size={32} className="text-[#c89b3c]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">該当チャンピオンが見つかりません</h3>
              <p className="text-sm text-gray-400">検索条件を変更してください</p>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

const Inp = ({ label, val, set }: { label: string, val: string, set: (v: string) => void }) => (
  <div>
    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</label>
    <input type="text" value={val} onChange={e => set(e.target.value)} className="w-full bg-[var(--color-surface)] border border-white/5 focus:border-[#00cfef]/50 rounded-xl p-3 text-white outline-none transition-colors shadow-inner" />
  </div>
);

const Badge = ({ name, color }: { name: string, color: string }) => (
  <div className={`flex items-center gap-2 px-4 py-2 rounded-full border bg-black/40 backdrop-blur-sm ${color}`}>
    <img src={getChampIcon(name)} className="w-6 h-6 rounded-full" alt={name} />
    <span className="font-bold text-sm">{name}</span>
  </div>
);

const InfoBlock = ({ title, icon, text, color }: { title: string, icon: string, text: string, color: string }) => (
  <div className={`glass-panel border-l-4 rounded-r-xl p-4 ${color.replace('text-', 'border-')}`}>
    <h3 className={`text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${color.split(' ')[0]}`}><span>{icon}</span> {title}</h3>
    <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">{text}</p>
  </div>
);

const TimelineCard = ({ phase, advantage, description, color }: { phase: string, advantage: string, description: string, color: string }) => {
  const getAdvLabel = () => {
    if (advantage === 'MY_ADVANTAGE') return { text: '自分有利', bg: 'bg-[#c89b3c]/15 text-[#c89b3c] border-[#c89b3c]/30' };
    if (advantage === 'ENEMY_ADVANTAGE') return { text: '相手有利', bg: 'bg-red-500/15 text-red-400 border-red-500/30' };
    return { text: '互角', bg: 'bg-gray-500/15 text-gray-400 border-gray-600/30' };
  };
  const adv = getAdvLabel();

  return (
    <div className={`glass-panel p-5 rounded-2xl border-t-2 ${color} flex flex-col gap-3`}>
      <div className="flex justify-between items-center">
        <span className="text-xs font-black text-gray-400">{phase}</span>
        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${adv.bg}`}>{adv.text}</span>
      </div>
      <p className="text-xs leading-relaxed text-gray-300 flex-1">{description}</p>
    </div>
  );
};
