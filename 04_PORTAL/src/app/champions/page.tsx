"use client";

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { getChampIcon, getChampSplash } from '../../lib/ddragonClient';
import { ChevronLeft, Search, Save, BookOpen, RefreshCw, Zap, ShieldAlert, Swords, Shield, Copy, Check, FileText, Eye, Edit2, Activity, Plus, Trash, Filter, Star as StarIcon, Award } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { getFavorites, toggleFavoriteChampion } from '../../components/FavoritesPanel';

function ChampionsContent() {
  const searchParams = useSearchParams();
  const [champions, setChampions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('updated_desc');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // DDragonのtags → ロールへのマッピングテーブル
  const ROLE_MAP: Record<string, string[]> = {
    TOP: ['Fighter', 'Tank'],
    JG: ['Fighter', 'Assassin', 'Tank'],
    MID: ['Mage', 'Assassin'],
    ADC: ['Marksman'],
    SUP: ['Support', 'Tank', 'Mage'],
  };
  const ROLE_LABELS = ['ALL', 'TOP', 'JG', 'MID', 'ADC', 'SUP'] as const;
  const [showPendingOnly, setShowPendingOnly] = useState(searchParams.get('filter') === 'pending');
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [champDates, setChampDates] = useState<Record<string, string>>({});
  const [champPending, setChampPending] = useState<Record<string, boolean>>({});
  const [champPatchMetas, setChampPatchMetas] = useState<Record<string, any>>({});

  // 相対時間フォーマット関数
  const getRelativeTimeString = (timestampSec?: number) => {
    if (!timestampSec) return '';
    const diffMs = Date.now() - (timestampSec * 1000);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}分前`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}時間前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '昨日';
    return `${diffDays}日前`;
  };
  
  const [dataFields, setDataFields] = useState<any>({
    strengths: '', weaknesses: '', powerSpikes: '', buildRunes: '',
    fullClearTime: '', counterChampions: '', mustBanChampions: '', pickRecommendation: '',
    strategy: '', note_draft: '', customFields: {},
    patch_meta: null, pro_builds: []
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [noteDraftMode, setNoteDraftMode] = useState<'preview' | 'edit'>('preview');
  const [stats, setStats] = useState({ matches: 0, wins: 0, kda: '0.00' });
  const [favoriteChamps, setFavoriteChamps] = useState<string[]>([]);
  const [matchupsList, setMatchupsList] = useState<any[]>([]);
  const [expandedMatchupId, setExpandedMatchupId] = useState<string | null>(null);
  const [fetchingTrend, setFetchingTrend] = useState(false);

  // お気に入りデータのロードとイベント購読
  useEffect(() => {
    setFavoriteChamps(getFavorites().champions);

    const handleFavUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.champions) {
        setFavoriteChamps(detail.champions);
      }
    };
    window.addEventListener("favorites-updated", handleFavUpdated);
    window.addEventListener("storage", handleFavUpdated);
    return () => {
      window.removeEventListener("favorites-updated", handleFavUpdated);
      window.removeEventListener("storage", handleFavUpdated);
    };
  }, []);

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
        return supabase.from('matchup_sentinel').select('champion, created_at, strategy, patch_meta:raw_data->patch_meta').eq('enemy', 'GLOBAL');
      })
      .then(({ data }) => {
        const dates: Record<string, string> = {};
        const pending: Record<string, boolean> = {};
        const metas: Record<string, any> = {};
        if (data) {
          data.forEach(row => {
            dates[row.champion] = row.created_at;
            pending[row.champion] = !row.strategy; // strategyが空・nullならpending
            metas[row.champion] = row.patch_meta || null;
          });
        }
        setChampDates(dates);
        setChampPending(pending);
        setChampPatchMetas(metas);
        setChampions(fetchedChampions);

        // URLパラメータ ?select=ChampId の自動選択処理
        const selectId = searchParams.get('select');
        if (selectId) {
          const found = fetchedChampions.find(c => c.id === selectId);
          if (found) setSelected(found);
        }

        setLoading(false);
      })
      .catch(console.error);
  }, [searchParams]);

  const isFavorited = selected ? favoriteChamps.includes(selected.id) : false;

  useEffect(() => {
    if (!selected) return;
    setExpandedMatchupId(null); // 選択したチャンピオンが変わったときにアコーディオンをリセット

    const loadChampionData = async (champId: string) => {
      // 対面マッチアップ履歴の表示に必要な詳細フィールド（id, matchup_id, champion, enemy, title, strategy, raw_data）を取得
      const { data: mData } = await supabase.from('matchup_sentinel').select('id, matchup_id, champion, enemy, title, strategy, raw_data').eq('champion', champId).neq('enemy', 'GLOBAL');
      if (mData && mData.length > 0) {
        setMatchupsList(mData);
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
      } else { 
        setMatchupsList([]);
        setStats({ matches: 0, wins: 0, kda: '0.00' }); 
      }

      const { data: noteData } = await supabase.from('matchup_sentinel').select('strategy, raw_data').eq('champion', champId).eq('enemy', 'GLOBAL').single();
      const rd = noteData?.raw_data || {};
      setDataFields({
        strengths: rd.strengths || '', weaknesses: rd.weaknesses || '',
        powerSpikes: rd.powerSpikes || '', buildRunes: rd.buildRunes || '',
        fullClearTime: rd.fullClearTime || '', counterChampions: rd.counterChampions || '',
        mustBanChampions: rd.mustBanChampions || '', pickRecommendation: rd.pickRecommendation || '',
        strategy: noteData?.strategy || '', note_draft: rd.note_draft || '',
        customFields: rd.customFields || {},
        patch_meta: rd.patch_meta || null,
        pro_builds: rd.pro_builds || []
      });
    };
    loadChampionData(selected.id);
  }, [selected]);

  const handleToggleFavorite = () => {
    if (!selected) return;
    toggleFavoriteChampion(selected.id);
  };

  const handleFetchTrend = async () => {
    if (!selected) return;
    setFetchingTrend(true);
    try {
      const role = roleFilter === 'ALL' ? 'Jungle' : roleFilter;
      const res = await fetch('/api/admin/champions/trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champion: selected.id, role })
      });
      
      const result = await res.json();
      if (result.success && result.data) {
        const rd = result.data.raw_data || {};
        setDataFields({
          strengths: rd.strengths || '',
          weaknesses: rd.weaknesses || '',
          powerSpikes: rd.powerSpikes || '',
          buildRunes: rd.buildRunes || '',
          fullClearTime: rd.fullClearTime || '',
          counterChampions: rd.counterChampions || '',
          mustBanChampions: rd.mustBanChampions || '',
          pickRecommendation: rd.pickRecommendation || '',
          strategy: result.data.strategy || '',
          note_draft: rd.note_draft || '',
          customFields: rd.customFields || {},
          patch_meta: rd.patch_meta || null,
          pro_builds: rd.pro_builds || []
        });
        setChampPatchMetas((p: any) => ({
          ...p,
          [selected.id]: rd.patch_meta || null
        }));
        alert('最新のトレンド情報を更新しました！');
      } else {
        alert(`更新に失敗しました: ${result.error || '不明なエラー'}`);
      }
    } catch (err: any) {
      alert(`通信エラー: ${err.message}`);
    } finally {
      setFetchingTrend(false);
    }
  };

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
        note_draft: dataFields.note_draft, customFields: dataFields.customFields,
        patch_meta: dataFields.patch_meta, pro_builds: dataFields.pro_builds
      }
    };
    const { error } = await supabase.from('matchup_sentinel').upsert(data, { onConflict: 'matchup_id' });
    if (error) {
      alert('保存失敗: ' + error.message);
    } else {
      setChampDates(prev => ({ ...prev, [selected.id]: now }));
      setChampPending(prev => ({ ...prev, [selected.id]: !dataFields.strategy }));
    }
    setSaving(false);
  };

  const filtered = useMemo(() => {
    let result = champions;
    // テキスト検索（ひらがな→カタカナ変換対応）
    if (search.trim()) {
      const q = search.toLowerCase();
      const hiraToKata = q.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
      result = result.filter(c => c.searchKey.includes(q) || c.searchKey.includes(hiraToKata));
    }
    // ロール別フィルター（DDragonのtagsベース）
    if (roleFilter !== 'ALL') {
      const allowedTags = ROLE_MAP[roleFilter] || [];
      result = result.filter(c => c.tags?.some((tag: string) => allowedTags.includes(tag)));
    }
    if (showPendingOnly) {
      result = result.filter(c => champPending[c.id]);
    }
    return [...result].sort((a, b) => {
      if (sortOrder === 'updated_desc') {
        const dateA = champDates[a.id] ? new Date(champDates[a.id]).getTime() : 0;
        const dateB = champDates[b.id] ? new Date(champDates[b.id]).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;
      }
      return a.name.localeCompare(b.name);
    });
  }, [champions, search, sortOrder, champDates, showPendingOnly, champPending, roleFilter]);

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
              <div className="flex items-center gap-3">
                <h1 className="text-4xl md:text-5xl font-black font-mono tracking-tight text-white">{selected.name}</h1>
                <button
                  onClick={handleToggleFavorite}
                  className={`p-2 rounded-xl transition-all border ${
                    isFavorited
                      ? 'bg-amber-400/20 border-amber-400 text-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                  title={isFavorited ? "お気に入り解除" : "お気に入り登録"}
                >
                  <StarIcon size={20} fill={isFavorited ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
            
            <div className="ml-auto flex gap-4 items-center">
              <button 
                onClick={handleFetchTrend} 
                disabled={fetchingTrend}
                className="px-4 py-3 bg-[#c89b3c] hover:bg-[#c89b3c]/80 text-black font-black rounded-xl transition-all flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(200,155,60,0.3)] hover:shadow-[0_0_25px_rgba(200,155,60,0.5)]"
              >
                <RefreshCw size={16} className={fetchingTrend ? "animate-spin" : ""} />
                {fetchingTrend ? "取得中..." : "最新トレンド取得"}
              </button>
              
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
          
          {/* 📈 最新パッチトレンド (自動収集) */}
          <div className="glass-panel border-t-2 border-cyan-400 p-5 rounded-2xl group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] shadow-cyan-400/20 relative">
            <h3 className="text-sm font-black mb-4 flex items-center gap-2 text-cyan-400">
              <Activity size={16} /> 📈 最新パッチトレンド (自動収集)
            </h3>
            {dataFields.patch_meta ? (
              <div className="flex flex-col gap-4 text-sm text-gray-200">
                <div className="flex gap-2 flex-wrap items-center w-full">
                  <span className="px-3 py-1 bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 rounded-lg font-bold text-xs">
                    Patch {dataFields.patch_meta.patch || '不明'}
                  </span>
                  <span className="px-3 py-1 bg-amber-400/10 border border-amber-400/30 text-amber-300 rounded-lg font-bold text-xs">
                    Tier {dataFields.patch_meta.tier || '-'}
                  </span>
                  <span className="px-3 py-1 bg-white/5 border border-white/10 text-white rounded-lg font-bold text-xs">
                    勝率 {dataFields.patch_meta.win_rate ? `${dataFields.patch_meta.win_rate}%` : '-'}
                  </span>
                  <span className="px-3 py-1 bg-white/5 border border-white/10 text-white rounded-lg font-bold text-xs">
                    ピック {dataFields.patch_meta.pick_rate ? `${dataFields.patch_meta.pick_rate}%` : '-'}
                  </span>
                  {dataFields.patch_meta.updated_at && (
                    <span className="px-3 py-1 bg-white/5 border border-white/10 text-gray-400 rounded-lg font-bold text-xs ml-auto">
                      最終更新: {new Date(dataFields.patch_meta.updated_at * 1000).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                
                {dataFields.patch_meta.trend_items && dataFields.patch_meta.trend_items.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 mb-2">🔥 コアアイテムビルド</h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      {dataFields.patch_meta.trend_items.map((item: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="px-3 py-1.5 bg-black/40 border border-white/5 rounded-lg text-xs font-bold text-gray-300">
                            {item}
                          </span>
                          {idx < dataFields.patch_meta.trend_items.length - 1 && <span className="text-gray-600 font-bold">→</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dataFields.patch_meta.trend_runes && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 mb-1">🧬 トレンドルーン</h4>
                    <p className="text-xs text-gray-300 font-bold">
                      {dataFields.patch_meta.trend_runes.keystone && <span className="text-cyan-300 mr-2">[{dataFields.patch_meta.trend_runes.keystone}]</span>}
                      {dataFields.patch_meta.trend_runes.primary} / {dataFields.patch_meta.trend_runes.secondary}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 italic text-xs py-4">最新パッチのトレンドデータは未収集です。上の「最新トレンド取得」ボタンを押してロードしてください。</p>
            )}
          </div>

          {/* 🏆 プロ推奨ルーン・ビルド (自動収集) */}
          <div className="glass-panel border-t-2 border-amber-400 p-5 rounded-2xl group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] shadow-amber-400/20 relative col-span-1 md:col-span-2">
            <h3 className="text-sm font-black mb-4 flex items-center gap-2 text-amber-400">
              <Award size={16} /> 🏆 プロ最先端ビルド (直近のソロキュー実例)
            </h3>
            {dataFields.pro_builds && dataFields.pro_builds.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dataFields.pro_builds.map((pb: any, idx: number) => (
                  <div key={idx} className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{pb.player}</span>
                        {pb.team && <span className="text-xs text-gray-400">({pb.team})</span>}
                      </div>
                      {pb.win_lose && (
                        <span className="text-xs px-2 py-0.5 bg-amber-400/10 border border-amber-400/30 text-amber-400 rounded-full font-black">
                          {pb.win_lose}
                        </span>
                      )}
                    </div>
                    
                    {pb.build && pb.build.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {pb.build.map((item: string, i: number) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="text-xs px-2.5 py-1 bg-black/50 border border-white/10 rounded-md text-gray-300 font-medium">
                              {item}
                            </span>
                            {i < pb.build.length - 1 && <span className="text-gray-700 text-xs">→</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {pb.runes && pb.runes.length > 0 && (
                      <div className="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-gray-500">ルーン:</span>
                        {pb.runes.map((rune: string, i: number) => (
                          <span key={i} className="px-1.5 py-0.5 bg-white/5 rounded border border-white/5 text-gray-300">
                            {rune}
                          </span>
                        ))}
                      </div>
                    )}

                    {pb.description && (
                      <p className="text-xs text-gray-300 leading-relaxed border-t border-white/5 pt-2 mt-1 italic">
                        💡 {pb.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic text-xs py-4">プロの採用ビルドデータは未収集です。上の「最新トレンド取得」ボタンを押してロードしてください。</p>
            )}
          </div>
          
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

        {/* ⚔️ 対面マッチアップ履歴 (バトルサーチ連携) */}
        <div className="glass-panel border-t-4 border-[#00cfef] rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#00cfef]/5 rounded-full blur-3xl group-hover:bg-[#00cfef]/10 transition-colors"></div>
          <h3 className="text-lg font-black font-mono mb-6 flex items-center gap-2 text-white"><Swords className="text-[#00cfef]" size={20} /> ⚔️ 対面マッチアップ履歴 (バトルサーチ連携)</h3>
          
          {matchupsList.length === 0 ? (
            <p className="text-gray-500 italic text-sm">バトルサーチにこのチャンピオンのマッチアップ記録はありません。</p>
          ) : (
            <div className="flex flex-col gap-3 relative z-10">
              {matchupsList.map((m) => {
                const isExpanded = expandedMatchupId === m.matchup_id;
                const rd = m.raw_data || {};
                const difficulty = rd.difficulty || 3;
                const result = rd.result || 'UNKNOWN';
                
                return (
                  <div key={m.matchup_id} className={`glass-panel border-l-4 rounded-xl transition-all ${
                    result === 'Win' ? 'border-[var(--color-success)] hover:bg-[#22c55e]/5' : 
                    result === 'Lose' ? 'border-[var(--color-danger)] hover:bg-[#ef4444]/5' : 
                    'border-gray-500 hover:bg-white/5'
                  }`}>
                    {/* ヘッダー部分。クリックでアコーディオン開閉 */}
                    <div 
                      onClick={() => setExpandedMatchupId(isExpanded ? null : m.matchup_id)}
                      className="p-4 flex items-center justify-between cursor-pointer select-none flex-wrap gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <img src={getChampIcon(m.enemy)} alt={m.enemy} className="w-10 h-10 rounded-full border border-white/10" />
                        <div>
                          <p className="text-sm font-bold text-white flex items-center gap-2">
                            vs {m.enemy} 
                            <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
                              result === 'Win' ? 'bg-[#22c55e]/15 text-[var(--color-success)]' : 
                              result === 'Lose' ? 'bg-[#ef4444]/15 text-[var(--color-danger)]' : 
                              'bg-white/10 text-gray-400'
                            }`}>
                              {result}
                            </span>
                          </p>
                          <p className="text-xs text-gray-400">{m.title || `${m.champion} vs ${m.enemy}`}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        {/* 難易度(星)表示 */}
                        <div className="flex gap-0.5" title={`難易度: ${difficulty}`}>
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <StarIcon 
                              key={idx} 
                              size={14} 
                              className={idx < difficulty ? "text-amber-400 fill-amber-400" : "text-gray-600"} 
                            />
                          ))}
                        </div>
                        
                        {/* バトルサーチの該当マッチアップへ直接ジャンプするリンク */}
                        <a 
                          href={`/matchups?champion=${m.champion}&enemy=${m.enemy}`}
                          onClick={(e) => e.stopPropagation()} // 親アコーディオンのクリック伝播を防止
                          className="px-3 py-1 bg-white/5 hover:bg-[#c89b3c]/20 hover:text-[#c89b3c] border border-white/10 rounded-lg text-xs font-bold transition-all flex items-center gap-1 text-gray-300"
                        >
                          <Edit2 size={12} /> 編集
                        </a>
                      </div>
                    </div>
                    
                    {/* アコーディオンによる詳細開閉 (winCondition, strategyを表示) */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }} 
                          animate={{ height: 'auto', opacity: 1 }} 
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-white/5 bg-black/20"
                        >
                          <div className="p-5 flex flex-col gap-4 text-sm leading-relaxed">
                            {rd.winCondition && (
                              <div>
                                <h4 className="text-xs font-bold text-[#00cfef] uppercase tracking-wider mb-1">💡 勝ち筋・主要コンセプト</h4>
                                <p className="text-gray-200">{rd.winCondition}</p>
                              </div>
                            )}
                            {m.strategy && (
                              <div>
                                <h4 className="text-xs font-bold text-[#c89b3c] uppercase tracking-wider mb-1">🧠 具体的な立ち回り・対策メモ</h4>
                                <div className="prose prose-invert prose-xs max-w-none text-gray-300">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.strategy}</ReactMarkdown>
                                </div>
                              </div>
                            )}
                            {!rd.winCondition && !m.strategy && (
                              <p className="text-gray-500 italic text-xs">このマッチアップに関する詳細な立ち回りメモは登録されていません。</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
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

      {/* 検索バー・フィルター（スクロール追従） */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="sticky top-0 z-20 flex flex-col gap-3 glass-panel p-4 rounded-2xl shadow-2xl backdrop-blur-2xl bg-[#06070a]/90">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c89b3c]" size={20} />
            <input type="text" placeholder="チャンピオン名で検索..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--color-surface)] border border-transparent focus:border-[#c89b3c]/50 rounded-xl py-3 pl-12 pr-4 text-white font-bold outline-none transition-colors" />
          </div>
          {/* ロール別フィルターボタン */}
          <div className="flex glass-panel p-1 rounded-xl items-center gap-0.5">
            {ROLE_LABELS.map(role => (
              <button key={role} onClick={() => setRoleFilter(role)}
                className={`px-3 py-2 rounded-lg text-xs font-black tracking-wider transition-all ${
                  roleFilter === role
                    ? 'bg-[#c89b3c] text-black shadow-lg shadow-[#c89b3c]/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>
                {role}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setShowPendingOnly(!showPendingOnly)} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${showPendingOnly ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'glass-panel text-gray-400 border-transparent hover:text-white'}`}
          >
            <Filter size={16} /> 要確認
          </button>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="glass-panel border-none rounded-xl px-4 py-2.5 font-bold text-[#c89b3c] outline-none min-w-[160px] cursor-pointer">
            <option value="updated_desc">更新日が新しい順</option>
            <option value="name_asc">名前順</option>
          </select>
        </div>
        {/* ヒット数表示 */}
        <div className="flex items-center gap-2 px-1 text-xs font-bold">
          <span className="text-gray-500">{champions.length}件中</span>
          <span className="text-[#c89b3c] text-sm">{filtered.length}件</span>
          <span className="text-gray-500">ヒット</span>
          {(search || roleFilter !== 'ALL' || showPendingOnly) && (
            <button onClick={() => { setSearch(''); setRoleFilter('ALL'); setShowPendingOnly(false); }}
              className="ml-2 text-gray-500 hover:text-white transition-colors underline underline-offset-2">
              フィルターをリセット
            </button>
          )}
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center items-center py-20"><div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4">
          {filtered.map(c => {
            const hasNote = !!champDates[c.id];
            const isFav = favoriteChamps.includes(c.id);
            return (
              <motion.div variants={itemVariants} key={c.id} onClick={() => setSelected(c)} 
                className={`glass-panel glass-panel-hover flex flex-col items-center gap-2 p-4 rounded-2xl cursor-pointer group relative ${hasNote ? 'bg-[#c89b3c]/10 border-[#c89b3c]/30 shadow-[0_0_15px_rgba(200,155,60,0.15)]' : ''}`}>
                {isFav && (
                  <div className="absolute top-2 right-2 text-amber-400 z-10" title="お気に入り">
                    <StarIcon size={12} fill="currentColor" />
                  </div>
                )}
                <div className="relative">
                  <img src={getChampIcon(c.id)} alt={c.name} className={`w-14 h-14 rounded-full border-2 transition-colors ${hasNote ? 'border-[#c89b3c]' : 'border-white/10 group-hover:border-white/30'}`} />
                  {hasNote && <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0a0b10] ${champPending[c.id] ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]' : 'bg-[#c89b3c]'}`}></div>}
                </div>
                <span className={`text-xs font-bold text-center leading-tight transition-colors ${hasNote ? 'text-[#c89b3c]' : 'text-gray-400 group-hover:text-white'}`}>{c.name}</span>
                {(() => {
                  const patchMeta = champPatchMetas[c.id];
                  if (!patchMeta) return null;
                  
                  // 更新から3日以上経っている場合は少し古いトレンドと判定 (259200秒)
                  const isOld = patchMeta.updated_at ? (Date.now() / 1000 - patchMeta.updated_at > 259200) : false;
                  
                  return (
                    <div className="flex flex-col items-center gap-0.5 mt-1 pointer-events-none">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black leading-none border transition-colors ${
                        isOld 
                          ? 'bg-amber-400/5 border-amber-400/20 text-amber-400/60' 
                          : 'bg-cyan-400/10 border-cyan-400/20 text-cyan-400'
                      }`}>
                        P{patchMeta.patch || '?'}
                      </span>
                      {patchMeta.updated_at && (
                        <span className={`text-[8px] font-bold leading-none ${isOld ? 'text-gray-600' : 'text-gray-500'}`}>
                          {getRelativeTimeString(patchMeta.updated_at)}
                        </span>
                      )}
                    </div>
                  );
                })()}
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

export default function ChampionsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#c89b3c] border-t-transparent rounded-full animate-spin"></div></div>}>
      <ChampionsContent />
    </Suspense>
  );
}
