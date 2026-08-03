import { useEffect, useState } from 'react';
import { History, Swords, Trophy, Calendar, RefreshCw, Edit, Trash2, Search, AlertCircle, X, Target, GripVertical } from 'lucide-react';
import Image from 'next/image';
import { getChampIcon } from '../../lib/ddragonClient';

interface Match {
  id: string;
  created_at: string;
  winning_team: 'BLUE' | 'RED';
  participants: Participant[];
}

interface Participant {
  player_name: string;
  team: 'BLUE' | 'RED';
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  kda_score: number;
  mmr_delta: number;
  champion_name?: string;
  cs?: number;
  damage_dealt?: number;
  vision_score?: number;
}

const ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

export default function MatchHistoryPanel() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 編集・削除用の追加ステート
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [draggedParticipantIndex, setDraggedParticipantIndex] = useState<number | null>(null);
  const [playersPool, setPlayersPool] = useState<{ name: string }[]>([]);
  const [championsList, setChampionsList] = useState<{ id: string, name: string }[]>([]);
  const [activeChampSelectorPlayer, setActiveChampSelectorPlayer] = useState<string | null>(null);
  const [champSearchQuery, setChampSearchQuery] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchMatches = async () => {
    try {
      const res = await fetch('/api/match/history?limit=30');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '取得に失敗しました');

      setMatches(data.matches);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  useEffect(() => {
    async function loadPlayersAndChamps() {
      try {
        const pRes = await fetch('/api/players/list');
        const pJson = await pRes.json();
        if (pRes.ok && pJson.players) {
          setPlayersPool(pJson.players);
        }

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
        console.error('Failed to load initial data:', err);
      }
    }
    loadPlayersAndChamps();
  }, []);

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm(`本当にこの試合 (Match #${matchId}) を削除しますか？\n(※削除後、名簿から「Rebuild」を実行してMMRを再計算するまで整合性は失われます)`)) return;
    
    try {
      const res = await fetch(`/api/admin/match/${matchId}`, {
        method: 'DELETE',
        credentials: 'include', // 管理者Cookieを送らないと401になる
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '削除に失敗しました');

      alert('試合履歴を削除しました。プレイヤーのMMRに反映させるために、必ず名簿タブの「Rebuild」を実行してください。');
      setActionMessage({ type: 'success', text: '試合履歴を削除しました。「Rebuild」を実行してください。' });
      fetchMatches();
    } catch (err: any) {
      alert(`削除エラー: ${err.message}`);
      setActionMessage({ type: 'error', text: `削除エラー: ${err.message}` });
    }
  };

  const handleSaveMatch = async () => {
    if (!editingMatch) return;
    setSaving(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/match/${editingMatch.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winningTeam: editingMatch.winning_team,
          participants: editingMatch.participants
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '更新に失敗しました');

      alert('試合データを更新しました。プレイヤーのMMRに反映させるために、必ず名簿タブの「Rebuild」を実行してください。');
      setActionMessage({ type: 'success', text: '試合データを更新しました。「Rebuild」を実行してください。' });
      setEditingMatch(null);
      fetchMatches();
    } catch (err: any) {
      alert(`更新エラー: ${err.message}`);
      setActionMessage({ type: 'error', text: `更新エラー: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleEditingParticipantChange = (index: number, field: string, value: any) => {
    if (!editingMatch) return;
    setEditingMatch(prev => {
      if (!prev) return null;
      const nextParticipants = [...prev.participants];
      if (field === 'kills' || field === 'deaths' || field === 'assists') {
        nextParticipants[index] = { ...nextParticipants[index], [field]: parseInt(value) || 0 };
      } else {
        nextParticipants[index] = { ...nextParticipants[index], [field]: value };
      }
      return { ...prev, participants: nextParticipants };
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedParticipantIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const rawIndex = e.dataTransfer.getData('text/plain');
    if (!rawIndex) return;
    const sourceIndex = parseInt(rawIndex, 10);

    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;
    if (!editingMatch) return;

    const pStart = editingMatch.participants[sourceIndex];
    const pTarget = editingMatch.participants[targetIndex];

    // 同一チーム内のみスワップを許可する
    if (pStart.team !== pTarget.team) return;

    setEditingMatch(prev => {
      if (!prev) return null;
      const nextParticipants = [...prev.participants];

      // role と team 以外のデータをスワップ
      const updatedStart = {
        ...pStart,
        player_name: pTarget.player_name,
        champion_name: pTarget.champion_name,
        kills: pTarget.kills,
        deaths: pTarget.deaths,
        assists: pTarget.assists,
        kda_score: pTarget.kda_score,
        mmr_delta: pTarget.mmr_delta,
        cs: pTarget.cs,
        damage_dealt: pTarget.damage_dealt,
        vision_score: pTarget.vision_score
      };

      const updatedTarget = {
        ...pTarget,
        player_name: pStart.player_name,
        champion_name: pStart.champion_name,
        kills: pStart.kills,
        deaths: pStart.deaths,
        assists: pStart.assists,
        kda_score: pStart.kda_score,
        mmr_delta: pStart.mmr_delta,
        cs: pStart.cs,
        damage_dealt: pStart.damage_dealt,
        vision_score: pStart.vision_score
      };

      nextParticipants[sourceIndex] = updatedStart;
      nextParticipants[targetIndex] = updatedTarget;

      return { ...prev, participants: nextParticipants };
    });

    setDraggedParticipantIndex(null);
  };

  if (loading) {
    return <div className="py-20 flex flex-col items-center justify-center text-stone-400"><RefreshCw className="h-8 w-8 animate-spin text-amber-500 mb-4" />戦績データを読み込み中...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-700 font-bold bg-red-100 rounded-xl border border-red-200">Error: {error}</div>;
  }  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-emerald-100 rounded-xl">
          <History className="h-6 w-6 text-emerald-700" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-stone-900">直近の試合履歴</h2>
          <p className="text-stone-400 font-medium text-sm">最新30件の試合結果とMMR変動履歴</p>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${actionMessage.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium whitespace-pre-wrap">{actionMessage.text}</p>
        </div>
      )}

      <div className="space-y-6">
        {matches.map(match => {
          const blueTeam = match.participants.filter(p => p.team === 'BLUE');
          const redTeam = match.participants.filter(p => p.team === 'RED');

          // ロール順にソート
          const sortByRole = (arr: Participant[]) => ROLES.map(role => arr.find(p => p.role === role)).filter(Boolean) as Participant[];
          const blueSorted = sortByRole(blueTeam);
          const redSorted = sortByRole(redTeam);

          const dateObj = new Date(match.created_at);
          const dateStr = `${dateObj.getFullYear()}/${String(dateObj.getMonth()+1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

          return (
            <div key={match.id} className="bg-surface border border-border rounded-xl overflow-hidden shadow-xl">
              {/* Header */}
              <div className={`p-4 flex items-center justify-between border-b ${
                match.winning_team === 'BLUE' ? 'bg-blue-900/20 border-blue-900/50' : 'bg-red-900/20 border-red-900/50'
              }`}>
                <div className="flex items-center gap-3">
                  <Trophy className={`h-5 w-5 ${match.winning_team === 'BLUE' ? 'text-blue-400' : 'text-red-400'}`} />
                  <span className={`font-black tracking-wider text-lg ${match.winning_team === 'BLUE' ? 'text-blue-400' : 'text-red-400'}`}>
                    {match.winning_team} WIN
                  </span>
                </div>
                <div className="flex items-center gap-4 text-stone-400 text-sm font-bold">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {dateStr}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditingMatch(JSON.parse(JSON.stringify(match)))}
                      className="p-1.5 bg-black/5 hover:bg-black/8 border border-border text-orange-700 hover:text-stone-900 rounded transition"
                      title="試合履歴を編集"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMatch(match.id)}
                      className="p-1.5 bg-black/5 hover:bg-red-100 border border-border text-red-700 hover:text-stone-900 rounded transition"
                      title="試合履歴を削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
                {/* BLUE TEAM */}
                <div className="flex-1 p-4 bg-black/3">
                  <div className="space-y-3">
                    {blueSorted.map(p => {
                      const maxDmg = Math.max(...blueSorted.map(x => x.damage_dealt || 0));
                      const dmgPercent = maxDmg > 0 ? ((p.damage_dealt || 0) / maxDmg) * 100 : 0;
                      return (
                        <div key={p.player_name} className="flex items-center gap-3 bg-white/70 p-2 rounded hover:bg-black/5 transition">
                          <div className="w-8 text-center text-xs font-bold text-stone-500 flex-shrink-0">{p.role}</div>
                          {p.champion_name ? (
                            <Image
                              src={getChampIcon(p.champion_name)}
                              alt={p.champion_name}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full border border-border flex-shrink-0 object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-black/5 flex-shrink-0 border border-border flex items-center justify-center text-[10px] text-stone-500">?</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-stone-800 truncate text-sm">{p.player_name}</div>
                            <div className="text-xs text-stone-500 mt-0.5 flex gap-2">
                              <span>CS {p.cs || 0}</span>
                              <span title="Vision Score">VS {p.vision_score || 0}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1 flex-shrink-0 w-24">
                            <div className="text-xs font-bold text-stone-700">
                              {p.kills} / <span className="text-red-700">{p.deaths}</span> / {p.assists}
                            </div>
                            <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden mt-0.5">
                              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${dmgPercent}%` }}></div>
                            </div>
                            <div className="text-[10px] text-stone-500">{p.damage_dealt ? p.damage_dealt.toLocaleString() : '0'} DMG</div>
                          </div>

                          <div className={`w-12 text-right font-black text-sm flex-shrink-0 ${p.mmr_delta > 0 ? 'text-emerald-700' : p.mmr_delta < 0 ? 'text-red-700' : 'text-stone-500'}`}>
                            {p.mmr_delta > 0 ? '+' : ''}{p.mmr_delta}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* RED TEAM */}
                <div className="flex-1 p-4 bg-black/3">
                  <div className="space-y-3">
                    {redSorted.map(p => {
                      const maxDmg = Math.max(...redSorted.map(x => x.damage_dealt || 0));
                      const dmgPercent = maxDmg > 0 ? ((p.damage_dealt || 0) / maxDmg) * 100 : 0;
                      return (
                        <div key={p.player_name} className="flex items-center gap-3 bg-white/70 p-2 rounded hover:bg-black/5 transition">
                          <div className="w-8 text-center text-xs font-bold text-stone-500 flex-shrink-0">{p.role}</div>
                          {p.champion_name ? (
                            <Image
                              src={getChampIcon(p.champion_name)}
                              alt={p.champion_name}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full border border-border flex-shrink-0 object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-black/5 flex-shrink-0 border border-border flex items-center justify-center text-[10px] text-stone-500">?</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-stone-800 truncate text-sm">{p.player_name}</div>
                            <div className="text-xs text-stone-500 mt-0.5 flex gap-2">
                              <span>CS {p.cs || 0}</span>
                              <span title="Vision Score">VS {p.vision_score || 0}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1 flex-shrink-0 w-24">
                            <div className="text-xs font-bold text-stone-700">
                              {p.kills} / <span className="text-red-700">{p.deaths}</span> / {p.assists}
                            </div>
                            <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden mt-0.5">
                              <div className="h-full bg-red-500 rounded-full" style={{ width: `${dmgPercent}%` }}></div>
                            </div>
                            <div className="text-[10px] text-stone-500">{p.damage_dealt ? p.damage_dealt.toLocaleString() : '0'} DMG</div>
                          </div>

                          <div className={`w-12 text-right font-black text-sm flex-shrink-0 ${p.mmr_delta > 0 ? 'text-emerald-700' : p.mmr_delta < 0 ? 'text-red-700' : 'text-stone-500'}`}>
                            {p.mmr_delta > 0 ? '+' : ''}{p.mmr_delta}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {matches.length === 0 && (
          <div className="text-center p-12 text-stone-500 font-bold border border-border border-dashed rounded-xl">試合履歴がありません</div>
        )}
      </div>

      {/* 試合編集モーダル */}
      {editingMatch && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl p-6 shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
              <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                <Edit className="h-5 w-5 text-orange-700" />
                試合履歴の編集 (Match #{editingMatch.id})
              </h3>
              <button 
                onClick={() => setEditingMatch(null)}
                className="text-stone-400 hover:text-stone-900 bg-black/5 px-3 py-1.5 rounded-lg border border-border transition text-sm"
              >
                キャンセル
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
              {/* BLUE TEAM INPUT */}
              <div>
                <h4 className="font-bold text-blue-400 mb-3 text-lg tracking-wider">🟦 BLUE TEAM</h4>
                <div className="space-y-3">
                  {ROLES.map(role => {
                    const idx = editingMatch.participants.findIndex(p => p.team === 'BLUE' && p.role === role);
                    if (idx === -1) return null;
                    const p = editingMatch.participants[idx];
                    const isDragging = draggedParticipantIndex === idx;
                    return (
                      <div 
                        key={`edit-BLUE-${role}`} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={() => setDraggedParticipantIndex(null)}
                        className={`flex items-center gap-2 bg-black/5 p-3 rounded-lg border border-border cursor-grab active:cursor-grabbing hover:bg-black/8 hover:border-border transition-all ${
                          isDragging ? 'opacity-40 border-dashed border-orange-500 bg-surface' : ''
                        }`}
                      >
                        <div className="text-stone-500 hover:text-stone-700 transition cursor-grab shrink-0">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="w-8 text-center font-bold text-stone-500 text-xs">{role}</div>
                        <select
                          value={p.player_name}
                          onChange={e => handleEditingParticipantChange(idx, 'player_name', e.target.value)}
                          onDragStart={e => e.stopPropagation()}
                          className="w-28 bg-surface border border-border rounded px-2 py-1 text-stone-900 outline-none focus:border-blue-500 text-xs"
                        >
                          <option value="">選択...</option>
                          {p.player_name && !playersPool.some(pl => pl.name === p.player_name) && (
                            <option value={p.player_name}>{p.player_name} (未登録)</option>
                          )}
                          {playersPool.map(pl => <option key={pl.name} value={pl.name}>{pl.name}</option>)}
                        </select>
                        <button
                          onClick={() => setActiveChampSelectorPlayer(idx.toString())}
                          onDragStart={e => e.stopPropagation()}
                          type="button"
                          className="w-28 bg-surface border border-border hover:border-blue-500 rounded px-1.5 py-1 text-stone-700 hover:text-stone-900 text-xs flex items-center justify-between gap-1 transition shrink-0"
                        >
                          <span className="truncate">
                            {p.champion_name ? (championsList.find(c => c.id === p.champion_name)?.name || 'チャンプ') : '選択'}
                          </span>
                          {p.champion_name && (
                            <Image
                              src={getChampIcon(p.champion_name)}
                              width={16}
                              height={16}
                              className="w-4 h-4 rounded-full border border-border shrink-0 object-cover"
                              alt={p.champion_name}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                        </button>
                        <div className="flex-1 flex gap-1 justify-end" onDragStart={e => e.stopPropagation()}>
                          <input type="number" value={p.kills} onChange={e => handleEditingParticipantChange(idx, 'kills', e.target.value)} className="w-10 bg-surface border border-border text-stone-900 text-center rounded text-xs py-0.5" placeholder="K" />
                          <span className="text-stone-500 text-xs self-center">/</span>
                          <input type="number" value={p.deaths} onChange={e => handleEditingParticipantChange(idx, 'deaths', e.target.value)} className="w-10 bg-surface border border-red-200 text-red-700 text-center rounded text-xs py-0.5" placeholder="D" />
                          <span className="text-stone-500 text-xs self-center">/</span>
                          <input type="number" value={p.assists} onChange={e => handleEditingParticipantChange(idx, 'assists', e.target.value)} className="w-10 bg-surface border border-border text-stone-900 text-center rounded text-xs py-0.5" placeholder="A" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RED TEAM INPUT */}
              <div>
                <h4 className="font-bold text-red-400 mb-3 text-lg tracking-wider">🟥 RED TEAM</h4>
                <div className="space-y-3">
                  {ROLES.map(role => {
                    const idx = editingMatch.participants.findIndex(p => p.team === 'RED' && p.role === role);
                    if (idx === -1) return null;
                    const p = editingMatch.participants[idx];
                    const isDragging = draggedParticipantIndex === idx;
                    return (
                      <div 
                        key={`edit-RED-${role}`} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={() => setDraggedParticipantIndex(null)}
                        className={`flex items-center gap-2 bg-black/5 p-3 rounded-lg border border-border cursor-grab active:cursor-grabbing hover:bg-black/8 hover:border-border transition-all ${
                          isDragging ? 'opacity-40 border-dashed border-red-500 bg-surface' : ''
                        }`}
                      >
                        <div className="text-stone-500 hover:text-stone-700 transition cursor-grab shrink-0">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="w-8 text-center font-bold text-stone-500 text-xs">{role}</div>
                        <select
                          value={p.player_name}
                          onChange={e => handleEditingParticipantChange(idx, 'player_name', e.target.value)}
                          onDragStart={e => e.stopPropagation()}
                          className="w-28 bg-surface border border-border rounded px-2 py-1 text-stone-900 outline-none focus:border-red-500 text-xs"
                        >
                          <option value="">選択...</option>
                          {p.player_name && !playersPool.some(pl => pl.name === p.player_name) && (
                            <option value={p.player_name}>{p.player_name} (未登録)</option>
                          )}
                          {playersPool.map(pl => <option key={pl.name} value={pl.name}>{pl.name}</option>)}
                        </select>
                        <button
                          onClick={() => setActiveChampSelectorPlayer(idx.toString())}
                          onDragStart={e => e.stopPropagation()}
                          type="button"
                          className="w-28 bg-surface border border-border hover:border-red-500 rounded px-1.5 py-1 text-stone-700 hover:text-stone-900 text-xs flex items-center justify-between gap-1 transition shrink-0"
                        >
                          <span className="truncate">
                            {p.champion_name ? (championsList.find(c => c.id === p.champion_name)?.name || 'チャンプ') : '選択'}
                          </span>
                          {p.champion_name && (
                            <Image
                              src={getChampIcon(p.champion_name)}
                              width={16}
                              height={16}
                              className="w-4 h-4 rounded-full border border-border shrink-0 object-cover"
                              alt={p.champion_name}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                        </button>
                        <div className="flex-1 flex gap-1 justify-end" onDragStart={e => e.stopPropagation()}>
                          <input type="number" value={p.kills} onChange={e => handleEditingParticipantChange(idx, 'kills', e.target.value)} className="w-10 bg-surface border border-border text-stone-900 text-center rounded text-xs py-0.5" placeholder="K" />
                          <span className="text-stone-500 text-xs self-center">/</span>
                          <input type="number" value={p.deaths} onChange={e => handleEditingParticipantChange(idx, 'deaths', e.target.value)} className="w-10 bg-surface border border-red-200 text-red-700 text-center rounded text-xs py-0.5" placeholder="D" />
                          <span className="text-stone-500 text-xs self-center">/</span>
                          <input type="number" value={p.assists} onChange={e => handleEditingParticipantChange(idx, 'assists', e.target.value)} className="w-10 bg-surface border border-border text-stone-900 text-center rounded text-xs py-0.5" placeholder="A" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 勝敗選択と保存 */}
            <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 bg-black/5 p-2 rounded-lg border border-border">
                <span className="font-bold text-stone-500 px-2 text-sm">勝利チーム:</span>
                <button
                  onClick={() => setEditingMatch(prev => prev ? { ...prev, winning_team: 'BLUE' } : null)}
                  type="button"
                  className={`px-6 py-2 rounded-lg font-bold transition text-xs ${editingMatch.winning_team === 'BLUE' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-white text-stone-500 border border-border hover:bg-black/5'}`}
                >
                  BLUE WIN
                </button>
                <button
                  onClick={() => setEditingMatch(prev => prev ? { ...prev, winning_team: 'RED' } : null)}
                  type="button"
                  className={`px-6 py-2 rounded-lg font-bold transition text-xs ${editingMatch.winning_team === 'RED' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-white text-stone-500 border border-border hover:bg-black/5'}`}
                >
                  RED WIN
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditingMatch(null)}
                  type="button"
                  className="px-6 py-2.5 rounded-xl font-bold bg-black/5 hover:bg-black/8 border border-border text-stone-700 transition text-sm"
                >
                  キャンセル
                </button>
                <button 
                  onClick={handleSaveMatch}
                  disabled={saving}
                  type="button"
                  className="px-8 py-2.5 rounded-xl font-black bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white transition shadow-xl shadow-emerald-900/20 text-sm flex items-center gap-2"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                  変更を保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* チャンピオン選択アイコンモーダル (編集モーダル用) */}
      {activeChampSelectorPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-stone-900 flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-700" />
                チャンピオン選択
              </h3>
              <button 
                onClick={() => { setActiveChampSelectorPlayer(null); setChampSearchQuery(''); }}
                className="text-stone-400 hover:text-stone-900 text-sm bg-black/5 px-3 py-1.5 rounded-lg border border-border transition"
              >
                閉じる
              </button>
            </div>
            
            <input 
              type="text" 
              placeholder="チャンピオン名で検索 (ひらがな・カタカナ・英語名)..." 
              value={champSearchQuery}
              onChange={e => setChampSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-stone-900 mb-4 outline-none focus:border-emerald-500 text-sm"
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
                      const idx = parseInt(activeChampSelectorPlayer);
                      handleEditingParticipantChange(idx, 'champion_name', c.id);
                      setActiveChampSelectorPlayer(null);
                      setChampSearchQuery('');
                    }}
                    type="button"
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-black/5 transition group"
                  >
                    <Image
                      src={getChampIcon(c.id)}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-xl border border-border group-hover:border-emerald-500 transition object-cover"
                      alt={c.name}
                    />
                    <span className="text-[10px] text-stone-400 truncate w-14 text-center group-hover:text-stone-900 transition">
                      {c.name}
                    </span>
                  </button>
                ))
              }
              {championsList.filter(c => 
                c.name.toLowerCase().includes(champSearchQuery.toLowerCase()) || 
                c.id.toLowerCase().includes(champSearchQuery.toLowerCase())
              ).length === 0 && (
                <div className="col-span-full text-center py-12 text-stone-500 text-sm">
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
