import React, { useState, useEffect } from 'react';
import { RefreshCw, Trophy, Target } from 'lucide-react';
import { getChampIcon } from '../../lib/ddragonClient';

interface MatchRecordPanelProps {
  balanceResult: any;
  onComplete: () => void;
}

export default function MatchRecordPanel({ balanceResult, onComplete }: MatchRecordPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [winningTeam, setWinningTeam] = useState<'BLUE' | 'RED' | null>(null);
  
  // KDAなどの入力状態
  const [stats, setStats] = useState<any[]>(() => {
    const initial: any[] = [];
    if (balanceResult?.teamBlue) {
      balanceResult.teamBlue.forEach((p: any) => initial.push({ ...p, team: 'BLUE', kills: 0, deaths: 0, assists: 0, vision: 0, champion_name: '', cs: 0, damage_dealt: 0, damage_taken: 0, objective_damage: 0, heal_shield: 0 }));
    }
    if (balanceResult?.teamRed) {
      balanceResult.teamRed.forEach((p: any) => initial.push({ ...p, team: 'RED', kills: 0, deaths: 0, assists: 0, vision: 0, champion_name: '', cs: 0, damage_dealt: 0, damage_taken: 0, objective_damage: 0, heal_shield: 0 }));
    }
    return initial;
  });

  const [championsList, setChampionsList] = useState<{ id: string, name: string }[]>([]);
  const [activeChampSelectorPlayer, setActiveChampSelectorPlayer] = useState<string | null>(null);
  const [champSearchQuery, setChampSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

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

  const handleStatChange = (name: string, field: string, value: string) => {
    if (field === 'champion_name') {
      setStats(prev => prev.map(p => p.name === name ? { ...p, [field]: value } : p));
      return;
    }
    const num = parseInt(value) || 0;
    setStats(prev => prev.map(p => p.name === name ? { ...p, [field]: num } : p));
  };

  const handleSubmit = async () => {
    if (!winningTeam) {
      setMessage('勝利チームを選択してください。');
      return;
    }

    const pwd = prompt('保存するには管理者パスワードを入力してください:');
    if (pwd === null) return; // キャンセル
    if (!pwd) {
      setMessage('管理者パスワードが必要です。');
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
          riotMatchId: null,
          adminPassword: pwd,
          participants: stats.map(s => ({
            name: s.name,
            team: s.team,
            role: s.currentRole,
            kills: s.kills,
            deaths: s.deaths,
            assists: s.assists,
            vision_score: s.vision,
            champion_name: s.champion_name,
            cs: s.cs,
            damage_dealt: s.damage_dealt,
            damage_taken: s.damage_taken,
            objective_damage: s.objective_damage,
            heal_shield: s.heal_shield
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      alert('試合結果を保存し、MMRを更新しました！');
      onComplete(); // 親コンポーネントをリセット
    } catch (err: any) {
      setMessage(`保存エラー: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="mt-4 text-center">
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-6 py-2 rounded-lg font-bold transition flex items-center gap-2 mx-auto"
        >
          <Target className="h-4 w-4" /> 試合結果を入力してMMRを更新する
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-gray-950 border border-gray-700 rounded-xl p-6 shadow-2xl">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Target className="h-5 w-5 text-blue-400" /> 試合結果入力
      </h3>

      {message && (
        <div className="mb-4 p-3 bg-gray-800 border border-gray-700 text-gray-300 rounded text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* BLUE TEAM INPUT */}
        <div>
          <h4 className="font-bold text-blue-400 mb-2">🟦 BLUE TEAM</h4>
          <div className="space-y-2">
            {stats.filter(s => s.team === 'BLUE').map(s => (
              <div key={s.name} className="flex items-center gap-2 bg-gray-900 p-2 rounded border border-gray-800">
                <div className="w-8 text-center font-bold text-gray-500 text-xs">{s.currentRole}</div>
                <div className="w-20 truncate font-bold text-sm text-gray-300" title={s.name}>{s.name}</div>
                <button
                  onClick={() => setActiveChampSelectorPlayer(s.name)}
                  type="button"
                  className="w-28 bg-gray-850 border border-gray-700 hover:border-blue-500 rounded px-1.5 py-1 text-gray-300 hover:text-white text-xs flex items-center justify-between gap-1 transition shrink-0"
                >
                  <span className="truncate">
                    {s.champion_name ? (championsList.find(c => c.id === s.champion_name)?.name || 'チャンプ') : '選択'}
                  </span>
                  {s.champion_name && (
                    <img 
                      src={getChampIcon(s.champion_name)} 
                      className="w-4 h-4 rounded-full border border-gray-600 shrink-0 object-cover" 
                      alt={s.champion_name}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                </button>
                <div className="flex-1 flex gap-1 justify-end">
                  <input type="number" value={s.kills} onChange={e => handleStatChange(s.name, 'kills', e.target.value)} className="w-10 bg-gray-850 border border-gray-700 text-white text-center rounded text-xs py-0.5" placeholder="K" />
                  <span className="text-gray-500 text-xs self-center">/</span>
                  <input type="number" value={s.deaths} onChange={e => handleStatChange(s.name, 'deaths', e.target.value)} className="w-10 bg-gray-855 border border-red-900 text-red-200 text-center rounded text-xs py-0.5" placeholder="D" />
                  <span className="text-gray-500 text-xs self-center">/</span>
                  <input type="number" value={s.assists} onChange={e => handleStatChange(s.name, 'assists', e.target.value)} className="w-10 bg-gray-850 border border-gray-700 text-white text-center rounded text-xs py-0.5" placeholder="A" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RED TEAM INPUT */}
        <div>
          <h4 className="font-bold text-red-400 mb-2">🟥 RED TEAM</h4>
          <div className="space-y-2">
            {stats.filter(s => s.team === 'RED').map(s => (
              <div key={s.name} className="flex items-center gap-2 bg-gray-900 p-2 rounded border border-gray-800">
                <div className="w-8 text-center font-bold text-gray-500 text-xs">{s.currentRole}</div>
                <div className="w-20 truncate font-bold text-sm text-gray-300" title={s.name}>{s.name}</div>
                <button
                  onClick={() => setActiveChampSelectorPlayer(s.name)}
                  type="button"
                  className="w-28 bg-gray-855 border border-gray-700 hover:border-red-500 rounded px-1.5 py-1 text-gray-300 hover:text-white text-xs flex items-center justify-between gap-1 transition shrink-0"
                >
                  <span className="truncate">
                    {s.champion_name ? (championsList.find(c => c.id === s.champion_name)?.name || 'チャンプ') : '選択'}
                  </span>
                  {s.champion_name && (
                    <img 
                      src={getChampIcon(s.champion_name)} 
                      className="w-4 h-4 rounded-full border border-gray-600 shrink-0 object-cover" 
                      alt={s.champion_name}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                </button>
                <div className="flex-1 flex gap-1 justify-end">
                  <input type="number" value={s.kills} onChange={e => handleStatChange(s.name, 'kills', e.target.value)} className="w-10 bg-gray-855 border border-gray-700 text-white text-center rounded text-xs py-0.5" placeholder="K" />
                  <span className="text-gray-500 text-xs self-center">/</span>
                  <input type="number" value={s.deaths} onChange={e => handleStatChange(s.name, 'deaths', e.target.value)} className="w-10 bg-gray-855 border border-red-900 text-red-200 text-center rounded text-xs py-0.5" placeholder="D" />
                  <span className="text-gray-500 text-xs self-center">/</span>
                  <input type="number" value={s.assists} onChange={e => handleStatChange(s.name, 'assists', e.target.value)} className="w-10 bg-gray-855 border border-gray-700 text-white text-center rounded text-xs py-0.5" placeholder="A" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 勝敗選択と保存 */}
      <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-bold text-gray-400">勝利チーム:</span>
          <button 
            onClick={() => setWinningTeam('BLUE')}
            className={`px-6 py-2 rounded-lg font-bold transition ${winningTeam === 'BLUE' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'}`}
          >
            BLUE WIN
          </button>
          <button 
            onClick={() => setWinningTeam('RED')}
            className={`px-6 py-2 rounded-lg font-bold transition ${winningTeam === 'RED' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'}`}
          >
            RED WIN
          </button>
        </div>

        <button 
          onClick={handleSubmit}
          disabled={submitting || !winningTeam}
          className={`px-8 py-3 rounded-lg font-black text-lg transition flex items-center gap-2 ${
            submitting || !winningTeam ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 shadow-xl shadow-emerald-900/30'
          }`}
        >
          {submitting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Trophy className="h-5 w-5" />}
          結果を保存してMMRを更新
        </button>
      </div>

      {/* チャンピオン選択モーダル */}
      {activeChampSelectorPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-400" />
                チャンピオン選択 ({activeChampSelectorPlayer})
              </h3>
              <button 
                onClick={() => { setActiveChampSelectorPlayer(null); setChampSearchQuery(''); }}
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
                      handleStatChange(activeChampSelectorPlayer, 'champion_name', c.id);
                      setActiveChampSelectorPlayer(null);
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
