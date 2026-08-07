"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getChampIcon, getChampSplash } from '../../../lib/ddragonClient';
import { ChevronLeft, Search, Save, BookOpen, RefreshCw, Zap, ShieldAlert, Swords, Shield, Copy, Check, FileText, Eye, Edit2, Activity, Plus, Trash, Filter, Star as StarIcon, Award, Sparkles, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { getFavorites, toggleFavoriteChampion } from '../../../components/FavoritesPanel';
import { Spinner } from '../../../components/Feedback';
import ChampionFactCheckPanel from '../ChampionFactCheckPanel';
import ChampionRevisionHistory from '../ChampionRevisionHistory';

function ChampionsContent({ isAdmin }: { isAdmin: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [champions, setChampions] = useState<any[]>([]);
  // フィルタ・ソート状態はuseStateのみで管理していたためリロードで消えていた
  // (2026-08-05発覚)。多数のフィルタを設定した後に別チャンピオン詳細を見て戻る、
  // という操作を頻繁に行う画面のため、URLクエリに保持して復元できるようにする。
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [sortOrder, setSortOrder] = useState(() => searchParams.get('sort') || 'updated_desc');
  const [roleFilter, setRoleFilter] = useState<string>(() => searchParams.get('role') || 'ALL');

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
  // handleFetchTrend のポーリングはクロージャで selected を捕まえてしまうため、
  // 完了時点の「本当に今選択中のチャンピオン」を判定するための参照
  const selectedRef = useRef<any>(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(() => searchParams.get('fav') === '1');
  const [loading, setLoading] = useState(true);
  const [champDates, setChampDates] = useState<Record<string, string>>({});
  const [champPending, setChampPending] = useState<Record<string, boolean>>({});
  const [champPatchMetas, setChampPatchMetas] = useState<Record<string, any>>({});
  const [champJgStyles, setChampJgStyles] = useState<Record<string, any>>({});
  // 一覧グリッドでも「いつ頃強いか」がひと目でわかるように、全チャンピオン分を一括取得する
  const [champPowerSpikes, setChampPowerSpikes] = useState<Record<string, { early_game_score: number; mid_game_score: number; late_game_score: number }>>({});
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FARM' | 'GANK' | 'INVASION' | 'TANK'>(() => (searchParams.get('type') as any) || 'ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [pickFilter, setPickFilter] = useState<'ALL' | 'BLIND' | 'COUNTER'>(() => (searchParams.get('pick') as any) || 'ALL');

  // 現在のフィルタ・ソート状態をURLクエリへ反映する。チャンピオン詳細を開いている
  // 間(selected有り)は一覧側のクエリを書き換えない。
  useEffect(() => {
    if (selected) return;
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (sortOrder !== 'updated_desc') params.set('sort', sortOrder);
    if (roleFilter !== 'ALL') params.set('role', roleFilter);
    if (typeFilter !== 'ALL') params.set('type', typeFilter);
    if (pickFilter !== 'ALL') params.set('pick', pickFilter);
    if (showFavoritesOnly) params.set('fav', '1');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sortOrder, roleFilter, typeFilter, pickFilter, showFavoritesOnly, selected]);

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
  
  const [isGuideOpen, setIsGuideOpen] = useState(false);
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
  const [editingStrategy, setEditingStrategy] = useState(false);
  const [saving, setSaving] = useState(false);
  // 成功時はsaving状態がfalseに戻るだけで明示表示が無く、保存されたか確信が持てなかった
  // (2026-08-05発覚)。保存成功を数秒間だけ明示するトースト用フラグ。
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [noteDraftMode, setNoteDraftMode] = useState<'preview' | 'edit'>('preview');
  const [favoriteChamps, setFavoriteChamps] = useState<string[]>([]);
  const [matchupsList, setMatchupsList] = useState<any[]>([]);
  const [expandedMatchupId, setExpandedMatchupId] = useState<string | null>(null);
  const [isMatchupSectionCollapsed, setIsMatchupSectionCollapsed] = useState(true);
  const [fetchingTrend, setFetchingTrend] = useState(false);
  // 「取得中...」から状況が分からないという指摘を受け、キュー待ち/AI生成中/完了などの
  // 実際のフェーズをリアルタイムで表示するための状態。
  const [trendPhase, setTrendPhase] = useState<'idle' | 'queuing' | 'pending' | 'running' | 'completed' | 'failed' | 'offline' | 'timeout' | 'error'>('idle');
  const [trendMessage, setTrendMessage] = useState('');
  const [trendStartedAt, setTrendStartedAt] = useState<number | null>(null);
  const [trendElapsedSec, setTrendElapsedSec] = useState(0);
  const [champStats, setChampStats] = useState<Record<string, any>>({});
  const [pastInterrogations, setPastInterrogations] = useState<any[]>([]);

  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    field?: string;
    targetKey?: string;
    title?: string;
  } | null>(null);

  const handleOpenHistory = (field?: string, title?: string, targetKey?: string) => {
    setHistoryModal({ isOpen: true, field, title, targetKey });
  };

  const [matchupSearch, setMatchupSearch] = useState('');
  const filteredMatchupsList = useMemo(() => {
    if (!matchupSearch.trim()) return matchupsList;
    const q = matchupSearch.toLowerCase();
    return matchupsList.filter((m) => m.enemy?.toLowerCase().includes(q) || m.title?.toLowerCase().includes(q));
  }, [matchupsList, matchupSearch]);

  // トレンド取得中の経過秒数を1秒ごとに更新（「本当に動いているか」を見えるようにする）
  useEffect(() => {
    if (!trendStartedAt || !fetchingTrend) return;
    const timer = setInterval(() => {
      setTrendElapsedSec(Math.floor((Date.now() - trendStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [trendStartedAt, fetchingTrend]);

  // 完了メッセージはしばらく表示してから自動的に消す
  useEffect(() => {
    if (trendPhase !== 'completed') return;
    const t = setTimeout(() => { setTrendPhase('idle'); setTrendMessage(''); }, 6000);
    return () => clearTimeout(t);
  }, [trendPhase]);

  // 詳細モーダル内の折りたたみアコーディオン制御状態（デフォルト非表示・折りたたみ）
  const [isStrategyCollapsed, setIsStrategyCollapsed] = useState(true);
  const [isDraftsCollapsed, setIsDraftsCollapsed] = useState(true);
  const [isMatchupsCollapsed, setIsMatchupsCollapsed] = useState(true);


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


  // 初期データの並列同時ロード (Promise.all でウォーターフォール通信を完全排除)
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

    let isMounted = true;

    // 全初期APIを Promise.all で並列一元取得
    Promise.all([
      fetch('/api/champions/stats').then(res => res.json()).catch(() => null),
      fetch('https://ddragon.leagueoflegends.com/api/versions.json')
        .then(r => r.json())
        .then(versions => fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/ja_JP/champion.json`).then(r => r.json()))
        .catch(() => null),
      fetch('/api/champions/dictionary-overview', { credentials: 'include' }).then(res => res.json()).catch(() => null),
    ])
      .then(([statsData, ddragonData, overview]) => {
        if (!isMounted) return;

        if (statsData && statsData.success && statsData.stats) {
          setChampStats(statsData.stats);
        }

        if (ddragonData && ddragonData.data) {
          const fetchedChampions = Object.values(ddragonData.data).map((c: any) => ({
            id: c.id, key: c.key, name: c.name, title: c.title, tags: c.tags,
            searchKey: `${c.id.toLowerCase()} ${c.name}`
          }));

          setChampPowerSpikes(overview?.powerSpikes || {});
          setChampDates(overview?.dates || {});
          setChampPending(overview?.pending || {});
          setChampPatchMetas(overview?.patchMetas || {});
          setChampJgStyles(overview?.jgStyles || {});
          setChampions(fetchedChampions);

          // localStorage と Supabase のお気に入りをマージしてセット
          const localFavs = getFavorites().champions;
          const mergedFavs = Array.from(new Set([...localFavs, ...(overview?.dbFavorites || [])]));
          setFavoriteChamps(mergedFavs);

          // URLパラメータ ?select=ChampId の自動選択処理
          const selectId = searchParams.get('select');
          if (selectId) {
            const found = fetchedChampions.find(c => c.id === selectId);
            if (found) setSelected(found);
          }
        }
      })
      .catch(console.error)
      .finally(() => {
        if (isMounted) setLoading(false);
      });
  }, [searchParams]);

  const isFavorited = selected ? favoriteChamps.includes(selected.id) : false;

  const [draftRestored, setDraftRestored] = useState(false);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'unset';
    if (!selected) return;

    setExpandedMatchupId(null); // 選択したチャンピオンが変わったときにアコーディオンをリセット
    setDraftRestored(false);
    setDetailLoading(true);
    setDetailError(null);
    let cancelled = false; // 読み込み中に別チャンピオンへ切り替えた場合、古い結果で上書きしないためのガード

    const loadChampionData = async (champId: string) => {
      try {
        const res = await fetch(`/api/champions/detail?champion=${encodeURIComponent(champId)}`, { credentials: 'include' });
        const detail = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(detail.error || '取得に失敗しました');

        setMatchupsList(detail.matchupsList || []);
        setPowerSpikeScores(detail.powerSpikeScores || null);

        // 下書き (champ_draft_{champId}) のチェックと自動復元
        try {
          const savedDraft = localStorage.getItem(`champ_draft_${champId}`);
          if (savedDraft) {
            const parsed = JSON.parse(savedDraft);
            setDataFields((prev: any) => ({ ...(detail.dataFields || {}), ...parsed }));
            setDraftRestored(true);
          } else {
            setDataFields(detail.dataFields || {});
          }
        } catch {
          setDataFields(detail.dataFields || {});
        }

        setPastInterrogations(detail.pastInterrogations || []);
      } catch (err: any) {
        console.warn('⚠️ チャンピオン詳細データのロードに失敗しました:', err);
        if (cancelled) return;
        setDetailError(err.message || '詳細データの取得に失敗しました');
        setMatchupsList([]);
        setPowerSpikeScores(null);
        setPastInterrogations([]);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    loadChampionData(selected.id);

    return () => {
      cancelled = true;
      document.body.style.overflow = 'unset';
    };
  }, [selected]);

  const handleToggleFavorite = async () => {
    if (!selected) return;

    // 1. localStorage をトグル
    const isNowFav = toggleFavoriteChampion(selected.id);

    // 2. Supabase への同期保存。
    // 以前は管理者専用の /api/admin/champions/save を経由していたため、管理者ログインして
    // いないスマホ閲覧時はここが401で失敗し、お気に入りがlocalStorageだけに残って
    // PCと同期しなかった。お気に入りは誰でも安全にトグルできる個人設定なので、
    // 認証不要の専用エンドポイントを使う（raw_data全体の再構築・上書きもしない）。
    try {
      await fetch('/api/champions/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champion: selected.id, is_favorited: isNowFav })
      });
    } catch (err) {
      console.error('❌ Failed to sync favorite to Supabase:', err);
    }
  };

  const handleFetchTrend = async () => {
    if (!selected) return;
    const champIdAtStart = selected.id; // ポーリング完了時に選択が変わっていないか確認するために保持
    setFetchingTrend(true);
    setTrendPhase('queuing');
    setTrendMessage('タスクをキューに登録中...');
    setTrendStartedAt(Date.now());
    setTrendElapsedSec(0);
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

      // デーモン(edge_worker_daemon.py)が起動していないと、タスクはキューに入ったまま
      // 誰にも処理されず、900秒待っても必ずタイムアウトする。先にハートビートを見て、
      // 動いていなければ「待っても無駄」であることをすぐに伝える。
      try {
        const hbRes = await fetch('/api/tasks/status?id=00000000-0000-0000-0000-000000000000', { credentials: 'include' });
        const hbData = await hbRes.json();
        const heartbeat = hbData.task;
        const diffSec = heartbeat ? (Date.now() - new Date(heartbeat.updated_at).getTime()) / 1000 : Infinity;
        if (diffSec > 60) {
          setFetchingTrend(false);
          setTrendPhase('offline');
          setTrendMessage('ローカルPCのEdge Worker Daemonが起動していないようです。タスク自体はキューに登録済みなので、PCで start_all.ps1 を実行すれば自動的に処理されます（もう一度ボタンを押す必要はありません）。');
          return;
        }
      } catch (hbErr) {
        console.warn('ハートビート確認に失敗（そのままポーリングを続行）:', hbErr);
      }

      setTrendPhase('pending');
      setTrendMessage('キューで順番待ち中...（他のチャンピオン更新やYouTube解析タスクが先にある場合があります）');

      // ポーリング開始
      // バックエンド(champion_trend_worker.py)は最大600秒(10分)処理にかかりうる上、
      // youtube_absorb/dict_synthesizerタスクとの排他待ちも発生するため、
      // 余裕を持って900秒(15分)まで待つ。
      let attempts = 0;
      const maxAttempts = 300; // 3秒 × 300回 = 900秒 (15分)

      const poll = async () => {
        if (attempts >= maxAttempts) {
          setFetchingTrend(false);
          setTrendPhase('timeout');
          setTrendMessage('タイムアウトしました。バックグラウンドで処理が継続している可能性があります。');
          return;
        }

        attempts++;
        const taskRes = await fetch(`/api/tasks/status?id=${taskId}`, { credentials: 'include' });
        const taskData = await taskRes.json();
        const task = taskData.task;

        if (!taskRes.ok || !task) {
          console.error('Task fetch error:', taskData.error);
          setTimeout(poll, 3000);
          return;
        }

        if (task.status === 'running') {
          setTrendPhase('running');
          setTrendMessage('AIがトレンド情報を生成中...');
        } else if (task.status === 'pending') {
          setTrendPhase('pending');
          setTrendMessage('キューで順番待ち中...（他のチャンピオン更新やYouTube解析タスクが先にある場合があります）');
        }

        if (task.status === 'completed') {
          setFetchingTrend(false);
          setTrendPhase('completed');
          setTrendMessage('最新のトレンド情報を更新しました！');
          // ポーリング中に別のチャンピオンへ切り替えていたら、今の画面には反映しない
          // （データ自体はDBに保存済みなので、そのチャンピオンを開き直せば見える）
          if (selectedRef.current?.id !== champIdAtStart) return;

          // 完了したため、最新データ（updated_atも更新されている）をフェッチして状態を更新
          const detailRes = await fetch(`/api/champions/detail?champion=${encodeURIComponent(champIdAtStart)}`, { credentials: 'include' });
          const detail = await detailRes.json();
          if (!detailRes.ok) throw new Error(detail.error || '最新データの取得に失敗しました');

          setDataFields(detail.dataFields);
          setChampPatchMetas((p: any) => ({
            ...p,
            [champIdAtStart]: detail.dataFields.patch_meta || null
          }));
          setChampJgStyles((p: any) => ({
            ...p,
            [champIdAtStart]: detail.dataFields.jg_style || null
          }));
          if (detail.dictCreatedAt) {
            setChampDates(p => ({
              ...p,
              [champIdAtStart]: detail.dictCreatedAt
            }));
          }
        } else if (task.status === 'failed') {
          setFetchingTrend(false);
          setTrendPhase('failed');
          setTrendMessage(`更新に失敗しました: ${task.error_message || 'タスク実行エラー'}`);
        } else {
          // pending or running（フェーズ表示は上で更新済み）
          setTimeout(poll, 3000);
        }
      };

      setTimeout(poll, 3000);

    } catch (err: any) {
      setFetchingTrend(false);
      setTrendPhase('error');
      setTrendMessage(`通信エラー: ${err.message}`);
    }
  };

  const setField = (key: string, val: string | object) => {
    setDataFields((p: any) => {
      const next = { ...p, [key]: val };
      if (selected?.id) {
        try { localStorage.setItem(`champ_draft_${selected.id}`, JSON.stringify(next)); } catch {}
      }
      return next;
    });
  };

  const setJgStyleField = (subKey: string, val: any) => {
    setDataFields((p: any) => {
      const currentJgStyle = p.jg_style || { role: 'JUNGLE', type: '', blind_pickable: 3, counter_pickable: 3, description: '' };
      const next = {
        ...p,
        jg_style: {
          ...currentJgStyle,
          [subKey]: val
        }
      };
      if (selected?.id) {
        try { localStorage.setItem(`champ_draft_${selected.id}`, JSON.stringify(next)); } catch {}
      }
      return next;
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
      try { localStorage.removeItem(`champ_draft_${selected.id}`); } catch {}
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
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
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto flex flex-col gap-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-[#c89b3c] font-bold w-fit hover:text-stone-900 transition-colors">
            <ChevronLeft size={18} /> 辞典トップに戻る
          </button>
          <div className="flex items-center gap-2">
            {detailLoading && (
              <div className="px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-800 text-cyan-300 text-xs font-bold flex items-center gap-2 shadow">
                <RefreshCw size={14} className="animate-spin" /> 詳細データを読み込み中...
              </div>
            )}
            {detailError && (
              <div className="px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-2 shadow">
                <span>⚠️</span> {detailError}
              </div>
            )}
            {draftRestored && (
              <div className="px-3 py-1.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-2 animate-bounce shadow">
                <span>✏️</span> 前回編集中の未保存下書きを自動復元しました
              </div>
            )}
          </div>
        </div>

        <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 group bg-[#0a0b10]">
          <div className="absolute inset-0 bg-cover bg-[center_20%] opacity-60 group-hover:opacity-80 transition-opacity duration-1000" style={{ backgroundImage: `url(${getChampSplash(selected.id)})` }}></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#06070a] via-[#06070a]/60 to-transparent"></div>

          <div className="relative z-10 flex flex-col gap-5 w-full p-6 md:p-8">
            <div className="flex items-center gap-6 flex-wrap">
              <Image src={getChampIcon(selected.id)} alt={selected.name} width={96} height={96} className="w-24 h-24 rounded-full border-4 border-[#c89b3c] shadow-[0_0_30px_rgba(200,155,60,0.5)]" />
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
            </div>

            {/* シームレス導線: 辞典 ➔ AIコーチへ即座に繋ぐボタン */}
            <div className="flex gap-3 items-center flex-wrap pt-2">
              <Link
                href={`/coach?champion=${encodeURIComponent(selected.id)}`}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black rounded-xl transition-all shadow-lg flex items-center gap-2 text-xs"
              >
                <Zap size={16} /> 🎯 このチャンピオンでAIコーチを起動する (/coach)
              </Link>
            </div>

            {isAdmin && (
            <div className="flex gap-3 items-center flex-wrap">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/admin/dict-health/verify', {
                      method: 'POST', credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ champion: selected.id, action: 'verify' }),
                    });
                    if (res.ok) {
                      setSaveSuccess(true);
                      setTimeout(() => setSaveSuccess(false), 3000);
                      alert(`✅ ${selected.name || selected.id} を「人間確認済み」に設定しました！`);
                    } else {
                      const errJson = await res.json();
                      alert(`❌ 確認状態の更新失敗: ${errJson.error}`);
                    }
                  } catch (e: any) {
                    alert(`❌ 通信エラー: ${e.message}`);
                  }
                }}
                className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm shadow-md shadow-emerald-600/20"
                title="このチャンピオンの情報を人間が確認完了した状態にマークします"
              >
                <Check size={16} />
                ✅ 確認済みに設定
              </button>
              <Link
                href="/admin/dict-health"
                className="px-4 py-3 bg-stone-800 hover:bg-stone-900 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm shadow-md"
              >
                🩺 ヘルス診断へ戻る
              </Link>

              <button
                onClick={handleFetchTrend}
                disabled={fetchingTrend}
                className="px-4 py-3 bg-[#c89b3c] hover:bg-[#c89b3c]/80 text-black font-black rounded-xl transition-all flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(200,155,60,0.3)] hover:shadow-[0_0_25px_rgba(200,155,60,0.5)]"
              >
                <RefreshCw size={16} className={fetchingTrend ? "animate-spin" : ""} />
                {trendPhase === 'running' ? "AI生成中..." : trendPhase === 'pending' ? "順番待ち中..." : fetchingTrend ? "登録中..." : "最新トレンド取得"}
              </button>
            </div>
            )}

            {/* トレンド取得の進行状況（「取得中から変わらない」という不透明さの指摘を受けて追加） */}
            {trendPhase !== 'idle' && (
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border ${
                trendPhase === 'completed' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/60' :
                trendPhase === 'failed' || trendPhase === 'error' ? 'bg-red-950/30 text-red-400 border-red-800/60' :
                trendPhase === 'offline' || trendPhase === 'timeout' ? 'bg-amber-950/30 text-amber-400 border-amber-800/60' :
                'bg-cyan-950/30 text-cyan-300 border-cyan-800/60'
              }`}>
                {trendPhase === 'running' && <RefreshCw size={14} className="animate-spin shrink-0" />}
                {(trendPhase === 'pending' || trendPhase === 'queuing') && <Activity size={14} className="shrink-0 animate-pulse" />}
                {trendPhase === 'completed' && <Check size={14} className="shrink-0" />}
                {(trendPhase === 'failed' || trendPhase === 'error' || trendPhase === 'offline' || trendPhase === 'timeout') && <ShieldAlert size={14} className="shrink-0" />}
                <span>{trendMessage}</span>
                {(trendPhase === 'pending' || trendPhase === 'running' || trendPhase === 'queuing') && (
                  <span className="ml-auto font-mono opacity-70 shrink-0">
                    経過 {Math.floor(trendElapsedSec / 60)}:{String(trendElapsedSec % 60).padStart(2, '0')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>



        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TextAreaCard title="強み (Strengths)" icon={Swords} color="text-[var(--color-success)] border-[var(--color-success)] shadow-[var(--color-success)]" value={dataFields.strengths} onChange={v => setField('strengths', v)} fieldKey="strengths" onOpenHistory={handleOpenHistory} />
          <TextAreaCard title="弱み (Weaknesses)" icon={ShieldAlert} color="text-[var(--color-danger)] border-[var(--color-danger)] shadow-[var(--color-danger)]" value={dataFields.weaknesses} onChange={v => setField('weaknesses', v)} fieldKey="weaknesses" onOpenHistory={handleOpenHistory} />
          <div>
            {powerSpikeScores && (() => {
              const early = Math.max(0, Math.min(5, Number(powerSpikeScores.early_game_score) || 0));
              const mid = Math.max(0, Math.min(5, Number(powerSpikeScores.mid_game_score) || 0));
              const late = Math.max(0, Math.min(5, Number(powerSpikeScores.late_game_score) || 0));
              return (
                <div className="mb-2 flex items-center gap-3 rounded-lg border border-[#c89b3c] px-3 py-2 text-sm flex-wrap">
                  <span className="font-bold text-[#c89b3c]">時間帯別の強さ:</span>
                  <span>序盤 {'★'.repeat(early)}{'☆'.repeat(5 - early)}</span>
                  <span>中盤 {'★'.repeat(mid)}{'☆'.repeat(5 - mid)}</span>
                  <span>終盤 {'★'.repeat(late)}{'☆'.repeat(5 - late)}</span>
                  {powerSpikeScores.summary && <span className="text-xs opacity-80">{powerSpikeScores.summary}</span>}
                </div>
              );
            })()}
            <TextAreaCard title="パワースパイク" icon={Zap} color="text-[#c89b3c] border-[#c89b3c] shadow-[#c89b3c]" value={dataFields.powerSpikes} onChange={v => setField('powerSpikes', v)} fieldKey="powerSpikes" onOpenHistory={handleOpenHistory} />
          </div>
          <TextAreaCard title="コアビルド / ルーン" icon={Shield} color="text-purple-600 border-purple-500 shadow-purple-500" value={dataFields.buildRunes} onChange={v => setField('buildRunes', v)} fieldKey="buildRunes" onOpenHistory={handleOpenHistory} />
          <TextAreaCard title="対面の有利・不利" icon={Swords} color="text-[#00cfef] border-[#00cfef] shadow-[#00cfef]" value={dataFields.counterChampions} onChange={v => setField('counterChampions', v)} fieldKey="counterChampions" onOpenHistory={handleOpenHistory} />
          <TextAreaCard title="ピック推奨 (先/後)" icon={Shield} color="text-emerald-600 border-emerald-500 shadow-emerald-500" value={dataFields.pickRecommendation} onChange={v => setField('pickRecommendation', v)} fieldKey="pickRecommendation" onOpenHistory={handleOpenHistory} />
          
          {/* 🌲 ジャングルプレイスタイル分類 (自動判定) */}
          {/* 🎯 プレイスタイル分類 (手動編集・全ロール対応) */}
          <div className="glass-panel border-t-2 border-emerald-400 p-5 rounded-2xl group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] shadow-emerald-400/20 relative col-span-1 md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black flex items-center gap-2 text-emerald-600">
                <Shield size={16} /> 🎯 プレイスタイル分類 ({(dataFields.jg_style?.role || 'JUNGLE').toUpperCase()}基準)
              </h3>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleOpenHistory('jg_style', 'プレイスタイル分類');
                }}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-black/5 hover:bg-amber-100 hover:text-amber-800 text-stone-700 transition-all flex items-center gap-1 border border-black/10 shadow-xs cursor-pointer"
                title="この項目の変更履歴を確認"
              >
                <History size={13} /> 📜 履歴
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {/* 基準ロール */}
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">基準ロール</label>
                <select
                  value={dataFields.jg_style?.role || 'JUNGLE'}
                  onChange={e => setJgStyleField('role', e.target.value)}
                  className="w-full bg-white border border-border rounded-lg px-3 py-2 text-stone-900 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
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
                      className="w-full bg-white border border-border rounded-lg px-3 py-2 text-stone-900 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
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
                        className="w-full mt-2 bg-white border border-border rounded-lg px-3 py-2 text-stone-900 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    )}
                  </>
                ) : (
                  <input
                    type="text"
                    value={dataFields.jg_style?.type || ''}
                    onChange={e => setJgStyleField('type', e.target.value)}
                    placeholder="例: アサシン, コントロール"
                    className="w-full bg-white border border-border rounded-lg px-3 py-2 text-stone-900 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                )}
              </div>

              {/* 先出し安定度 */}
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">先出し安定度</label>
                <select
                  value={dataFields.jg_style?.blind_pickable || 3}
                  onChange={e => setJgStyleField('blind_pickable', parseInt(e.target.value) || 3)}
                  className="w-full bg-white border border-border rounded-lg px-3 py-2 text-stone-900 text-xs focus:outline-none focus:border-emerald-500 transition-colors font-mono"
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
                  className="w-full bg-white border border-border rounded-lg px-3 py-2 text-stone-900 text-xs focus:outline-none focus:border-emerald-500 transition-colors font-mono"
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
                className="w-full h-20 bg-white border border-border rounded-lg px-3 py-2 text-stone-900 text-xs resize-none focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* 📈 最新パッチトレンド (自動収集) */}
          <div className="glass-panel border-t-2 border-cyan-400 p-5 rounded-2xl group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] shadow-cyan-400/20 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black flex items-center gap-2 text-cyan-600">
                <Activity size={16} /> 📈 最新パッチトレンド (自動収集)
              </h3>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleOpenHistory('patch_meta', '最新パッチトレンド');
                }}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-black/5 hover:bg-amber-100 hover:text-amber-800 text-stone-700 transition-all flex items-center gap-1 border border-black/10 shadow-xs cursor-pointer"
                title="この項目の変更履歴を確認"
              >
                <History size={13} /> 📜 履歴
              </button>
            </div>
            {dataFields.patch_meta ? (
              <div className="flex flex-col gap-4 text-sm text-stone-800">
                <div className="flex gap-2 flex-wrap items-center w-full">
                  <span className="px-3 py-1 bg-cyan-100 border border-cyan-200 text-cyan-700 rounded-lg font-bold text-xs">
                    Patch {dataFields.patch_meta.patch || '不明'}
                  </span>
                  <span className="px-3 py-1 bg-amber-100 border border-amber-200 text-amber-700 rounded-lg font-bold text-xs">
                    Tier {dataFields.patch_meta.tier || '-'}
                  </span>
                  <span className="px-3 py-1 bg-black/5 border border-black/10 text-stone-900 rounded-lg font-bold text-xs">
                    勝率 {dataFields.patch_meta.win_rate ? `${dataFields.patch_meta.win_rate}%` : '-'}
                  </span>
                  <span className="px-3 py-1 bg-black/5 border border-black/10 text-stone-900 rounded-lg font-bold text-xs">
                    ピック {dataFields.patch_meta.pick_rate ? `${dataFields.patch_meta.pick_rate}%` : '-'}
                  </span>
                  {(dataFields.patch_meta?.updated_at || dataFields.updated_at || dataFields.created_at) && (
                    <span className="px-3 py-1 bg-black/5 border border-black/10 text-gray-400 rounded-lg font-bold text-xs ml-auto">
                      最終更新: {(() => {
                        const val = dataFields.patch_meta?.updated_at || dataFields.updated_at || dataFields.created_at;
                        const d = typeof val === 'number' ? new Date(val * 1000) : new Date(val);
                        return isNaN(d.getTime()) ? '本日' : d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                      })()}
                    </span>
                  )}
                </div>
                
                {dataFields.patch_meta?.trend_items && dataFields.patch_meta.trend_items.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 mb-2">🔥 コアアイテムビルド</h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      {dataFields.patch_meta.trend_items.map((item: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="px-3 py-1.5 bg-black/5 border border-black/10 rounded-lg text-xs font-bold text-stone-700">
                            {item}
                          </span>
                          {idx < dataFields.patch_meta.trend_items.length - 1 && <span className="text-gray-500 font-bold">→</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dataFields.patch_meta.trend_runes && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 mb-1">🧬 トレンドルーン</h4>
                    <p className="text-xs text-stone-700 font-bold">
                      {dataFields.patch_meta.trend_runes.keystone && <span className="text-cyan-700 mr-2">[{dataFields.patch_meta.trend_runes.keystone}]</span>}
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
            <h3 className="text-sm font-black mb-4 flex items-center gap-2 text-red-600">
              <ShieldAlert size={16} className="text-red-500 animate-pulse" /> 🚨 過去の敗因反省・教訓 (Sovereign Interrogation)
            </h3>
            {pastInterrogations && pastInterrogations.length > 0 ? (
              <div className="space-y-3">
                <div className="bg-red-100 border border-red-200 p-4 rounded-xl text-xs text-red-800 leading-relaxed flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
                  <div>
                    <span className="font-bold block mb-1">過去にこの対面であなたが敗北した際にAIと交わした反省です。</span>
                    同じ過ちを繰り返さないよう、立ち回りやジャングルルート選択時に十分注意しなさい。
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pastInterrogations.map((lesson: any, idx: number) => (
                    <div key={idx} className="bg-black/5 border border-red-200 p-4 rounded-xl text-xs text-red-800 leading-relaxed space-y-2">
                      <div className="flex justify-between items-center border-b border-black/10 pb-1">
                        <span className="text-red-600 font-bold font-mono">教訓 #{idx+1}</span>
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black flex items-center gap-2 text-amber-600">
                <Award size={16} /> 🏆 プロ最先端ビルド (直近のソロキュー実例)
              </h3>
              <button
                onClick={() => handleOpenHistory('pro_builds', 'プロ最先端ビルド')}
                className="text-[11px] font-bold px-2 py-0.5 rounded bg-black/5 hover:bg-amber-100 hover:text-amber-800 text-stone-600 transition-colors flex items-center gap-1 border border-black/10"
                title="この項目の変更履歴を確認"
              >
                <History size={12} /> 履歴
              </button>
            </div>
            {dataFields.pro_builds && dataFields.pro_builds.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dataFields.pro_builds.map((pb: any, idx: number) => (
                  <div key={idx} className="bg-black/3 border border-black/10 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-stone-900">{pb.player}</span>
                        {pb.team && <span className="text-xs text-gray-400">({pb.team})</span>}
                      </div>
                      {pb.win_lose && (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 border border-amber-200 text-amber-700 rounded-full font-black">
                          {pb.win_lose}
                        </span>
                      )}
                    </div>

                    {pb.build && pb.build.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {pb.build.map((item: string, i: number) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="text-xs px-2.5 py-1 bg-black/5 border border-black/10 rounded-md text-stone-700 font-medium">
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
                          <span key={i} className="px-1.5 py-0.5 bg-black/5 rounded border border-black/10 text-stone-700">
                            {rune}
                          </span>
                        ))}
                      </div>
                    )}

                    {pb.description && (
                      <p className="text-xs text-stone-700 leading-relaxed border-t border-black/10 pt-2 mt-1 italic">
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

          {/* 📖 全体的な立ち回り・統合トレンドメモ (折りたたみアコーディオン) */}
          <div className="glass-panel rounded-2xl border-l-4 border-[#c89b3c] bg-[#c89b3c]/5 overflow-hidden col-span-1 md:col-span-2">
            <button
              onClick={() => setIsStrategyCollapsed(!isStrategyCollapsed)}
              className="w-full p-5 flex items-center justify-between text-left hover:bg-black/5 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="text-[#c89b3c]" size={20} />
                <h3 className="text-base font-black text-stone-900">全体的な立ち回り・統合トレンドメモ</h3>
                {dataFields.strategy && <span className="text-[10px] bg-[#c89b3c]/20 text-[#c89b3c] px-2.5 py-0.5 rounded-full font-bold">記載あり</span>}
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpenHistory('strategy', '全体的な立ち回りメモ'); }}
                  className="text-[11px] font-bold px-2 py-0.5 rounded bg-black/5 hover:bg-amber-100 hover:text-amber-800 text-stone-600 transition-colors flex items-center gap-1 border border-black/10"
                  title="この項目の変更履歴を確認"
                >
                  <History size={12} /> 履歴
                </button>
              </div>
              <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
                {isStrategyCollapsed ? '▼ 開く' : '▲ 閉じる'}
              </span>
            </button>

            {!isStrategyCollapsed && (
              <div className="p-6 border-t border-black/10 prose max-w-none text-sm leading-relaxed text-stone-800">
                {editingStrategy ? (
                  <div className="space-y-3">
                    <textarea
                      value={dataFields.strategy}
                      onChange={(e) => setField('strategy', e.target.value)}
                      className="w-full min-h-[160px] p-4 bg-black/8 border border-[#c89b3c]/40 rounded-2xl text-sm font-mono text-stone-900 outline-none focus:border-[#c89b3c]"
                      placeholder="全体的な立ち回り・マクロ判断・反省から得られた教訓メモ..."
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingStrategy(false)} className="px-4 py-2 bg-black/5 text-stone-700 rounded-xl text-xs font-bold">完了</button>
                    </div>
                  </div>
                ) : (
                  <div className="group relative">
                    {dataFields.strategy ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{dataFields.strategy}</ReactMarkdown>
                    ) : (
                      <p className="text-gray-500 italic text-xs">全体的な立ち回り・統合トレンドメモはまだ記載されていません。{isAdmin && '「直感編集」ボタンを押して追加してください。'}</p>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => setEditingStrategy(true)}
                        className="mt-4 px-4 py-2 bg-[#c89b3c]/20 hover:bg-[#c89b3c]/40 text-[#c89b3c] border border-[#c89b3c]/30 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <Edit2 size={14} /> メモを直感編集
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 📄 AI生成ドラフト・追加メモ項目 (折りたたみアコーディオン) */}
          <div className="glass-panel rounded-2xl border-l-4 border-pink-400 bg-pink-400/5 overflow-hidden col-span-1 md:col-span-2">
            <button
              onClick={() => setIsDraftsCollapsed(!isDraftsCollapsed)}
              className="w-full p-5 flex items-center justify-between text-left hover:bg-black/5 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <FileText className="text-pink-600" size={20} />
                <h3 className="text-base font-black text-stone-900">AI生成ドラフト ＆ カスタム追加メモ一覧</h3>
                <span className="text-xs bg-pink-100 text-pink-700 px-2.5 py-0.5 rounded-full font-bold">
                  {Object.keys(dataFields.customFields || {}).length} 件
                </span>
              </div>
              <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
                {isDraftsCollapsed ? '▼ 開く' : '▲ 閉じる'}
              </span>
            </button>

            {!isDraftsCollapsed && (
              <div className="p-6 border-t border-black/10 space-y-4">
                {Object.entries(dataFields.customFields || {}).length === 0 ? (
                  <p className="text-gray-500 italic text-xs">追加のカスタムメモやAIドラフト項目はありません。</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(dataFields.customFields || {}).map(([key, val]) => (
                      <div key={key} className="glass-panel border-t-2 border-pink-400 p-5 rounded-2xl group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] shadow-pink-400/20 relative">
                        <button onClick={() => removeCustomField(key)} className="absolute top-4 right-4 text-gray-500 hover:text-red-600 transition-colors"><Trash size={14}/></button>
                        <div className="flex items-center justify-between mb-4 pr-6">
                          <h3 className="text-sm font-black flex items-center gap-2 text-pink-600"><FileText size={16} /> {key}</h3>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleOpenHistory('customFields', `カスタム項目: ${key}`);
                            }}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-black/5 hover:bg-amber-100 hover:text-amber-800 text-stone-700 transition-all flex items-center gap-1 border border-black/10 shadow-xs cursor-pointer"
                            title="この項目の変更履歴を確認"
                          >
                            <History size={13} /> 📜 履歴
                          </button>
                        </div>
                        <textarea value={val as string} onChange={e => updateCustomField(key, e.target.value)} className="w-full h-28 bg-black/3 border border-black/10 rounded-xl p-3 text-sm text-stone-800 outline-none focus:border-black/20 resize-y shadow-inner transition-colors" placeholder={`${key}を記録...`} />
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={addCustomField} className="glass-panel border-2 border-dashed border-[#c89b3c]/30 hover:border-[#c89b3c] hover:bg-[#c89b3c]/10 text-[#c89b3c] p-4 rounded-xl flex items-center justify-center gap-2 transition-all w-full text-xs font-bold mt-2">
                  <Plus size={18} /> 新しい項目を追加
                </button>
              </div>
            )}
          </div>

          {isAdmin && (
            <ChampionFactCheckPanel champion={selected.id} />
          )}
        </div>

        {/* ⚔️ 対面マッチアップ履歴 (折りたたみアコーディオン) */}
        <div className="glass-panel border-t-4 border-[#00cfef] rounded-2xl overflow-hidden group">
          <button
            onClick={() => setIsMatchupsCollapsed(!isMatchupsCollapsed)}
            className="w-full p-5 flex items-center justify-between text-left hover:bg-black/5 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Swords className="text-[#00cfef]" size={20} />
              <h3 className="text-base font-black text-stone-900">⚔️ 対面マッチアップ履歴 (ランク戦データ連携)</h3>
              <span className="text-xs bg-[#00cfef]/20 text-[#00cfef] px-2.5 py-0.5 rounded-full font-bold">
                {matchupsList.length} 件
              </span>
            </div>
            <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
              {isMatchupsCollapsed ? '▼ 開く' : '▲ 閉じる'}
            </span>
          </button>

          {!isMatchupsCollapsed && (
            <div className="p-6 border-t border-black/10 relative space-y-4">
              {/* 対面チャンプ・インクリメンタル検索窓 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                <input
                  type="text"
                  placeholder="対面チャンプ名で絞り込み (例: Lee Sin, Malphite)..."
                  value={matchupSearch}
                  onChange={(e) => setMatchupSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-xl bg-white text-xs text-stone-900 font-bold outline-none focus:border-[#00cfef]"
                />
              </div>

              {filteredMatchupsList.map((m) => {
                const isExpanded = expandedMatchupId === m.matchup_id;
                const rd = m.raw_data || {};
                const difficulty = rd.difficulty || 3;
                const result = rd.result || 'UNKNOWN';

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
                    <div 
                      onClick={() => setExpandedMatchupId(isExpanded ? null : m.matchup_id)}
                      className="p-4 flex items-center justify-between cursor-pointer select-none flex-wrap gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <Image src={getChampIcon(m.enemy)} alt={m.enemy} width={40} height={40} className="w-10 h-10 rounded-full border border-black/10" />
                        <div>
                          <p className="text-sm font-bold text-stone-900 flex items-center gap-2 flex-wrap">
                            vs {m.enemy}
                            {hasData && (
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                                isFavored ? 'bg-green-100 text-green-700 border border-green-200' :
                                isUnfavored ? 'bg-red-100 text-red-700 border border-red-200' :
                                'bg-amber-100 text-amber-700 border border-amber-200'
                              }`}>
                                {isFavored ? '🟢 有利' : isUnfavored ? '🔴 不利' : '🟡 互角'}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">{m.title || `${m.champion} vs ${m.enemy}`}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        {(() => {
                          const enemyMatchups = matchupsList.filter(x => x.enemy === m.enemy);
                          const eWins = enemyMatchups.filter(x => String(x.raw_data?.result).toLowerCase() === 'win').length;
                          const eLosses = enemyMatchups.filter(x => String(x.raw_data?.result).toLowerCase() === 'lose').length;
                          const eTotal = eWins + eLosses;

                          const ktmMatchup = champStats[m.champion]?.matchup_stats?.[m.enemy];
                          if (ktmMatchup && ktmMatchup.games > 0) {
                            const winRate = ktmMatchup.win_rate;
                            return (
                              <div className={`px-2 py-1 rounded-md border flex flex-col items-center justify-center min-w-[65px] ${winRate >= 60 ? 'bg-green-100 text-green-700 border-green-200' : winRate <= 40 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider scale-90 leading-none">KTM {ktmMatchup.games}戦</span>
                                <span className="font-mono text-xs font-black mt-0.5 leading-none">{winRate}%</span>
                              </div>
                            );
                          }
                          
                          const memoWinRate = eTotal > 0 ? Math.round((eWins / eTotal) * 100) : null;
                          if (memoWinRate !== null) {
                            return (
                              <div className={`px-2 py-1 rounded-md border flex flex-col items-center justify-center min-w-[65px] ${memoWinRate >= 60 ? 'bg-green-100 text-green-700 border-green-200' : memoWinRate <= 40 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-black/5 text-stone-700 border-black/10'}`}>
                                <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider scale-90 leading-none">メモ {eTotal}戦</span>
                                <span className="font-mono text-xs font-black mt-0.5 leading-none">{memoWinRate}%</span>
                              </div>
                            );
                          }

                          if (result && result !== 'UNKNOWN') {
                            return (
                              <span className={`text-[10px] font-black px-2 py-1 rounded-md ${result === 'Win' ? 'bg-[#22c55e]/15 text-[var(--color-success)]' : 'bg-[#ef4444]/15 text-[var(--color-danger)]'}`}>
                                {result}
                              </span>
                            );
                          }
                          return null;
                        })()}

                        <div className="flex gap-0.5" title={`難易度: ${difficulty}`}>
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <StarIcon 
                              key={idx} 
                              size={14} 
                              className={idx < difficulty ? "text-amber-600 fill-amber-600" : "text-stone-300"}
                            />
                          ))}
                        </div>
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleOpenHistory(undefined, `対面 ${m.enemy} の変更履歴`, m.matchup_id);
                          }}
                          className="px-3 py-1 bg-black/5 hover:bg-amber-100 hover:text-amber-800 border border-black/10 rounded-lg text-xs font-bold transition-all flex items-center gap-1 text-stone-700 cursor-pointer"
                          title="この対面の変更履歴を確認"
                        >
                          <History size={13} /> 📜 履歴
                        </button>

                        <a 
                          href={`/coach?champion=${m.champion}&enemy=${m.enemy}`}
                          onClick={(e) => e.stopPropagation()} 
                          className="px-3 py-1 bg-black/5 hover:bg-[#c89b3c]/20 hover:text-[#c89b3c] border border-black/10 rounded-lg text-xs font-bold transition-all flex items-center gap-1 text-stone-700"
                        >
                          <Edit2 size={12} /> 編集
                        </a>
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }} 
                          animate={{ height: 'auto', opacity: 1 }} 
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-black/10 bg-black/3"
                        >
                          <div className="p-5 flex flex-col gap-4 text-sm leading-relaxed">
                            {rd.winCondition && (
                              <div>
                                <h4 className="text-xs font-bold text-[#00cfef] uppercase tracking-wider mb-1">💡 勝ち筋・主要コンセプト</h4>
                                <p className="text-stone-800">{rd.winCondition}</p>
                              </div>
                            )}
                            {m.strategy && (
                              <div>
                                <h4 className="text-xs font-bold text-[#c89b3c] uppercase tracking-wider mb-1">🧠 具体的な立ち回り・対策メモ</h4>
                                <div className="prose prose-xs max-w-none text-stone-700">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.strategy}</ReactMarkdown>
                                </div>
                              </div>
                            )}
                            {!rd.winCondition && !m.strategy && (
                              <p className="text-gray-500 italic text-xs">このマッチアップに関する詳細な立ち回りメモは登録されていません。</p>
                            )}
                {champStats[m.champion] && (() => {
                              const history = champStats[m.champion].match_history?.filter((h: any) => h.enemy_champion === m.enemy) || [];
                              const trendHistory = [...history].reverse();
                              const playerAgg: Record<string, { games: number, wins: number, kills: number, deaths: number, assists: number, role: string }> = {};
                              history.forEach((h: any) => {
                                const name = h.player_name;
                                if (!playerAgg[name]) {
                                  playerAgg[name] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, role: h.role || 'UNKNOWN' };
                                }
                                const a = playerAgg[name];
                                a.games += 1;
                                if (h.is_win) a.wins += 1;
                                const parts = String(h.score || '').split('/').map(Number);
                                a.kills += parts[0] || 0;
                                a.deaths += parts[1] || 0;
                                a.assists += parts[2] || 0;
                              });

                              if (history.length === 0) return null;

                              return (
                                <div className="border-t border-black/10 bg-black/5 p-5 mt-4 space-y-5 rounded-b-xl text-xs">
                                  <div className="flex justify-between items-center border-b border-black/10 pb-2">
                                    <span className="font-bold text-[#00cfef] flex items-center gap-1.5 uppercase tracking-widest text-[10px]">
                                      <Swords size={12} className="text-[#00cfef]" /> KTM直接対決データ分析 ({m.champion} vs {m.enemy})
                                    </span>
                                    {champStats[m.champion].matchup_stats?.[m.enemy] && (
                                      <span className="font-mono font-bold text-amber-600">
                                        直接勝率: {champStats[m.champion].matchup_stats[m.enemy].win_rate}% ({champStats[m.champion].matchup_stats[m.enemy].games}戦)
                                      </span>
                                    )}
                                  </div>

                                  <div className="space-y-1">
                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">📈 勝敗トレンド</span>
                                    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                                      {trendHistory.map((h: any, idx: number) => (
                                        <div key={idx} className="flex items-center gap-2 shrink-0">
                                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border ${h.is_win ? 'bg-green-100 border-green-200 text-green-700' : 'bg-red-100 border-red-200 text-red-700'}`}>
                                            <span className="font-bold">{h.player_name}</span>
                                            <span className="font-mono text-[9px]">({new Date(h.created_at).toLocaleDateString('ja-JP', {month: '2-digit', day: '2-digit'})})</span>
                                          </div>
                                          {idx < trendHistory.length - 1 && <span className="text-gray-700 font-bold">➔</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">📊 プレイヤー別の実績</span>
                                    <div className="overflow-hidden rounded-lg border border-black/10 bg-black/5">
                                      <table className="w-full text-left border-collapse text-[10px]">
                                        <thead>
                                          <tr className="bg-black/5 text-gray-400 font-bold uppercase border-b border-black/10 text-[8px]">
                                            <th className="p-2">プレイヤー</th>
                                            <th className="p-2 text-center">ロール</th>
                                            <th className="p-2 text-center">試合数</th>
                                            <th className="p-2 text-center">勝率</th>
                                            <th className="p-2 text-center">平均KDA</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-black/10 font-medium">
                                          {Object.entries(playerAgg).map(([name, pa]: any) => {
                                            const winRate = Math.round((pa.wins / pa.games) * 100);
                                            const kda = pa.deaths > 0 ? Math.round(((pa.kills + pa.assists) / pa.deaths) * 10) / 10 : (pa.kills + pa.assists);
                                            return (
                                              <tr key={name} className="hover:bg-black/2 transition-colors">
                                                <td className="p-2 font-bold text-stone-900">{name}</td>
                                                <td className="p-2 text-center font-mono text-gray-500">{pa.role}</td>
                                                <td className="p-2 text-center text-stone-700 font-bold">{pa.games}</td>
                                                <td className={`p-2 text-center font-black ${winRate >= 60 ? 'text-green-600' : winRate <= 40 ? 'text-red-600' : 'text-stone-700'}`}>
                                                  {winRate}%
                                                </td>
                                                <td className="p-2 text-center font-mono">
                                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${kda >= 3.0 ? 'bg-green-100 text-green-700' : kda <= 1.5 ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-700'}`}>
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

                                  {/* 3. 対面の総合サマリ */}
                                  {(() => {
                                    const games = history.length;
                                    const wins = history.filter((h: any) => h.is_win).length;
                                    let k = 0, d = 0, a = 0;
                                    for (const h of history) {
                                      const p = String(h.score).split('/').map(Number);
                                      k += p[0] || 0; d += p[1] || 0; a += p[2] || 0;
                                    }
                                    const winRate = games ? Math.round((wins / games) * 100) : 0;
                                    const kda = d > 0 ? Math.round(((k + a) / d) * 10) / 10 : (k + a);
                                    // 直近5戦の勝敗（新しい順）。調子の変化が分かるようにする。
                                    const recent = [...history]
                                      .sort((x: any, y: any) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())
                                      .slice(0, 5);
                                    const last = history.length
                                      ? new Date(Math.max(...history.map((h: any) => new Date(h.created_at).getTime())))
                                      : null;

                                    const cell = (label: string, value: string, tone = 'text-stone-900') => (
                                      <div className="bg-black/5 border border-black/10 rounded-lg px-3 py-2">
                                        <p className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
                                        <p className={`text-sm font-black ${tone}`}>{value}</p>
                                      </div>
                                    );

                                    return (
                                      <div className="space-y-2">
                                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">
                                          ⚔️ この対面の通算成績
                                        </span>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                          {cell('試合数', `${games}戦`)}
                                          {cell('勝率', `${winRate}%`, winRate >= 50 ? 'text-emerald-600' : 'text-rose-600')}
                                          {cell('戦績', `${wins}勝 ${games - wins}敗`)}
                                          {cell('平均KDA', `${kda}`, kda >= 3 ? 'text-emerald-600' : 'text-stone-800')}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap text-[9px] text-gray-500 pt-1">
                                          <span className="font-bold uppercase tracking-wider">直近</span>
                                          {recent.map((h: any, i: number) => (
                                            <span key={i}
                                              title={`${new Date(h.created_at).toLocaleDateString('ja-JP')} ${h.player_name} ${h.score}`}
                                              className={`w-5 h-5 rounded flex items-center justify-center font-black text-[9px] ${
                                                h.is_win ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                              }`}>
                                              {h.is_win ? 'W' : 'L'}
                                            </span>
                                          ))}
                                          {last && (
                                            <span className="ml-auto">最終: {last.toLocaleDateString('ja-JP')}</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
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
            <h3 className="text-lg font-black font-mono flex items-center gap-2 text-stone-900"><FileText className="text-pink-500" size={20} /> noteドラフト記事</h3>
            <div className="flex gap-2">
              <div className="flex bg-[var(--color-surface)] p-1 rounded-xl border border-black/10">
                <button onClick={() => setNoteDraftMode('preview')} className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${noteDraftMode === 'preview' ? 'bg-pink-500 text-white shadow-lg' : 'text-gray-400 hover:text-stone-900'}`}><Eye size={14} /> プレビュー</button>
                {isAdmin && (
                  <button onClick={() => setNoteDraftMode('edit')} className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${noteDraftMode === 'edit' ? 'bg-pink-500 text-white shadow-lg' : 'text-gray-400 hover:text-stone-900'}`}><Edit2 size={14} /> 編集</button>
                )}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(dataFields.note_draft); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-black/10 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors text-stone-900">
                {copied ? <span className="text-[var(--color-success)] flex items-center gap-2"><Check size={16} /> コピー完了</span> : <><Copy size={16} /> Markdownをコピー</>}
              </button>
            </div>
          </div>
          <div className="relative z-10">
            {noteDraftMode === 'edit' ? (
              <textarea value={dataFields.note_draft} onChange={e => setField('note_draft', e.target.value)} className="w-full h-[400px] p-6 bg-black/5 border border-pink-500/30 rounded-xl text-sm leading-relaxed font-mono outline-none focus:border-pink-500/60 shadow-inner text-stone-800" placeholder="# 究極の攻略バイブル..." />
            ) : (
              <div className="prose prose-pink max-w-none min-h-[400px] p-6 bg-black/3 border border-black/10 rounded-xl text-sm leading-loose">
                {dataFields.note_draft ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{dataFields.note_draft}</ReactMarkdown> : <p className="text-gray-500 italic">まだドラフト記事がありません。</p>}
              </div>
            )}
          </div>
        </div>

        {/* レーンガイドへのリンク */}
        <div className="glass-panel p-4 rounded-2xl flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-amber-600 flex items-center gap-2">
              <BookOpen size={16} /> レーン別ガイド
            </h4>
            <p className="text-xs text-gray-500 mt-1">このチャンピオンのレーン別攻略を確認</p>
          </div>
          <Link href="/lane-guides" className="px-4 py-2 bg-amber-100 border border-amber-200 text-amber-700 hover:bg-amber-200 rounded-xl text-sm font-bold transition-all">
            ガイドを見る →
          </Link>
        </div>

        {/* 保存ボタン（辞典編集は管理者専用。一般訪問者には表示しない） */}
        {isAdmin && (
        <div className="flex justify-end items-center gap-3 relative z-10 pt-4 flex-wrap">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/30 text-emerald-400 border border-emerald-800/60 text-xs font-bold animate-in fade-in">
              <Check size={14} /> 保存しました
            </span>
          )}
          <button onClick={saveMemo} disabled={saving} className="px-8 py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black rounded-xl hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] hover:-translate-y-0.5 transition-all flex items-center gap-2 text-sm">
            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} チャンピオン辞典の変更を保存する
          </button>
        </div>
        )}

        {historyModal?.isOpen && selected && (
          <ChampionRevisionHistory
            champion={selected.id || selected.name}
            field={historyModal.field}
            targetKey={historyModal.targetKey}
            title={historyModal.title}
            isModal={true}
            onClose={() => setHistoryModal(null)}
            onRevertSuccess={() => {
              setHistoryModal(null);
            }}
          />
        )}
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto flex flex-col gap-6">

      {/* 🔰 チャンピオン辞典の使い方ガイド（初心者安心折りたたみガイド） */}
      <div className="bg-amber-500/10 border border-amber-300/60 rounded-2xl p-4 text-stone-900 shadow-sm">
        <button
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="w-full flex items-center justify-between font-bold text-xs text-amber-900 hover:text-amber-950 transition"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🔰</span>
            <span className="font-extrabold text-sm">チャンピオン辞典の使い方 ＆ 検索のコツ</span>
          </div>
          <span className="text-[11px] bg-amber-200/80 px-2 py-0.5 rounded-full font-bold">
            {isGuideOpen ? '▲ ガイドを閉じる' : '▼ ガイドを開く'}
          </span>
        </button>

        {isGuideOpen && (
          <div className="mt-3 pt-3 border-t border-amber-300/40 text-xs text-stone-800 space-y-2 leading-relaxed animate-fade-in">
            <p><strong>1. 検索・絞り込み:</strong> 上の入力欄に「アリ」などのひらがな・日本語名、または「Ahri」などの英語名を入力すると0秒で絞り込まれます。</p>
            <p><strong>2. レーン・ピック属性:</strong> TOP/JG/MID/ADC/SUP ボタンでレーン別、または「先出し向け/後出し向け」で絞り込めます。</p>
            <p><strong>3. 詳細データ確認:</strong> チャンピオンカードをタップすると、強み・弱み・パワースパイク時間帯・対策ビルドが閲覧できます。</p>
          </div>
        )}
      </div>

      {/* 検索バー・フィルター（スクロール追従） */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="sticky top-0 z-20 flex flex-col gap-3 glass-panel p-4 rounded-2xl shadow-2xl backdrop-blur-2xl bg-white/90">
        
        {/* スマホ表示の時だけ見える「フィルター開閉ボタン」 */}
        <button 
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="md:hidden w-full flex items-center justify-between px-4 py-3 bg-white border border-border rounded-xl text-[#c89b3c] font-bold text-xs hover:bg-black/5 transition-all"
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
              <input type="text" placeholder="例: Ahri / アリ (英名・日本語検索対応)..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-[var(--color-surface)] border border-transparent focus:border-[#c89b3c]/50 rounded-xl py-3 pl-12 pr-4 text-stone-900 font-bold outline-none transition-colors text-xs md:text-sm" />
            </div>
            {/* ロール別フィルターボタン ＆ ⭐️ お気に入りフィルター */}
            <div className="flex glass-panel p-1 rounded-xl items-center gap-0.5 flex-wrap">
              <button
                onClick={() => setRoleFilter(roleFilter === 'FAVORITES' ? 'ALL' : 'FAVORITES' as any)}
                className={`px-3 py-2 rounded-lg text-xs font-black tracking-wider transition-all flex items-center gap-1 ${
                  (roleFilter as any) === 'FAVORITES'
                    ? 'bg-amber-400 text-stone-900 shadow-lg shadow-amber-400/40'
                    : 'text-amber-600 hover:text-amber-700 hover:bg-amber-400/10'
                }`}
                title="お気に入りに登録した得意チャンピオンのみを抽出表示します"
              >
                ⭐️ お気に入り
              </button>
              {ROLE_LABELS.map(role => (
                <button key={role} onClick={() => setRoleFilter(role)}
                  className={`px-3 py-2 rounded-lg text-xs font-black tracking-wider transition-all ${
                    roleFilter === role
                      ? 'bg-[#c89b3c] text-black shadow-lg shadow-[#c89b3c]/30'
                      : 'text-gray-400 hover:text-stone-900 hover:bg-black/5'
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
                      : 'text-gray-400 hover:text-stone-900 hover:bg-black/5'
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
                      : 'text-gray-400 hover:text-stone-900 hover:bg-black/5'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${showFavoritesOnly ? 'bg-yellow-100 text-yellow-700 border-yellow-200 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'glass-panel text-gray-400 border-transparent hover:text-stone-900'}`}
            >
              <StarIcon size={16} fill={showFavoritesOnly ? 'currentColor' : 'none'} className={showFavoritesOnly ? 'text-yellow-600' : ''} /> お気に入り
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
              className="ml-2 text-gray-500 hover:text-stone-900 transition-colors underline underline-offset-2">
              フィルターをリセット
            </button>
          )}
        </div>
      </motion.div>

      {loading ? (
        <Spinner label="チャンピオン辞典を読み込み中..." />
      ) : champions.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl flex flex-col items-center justify-center text-center space-y-4 my-8">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-400/30 flex items-center justify-center text-3xl animate-pulse text-rose-500">
            ⚠️
          </div>
          <div>
            <h3 className="text-base font-extrabold text-stone-900">チャンピオンデータの読み込みに失敗しました</h3>
            <p className="text-xs text-stone-500 mt-1">ネットワーク接続、またはDDragonサーバーへの通信状態を確認して再試行してください。</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} /> 画面を再読み込みする
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl flex flex-col items-center justify-center text-center space-y-4 my-8">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-3xl animate-bounce">
            🔍
          </div>
          <div>
            <h3 className="text-base font-extrabold text-stone-900">該当するチャンピオンが見つかりませんでした</h3>
            <p className="text-xs text-stone-500 mt-1">検索ワードや指定フィルター条件（ロール・お気に入り等）を見直してください。</p>
          </div>
          <button
            onClick={() => { setSearch(''); setRoleFilter('ALL'); setTypeFilter('ALL'); setShowFavoritesOnly(false); }}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} /> 絞り込み条件をリセット
          </button>
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4">
          {filtered.map(c => {
            const normId = c.id.toLowerCase().replace(/[^a-z0-9]/g, '');
            const hasNote = !!(champDates[c.id] || champDates[normId]);
            const isPending = champPending[c.id] !== undefined ? champPending[c.id] : champPending[normId];
            const isFav = favoriteChamps.includes(c.id);
            return (
              <motion.div variants={itemVariants} key={c.id} onClick={() => setSelected(c)} 
                className={`glass-panel glass-panel-hover flex flex-col items-center gap-2 p-4 rounded-2xl cursor-pointer group relative ${hasNote ? 'bg-[#c89b3c]/10 border-[#c89b3c]/30 shadow-[0_0_15px_rgba(200,155,60,0.15)]' : ''}`}>
                {isFav && (
                  <div className="absolute top-2 right-2 text-amber-600 z-10" title="お気に入り">
                    <StarIcon size={12} fill="currentColor" />
                  </div>
                )}
                <div className="relative">
                  <Image src={getChampIcon(c.id)} alt={c.name} width={56} height={56} className={`w-14 h-14 rounded-full border-2 transition-colors ${hasNote ? 'border-[#c89b3c]' : 'border-black/10 group-hover:border-black/20'}`} />
                  {hasNote && <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${isPending ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]' : 'bg-[#c89b3c]'}`}></div>}
                </div>
                <span className={`text-xs font-bold text-center leading-tight transition-colors ${hasNote ? 'text-[#c89b3c]' : 'text-gray-400 group-hover:text-stone-900'}`}>{c.name}</span>
                {(() => {
                  const patchMeta = champPatchMetas[c.id] || champPatchMetas[normId];
                  const patchName = patchMeta?.patch ? `P${patchMeta.patch}` : 'P??';
                  
                  // 更新から3日以上経っている場合は少し古いトレンドと判定 (259200秒)
                  const isOld = patchMeta?.updated_at ? (Date.now() / 1000 - patchMeta.updated_at > 259200) : true;
                  
                  return (
                    <div className="flex flex-col items-center gap-0.5 mt-1 pointer-events-none">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black leading-none border transition-colors ${
                        !patchMeta
                          ? 'bg-red-100 border-red-200 text-red-700/60'
                          : isOld
                            ? 'bg-amber-100 border-amber-200 text-amber-700/60'
                            : 'bg-cyan-100 border-cyan-200 text-cyan-700'
                      }`}>
                        {patchName}
                      </span>
                      <span className="text-[8px] font-bold leading-none text-gray-500">
                        {patchMeta?.updated_at ? getRelativeTimeString(patchMeta.updated_at) : '未解析'}
                      </span>
                    </div>
                  );
                })()}
                {(() => {
                  const jgStyle = champJgStyles[c.id] || champJgStyles[normId];
                  if (!jgStyle || (jgStyle.blind_pickable === undefined && jgStyle.counter_pickable === undefined && !jgStyle.type)) return null;
                  
                  return (
                    <div className="flex flex-col items-center gap-0.5 mt-1 border-t border-black/10 pt-1.5 w-full text-[9px] font-bold pointer-events-none">
                      {jgStyle.blind_pickable !== undefined && (
                        <div className="flex justify-between w-full px-1 text-emerald-600">
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
                        <div className="mt-1 px-1 py-0.5 rounded text-[8px] font-black leading-none bg-amber-100 border border-amber-200 text-amber-700 text-center w-full truncate" title={jgStyle.type}>
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
                  const normKey = String(c.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                  const spike = champPowerSpikes[c.id] || champPowerSpikes[normKey];
                  if (!spike || typeof spike.early_game_score !== 'number' || typeof spike.mid_game_score !== 'number' || typeof spike.late_game_score !== 'number') return null;
                  
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
                          i === peakIdx ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'text-gray-500'
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

      {historyModal?.isOpen && (
        <ChampionRevisionHistory
          champion={selected.id || selected.name}
          field={historyModal.field}
          targetKey={historyModal.targetKey}
          title={historyModal.title}
          isModal={true}
          onClose={() => setHistoryModal(null)}
          onRevertSuccess={() => {
            setHistoryModal(null);
          }}
        />
      )}
    </div>
  );
}

const TextAreaCard = ({
  title,
  icon: Icon,
  color,
  value,
  onChange,
  fieldKey,
  onOpenHistory,
}: {
  title: string;
  icon: any;
  color: string;
  value: string;
  onChange: (v: string) => void;
  fieldKey?: string;
  onOpenHistory?: (fieldKey: string, title: string) => void;
}) => {
  const [textColor, borderColor] = color.split(' ');
  return (
    <div className={`glass-panel border-t-2 p-5 rounded-2xl group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] ${borderColor}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-black flex items-center gap-2 ${textColor}`}>
          <Icon size={16} /> {title}
        </h3>
        {fieldKey && onOpenHistory && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onOpenHistory(fieldKey, title);
            }}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-black/5 hover:bg-amber-100 hover:text-amber-800 text-stone-700 transition-all flex items-center gap-1 border border-black/10 shadow-xs cursor-pointer"
            title="この項目の変更履歴を確認"
          >
            <History size={13} /> 📜 履歴
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-28 bg-black/3 border border-black/10 rounded-xl p-3 text-sm text-stone-800 outline-none focus:border-black/20 resize-y shadow-inner transition-colors"
        placeholder={`${title}を記録...`}
      />
    </div>
  );
};

export default function DictionaryTab({ isAdmin = false }: { isAdmin?: boolean }) {
  return <ChampionsContent isAdmin={isAdmin} />;
}
