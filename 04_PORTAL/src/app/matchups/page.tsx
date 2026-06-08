"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getChampIcon } from '../../lib/ddragonClient';
import { Shield, Target, ChevronLeft, Swords, Plus, X, Save, Trash2, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import ChampSelect from '../../components/ChampSelect';

const EMPTY_MEMO = {
  champion: '', enemy: '', role: 'Jungle', title: '',
  difficulty: 3, winCondition: '', earlyGame: '', powerSpikes: '',
  buildRunes: '', firstClear: '', counterJg: '', result: '',
  strategy: '',
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('matchup_sentinel').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setMatchups((data || []).filter(m => m.champion && m.enemy && m.enemy !== 'GLOBAL'));
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

  const results = useMemo(() => {
    const isMatch = (name: string, q: string) => {
      if (!q.trim()) return true;
      if (!name) return false;
      const lowerN = name.toLowerCase();
      const lowerQ = q.toLowerCase();
      if (lowerN.includes(lowerQ)) return true;
      const jpName = champMap[lowerN.replace(/[^a-z0-9]/g, '')] || '';
      if (jpName.includes(lowerQ)) return true;
      const hiraToKata = lowerQ.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
      return jpName.includes(hiraToKata);
    };

    let filtered = matchups.filter(m => isMatch(m.champion, mySearch) && isMatch(m.enemy, enemySearch));
    filtered.sort((a, b) => {
      if (sortOrder === 'updated_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOrder === 'updated_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortOrder === 'difficulty_desc') return (b.raw_data?.difficulty || 0) - (a.raw_data?.difficulty || 0);
      return 0;
    });

    if (roleFilter !== 'ALL') {
      filtered = filtered.filter(m => {
        let role = (m.raw_data?.role || m.role || 'UNKNOWN').toUpperCase();
        if (role === 'UTILITY') role = 'SUPPORT';
        if (role === 'BOTTOM') role = 'BOT';
        return role === roleFilter;
      });
    }
    return filtered;
  }, [mySearch, enemySearch, matchups, champMap, sortOrder, roleFilter]);

  const set = (k: string, v: any) => setMemo((p: any) => ({ ...p, [k]: v }));
  
  const saveMemo = async () => {
    if (!memo.champion || !memo.enemy) return alert('チャンピオン名を入力してください');
    setSaving(true);
    
    const mergedRawData = memo.original_raw_data ? { ...memo.original_raw_data, ...memo } : { source: 'manual', ...memo };
    delete mergedRawData.original_raw_data;

    const data = {
      champion: memo.champion, enemy: memo.enemy,
      title: memo.title || `${memo.champion} vs ${memo.enemy} (${memo.role})`,
      strategy: memo.strategy, raw_data: mergedRawData,
      matchup_id: memo.matchup_id || `manual_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
  
    const { error } = await supabase.from('matchup_sentinel').upsert(data, { onConflict: 'matchup_id' });
    if (!error) { fetchData(); setMemo({ ...EMPTY_MEMO }); setShowForm(false); } 
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
      buildRunes: rd.buildRunes || '', result: rd.result || '', strategy: m.strategy || ''
    });
    setShowForm(true); setSelected(null);
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
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="glass-panel glass-panel-hover rounded-full px-6 py-2.5 font-bold text-sm flex items-center gap-2 text-[#00cfef]"
        >
          {showForm ? <><X size={16} /> 閉じる</> : <><Plus size={16} /> メモ追加</>}
        </button>
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

      {/* 検索バー */}
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

      {loading ? (
        <div className="flex justify-center items-center py-20"><div className="w-8 h-8 border-4 border-[#00cfef] border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
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
