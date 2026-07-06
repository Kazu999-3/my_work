'use client';

import { useEffect, useState, useRef } from 'react';
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
  const [playersPool, setPlayersPool] = useState<{name: string, ign?: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | '', text: string }>({ type: '', text: '' });
  const [winningTeam, setWinningTeam] = useState<'BLUE' | 'RED' | null>(null);
  const [championsList, setChampionsList] = useState<{ id: string, name: string }[]>([]);
  const championsListRef = useRef(championsList);
  championsListRef.current = championsList;
  const [activeChampSelector, setActiveChampSelector] = useState<{ team: 'BLUE' | 'RED', role: Role, slotIndex: number } | null>(null);
  const [champSearchQuery, setChampSearchQuery] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
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

  // プレイヤー名曖昧マッチング
  const matchPlayer = (extractedName: string, pool: { name: string, ign?: string }[]) => {
    if (!extractedName) return '';
    const cleanExtracted = extractedName.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
    
    // 1. 完全一致（記号除外後）
    for (const p of pool) {
      const cleanName = p.name.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
      const cleanIgn = (p.ign || '').toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
      
      if (cleanName === cleanExtracted || (p.ign && cleanIgn === cleanExtracted)) {
        return p.name;
      }
    }
    
    // 2. 部分一致
    for (const p of pool) {
      const cleanName = p.name.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
      const cleanIgn = (p.ign || '').toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
      
      if (cleanName.includes(cleanExtracted) || cleanExtracted.includes(cleanName) ||
          (p.ign && (cleanIgn.includes(cleanExtracted) || cleanExtracted.includes(cleanIgn)))) {
        return p.name;
      }
    }
    
    return '';
  };

  // チャンピオン曖昧マッチング
  const matchChampion = (extractedChamp: string, list: { id: string, name: string }[]) => {
    if (!extractedChamp) return '';
    const cleanExtracted = extractedChamp.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
    
    // 1. Ddragon ID (id) との一致を検索
    for (const c of list) {
      const cleanId = c.id.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanId === cleanExtracted) {
        return c.id;
      }
    }
    
    // 2. 日本語名 (name) との一致を検索
    for (const c of list) {
      const cleanName = c.name.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
      if (cleanName === cleanExtracted) {
        return c.id;
      }
    }
    
    return '';
  };

  // 画像アップロード・解析
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: '画像ファイルのみアップロード可能です。' });
      return;
    }
    
    setAnalyzing(true);
    setMessage({ type: '', text: '' });
    
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          try {
            // 429制限(TPM/RPM)を劇的に防ぐため、送信前にCanvasで最大幅1280pxにリサイズ＆圧縮
            const canvas = document.createElement('canvas');
            const maxW = 1280;
            let w = img.width;
            let h = img.height;
            if (w > maxW) {
              h = Math.round((h * maxW) / w);
              w = maxW;
            }
            canvas.width = w;
            canvas.height = h;
            
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, w, h);
            
            // 圧縮率 0.7 の JPEG に変換して送信サイズを軽量化
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            const base64Content = compressedBase64.split(',')[1];
            
            const res = await fetch('/api/match/analyze-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageBase64: base64Content,
                mimeType: 'image/jpeg',
                champions: championsListRef.current,
                testApiKey: 'AIzaSyB4yLgJ1hS-M9L4-XQEVYl-kk5508ZUNKI'
              })
            });
            
            const resData = await res.json();
            if (!res.ok || resData.status !== 'SUCCESS') {
              throw new Error(resData.error || '画像の解析に失敗しました。');
            }
            
            const data = resData.data;
            
            // 勝敗の反映
            if (data.winningTeam === 'BLUE' || data.winningTeam === 'RED') {
              setWinningTeam(data.winningTeam as 'BLUE' | 'RED');
            }
            
            // スタッツの反映
            if (data.players && Array.isArray(data.players)) {
              const bluePlayers = data.players.filter((p: any) => p.team === 'BLUE');
              const redPlayers = data.players.filter((p: any) => p.team === 'RED');
              
              setStats(prev => {
                return prev.map((currentStat, idx) => {
                  const isBlue = currentStat.team === 'BLUE';
                  const teamPlayers = isBlue ? bluePlayers : redPlayers;
                  const playerIdx = isBlue ? idx : idx - 5;
                  const found = teamPlayers[playerIdx];
                  
                  if (found) {
                    const matchedName = matchPlayer(found.name, playersPool);
                    const matchedChamp = matchChampion(found.champion_name, championsList);
                    
                    let assignedRole: Role = ROLES[playerIdx];
                    if (found.role && ROLES.includes(found.role.toUpperCase() as Role)) {
                      assignedRole = found.role.toUpperCase() as Role;
                    }
                    
                    return {
                      ...currentStat,
                      currentRole: assignedRole,
                      name: matchedName,
                      champion_name: matchedChamp,
                      kills: Number(found.kills) || 0,
                      deaths: Number(found.deaths) || 0,
                      assists: Number(found.assists) || 0
                    };
                  }
                  return currentStat;
                });
              });
              setMessage({ type: 'success', text: '画像の解析結果を反映しました。誤りがないか確認し、必要に応じて修正してください。' });
            }
          } catch (innerErr: any) {
            setMessage({ type: 'error', text: `解析処理エラー: ${innerErr.message}` });
          } finally {
            setAnalyzing(false);
          }
        };
        img.onerror = () => {
          setMessage({ type: 'error', text: '画像のデコードに失敗しました。' });
          setAnalyzing(false);
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        setMessage({ type: 'error', text: 'ファイルの読み込みに失敗しました。' });
        setAnalyzing(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setMessage({ type: 'error', text: `解析エラー: ${err.message}` });
      setAnalyzing(false);
    }
  };

  // ペースト監視 (画面全体のイベント)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      let isImage = false;
      
      // 1. filesから優先的に画像ファイルを検出
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.startsWith('image/')) {
            handleImageUpload(files[i]);
            isImage = true;
            break;
          }
        }
      }
      
      // 2. itemsから画像を検出 (フォールバック)
      if (!isImage) {
        const items = e.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              const file = items[i].getAsFile();
              if (file) {
                handleImageUpload(file);
                isImage = true;
                break;
              }
            }
          }
        }
      }
      
      // クリップボードに画像が含まれるペーストイベントの場合は、ブラウザのデフォルト挙動を止める
      if (isImage) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  // ドラッグ＆ドロップハンドラー
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleImageUpload(files[0]);
    }
  };

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

  const handleStatChangeByIndex = (index: number, field: string, value: string) => {
    setStats(prev => prev.map((p, idx) => {
      if (idx === index) {
        if (field === 'currentRole') return { ...p, currentRole: value as Role };
        if (field === 'name') return { ...p, name: value };
        if (field === 'champion_name') return { ...p, champion_name: value };
        const num = parseInt(value) || 0;
        return { ...p, [field]: num };
      }
      return p;
    }));
  };

  const handleSubmit = async () => {
    // ロールの重複・過不足チェック
    const blueRoles = stats.filter(s => s.team === 'BLUE').map(s => s.currentRole);
    const redRoles = stats.filter(s => s.team === 'RED').map(s => s.currentRole);
    const hasDuplicateRoles = (roles: Role[]) => {
      const unique = new Set(roles);
      return unique.size !== 5;
    };
    if (hasDuplicateRoles(blueRoles) || hasDuplicateRoles(redRoles)) {
      setMessage({ type: 'error', text: '各チーム内でTOP, JG, MID, ADC, SUPのロールが重複なく1人ずつ設定されている必要があります。' });
      return;
    }

    // バリデーション
    const missingNames = stats.filter(s => !s.name);
    if (missingNames.length > 0) {
      setMessage({ type: 'error', text: '全員の名前を選択してください。' });
      return;
    }
    if (!winningTeam) {
      setMessage({ type: 'error', text: '勝利チームを選択してください。' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/match/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winningTeam,
          riotMatchId: null, // 手動入力のため常にnull
          adminPassword: 'ktm', // API側で検証を無効化したため、デフォルト値を設定
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
      // リセット（ロールもデフォルトに戻す）
      setStats(stats.map((s, idx) => ({ 
        ...s, 
        currentRole: ROLES[idx % 5],
        name: '', kills: 0, deaths: 0, assists: 0, vision: 0,
        champion_name: '', damage_dealt: 0, damage_taken: 0, heal_shield: 0, objective_damage: 0, cs: 0 
      })));
      setWinningTeam(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: `保存エラー: ${err.message}` });
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
          {message.text && (
            <div className={`mb-6 p-4 rounded-lg text-sm font-bold border ${
              message.type === 'success'
                ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/60 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                : 'bg-amber-950/40 border-amber-900/60 text-amber-200'
            }`}>
              {message.text}
            </div>
          )}

          {/* 画像貼り付け・アップロードエリア */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mb-8 p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 transition-all ${
              isDragging
                ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'border-gray-800 bg-gray-900/40 text-gray-400 hover:border-gray-700 hover:bg-gray-900/70'
            }`}
          >
            {analyzing ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <RefreshCw className="h-10 w-10 text-emerald-400 animate-spin" />
                <span className="text-sm font-bold text-emerald-300 animate-pulse">Gemini APIで対戦結果画像を解析中...</span>
              </div>
            ) : (
              <div 
                className="text-center cursor-pointer w-full py-4" 
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleImageUpload(file);
                  };
                  input.click();
                }}
              >
                <div className="flex justify-center mb-3">
                  <Target className="h-12 w-12 text-emerald-500 animate-pulse" />
                </div>
                <p className="font-bold text-white mb-1 text-base">
                  スクリーンショット画像を貼り付け (Ctrl+V)
                </p>
                <p className="text-xs text-gray-500">
                  または、ここにファイルをドラッグ＆ドロップ / クリックして選択
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* BLUE TEAM */}
            <div>
              <h4 className="font-bold text-blue-400 mb-4 text-xl tracking-wider">🟦 BLUE TEAM</h4>
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map(index => {
                  const s = stats[index];
                  return (
                    <div key={`BLUE-slot-${index}`} className="flex items-center gap-2 bg-gray-800/80 p-3 rounded-lg border border-gray-700">
                      <select
                        value={s.currentRole}
                        onChange={e => handleStatChangeByIndex(index, 'currentRole', e.target.value)}
                        className="w-16 bg-gray-900 border border-gray-700 rounded px-1.5 py-1 text-white outline-none focus:border-blue-500 text-xs font-bold"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <select 
                        value={s.name}
                        onChange={e => handleStatChangeByIndex(index, 'name', e.target.value)}
                        className="w-28 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white outline-none focus:border-blue-500 text-sm"
                      >
                        <option value="">選択...</option>
                        {playersPool.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                      <button
                        onClick={() => setActiveChampSelector({ team: 'BLUE', role: s.currentRole, slotIndex: index })}
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
                        <input type="number" value={s.kills} onChange={e => handleStatChangeByIndex(index, 'kills', e.target.value)} className="w-11 bg-gray-900 border border-gray-700 text-white text-center rounded py-1 text-sm" placeholder="K" />
                        <span className="text-gray-500 self-center text-xs">/</span>
                        <input type="number" value={s.deaths} onChange={e => handleStatChangeByIndex(index, 'deaths', e.target.value)} className="w-11 bg-gray-900 border border-red-900/50 text-red-200 text-center rounded py-1 text-sm" placeholder="D" />
                        <span className="text-gray-500 self-center text-xs">/</span>
                        <input type="number" value={s.assists} onChange={e => handleStatChangeByIndex(index, 'assists', e.target.value)} className="w-11 bg-gray-900 border border-gray-700 text-white text-center rounded py-1 text-sm" placeholder="A" />
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
                {[5, 6, 7, 8, 9].map(index => {
                  const s = stats[index];
                  return (
                    <div key={`RED-slot-${index}`} className="flex items-center gap-2 bg-gray-800/80 p-3 rounded-lg border border-gray-700">
                      <select
                        value={s.currentRole}
                        onChange={e => handleStatChangeByIndex(index, 'currentRole', e.target.value)}
                        className="w-16 bg-gray-900 border border-gray-700 rounded px-1.5 py-1 text-white outline-none focus:border-red-500 text-xs font-bold"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <select 
                        value={s.name}
                        onChange={e => handleStatChangeByIndex(index, 'name', e.target.value)}
                        className="w-28 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white outline-none focus:border-red-500 text-sm"
                      >
                        <option value="">選択...</option>
                        {playersPool.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                      <button
                        onClick={() => setActiveChampSelector({ team: 'RED', role: s.currentRole, slotIndex: index })}
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
                        <input type="number" value={s.kills} onChange={e => handleStatChangeByIndex(index, 'kills', e.target.value)} className="w-11 bg-gray-900 border border-gray-700 text-white text-center rounded py-1 text-sm" placeholder="K" />
                        <span className="text-gray-500 self-center text-xs">/</span>
                        <input type="number" value={s.deaths} onChange={e => handleStatChangeByIndex(index, 'deaths', e.target.value)} className="w-11 bg-gray-900 border border-red-900/50 text-red-200 text-center rounded py-1 text-sm" placeholder="D" />
                        <span className="text-gray-500 self-center text-xs">/</span>
                        <input type="number" value={s.assists} onChange={e => handleStatChangeByIndex(index, 'assists', e.target.value)} className="w-11 bg-gray-900 border border-gray-700 text-white text-center rounded py-1 text-sm" placeholder="A" />
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
                      handleStatChangeByIndex(activeChampSelector.slotIndex, 'champion_name', c.id);
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
