'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { RefreshCw, Trophy, Target, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getChampIcon } from '../../../lib/ddragonClient';

type Role = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP';
const ROLES: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

interface PlayerStat {
  name: string;
  team: 'BLUE' | 'RED';
  currentRole: Role;
  kills: number;
  deaths: number;
  assists: number;
  vision: number;
  champion_name: string;
  damage_dealt: number;
  damage_taken: number;
  heal_shield: number;
  objective_damage: number;
  cs: number;
}

export default function CustomRecordPage() {
  const [playersPool, setPlayersPool] = useState<{name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [winningTeam, setWinningTeam] = useState<'BLUE' | 'RED' | null>(null);
  const [championsList, setChampionsList] = useState<{ id: string, name: string }[]>([]);
  const [activeChampSelector, setActiveChampSelector] = useState<{ team: 'BLUE' | 'RED', role: Role } | null>(null);
  const [champSearchQuery, setChampSearchQuery] = useState('');
  
  // 10人分のステートを初期化
  const [stats, setStats] = useState<PlayerStat[]>(() => {
    const initial: PlayerStat[] = [];
    ['BLUE', 'RED'].forEach(team => {
      ROLES.forEach(role => {
        initial.push({ 
          name: '', team: team as 'BLUE' | 'RED', currentRole: role, 
          kills: 0, deaths: 0, assists: 0, vision: 0, 
          champion_name: '', damage_dealt: 0, damage_taken: 0, 
          heal_shield: 0, objective_damage: 0, cs: 0 
        });
      });
    });
    return initial;
  });

  useEffect(() => {
    async function fetchPlayers() {
      const { data, error } = await supabase
        .from('ktm_players')
        .select('name, ign')
        .order('name', { ascending: true });
      if (!error && data) {
        setPlayersPool(data);
      }
      setLoading(false);
    }
    fetchPlayers();
  }, []);

  useEffect(() => {
    async function loadChampions() {
      try {
        const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await vRes.json();
        const cRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/ja_JP/champion.json`);
        const d = await cRes.json();
        const list = Object.values(d.data).map((c: any) => ({
          id: c.id,
          name: c.name
        }));
        list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        setChampionsList(list);
      } catch (err) {
        console.error('Failed to load champions from Ddragon:', err);
      }
    }
    loadChampions();
  }, []);

  const handleStatChange = (team: 'BLUE' | 'RED', role: Role, field: string, value: string) => {
    setStats(prev => prev.map(p => {
      if (p.team === team && p.currentRole === role) {
        if (field === 'name') return { ...p, name: value };
        if (field === 'champion_name') return { ...p, champion_name: value };
        const num = parseInt(value) || 0;
        return { ...p, [field]: num };
      }
      return p;
    }));
  };

  const handleSubmit = async () => {
    // バリデーション
    const missingNames = stats.filter(s => !s.name);
    if (missingNames.length > 0) {
      setMessage('全員の名前を選択してください。');
      return;
    }
    if (!winningTeam) {
      setMessage('勝利チームを選択してください。');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch('/api/match/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winningTeam,
          riotMatchId: null, // 手動入力のため常にnull
          participants: stats.map(s => ({
            name: s.name,
            team: s.team,
            role: s.currentRole,
            kills: s.kills,
            deaths: s.deaths,
            assists: s.assists,
            vision_score: s.vision,
            champion_name: s.champion_name,
            damage_dealt: s.damage_dealt,
            damage_taken: s.damage_taken,
            heal_shield: s.heal_shield,
            objective_damage: s.objective_damage,
            cs: s.cs
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      alert('試合結果を保存し、MMRを更新しました！');
      // リセット
      setStats(stats.map(s => ({ 
        ...s, name: '', kills: 0, deaths: 0, assists: 0, vision: 0,
        champion_name: '', damage_dealt: 0, damage_taken: 0, heal_shield: 0, objective_damage: 0, cs: 0 
      })));
      setWinningTeam(null);
    } catch (err: any) {
      setMessage(`保存エラー: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><RefreshCw className="h-8 w-8 text-blue-500 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Trophy className="h-8 w-8 text-emerald-400" />
            カスタム試合を手動記録
          </h1>
          <Link href="/balancer" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" /> チーム分け画面へ戻る
          </Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-2xl">
          {message && (
            <div className="mb-6 p-4 bg-amber-950/40 border border-amber-900/60 text-amber-200 rounded-lg text-sm font-bold">
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* BLUE TEAM */}
            <div>
              <h4 className="font-bold text-blue-400 mb-4 text-xl tracking-wider">🟦 BLUE TEAM</h4>
              <div className="space-y-3">
                {ROLES.map(role => {
                  const s = stats.find(x => x.team === 'BLUE' && x.currentRole === role)!;
                  return (
                    <div key={`BLUE-${role}`} className="flex items-center gap-2 bg-gray-800/80 p-3 rounded-lg border border-gray-700">
                      <div className="w-10 text-center font-bold text-gray-400 text-sm">{role}</div>
                      <select 
                        value={s.name}
                        onChange={e => handleStatChange('BLUE', role, 'name', e.target.value)}
                        className="w-28 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white outline-none focus:border-blue-500 text-sm"
                      >
                        <option value="">選択...</option>
                        {playersPool.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                      <button
                        onClick={() => setActiveChampSelector({ team: 'BLUE', role })}
                        type="button"
                        className="w-32 bg-gray-900 border border-gray-700 hover:border-blue-500 rounded px-2 py-1.5 text-gray-300 hover:text-white text-xs flex items-center justify-between gap-1 transition shrink-0"
                      >
                        <span className="truncate">
                          {s.champion_name ? (championsList.find(c => c.id === s.champion_name)?.name || 'チャンプ') : 'チャンプ選択'}
                        </span>
                        {s.champion_name && (
                          <img 
                            src={getChampIcon(s.champion_name)} 
                            className="w-5 h-5 rounded-full border border-gray-600 shrink-0 object-cover" 
                            alt={s.champion_name}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        )}
                      </button>
                      <div className="flex-1 flex gap-1 justify-end">
                        <input type="number" value={s.kills} onChange={e => handleStatChange('BLUE', role, 'kills', e.target.value)} className="w-11 bg-gray-900 border border-gray-700 text-white text-center rounded py-1 text-sm" placeholder="K" />
                        <span className="text-gray-500 self-center text-xs">/</span>
                        <input type="number" value={s.deaths} onChange={e => handleStatChange('BLUE', role, 'deaths', e.target.value)} className="w-11 bg-gray-900 border border-red-900/50 text-red-200 text-center rounded py-1 text-sm" placeholder="D" />
                        <span className="text-gray-500 self-center text-xs">/</span>
                        <input type="number" value={s.assists} onChange={e => handleStatChange('BLUE', role, 'assists', e.target.value)} className="w-11 bg-gray-900 border border-gray-700 text-white text-center rounded py-1 text-sm" placeholder="A" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RED TEAM */}
            <div>
              <h4 className="font-bold text-red-400 mb-4 text-xl tracking-wider">🟥 RED TEAM</h4>
              <div className="space-y-3">
                {ROLES.map(role => {
                  const s = stats.find(x => x.team === 'RED' && x.currentRole === role)!;
                  return (
                    <div key={`RED-${role}`} className="flex items-center gap-2 bg-gray-800/80 p-3 rounded-lg border border-gray-700">
                      <div className="w-10 text-center font-bold text-gray-400 text-sm">{role}</div>
                      <select 
                        value={s.name}
                        onChange={e => handleStatChange('RED', role, 'name', e.target.value)}
                        className="w-28 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white outline-none focus:border-red-500 text-sm"
                      >
                        <option value="">選択...</option>
                        {playersPool.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                      <button
                        onClick={() => setActiveChampSelector({ team: 'RED', role })}
                        type="button"
                        className="w-32 bg-gray-900 border border-gray-700 hover:border-red-500 rounded px-2 py-1.5 text-gray-300 hover:text-white text-xs flex items-center justify-between gap-1 transition shrink-0"
                      >
                        <span className="truncate">
                          {s.champion_name ? (championsList.find(c => c.id === s.champion_name)?.name || 'チャンプ') : 'チャンプ選択'}
                        </span>
                        {s.champion_name && (
                          <img 
                            src={getChampIcon(s.champion_name)} 
                            className="w-5 h-5 rounded-full border border-gray-600 shrink-0 object-cover" 
                            alt={s.champion_name}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        )}
                      </button>
                      <div className="flex-1 flex gap-1 justify-end">
                        <input type="number" value={s.kills} onChange={e => handleStatChange('RED', role, 'kills', e.target.value)} className="w-11 bg-gray-900 border border-gray-700 text-white text-center rounded py-1 text-sm" placeholder="K" />
                        <span className="text-gray-500 self-center text-xs">/</span>
                        <input type="number" value={s.deaths} onChange={e => handleStatChange('RED', role, 'deaths', e.target.value)} className="w-11 bg-gray-900 border border-red-900/50 text-red-200 text-center rounded py-1 text-sm" placeholder="D" />
                        <span className="text-gray-500 self-center text-xs">/</span>
                        <input type="number" value={s.assists} onChange={e => handleStatChange('RED', role, 'assists', e.target.value)} className="w-11 bg-gray-900 border border-gray-700 text-white text-center rounded py-1 text-sm" placeholder="A" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 bg-gray-800/50 p-2 rounded-lg border border-gray-700">
              <span className="font-bold text-gray-400 px-2">勝利チーム:</span>
              <button 
                onClick={() => setWinningTeam('BLUE')}
                className={`px-8 py-3 rounded-lg font-black transition ${winningTeam === 'BLUE' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.6)]' : 'bg-gray-900 text-gray-400 border border-gray-700 hover:bg-gray-700'}`}
              >
                BLUE WIN
              </button>
              <button 
                onClick={() => setWinningTeam('RED')}
                className={`px-8 py-3 rounded-lg font-black transition ${winningTeam === 'RED' ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.6)]' : 'bg-gray-900 text-gray-400 border border-gray-700 hover:bg-gray-700'}`}
              >
                RED WIN
              </button>
            </div>

            <button 
              onClick={handleSubmit}
              disabled={submitting || !winningTeam}
              className={`px-8 py-4 rounded-xl font-black text-lg transition flex items-center gap-3 ${
                submitting || !winningTeam ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 shadow-xl shadow-emerald-900/30'
              }`}
            >
              {submitting ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Target className="h-6 w-6" />}
              試合結果を保存してMMR更新
            </button>
          </div>
        </div>
      </div>

      {/* チャンピオン選択モーダル */}
      {activeChampSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-400" />
                チャンピオン選択 ({activeChampSelector.team} - {activeChampSelector.role})
              </h3>
              <button 
                onClick={() => { setActiveChampSelector(null); setChampSearchQuery(''); }}
                className="text-gray-400 hover:text-white text-sm bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 transition"
              >
                閉じる
              </button>
            </div>
            
            <input 
              type="text" 
              placeholder="チャンピオン名で検索 (ひらがな・カタカナ・英語名)..." 
              value={champSearchQuery}
              onChange={e => setChampSearchQuery(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white mb-4 outline-none focus:border-emerald-500 text-sm"
              autoFocus
            />
            
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {championsList
                .filter(c => 
                  c.name.toLowerCase().includes(champSearchQuery.toLowerCase()) || 
                  c.id.toLowerCase().includes(champSearchQuery.toLowerCase())
                )
                .map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      handleStatChange(activeChampSelector.team, activeChampSelector.role, 'champion_name', c.id);
                      setActiveChampSelector(null);
                      setChampSearchQuery('');
                    }}
                    type="button"
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-gray-800 transition group"
                  >
                    <img 
                      src={getChampIcon(c.id)} 
                      className="w-12 h-12 rounded-xl border border-gray-800 group-hover:border-emerald-500 transition object-cover" 
                      alt={c.name} 
                    />
                    <span className="text-[10px] text-gray-400 truncate w-14 text-center group-hover:text-white transition">
                      {c.name}
                    </span>
                  </button>
                ))
              }
              {championsList.filter(c => 
                c.name.toLowerCase().includes(champSearchQuery.toLowerCase()) || 
                c.id.toLowerCase().includes(champSearchQuery.toLowerCase())
              ).length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500 text-sm">
                  該当するチャンピオンが見つかりません。
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
