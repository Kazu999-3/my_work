"use client";

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { Book, ChevronLeft, ChevronDown, ChevronUp, Clock, User, Sparkles, Pencil, Save, X, Trash2, Search, Activity, Eye, Edit2, Star as StarIcon, RefreshCw, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';

import ChampSelect from '../../../components/ChampSelect';
import { getFavorites, toggleFavoriteArticle } from '../../../components/FavoritesPanel';
import ArticleRevisionHistory from './ArticleRevisionHistory';
import { detectChampionsFromText } from '../../../lib/championDetection';
import LibraryMergePreviewModal, {
  type MergePreviewItem,
  type LaneGeneralInsight,
  type ChampionTrendAnalysis,
  type MatchupInsight,
} from './LibraryMergePreviewModal';
const parseDate = (dStr: any) => {
  if (!dStr) return 0;
  const t = new Date(dStr).getTime();
  return isNaN(t) ? 0 : t;
};

export function LibraryTabContentInner() {
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const [articles, setArticles] = useState<any[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editChampions, setEditChampions] = useState<string[]>([]);
  const [champInput, setChampInput] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [saving, setSaving] = useState(false);
  const [reAnalyzing, setReAnalyzing] = useState(false);
  // 記事保存時にチャンピオン辞典へマージする前のプレビュー(2026-08-16)
  const [mergePreview, setMergePreview] = useState<{
    previews: MergePreviewItem[];
    trendAnalyses?: ChampionTrendAnalysis[];
    matchupInsights?: MatchupInsight[];
    laneGeneralInsights: LaneGeneralInsight[];
    detectedLane: string;
    articleId: number | string;
    title: string;
    content: string;
    sourceUrl?: string;
    editChampions: string[];
  } | null>(null);
  const [mergeConfirmSaving, setMergeConfirmSaving] = useState(false);

  // 記事本文・タイトルから登場するチャンピオンを自動検出（未追加分のみ）
  const detectedChampions = useMemo(() => {
    if (!editing) return [];
    return detectChampionsFromText(editTitle, editContent, editChampions);
  }, [editing, editTitle, editContent, editChampions]);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ processed: number; total: number; synced: number } | null>(null);
  // ?q=... で検索語を渡せる（動画キューから「記事をタイトルで探す」で飛んでくる）
  const [search, setSearch] = useState('');
  useEffect(() => {
    const q = searchParams ? searchParams.get('q') : null;
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    if (selectedArticle) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedArticle]);

  // この記事が実際に辞典生成プロンプトへ何回採用されたか(knowledge_usage_log)。
  // 「記事数」ではなく「再利用率」を可視化するための指標(2026-08-12)。
  const [usageCount, setUsageCount] = useState<number | null>(null);
  useEffect(() => {
    if (!selectedArticle?.id || !supabase) { setUsageCount(null); return; }
    let cancelled = false;
    supabase
      .from('knowledge_usage_log')
      .select('id', { count: 'exact', head: true })
      .eq('source_table', 'personal_knowledge')
      .eq('source_id', String(selectedArticle.id))
      .then(({ count }: { count: number | null }) => {
        if (!cancelled) setUsageCount(count ?? 0);
      });
    return () => { cancelled = true; };
  }, [selectedArticle?.id]);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [groupMode, setGroupMode] = useState<'champion' | 'keyword'>('champion');
  const [sortOrder, setSortOrder] = useState('updated_desc');
  // アコーディオンプレビュー用（1つだけ展開）
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [favoriteArticles, setFavoriteArticles] = useState<number[]>([]);
  const [visibleGroupsCount, setVisibleGroupsCount] = useState(20);

  // 複数選択
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  // スマート一括統合
  const [batchMerging, setBatchMerging] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; success: number } | null>(null);
  // 連続レビュー（案A）
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);

  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    message: '',
    type: 'success',
  });
  


  const [reAnalyzeId, setReAnalyzeId] = useState<number | string | null>(null);
  const handleReAnalyzeArticle = async (article: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!article.source_url) {
      showToast('この記事には元URLが設定されていません。', 'info');
      return;
    }
    if (!confirm(`「${article.title}」のURLから画像・動画を含めてAI再解析・更新しますか？`)) return;

    setReAnalyzeId(article.id);
    try {
      const res = await fetch('/api/admin/knowledge/re-analyze', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: article.id })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || '画像・動画AI再解析・更新が完了しました！', 'success');
        fetchArticles();
      } else {
        showToast(data.error || '再解析に失敗しました。', 'error');
      }
    } catch (err) {
      showToast('通信エラーが発生しました。', 'error');
    } finally {
      setReAnalyzeId(null);
    }
  };

  // 検索条件やモード変更時に表示グループ数をリセット
  useEffect(() => {
    setVisibleGroupsCount(20);
  }, [debouncedSearch, groupMode, sortOrder]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // デバウンス処理
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 150);
    return () => clearTimeout(timer);
  }, [search]);

  // トースト自動消去
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
  };

  // お気に入りデータのロードと同期
  useEffect(() => {
    setFavoriteArticles(getFavorites().articles.map(a => a.id));

    const handleFavUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.articles) {
        setFavoriteArticles(detail.articles.map((a: any) => a.id));
      }
    };
    window.addEventListener("favorites-updated", handleFavUpdated);
    window.addEventListener("storage", handleFavUpdated);
    return () => {
      window.removeEventListener("favorites-updated", handleFavUpdated);
      window.removeEventListener("storage", handleFavUpdated);
    };
  }, []);

  const handleToggleFavorite = (id: number, title: string) => {
    toggleFavoriteArticle(id, title);
  };

  // 辞典へ移動した記事の閲覧・復元。誤って移動しても元に戻せるようにする。
  const [showMoved, setShowMoved] = useState(false);
  const [movedCount, setMovedCount] = useState(0);

  // この記事をレーン別ガイドへ送る。レーンは自分で選べる（未選択なら自動判定）。
  const [sendingLane, setSendingLane] = useState(false);
  const [laneChoice, setLaneChoice] = useState('auto');
  const LANE_CHOICES = [
    { key: 'auto', label: '自動判定' },
    { key: 'COMMON', label: '全レーン共通（上達の原則）' },
    { key: 'TOP', label: 'TOP' },
    { key: 'JG', label: 'JG' },
    { key: 'MID', label: 'MID' },
    { key: 'ADC', label: 'ADC' },
    { key: 'SUP', label: 'SUP' },
  ];
  const sendToLaneGuide = async () => {
    if (!selectedArticle) return;
    const laneLabel = LANE_CHOICES.find(l => l.key === laneChoice)?.label || laneChoice;
    if (!confirm(`この記事を「${laneLabel}」のレーン別ガイドへ統合しますか？\n\n統合後、記事はライブラリから「移動済み」へ移ります。`)) return;
    setSendingLane(true);
    try {
      const res = await fetch('/api/admin/lane-guides', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge_one',
          articleId: selectedArticle.id,
          lane: laneChoice === 'auto' ? undefined : laneChoice,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '統合に失敗しました');
      showToast(`✅ 「${d.laneLabel}」のガイドへ統合しました`, 'success');
      setSelectedArticle(null);
      await fetchArticles();
    } catch (e: any) {
      showToast(`❌ ${e.message}`, 'error');
    } finally { setSendingLane(false); }
  };

  /** 移動済み記事をライブラリへ復元する（__DELETED__ タグを外す） */
  const restoreArticle = async (id: any) => {
    if (!confirm('この記事をライブラリに戻しますか？')) return;
    try {
      const res = await fetch('/api/admin/knowledge/update', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updateData: { tags: [] } }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || '復元に失敗しました');
      showToast('✅ ライブラリに戻しました', 'success');
      setSelectedArticle(null);
      await fetchArticles();
    } catch (e: any) {
      showToast(`❌ 復元に失敗: ${e.message}`, 'error');
    }
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        showToast('Supabase接続が有効ではありません。環境変数(NEXT_PUBLIC_SUPABASE_URL 等)をご確認ください。', 'error');
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('personal_knowledge')
        .select('id, created_at, title, content, raw_content, source_url, genre, tags, champion, author, parent_id, is_atomic')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (!error && data) {
        const isDeleted = (a: any) => a.tags && a.tags.includes('__DELETED__');
        // 非LoL記事（副業、ツール、システム開発メモ、確定申告、note集客など）の除外キーワード
        const NON_LOL_KEYWORDS = ['副業', 'ツール', 'マネタイズ', '確定申告', '集客', 'note', 'sns', 'セールス', 'メルマガ', 'gas'];
        const isNonLolArticle = (a: any) => {
          const title = (a.title || '').toLowerCase();
          const genre = (a.genre || '').toLowerCase();
          const tags = Array.isArray(a.tags) ? a.tags.join(' ').toLowerCase() : '';
          return NON_LOL_KEYWORDS.some(kw => title.includes(kw) || genre.includes(kw) || tags.includes(kw));
        };

        // 通常は移動済み(__DELETED__)および非LoL雑多記事を除外。「移動済みを表示」時は移動済みのみを出す。
        const validData = data.filter((a: any) => {
          if (!a || !a.title) return false;
          if (showMoved) return isDeleted(a);
          return !isDeleted(a) && !isNonLolArticle(a);
        });
        setArticles(validData);
        setMovedCount(data.filter((a: any) => a && a.title && isDeleted(a)).length);

        // URLパラメータ ?article=Id の自動選択処理
        const articleId = searchParams ? searchParams.get('article') : null;
        if (articleId) {
          const found = validData.find((a: any) => String(a.id) === String(articleId));
          if (found) {
            setSelectedArticle(found);
            setExpandedId(found.id);
          }
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchArticles(); }, [searchParams, showMoved]);



  // 統計サマリーの計算
  const statsSummary = useMemo(() => {
    const total = articles.length;
    const champCounts: Record<string, number> = {};
    const keywordCounts: Record<string, number> = {};

    articles.forEach(a => {
      if (!a) return;
      const champ = a.champion || 'その他';
      champCounts[champ] = (champCounts[champ] || 0) + 1;

      if (a.tags && Array.isArray(a.tags)) {
        a.tags.forEach((kw: any) => {
          if (kw && typeof kw === 'string' && kw !== '__DELETED__') {
            keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
          }
        });
      }
    });

    const sortedChamps = Object.entries(champCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const sortedKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    return {
      total,
      champs: sortedChamps,
      keywords: sortedKeywords
    };
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const q = (debouncedSearch || '').toLowerCase();
    return articles.filter((a: any) => {
      if (!a) return false;
      // 原子的な知見(is_atomic)は元記事の詳細画面にのみ表示
      if (a.is_atomic) return false;
      const titleMatch = a.title ? a.title.toLowerCase().includes(q) : false;
      const champMatch = a.champion ? a.champion.toLowerCase().includes(q) : false;
      const tagsMatch = (a.tags && Array.isArray(a.tags))
        ? a.tags.some((k: any) => k && typeof k === 'string' && k.toLowerCase().includes(q))
        : false;
      return titleMatch || champMatch || tagsMatch;
    });
  }, [articles, debouncedSearch]);

  const grouped = useMemo(() => {
    const filtered = filteredArticles;
    const groups: Record<string, any[]> = {};
    if (groupMode === 'champion') {
      filtered.forEach((a: any) => {
        const key = a.champion || 'その他';
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
      });
    } else {
      filtered.forEach((a: any) => {
        const keys = (a.tags && Array.isArray(a.tags) && a.tags.length > 0) ? a.tags : ['未分類'];
        keys.forEach((k: any) => {
          const key = (k && typeof k === 'string') ? k : '未分類';
          if (!groups[key]) groups[key] = [];
          groups[key].push(a);
        });
      });
    }
    
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const timeA = parseDate(a.created_at);
        const timeB = parseDate(b.created_at);
        if (sortOrder === 'updated_desc') return timeB - timeA;
        if (sortOrder === 'updated_asc') return timeA - timeB;
        
        const titleA = a.title || '';
        const titleB = b.title || '';
        return titleA.localeCompare(titleB);
      });
    });

    return Object.entries(groups).sort((a, b) => {
      if (sortOrder === 'updated_desc') {
        const maxB = b[1].length > 0 ? Math.max(...b[1].map(x => parseDate(x.created_at))) : 0;
        const maxA = a[1].length > 0 ? Math.max(...a[1].map(x => parseDate(x.created_at))) : 0;
        return maxB - maxA;
      }
      if (sortOrder === 'updated_asc') {
        const minB = b[1].length > 0 ? Math.min(...b[1].map(x => parseDate(x.created_at))) : 0;
        const minA = a[1].length > 0 ? Math.min(...a[1].map(x => parseDate(x.created_at))) : 0;
        return minA - minB;
      }
      return a[0].localeCompare(b[0]);
    });
  }, [articles, debouncedSearch, groupMode, sortOrder]);

  const expandAllGroups = () => {
    const next: Record<string, boolean> = {};
    grouped.forEach(([groupName]) => {
      next[groupName] = false;
    });
    setCollapsedGroups(next);
  };

  const collapseAllGroups = () => {
    const next: Record<string, boolean> = {};
    grouped.forEach(([groupName]) => {
      next[groupName] = true;
    });
    setCollapsedGroups(next);
  };

  const toggleGroup = (key: string) => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const startEditing = () => { 
    setEditContent(selectedArticle.content || selectedArticle.raw_content || ''); 
    setEditTitle(selectedArticle.title || '');
    // champion フィールドがカンマ区切り複数の場合も対応
    const rawChamp = selectedArticle.champion || '';
    const champList = rawChamp.split(',').map((c: string) => c.trim()).filter((c: string) => c && c.toLowerCase() !== 'unknown');
    setEditChampions(champList);
    setChampInput('');
    setEditKeywords(Array.isArray(selectedArticle.tags) ? selectedArticle.tags.join(', ') : '');
    setEditing(true); 
  };
  const cancelEditing = () => { 
    setEditing(false); 
    setEditContent(''); 
    setEditTitle('');
    setEditChampions([]);
    setChampInput('');
    setEditKeywords('');
  };

  const handleSyncAllArticles = async () => {
    if (!confirm("既存のすべての攻略ライブラリ記事をスキャンし、指定されている複数チャンピオンの各辞典（matchup_sentinel）へ情報を一括マージ・同期しますか？")) return;
    setSyncingAll(true);
    setSyncProgress({ processed: 0, total: 0, synced: 0 });
    try {
      let offset = 0;
      let totalSynced = 0;
      let totalArticles = 0;
      let totalMoved = 0;  // 辞典へ移動しライブラリから消えた記事数
      let scanned = 0;     // 実際にスキャンした記事数（移動で件数が減るためoffsetとは別管理）
      let moveErrorSample: string[] = []; // 移動失敗の理由サンプル
      // ★ サーバー側はチャンク処理になっているため、完了(done)するまで進捗を表示しながら繰り返し呼び出す
      while (true) {
        const res = await fetch('/api/admin/knowledge/sync', {
          method: 'POST',
          credentials: 'include', // 管理者Cookieを送らないと401になる
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset })
        });
        const data = await res.json();
        if (res.status === 401) {
          throw new Error(
            `管理者セッションが切れました（ここまでの同期分は保存済みです）。`
            + '再ログインしてから、もう一度実行すると続きから再開できます。'
          );
        }
        if (!res.ok) throw new Error(data.error || '同期エラーが発生しました');

        totalSynced += data.syncedChampions || 0;
        totalMoved += data.moved || 0;
        if (Array.isArray(data.moveErrors) && data.moveErrors.length > 0 && moveErrorSample.length === 0) {
          moveErrorSample = data.moveErrors;
        }
        totalArticles = data.totalArticles || totalArticles;
        scanned += data.processed || 0;
        setSyncProgress({ processed: Math.min(scanned, totalArticles), total: totalArticles, synced: totalSynced });

        if (data.done || data.nextOffset === null || data.processed === 0) break;
        // 辞典へ移動した記事は対象から外れる（__DELETED__）ため、その分だけ次の開始位置を戻す。
        // 単純に nextOffset を使うと、詰まってきた分だけ記事を読み飛ばしてしまう。
        offset = Math.max(0, data.nextOffset - (data.moved || 0));
      }
      if (moveErrorSample.length > 0) {
        showToast(`⚠️ 同期は完了しましたが移動に失敗した記事があります: ${moveErrorSample.join(' / ')}`, 'error');
      } else {
        showToast(
          `✅ ${scanned}件をスキャンし、延べ ${totalSynced} 件を辞典へ同期しました`
          + (totalMoved > 0 ? `（うち ${totalMoved} 件の記事を辞典へ移動し、ライブラリから削除）` : ''),
          'success'
        );
      }
      // 移動でライブラリの中身が変わるので一覧を再取得
      if (totalMoved > 0) await fetchArticles();
    } catch (err: any) {
      showToast(`❌ 同期失敗: ${err.message}`, 'error');
    } finally {
      setSyncingAll(false);
      setSyncProgress(null);
    }
  };

  /** チャンピオン辞典マージ前のプレビューをAPIから取得する */
  const fetchMergePreview = async (champs: string[]) => {
    if (!selectedArticle) return;
    const res = await fetch('/api/admin/knowledge/merge-article', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: selectedArticle.id,
        title: editTitle,
        content: editContent,
        editChampions: champs,
        dryRun: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'プレビューの取得に失敗しました');

    if (data.success && ((data.champions && data.champions.length > 0) || (data.laneGeneralInsights && data.laneGeneralInsights.length > 0) || (data.matchupInsights && data.matchupInsights.length > 0))) {
      setMergePreview({
        previews: data.previews || [],
        trendAnalyses: data.trendAnalyses || [],
        matchupInsights: data.matchupInsights || [],
        laneGeneralInsights: data.laneGeneralInsights || [],
        detectedLane: data.detectedLane || 'COMMON',
        articleId: selectedArticle.id,
        title: editTitle,
        content: editContent,
        sourceUrl: selectedArticle.source_url || '',
        editChampions: data.champions || [],
      });
      return true;
    }
    return false;
  };

  /** プレビューモーダル内からチャンピオンが変更された時の再解析ハンドラ */
  const handleReAnalyzeFromModal = async (newChamps: string[]) => {
    if (!selectedArticle) return;
    setReAnalyzing(true);
    setEditChampions(newChamps);
    try {
      await fetchMergePreview(newChamps);
    } catch (err: any) {
      showToast('再解析中にエラーが発生しました: ' + err.message, 'error');
    } finally {
      setReAnalyzing(false);
    }
  };

  const saveArticle = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const keywordsArray = editKeywords.split(',').map(k => k.trim()).filter(k => k);
    // 複数チャンピオンをカンマ区切りで保存
    const championsStr = editChampions.join(', ');
    const updateData = {
      title: editTitle,
      champion: championsStr || null,
      tags: keywordsArray,
      content: editContent.slice(0, 300).replace(/[#*`]/g, ''),
      raw_content: editContent,
      created_at: now
    };

    // --- チャンピオン辞典統合ロジック（複数チャンピオン対応）---
    // チャンピオンが1体以上指定されている場合は、即マージせずまずdryRunでプレビューを
    // 取得し、モーダルで確認してから実際の統合(mergeToChampionDict)を実行する
    if (editChampions.some(c => c.trim())) {
      try {
        const hasPreview = await fetchMergePreview(editChampions);
        if (hasPreview) {
          setSaving(false);
          return;
        }
      } catch (err: any) {
        showToast('プレビュー取得中にエラーが発生しました: ' + err.message, 'error');
        setSaving(false);
        return;
      }
    }

    // --- 汎用記事として保存（チャンピオン指定なし）---
    try {
      const res = await fetch('/api/admin/knowledge/update', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedArticle.id, updateData }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const updated = { ...selectedArticle, ...updateData };
        setSelectedArticle(updated);
        setArticles(prev => prev.map(a => a.id === selectedArticle.id ? updated : a));
        setEditing(false);
      } else {
        showToast('保存失敗: ' + (data.error || ''), 'error');
      }
    } catch (err: any) {
      showToast('保存失敗: ' + err.message, 'error');
    }
    setSaving(false);
  };

  // 複数選択用ハンドラ
  const toggleSelect = (id: number | string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectGroup = (items: any[], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const ids = items.map(a => a.id);
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allCurrentIds = filteredArticles.map(a => a.id);
    const allSelected = allCurrentIds.length > 0 && allCurrentIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allCurrentIds));
    }
  };

  // スマート一括統合実行（案C）
  const handleBatchSmartMerge = async (customIds?: (number | string)[]) => {
    const targetIds = customIds && customIds.length > 0 ? customIds : Array.from(selectedIds);
    if (targetIds.length === 0) return;
    if (!confirm(`選択した ${targetIds.length} 件の記事をAIスマート統合しますか？\n\n各記事からチャンピオン知見とレーン一般論を自動分解し、辞典とレーンガイドへ振り分けてライブラリから退避します。`)) return;

    setBatchMerging(true);
    setBatchProgress({ current: 0, total: targetIds.length, success: 0 });

    let remaining = [...targetIds];
    let successTotal = 0;
    let processedTotal = 0;

    try {
      while (remaining.length > 0) {
        const chunk = remaining.slice(0, 3); // 3件ずつ処理
        const res = await fetch('/api/admin/knowledge/batch-smart-merge', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleIds: chunk }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'バッチ処理エラー');

        const successCount = (data.results || []).filter((r: any) => r.success).length;
        successTotal += successCount;
        processedTotal += chunk.length;
        remaining = remaining.slice(chunk.length);

        setBatchProgress({
          current: processedTotal,
          total: targetIds.length,
          success: successTotal,
        });

        // 成功した記事をローカルstateからも除外
        const deletedIds = new Set((data.results || []).filter((r: any) => r.success).map((r: any) => r.articleId));
        setArticles(prev => prev.filter(a => !deletedIds.has(a.id)));
      }

      showToast(`✨ ${successTotal}件の記事をスマート統合（チャンプ辞典＆レーンガイド）しました！`, 'success');
      setSelectedIds(new Set());
    } catch (err: any) {
      showToast(`スマート統合中にエラーが発生しました: ${err.message}`, 'error');
    } finally {
      setBatchMerging(false);
      setBatchProgress(null);
      fetchArticles();
    }
  };

  // 連続レビュー（案A）開始
  const startContinuousReview = async (fromArticles?: any[], startIndex = 0) => {
    const queue = fromArticles && fromArticles.length > 0 ? fromArticles : filteredArticles;
    if (queue.length === 0) {
      showToast('レビュー対象の記事がありません', 'info');
      return;
    }
    setReviewQueue(queue);
    setReviewIndex(startIndex);
    await loadArticleForMergePreview(queue[startIndex]);
  };

  // 特定記事のプレビューをロードしてモーダルを開く
  const loadArticleForMergePreview = async (article: any) => {
    if (!article) return;
    setSelectedArticle(article);
    setEditTitle(article.title || '');
    const body = article.raw_content || article.content || '';
    setEditContent(body);

    const rawChamp = article.champion || '';
    const champs = rawChamp.split(',').map((c: string) => c.trim()).filter((c: string) => c);
    setEditChampions(champs);

    setSaving(true);
    try {
      const res = await fetch('/api/admin/knowledge/merge-article', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
          title: article.title || '',
          content: body,
          editChampions: champs,
          dryRun: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMergePreview({
          previews: data.previews || [],
          trendAnalyses: data.trendAnalyses || [],
          matchupInsights: data.matchupInsights || [],
          laneGeneralInsights: data.laneGeneralInsights || [],
          detectedLane: data.detectedLane || 'COMMON',
          articleId: article.id,
          title: article.title || '',
          content: body,
          sourceUrl: article.source_url || '',
          editChampions: data.champions || champs,
        });
      } else {
        showToast(data.error || 'プレビューの取得に失敗しました', 'error');
      }
    } catch (e: any) {
      showToast('エラー: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // 連続レビューの次へ進む（確定後またはスキップ時）
  const advanceReviewQueue = async () => {
    const nextIdx = reviewIndex + 1;
    if (nextIdx < reviewQueue.length) {
      setReviewIndex(nextIdx);
      await loadArticleForMergePreview(reviewQueue[nextIdx]);
    } else {
      setMergePreview(null);
      setSelectedArticle(null);
      setReviewQueue([]);
      showToast('🎉 全ての記事のレビュー・統合が完了しました！', 'success');
      fetchArticles();
    }
  };

  // プレビュー確認後、実際にチャンピオン辞典へ統合する。
  const confirmMergeToChampionDict = async ({
    sendToLane,
    approvedMatchups,
    approvedLaneGeneralInsights,
    championSpecificInsights,
    trendDataOverrides,
    championRoles,
    finalChampions,
    andNext = false,
  }: {
    sendToLane: string | null;
    approvedMatchups: any[];
    approvedLaneGeneralInsights?: any[];
    championSpecificInsights?: any[];
    trendDataOverrides?: Record<string, Record<string, string>>;
    championRoles?: Record<string, string>;
    finalChampions?: string[];
    andNext?: boolean;
  }) => {
    if (!mergePreview) return;
    setMergeConfirmSaving(true);
    const champsToMerge = finalChampions && finalChampions.length > 0 ? finalChampions : mergePreview.editChampions;
    try {
      const laneInsights = Array.isArray(approvedLaneGeneralInsights)
        ? approvedLaneGeneralInsights
        : mergePreview.laneGeneralInsights;
      const laneGeneralExcerpt = sendToLane && laneInsights.length > 0
        ? laneInsights.map((i: any) => `## ${i.title}\n${i.summary}`).join('\n\n')
        : '';
      const res = await fetch('/api/admin/knowledge/merge-article', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: mergePreview.articleId,
          title: mergePreview.title,
          content: mergePreview.content,
          editChampions: champsToMerge,
          sendLaneGeneralToLane: sendToLane,
          laneGeneralExcerpt,
          approvedMatchups,
          approvedLaneGeneralInsights: laneInsights,
          championSpecificInsights: championSpecificInsights || [],
          trendDataOverrides,
          championRoles: championRoles || {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '辞典への統合に失敗しました');

      if (data.merged) {
        const champLabel = data.champions && data.champions.length > 0
          ? (data.champions.length > 1 ? `${data.champions.join(', ')} (${data.champions.length}体)` : data.champions[0])
          : 'レーン別ガイド';
        const actionLabel = data.champions && data.champions.length > 0 ? 'のチャンピオン辞典' : '';
        showToast(`【統合完了】${champLabel}${actionLabel}にマージ${data.mergedNote || ''}し、ライブラリから削除しました！`, 'success');
        setArticles(prev => prev.filter(a => String(a.id) !== String(mergePreview.articleId)));

        if (andNext && reviewQueue.length > 0) {
          await advanceReviewQueue();
        } else {
          setSelectedArticle(null);
          setEditing(false);
          setMergePreview(null);
          setReviewQueue([]);
        }
      }
    } catch (err: any) {
      showToast('辞典への統合中にエラーが発生しました: ' + err.message, 'error');
    } finally {
      setMergeConfirmSaving(false);
    }
  };

  const deleteArticle = async (id: number | string, e: React.MouseEvent) => {
    e.stopPropagation();

    // 通常のライブラリからは「アーカイブ（移動済みへ退避）」、
    // 移動済み一覧からは「完全削除」。
    // 以前は移動済みでも __DELETED__ を付け直すだけで、実際には何も消えていなかった。
    const message = showMoved
      ? 'この記事をデータベースから完全に削除しますか？\n\n'
        + '・この操作は取り消せません\n'
        + '・チャンピオン辞典やレーン別ガイドへ統合済みの本文は残ります（元記事だけが消えます）\n'
        + '・コーチAIはアーカイブ記事も参照しているため、参照対象からは外れます'
      : 'この記事を移動済み（アーカイブ）へ移しますか？\n\n「🗄️ 移動済み」からいつでもライブラリに戻せます。';
    if (!confirm(message)) return;

    try {
      let error: any = null;
      if (showMoved) {
        // 完全削除は RLS を確実に通すためサービスロールのAPI経由で行う
        const res = await fetch('/api/admin/knowledge/delete', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) error = { message: d.error || (res.status === 401 ? '管理者セッションが切れています。再ログインしてください。' : '削除に失敗しました') };
      } else {
        const res = await fetch('/api/admin/knowledge/update', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, updateData: { tags: ['__DELETED__'] } }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) error = { message: d.error || '削除に失敗しました' };
      }
      if (error) {
        showToast('削除エラー: ' + error.message, 'error');
        console.error("Delete Error:", error);
      } else {
        showToast(showMoved ? '🗑️ 完全に削除しました' : '🗄️ 移動済みへ移しました', 'success');
        setArticles(prev => prev.filter(a => String(a.id) !== String(id)));
        if (selectedArticle && String(selectedArticle.id) === String(id)) setSelectedArticle(null);
      }
    } catch (err) {
      showToast('削除中に予期せぬエラーが発生しました。', 'error');
      console.error("Unexpected Delete Error:", err);
    }
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  if (selectedArticle) {
    return (
      <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 md:p-12 max-w-5xl mx-auto flex flex-col gap-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <button onClick={() => { setSelectedArticle(null); setEditing(false); }} className="flex items-center gap-2 text-violet-700 font-bold hover:text-violet-900 transition-colors">
            <ChevronLeft size={18} /> 一覧へ戻る
          </button>
          <div className="flex gap-2 flex-wrap">
            {!editing ? (
              <button onClick={startEditing} className="px-4 py-2 glass-panel glass-panel-hover text-violet-700 rounded-xl text-sm font-bold flex items-center gap-2"><Pencil size={14} /> 編集する</button>
            ) : (
              <>
                <button onClick={cancelEditing} className="px-4 py-2 glass-panel text-gray-500 hover:text-gray-900 rounded-xl text-sm font-bold flex items-center gap-2"><X size={14} /> キャンセル</button>
                <button onClick={saveArticle} disabled={saving} className="px-4 py-2 bg-violet-600 text-white hover:-translate-y-0.5 shadow-lg shadow-violet-600/20 rounded-xl text-sm font-black flex items-center gap-2 transition-all"><Save size={14} /> {saving ? '保存中...' : '保存する'}</button>
                {!showMoved && (
                  <div className="flex items-center gap-1.5 glass-panel p-1 rounded-xl border border-amber-300 bg-amber-100">
                    <select
                      value={laneChoice}
                      onChange={(e) => setLaneChoice(e.target.value)}
                      title="送り先のレーンを選びます"
                      className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs text-amber-800 outline-none"
                    >
                      {LANE_CHOICES.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                    </select>
                    <button
                      onClick={sendToLaneGuide}
                      disabled={sendingLane}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition disabled:opacity-50"
                      title="この内容でレーン別ガイドへ統合します"
                    >
                      {sendingLane ? '送信中...' : '🗺️ ガイドへ送る'}
                    </button>
                  </div>
                )}
              </>
            )}
            {selectedArticle?.source_url && !editing && (
              <button
                onClick={(e) => handleReAnalyzeArticle(selectedArticle, e)}
                disabled={reAnalyzeId === selectedArticle.id}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-purple-500/20 disabled:opacity-50"
                title="元URLから画像・動画を含めて最新AI再解析します"
              >
                <RefreshCw size={14} className={reAnalyzeId === selectedArticle.id ? "animate-spin" : ""} />
                {reAnalyzeId === selectedArticle.id ? "AI再解析中..." : "✨ 画像・動画AI再解析"}
              </button>
            )}
            <button onClick={(e) => deleteArticle(selectedArticle.id, e)} className="px-4 py-2 glass-panel glass-panel-hover text-red-600 rounded-xl text-sm font-bold flex items-center gap-2"><Trash2 size={14} /> 削除</button>
          </div>
        </div>

        <div className="glass-panel rounded-3xl overflow-hidden relative group">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-violet-100 rounded-full blur-3xl"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#a78bfa] to-[#c89b3c]"></div>
          <div className="p-10 relative z-10">
            <header className="mb-10 pb-8 border-b border-black/10">
              <div className="flex items-center gap-2 text-violet-700 font-mono text-xs mb-4 tracking-[0.15em] uppercase font-black"><Sparkles size={14} /> 攻略記事</div>
              {editing ? (
                <div className="flex flex-col gap-4 mb-6">
                  <div>
                    <label className="text-xs text-violet-700 font-bold">タイトル</label>
                    <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full bg-white border border-violet-300 rounded-xl p-3 text-2xl font-bold text-gray-900 outline-none focus:border-violet-500 transition-colors" />
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-violet-700 font-bold">チャンピオン（複数選択可）</label>
                      </div>

                      {/* 記事から自動検出されたチャンピオンの候補チップ */}
                      {detectedChampions.length > 0 && (
                        <div className="mb-2.5 p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                              <Sparkles size={12} className="text-amber-600" />
                              記事から検出されたチャンピオン ({detectedChampions.length}体):
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const newChamps = detectedChampions.map(d => d.champion);
                                setEditChampions(prev => Array.from(new Set([...prev, ...newChamps])));
                              }}
                              className="text-[10px] font-black text-amber-800 hover:text-amber-950 underline ml-2 cursor-pointer"
                            >
                              すべて追加
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {detectedChampions.map(d => (
                              <button
                                key={d.champion}
                                type="button"
                                onClick={() => {
                                  setEditChampions(prev => prev.includes(d.champion) ? prev : [...prev, d.champion]);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-amber-300 rounded-md text-[11px] font-bold text-stone-800 hover:bg-amber-100 hover:border-amber-400 transition shadow-2xs cursor-pointer"
                                title={`出現: ${d.count}回 / マッチ表記: ${d.matchedAlias}${d.inTitle ? ' (タイトル内)' : ''}`}
                              >
                                <span>{d.champion}</span>
                                <span className="text-[9px] text-amber-600 font-normal">({d.matchedAlias})</span>
                                <span className="text-[10px] font-bold text-amber-600">＋</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 選択済みタグ */}
                      {editChampions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {editChampions.map(c => (
                            <span key={c} className="flex items-center gap-1 px-2.5 py-1 bg-violet-100 border border-violet-300 rounded-full text-xs font-bold text-violet-700">
                              {c}
                              <button onClick={() => setEditChampions(prev => prev.filter(x => x !== c))} className="hover:text-violet-900 transition-colors ml-0.5"><X size={10} /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      {/* サジェスト付き入力 */}
                      <ChampSelect
                        value={champInput}
                        onChange={v => setChampInput(v)}
                        placeholder={editChampions.length === 0 ? "未設定の場合は「その他」になります" : "追加するチャンピオン名..."}
                        className="bg-white border-violet-300 focus:border-violet-500"
                        onSelect={(champ: string) => {
                          if (champ && !editChampions.includes(champ)) {
                            setEditChampions(prev => [...prev, champ]);
                          }
                          setChampInput('');
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-xs text-violet-700 font-bold">キーワード (カンマ区切り)</label>
                      <input type="text" value={editKeywords} onChange={e => setEditKeywords(e.target.value)} className="w-full bg-white border border-violet-300 rounded-xl p-3 text-sm text-gray-900 outline-none focus:border-violet-500 transition-colors" placeholder="例: マクロ, 序盤, カウンター" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-black leading-tight font-mono text-gray-900 flex-1 break-words max-w-full">{selectedArticle.title ? selectedArticle.title.replace(/_/g, ' ') : ''}</h1>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {/* レーン別ガイドへ送る（チャンピオン記事ではない、マクロ・立ち回り記事向け） */}
                    {!showMoved && (
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={laneChoice}
                          onChange={(e) => setLaneChoice(e.target.value)}
                          title="送り先のレーンを選びます"
                          className="bg-white border border-amber-300 rounded-xl px-2 py-2.5 text-xs text-amber-800 outline-none focus:border-amber-500"
                        >
                          {LANE_CHOICES.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                        </select>
                        <button
                          onClick={sendToLaneGuide}
                          disabled={sendingLane}
                          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-black shrink-0 transition disabled:opacity-50"
                          title="この記事をレーン別ガイドへ統合します"
                        >
                          {sendingLane ? '統合中...' : '🗺️ ガイドへ送る'}
                        </button>
                      </div>
                    )}
                    {/* 移動済み表示中は、この記事をライブラリへ戻せるようにする */}
                    {showMoved && (
                      <button
                        onClick={() => restoreArticle(selectedArticle.id)}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black shrink-0 transition"
                        title="この記事をライブラリに戻します"
                      >
                        ↩️ ライブラリに戻す
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleFavorite(selectedArticle.id, selectedArticle.title || '')}
                      className={`p-2.5 rounded-xl transition-all border shrink-0 ${
                        favoriteArticles.includes(selectedArticle.id)
                          ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                          : 'bg-black/5 border-black/10 text-gray-400 hover:text-gray-900 hover:bg-black/10'
                      }`}
                      title={favoriteArticles.includes(selectedArticle.id) ? "お気に入り解除" : "お気に入り登録"}
                    >
                      <StarIcon size={20} fill={favoriteArticles.includes(selectedArticle.id) ? "currentColor" : "none"} />
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-xs text-gray-400 items-center">
                <span className="flex items-center gap-2 bg-black/5 px-3 py-1.5 rounded-full font-bold uppercase tracking-widest border border-black/10"><User size={14} className="text-violet-700" /> AI AGENT</span>
                <span className="flex items-center gap-2 bg-black/5 px-3 py-1.5 rounded-full font-bold uppercase tracking-widest border border-black/10"><Clock size={14} className="text-violet-700" /> {isMounted && selectedArticle.created_at ? new Date(selectedArticle.created_at).toLocaleString('ja-JP') : '日付不明'}</span>
                {usageCount !== null && (
                  <span
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold border ${
                      usageCount > 0
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-400 border-gray-200'
                    }`}
                    title="この記事が辞典生成のAIプロンプトに実際に採用された回数"
                  >
                    🔁 辞典採用: {usageCount}回
                  </span>
                )}
                {selectedArticle.champion && (
                  <span className="flex items-center gap-1.5 bg-violet-100 text-violet-700 border border-violet-200 px-3 py-1.5 rounded-full font-bold">
                    🏆 {selectedArticle.champion}
                  </span>
                )}
                {selectedArticle.tags && Array.isArray(selectedArticle.tags) && selectedArticle.tags.map((t: string, i: number) => (
                  <span key={i} className="text-[11px] text-gray-500 bg-black/5 border border-black/10 px-2.5 py-1 rounded-lg font-mono">
                    #{t}
                  </span>
                ))}
              </div>
            </header>

            {editing ? (
              <div className="flex flex-col gap-4">
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full min-h-[600px] p-6 bg-white border border-violet-300 rounded-2xl text-sm leading-loose font-mono outline-none focus:border-violet-500 shadow-inner text-gray-900 transition-colors" />
                <div className="flex justify-end gap-3 pt-4 border-t border-black/10">
                  <button onClick={cancelEditing} className="px-4 py-2 glass-panel text-gray-500 hover:text-gray-900 rounded-xl text-sm font-bold flex items-center gap-2"><X size={14} /> キャンセル</button>
                  <button onClick={saveArticle} disabled={saving} className="px-4 py-2 bg-violet-600 text-white hover:-translate-y-0.5 shadow-lg shadow-violet-600/20 rounded-xl text-sm font-black flex items-center gap-2 transition-all"><Save size={14} /> {saving ? '保存中...' : '保存する'}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="prose prose-purple max-w-none text-[15px] leading-loose text-gray-700 break-words overflow-x-auto [&_table]:w-full [&_table]:table-auto [&_table]:my-4 [&_table]:border-collapse [&_th]:border [&_th]:border-black/10 [&_th]:bg-black/5 [&_th]:p-2 text-left [&_td]:border [&_td]:border-black/10 [&_td]:p-2 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-all">
                  {typeof (selectedArticle.content || selectedArticle.raw_content) === 'string' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedArticle.content || selectedArticle.raw_content}</ReactMarkdown>
                  ) : (
                    <p className="text-gray-500 italic">本文が空です</p>
                  )}
                </div>

                {/* 生字幕/文字起こしテキストがある場合の折りたたみ表示 */}
                {selectedArticle.raw_content && selectedArticle.content && selectedArticle.raw_content !== selectedArticle.content && (
                  <details className="mt-6 border border-stone-200 rounded-2xl bg-stone-50/60 p-4 text-xs">
                    <summary className="font-bold text-stone-600 cursor-pointer hover:text-stone-900 select-none">
                      📄 元の動画字幕 / 生文字起こしテキストを確認（{selectedArticle.raw_content.length}文字）
                    </summary>
                    <div className="mt-3 p-3 bg-white border border-stone-200 rounded-xl max-h-60 overflow-y-auto font-mono text-[11px] text-stone-600 whitespace-pre-wrap leading-relaxed">
                      {selectedArticle.raw_content}
                    </div>
                  </details>
                )}
              </div>
            )}

            {!editing && !selectedArticle.is_atomic && (() => {
              // この記事(container)から登録時に分割抽出された、原子的な知見(Zettelkasten方式)。
              const childInsights = articles.filter((a) => String(a.parent_id) === String(selectedArticle.id));
              if (childInsights.length === 0) return null;
              return (
                <div className="mt-8 pt-6 border-t border-black/10">
                  <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                    🧩 この記事から抽出された知見（{childInsights.length}件）
                  </h3>
                  <div className="space-y-2">
                    {childInsights.map((a) => (
                      <div key={a.id} className="px-3 py-2.5 rounded-xl bg-black/5 border border-black/10 text-sm">
                        <div className="font-bold text-gray-900 mb-1">{a.title}</div>
                        <div className="text-gray-600 text-xs leading-relaxed">{a.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {!editing && selectedArticle.author && (() => {
              // 新たにプロフィールを巡回して取得するのではなく、既にライブラリに
              // 登録済みの記事の中から同じ投稿者(author: "x:handle" / "note:username")
              // のものだけを紐づけて表示する(2026-08-12)。
              const sameAuthorArticles = articles.filter(
                (a) => a.author === selectedArticle.author && String(a.id) !== String(selectedArticle.id)
              );
              if (sameAuthorArticles.length === 0) return null;
              return (
                <div className="mt-8 pt-6 border-t border-black/10">
                  <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                    📌 同じ投稿者の他の記事（{sameAuthorArticles.length}件）
                  </h3>
                  <div className="space-y-2">
                    {sameAuthorArticles.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedArticle(a)}
                        className="w-full text-left px-3 py-2 rounded-xl glass-panel glass-panel-hover text-sm text-gray-700 hover:text-gray-900 truncate"
                      >
                        {a.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {!editing && <ArticleRevisionHistory articleId={selectedArticle.id} />}
          </div>
        </div>
      </motion.div>
      {mergePreview && (
        <LibraryMergePreviewModal
          key={mergePreview.articleId}
          previews={mergePreview.previews}
          trendAnalyses={mergePreview.trendAnalyses}
          matchupInsights={mergePreview.matchupInsights}
          laneGeneralInsights={mergePreview.laneGeneralInsights}
          detectedLane={mergePreview.detectedLane}
          currentChampions={mergePreview.editChampions}
          articleTitle={mergePreview.title}
          articleContent={mergePreview.content}
          sourceUrl={mergePreview.sourceUrl}
          saving={mergeConfirmSaving}
          reAnalyzing={reAnalyzing}
          continuousReview={reviewQueue.length > 0 ? {
            currentIndex: reviewIndex,
            totalCount: reviewQueue.length,
            onSkipNext: advanceReviewQueue,
            onConfirmAndNext: (opts) => confirmMergeToChampionDict({ ...opts, andNext: true }),
          } : undefined}
          onReAnalyze={handleReAnalyzeFromModal}
          onConfirm={(opts) => confirmMergeToChampionDict({ ...opts, andNext: false })}
          onCancel={() => {
            setMergePreview(null);
            setReviewQueue([]);
          }}
        />
      )}
      </>
    );
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 flex items-center gap-4">
          <Book className="text-violet-700" size={36} /> <span className="text-gradient text-gradient-purple">攻略ライブラリ</span>
        </h1>
        <p className="text-violet-700 font-medium text-glow flex items-center gap-2">
          <Activity size={18} className="animate-pulse" /> AI生成済みの攻略記事データベース
        </p>
      </motion.header>



      {/* 統計サマリー & タグクラウド */}
      {articles.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 総記事数とチャンピオン統計 */}
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between border-t-2 border-violet-400">
            <div>
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">📊 ライブラリ統計</h4>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-black text-gray-900">{statsSummary.total}</span>
                <span className="text-sm text-gray-500 font-bold">総記事数</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-black/10 space-y-2">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">主要チャンピオン</span>
              <div className="flex flex-wrap gap-2">
                {statsSummary.champs.map(([champ, count]) => (
                  <button
                    key={champ}
                    onClick={() => setSearch(champ)}
                    className="text-xs bg-black/5 border border-black/10 hover:border-violet-300 hover:bg-violet-50 text-gray-700 font-bold px-2.5 py-1 rounded-lg transition-all"
                  >
                    {champ} ({count})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* よく使われるキーワード (タグクラウド) */}
          <div className="glass-panel p-6 rounded-2xl md:col-span-2 border-t-2 border-cyan-300 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">🎯 トレンドキーワード</h4>
              <div className="flex flex-wrap gap-2">
                {statsSummary.keywords.length > 0 ? statsSummary.keywords.map(([kw, count]) => (
                  <button
                    key={kw}
                    onClick={() => setSearch(kw)}
                    className="text-xs bg-black/5 hover:bg-cyan-100 border border-black/10 hover:border-cyan-200 text-gray-700 hover:text-cyan-600 px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5"
                  >
                    <span># {kw}</span>
                    <span className="text-[10px] text-gray-500 font-mono bg-black/5 px-1.5 py-0.5 rounded-md">{count}</span>
                  </button>
                )) : (
                  <span className="text-sm text-gray-500 italic">タグデータがありません</span>
                )}
              </div>
            </div>
            <div className="text-[10px] text-gray-500 font-bold mt-4 pt-2">
              ※ タグをクリックすると、そのキーワードでライブラリを瞬時にフィルタリングできます。
            </div>
          </div>
        </motion.div>
      )}



      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 w-full sm:min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-700" size={20} />
          <input type="text" placeholder="キーワード、チャンピオン名で検索..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full glass-panel border-2 border-transparent focus:border-violet-400 rounded-2xl py-4 pl-12 pr-4 text-gray-900 font-bold outline-none transition-colors shadow-lg" />
          {search && (
            <button type="button" onClick={() => setSearch('')} title="検索条件をクリア"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 text-sm font-black">
              ✕
            </button>
          )}
        </div>
        
        <div className="flex gap-2 sm:gap-3 flex-wrap w-full sm:w-auto items-center">
          {/* 連続レビュー（案A）開始ボタン */}
          {!showMoved && filteredArticles.length > 0 && (
            <button
              onClick={() => startContinuousReview(filteredArticles, 0)}
              disabled={batchMerging || syncingAll}
              title="未処理記事を1件ずつプレビュー確認しながらサクサク連続で統合・振り分けします"
              className="px-3 sm:px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-black transition-all shadow-md shadow-amber-600/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Zap size={14} /> ⚡ 連続レビュー開始
            </button>
          )}

          {/* 全選択 / 選択解除 */}
          {!showMoved && filteredArticles.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="px-3 sm:px-4 py-2.5 glass-panel glass-panel-hover text-xs font-bold text-stone-700 rounded-2xl transition-all"
            >
              {selectedIds.size === filteredArticles.length && filteredArticles.length > 0
                ? '選択を全解除'
                : `すべて選択 (${selectedIds.size}/${filteredArticles.length})`}
            </button>
          )}

          {/* 辞典へ移動した記事の閲覧・復元（誤移動のリカバリ用） */}
          <button
            onClick={() => { setShowMoved(v => !v); setSelectedArticle(null); setSelectedIds(new Set()); }}
            title="辞典へ移動してライブラリから消えた記事を表示し、必要なら元に戻せます"
            className={`px-3 sm:px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border flex-1 sm:flex-none text-center ${
              showMoved
                ? 'bg-amber-500 text-black border-amber-400'
                : 'glass-panel glass-panel-hover text-amber-700 border-transparent'
            }`}
          >
            🗄️ {showMoved ? 'ライブラリに戻る' : `移動済み${movedCount > 0 ? ` (${movedCount})` : ''}`}
          </button>
          <button
            onClick={expandAllGroups}
            className="px-3 sm:px-4 py-2.5 glass-panel glass-panel-hover text-xs font-bold text-violet-700 rounded-2xl transition-all flex-1 sm:flex-none text-center"
          >
            すべて展開
          </button>
          <button 
            onClick={collapseAllGroups} 
            className="px-3 sm:px-4 py-2.5 glass-panel glass-panel-hover text-xs font-bold text-violet-700 rounded-2xl transition-all flex-1 sm:flex-none text-center"
          >
            すべて閉じる
          </button>
          <button
            onClick={handleSyncAllArticles}
            disabled={syncingAll || batchMerging}
            className="px-3 sm:px-4 py-2.5 bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white text-xs font-bold rounded-2xl transition-all shadow-[0_0_15px_rgba(244,63,94,0.15)] flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            <RefreshCw className={`h-3 w-3 ${syncingAll ? 'animate-spin' : ''}`} />
            {syncingAll && syncProgress
              ? (syncProgress.total > 0 ? `同期中... (${syncProgress.processed}/${syncProgress.total}件)` : "同期準備中...")
              : "全チャンプ辞典に一括同期"}
          </button>
          {syncingAll && syncProgress && syncProgress.total > 0 && (
            <div className="w-full basis-full h-1.5 bg-black/5 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((syncProgress.processed / syncProgress.total) * 100))}%` }}
              />
            </div>
          )}

          {/* スマート一括統合のプログレスバー */}
          {batchMerging && batchProgress && (
            <div className="w-full basis-full p-3 bg-amber-50 border border-amber-300 rounded-2xl space-y-1.5 mt-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                <span className="flex items-center gap-1.5">
                  <RefreshCw size={13} className="animate-spin text-amber-600" />
                  <span>AIスマート一括統合を実行中... ({batchProgress.current} / {batchProgress.total}件完了)</span>
                </span>
                <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-amber-200/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((batchProgress.current / batchProgress.total) * 100))}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex glass-panel p-1 rounded-2xl items-center flex-1 sm:flex-none justify-center">
            <button onClick={() => setGroupMode('champion')} className={`flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${groupMode === 'champion' ? 'bg-violet-400 text-black shadow-lg shadow-violet-400/20' : 'text-gray-500 hover:text-gray-900'}`}>チャンピオン別</button>
            <button onClick={() => setGroupMode('keyword')} className={`flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${groupMode === 'keyword' ? 'bg-violet-400 text-black shadow-lg shadow-violet-400/20' : 'text-gray-500 hover:text-gray-900'}`}>キーワード別</button>
          </div>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="glass-panel rounded-2xl px-4 py-2.5 font-bold text-violet-700 outline-none w-full sm:w-auto min-w-0 sm:min-w-[160px] appearance-none cursor-pointer text-center text-xs sm:text-sm">
            <option value="updated_desc">更新日が新しい順</option>
            <option value="updated_asc">更新日が古い順</option>
            <option value="name_asc">名前順</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20"><div className="w-8 h-8 border-4 border-[#a78bfa] border-t-transparent rounded-full animate-spin"></div></div>
      ) : grouped.length > 0 ? (
        <div className="space-y-6">
          {grouped.slice(0, visibleGroupsCount).map(([groupName, items]) => {
            const isCollapsed = collapsedGroups[groupName] === undefined ? false : collapsedGroups[groupName];
            return (
              <div key={groupName} className="glass-panel rounded-2xl overflow-hidden group">
                <div className="w-full flex items-center justify-between p-4 sm:p-5 bg-black/2 hover:bg-black/5 transition-colors border-b border-black/10 flex-wrap sm:flex-nowrap gap-3">
                  <button onClick={() => toggleGroup(groupName)} className="flex items-center gap-3 text-left flex-1 min-w-0">
                    <span className="text-violet-700 transition-transform duration-300 shrink-0" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)' }}><ChevronDown size={20} /></span>
                    <span className="bg-violet-100 text-violet-700 border border-violet-300 px-3 sm:px-4 py-1.5 rounded-lg font-black font-mono tracking-wider shadow-[0_0_10px_rgba(167,139,250,0.1)] text-xs sm:text-sm break-all">{groupName}</span>
                    <span className="text-gray-500 text-xs sm:text-sm font-bold">({items.length} 記事)</span>
                  </button>

                  {!showMoved && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => startContinuousReview(items, 0)}
                        className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1"
                        title="このグループ内の記事を順番に連続レビューします"
                      >
                        <Zap size={12} /> 連続レビュー
                      </button>
                      <button
                        onClick={(e) => toggleSelectGroup(items, e)}
                        className="text-xs font-bold text-stone-600 bg-black/5 hover:bg-black/10 border border-black/10 px-2.5 py-1.5 rounded-xl transition"
                      >
                        {items.every(a => selectedIds.has(a.id)) ? 'グループ解除' : 'グループ全選択'}
                      </button>
                    </div>
                  )}
                </div>

                <div 
                  className="transition-all duration-300 ease-in-out overflow-hidden" 
                  style={{ 
                    maxHeight: isCollapsed ? '0px' : '9999px',
                    opacity: isCollapsed ? 0 : 1 
                  }}
                >
                  {!isCollapsed && (
                    <div className="divide-y divide-white/5">
                      {items.map(article => {
                        const isExpanded = expandedId === article.id;
                        const isSelected = selectedIds.has(article.id);
                        return (
                          <div key={article.id} className={`transition-colors ${isSelected ? 'bg-amber-500/5' : ''}`}>
                            {/* 記事ヘッダー（クリックでアコーディオン展開） */}
                            <div
                              onClick={() => setExpandedId(isExpanded ? null : article.id)}
                              className="p-4 sm:p-5 hover:bg-black/2 cursor-pointer flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 group/item"
                            >
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                {!showMoved && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => toggleSelect(article.id, e as any)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-1 sm:mt-1.5 h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0 accent-amber-600"
                                  />
                                )}
                                <div className="flex flex-col gap-2 min-w-0 flex-1">
                                  <div className="flex items-start sm:items-center gap-2">
                                    <span className={`text-violet-700 transition-transform duration-300 shrink-0 mt-0.5 sm:mt-0 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
                                      <ChevronDown size={16} />
                                    </span>
                                    <h3 className={`font-bold transition-colors flex items-start sm:items-center gap-2 min-w-0 text-sm sm:text-base ${isExpanded ? 'text-violet-700' : 'text-stone-800 group-hover/item:text-violet-700'}`}>
                                      {favoriteArticles.includes(article.id) && <StarIcon size={14} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" fill="currentColor" />}
                                      <span className="break-all">{article.title ? article.title.replace(/_/g, ' ') : ''}</span>
                                    </h3>
                                  </div>
                                  <div className="flex gap-1.5 flex-wrap pl-6">
                                    {article.tags && Array.isArray(article.tags) && article.tags.map((kw: string, kidx: number) => (
                                      <span key={kidx} className="text-[10px] text-stone-500 bg-black/5 border border-black/10 px-2 py-0.5 rounded-md break-all">{kw}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-4 pl-6 sm:pl-0 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/10">
                                <div className="text-xs text-gray-500 font-mono flex items-center gap-2"><Clock size={14} className="text-violet-700/50" /> {isMounted && article.created_at ? new Date(article.created_at).toLocaleDateString('ja-JP') : '日付不明'}</div>
                                <button onClick={(e) => deleteArticle(article.id, e)} className="text-stone-500 hover:text-red-600 hover:bg-red-100 transition-all p-2 rounded-lg" title="削除"><Trash2 size={16} /></button>
                              </div>
                            </div>
                            {/* アコーディオン展開エリア（プレビュー + 操作ボタン） */}
                            <div
                              className="overflow-hidden transition-all duration-300 ease-in-out"
                              style={{ maxHeight: isExpanded ? '1000px' : '0px', opacity: isExpanded ? 1 : 0 }}
                            >
                              {isExpanded && (
                                <div className="px-3 sm:px-5 pb-5 ml-2 sm:ml-6 border-l-2 border-violet-200">
                                  {/* Markdownプレビュー */}
                                  <div className="prose prose-purple prose-sm max-w-none max-h-[400px] overflow-y-auto p-4 bg-black/5 border border-black/10 rounded-xl text-sm leading-relaxed mb-4 scrollbar-thin">
                                    {typeof (article.content || article.raw_content) === 'string' ? (
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content || article.raw_content}</ReactMarkdown>
                                  ) : (
                                    <p className="text-gray-500 italic">本文が空です</p>
                                  )}
                                </div>
                                {/* 操作ボタン群 */}
                                <div className="flex gap-3 flex-wrap">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedArticle(article); }}
                                    className="px-4 py-2 glass-panel glass-panel-hover text-violet-700 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                                  >
                                    <Eye size={14} /> 全文を読む
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedArticle(article);
                                      // 編集モードに直接切り替え
                                      setEditContent(article.content || article.raw_content || '');
                                      setEditTitle(article.title || '');
                                      const rawChamp = article.champion || '';
                                      setEditChampions(rawChamp.split(',').map((c: string) => c.trim()).filter((c: string) => c && c.toLowerCase() !== 'unknown'));
                                      setChampInput('');
                                      setEditKeywords(Array.isArray(article.tags) ? article.tags.join(', ') : '');
                                      setEditing(true);
                                    }}
                                    className="px-4 py-2 glass-panel glass-panel-hover text-[#c89b3c] rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                                  >
                                    <Edit2 size={14} /> 編集する
                                  </button>
                                  {article.source_url && (
                                    <button
                                      onClick={(e) => handleReAnalyzeArticle(article, e)}
                                      disabled={reAnalyzeId === article.id}
                                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-purple-500/20 disabled:opacity-50"
                                      title="元URLから画像・動画を含めて最新AI再解析します"
                                    >
                                      <RefreshCw size={14} className={reAnalyzeId === article.id ? "animate-spin" : ""} />
                                      {reAnalyzeId === article.id ? "再解析中..." : "✨ AI再解析"}
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleFavorite(article.id, article.title || '');
                                    }}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border ${
                                      favoriteArticles.includes(article.id)
                                        ? 'bg-amber-100 border-amber-300 text-amber-700'
                                        : 'glass-panel text-stone-500 hover:text-stone-900 border-transparent'
                                    }`}
                                  >
                                    <StarIcon size={14} fill={favoriteArticles.includes(article.id) ? "currentColor" : "none"} />
                                    {favoriteArticles.includes(article.id) ? 'お気に入り解除' : 'お気に入り'}
                                  </button>
                                </div>

                                {/* この記事がレーン別ガイド・辞典へ統合された変化履歴 */}
                                <ArticleRevisionHistory articleId={article.id} />
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {grouped.length > visibleGroupsCount && (
            <div className="flex justify-center pt-6">
              <button 
                onClick={() => setVisibleGroupsCount(prev => prev + 20)}
                className="px-6 py-3 bg-violet-400 text-black hover:-translate-y-0.5 shadow-lg shadow-violet-400/20 rounded-xl text-sm font-black transition-all"
              >
                もっとグループを読み込む (残り {grouped.length - visibleGroupsCount} グループ)
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="py-24 text-center glass-panel rounded-2xl flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mb-4">
            <Book size={32} className="text-violet-700" />
          </div>
          <h3 className="text-xl font-bold text-stone-900 mb-2">{search ? `「${search}」に一致する記事なし` : 'まだ記事がありません'}</h3>
        </div>
      )}
      {/* 複数選択時のフローティングアクションバー */}
      {selectedIds.size > 0 && !showMoved && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-fade-in-up w-full max-w-2xl px-4">
          <div className="bg-stone-900/95 text-white border border-amber-500/40 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-md flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-3">
              <span className="bg-amber-500 text-black text-xs font-black px-2.5 py-1 rounded-full font-mono">
                {selectedIds.size} 件選択中
              </span>
              <span className="text-xs text-stone-300 hidden sm:inline">
                辞典とレーンガイドへ自動仕分け
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={batchMerging}
                className="px-3 py-2 text-xs font-bold text-stone-400 hover:text-white rounded-xl hover:bg-white/10 transition disabled:opacity-50"
              >
                選択解除
              </button>

              <button
                type="button"
                onClick={() => startContinuousReview(articles.filter(a => selectedIds.has(a.id)), 0)}
                disabled={batchMerging}
                className="px-4 py-2 text-xs font-bold bg-stone-700 hover:bg-stone-600 text-stone-100 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                title="選択した記事だけを順番に連続プレビュー確認します"
              >
                <Zap size={13} className="text-amber-400" />
                <span>選択分を連続レビュー</span>
              </button>

              <button
                type="button"
                onClick={() => handleBatchSmartMerge()}
                disabled={batchMerging}
                className="px-5 py-2.5 text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                {batchMerging ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>統合中...</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    <span>⚡ 選択した{selectedIds.size}件をスマート統合</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* トースト通知 */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
          <div className={`glass-panel p-4 rounded-2xl border flex items-center gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${
            toast.type === 'success' ? 'border-cyan-300 text-cyan-600 bg-cyan-100' :
            toast.type === 'error' ? 'border-red-300 text-red-700 bg-red-100' : 'border-violet-400 text-violet-700 bg-violet-100'
          }`}>
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

import { Suspense } from 'react';

export default function LibraryTabContent() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center py-20"><div className="w-8 h-8 border-4 border-[#a78bfa] border-t-transparent rounded-full animate-spin"></div></div>}>
      <LibraryTabContentInner />
    </Suspense>
  );
}
