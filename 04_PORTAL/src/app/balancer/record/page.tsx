'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { RefreshCw, Trophy, Target, Search, ArrowLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
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

function CustomRecordPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pendingId = searchParams.get('pending_id');

  const [playersPool, setPlayersPool] = useState<{name: string, ign?: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | '', text: string }>({ type: '', text: '' });
  const [winningTeam, setWinningTeam] = useState<'BLUE' | 'RED' | null>(null);
  // チーム分けの満足度。Discordのリアクション集計は集まりが悪く手間もかかるため、
  // 管理者が成績入力時にその場で1タップ記録する方式にした。
  const [balanceSatisfaction, setBalanceSatisfaction] = useState<'good' | 'normal' | 'bad' | null>(null);
  const [championsList, setChampionsList] = useState<{ id: string, name: string }[]>([]);
  const championsListRef = useRef(championsList);
  championsListRef.current = championsList;
  const [activeChampSelector, setActiveChampSelector] = useState<{ team: 'BLUE' | 'RED', role: Role, slotIndex: number } | null>(null);
  const [champSearchQuery, setChampSearchQuery] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [openDetails, setOpenDetails] = useState<Record<number, boolean>>({});
  const toggleDetails = (index: number) => {
    setOpenDetails(prev => ({ ...prev, [index]: !prev[index] }));
  };
  
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
        const img = new window.Image();
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
                champions: championsListRef.current
              })
            });
            
            const resData = await res.json();
            if (!res.ok || resData.status !== 'SUCCESS') {
              throw new Error(resData.error || '画像の解析に失敗しました。');
            }
            
            const data = resData.data;
            
            // スタッツ＆勝敗の反映
            // スクショの上5行＝勝利チーム(VICTORY BLOCK)
            // 勝利ブロックのプレイヤー名と、名簿(stats)のBLUE/REDチーム名を照合して勝者を確定する。
            if (data.players && Array.isArray(data.players)) {
              const winnerBlock = data.players.slice(0, 5);
              const loserBlock = data.players.slice(5, 10);

              // 事前入力済みの名簿（バランサーのサイド割当＝真実）と照合
              const knownBlue = new Set(stats.filter(s => s.team === 'BLUE' && s.name).map(s => s.name));
              const knownRed = new Set(stats.filter(s => s.team === 'RED' && s.name).map(s => s.name));

              let winInBlue = 0;
              let winInRed = 0;

              winnerBlock.forEach((p: any) => {
                const m = matchPlayer(p.name, playersPool);
                if (m) {
                  if (knownBlue.has(m)) winInBlue++;
                  if (knownRed.has(m)) winInRed++;
                }
              });

              // 照合結果から勝者を判定。照合できない場合は AI の winningTeam 判定を使用。
              let resolvedWinner: 'BLUE' | 'RED' = 'BLUE';
              if (winInRed > winInBlue) {
                resolvedWinner = 'RED';
              } else if (winInBlue > winInRed) {
                resolvedWinner = 'BLUE';
              } else if (data.winningTeam === 'RED' || data.winningTeam === 'BLUE') {
                resolvedWinner = data.winningTeam;
              }

              setWinningTeam(resolvedWinner);

              const bluePlayers = resolvedWinner === 'BLUE' ? winnerBlock : loserBlock;
              const redPlayers = resolvedWinner === 'RED' ? winnerBlock : loserBlock;

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
      try {
        const res = await fetch('/api/players/list');
        const data = await res.json();
        if (res.ok && data.players) {
          setPlayersPool(data.players);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    fetchPlayers();
  }, []);

  // チャンピオン一覧の読込。失敗時は静かに空のままにせず、エラー表示＋リトライ可能にする。
  const loadChampions = async () => {
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
      if (list.length === 0) throw new Error('一覧が空でした');
      setChampionsList(list);
    } catch (err: any) {
      console.error('Failed to load champions from Ddragon:', err);
      setMessage({ type: 'error', text: `チャンピオン一覧の読み込みに失敗しました（${err.message}）。通信環境を確認して再読み込みしてください。` });
    }
  };
  useEffect(() => { loadChampions(); }, []);

  useEffect(() => {
    if (!pendingId) return;
    
    async function loadPendingMatch() {
      try {
        const res = await fetch(`/api/balancer/pending?id=${pendingId}`);
        const data = await res.json();
        if (res.ok && data.balanceResult) {
          const br = data.balanceResult;
          setStats(() => {
            const initial: PlayerStat[] = [];
            
            ROLES.forEach(role => {
              const pb = br.teamBlue?.find((p: any) => p.currentRole === role);
              initial.push({
                name: pb ? pb.name : '',
                team: 'BLUE',
                currentRole: role,
                kills: 0, deaths: 0, assists: 0, vision: 0,
                champion_name: '', damage_dealt: 0, damage_taken: 0,
                heal_shield: 0, objective_damage: 0, cs: 0
              });
            });
            
            ROLES.forEach(role => {
              const pr = br.teamRed?.find((p: any) => p.currentRole === role);
              initial.push({
                name: pr ? pr.name : '',
                team: 'RED',
                currentRole: role,
                kills: 0, deaths: 0, assists: 0, vision: 0,
                champion_name: '', damage_dealt: 0, damage_taken: 0,
                heal_shield: 0, objective_damage: 0, cs: 0
              });
            });
            
            return initial;
          });
        }
      } catch (err) {
        console.error('Failed to load pending match:', err);
      }
    }
    loadPendingMatch();
  }, [pendingId]);

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
          balanceSatisfaction, // チーム分けの満足度（管理者が入力時に記録）
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
      if (pendingId) {
        await fetch(`/api/balancer/pending?id=${pendingId}`, { method: 'DELETE' }).catch(() => {});
      }
      router.push('/balancer');
    } catch (err: any) {
      setMessage({ type: 'error', text: `保存エラー: ${err.message}` });
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><RefreshCw className="h-8 w-8 text-primary animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background text-stone-800 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-extrabold text-stone-900 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-emerald-600" />
            カスタム試合を手動記録
          </h1>
          <Link href="/balancer" className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition">
            <ArrowLeft className="h-4 w-4" /> チーム分け画面へ戻る
          </Link>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl">
          {message.text && (
            <div className={`mb-6 p-4 rounded-lg text-sm font-bold border ${
              message.type === 'success'
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                : 'bg-amber-100 border-amber-200 text-amber-700'
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
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-border bg-black/3 text-stone-500 hover:border-stone-300 hover:bg-black/5'
            }`}
          >
            {analyzing ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin" />
                <span className="text-sm font-bold text-emerald-700 animate-pulse">Gemini APIで対戦結果画像を解析中...</span>
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
                <p className="font-bold text-stone-900 mb-1 text-base">
                  スクリーンショット画像を貼り付け (Ctrl+V)
                </p>
                <p className="text-xs text-stone-500">
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
                  const uid = `BLUE-slot-${index}`;
                  return (
                    <div key={uid} className="flex flex-col bg-white/70 p-3 rounded-lg border border-border gap-2">
                      <div className="flex items-center gap-2 w-full">
                        <select
                          value={s.currentRole}
                          onChange={e => handleStatChangeByIndex(index, 'currentRole', e.target.value)}
                          className="w-16 bg-white border border-border rounded px-1.5 py-1 text-stone-900 outline-none focus:border-blue-500 text-xs font-bold"
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select
                          value={s.name}
                          onChange={e => handleStatChangeByIndex(index, 'name', e.target.value)}
                          className="w-28 bg-white border border-border rounded px-2 py-1.5 text-stone-900 outline-none focus:border-blue-500 text-sm"
                        >
                          <option value="">選択...</option>
                          {playersPool.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                        </select>
                        <button
                          onClick={() => setActiveChampSelector({ team: 'BLUE', role: s.currentRole, slotIndex: index })}
                          type="button"
                          className="w-32 bg-white border border-border hover:border-blue-500 rounded px-2 py-1.5 text-stone-500 hover:text-stone-900 text-xs flex items-center justify-between gap-1 transition shrink-0"
                        >
                          <span className="truncate">
                            {s.champion_name ? (championsList.find(c => c.id === s.champion_name)?.name || 'チャンプ') : 'チャンプ選択'}
                          </span>
                          {s.champion_name && (
                            <Image
                              src={getChampIcon(s.champion_name)}
                              width={20}
                              height={20}
                              className="w-5 h-5 rounded-full border border-border shrink-0 object-cover"
                              alt={s.champion_name}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                        </button>
                        <div className="flex-1 flex gap-1 justify-end items-center">
                          <input type="number" value={s.kills} onChange={e => handleStatChangeByIndex(index, 'kills', e.target.value)} className="w-11 bg-white border border-border text-stone-900 text-center rounded py-1 text-sm" placeholder="K" />
                          <span className="text-stone-500 self-center text-xs">/</span>
                          <input type="number" value={s.deaths} onChange={e => handleStatChangeByIndex(index, 'deaths', e.target.value)} className="w-11 bg-white border border-red-200 text-red-700 text-center rounded py-1 text-sm" placeholder="D" />
                          <span className="text-stone-500 self-center text-xs">/</span>
                          <input type="number" value={s.assists} onChange={e => handleStatChangeByIndex(index, 'assists', e.target.value)} className="w-11 bg-white border border-border text-stone-900 text-center rounded py-1 text-sm" placeholder="A" />
                          <button
                            type="button"
                            onClick={() => toggleDetails(index)}
                            className={`ml-2 p-1.5 rounded transition ${openDetails[index] ? 'bg-blue-600 text-white' : 'bg-black/5 text-stone-500 hover:text-stone-900'}`}
                            title="詳細スタッツ（CS・ダメージなど）"
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* 詳細入力アコーディオン */}
                      {openDetails[index] && (
                        <div className="mt-1 ml-18 grid grid-cols-4 gap-2 bg-black/5 p-3 rounded-lg border border-border transition shadow-inner">
                          <div>
                            <label className="text-[10px] text-stone-500 font-bold block mb-1 text-center">CS</label>
                            <input type="number" value={s.cs || 0} onChange={e => handleStatChangeByIndex(index, 'cs', e.target.value)} className="w-full bg-white border border-border text-stone-900 rounded px-2 py-1 text-xs text-center" />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-500 font-bold block mb-1 text-center">与ダメージ</label>
                            <input type="number" value={s.damage_dealt || 0} onChange={e => handleStatChangeByIndex(index, 'damage_dealt', e.target.value)} className="w-full bg-white border border-border text-stone-900 rounded px-2 py-1 text-xs text-center" />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-500 font-bold block mb-1 text-center">被ダメージ</label>
                            <input type="number" value={s.damage_taken || 0} onChange={e => handleStatChangeByIndex(index, 'damage_taken', e.target.value)} className="w-full bg-white border border-border text-stone-900 rounded px-2 py-1 text-xs text-center" />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-500 font-bold block mb-1 text-center">視界スコア</label>
                            <input type="number" value={s.vision || 0} onChange={e => handleStatChangeByIndex(index, 'vision', e.target.value)} className="w-full bg-white border border-border text-stone-900 rounded px-2 py-1 text-xs text-center" />
                          </div>
                        </div>
                      )}
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
                  const uid = `RED-slot-${index}`;
                  return (
                    <div key={uid} className="flex flex-col bg-white/70 p-3 rounded-lg border border-border gap-2">
                      <div className="flex items-center gap-2 w-full">
                        <select
                          value={s.currentRole}
                          onChange={e => handleStatChangeByIndex(index, 'currentRole', e.target.value)}
                          className="w-16 bg-white border border-border rounded px-1.5 py-1 text-stone-900 outline-none focus:border-red-500 text-xs font-bold"
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select
                          value={s.name}
                          onChange={e => handleStatChangeByIndex(index, 'name', e.target.value)}
                          className="w-28 bg-white border border-border rounded px-2 py-1.5 text-stone-900 outline-none focus:border-red-500 text-sm"
                        >
                          <option value="">選択...</option>
                          {playersPool.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                        </select>
                        <button
                          onClick={() => setActiveChampSelector({ team: 'RED', role: s.currentRole, slotIndex: index })}
                          type="button"
                          className="w-32 bg-white border border-border hover:border-red-500 rounded px-2 py-1.5 text-stone-500 hover:text-stone-900 text-xs flex items-center justify-between gap-1 transition shrink-0"
                        >
                          <span className="truncate">
                            {s.champion_name ? (championsList.find(c => c.id === s.champion_name)?.name || 'チャンプ') : 'チャンプ選択'}
                          </span>
                          {s.champion_name && (
                            <Image
                              src={getChampIcon(s.champion_name)}
                              width={20}
                              height={20}
                              className="w-5 h-5 rounded-full border border-border shrink-0 object-cover"
                              alt={s.champion_name}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                        </button>
                        <div className="flex-1 flex gap-1 justify-end items-center">
                          <input type="number" value={s.kills} onChange={e => handleStatChangeByIndex(index, 'kills', e.target.value)} className="w-11 bg-white border border-border text-stone-900 text-center rounded py-1 text-sm" placeholder="K" />
                          <span className="text-stone-500 self-center text-xs">/</span>
                          <input type="number" value={s.deaths} onChange={e => handleStatChangeByIndex(index, 'deaths', e.target.value)} className="w-11 bg-white border border-red-200 text-red-700 text-center rounded py-1 text-sm" placeholder="D" />
                          <span className="text-stone-500 self-center text-xs">/</span>
                          <input type="number" value={s.assists} onChange={e => handleStatChangeByIndex(index, 'assists', e.target.value)} className="w-11 bg-white border border-border text-stone-900 text-center rounded py-1 text-sm" placeholder="A" />
                          <button
                            type="button"
                            onClick={() => toggleDetails(index)}
                            className={`ml-2 p-1.5 rounded transition ${openDetails[index] ? 'bg-red-600 text-white' : 'bg-black/5 text-stone-500 hover:text-stone-900'}`}
                            title="詳細スタッツ（CS・ダメージなど）"
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* 詳細入力アコーディオン */}
                      {openDetails[index] && (
                        <div className="mt-1 ml-18 grid grid-cols-4 gap-2 bg-black/5 p-3 rounded-lg border border-border transition shadow-inner">
                          <div>
                            <label className="text-[10px] text-stone-500 font-bold block mb-1 text-center">CS</label>
                            <input type="number" value={s.cs || 0} onChange={e => handleStatChangeByIndex(index, 'cs', e.target.value)} className="w-full bg-white border border-border text-stone-900 rounded px-2 py-1 text-xs text-center" />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-500 font-bold block mb-1 text-center">与ダメージ</label>
                            <input type="number" value={s.damage_dealt || 0} onChange={e => handleStatChangeByIndex(index, 'damage_dealt', e.target.value)} className="w-full bg-white border border-border text-stone-900 rounded px-2 py-1 text-xs text-center" />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-500 font-bold block mb-1 text-center">被ダメージ</label>
                            <input type="number" value={s.damage_taken || 0} onChange={e => handleStatChangeByIndex(index, 'damage_taken', e.target.value)} className="w-full bg-white border border-border text-stone-900 rounded px-2 py-1 text-xs text-center" />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-500 font-bold block mb-1 text-center">視界スコア</label>
                            <input type="number" value={s.vision || 0} onChange={e => handleStatChangeByIndex(index, 'vision', e.target.value)} className="w-full bg-white border border-border text-stone-900 rounded px-2 py-1 text-xs text-center" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* チーム分けの満足度（管理者が入力時に記録） */}
          <div className="border-t border-border pt-6">
            <div className="flex items-center gap-3 flex-wrap bg-black/3 p-3 rounded-lg border border-border">
              <span className="font-bold text-stone-500 text-sm">今日のチーム分けは?</span>
              {([
                ['good', '👍 良かった', 'bg-emerald-600'],
                ['normal', '😐 普通', 'bg-sky-600'],
                ['bad', '👎 イマイチ', 'bg-rose-600'],
              ] as const).map(([val, label, activeCls]) => (
                <button key={val} type="button"
                  onClick={() => setBalanceSatisfaction(balanceSatisfaction === val ? null : val)}
                  className={`px-4 py-2 rounded-lg text-sm font-black transition ${balanceSatisfaction === val ? `${activeCls} text-white` : 'bg-white text-stone-500 border border-border hover:bg-black/5'}`}>
                  {label}
                </button>
              ))}
              <span className="text-[10px] text-stone-500">任意。バランサーの精度検証に使われます（未選択でも保存できます）</span>
            </div>
          </div>

          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 bg-black/3 p-2 rounded-lg border border-border">
              <span className="font-bold text-stone-500 px-2">勝利チーム:</span>
              <button
                onClick={() => setWinningTeam('BLUE')}
                className={`px-8 py-3 rounded-lg font-black transition ${winningTeam === 'BLUE' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.6)]' : 'bg-white text-stone-500 border border-border hover:bg-black/5'}`}
              >
                BLUE WIN
              </button>
              <button
                onClick={() => setWinningTeam('RED')}
                className={`px-8 py-3 rounded-lg font-black transition ${winningTeam === 'RED' ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.6)]' : 'bg-white text-stone-500 border border-border hover:bg-black/5'}`}
              >
                RED WIN
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !winningTeam}
              className={`px-8 py-4 rounded-xl font-black text-lg transition flex items-center gap-3 ${
                submitting || !winningTeam ? 'bg-black/5 text-stone-400 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 shadow-xl shadow-emerald-900/30'
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
          <div className="bg-white border border-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-stone-900 flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-600" />
                チャンピオン選択 ({activeChampSelector.team} - {activeChampSelector.role})
              </h3>
              <button
                onClick={() => { setActiveChampSelector(null); setChampSearchQuery(''); }}
                className="text-stone-500 hover:text-stone-900 text-sm bg-black/5 px-3 py-1.5 rounded-lg border border-border transition"
              >
                閉じる
              </button>
            </div>

            <input
              type="text"
              placeholder="チャンピオン名で検索 (ひらがな・カタカナ・英語名)..."
              value={champSearchQuery}
              onChange={e => setChampSearchQuery(e.target.value)}
              className="w-full bg-white border border-border rounded-lg px-4 py-2.5 text-stone-900 mb-4 outline-none focus:border-emerald-500 text-sm"
              autoFocus
            />

            {/* 一覧が読み込めていない場合のリトライ導線 */}
            {championsList.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-stone-500 mb-3">チャンピオン一覧が読み込まれていません。</p>
                <button onClick={loadChampions} type="button"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">
                  🔄 一覧を再読み込み
                </button>
              </div>
            )}
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
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-black/5 transition group"
                  >
                    <Image
                      src={getChampIcon(c.id)}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-xl border border-border group-hover:border-emerald-500 transition object-cover"
                      alt={c.name}
                    />
                    <span className="text-[10px] text-stone-500 truncate w-14 text-center group-hover:text-stone-900 transition">
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

export default function CustomRecordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><RefreshCw className="h-8 w-8 text-primary animate-spin" /></div>}>
      <CustomRecordPageContent />
    </Suspense>
  );
}
