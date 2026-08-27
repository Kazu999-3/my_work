"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getChampIcon, getChampSplash } from '../../../lib/ddragonClient';
import { ChevronLeft, Search, Save, BookOpen, RefreshCw, Zap, ShieldAlert, Swords, Shield, Copy, Check, FileText, Eye, Edit2, Activity, Plus, Trash, Filter, Star as StarIcon, Award, Sparkles, History, Clock, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { getFavorites, toggleFavoriteChampion } from '../../../components/FavoritesPanel';
import { Spinner } from '../../../components/Feedback';
import ChampionFactCheckPanel from '../ChampionFactCheckPanel';
import ChampionRevisionHistory from '../ChampionRevisionHistory';
import { diffLines, diffSummary, diffSideBySide } from '../../../lib/diffUtils';

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
  // op.gg由来のレーン絞り込み実データ(2026-08-12、migration 62)。1体が複数レーンを持つ場合がある
  const [champLaneRoles, setChampLaneRoles] = useState<Record<string, string[]>>({});
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

  // ジャングルタイミング（秒）をmm:ss表示に変換する。AI自動取得のみで手動入力欄は持たない。
  const formatTimingSec = (sec?: number | null) => {
    if (sec === null || sec === undefined || isNaN(sec)) return '未取得';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [dataFields, setDataFields] = useState<any>({
    strengths: '', weaknesses: '', powerSpikes: '', buildRunes: '',
    fullClearTime: '', counterChampions: '', mustBanChampions: '', pickRecommendation: '',
    strategy: '', note_draft: '', customFields: {},
    patch_meta: null, pro_builds: [], research_sources: [], jg_style: null
  });
  const [powerSpikeScores, setPowerSpikeScores] = useState<{
    early_game_score: number; mid_game_score: number; late_game_score: number;
    peak_window: string; summary: string;
  } | null>(null);
  // ジャングル序盤タイミングの実測値。コアアイテム完成はRiot Timeline APIの自前集計
  // (エメラルド帯、2026-08-13)、フルクリア時間はjunglepedia.lolの実データ(全ティア、
  // 最速値を使用。2026-08-15〜。Riot集計側は指標選定ミスで表示撤去したため)と出典が異なる。
  const [realJungleTiming, setRealJungleTiming] = useState<{
    sampleCount: number; avgFirstCoreSec: number | null; avgSecondCoreSec: number | null; tier: string;
    externalFastestClearSec?: number | null; externalSampleSize?: number | null; externalSource?: string | null;
  } | null>(null);
  const [editingStrategy, setEditingStrategy] = useState(false);
  const [saving, setSaving] = useState(false);
  // 成功時はsaving状態がfalseに戻るだけで明示表示が無く、保存されたか確信が持てなかった
  // (2026-08-05発覚)。保存成功を数秒間だけ明示するトースト用フラグ。
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [noteDraftMode, setNoteDraftMode] = useState<'preview' | 'edit'>('preview');
  const [favoriteChamps, setFavoriteChamps] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('GLOBAL');
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
  // Builder-Critic方式の品質チェック(オンデマンド専用、2026-08-12)
  const [checkingQuality, setCheckingQuality] = useState(false);
  const [qualityResult, setQualityResult] = useState<{
    pass: boolean; score: number; issues: string[]; verdictSummary: string; barChampion: string;
  } | null>(null);

  const handleQualityCheck = async () => {
    if (!selected) return;
    setCheckingQuality(true);
    setQualityResult(null);
    try {
      const res = await fetch('/api/admin/champions/quality-check', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champion: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '品質チェックに失敗しました。');
      setQualityResult(data.result);
    } catch (err: any) {
      alert(err.message || '品質チェックに失敗しました。');
    } finally {
      setCheckingQuality(false);
    }
  };
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

  // ✨ 蓄積知見のAI清書・重複排除 (AI Refine Facts)
  const [refiningFacts, setRefiningFacts] = useState(false);
  const [savingRefinedFacts, setSavingRefinedFacts] = useState(false);
  const [factsRefinePreview, setFactsRefinePreview] = useState<{
    champion: string;
    role: string;
    diffs: Array<{ fieldKey: string; fieldLabel: string; before: string; after: string }>;
    refinedFields: any;
  } | null>(null);

  const handleStartRefineFacts = async (championName: string, roleName?: string) => {
    setRefiningFacts(true);
    try {
      const targetRole = roleName && roleName !== 'GLOBAL' ? roleName : selectedRole;
      const res = await fetch('/api/admin/champions/refine-facts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champion: championName, role: targetRole, dryRun: true }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || '知見清書の生成に失敗しました');
      setFactsRefinePreview({
        champion: d.champion,
        role: d.role,
        diffs: d.diffs || [],
        refinedFields: d.refinedFields,
      });
    } catch (e: any) {
      alert(`❌ 清書エラー: ${e.message}`);
    } finally {
      setRefiningFacts(false);
    }
  };

  const handleConfirmRefineFacts = async () => {
    if (!factsRefinePreview) return;
    setSavingRefinedFacts(true);
    try {
      const res = await fetch('/api/admin/champions/refine-facts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          champion: factsRefinePreview.champion,
          role: factsRefinePreview.role,
          dryRun: false,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || '保存に失敗しました');
      
      // dataFieldsを更新
      if (d.refinedFields) {
        setDataFields((prev: any) => {
          const next = { ...(prev || {}) };
          for (const [k, v] of Object.entries(d.refinedFields)) {
            if (k !== 'champion' && k !== 'role' && k !== 'updated_at') {
              next[k] = v;
            }
          }
          return next;
        });
      }
      alert('✨ 蓄積知見を清書版へ更新しました！');
      setFactsRefinePreview(null);
    } catch (e: any) {
      alert(`❌ 保存エラー: ${e.message}`);
    } finally {
      setSavingRefinedFacts(false);
    }
  };


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
          setChampLaneRoles(overview?.laneRoles || {});
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

    const loadChampionData = async (champId: string, role?: string) => {
      try {
        const roleQuery = role ? `&role=${encodeURIComponent(role)}` : '';
        const res = await fetch(`/api/champions/detail?champion=${encodeURIComponent(champId)}${roleQuery}`, { credentials: 'include' });
        const detail = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(detail.error || '取得に失敗しました');

        const loadedMatchups = detail.matchupsList || [];
        setMatchupsList(loadedMatchups);
        if (detail.availableRoles && Array.isArray(detail.availableRoles)) {
          setAvailableRoles(detail.availableRoles);
        }
        if (detail.currentRole) {
          setSelectedRole(detail.currentRole);
        }
        if (loadedMatchups.length > 0) {
          setIsMatchupsCollapsed(false); // 対面メモが存在する場合は自動展開して見やすくする
        } else {
          setIsMatchupsCollapsed(true);
        }
        setPowerSpikeScores(detail.powerSpikeScores || null);
        setRealJungleTiming(detail.realJungleTiming || null);

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
        setRealJungleTiming(null);
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
      // roleFilterは一覧の表示絞り込み用のUI状態であり、AIリサーチのroleとは無関係。
      // このOSは全チャンピオンをジャングル基準で統一リサーチする設計(champ_db_bulk_updater.py
      // の一括更新と同じ)で、champion_trend_worker.py側はrole="Jungle"の時だけ
      // 先出し・後出し評価根拠やジャングル序盤タイミングを生成する。以前はここが
      // roleFilterをそのまま渡していたため、一覧をJungle以外で絞り込んだ状態で個別更新
      // すると、これらのジャングル関連フィールドだけ生成されないまま「更新済み」に
      // なっていた(2026-08-09発覚)。
      const role = 'Jungle';
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
        research_sources: dataFields.research_sources,
        jg_style: dataFields.jg_style
      }
    };
    try {
      const res = await fetch('/api/admin/champions/save', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, role: selectedRole })
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

        // 2. op.gg由来の実データ（複数レーン許容）があればそれを使う(2026-08-12)。
        //    DDragonタグの粗い推測だけでは「全く当てにならない」との指摘への対応。
        const opggRoles = champLaneRoles[c.id];
        if (opggRoles && opggRoles.length > 0) {
          return opggRoles.includes(roleFilter);
        }

        // 3. op.ggにも載っていない場合のみ DDragon の tags ベースでフォールバック判定
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
  }, [champions, search, sortOrder, champDates, showPendingOnly, champPending, roleFilter, showFavoritesOnly, favoriteChamps, typeFilter, pickFilter, champJgStyles, champLaneRoles]);

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.02 } } };
  const itemVariants = { hidden: { scale: 0.9, opacity: 0 }, visible: { scale: 1, opacity: 1 } };

  // 初回ロード時にチャンピオン一覧が存在し、PC画面(lg以上)で未選択の場合、先頭を自動選択する
  useEffect(() => {
    if (!selected && filtered.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSelected(filtered[0]);
    }
  }, [filtered.length]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* 2ペインレイアウトコンテナ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── 左ペイン: マスターリスト (lg:col-span-4 xl:col-span-3) ── */}
        <div className={`flex flex-col gap-3.5 lg:sticky lg:top-4 ${selected ? 'hidden lg:flex' : 'flex'} w-full`}>
          {/* 検索バー ＆ フィルター */}
          <div className="bg-white border border-stone-200 p-3.5 rounded-2xl shadow-xs space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input
                type="text"
                placeholder="Ahri / アリ (英・日対応)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 focus:border-[#c89b3c] focus:bg-white rounded-xl py-2 pl-9 pr-3 text-stone-900 font-bold outline-none transition-all text-xs"
              />
            </div>

            {/* ロール別ピルフィルター */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setRoleFilter(roleFilter === 'FAVORITES' ? 'ALL' : 'FAVORITES' as any)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition shrink-0 flex items-center gap-1 ${
                  (roleFilter as any) === 'FAVORITES'
                    ? 'bg-amber-400 text-stone-950 shadow-xs'
                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                }`}
                title="お気に入りのみ表示"
              >
                ⭐️
              </button>
              {ROLE_LABELS.map(role => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition shrink-0 ${
                    roleFilter === role
                      ? 'bg-[#c89b3c] text-stone-950 shadow-xs font-black'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>

            {/* ピック属性 ＆ タイプフィルター */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-stone-100 text-[10px]">
              <div className="flex items-center gap-1">
                {(['ALL', 'BLIND', 'COUNTER'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPickFilter(p)}
                    className={`px-2 py-1 rounded-md font-bold transition ${
                      pickFilter === p
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    {p === 'ALL' ? '全属性' : p === 'BLIND' ? '先出し' : '後出し'}
                  </button>
                ))}
              </div>
              <span className="text-stone-400 font-mono font-bold">
                {filtered.length} 体
              </span>
            </div>
          </div>

          {/* チャンピオン縦スクロールリスト */}
          <div className="overflow-y-auto max-h-[calc(100vh-250px)] lg:max-h-[calc(100vh-210px)] space-y-1.5 pr-1">
            {filtered.map(c => {
              const isSelected = selected?.id === c.id;
              const isFav = favoriteChamps.includes(c.id);
              const jgStyle = champJgStyles[c.id] || {};
              const powerSpike = champPowerSpikes[c.id];

              return (
                <div
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-amber-500/10 border-[#c89b3c] shadow-xs ring-1 ring-[#c89b3c]'
                      : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Image
                      src={getChampIcon(c.id)}
                      alt={c.name}
                      width={38}
                      height={38}
                      className="w-9 h-9 rounded-lg border border-black/10 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-stone-900 truncate">{c.name}</span>
                        {isFav && <span className="text-amber-500 text-xs">★</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                        <span className="truncate">{c.id}</span>
                        {champDates[c.id] && (
                          <span className="text-[9px] text-stone-400">
                            • {getRelativeTimeString(new Date(champDates[c.id]).getTime() / 1000)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {jgStyle.type && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-stone-100 text-stone-700">
                        {jgStyle.type.replace('型', '')}
                      </span>
                    )}
                    {powerSpike && (
                      <div className="flex items-center gap-0.5 text-[8px] font-mono">
                        <span className={`px-1 rounded ${powerSpike.early_game_score >= 4 ? 'bg-emerald-100 text-emerald-800 font-bold' : 'text-stone-400'}`}>E</span>
                        <span className={`px-1 rounded ${powerSpike.mid_game_score >= 4 ? 'bg-amber-100 text-amber-800 font-bold' : 'text-stone-400'}`}>M</span>
                        <span className={`px-1 rounded ${powerSpike.late_game_score >= 4 ? 'bg-rose-100 text-rose-800 font-bold' : 'text-stone-400'}`}>L</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 右ペイン: 詳細＆アクションキャンバス (lg:col-span-8 xl:col-span-9) ── */}
        <div className={`flex-1 min-w-0 ${!selected ? 'hidden lg:flex' : 'flex'} flex-col gap-5`}>
          {!selected ? (
            <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[500px] text-stone-400 space-y-3">
              <BookOpen size={48} className="text-stone-300 animate-pulse" />
              <h3 className="font-bold text-stone-700 text-lg">チャンピオンが選択されていません</h3>
              <p className="text-xs text-stone-400 max-w-sm">
                左の一覧からチャンピオンをクリックすると、戦略・ビルド・パワースパイク・対面メモが即座に表示されます。
              </p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
              {/* モバイル用 戻るボタン ＆ ステータスバー */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  onClick={() => setSelected(null)}
                  className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-200/80 text-stone-800 text-xs font-bold hover:bg-stone-300 transition"
                >
                  <ChevronLeft size={16} /> チャンピオン一覧へ戻る
                </button>
                <div className="flex items-center gap-2 ml-auto">
                  {detailLoading && (
                    <div className="px-2.5 py-1 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold flex items-center gap-1.5">
                      <RefreshCw size={12} className="animate-spin" /> 読込中...
                    </div>
                  )}
                  {detailError && (
                    <div className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-1.5">
                      <span>⚠️</span> {detailError}
                    </div>
                  )}
                  {saveSuccess && (
                    <div className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                      <Check size={12} /> 保存完了
                    </div>
                  )}
                  {draftRestored && (
                    <div className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5 animate-bounce">
                      <span>✏️</span> 下書き復元
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

            {/* 複数レーン対応: レーン別辞典切替タブ */}
            {availableRoles.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1">
                  🛡️ レーン別辞典:
                </span>
                <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-inner">
                  {availableRoles.map((r) => {
                    const isSelected = selectedRole.toUpperCase() === r.toUpperCase();
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={async () => {
                          setSelectedRole(r);
                          setDetailLoading(true);
                          try {
                            const res = await fetch(`/api/champions/detail?champion=${encodeURIComponent(selected.id)}&role=${encodeURIComponent(r)}`, { credentials: 'include' });
                            const detail = await res.json();
                            if (res.ok && detail.dataFields) {
                              setDataFields(detail.dataFields);
                              if (detail.currentRole) setSelectedRole(detail.currentRole);
                            }
                          } catch (e) {
                            console.error('レーン別データ切替エラー:', e);
                          } finally {
                            setDetailLoading(false);
                          }
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105'
                            : 'text-stone-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <span>{r === 'TOP' ? '⚔️ TOP' : r === 'JG' ? '🌲 JG' : r === 'MID' ? '⚡ MID' : r === 'BOT' ? '🏹 BOT' : r === 'SUP' ? '🛡️ SUP' : r}</span>
                      </button>
                    );
                  })}
                </div>
                {availableRoles.length > 1 && (
                  <span className="text-[11px] text-amber-200/70 font-medium">
                    （レーンごとに個別のビルド・立ち回りを閲覧・保存できます）
                  </span>
                )}
              </div>
            )}

            {/* シームレス導線: 辞典 ➔ AIコーチへ即座に繋ぐボタン */}
            <div className="flex gap-3 items-center flex-wrap pt-2">
              <Link
                href={`/coach?champion=${encodeURIComponent(selected.id)}`}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black rounded-xl transition-all shadow-lg flex items-center gap-2 text-xs"
              >
                <Zap size={16} /> 🎯 このチャンピオンでAIコーチを起動する (/coach)
              </Link>
            </div>

            {/* ⚡ パワースパイク ＆ 対面必勝心得サマリーカード */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 text-center">
                <div className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider mb-1">⏱ パワースパイク時間帯</div>
                <div className="text-sm font-extrabold text-white">
                  {powerSpikeScores?.peak_window || '中盤キャリー型 (1〜2コア)'}
                </div>
                <div className="flex justify-center items-center gap-2 mt-2 text-[10px] text-stone-400">
                  <span>序盤: <strong className="text-stone-200">{powerSpikeScores?.early_game_score ?? 3}/5</strong></span>
                  <span>・</span>
                  <span>中盤: <strong className="text-amber-300">{powerSpikeScores?.mid_game_score ?? 4}/5</strong></span>
                  <span>・</span>
                  <span>終盤: <strong className="text-stone-200">{powerSpikeScores?.late_game_score ?? 4}/5</strong></span>
                </div>
              </div>

              <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 md:col-span-2 flex flex-col justify-center">
                <div className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <span>🎯</span> 対面必勝の心得
                </div>
                <p className="text-xs text-stone-300 font-medium leading-relaxed line-clamp-2">
                  {dataFields.strengths || dataFields.strategy || '相手の主要スキルのクールダウン中に有利なトレードを仕掛け、パワースパイク（1コア完成時）に合わせて主導権を握る。'}
                </p>
              </div>
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

              <button
                type="button"
                onClick={() => handleStartRefineFacts(selected.id || selected.name, selectedRole)}
                disabled={refiningFacts}
                className="px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl transition-all flex items-center gap-2 text-sm shadow-md shadow-amber-500/20 disabled:opacity-50"
                title="蓄積された知見の重複を排除し、各項目を洗練された1本の文章に清書・整理します"
              >
                {refiningFacts ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>{refiningFacts ? 'AIが知見を清書中...' : '✨ 蓄積知見をAI清書・整理'}</span>
              </button>
              <button
                onClick={handleQualityCheck}
                disabled={checkingQuality}
                className="px-4 py-3 bg-cyan-700 hover:bg-cyan-800 text-white font-black rounded-xl transition-all flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="実在する優良事例と比較し、記述の具体性・実用性をAIが審査します（都度Geminiを呼ぶため乱用注意）"
              >
                🔎 {checkingQuality ? "審査中..." : "品質チェック"}
              </button>
            </div>
            )}

            {qualityResult && (
              <div className={`flex flex-col gap-1.5 px-4 py-3 rounded-xl text-xs border ${
                qualityResult.pass ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/60' : 'bg-rose-100 text-rose-700 border-rose-200'
              }`}>
                <div className="font-black flex items-center gap-2">
                  {qualityResult.pass ? '✅ 合格' : '⚠️ 要改善'}（スコア {qualityResult.score}/10、基準: {qualityResult.barChampion}）
                </div>
                <div>{qualityResult.verdictSummary}</div>
                {qualityResult.issues.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5 mt-1">
                    {qualityResult.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                  </ul>
                )}
                {!qualityResult.pass && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-rose-200/60">
                    <span className="text-[11px]">次にすること:</span>
                    <button
                      onClick={handleFetchTrend}
                      disabled={fetchingTrend}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] disabled:opacity-50 flex items-center gap-1"
                    >
                      <RefreshCw size={11} className={fetchingTrend ? "animate-spin" : ""} />
                      🔄 最新トレンド取得で再生成
                    </button>
                    <span className="text-[11px] text-rose-600/70">または上記の問題点を見て手動で編集・保存</span>
                  </div>
                )}
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
          <TextAreaCard title="パワースパイク" icon={Zap} color="text-[#c89b3c] border-[#c89b3c] shadow-[#c89b3c]" value={dataFields.powerSpikes} onChange={v => setField('powerSpikes', v)} fieldKey="powerSpikes" onOpenHistory={handleOpenHistory} />
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
              <label className="block text-xs text-gray-500 font-bold mb-1.5">先出し・後出し評価の根拠 ＆ 立ち回り解説</label>
              <textarea
                value={dataFields.jg_style?.description || ''}
                onChange={e => setJgStyleField('description', e.target.value)}
                placeholder="なぜその先出し・後出しの星評価になったのかの具体的な理由や、立ち回り上の強み・弱みを記述..."
                className="w-full min-h-[90px] h-auto bg-white border border-border rounded-xl p-3 text-stone-900 text-xs leading-relaxed resize-y focus:outline-none focus:border-emerald-500 transition-colors shadow-2xs font-sans"
              />
            </div>

            {/* ⏱ ジャングル序盤タイミング（AI自動取得のみ・手動編集不可） */}
            {(dataFields.jg_style?.role || 'JUNGLE') === 'JUNGLE' && (
              <div className="mt-4 pt-4 border-t border-black/10">
                <p className="text-xs text-gray-400 font-bold mb-2 flex items-center gap-1.5">
                  <Clock size={13} /> ジャングル序盤タイミング（自動取得）
                </p>
                <div className="flex gap-2 flex-wrap items-center">
                  <span className="px-3 py-1.5 bg-black/5 border border-black/10 rounded-lg text-xs font-bold text-stone-700">
                    1周目フルクリア {formatTimingSec(dataFields.jg_style?.full_clear_time_sec)}
                  </span>
                  <span className="px-3 py-1.5 bg-black/5 border border-black/10 rounded-lg text-xs font-bold text-stone-700">
                    1コア完成 {formatTimingSec(dataFields.jg_style?.first_core_timing_sec)}
                  </span>
                  <span className="px-3 py-1.5 bg-black/5 border border-black/10 rounded-lg text-xs font-bold text-stone-700">
                    2コア完成 {formatTimingSec(dataFields.jg_style?.second_core_timing_sec)}
                  </span>
                </div>
                {(dataFields.jg_style?.full_clear_time_sec == null) && (
                  <p className="text-[11px] text-gray-400 mt-2">
                    未取得の項目は、上部の「最新トレンド取得」ボタンでAIが攻略サイトを調査して自動入力します。
                  </p>
                )}

                {/* 🎮 実測値。AI推定値は上書きせず別枠表示(2026-08-13)。出典が2つ混在する:
                    - フルクリア時間: 以前はRiot Timeline APIの自前集計だったが、累積カウンタを
                      60秒間隔で誤判定する構造的ミスで3〜18分にばらついていたため、2026-08-15に
                      junglepedia.lol(高エロソロキュー50万試合超の集計)へ切り替えた。平均ではなく
                      最速値(fastestClearMs)を使う(「上手いプレイヤーがどこまで詰められるか」の
                      目安として最速の方が実用的、というユーザー判断)。
                    - コアアイテム完成タイミング: 実際のITEM_PURCHASEDイベントを使うRiot集計の
                      ままで、こちらは元々正確なため変更していない。 */}
                {(realJungleTiming && (realJungleTiming.externalFastestClearSec != null || realJungleTiming.avgFirstCoreSec != null)) && (
                  <div className="mt-3 pt-3 border-t border-black/10 space-y-1.5">
                    {realJungleTiming.externalFastestClearSec != null && (
                      <p className="text-[11px] text-gray-400 font-bold flex items-center gap-1.5">
                        🎮 実測値・フルクリア最速（{realJungleTiming.externalSource || 'junglepedia.lol'}調べ・全ティア{realJungleTiming.externalSampleSize ? `・${realJungleTiming.externalSampleSize.toLocaleString()}試合` : ''}）
                      </p>
                    )}
                    <div className="flex gap-2 flex-wrap items-center">
                      {realJungleTiming.externalFastestClearSec != null && (
                        <span className="px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-lg text-xs font-bold text-sky-700">
                          フルクリア(最速) {formatTimingSec(realJungleTiming.externalFastestClearSec)}
                        </span>
                      )}
                      {realJungleTiming.avgFirstCoreSec != null && (
                        <span className="px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-lg text-xs font-bold text-sky-700">
                          1コア完成 {formatTimingSec(realJungleTiming.avgFirstCoreSec)}（{realJungleTiming.tier}帯・{realJungleTiming.sampleCount}試合）
                        </span>
                      )}
                      {realJungleTiming.avgSecondCoreSec != null && (
                        <span className="px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-lg text-xs font-bold text-sky-700">
                          2コア完成 {formatTimingSec(realJungleTiming.avgSecondCoreSec)}（{realJungleTiming.tier}帯・{realJungleTiming.sampleCount}試合）
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
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

          {/* 🔎 AIリサーチの出典 (google_searchグラウンディング由来、参考・裏取り用) */}
          {dataFields.research_sources && dataFields.research_sources.length > 0 && (
            <div className="glass-panel border-t-2 border-cyan-400 p-5 rounded-2xl col-span-1 md:col-span-2">
              <h3 className="text-sm font-black flex items-center gap-2 text-cyan-700 mb-3">
                🔎 AIリサーチの出典（参考・裏取り用）
              </h3>
              <ul className="space-y-1.5">
                {dataFields.research_sources.map((src: any, idx: number) => (
                  <li key={idx} className="text-xs">
                    <a
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-700 hover:text-cyan-900 hover:underline break-all"
                    >
                      {src.title || src.uri}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                        <textarea value={val as string} onChange={e => updateCustomField(key, e.target.value)} className="w-full min-h-[140px] h-auto bg-white border border-black/10 rounded-xl p-3.5 text-sm text-stone-800 leading-relaxed outline-none focus:border-pink-500/60 resize-y shadow-inner transition-colors font-sans" placeholder={`${key}を記録...`} />
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
              <h3 className="text-base font-black text-stone-900">⚔️ 対面マッチアップ対策 ＆ 戦術メモ</h3>
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

          {/* 保存ボタン（管理者用） */}
          {isAdmin && (
            <div className="flex justify-end items-center gap-3 pt-4 border-t border-stone-200">
              {saveSuccess && (
                <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold">
                  <Check size={14} /> 保存しました
                </span>
              )}
              <button
                onClick={saveMemo}
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 font-black rounded-xl hover:shadow-md transition-all flex items-center gap-2 text-xs cursor-pointer"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} チャンピオン辞典の変更を保存する
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  </div>

      {/* 変更履歴モーダル */}
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

      {/* ✨ AI知見清書 処理中オーバーレイ */}
      {refiningFacts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-amber-300 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
              <Sparkles size={32} className="animate-spin text-amber-600" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-stone-900">✨ 蓄積知見をAI清書・整理中...</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                重複表現を削ぎ落とし、2026年最新メタ仕様（スカトル2:55/グラブ8:00等）に合わせたプロ品質の文章へ再構成しています。
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
              <RefreshCw size={14} className="animate-spin" />
              <span>Gemini 3 が推敲中（数秒お待ちください）</span>
            </div>
          </div>
        </div>
      )}

      {/* ✨ AI知見清書・重複排除 プレビューモーダル */}
      {factsRefinePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/80 backdrop-blur-md animate-fade-in touch-pan-y">
          <div className="bg-[#fcfbf9] border border-stone-200 rounded-2xl sm:rounded-3xl w-full max-w-[1550px] w-[96vw] h-[94vh] max-h-[94vh] shadow-2xl flex flex-col overflow-hidden">
            {/* ヘッダー */}
            <div className="p-3.5 sm:p-5 border-b border-stone-200 flex items-center justify-between gap-2 shrink-0 bg-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-xl font-black text-stone-900 flex items-center gap-1.5 truncate">
                    <Sparkles size={20} className="text-amber-600 shrink-0" />
                    <span>{factsRefinePreview.champion} 蓄積知見 AI清書プレビュー</span>
                  </h3>
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5 hidden sm:block">
                  蓄積された複数の【追記知見】の重複を削ぎ落とし、最新メタに合わせた洗練された文章に清書しました。
                </p>
              </div>
              <button
                onClick={() => setFactsRefinePreview(null)}
                disabled={savingRefinedFacts}
                className="text-stone-400 hover:text-stone-700 p-2 rounded-xl hover:bg-stone-100 transition shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* 項目ごとのビフォーアフター差分一覧 (メインスクロールエリア) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 space-y-4 overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
              {factsRefinePreview.diffs
                .filter((d) => (d.before && d.before.trim().length > 0) || (d.after && d.after.trim().length > 0))
                .map((d) => (
                  <div key={d.fieldKey} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-black text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg inline-block">
                        📌 {d.fieldLabel}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {d.before?.length || 0} 文字 ➔ {d.after?.length || 0} 文字
                      </span>
                    </div>

                    {/* 左右文章並列比較 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* 清書前 */}
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-1.5 flex flex-col">
                        <span className="text-[10px] font-bold text-stone-500 flex items-center gap-1">
                          <span>📄</span> 清書前（蓄積された生知見）:
                        </span>
                        <div className="text-stone-600 whitespace-pre-wrap leading-relaxed font-sans text-xs flex-1">
                          {d.before || '（未記載）'}
                        </div>
                      </div>

                      {/* 清書後 */}
                      <div className="bg-amber-50/40 border border-amber-300/80 rounded-xl p-3.5 space-y-1.5 flex flex-col shadow-2xs">
                        <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                          <Sparkles size={12} className="text-amber-600" /> 清書後（AI推敲・重複排除版）:
                        </span>
                        <div className="text-stone-900 whitespace-pre-wrap leading-relaxed font-medium text-xs flex-1">
                          {d.after || '（未記載）'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* フッターアクション */}
            <div className="p-3 sm:p-4 bg-white border-t border-stone-200 flex items-center justify-between gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => setFactsRefinePreview(null)}
                disabled={savingRefinedFacts}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 hover:bg-stone-100 transition"
              >
                破棄して閉じる
              </button>
              <button
                type="button"
                onClick={handleConfirmRefineFacts}
                disabled={savingRefinedFacts}
                className="px-5 sm:px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center gap-2 shadow-md shadow-amber-600/20 disabled:opacity-50"
              >
                {savingRefinedFacts ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
                <span>{savingRefinedFacts ? '反映処理中...' : '✨ この清書版で辞典を更新'}</span>
              </button>
            </div>
          </div>
        </div>
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
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className={`glass-panel border-t-2 p-5 rounded-2xl group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] ${borderColor} flex flex-col justify-between`}>
      <div>
        <div className="flex items-center justify-between mb-3 border-b border-black/5 pb-2.5">
          <h3 className={`text-sm font-black flex items-center gap-2 ${textColor}`}>
            <Icon size={16} /> {title}
          </h3>
          <div className="flex items-center gap-1.5">
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
                <History size={12} /> 📜 履歴
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 border shadow-xs cursor-pointer ${
                isEditing
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-black/5 hover:bg-black/10 text-stone-700 border-black/10'
              }`}
            >
              <Edit2 size={12} />
              <span>{isEditing ? '完了' : '編集'}</span>
            </button>
          </div>
        </div>

        {isEditing ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full min-h-[160px] bg-white border border-stone-300 rounded-xl p-3.5 text-sm text-stone-900 leading-relaxed outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-inner transition-colors resize-y font-sans"
            placeholder={`${title}を記録...`}
            autoFocus
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="min-h-[90px] p-2 text-stone-800 text-sm leading-relaxed cursor-pointer hover:bg-black/[0.02] rounded-xl transition"
            title="クリックして編集"
          >
            {value ? (
              <div className="prose prose-sm max-w-none prose-stone prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 text-stone-800 font-normal">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-stone-400 italic text-xs py-2">
                まだ知見が記録されていません。クリックまたは「編集」ボタンから追記できます。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function DictionaryTab({ isAdmin = false }: { isAdmin?: boolean }) {
  return <ChampionsContent isAdmin={isAdmin} />;
}
