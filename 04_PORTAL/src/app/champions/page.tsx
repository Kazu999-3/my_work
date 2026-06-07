"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getChampIcon, getChampSplash } from '../../lib/ddragonClient';
import { ChevronLeft, Search, Save, BookOpen, RefreshCw, Zap, ShieldAlert, Swords, Shield, Copy, Check, FileText, Eye, Edit2, Activity, Plus, Trash } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';

export default function ChampionsPage() {
  const [champions, setChampions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('updated_desc');
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [champDates, setChampDates] = useState<Record<string, string>>({});
  
  const [dataFields, setDataFields] = useState<any>({
    strengths: '', weaknesses: '', powerSpikes: '', buildRunes: '',
    fullClearTime: '', counterChampions: '', mustBanChampions: '', pickRecommendation: '',
    strategy: '', note_draft: '', customFields: {}
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [noteDraftMode, setNoteDraftMode] = useState<'preview' | 'edit'>('preview');
  const [stats, setStats] = useState({ matches: 0, wins: 0, kda: '0.00' });

  useEffect(() => {
    let fetchedChampions: any[] = [];
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(r => r.json())
      .then(versions => fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/ja_JP/champion.json`))
      .then(r => r.json())
      .then(d => {
        fetchedChampions = Object.values(d.data).map((c: any) => ({
          id: c.id, key: c.key, name: c.name, title: c.title, tags: c.tags,
          searchKey: `${c.id.toLowerCase()} ${c.name}`
        }));
        return supabase.from('matchup_sentinel').select('champion, created_at').eq('enemy', 'GLOBAL');
      })
      .then(({ data }) => {
        const dates: Record<string, string> = {};
        if (data) data.forEach(row => dates[row.champion] = row.created_at);
        setChampDates(dates);
        setChampions(fetchedChampions);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const loadChampionData = async (champId: string) => {
      const { data: mData } = await supabase.from('matchup_sentinel').select('raw_data').eq('champion', champId).neq('enemy', 'GLOBAL');
      if (mData && mData.length > 0) {
        let wins = 0; let k = 0; let d = 0; let a = 0;
        mData.forEach(row => {
          const rd = row.raw_data || {};
          if (rd.result === 'Win') wins++;
          if (rd.my_kda) {
            const parts = rd.my_kda.split('/');
            if (parts.length === 3) { k += parseInt(parts[0] || '0'); d += parseInt(parts[1] || '0'); a += parseInt(parts[2] || '0'); }
          }
        });
        setStats({ matches: mData.length, wins, kda: d === 0 ? (k + a).toFixed(2) : ((k + a) / d).toFixed(2) });
      } else { setStats({ matches: 0, wins: 0, kda: '0.00' }); }

      const { data: noteData } = await supabase.from('matchup_sentinel').select('strategy, raw_data').eq('champion', champId).eq('enemy', 'GLOBAL').single();
      const rd = noteData?.raw_data || {};
      setDataFields({
        strengths: rd.strengths || '', weaknesses: rd.weaknesses || '',
        powerSpikes: rd.powerSpikes || '', buildRunes: rd.buildRunes || '',
        fullClearTime: rd.fullClearTime || '', counterChampions: rd.counterChampions || '',
        mustBanChampions: rd.mustBanChampions || '', pickRecommendation: rd.pickRecommendation || '',
        strategy: noteData?.strategy || '', note_draft: rd.note_draft || '',
        customFields: rd.customFields || {}
      });
    };
    loadChampionData(selected.id);
  }, [selected]);

  const setField = (key: string, val: string | object) => setDataFields((p: any) => ({ ...p, [key]: val }));

  const addCustomField = () => {
    const fieldName = prompt('追加する項目の名前を入力してください（例：スキルコンボ、JGマクロなど）');
    if (fieldName && fieldName.trim() && !dataFields.customFields?.[fieldName.trim()]) {
      setField('customFields', { ...(dataFields.customFields || {}), [fieldName.trim()]: '' });
    }
  };

  const removeCustomField = (key: string) => {
    if (!confirm(`項目「${key}」を削除しますか？`)) return;
    const newFields = { ...dataFields.customFields };
    delete newFields[key];
    setField('customFields', newFields);
  };

  const updateCustomField = (key: string, val: string) => {
    setField('customFields', { ...dataFields.customFields, [key]: val });
  };

  const saveMemo = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const data = {
      matchup_id: `champ_${selected.id}_global`,
      champion: selected.id, enemy: 'GLOBAL', title: `${selected.name} 基本戦略・トレンド`,
      strategy: dataFields.strategy, created_at: now,
      raw_data: { 
        source: 'champ_db', role: 'GLOBAL', strengths: dataFields.strengths, weaknesses: dataFields.weaknesses,
        powerSpikes: dataFields.powerSpikes, buildRunes: dataFields.buildRunes,
        fullClearTime: dataFields.fullClearTime, counterChampions: dataFields.counterChampions,
        mustBanChampions: dataFields.mustBanChampions, pickRecommendation: dataFields.pickRecommendation,
        note_draft: dataFields.note_draft, customFields: dataFields.customFields
      }
    };
    const { error } = await supabase.from('matchup_sentinel').upsert(data, { onConflict: 'matchup_id' });
    if (error) alert('保存失敗: ' + error.message); else setChampDates(prev => ({ ...prev, [selected.id]: now }));
    setSaving(false);
  };

  const filtered = useMemo(() => {
    let result = champions;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hiraToKata = q.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
      result = result.filter(c => c.searchKey.includes(q) || c.searchKey.includes(hiraToKata));
    }
    return [...result].sort((a, b) => {
      if (sortOrder === 'updated_desc') {
        const dateA = champDates[a.id] ? new Date(champDates[a.id]).getTime() : 0;
        const dateB = champDates[b.id] ? new Date(champDates[b.id]).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;
      }
      return a.name.localeCompare(b.name);
    });
  }, [champions, search, sortOrder, champDates]);

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.02 } } };
  const itemVariants = { hidden: { scale: 0.9, opacity: 0 }, visible: { scale: 1, opacity: 1 } };

  if (selected) {
    const winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto flex flex-col gap-8">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-[#c89b3c] font-bold w-fit hover:text-white transition-colors">
          <ChevronLeft size={18} /> 辞典トップに戻る
        </button>
        
        <div className="relative h-64 md:h-80 rounded-3xl overflow-hidden shadow-2xl flex items-end p-8 border border-white/10 group bg-[#0a0b10]">
          <div className="absolute inset-0 bg-cover bg-[center_20%] opacity-60 group-hover:opacity-80 transition-opacity duration-1000" style={{ backgroundImage: `url(${getChampSplash(selected.id)})` }}></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#06070a] via-[#06070a]/60 to-transparent"></div>
          
          <div className="relative z-10 flex items-center gap-6 w-full flex-wrap">
            <img src={getChampIcon(selected.id)} alt={selected.name} className="w-24 h-24 rounded-full border-4 border-[#c89b3c] shadow-[0_0_30px_rgba(200,155,60,0.5)]" />
            <div>
              <p className="text-[#c89b3c] text-sm font-bold uppercase tracking-[0.2em] mb-1 text-glow">{selected.title}</p>
              <h1 className="text-4xl md:text-5xl font-black font-mono tracking-tight text-white">{selected.name}</h1>
            </div>
            
            <div className="ml-auto flex gap-4">
              <div className="glass-panel px-6 py-3 rounded-2xl text-center">
                <p className="text-xs text-gray-400 font-bold mb-1 uppercase tracking-widest">Win Rate</p>
                <p className={`text-2xl font-black ${winRate >= 50 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>{stats.matches > 0 ? `${winRate}%` : '-'}</p>
              </div>
              <div className="glass-panel px-6 py-3 rounded-2xl text-center">
                <p className="text-xs text-gray-400 font-bold mb-1 uppercase tracking-widest">Matches / KDA</p>
                <p className="text-lg font-black text-white">{stats.matches}戦 <span className="text-[#00cfef] text-sm ml-2">{stats.kda}</span></p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TextAreaCard title="強み (Strengths)" icon={Swords} color="text-[var(--color-success)] border-[var(--color-success)] shadow-[var(--color-success)]" value={dataFields.strengths} onChange={v => setField('strengths', v)} />
          <TextAreaCard title="弱み (Weaknesses)" icon={ShieldAlert} color="text-[var(--color-danger)] border-[var(--color-danger)] shadow-[var(--color-danger)]" value={dataFields.weaknesses} onChange={v => setField('weaknesses', v)} />
          <TextAreaCard title="パワースパイク" icon={Zap} color="text-[#c89b3c] border-[#c89b3c] shadow-[#c89b3c]" value={dataFields.powerSpikes} onChange={v => setField('powerSpikes', v)} />
          <TextAreaCard title="コアビルド / ルーン" icon={Shield} color="text-purple-400 border-purple-500 shadow-purple-500" value={dataFields.buildRunes} onChange={v => setField('buildRunes', v)} />
          <TextAreaCard title="対面の有利・不利" icon={Swords} color="text-[#00cfef] border-[#00cfef] shadow-[#00cfef]" value={dataFields.counterChampions} onChange={v => setField('counterChampions', v)} />
          <TextAreaCard title="ピック推奨 (先/後)" icon={Shield} color="text-emerald-400 border-emerald-500 shadow-emerald-500" value={dataFields.pickRecommendation} onChange={v => setField('pickRecommendation', v)} />
          
          {Object.entries(dataFields.customFields || {}).map(([key, val]) => (
            <div key={key} className="glass-panel border-t-2 border-pink-400 p-5 rounded-2xl group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] shadow-pink-400/20 relative">
              <button onClick={() => removeCustomField(key)} className="absolute top-4 right-4 text-gray-500 hover:text-red-400 transition-colors"><Trash size={14}/></button>
              <h3 className="text-sm font-black mb-4 flex items-center gap-2 text-pink-400"><FileText size={16} /> {key}</h3>
              <textarea value={val as string} onChange={e => updateCustomField(key, e.target.value)} className="w-full h-28 bg-black/30 border border-white/5 rounded-xl p-3 text-sm text-gray-200 outline-none focus:border-white/20 resize-y shadow-inner transition-colors" placeholder={`${key}を記録...`} />
            </div>
          ))}
          
          <button onClick={addCustomField} className="glass-panel border-2 border-dashed border-[#c89b3c]/30 hover:border-[#c89b3c] hover:bg-[#c89b3c]/10 text-[#c89b3c] p-5 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all min-h-[160px]">
            <Plus size={24} />
            <span className="font-bold text-sm">新しい項目を追加</span>
          </button>
        </div>

        <div className="glass-panel border-t-4 border-pink-500 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl group-hover:bg-pink-500/10 transition-colors"></div>
          <div className="relative z-10 flex justify-between items-center mb-6 flex-wrap gap-4">
            <h3 className="text-lg font-black font-mono flex items-center gap-2 text-white"><FileText className="text-pink-500" size={20} /> noteドラフト記事</h3>
            <div className="flex gap-2">
              <div className="flex bg-[var(--color-surface)] p-1 rounded-xl border border-white/5">
                <button onClick={() => setNoteDraftMode('preview')} className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${noteDraftMode === 'preview' ? 'bg-pink-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}><Eye size={14} /> プレビュー</button>
                <button onClick={() => setNoteDraftMode('edit')} className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${noteDraftMode === 'edit' ? 'bg-pink-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}><Edit2 size={14} /> 編集</button>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(dataFields.note_draft); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-white/10 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors text-white">
                {copied ? <span className="text-[var(--color-success)] flex items-center gap-2"><Check size={16} /> コピー完了</span> : <><Copy size={16} /> Markdownをコピー</>}
              </button>
            </div>
          </div>
          <div className="relative z-10">
            {noteDraftMode === 'edit' ? (
              <textarea value={dataFields.note_draft} onChange={e => setField('note_draft', e.target.value)} className="w-full h-[400px] p-6 bg-black/50 border border-pink-500/30 rounded-xl text-sm leading-relaxed font-mono outline-none focus:border-pink-500/60 shadow-inner text-gray-200" placeholder="# 究極の攻略バイブル..." />
            ) : (
              <div className="prose prose-invert prose-pink max-w-none min-h-[400px] p-6 bg-black/30 border border-white/5 rounded-xl text-sm leading-loose">
                {dataFields.note_draft ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{dataFields.note_draft}</ReactMarkdown> : <p className="text-gray-500 italic">まだドラフト記事がありません。</p>}
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel border-t-4 border-[#00cfef] rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-[#00cfef]/5 rounded-full blur-3xl group-hover:bg-[#00cfef]/10 transition-colors"></div>
          <h3 className="text-lg font-black font-mono mb-4 flex items-center gap-2 text-white relative z-10"><BookOpen className="text-[#00cfef]" size={20} /> 全体的な立ち回り・トレンドメモ</h3>
          <textarea value={dataFields.strategy} onChange={e => setField('strategy', e.target.value)} className="relative z-10 w-full h-40 p-4 bg-black/50 border border-[#00cfef]/30 rounded-xl text-sm leading-relaxed outline-none focus:border-[#00cfef]/60 mb-6 shadow-inner text-gray-200" placeholder="動画で見たコンボ、メタの立ち回りなどを記録..." />
          <div className="flex justify-end relative z-10">
            <button onClick={saveMemo} disabled={saving} className="px-8 py-3 bg-white text-black font-black rounded-xl hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:-translate-y-0.5 transition-all flex items-center gap-2">
              {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} 情報を保存する
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto flex flex-col gap-8">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 flex items-center gap-4">
          <BookOpen className="text-[#c89b3c]" size={36} /> <span className="text-gradient text-gradient-gold">チャンピオン辞典</span>
        </h1>
        <p className="text-[var(--color-primary)] font-medium text-glow flex items-center gap-2">
          <Activity size={18} className="animate-pulse" /> 全チャンピオンの戦略データベース
        </p>
      </motion.header>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="sticky top-6 z-20 flex gap-4 glass-panel p-4 rounded-2xl shadow-2xl backdrop-blur-2xl bg-[#06070a]/80">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c89b3c]" size={20} />
          <input type="text" placeholder="チャンピオン名で検索..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[var(--color-surface)] border border-transparent focus:border-[#c89b3c]/50 rounded-xl py-3 pl-12 pr-4 text-white font-bold outline-none transition-colors" />
        </div>
        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="glass-panel border-none rounded-xl px-4 font-bold text-[#c89b3c] outline-none min-w-[160px] cursor-pointer">
          <option value="updated_desc">更新日が新しい順</option>
          <option value="name_asc">名前順</option>
        </select>
      </motion.div>

      {loading ? (
        <div className="flex justify-center items-center py-20"><div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4">
          {filtered.map(c => {
            const hasNote = !!champDates[c.id];
            return (
              <motion.div variants={itemVariants} key={c.id} onClick={() => setSelected(c)} 
                className={`glass-panel glass-panel-hover flex flex-col items-center gap-2 p-4 rounded-2xl cursor-pointer group ${hasNote ? 'bg-[#c89b3c]/10 border-[#c89b3c]/30 shadow-[0_0_15px_rgba(200,155,60,0.15)]' : ''}`}>
                <div className="relative">
                  <img src={getChampIcon(c.id)} alt={c.name} className={`w-14 h-14 rounded-full border-2 transition-colors ${hasNote ? 'border-[#c89b3c]' : 'border-white/10 group-hover:border-white/30'}`} />
                  {hasNote && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#c89b3c] rounded-full border-2 border-[#0a0b10]"></div>}
                </div>
                <span className={`text-xs font-bold text-center leading-tight transition-colors ${hasNote ? 'text-[#c89b3c]' : 'text-gray-400 group-hover:text-white'}`}>{c.name}</span>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

const TextAreaCard = ({ title, icon: Icon, color, value, onChange }: { title: string, icon: any, color: string, value: string, onChange: (v: string) => void }) => {
  const [textColor, borderColor, shadowColor] = color.split(' ');
  return (
    <div className={`glass-panel border-t-2 p-5 rounded-2xl group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] ${borderColor}`}>
      <h3 className={`text-sm font-black mb-4 flex items-center gap-2 ${textColor}`}><Icon size={16} /> {title}</h3>
      <textarea value={value} onChange={e => onChange(e.target.value)} className="w-full h-28 bg-black/30 border border-white/5 rounded-xl p-3 text-sm text-gray-200 outline-none focus:border-white/20 resize-y shadow-inner transition-colors" placeholder={`${title}を記録...`} />
    </div>
  );
};
