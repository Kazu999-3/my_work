"use client";

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { getChampIcon, getChampSplash } from '../../lib/ddragonClient';
import { ChevronLeft, Search, Save, BookOpen, RefreshCw, Zap, ShieldAlert, Swords, Shield, Copy, Check, FileText, Eye, Edit2, Activity, Plus, Trash, Filter, Star as StarIcon, Award, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { getFavorites, toggleFavoriteChampion } from '../../components/FavoritesPanel';
import { Spinner } from '../../components/Feedback';

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
  const showPendingOnly = false;
  const setShowPendingOnly = (val: boolean) => {};
  const [selected, setSelected] = useState<any>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [champDates, setChampDates] = useState<Record<string, string>>({});
  const [champPending, setChampPending] = useState<Record<string, boolean>>({});
  const [champPatchMetas, setChampPatchMetas] = useState<Record<string, any>>({});
  const [champJgStyles, setChampJgStyles] = useState<Record<string, any>>({});
  // 一覧グリッドでも「いつ頃強いか」がひと目でわかるように、全チャンピオン分を一括取得する
  const [champPowerSpikes, setChampPowerSpikes] = useState<Record<string, { early_game_score: number; mid_game_score: number; late_game_score: number }>>({});
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FARM' | 'GANK' | 'INVASION' | 'TANK'>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [pickFilter, setPickFilter] = useState<'ALL' | 'BLIND' | 'COUNTER'>('ALL');

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
    patch_meta: null, pro_builds: [], jg_style: null
  });
  const [powerSpikeScores, setPowerSpikeScores] = useState<{
    early_game_score: number; mid_game_score: number; late_game_score: number;
    peak_window: string; summary: string;
  } | null>(null);
  // KTM実戦成績（#51 辞典vs実戦の可視化）
  const [ktmStats, setKtmStats] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [noteDraftMode, setNoteDraftMode] = useState<'preview' | 'edit'>('preview');
  const [stats, setStats] = useState({ matches: 0, wins: 0, kda: '0.00' });
  const [favoriteChamps, setFavoriteChamps] = useState<string[]>([]);
  const [matchupsList, setMatchupsList] = useState<any[]>([]);
  const [expandedMatchupId, setExpandedMatchupId] = useState<string | null>(null);
  const [fetchingTrend, setFetchingTrend] = useState(false);
  const [champStats, setChampStats] = useState<Record<string, any>>({});
  const [pastInterrogations, setPastInterrogations] = useState<any[]>([]);

  // データベース全体の完成度（進捗）を計算
  const dbProgress = useMemo(() => {
    if (champions.length === 0) return { total: 0, completed: 0, percentage: 0, pending: 0 };
    const total = champions.length;
    const completed = champions.filter(c => champDates[c.id] && !champPending[c.id]).length;
    const pending = total - completed;
    const percentage = Math.round((completed / total) * 100) || 0;
    return { total, completed, pending, percentage };
  }, [champions, champDates, champPending]);

  // 描画用のソート済みマッチアップリストの作成（勝率の降順）
  const sortedMatchups = useMemo(() => {
    return [...matchupsList].sort((a, b) => {
      // a の勝率算出
      const aKtm = champStats[a.champion]?.matchup_stats?.[a.enemy];
      let aRate = 50;
      if (aKtm && aKtm.games > 0) {
        aRate = aKtm.win_rate;
      } else {
        const aEnemyMatchups = matchupsList.filter(x => x.enemy === a.enemy);
        const aWins = aEnemyMatchups.filter(x => String(x.raw_data?.result).toLowerCase() === 'win').length;
        const aTotal = aEnemyMatchups.length;
        if (aTotal > 0) aRate = Math.round((aWins / aTotal) * 100);
      }

      // b の勝率算出
      const bKtm = champStats[b.champion]?.matchup_stats?.[b.enemy];
      let bRate = 50;
      if (bKtm && bKtm.games > 0) {
        bRate = bKtm.win_rate;
      } else {
        const bEnemyMatchups = matchupsList.filter(x => x.enemy === b.enemy);
        const bWins = bEnemyMatchups.filter(x => String(x.raw_data?.result).toLowerCase() === 'win').length;
        const bTotal = bEnemyMatchups.length;
        if (bTotal > 0) bRate = Math.round((bWins / bTotal) * 100);
      }

      return bRate - aRate;
    });
  }, [matchupsList, champStats]);

  // エッジワーカーの生存状況を監視する状態
  const [workerStatus, setWorkerStatus] = useState<{ active: boolean; status: string; last_active: string | null }>({
    active: false,
    status: 'unknown',
    last_active: null
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/admin/system/status');
        if (res.ok) {
          const data = await res.json();
          setWorkerStatus(data.worker || { active: false, status: 'unknown', last_active: null });
        }
      } catch (err) {
        console.error('Failed to fetch worker status:', err);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // 辞典一括更新用の状態
  const [bulkStatus, setBulkStatus] = useState<any>({
    initialized: false,
    total: 0,
    completed: 0,
    running: 0,
    failed: 0,
    pending: 0,
    status: 'idle',
    current_champ: null
  });
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkLogs, setBulkLogs] = useState('');

  // 一括更新キュー進捗の取得
  const fetchQueueStatus = async () => {
    try {
      const res = await fetch('/api/admin/champions/queue');
      if (res.ok) {
        const data = await res.json();
        setBulkStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch queue status:', err);
    }
  };

  // 一括更新ジョブ実行状態の取得
  const fetchJobStatus = async () => {
    try {
      const res = await fetch('/api/admin/jobs?job=champion_db_bulk_update');
      if (res.ok) {
        const data = await res.json();
        setIsBulkRunning(data.isRunning);
        if (data.logs) setBulkLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch job status:', err);
    }
  };

  // 一括更新ジョブの開始
  const handleStartBulkUpdate = async () => {
    if (!confirm("全チャンピオンの辞典データをGemini APIを用いて一括更新しますか？\n（API制限が発生した場合は安全に自動停止し、次回続きから再開できます）")) return;
    try {
      // 一括更新開始した時点で、自動的に古い進捗データを0%（初期状態）にリセットする
      await fetch('/api/admin/champions/queue', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      const res = await fetch('/api/admin/jobs', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: 'champion_db_bulk_update' }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('🚀 チャンピオン辞典の一括更新をバックグラウンドで開始しました。');
        fetchJobStatus();
        fetchQueueStatus();
      } else {
        alert(data.error || 'ジョブの起動に失敗しました。');
      }
    } catch (err: any) {
      alert('ジョブ起動中に通信エラーが発生しました。');
    }
  };

  // キューとロックのリセット
  const handleResetQueue = async () => {
    if (!confirm("一括更新キューの進行状況とロックを完全に初期化しますか？\n（現在のキューファイルは削除され、次回起動時に全チャンピオンが未処理として再構築されます）")) return;
    try {
      const res = await fetch('/api/admin/champions/queue', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('🔄 キューとロックを正常にリセットしました。');
        fetchQueueStatus();
        fetchJobStatus();
      } else {
        alert(data.error || 'リセットに失敗しました。');
      }
    } catch (err: any) {
      alert('リセット処理中に通信エラーが発生しました。');
    }
  };

  // 5秒おきにキューとジョブの状態を監視
  useEffect(() => {
    fetchQueueStatus();
    fetchJobStatus();

    const timer = setInterval(() => {
      fetchQueueStatus();
      fetchJobStatus();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

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

    // KTMの戦績データをロード
    fetch('/api/champions/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stats) {
          setChampStats(data.stats);
        }
      })
      .catch(console.error);

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
        return Promise.all([
          // 一覧では大きい strategy 全文は不要。必要なメタ情報だけ取得（エグレス削減 #53）
          supabase.from('matchup_sentinel').select('champion, created_at, patch_meta:raw_data->patch_meta, jg_style:raw_data->jg_style, is_favorited:raw_data->is_favorited').eq('enemy', 'GLOBAL'),
          // 一覧グリッド用に全チャンピオン分のパワースパイクを一括取得（詳細表示と同じchampion_power_spikesテーブル）
          supabase.from('champion_power_spikes').select('champion, early_game_score, mid_game_score, late_game_score'),
          // strategy全文を転送せず「中身があるchampion名」だけを取得し pending 判定に使う（従来の !strategy と同義）
          supabase.from('matchup_sentinel').select('champion').eq('enemy', 'GLOBAL').not('strategy', 'is', null).neq('strategy', '')
        ]);
      })
      .then(([{ data }, { data: spikeRows }, { data: contentRows }]) => {
        const hasContent = new Set((contentRows || []).map((r: any) => r.champion));
        const dates: Record<string, string> = {};
        const pending: Record<string, boolean> = {};
        const metas: Record<string, any> = {};
        const jgStyles: Record<string, any> = {};
        const dbFavorites: string[] = [];
        if (data) {
          data.forEach((row: any) => {
            dates[row.champion] = row.created_at;
            pending[row.champion] = !hasContent.has(row.champion); // 中身があれば未pending（従来の !strategy と同じ挙動）
            metas[row.champion] = row.patch_meta || null;

            // jg_styleが文字列だった場合でも安全にパースする
            let parsedJgStyle = null;
            if (row.jg_style) {
              parsedJgStyle = typeof row.jg_style === 'string' ? JSON.parse(row.jg_style) : row.jg_style;
            }
            jgStyles[row.champion] = parsedJgStyle || null;

            if (row.is_favorited === true) {
              dbFavorites.push(row.champion);
            }
          });
        }
        const spikes: Record<string, any> = {};
        if (spikeRows) {
          spikeRows.forEach((row: any) => {
            spikes[row.champion] = {
              early_game_score: row.early_game_score,
              mid_game_score: row.mid_game_score,
              late_game_score: row.late_game_score
            };
          });
        }
        setChampPowerSpikes(spikes);
        setChampDates(dates);
        setChampPending(pending);
        setChampPatchMetas(metas);
        setChampJgStyles(jgStyles);
        setChampions(fetchedChampions);

        // localStorage と Supabase のお気に入りをマージしてセット
        const localFavs = getFavorites().champions;
        const mergedFavs = Array.from(new Set([...localFavs, ...dbFavorites]));
        setFavoriteChamps(mergedFavs);

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
        mData.forEach((row: any) => {
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

      // 時間帯別の強さ（パワースパイク・構造化データ）。champion_power_spikes は
      // power_spike_generator.py が自動生成するテーブル（課題⑥）。
      const { data: spikeData } = await supabase
        .from('champion_power_spikes')
        .select('early_game_score, mid_game_score, late_game_score, peak_window, summary')
        .eq('champion', champId)
        .maybeSingle();
      setPowerSpikeScores(spikeData || null);

      // KTMカスタムでのそのチャンピオンの実戦成績を取得（#51）
      setKtmStats(null);
      fetch(`/api/champion-stats?champion=${encodeURIComponent(champId)}`)
        .then(r => r.json())
        .then(d => setKtmStats(d && !d.error ? d : null))
        .catch(() => setKtmStats(null));
      
      // Storageからの下書きデータ取得連携（削減案①）
      let loadedNoteDraft = rd.note_draft || '';
      if (rd.note_draft_url) {
        try {
          const res = await fetch(rd.note_draft_url);
          if (res.ok) {
            loadedNoteDraft = await res.text();
          }
        } catch (fetchErr) {
          console.error("❌ Failed to fetch note_draft from storage URL:", rd.note_draft_url, fetchErr);
        }
      }

      setDataFields({
        strengths: rd.strengths || '', weaknesses: rd.weaknesses || '',
        powerSpikes: rd.powerSpikes || '', buildRunes: rd.buildRunes || '',
        fullClearTime: rd.fullClearTime || '', counterChampions: rd.counterChampions || '',
        mustBanChampions: rd.mustBanChampions || '', pickRecommendation: rd.pickRecommendation || '',
        strategy: noteData?.strategy || '', note_draft: loadedNoteDraft,
        customFields: rd.customFields || {},
        patch_meta: rd.patch_meta || null,
        pro_builds: rd.pro_builds || [],
        jg_style: rd.jg_style || null
      });

      // 過去の反省点 (INTERROGATION) の取得 (enemy=PROCESS_INTERROGATION)
      try {
        const { data: interrogationData, error: iError } = await supabase
          .from('matchup_sentinel')
          .select('strategy, raw_data, created_at')
          .eq('enemy', 'PROCESS_INTERROGATION');
          
        if (interrogationData && !iError) {
          const filtered = interrogationData.filter((r: any) => {
            const target = r.raw_data?.target_enemy || "";
            return target.toLowerCase() === champId.toLowerCase();
          });
          setPastInterrogations(filtered);
        } else {
          setPastInterrogations([]);
        }
      } catch (iErr) {
        console.warn("⚠️ 過去の反省データのロードに失敗しました:", iErr);
        setPastInterrogations([]);
      }
    };
    loadChampionData(selected.id);
  }, [selected]);

  const handleToggleFavorite = async () => {
    if (!selected) return;
    
    // 1. localStorage をトグル
    const isNowFav = toggleFavoriteChampion(selected.id);
    
    // 2. Supabase への非同期同期保存
    try {
      const jgStyle = champJgStyles[selected.id] || {};
      const currentStrategy = dataFields.strategy || '';
      
      const raw = {
        source: 'champ_db',
        role: 'GLOBAL',
        strengths: dataFields.strengths,
        weaknesses: dataFields.weaknesses,
        powerSpikes: dataFields.powerSpikes,
        buildRunes: dataFields.buildRunes,
        fullClearTime: dataFields.fullClearTime,
        pickRecommendation: dataFields.pickRecommendation,
        counterChampions: dataFields.counterChampions,
        jg_style: dataFields.jg_style || jgStyle,
        patch_meta: champPatchMetas[selected.id] || null,
        is_favorited: isNowFav
      };
      
      const payload = {
        matchup_id: `champ_${selected.id}_global`,
        champion: selected.id,
        enemy: 'GLOBAL',
        strategy: currentStrategy,
        raw_data: raw
      };
      
      await fetch('/api/admin/champions/save', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
    } catch (err) {
      console.error('❌ Failed to sync favorite to Supabase:', err);
    }
  };

  const handleFetchTrend = async () => {
    if (!selected) return;
    setFetchingTrend(true);
    try {
      const role = roleFilter === 'ALL' ? 'Jungle' : roleFilter;
      const res = await fetch('/api/admin/champions/trend', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champion: selected.id, role })
      });
      
      const result = await res.json();
      if (!result.success || !result.task_id) {
        throw new Error(result.error || 'タスクのキュー登録に失敗しました。');
      }

      const taskId = result.task_id;
      
      // ポーリング開始
      let attempts = 0;
      const maxAttempts = 60; // 3秒 × 60回 = 180秒 (3分)
      
      const poll = async () => {
        if (attempts >= maxAttempts) {
          setFetchingTrend(false);
          alert('トレンド取得タスクがタイムアウトしました。バックグラウンドで処理が継続している可能性があります。');
          return;
        }
        
        attempts++;
        const { data: task, error } = await supabase
          .from('edge_tasks')
          .select('status, error_message')
          .eq('id', taskId)
          .single();
          
        if (error) {
          console.error('Task fetch error:', error);
          setTimeout(poll, 3000);
          return;
        }
        
        if (task.status === 'completed') {
          // 完了したため、最新データ（updated_atも更新されている）をフェッチして状態を更新
          const { data: noteData } = await supabase
            .from('matchup_sentinel')
            .select('strategy, raw_data, created_at')
            .eq('champion', selected.id)
            .eq('enemy', 'GLOBAL')
            .single();
            
          const rd = noteData?.raw_data || {};
          
          let loadedNoteDraft = rd.note_draft || '';
          if (rd.note_draft_url) {
            try {
              const res = await fetch(rd.note_draft_url);
              if (res.ok) {
                loadedNoteDraft = await res.text();
              }
            } catch (fetchErr) {
              console.error("❌ Failed to fetch note_draft from storage URL:", rd.note_draft_url, fetchErr);
            }
          }

          setDataFields({
            strengths: rd.strengths || '',
            weaknesses: rd.weaknesses || '',
            powerSpikes: rd.powerSpikes || '',
            buildRunes: rd.buildRunes || '',
            fullClearTime: rd.fullClearTime || '',
            counterChampions: rd.counterChampions || '',
            mustBanChampions: rd.mustBanChampions || '',
            pickRecommendation: rd.pickRecommendation || '',
            strategy: noteData?.strategy || '',
            note_draft: loadedNoteDraft,
            customFields: rd.customFields || {},
            patch_meta: rd.patch_meta || null,
            pro_builds: rd.pro_builds || [],
            jg_style: rd.jg_style || null
          });
          setChampPatchMetas((p: any) => ({
            ...p,
            [selected.id]: rd.patch_meta || null
          }));
          setChampJgStyles((p: any) => ({
            ...p,
            [selected.id]: rd.jg_style || null
          }));
          if (noteData?.created_at) {
            setChampDates(p => ({
              ...p,
              [selected.id]: noteData.created_at
            }));
          }
          
          setFetchingTrend(false);
          alert('最新のトレンド情報を更新しました！');
        } else if (task.status === 'failed') {
          setFetchingTrend(false);
          alert(`更新に失敗しました: ${task.error_message || 'タスク実行エラー'}`);
        } else {
          // pending or running
          setTimeout(poll, 3000);
        }
      };
      
      setTimeout(poll, 3000);
      
    } catch (err: any) {
      alert(`通信エラー: ${err.message}`);
      setFetchingTrend(false);
    }
  };

  const setField = (key: string, val: string | object) => setDataFields((p: any) => ({ ...p, [key]: val }));

  const setJgStyleField = (subKey: string, val: any) => {
    setDataFields((p: any) => {
      const currentJgStyle = p.jg_style || { role: 'JUNGLE', type: '', blind_pickable: 3, counter_pickable: 3, description: '' };
      return {
        ...p,
        jg_style: {
          ...currentJgStyle,
          [subKey]: val
        }
      };
    });
  };

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
        patch_meta: dataFields.patch_meta, pro_builds: dataFields.pro_builds,
        jg_style: dataFields.jg_style
      }
    };
    try {
      const res = await fetch('/api/admin/champions/save', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '保存APIエラー');

      setChampDates(prev => ({ ...prev, [selected.id]: now }));
      setChampPending(prev => ({ ...prev, [selected.id]: !dataFields.strategy }));
      setChampJgStyles(prev => ({ ...prev, [selected.id]: dataFields.jg_style }));
    } catch (err: any) {
      alert('保存失敗: ' + err.message);
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
    // ロール（レーン）別フィルター
    if (roleFilter !== 'ALL') {
      result = result.filter(c => {
        const jgStyle = champJgStyles[c.id] || {};
        const dbRole = jgStyle.role || '';
        
        // 1. 手動設定されたロール（レーン）がDBにある場合は、それを最優先で判定
        if (dbRole) {
          let normalizedDbRole = dbRole.toUpperCase();
          if (normalizedDbRole === 'JUNGLE') normalizedDbRole = 'JG';
          if (normalizedDbRole === 'SUPPORT') normalizedDbRole = 'SUP';
          return normalizedDbRole === roleFilter;
        }
        
        // 2. なければ DDragon の tags ベースでフォールバック判定
        const allowedTags = ROLE_MAP[roleFilter] || [];
        return c.tags?.some((tag: string) => allowedTags.includes(tag));
      });
    }

    if (showFavoritesOnly) {
      result = result.filter(c => favoriteChamps.includes(c.id));
    }
    // 1. ピック属性フィルター (pickFilter)
    if (pickFilter !== 'ALL') {
      result = result.filter(c => {
        const jgStyle = champJgStyles[c.id] || {};
        const blindPickable = jgStyle.blind_pickable || 0;
        if (pickFilter === 'BLIND') {
          return blindPickable >= 4 || String(jgStyle.pickRecommendation).includes('先出し');
        }
        if (pickFilter === 'COUNTER') {
          const counterPickable = jgStyle.counter_pickable || 0;
          return (blindPickable > 0 && blindPickable <= 2) || counterPickable >= 4 || String(jgStyle.pickRecommendation).includes('後出し') || String(jgStyle.pickRecommendation).includes('カウンター');
        }
        return true;
      });
    }
    // 2. 戦術スタイル（タイプ）フィルター (typeFilter)
    if (typeFilter !== 'ALL') {
      result = result.filter(c => {
        const jgStyle = champJgStyles[c.id] || {};
        if (typeFilter === 'FARM') {
          return String(jgStyle.type).includes('ファーム') || String(jgStyle.description).includes('ファーム') || String(jgStyle.description).includes('パワーファーム');
        }
        if (typeFilter === 'GANK') {
          return String(jgStyle.type).includes('ガング') || String(jgStyle.type).includes('ガンク') || String(jgStyle.description).includes('ガンク') || String(jgStyle.description).includes('アクション');
        }
        if (typeFilter === 'INVASION') {
          return String(jgStyle.type).includes('侵入') || String(jgStyle.description).includes('侵入') || String(jgStyle.description).includes('カウンタージャングル');
        }
        if (typeFilter === 'TANK') {
          return String(jgStyle.type).includes('タンク') || String(jgStyle.description).includes('タンク') || String(jgStyle.description).includes('フロントライン');
        }
        return true;
      });
    }
    return [...result].sort((a, b) => {
      if (sortOrder === 'updated_desc') {
        const dateA = champDates[a.id] ? new Date(champDates[a.id]).getTime() : 0;
        const dateB = champDates[b.id] ? new Date(champDates[b.id]).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;
      } else if (sortOrder === 'updated_asc') {
        const dateA = champDates[a.id] ? new Date(champDates[a.id]).getTime() : 9999999999999;
        const dateB = champDates[b.id] ? new Date(champDates[b.id]).getTime() : 9999999999999;
        if (dateA !== dateB) return dateA - dateB;
      } else if (sortOrder === 'blind_pickable_desc') {
        const valA = champJgStyles[a.id]?.blind_pickable || 0;
        const valB = champJgStyles[b.id]?.blind_pickable || 0;
        if (valA !== valB) return valB - valA;
      } else if (sortOrder === 'counter_pickable_desc') {
        const valA = champJgStyles[a.id]?.counter_pickable || 0;
        const valB = champJgStyles[b.id]?.counter_pickable || 0;
        if (valA !== valB) return valB - valA;
      } else if (sortOrder === 'style_farm_desc') {
        const isFarmA = String(champJgStyles[a.id]?.type).includes('ファーム') ? 1 : 0;
        const isFarmB = String(champJgStyles[b.id]?.type).includes('ファーム') ? 1 : 0;
        if (isFarmA !== isFarmB) return isFarmB - isFarmA;
      }
      return a.name.localeCompare(b.name);
    });
  }, [champions, search, sortOrder, champDates, showPendingOnly, champPending, roleFilter, showFavoritesOnly, favoriteChamps, typeFilter, pickFilter, champJgStyles]);

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

        {/* KTM実戦データ（#51 辞典vs実戦の可視化）: 辞典の主張と実際のカスタム成績を並べて確認 */}
        {ktmStats && ktmStats.games > 0 && (
          <div className="glass-panel rounded-2xl p-5 border-l-4 border-[#00cfef]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-black text-[#00cfef]">📊 KTMカスタムでの実戦データ</span>
              <span className="text-xs text-gray-500">({ktmStats.games}戦)</span>
              <span className="text-[10px] text-gray-500 ml-auto">※ 辞典の記述とこの実績を見比べて、古い/実態と違う情報に気づけます</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-black/30 rounded-xl p-3 text-center">
                <div className="text-[10px] text-gray-400">勝率</div>
                <div className={`text-xl font-black ${ktmStats.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{ktmStats.winRate}%</div>
              </div>
              <div className="bg-black/30 rounded-xl p-3 text-center">
                <div className="text-[10px] text-gray-400">平均KDA</div>
                <div className="text-xl font-black text-white">{ktmStats.avgKda}</div>
                <div className="text-[9px] text-gray-500">{ktmStats.avgKills}/{ktmStats.avgDeaths}/{ktmStats.avgAssists}</div>
              </div>
              <div className="bg-black/30 rounded-xl p-3 text-center">
                <div className="text-[10px] text-gray-400">平均CS</div>
                <div className="text-xl font-black text-white">{ktmStats.avgCs ?? '-'}</div>
              </div>
              <div className="bg-black/30 rounded-xl p-3 text-center">
                <div className="text-[10px] text-gray-400">平均視界</div>
                <div className="text-xl font-black text-white">{ktmStats.avgVision}</div>
              </div>
            </div>
            {ktmStats.topPlayers?.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-gray-500">主な使用者:</span>
                {ktmStats.topPlayers.map((p: any) => (
                  <span key={p.name} className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-gray-300">
                    {p.name} ({p.games}戦 {p.winRate}%)
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TextAreaCard title="強み (Strengths)" icon={Swords} color="text-[var(--color-success)] border-[var(--color-success)] shadow-[var(--color-success)]" value={dataFields.strengths} onChange={v => setField('strengths', v)} />
          <TextAreaCard title="弱み (Weaknesses)" icon={ShieldAlert} color="text-[var(--color-danger)] border-[var(--color-danger)] shadow-[var(--color-danger)]" value={dataFields.weaknesses} onChange={v => setField('weaknesses', v)} />
          <div>
            {powerSpikeScores && (
              <div className="mb-2 flex items-center gap-3 rounded-lg border border-[#c89b3c] px-3 py-2 text-sm">
                <span className="font-bold text-[#c89b3c]">時間帯別の強さ:</span>
                <span>序盤 {'★'.repeat(powerSpikeScores.early_game_score)}{'☆'.repeat(5 - powerSpikeScores.early_game_score)}</span>
                <span>中盤 {'★'.repeat(powerSpikeScores.mid_game_score)}{'☆'.repeat(5 - powerSpikeScores.mid_game_score)}</span>
                <span>終盤 {'★'.repeat(powerSpikeScores.late_game_score)}{'☆'.repeat(5 - powerSpikeScores.late_game_score)}</span>
                {powerSpikeScores.summary && <span className="text-xs opacity-80">{powerSpikeScores.summary}</span>}
              </div>
            )}
            <TextAreaCard title="パワースパイク" icon={Zap} color="text-[#c89b3c] border-[#c89b3c] shadow-[#c89b3c]" value={dataFields.powerSpikes} onChange={v => setField('powerSpikes', v)} />
          </div>
          <TextAreaCard title="コアビルド / ルーン" icon={Shield} color="text-purple-400 border-purple-500 shadow-purple-500" value={dataFields.buildRunes} onChange={v => setField('buildRunes', v)} />
          <TextAreaCard title="対面の有利・不利" icon={Swords} color="text-[#00cfef] border-[#00cfef] shadow-[#00cfef]" value={dataFields.counterChampions} onChange={v => setField('counterChampions', v)} />
          <TextAreaCard title="ピック推奨 (先/後)" icon={Shield} color="text-emerald-400 border-emerald-500 shadow-emerald-500" value={dataFields.pickRecommendation} onChange={v => setField('pickRecommendation', v)} />
          
          {/* 🌲 ジャングルプレイスタイル分類 (自動判定) */}
          {/* 🎯 プレイスタイル分類 (手動編集・全ロール対応) */}
          <div className="glass-panel border-t-2 border-emerald-400 p-5 rounded-2xl group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] shadow-emerald-400/20 relative col-span-1 md:col-span-2">
            <h3 className="text-sm font-black mb-4 flex items-center gap-2 text-emerald-400">
              <Shield size={16} /> 🎯 プレイスタイル分類 ({(dataFields.jg_style?.role || 'JUNGLE').toUpperCase()}基準)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {/* 基準ロール */}
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">基準ロール</label>
                <select
                  value={dataFields.jg_style?.role || 'JUNGLE'}
                  onChange={e => setJgStyleField('role', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="TOP">TOP</option>
                  <option value="JUNGLE">JUNGLE (Jg)</option>
                  <option value="MID">MID</option>
                  <option value="ADC">ADC</option>
                  <option value="SUPPORT">SUPPORT (Sup)</option>
                </select>
              </div>

              {/* タイプ名 */}
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">プレイスタイルタイプ</label>
                {(dataFields.jg_style?.role || 'JUNGLE') === 'JUNGLE' ? (
                  <>
                    <select
                      value={['侵入型', 'ガンク型', 'ファーム型', 'タンク型'].includes(dataFields.jg_style?.type || '') ? dataFields.jg_style?.type : (dataFields.jg_style?.type ? 'other' : '')}
                      onChange={e => {
                        if (e.target.value === 'other') {
                          setJgStyleField('type', 'その他');
                        } else {
                          setJgStyleField('type', e.target.value);
                        }
                      }}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                    >
                      <option value="">未設定</option>
                      <option value="侵入型">侵入型 (インベード・1v1)</option>
                      <option value="ガンク型">ガンク型 (CC・序盤関与)</option>
                      <option value="ファーム型">ファーム型 (高速・キャリー)</option>
                      <option value="タンク型">タンク型 (集団戦・エンゲージ)</option>
                      <option value="other">その他 (手動入力する)</option>
                    </select>
                    {(!['', '侵入型', 'ガンク型', 'ファーム型', 'タンク型'].includes(dataFields.jg_style?.type || '')) && (
                      <input
                        type="text"
                        value={dataFields.jg_style?.type === 'その他' ? '' : (dataFields.jg_style?.type || '')}
                        onChange={e => setJgStyleField('type', e.target.value)}
                        placeholder="スタイルタイプを手動入力..."
                        className="w-full mt-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    )}
                  </>
                ) : (
                  <input
                    type="text"
                    value={dataFields.jg_style?.type || ''}
                    onChange={e => setJgStyleField('type', e.target.value)}
                    placeholder="例: アサシン, コントロール"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                )}
              </div>

              {/* 先出し安定度 */}
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">先出し安定度</label>
                <select
                  value={dataFields.jg_style?.blind_pickable || 3}
                  onChange={e => setJgStyleField('blind_pickable', parseInt(e.target.value) || 3)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                >
                  <option value="1">★☆☆☆☆ (1)</option>
                  <option value="2">★★☆☆☆ (2)</option>
                  <option value="3">★★★☆☆ (3)</option>
                  <option value="4">★★★★☆ (4)</option>
                  <option value="5">★★★★★ (5)</option>
                </select>
              </div>

              {/* 後出し有利度 */}
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">後出し有利度</label>
                <select
                  value={dataFields.jg_style?.counter_pickable || 3}
                  onChange={e => setJgStyleField('counter_pickable', parseInt(e.target.value) || 3)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                >
                  <option value="1">★☆☆☆☆ (1)</option>
                  <option value="2">★★☆☆☆ (2)</option>
                  <option value="3">★★★☆☆ (3)</option>
                  <option value="4">★★★★☆ (4)</option>
                  <option value="5">★★★★★ (5)</option>
                </select>
              </div>
            </div>

            {/* 立ち回り解説 */}
            <div>
              <label className="block text-xs text-gray-400 font-bold mb-1">先出し・後出し評価の根拠 ＆ 立ち回り解説</label>
              <textarea
                value={dataFields.jg_style?.description || ''}
                onChange={e => setJgStyleField('description', e.target.value)}
                placeholder="なぜその先出し・後出しの星評価になったのかの具体的な理由や、立ち回り上の強み・弱みを記述..."
                className="w-full h-20 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

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

          {/* 🚨 過去の敗戦からの反省・教訓 (Sovereign Interrogation) */}
          <div className="glass-panel border-t-2 border-red-500 p-5 rounded-2xl group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] shadow-red-500/20 relative col-span-1 md:col-span-2">
            <h3 className="text-sm font-black mb-4 flex items-center gap-2 text-red-400">
              <ShieldAlert size={16} className="text-red-500 animate-pulse" /> 🚨 過去の敗因反省・教訓 (Sovereign Interrogation)
            </h3>
            {pastInterrogations && pastInterrogations.length > 0 ? (
              <div className="space-y-3">
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-xs text-red-200/90 leading-relaxed flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                  <div>
                    <span className="font-bold block mb-1">過去にこの対面であなたが敗北した際にAIと交わした反省です。</span>
                    同じ過ちを繰り返さないよう、立ち回りやジャングルルート選択時に十分注意しなさい。
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pastInterrogations.map((lesson: any, idx: number) => (
                    <div key={idx} className="bg-black/40 border border-red-500/10 p-4 rounded-xl text-xs text-red-100/90 leading-relaxed space-y-2">
                      <div className="flex justify-between items-center border-b border-white/5 pb-1">
                        <span className="text-red-400 font-bold font-mono">教訓 #{idx+1}</span>
                        <span className="text-[10px] text-gray-500">
                          {lesson.created_at ? new Date(lesson.created_at).toLocaleDateString('ja-JP') : ""}
                        </span>
                      </div>
                      <p className="font-medium whitespace-pre-wrap">{lesson.strategy}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 italic text-xs py-4">このチャンピオン対面での過去の敗北・反省点（教訓）はありません。良好な状態です！</p>
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
              {sortedMatchups.map((m) => {
                const isExpanded = expandedMatchupId === m.matchup_id;
                const rd = m.raw_data || {};
                const difficulty = rd.difficulty || 3;
                const result = rd.result || 'UNKNOWN';

                // 動的な有利・不利の算出とカラーの決定
                const ktmMatchup = champStats[m.champion]?.matchup_stats?.[m.enemy];
                let winRate = 50;
                let hasData = false;
                if (ktmMatchup && ktmMatchup.games > 0) {
                  winRate = ktmMatchup.win_rate;
                  hasData = true;
                } else {
                  const enemyMatchups = matchupsList.filter(x => x.enemy === m.enemy);
                  const eWins = enemyMatchups.filter(x => String(x.raw_data?.result).toLowerCase() === 'win').length;
                  if (enemyMatchups.length > 0) {
                    winRate = Math.round((eWins / enemyMatchups.length) * 100);
                    hasData = true;
                  }
                }

                const isFavored = winRate >= 60;
                const isUnfavored = winRate <= 40;
                
                const cardBorderColor = isFavored ? 'border-l-green-500 bg-green-500/5 hover:bg-[#22c55e]/10' : 
                                       isUnfavored ? 'border-l-red-500 bg-red-500/5 hover:bg-[#ef4444]/10' : 
                                       'border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10';
                
                return (
                  <div key={m.matchup_id} className={`glass-panel border-l-4 rounded-xl transition-all ${cardBorderColor}`}>
                    {/* ヘッダー部分。クリックでアコーディオン開閉 */}
                    <div 
                      onClick={() => setExpandedMatchupId(isExpanded ? null : m.matchup_id)}
                      className="p-4 flex items-center justify-between cursor-pointer select-none flex-wrap gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <img src={getChampIcon(m.enemy)} alt={m.enemy} className="w-10 h-10 rounded-full border border-white/10" />
                        <div>
                          <p className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                            vs {m.enemy} 
                            {hasData && (
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                                isFavored ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 
                                isUnfavored ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 
                                'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              }`}>
                                {isFavored ? '🟢 有利' : isUnfavored ? '🔴 不利' : '🟡 互角'}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">{m.title || `${m.champion} vs ${m.enemy}`}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        {/* 各チャンプごとの勝率表示 */}
                        {(() => {
                          const enemyMatchups = matchupsList.filter(x => x.enemy === m.enemy);
                          const eWins = enemyMatchups.filter(x => String(x.raw_data?.result).toLowerCase() === 'win').length;
                          const eLosses = enemyMatchups.filter(x => String(x.raw_data?.result).toLowerCase() === 'lose').length;
                          const eTotal = eWins + eLosses;

                          // 1. KTMカスタムマッチの対面勝率があれば最優先で使用
                          const ktmMatchup = champStats[m.champion]?.matchup_stats?.[m.enemy];
                          if (ktmMatchup && ktmMatchup.games > 0) {
                            const winRate = ktmMatchup.win_rate;
                            return (
                              <div className={`px-2 py-1 rounded-md border flex flex-col items-center justify-center min-w-[65px] ${winRate >= 60 ? 'bg-green-500/10 text-green-400 border-green-500/20' : winRate <= 40 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider scale-90 leading-none">KTM {ktmMatchup.games}戦</span>
                                <span className="font-mono text-xs font-black mt-0.5 leading-none">{winRate}%</span>
                              </div>
                            );
                          }
                          
                          // 2. なければメモの勝敗結果から勝率を算出して表示
                          const memoWinRate = eTotal > 0 ? Math.round((eWins / eTotal) * 100) : null;
                          if (memoWinRate !== null) {
                            return (
                              <div className={`px-2 py-1 rounded-md border flex flex-col items-center justify-center min-w-[65px] ${memoWinRate >= 60 ? 'bg-green-500/10 text-green-400 border-green-500/20' : memoWinRate <= 40 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-gray-500/10 text-gray-300 border-white/5'}`}>
                                <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider scale-90 leading-none">メモ {eTotal}戦</span>
                                <span className="font-mono text-xs font-black mt-0.5 leading-none">{memoWinRate}%</span>
                              </div>
                            );
                          }

                          // 3. どちらもなければ元のメモの単体勝敗結果を出す
                          if (result && result !== 'UNKNOWN') {
                            return (
                              <span className={`text-[10px] font-black px-2 py-1 rounded-md ${result === 'Win' ? 'bg-[#22c55e]/15 text-[var(--color-success)]' : 'bg-[#ef4444]/15 text-[var(--color-danger)]'}`}>
                                {result}
                              </span>
                            );
                          }
                          return null;
                        })()}

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

                            {/* KTM直接対決データ分析の表示 */}
                            {champStats[m.champion] && (() => {
                              const history = champStats[m.champion].match_history?.filter((h: any) => h.enemy_champion === m.enemy) || [];
                              const trendHistory = [...history].reverse();
                              
                              // プレイヤー別の集計ロジック
                              const playerAgg: Record<string, { games: number, wins: number, kills: number, deaths: number, assists: number, role: string }> = {};
                              history.forEach((h: any) => {
                                const name = h.player_name;
                                if (!playerAgg[name]) {
                                  playerAgg[name] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, role: h.role || 'UNKNOWN' };
                                }
                                const a = playerAgg[name];
                                a.games += 1;
                                if (h.is_win) a.wins += 1;
                                const parts = String(h.score).split('/').map(Number);
                                a.kills += parts[0] || 0;
                                a.deaths += parts[1] || 0;
                                a.assists += parts[2] || 0;
                              });

                              if (history.length === 0) return null;

                              return (
                                <div className="border-t border-white/5 bg-black/40 p-5 mt-4 space-y-5 rounded-b-xl text-xs">
                                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="font-bold text-[#00cfef] flex items-center gap-1.5 uppercase tracking-widest text-[10px]">
                                      <Swords size={12} className="text-[#00cfef]" /> KTM直接対決データ分析 ({m.champion} vs {m.enemy})
                                    </span>
                                    {champStats[m.champion].matchup_stats?.[m.enemy] && (
                                      <span className="font-mono font-bold text-amber-400">
                                        直接勝率: {champStats[m.champion].matchup_stats[m.enemy].win_rate}% ({champStats[m.champion].matchup_stats[m.enemy].games}戦)
                                      </span>
                                    )}
                                  </div>

                                  {/* 1. 勝敗推移 */}
                                  <div className="space-y-1">
                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">📈 勝敗トレンド</span>
                                    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                                      {trendHistory.map((h: any, idx: number) => (
                                        <div key={idx} className="flex items-center gap-2 shrink-0">
                                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border ${h.is_win ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                            <span className="font-bold">{h.player_name}</span>
                                            <span className="font-mono text-[9px]">({new Date(h.created_at).toLocaleDateString('ja-JP', {month: '2-digit', day: '2-digit'})})</span>
                                          </div>
                                          {idx < trendHistory.length - 1 && <span className="text-gray-700 font-bold">➔</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* 2. プレイヤー集計 */}
                                  <div className="space-y-1">
                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">📊 プレイヤー別の実績</span>
                                    <div className="overflow-hidden rounded-lg border border-white/5 bg-black/40">
                                      <table className="w-full text-left border-collapse text-[10px]">
                                        <thead>
                                          <tr className="bg-white/5 text-gray-400 font-bold uppercase border-b border-white/5 text-[8px]">
                                            <th className="p-2">プレイヤー</th>
                                            <th className="p-2 text-center">ロール</th>
                                            <th className="p-2 text-center">試合数</th>
                                            <th className="p-2 text-center">勝率</th>
                                            <th className="p-2 text-center">平均KDA</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 font-medium">
                                          {Object.entries(playerAgg).map(([name, pa]: any) => {
                                            const winRate = Math.round((pa.wins / pa.games) * 100);
                                            const kda = pa.deaths > 0 ? Math.round(((pa.kills + pa.assists) / pa.deaths) * 10) / 10 : (pa.kills + pa.assists);
                                            return (
                                              <tr key={name} className="hover:bg-white/[0.01] transition-colors">
                                                <td className="p-2 font-bold text-white">{name}</td>
                                                <td className="p-2 text-center font-mono text-gray-500">{pa.role}</td>
                                                <td className="p-2 text-center text-gray-300 font-bold">{pa.games}</td>
                                                <td className={`p-2 text-center font-black ${winRate >= 60 ? 'text-green-400' : winRate <= 40 ? 'text-red-400' : 'text-gray-300'}`}>
                                                  {winRate}%
                                                </td>
                                                <td className="p-2 text-center font-mono">
                                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${kda >= 3.0 ? 'bg-green-500/10 text-green-400' : kda <= 1.5 ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-300'}`}>
                                                    {kda}
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  {/* 3. 個別試合履歴 */}
                                  <div className="space-y-1">
                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">⚔️ 個別試合履歴 (日付順)</span>
                                    <div className="overflow-hidden rounded-lg border border-white/5 bg-black/40">
                                      <table className="w-full text-left border-collapse text-[10px]">
                                        <thead>
                                          <tr className="bg-white/5 text-gray-400 font-bold uppercase border-b border-white/5 text-[8px]">
                                            <th className="p-2">試合日</th>
                                            <th className="p-2">プレイヤー</th>
                                            <th className="p-2 text-center">スコア (KDA)</th>
                                            <th className="p-2 text-center">勝敗</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 font-medium">
                                          {history.map((h: any, idx: number) => {
                                            const parts = String(h.score).split('/').map(Number);
                                            const kda = parts[1] > 0 ? Math.round(((parts[0] + parts[2]) / parts[1]) * 10) / 10 : (parts[0] + parts[2]);
                                            return (
                                              <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                                                <td className="p-2 font-mono text-gray-400">
                                                  {new Date(h.created_at).toLocaleDateString('ja-JP')}
                                                </td>
                                                <td className="p-2 font-bold text-white">{h.player_name}</td>
                                                <td className="p-2 text-center font-mono text-gray-300">
                                                  <span className="text-green-400">{parts[0]}</span>/
                                                  <span className="text-red-400">{parts[1]}</span>/
                                                  <span className="text-yellow-400">{parts[2]}</span>
                                                  <span className="text-gray-500 ml-1">({kda})</span>
                                                </td>
                                                <td className="p-2 text-center">
                                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${h.is_win ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                    {h.is_win ? 'WIN' : 'LOSE'}
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
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

      {/* 辞典一括更新状況カード（一番上に配置） */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ delay: 0.1 }} 
        className="glass-panel p-6 rounded-2xl border-t-2 border-[#c89b3c]/50 relative overflow-hidden"
      >
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#c89b3c]/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex-1 space-y-2 w-full">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
              <Sparkles size={20} className="text-[#c89b3c]" />
              AIチャンピオン辞典一括更新システム
              {bulkStatus.patch_version && (
                <span className="text-xs bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded-md font-mono">
                  パッチ: {bulkStatus.patch_version}
                </span>
              )}
              <span className={`text-[10px] font-black border px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-all ${
                workerStatus.active 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${workerStatus.active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                {workerStatus.active ? 'エッジワーカー: 稼働中' : 'エッジワーカー: 停止中'}
              </span>
            </h3>
            <p className="text-xs text-gray-400">
              全チャンピオンの統計・ルーン・ビルドをGemini APIで自動リサーチし、既存のユーザーメモを保護しながら辞書を一括更新します。
            </p>
            
            {/* 進行中のジョブがある場合はジョブの進捗を表示、そうでない場合はDB全体の進捗を常に表示 */}
            {isBulkRunning || (bulkStatus.initialized && bulkStatus.total > 0) ? (
              <div className="space-y-2 mt-2 w-full">
                <div className="flex justify-between text-xs font-bold text-gray-300 flex-wrap gap-2">
                  <span>ジョブ進捗率: {Math.round((bulkStatus.completed / bulkStatus.total) * 100) || 0}% ({bulkStatus.completed} / {bulkStatus.total} 体)</span>
                  <span className="text-gray-400">
                    {isBulkRunning ? `🔥 ${bulkStatus.current_champ || '調査中'} をリサーチ中...` : 
                     bulkStatus.status === 'suspended' ? '⏸️ API制限により一時停止中' : 
                     bulkStatus.status === 'completed' ? '✅ すべての更新が完了' : '💤 待機中'}
                  </span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                  <div 
                    className={`h-full transition-all duration-500 ${isBulkRunning ? 'bg-gradient-to-r from-amber-500 to-[#c89b3c] animate-pulse' : 'bg-[#c89b3c]'}`}
                    style={{ width: `${(bulkStatus.completed / bulkStatus.total) * 100 || 0}%` }}
                  />
                </div>
                <div className="flex gap-4 text-[10px] text-gray-500 font-semibold font-mono flex-wrap">
                  <span>未処理: {bulkStatus.pending}</span>
                  <span className="text-amber-500">実行中: {bulkStatus.running}</span>
                  <span className="text-emerald-400">完了: {bulkStatus.completed}</span>
                  <span className="text-red-400">失敗: {bulkStatus.failed}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 mt-2 w-full">
                <div className="flex justify-between text-xs font-bold text-gray-300 flex-wrap gap-2">
                  <span>辞典データベース構築率: {dbProgress.percentage}% ({dbProgress.completed} / {dbProgress.total} 体 構築完了)</span>
                  <span className="text-gray-400">未構築: {dbProgress.pending} 体</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-emerald-500/80 transition-all duration-500"
                    style={{ width: `${dbProgress.percentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-3 shrink-0 flex-wrap w-full md:w-auto justify-end">
            <button
              onClick={handleStartBulkUpdate}
              disabled={isBulkRunning}
              className="px-5 py-3 bg-gradient-to-r from-amber-500 to-[#c89b3c] hover:from-amber-400 hover:to-[#b78b2c] text-black font-black text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(200,155,60,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <RefreshCw size={16} className={isBulkRunning ? 'animate-spin' : ''} />
              {isBulkRunning ? '更新を実行中...' : bulkStatus.status === 'suspended' ? '更新を再開' : '一括更新を開始'}
            </button>
            
            <button
              onClick={handleResetQueue}
              className="px-4 py-3 glass-panel glass-panel-hover text-gray-400 hover:text-white rounded-xl text-sm font-bold transition-all"
            >
              キュー初期化
            </button>
          </div>
        </div>
      </motion.div>

      {/* 検索バー・フィルター（スクロール追従） */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="sticky top-0 z-20 flex flex-col gap-3 glass-panel p-4 rounded-2xl shadow-2xl backdrop-blur-2xl bg-[#06070a]/90">
        
        {/* スマホ表示の時だけ見える「フィルター開閉ボタン」 */}
        <button 
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="md:hidden w-full flex items-center justify-between px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-[#c89b3c] font-bold text-xs hover:bg-gray-800 transition-all"
        >
          <span className="flex items-center gap-1.5">
            <Filter size={14} /> 絞り込み条件を指定する
          </span>
          <span>{isFilterOpen ? '▲ 閉じる' : '▼ 開く'}</span>
        </button>

        {/* フィルター本体：スマホ時は開閉状態に連動、PC（md以上）では常に表示 */}
        <div className={`${isFilterOpen ? 'flex' : 'hidden'} md:flex flex-col gap-4 items-center flex-wrap w-full`}>
          <div className="flex gap-4 items-center flex-wrap w-full">
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
            {/* ピック属性フィルターボタン */}
            <div className="flex glass-panel p-1 rounded-xl items-center gap-0.5">
              {[
                { id: 'ALL', label: 'すべてのピック属性' },
                { id: 'BLIND', label: '🟢 先出し向け' },
                { id: 'COUNTER', label: '🔴 後出し向け' }
              ].map(p => (
                <button key={p.id} onClick={() => setPickFilter(p.id as any)}
                  className={`px-3 py-2 rounded-lg text-xs font-black tracking-wider transition-all ${
                    pickFilter === p.id
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* タイプ（戦術）フィルターボタン */}
            <div className="flex glass-panel p-1 rounded-xl items-center gap-0.5">
              {[
                { id: 'ALL', label: 'すべてのタイプ' },
                { id: 'FARM', label: '🚜 ファーム' },
                { id: 'GANK', label: '⚔️ ガンク' },
                { id: 'INVASION', label: '🎒 侵入' },
                { id: 'TANK', label: '🛡️ タンク' }
              ].map(t => (
                <button key={t.id} onClick={() => setTypeFilter(t.id as any)}
                  className={`px-3 py-2 rounded-lg text-xs font-black tracking-wider transition-all ${
                    typeFilter === t.id
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${showFavoritesOnly ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'glass-panel text-gray-400 border-transparent hover:text-white'}`}
            >
              <StarIcon size={16} fill={showFavoritesOnly ? 'currentColor' : 'none'} className={showFavoritesOnly ? 'text-yellow-400' : ''} /> お気に入り
            </button>
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="glass-panel border-none rounded-xl px-4 py-2.5 font-bold text-[#c89b3c] outline-none min-w-[160px] cursor-pointer">
              <option value="updated_desc">更新日が新しい順</option>
              <option value="updated_asc">更新日が古い順</option>
              <option value="blind_pickable_desc">先出し安定度順 (★順)</option>
              <option value="counter_pickable_desc">後出し有利度順 (★順)</option>
              <option value="style_farm_desc">ファーム重視度順</option>
              <option value="name_asc">名前順</option>
            </select>
          </div>
        </div>
        {/* ヒット数表示 */}
        <div className="flex items-center gap-2 px-1 text-xs font-bold">
          <span className="text-gray-500">{champions.length}件中</span>
          <span className="text-[#c89b3c] text-sm">{filtered.length}件</span>
          <span className="text-gray-500">ヒット</span>
          {(search || roleFilter !== 'ALL' || typeFilter !== 'ALL' || showFavoritesOnly) && (
            <button onClick={() => { setSearch(''); setRoleFilter('ALL'); setTypeFilter('ALL'); setShowFavoritesOnly(false); }}
              className="ml-2 text-gray-500 hover:text-white transition-colors underline underline-offset-2">
              フィルターをリセット
            </button>
          )}
        </div>
      </motion.div>

      {loading ? (
        <Spinner label="チャンピオン辞典を読み込み中..." />
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
                  const patchName = patchMeta?.patch ? `P${patchMeta.patch}` : 'P??';
                  
                  // 更新から3日以上経っている場合は少し古いトレンドと判定 (259200秒)
                  const isOld = patchMeta?.updated_at ? (Date.now() / 1000 - patchMeta.updated_at > 259200) : true;
                  
                  return (
                    <div className="flex flex-col items-center gap-0.5 mt-1 pointer-events-none">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black leading-none border transition-colors ${
                        !patchMeta
                          ? 'bg-red-500/10 border-red-500/20 text-red-400/60'
                          : isOld 
                            ? 'bg-amber-400/5 border-amber-400/20 text-amber-400/60' 
                            : 'bg-cyan-400/10 border-cyan-400/20 text-cyan-400'
                      }`}>
                        {patchName}
                      </span>
                      <span className={`text-[8px] font-bold leading-none ${isOld ? 'text-gray-600' : 'text-gray-500'}`}>
                        {patchMeta?.updated_at ? getRelativeTimeString(patchMeta.updated_at) : '未解析'}
                      </span>
                    </div>
                  );
                })()}
                {(() => {
                  const jgStyle = champJgStyles[c.id];
                  if (!jgStyle || (jgStyle.blind_pickable === undefined && jgStyle.counter_pickable === undefined && !jgStyle.type)) return null;
                  
                  return (
                    <div className="flex flex-col items-center gap-0.5 mt-1 border-t border-white/5 pt-1.5 w-full text-[9px] font-bold pointer-events-none">
                      {jgStyle.blind_pickable !== undefined && (
                        <div className="flex justify-between w-full px-1 text-emerald-400">
                          <span>先</span>
                          <span className="font-mono">★{jgStyle.blind_pickable}</span>
                        </div>
                      )}
                      {jgStyle.counter_pickable !== undefined && (
                        <div className="flex justify-between w-full px-1 text-[#00cfef]">
                          <span>後</span>
                          <span className="font-mono">★{jgStyle.counter_pickable}</span>
                        </div>
                      )}
                      {jgStyle.type && (
                        <div className="mt-1 px-1 py-0.5 rounded text-[8px] font-black leading-none bg-amber-500/10 border border-amber-500/20 text-amber-400 text-center w-full truncate" title={jgStyle.type}>
                          {jgStyle.type === 'ファーム型' ? '🚜 ファーム' :
                           jgStyle.type === 'ガンク型' ? '⚔️ ガンク' :
                           jgStyle.type === '侵入型' ? '🎒 侵入' :
                           jgStyle.type === 'タンク型' ? '🛡️ タンク' : jgStyle.type}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {(() => {
                  // 時間帯別の強さ（パワースパイク）を一覧グリッドでもひと目で確認できるようにするミニ表示
                  const spike = champPowerSpikes[c.id];
                  if (!spike) return null;
                  const phases: { label: string; score: number }[] = [
                    { label: '序', score: spike.early_game_score },
                    { label: '中', score: spike.mid_game_score },
                    { label: '終', score: spike.late_game_score }
                  ];
                  const peakIdx = phases.reduce((maxI, p, i, arr) => p.score > arr[maxI].score ? i : maxI, 0);
                  return (
                    <div className="flex justify-center gap-1 mt-1 pointer-events-none" title="時間帯別の強さ（序盤/中盤/終盤）">
                      {phases.map((p, i) => (
                        <span key={p.label} className={`text-[8px] font-black px-1 rounded leading-none ${
                          i === peakIdx ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-gray-600'
                        }`}>
                          {p.label}{p.score}
                        </span>
                      ))}
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
