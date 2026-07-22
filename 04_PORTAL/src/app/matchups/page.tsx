"use client";

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getChampIcon } from '../../lib/ddragonClient';
import { Swords, Zap, AlertCircle, RefreshCw, History, Save, Activity, Target, Award } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import ChampSelect from '../../components/ChampSelect';

function MatchupsSimulatorContent() {
  // 5v5 AIシミュレータ用ステート
  const [blueChamps, setBlueChamps] = useState<Record<string, string>>({
    TOP: '', JG: '', MID: '', BOT: '', SUP: ''
  });
  const [redChamps, setRedChamps] = useState<Record<string, string>>({
    TOP: '', JG: '', MID: '', BOT: '', SUP: ''
  });
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<any>(null);
  const [simStatus, setSimStatus] = useState('');
  const [savingSim, setSavingSim] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [savedSims, setSavedSims] = useState<any[] | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // シミュレータ結果を保存して共有リンクを生成
  const saveSimulation = async () => {
    if (!simResult) return;
    setSavingSim(true);
    setSimError(null);
    try {
      const res = await fetch('/api/match/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blue: blueChamps, red: redChamps, result: simResult }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || '保存に失敗しました。');
      const url = `${window.location.origin}${window.location.pathname}?sim=${d.id}`;
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); } catch { /* クリップボード不可でもURL表示 */ }
    } catch (e: any) {
      setSimError('保存に失敗: ' + e.message);
    } finally {
      setSavingSim(false);
    }
  };

  // 共有リンク(?sim=<id>)で開かれたら、その保存結果を読み込む
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const simId = new URLSearchParams(window.location.search).get('sim');
    if (!simId) return;
    fetch(`/api/match/simulation?id=${simId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          if (d.blue) setBlueChamps(d.blue);
          if (d.red) setRedChamps(d.red);
          if (d.result) setSimResult(d.result);
        }
      })
      .catch(() => {});
  }, []);

  // 保存済みシミュレーション一覧のロード
  useEffect(() => {
    fetch('/api/match/simulation')
      .then(r => r.json())
      .then(d => setSavedSims(d.success ? d.list : []))
      .catch(() => setSavedSims([]));
  }, []);

  const loadSavedSim = async (simId: string) => {
    try {
      const d = await (await fetch(`/api/match/simulation?id=${simId}`)).json();
      if (d.success) {
        if (d.blue) setBlueChamps(d.blue);
        if (d.red) setRedChamps(d.red);
        if (d.result) setSimResult(d.result);
        setSimError(null);
      }
    } catch { /* noop */ }
  };

  const normSimRole = (r: string): 'TOP' | 'JG' | 'MID' | 'BOT' | 'SUP' | null => {
    const u = String(r || '').toUpperCase();
    if (u.startsWith('TOP')) return 'TOP';
    if (u.startsWith('JG') || u.startsWith('JUNG')) return 'JG';
    if (u.startsWith('MID')) return 'MID';
    if (u.startsWith('BOT') || u === 'ADC' || u.startsWith('BOTTOM') || u === 'CARRY') return 'BOT';
    if (u.startsWith('SUP') || u === 'UTILITY') return 'SUP';
    return null;
  };

  const loadFromRecentMatch = async () => {
    setLoadingRecent(true);
    setSimError(null);
    try {
      const { data, error } = await supabase
        .from('ktm_matches')
        .select('id, created_at, ktm_match_participants ( team, role, champion_name )')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const parts: any[] = (data && data[0]?.ktm_match_participants) || [];
      if (parts.length === 0) { setSimError('直近の試合データが見つかりませんでした。'); return; }
      const blue: Record<string, string> = { TOP: '', JG: '', MID: '', BOT: '', SUP: '' };
      const red: Record<string, string> = { TOP: '', JG: '', MID: '', BOT: '', SUP: '' };
      let filled = 0;
      parts.forEach((p) => {
        const role = normSimRole(p.role);
        if (!role || !p.champion_name) return;
        if (p.team === 'BLUE') { blue[role] = p.champion_name; filled++; }
        else if (p.team === 'RED') { red[role] = p.champion_name; filled++; }
      });
      if (filled === 0) { setSimError('直近の試合にチャンピオン情報が無く、読み込めませんでした。'); return; }
      setBlueChamps(blue);
      setRedChamps(red);
    } catch (e: any) {
      setSimError('直近の試合の読み込みに失敗しました: ' + e.message);
    } finally {
      setLoadingRecent(false);
    }
  };

  const startSimulation = async () => {
    const roles = ['TOP', 'JG', 'MID', 'BOT', 'SUP'] as const;
    const blueMissing = roles.filter(r => !blueChamps[r]);
    const redMissing = roles.filter(r => !redChamps[r]);
    
    if (blueMissing.length > 0 || redMissing.length > 0) {
      alert('すべてのポジション（味方5名、敵5名）のチャンピオンを選択してください。');
      return;
    }

    setSimLoading(true);
    setSimError(null);
    setSimResult(null);
    setSimStatus('5v5シミュレーションタスクを登録中...');

    try {
      const res = await fetch('/api/match/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blue: blueChamps, red: redChamps })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'シミュレーションタスクの登録に失敗しました。');

      const taskId = data.task_id;
      setSimStatus('10名のスキル・相性データを集計中...');
      
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > 50) {
          clearInterval(interval);
          setSimError('シミュレーションがタイムアウトしました。もう一度お試しください。');
          setSimLoading(false);
          return;
        }

        if (attempts === 5) setSimStatus('各レーンの主導権バランスを計算中...');
        if (attempts === 12) setSimStatus('チーム構成スタイルとシナジーを分析中...');
        if (attempts === 20) setSimStatus('勝利条件と時間帯別ゲームプランを構築中...');

        const { data: task, error } = await supabase
          .from('edge_tasks')
          .select('status, result, error_message')
          .eq('id', taskId)
          .single();

        if (error) {
          clearInterval(interval);
          setSimError(`タスク監視エラー: ${error.message}`);
          setSimLoading(false);
          return;
        }

        if (task.status === 'completed') {
          clearInterval(interval);
          setSimResult(task.result);
          setSimLoading(false);
        } else if (task.status === 'failed') {
          clearInterval(interval);
          setSimError(task.error_message || 'AI 5v5シミュレーションの実行中にエラーが発生しました。');
          setSimLoading(false);
        }
      }, 1500);

    } catch (err: any) {
      setSimError(err.message || '通信エラーが発生しました。');
      setSimLoading(false);
    }
  };

  const roles = ['TOP', 'JG', 'MID', 'BOT', 'SUP'] as const;

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-6xl mx-auto flex flex-col gap-8">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
            <Swords className="text-[#00cfef]" size={32} /> 5v5 AIチームシミュレータ
          </h1>
          <p className="text-gray-400 font-medium text-xs">
            両チームの5対5構成から相性・主導権・ゲームプランをAIが総合診断
          </p>
        </div>
        <Link href="/champions?tab=matchup" className="px-4 py-2 bg-[#c89b3c]/10 border border-[#c89b3c]/20 text-[#c89b3c] hover:bg-[#c89b3c]/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0">
          ← 対面メモはチャンピオン辞典へ
        </Link>
      </motion.header>

      {/* 入力パネル (Blue vs Red) */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden border-t-2 border-[#a78bfa]/20">
        <div className="absolute -right-20 -top-20 w-48 h-48 bg-[#a78bfa]/5 rounded-full blur-3xl"></div>
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <h3 className="text-[#a78bfa] font-black text-lg flex items-center gap-2">
            <Swords size={20} /> 5v5 チーム構成＆勝利プラン・アナライザー
          </h3>
          <button
            onClick={loadFromRecentMatch}
            disabled={loadingRecent || simLoading}
            title="直近の試合のチーム構成を読み込む"
            className="glass-panel glass-panel-hover rounded-xl px-4 py-2 text-xs font-bold text-[#00cfef] flex items-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loadingRecent ? <RefreshCw size={14} className="animate-spin" /> : <History size={14} />} 直近の試合から読み込む
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-9 gap-6 items-center">
          {/* Blue Side */}
          <div className="lg:col-span-4 space-y-4 bg-blue-500/5 p-5 rounded-2xl border border-blue-500/10">
            <h4 className="font-black text-sm text-blue-400 tracking-wider uppercase mb-3 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></div> Blue Side (味方)
            </h4>
            {roles.map(role => (
              <div key={role} className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{role}</label>
                <ChampSelect 
                  value={blueChamps[role]} 
                  onChange={(val) => setBlueChamps(prev => ({ ...prev, [role]: val }))} 
                  placeholder="チャンピオンを選択" 
                  className="border-blue-500/20 focus:border-blue-500/50" 
                />
              </div>
            ))}
          </div>

          {/* VS Divider */}
          <div className="lg:col-span-1 flex flex-col items-center justify-center py-4">
            <span className="text-2xl font-black italic text-gray-500 tracking-widest">VS</span>
            <div className="w-px h-20 bg-gradient-to-b from-transparent via-gray-700 to-transparent hidden lg:block my-4"></div>
          </div>

          {/* Red Side */}
          <div className="lg:col-span-4 space-y-4 bg-red-500/5 p-5 rounded-2xl border border-red-500/10">
            <h4 className="font-black text-sm text-red-400 tracking-wider uppercase mb-3 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse"></div> Red Side (敵)
            </h4>
            {roles.map(role => (
              <div key={role} className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{role}</label>
                <ChampSelect 
                  value={redChamps[role]} 
                  onChange={(val) => setRedChamps(prev => ({ ...prev, [role]: val }))} 
                  placeholder="チャンピオンを選択" 
                  className="border-red-500/20 focus:border-red-500/50" 
                />
              </div>
            ))}
          </div>
        </div>

        <div className="text-right mt-8 border-t border-white/5 pt-6">
          <button
            onClick={startSimulation}
            disabled={simLoading || Object.values(blueChamps).some(v => !v) || Object.values(redChamps).some(v => !v)}
            className="px-8 py-4 bg-gradient-to-r from-[#a78bfa] to-[#818cf8] text-black font-black rounded-xl hover:shadow-[0_0_25px_rgba(167,139,250,0.4)] transition-all flex items-center gap-3 ml-auto disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Zap size={18} /> 構成相性 ＆ 勝利プランを分析
          </button>
        </div>
      </div>

      {/* 保存済みシミュレーション一覧 */}
      {savedSims && savedSims.length > 0 && (
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-xs font-black text-gray-400 mb-2">📚 保存済みの分析（クリックで再表示）</p>
          <div className="flex flex-wrap gap-2">
            {savedSims.map((s: any) => (
              <button key={s.id} onClick={() => loadSavedSim(s.id)}
                className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10">
                {s.blue?.JG || '?'}組 vs {s.red?.JG || '?'}組 ・ {new Date(s.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {simError && (
        <div className="glass-panel p-6 border-l-4 border-red-500 rounded-2xl flex items-center gap-4 text-red-400">
          <AlertCircle size={24} />
          <div>
            <h4 className="font-bold">分析エラー</h4>
            <p className="text-sm">{simError}</p>
          </div>
        </div>
      )}

      {/* ローディング */}
      {simLoading && (
        <div className="glass-panel py-20 rounded-2xl flex flex-col items-center justify-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <Swords className="text-[#a78bfa] animate-spin absolute animate-duration-3000" size={56} />
            <div className="absolute inset-0 border-4 border-t-[#a78bfa] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          </div>
          <div className="text-center">
            <h4 className="text-lg font-black text-white animate-pulse mb-1">{simStatus}</h4>
            <p className="text-xs text-gray-500 font-mono">通常 15秒〜25秒 で完了します</p>
          </div>
        </div>
      )}

      {/* シミュレーション結果表示 */}
      {simResult && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-8">
          <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-gray-400 font-bold">この分析結果を保存して共有できます</span>
            <div className="flex items-center gap-2 flex-wrap">
              {shareUrl && (
                <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5">
                  <span className="text-[10px] text-emerald-300 font-mono truncate max-w-[220px]">{shareUrl}</span>
                  <button onClick={() => { navigator.clipboard.writeText(shareUrl).catch(() => {}); }} className="text-[10px] font-black text-[#00cfef] hover:text-white">コピー</button>
                </div>
              )}
              <button
                onClick={saveSimulation}
                disabled={savingSim}
                className="px-4 py-2 bg-[#a78bfa]/15 text-[#a78bfa] border border-[#a78bfa]/30 font-black rounded-xl text-xs hover:bg-[#a78bfa]/25 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {savingSim ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {savingSim ? '保存中...' : '💾 保存して共有リンク作成'}
              </button>
            </div>
          </div>

          {/* 1. 各レーンの主導権マップ */}
          <div className="glass-panel p-6 md:p-8 rounded-3xl relative">
            <h3 className="text-white font-black text-base mb-6 flex items-center gap-2">
              <Activity className="text-[#00cfef]" size={20} /> ⚖️ 各レーン主導権分析 (Lane Priority Map)
            </h3>
            
            <div className="divide-y divide-white/5 space-y-4">
              {roles.map(role => {
                const laneData = simResult.lanes[role] || { priority: 'EVEN', reason: '' };
                const getPriorityLabel = () => {
                  if (laneData.priority === 'BLUE_PRIORITY') {
                    return { text: '味方有利 (Blue)', style: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
                  }
                  if (laneData.priority === 'RED_PRIORITY') {
                    return { text: '敵有利 (Red)', style: 'bg-red-500/20 text-red-400 border-red-500/30' };
                  }
                  return { text: '互角 (Even)', style: 'bg-gray-500/10 text-gray-400 border-gray-600/30' };
                };
                const label = getPriorityLabel();

                return (
                  <div key={role} className="flex flex-col md:flex-row md:items-center gap-4 pt-4 first:pt-0">
                    <div className="flex items-center gap-3 w-full md:w-[240px] shrink-0">
                      <span className="w-10 text-xs font-black text-gray-400 font-mono tracking-wider">{role}</span>
                      <div className="flex items-center gap-1.5">
                        <img 
                          src={getChampIcon(blueChamps[role])} 
                          className="w-8 h-8 rounded-full border border-blue-500/30" 
                          alt={blueChamps[role]} 
                        />
                        <span className="text-[10px] text-gray-500 font-black italic">VS</span>
                        <img 
                          src={getChampIcon(redChamps[role])} 
                          className="w-8 h-8 rounded-full border border-red-500/30" 
                          alt={redChamps[role]} 
                        />
                      </div>
                    </div>

                    <div className="shrink-0 w-[140px]">
                      <span className={`px-3 py-1 rounded-full border text-[10px] font-black inline-block ${label.style}`}>
                        {label.text}
                      </span>
                    </div>

                    <p className="text-xs text-gray-300 leading-relaxed flex-1">
                      {laneData.reason}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. 両チームの構成タイプ ＆ シナジー分析 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel p-6 rounded-2xl border-l-4 border-blue-500/50">
              <h4 className="text-blue-400 font-black text-sm mb-4 flex items-center gap-2">
                🛡️ Blue Side 構成分析
              </h4>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">構成タイプ</span>
                  <p className="text-sm font-black text-white mt-0.5">{simResult.blue_team.composition_style}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">強みと狙い</span>
                  <p className="text-xs text-gray-300 leading-relaxed mt-0.5">{simResult.blue_team.strengths}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">弱点・警戒点</span>
                  <p className="text-xs text-gray-300 leading-relaxed mt-0.5">{simResult.blue_team.weaknesses}</p>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border-l-4 border-red-500/50">
              <h4 className="text-red-400 font-black text-sm mb-4 flex items-center gap-2">
                ⚔️ Red Side 構成分析
              </h4>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">構成タイプ</span>
                  <p className="text-sm font-black text-white mt-0.5">{simResult.red_team.composition_style}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">強みと狙い</span>
                  <p className="text-xs text-gray-300 leading-relaxed mt-0.5">{simResult.red_team.strengths}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">弱点・警戒点</span>
                  <p className="text-xs text-gray-300 leading-relaxed mt-0.5">{simResult.red_team.weaknesses}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. 勝利へのロードマップ */}
          <div className="glass-panel p-6 md:p-8 rounded-3xl">
            <h3 className="text-white font-black text-base mb-6 flex items-center gap-2">
              <Target className="text-[#a78bfa]" size={20} /> 🗺️ 勝利へのロードマップ (Game Plan)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-panel p-5 rounded-2xl border-t-2 border-amber-500/30 flex flex-col gap-2">
                <span className="text-xs font-black text-amber-400">序盤 (〜Lv6 / オブジェクト戦準備)</span>
                <p className="text-xs leading-relaxed text-gray-300">{simResult.game_plan.early}</p>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-t-2 border-purple-500/30 flex flex-col gap-2">
                <span className="text-xs font-black text-purple-400">中盤 (1stタワー破壊 / サイドプッシュ開始)</span>
                <p className="text-xs leading-relaxed text-gray-300">{simResult.game_plan.mid}</p>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-t-2 border-emerald-500/30 flex flex-col gap-2">
                <span className="text-xs font-black text-emerald-400">終盤 (集団戦 / ソウル・バロン決戦)</span>
                <p className="text-xs leading-relaxed text-gray-300">{simResult.game_plan.late}</p>
              </div>
            </div>
          </div>

          {/* 4. 勝利条件 */}
          <div className="glass-panel p-6 md:p-8 rounded-3xl border-b-2 border-[#c89b3c]/20">
            <h3 className="text-[#c89b3c] font-black text-base mb-6 flex items-center gap-2">
              <Award size={22} /> 🎯 勝利条件 (Win Conditions)
            </h3>
            <ul className="space-y-4">
              {simResult.win_conditions && simResult.win_conditions.map((cond: string, idx: number) => (
                <li key={idx} className="flex items-start gap-4 text-sm text-gray-200">
                  <div className="w-6 h-6 rounded-full bg-[#c89b3c]/15 text-[#c89b3c] border border-[#c89b3c]/30 flex items-center justify-center shrink-0 text-xs font-bold font-mono">
                    {idx + 1}
                  </div>
                  <span className="pt-0.5 font-bold leading-relaxed">{cond}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function MatchupsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#a78bfa] border-t-transparent rounded-full animate-spin"></div></div>}>
      <MatchupsSimulatorContent />
    </Suspense>
  );
}
