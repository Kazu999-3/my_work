import React, { useState } from 'react';
import { RefreshCw, Trophy, Target, Search } from 'lucide-react';

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

  const [riotIgn, setRiotIgn] = useState('');
  const [fetchingRiot, setFetchingRiot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleStatChange = (name: string, field: string, value: string) => {
    const num = parseInt(value) || 0;
    setStats(prev => prev.map(p => p.name === name ? { ...p, [field]: num } : p));
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

      // Riot APIの結果から各プレイヤーのスタッツをマッピング
      // API側の participants: { riotIdName, kills, deaths, assists, win, teamId... }
      const newStats = [...stats];
      
      // チームID判定 (100:Blue, 200:Red)
      // fetchMatchからは全員分が返るが、KTMの参加者名とRiot ID名が完全一致しないことがある
      // 簡易的に名前の部分一致でマッピングを試みる
      data.participants.forEach((riotP: any) => {
        const matchingPlayerIndex = newStats.findIndex(p => {
          // もし ign フィールドがあればそれを使う
          if (p.ign && p.ign.toLowerCase().startsWith(riotP.riotIdName.toLowerCase())) return true;
          // なければ名前を比較
          return p.name.toLowerCase() === riotP.riotIdName.toLowerCase();
        });

        if (matchingPlayerIndex !== -1) {
          newStats[matchingPlayerIndex].kills = riotP.kills;
          newStats[matchingPlayerIndex].deaths = riotP.deaths;
          newStats[matchingPlayerIndex].assists = riotP.assists;
          newStats[matchingPlayerIndex].vision = riotP.visionScore;
          newStats[matchingPlayerIndex].champion_name = riotP.championName;
          newStats[matchingPlayerIndex].cs = riotP.totalMinionsKilled + riotP.neutralMinionsKilled;
          newStats[matchingPlayerIndex].damage_dealt = riotP.damageDealtToChampions;
          newStats[matchingPlayerIndex].damage_taken = riotP.totalDamageTaken;
          newStats[matchingPlayerIndex].objective_damage = riotP.damageDealtToObjectives;
          newStats[matchingPlayerIndex].heal_shield = riotP.totalHeal;
          // 勝敗も自動セット（代表者の1人から）
          if (riotP.win) {
            setWinningTeam(newStats[matchingPlayerIndex].team as 'BLUE' | 'RED');
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

      <div className="mb-6 flex flex-col md:flex-row gap-4 items-end bg-gray-900 p-4 rounded-lg border border-gray-800">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-400 mb-1">自動取得 (Riot API)</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="参加者の1人の Name#TAG を入力" 
              value={riotIgn}
              onChange={e => setRiotIgn(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white w-full outline-none focus:border-blue-500"
            />
            <button 
              onClick={fetchFromRiot}
              disabled={fetchingRiot}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-bold transition flex items-center gap-2 whitespace-nowrap"
            >
              {fetchingRiot ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              フェッチ
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">※Riot IDと登録名が一致しない場合は手動で入力が必要です。</p>
        </div>
      </div>

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
                <div className="w-10 text-center font-bold text-gray-500 text-xs">{s.currentRole}</div>
                <div className="w-24 truncate font-bold text-sm text-gray-300" title={s.name}>{s.name}</div>
                <div className="flex-1 flex gap-1 justify-end">
                  <input type="number" value={s.kills} onChange={e => handleStatChange(s.name, 'kills', e.target.value)} className="w-12 bg-gray-800 border border-gray-700 text-white text-center rounded text-sm" placeholder="K" />
                  <span className="text-gray-500">/</span>
                  <input type="number" value={s.deaths} onChange={e => handleStatChange(s.name, 'deaths', e.target.value)} className="w-12 bg-gray-800 border border-red-900 text-red-200 text-center rounded text-sm" placeholder="D" />
                  <span className="text-gray-500">/</span>
                  <input type="number" value={s.assists} onChange={e => handleStatChange(s.name, 'assists', e.target.value)} className="w-12 bg-gray-800 border border-gray-700 text-white text-center rounded text-sm" placeholder="A" />
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
                <div className="w-10 text-center font-bold text-gray-500 text-xs">{s.currentRole}</div>
                <div className="w-24 truncate font-bold text-sm text-gray-300" title={s.name}>{s.name}</div>
                <div className="flex-1 flex gap-1 justify-end">
                  <input type="number" value={s.kills} onChange={e => handleStatChange(s.name, 'kills', e.target.value)} className="w-12 bg-gray-800 border border-gray-700 text-white text-center rounded text-sm" placeholder="K" />
                  <span className="text-gray-500">/</span>
                  <input type="number" value={s.deaths} onChange={e => handleStatChange(s.name, 'deaths', e.target.value)} className="w-12 bg-gray-800 border border-red-900 text-red-200 text-center rounded text-sm" placeholder="D" />
                  <span className="text-gray-500">/</span>
                  <input type="number" value={s.assists} onChange={e => handleStatChange(s.name, 'assists', e.target.value)} className="w-12 bg-gray-800 border border-gray-700 text-white text-center rounded text-sm" placeholder="A" />
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

    </div>
  );
}
