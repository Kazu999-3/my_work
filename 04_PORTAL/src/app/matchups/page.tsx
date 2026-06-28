"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getChampIcon } from '../../lib/ddragonClient';
import { Shield, Target, ChevronLeft, ChevronDown, ChevronUp, Swords, Plus, X, Save, Trash2, Activity, Award, Zap, AlertCircle, CheckCircle } from 'lucide-react';
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
  const [champMap, setChampMap] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'list' | 'champion' | 'simulator'>('list');
  const [expandedChamp, setExpandedChamp] = useState<string | null>(null);
  const [paramsProcessed, setParamsProcessed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // AIシミュレータ用ステート
  const [simMyChamp, setSimMyChamp] = useState('');
  const [simEnemyChamp, setSimEnemyChamp] = useState('');
  const [simRole, setSimRole] = useState('Jungle');
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
    filtered.sort((a, b) => {
      if (sortOrder === 'updated_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOrder === 'updated_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortOrder === 'difficulty_desc') return (b.raw_data?.difficulty || 0) - (a.raw_data?.difficulty || 0);
      return 0;
    });
    return applyRoleFilter(filtered);
  }, [mySearch, enemySearch, matchups, isMatch, sortOrder, applyRoleFilter]);

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
    if (!simMyChamp || !simEnemyChamp) {
      alert('自分と相手のチャンピオンを選択してください。');
      return;
    }
    setSimLoading(true);
    setSimError(null);
    setSimResult(null);
    setSimStatus('タスクを登録中...');

    try {
      const res = await fetch('/api/match/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          champion: simMyChamp,
          enemy: simEnemyChamp,
          role: simRole
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'シミュレーションタスクの登録に失敗しました。');
      }

      const taskId = data.task_id;
      setSimStatus('AIが対戦データを解析中...');
      
      // ポーリング開始
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > 40) { // 最大60秒
          clearInterval(interval);
          setSimError('シミュレーションがタイムアウトしました。もう一度お試しください。');
          setSimLoading(false);
          return;
        }

        // 進行状況のテキスト変化
        if (attempts === 5) setSimStatus('パワースパイクの衝突をシミュレート中...');
        if (attempts === 10) setSimStatus('立ち回りの有利不利を計算中...');
        if (attempts === 15) setSimStatus('勝利のアドバイスを構築中...');

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
          setSimError(task.error_message || 'AIシミュレーションの実行中にエラーが発生しました。');
          setSimLoading(false);
        }
      }, 1500);

    } catch (err: any) {
      setSimError(err.message || '通信エラーが発生しました。');
      setSimLoading(false);
    }
  };

  // AIシミュレーターのレンダリング
  const renderSimulator = () => {
    return (
      <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
        {/* 入力パネル */}
        <div className="glass-panel p-6 rounded-2xl border-l-4 border-[#a78bfa] relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#a78bfa]/10 rounded-full blur-2xl"></div>
          <h3 className="text-[#a78bfa] font-black mb-4 flex items-center gap-2">
            <Swords size={18} /> AI 展開予測シミュレーター
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">自分のチャンプ</label>
              <ChampSelect value={simMyChamp} onChange={setSimMyChamp} placeholder="Yone" className="border-[#a78bfa]/30 focus:border-[#a78bfa]/60" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">相手のチャンプ</label>
              <ChampSelect value={simEnemyChamp} onChange={setSimEnemyChamp} placeholder="Yasuo" className="border-[#a78bfa]/30 focus:border-[#a78bfa]/60" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">ロール</label>
              <select value={simRole} onChange={e => setSimRole(e.target.value)} className="w-full bg-[var(--color-surface)] border border-white/5 rounded-xl p-3 text-white outline-none">
                <option>Jungle</option><option>Top</option><option>Mid</option><option>Bot</option><option>Support</option>
              </select>
            </div>
          </div>
          <div className="text-right">
            <button
              onClick={startSimulation}
              disabled={simLoading || !simMyChamp || !simEnemyChamp}
              className="px-6 py-3.5 bg-[#a78bfa] text-black font-black rounded-xl hover:shadow-[0_0_20px_rgba(167,139,250,0.5)] transition-all flex items-center gap-2 ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap size={16} /> 予測シミュレーションを開始
            </button>
          </div>
        </div>

        {/* エラー表示 */}
        {simError && (
          <div className="glass-panel p-6 border-l-4 border-red-500 rounded-2xl flex items-center gap-4 text-red-400">
            <AlertCircle size={24} />
            <div>
              <h4 className="font-bold">シミュレーションエラー</h4>
              <p className="text-sm">{simError}</p>
            </div>
          </div>
        )}

        {/* ローディング */}
        {simLoading && (
          <div className="glass-panel py-20 rounded-2xl flex flex-col items-center justify-center gap-6">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <Swords className="text-[#a78bfa] animate-spin absolute animate-duration-3000" size={48} />
              <div className="absolute inset-0 border-4 border-t-[#a78bfa] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-center">
              <h4 className="text-lg font-black text-white animate-pulse mb-1">{simStatus}</h4>
              <p className="text-xs text-gray-500 font-mono">通常 10秒〜20秒 で完了します</p>
            </div>
          </div>
        )}

        {/* シミュレーション結果表示 */}
        {simResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
            {/* メイン概要カード */}
            <div className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden flex flex-col md:flex-row items-center gap-8">
              <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-[#a78bfa]/5 rounded-full blur-3xl"></div>
              
              {/* 有利度スコアメーター */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  {/* 背景の円 */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="72" cy="72" r="64" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="transparent" />
                    <circle 
                      cx="72" cy="72" r="64" 
                      stroke={simResult.matchup_score >= 50 ? '#00cfef' : '#ef4444'} 
                      strokeWidth="10" 
                      fill="transparent" 
                      strokeDasharray={402}
                      strokeDashoffset={402 - (402 * simResult.matchup_score) / 100}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-4xl font-black font-mono text-white">{simResult.matchup_score}%</span>
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">有利度スコア</span>
                  </div>
                </div>
                <div className="flex gap-1 mt-2">
                  <span className="text-xs font-bold text-gray-400">対面難易度:</span>
                  <span className="text-xs font-mono text-yellow-400">{'★'.repeat(simResult.difficulty)}{'☆'.repeat(5 - simResult.difficulty)}</span>
                </div>
              </div>

              {/* チャンピオン対面バッジ */}
              <div className="flex-1 space-y-4 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-4 flex-wrap">
                  <div className="flex items-center gap-2 bg-black/40 border border-[#c89b3c]/30 px-4 py-2 rounded-full">
                    <img src={getChampIcon(simResult.my_champion)} className="w-6 h-6 rounded-full" alt={simResult.my_champion} />
                    <span className="font-bold text-[#c89b3c]">{simResult.my_champion}</span>
                  </div>
                  <span className="text-gray-500 font-black italic">VS</span>
                  <div className="flex items-center gap-2 bg-black/40 border border-[#00cfef]/30 px-4 py-2 rounded-full">
                    <img src={getChampIcon(simResult.enemy_champion)} className="w-6 h-6 rounded-full" alt={simResult.enemy_champion} />
                    <span className="font-bold text-[#00cfef]">{simResult.enemy_champion}</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-2xl font-black text-gradient inline-block">AI レーン戦展開シミュレーション</h4>
                  <p className="text-sm text-gray-300 leading-relaxed mt-2">
                    {simResult.my_champion} が {simResult.enemy_champion} に対面した際の、中レート帯（アイアン〜ゴールド）を想定したシミュレーション展開です。パワースパイクのタイミングを見極めて戦闘を行いましょう。
                  </p>
                </div>
              </div>
            </div>

            {/* スキル衝突解説 */}
            <div className="glass-panel p-6 rounded-2xl border-l-4 border-[#00cfef] relative">
              <h3 className="text-[#00cfef] font-black text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                <Swords size={14} /> 強みとスキルの衝突 (Key Clash)
              </h3>
              <p className="text-sm leading-relaxed text-gray-300">{simResult.key_clash}</p>
            </div>

            {/* レーン戦タイムライン */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Early */}
              <TimelineCard 
                phase="序盤 (Lv1 - 5)" 
                advantage={simResult.timeline.early.advantage}
                description={simResult.timeline.early.description}
                color="border-amber-500/30"
              />
              {/* Mid */}
              <TimelineCard 
                phase="中盤 (Lv6 / 1stコア)" 
                advantage={simResult.timeline.mid.advantage}
                description={simResult.timeline.mid.description}
                color="border-purple-500/30"
              />
              {/* Late */}
              <TimelineCard 
                phase="終盤 (集団戦 / 2ndコア〜)" 
                advantage={simResult.timeline.late.advantage}
                description={simResult.timeline.late.description}
                color="border-emerald-500/30"
              />
            </div>

            {/* 勝利の鍵アドバイス */}
            <div className="glass-panel p-6 rounded-2xl border-t border-white/5 relative">
              <h3 className="text-white font-black text-sm mb-4 flex items-center gap-2">
                <Award className="text-[#c89b3c]" size={18} /> 勝利への鍵 (Win Keys)
              </h3>
              <ul className="space-y-3">
                {simResult.win_keys && simResult.win_keys.map((key: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                    <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={16} />
                    <span>{key}</span>
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
          <div className="relative flex-1 min-w-[200px]">
            <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00cfef] z-10" size={20} />
            <ChampSelect value={enemySearch} onChange={setEnemySearch} placeholder="相手のチャンプ (例: Yasuo)" className="pl-12 py-4 border-2 border-transparent focus:border-[#00cfef]/50 shadow-lg" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="glass-panel rounded-2xl px-6 font-bold text-[#c89b3c] outline-none min-w-[140px] appearance-none cursor-pointer text-center">
            <option value="ALL">ALL ROLES</option>
            <option value="TOP">TOP</option><option value="JUNGLE">JUNGLE</option><option value="MID">MID</option><option value="BOT">BOT</option><option value="SUPPORT">SUPPORT</option>
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
            // 勝率順でソート（勝ち数多い順 → 負け少ない順）
            const sortedEnemies = Object.entries(enemyGroups).sort((a, b) => {
              const aWins = a[1].filter(m => String(m.raw_data?.result).toLowerCase() === 'win').length;
              const bWins = b[1].filter(m => String(m.raw_data?.result).toLowerCase() === 'win').length;
              const aRate = aWins / a[1].length;
              const bRate = bWins / b[1].length;
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
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-black text-lg text-[#c89b3c]">{champName}</span>
                      <span className="text-xs text-gray-400 font-mono">{matchupList.length} マッチアップ</span>
                    </div>
                    {/* 勝率バー */}
                    {total > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-[var(--color-danger)]/30 rounded-full overflow-hidden max-w-[200px]">
                          <div
                            className="h-full bg-[var(--color-success)] rounded-full transition-all duration-500"
                            style={{ width: `${winRate}%` }}
                          />
                        </div>
                        <span className={`text-xs font-black font-mono ${winRate >= 50 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                          {winRate}% ({wins}W {losses}L)
                        </span>
                      </div>
                    )}
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
                      <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {sortedEnemies.map(([enemyName, enemyMatchups]) => {
                          const eWins = enemyMatchups.filter(m => String(m.raw_data?.result).toLowerCase() === 'win').length;
                          const eLosses = enemyMatchups.filter(m => String(m.raw_data?.result).toLowerCase() === 'lose').length;
                          return enemyMatchups.map(m => {
                            const rd = m.raw_data || {};
                            const isWin = String(rd.result).toLowerCase() === 'win';
                            const isLose = String(rd.result).toLowerCase() === 'lose';
                            const borderColor = isWin ? 'border-l-[var(--color-success)]' : isLose ? 'border-l-[var(--color-danger)]' : 'border-l-gray-600';
                            const summary = (rd.winCondition || m.strategy || '').slice(0, 50);

                            return (
                              <motion.div
                                key={m.id}
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                onClick={() => setSelected(m)}
                                className={`border-l-4 ${borderColor} bg-black/20 rounded-r-xl p-3 cursor-pointer hover:bg-white/[0.03] transition-colors group/item flex items-center gap-3`}
                              >
                                <img src={getChampIcon(m.enemy)} className="w-9 h-9 rounded-full border border-white/10 shrink-0" alt={m.enemy} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-bold text-sm text-[#00cfef]">{m.enemy}</span>
                                    {rd.difficulty > 0 && <span className="text-[10px]">{'⭐'.repeat(rd.difficulty)}</span>}
                                  </div>
                                  {summary && (
                                    <p className="text-[11px] text-gray-400 truncate italic">"{summary}{(rd.winCondition || m.strategy || '').length > 50 ? '…' : ''}"</p>
                                  )}
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                  {rd.result && (
                                    <span className={`text-[10px] font-black px-2 py-1 rounded-md ${isWin ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]' : isLose ? 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]' : 'bg-gray-500/20 text-gray-400'}`}>
                                      {isWin ? 'WIN' : 'LOSE'}
                                    </span>
                                  )}
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
