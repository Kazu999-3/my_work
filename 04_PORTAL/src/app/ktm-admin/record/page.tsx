'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { RefreshCw, Trophy, Target, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
}

export default function CustomRecordPage() {
  const [playersPool, setPlayersPool] = useState<{name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 10人分のステートを初期化
  const [stats, setStats] = useState<PlayerStat[]>(() => {
    const initial: PlayerStat[] = [];
    ['BLUE', 'RED'].forEach(team => {
      ROLES.forEach(role => {
        initial.push({ name: '', team: team as 'BLUE' | 'RED', currentRole: role, kills: 0, deaths: 0, assists: 0, vision: 0 });
      });
    });
    return initial;
  });

  const [riotIgn, setRiotIgn] = useState('');
  const [fetchingRiot, setFetchingRiot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [winningTeam, setWinningTeam] = useState<'BLUE' | 'RED' | null>(null);

  useEffect(() => {
    async function fetchPlayers() {
      const { data, error } = await supabase
        .from('ktm_players')
        .select('name')
        .order('name', { ascending: true });
      if (!error && data) {
        setPlayersPool(data);
      }
      setLoading(false);
    }
    fetchPlayers();
  }, []);

  const handleStatChange = (team: 'BLUE' | 'RED', role: Role, field: string, value: string) => {
    setStats(prev => prev.map(p => {
      if (p.team === team && p.currentRole === role) {
        if (field === 'name') return { ...p, name: value };
        const num = parseInt(value) || 0;
        return { ...p, [field]: num };
      }
      return p;
    }));
  };

  const fetchFromRiot = async () => {
    if (!riotIgn) {
      setMessage('Riot IGN (Name#TAG) を入力してください。');
      return;
    }
    setFetchingRiot(true);
    setMessage('');
    try {
      const res = await fetch('/api/riot/fetch-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ign: riotIgn })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const newStats = [...stats];
      data.participants.forEach((riotP: any) => {
        // 現在選択されている名前と一致するか確認
        const matchingPlayerIndex = newStats.findIndex(p => p.name.toLowerCase() === riotP.riotIdName.toLowerCase());
        if (matchingPlayerIndex !== -1) {
          newStats[matchingPlayerIndex].kills = riotP.kills;
          newStats[matchingPlayerIndex].deaths = riotP.deaths;
          newStats[matchingPlayerIndex].assists = riotP.assists;
          newStats[matchingPlayerIndex].vision = riotP.visionScore;
          if (riotP.win) {
            setWinningTeam(newStats[matchingPlayerIndex].team);
          }
        }
      });
      setStats(newStats);
      setMessage('Riot APIからスタッツを取得しました。一致しなかったプレイヤーは手動で入力してください。');
    } catch (err: any) {
      setMessage(`Riot取得エラー: ${err.message}`);
    } finally {
      setFetchingRiot(false);
    }
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
          participants: stats.map(s => ({
            name: s.name,
            team: s.team,
            role: s.currentRole,
            kills: s.kills,
            deaths: s.deaths,
            assists: s.assists,
            vision_score: s.vision
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      alert('試合結果を保存し、MMRを更新しました！');
      // リセット
      setStats(stats.map(s => ({ ...s, name: '', kills: 0, deaths: 0, assists: 0, vision: 0 })));
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
          <Link href="/ktm-admin" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" /> 管理画面へ戻る
          </Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-2xl">
          <div className="mb-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-400" /> Riot API からスタッツを自動取得
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              ※先に下のフォームで「全員の名前（KTM登録名）」を選択してから取得ボタンを押してください。名前が一致した人のKDAが自動入力されます。
            </p>
            <div className="flex gap-2 max-w-xl">
              <input 
                type="text" 
                placeholder="参加者の1人の Name#TAG を入力" 
                value={riotIgn}
                onChange={e => setRiotIgn(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white flex-1 outline-none focus:border-blue-500"
              />
              <button 
                onClick={fetchFromRiot}
                disabled={fetchingRiot}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded font-bold transition flex items-center gap-2 whitespace-nowrap"
              >
                {fetchingRiot ? <RefreshCw className="h-4 w-4 animate-spin" /> : '取得'}
              </button>
            </div>
            {message && <div className="mt-4 text-amber-400 text-sm font-bold">{message}</div>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* BLUE TEAM */}
            <div>
              <h4 className="font-bold text-blue-400 mb-4 text-xl tracking-wider">🟦 BLUE TEAM</h4>
              <div className="space-y-3">
                {ROLES.map(role => {
                  const s = stats.find(x => x.team === 'BLUE' && x.currentRole === role)!;
                  return (
                    <div key={`BLUE-${role}`} className="flex items-center gap-3 bg-gray-800/80 p-3 rounded-lg border border-gray-700">
                      <div className="w-12 text-center font-bold text-gray-400">{role}</div>
                      <select 
                        value={s.name}
                        onChange={e => handleStatChange('BLUE', role, 'name', e.target.value)}
                        className="w-32 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white outline-none focus:border-blue-500"
                      >
                        <option value="">選択...</option>
                        {playersPool.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                      <div className="flex-1 flex gap-2 justify-end">
                        <input type="number" value={s.kills} onChange={e => handleStatChange('BLUE', role, 'kills', e.target.value)} className="w-14 bg-gray-900 border border-gray-700 text-white text-center rounded py-1" placeholder="K" />
                        <span className="text-gray-500 self-center">/</span>
                        <input type="number" value={s.deaths} onChange={e => handleStatChange('BLUE', role, 'deaths', e.target.value)} className="w-14 bg-gray-900 border border-red-900/50 text-red-200 text-center rounded py-1" placeholder="D" />
                        <span className="text-gray-500 self-center">/</span>
                        <input type="number" value={s.assists} onChange={e => handleStatChange('BLUE', role, 'assists', e.target.value)} className="w-14 bg-gray-900 border border-gray-700 text-white text-center rounded py-1" placeholder="A" />
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
                    <div key={`RED-${role}`} className="flex items-center gap-3 bg-gray-800/80 p-3 rounded-lg border border-gray-700">
                      <div className="w-12 text-center font-bold text-gray-400">{role}</div>
                      <select 
                        value={s.name}
                        onChange={e => handleStatChange('RED', role, 'name', e.target.value)}
                        className="w-32 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white outline-none focus:border-red-500"
                      >
                        <option value="">選択...</option>
                        {playersPool.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                      <div className="flex-1 flex gap-2 justify-end">
                        <input type="number" value={s.kills} onChange={e => handleStatChange('RED', role, 'kills', e.target.value)} className="w-14 bg-gray-900 border border-gray-700 text-white text-center rounded py-1" placeholder="K" />
                        <span className="text-gray-500 self-center">/</span>
                        <input type="number" value={s.deaths} onChange={e => handleStatChange('RED', role, 'deaths', e.target.value)} className="w-14 bg-gray-900 border border-red-900/50 text-red-200 text-center rounded py-1" placeholder="D" />
                        <span className="text-gray-500 self-center">/</span>
                        <input type="number" value={s.assists} onChange={e => handleStatChange('RED', role, 'assists', e.target.value)} className="w-14 bg-gray-900 border border-gray-700 text-white text-center rounded py-1" placeholder="A" />
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
    </div>
  );
}
