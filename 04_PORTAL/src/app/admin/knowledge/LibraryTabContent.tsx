"use client";

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { Book, ChevronLeft, ChevronDown, ChevronUp, Clock, User, Sparkles, Pencil, Save, X, Trash2, Search, Terminal, Activity, Eye, Edit2, Star as StarIcon, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';

import ChampSelect from '../../../components/ChampSelect';
import { getFavorites, toggleFavoriteArticle } from '../../../components/FavoritesPanel';
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
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ processed: number; total: number; synced: number } | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [groupMode, setGroupMode] = useState<'champion' | 'keyword'>('champion');
  const [sortOrder, setSortOrder] = useState('updated_desc');
  // アコーディオンプレビュー用（1つだけ展開）
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [favoriteArticles, setFavoriteArticles] = useState<number[]>([]);
  const [visibleGroupsCount, setVisibleGroupsCount] = useState(20);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    message: '',
    type: 'success',
  });
  


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

  /** 移動済み記事をライブラリへ復元する（__DELETED__ タグを外す） */
  const restoreArticle = async (id: any) => {
    if (!confirm('この記事をライブラリに戻しますか？')) return;
    try {
      const { error } = await supabase.from('personal_knowledge').update({ tags: [] }).eq('id', id);
      if (error) throw error;
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
        .select('id, created_at, title, content, raw_content, source_url, genre, tags, champion')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (!error && data) {
        const isDeleted = (a: any) => a.tags && a.tags.includes('__DELETED__');
        // 通常は移動済み(__DELETED__)を除外。「移動済みを表示」時は移動済みのみを出す。
        const validData = data.filter((a: any) => a && a.title && (showMoved ? isDeleted(a) : !isDeleted(a)));
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

  const grouped = useMemo(() => {
    const q = (debouncedSearch || '').toLowerCase();
    const filtered = articles.filter(a => {
      if (!a) return false;
      const titleMatch = a.title ? a.title.toLowerCase().includes(q) : false;
      const champMatch = a.champion ? a.champion.toLowerCase().includes(q) : false;
      const tagsMatch = (a.tags && Array.isArray(a.tags))
        ? a.tags.some((k: any) => k && typeof k === 'string' && k.toLowerCase().includes(q))
        : false;
      return titleMatch || champMatch || tagsMatch;
    });

    const groups: Record<string, any[]> = {};
    if (groupMode === 'champion') {
      filtered.forEach(a => {
        const key = a.champion || 'その他';
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
      });
    } else {
      filtered.forEach(a => {
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
    setEditContent(selectedArticle.raw_content || selectedArticle.content || ''); 
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
    if (!supabase) return;
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

  const saveArticle = async () => {
    if (!supabase) {
      showToast('エラー: Supabase接続が無効なため保存できません。', 'error');
      return;
    }
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
    const fakeChampions = ["", "Unknown", "その他", "[YouTube]", "YouTube", "Jungle", "jg", "lol", "ARTICLE", "draft", "SYSTEM", "LIVE", "GLOBAL", "test", "sns", "macro"];
    const validChampions = editChampions.filter(c => c.trim() && !fakeChampions.includes(c.trim()) && !fakeChampions.includes(c.trim().toLowerCase()));

    if (validChampions.length > 0) {
      try {
        // マージヘルパー
        const mergeContent = (existingText: string, newText: string, title: string) => {
            const ext = existingText || "";
            if (!ext.trim()) return newText;
            if (newText.trim() === ext.trim()) return ext;
            const header = `## 【記事】${title}`;
            if (ext.includes(header)) {
                const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = new RegExp(`## 【記事】${escapeRegExp(title)}\\s*\\n[\\s\\S]*?(?=\\n---|$)`);
                const newContent = ext.replace(pattern, `${header}\n\n${newText}`);
                if (newContent !== ext) return newContent;
            }
            if (ext.includes(newText)) return ext;
            return `${ext}\n\n---\n\n${header}\n\n${newText}`;
        };

        // 全チャンピオンに対してループ統合
        for (const championName of validChampions) {
          const matchupId = `champ_${championName}_global`;
          const { data: existingData } = await supabase
            .from('matchup_sentinel')
            .select('*')
            .eq('matchup_id', matchupId)
            .maybeSingle();
            
          let rawData = existingData?.raw_data || {};
          let customFields = rawData.customFields || {};
          
          if (editTitle.includes("HONKI_BIBLE") || editTitle.includes("ARTICLE")) {
              rawData.note_draft = mergeContent(rawData.note_draft || "", editContent, editTitle);
          } else {
              const fieldName = editTitle.replace(`${championName}_`, "").replace(`_${championName}`, "");
              customFields[fieldName] = mergeContent(customFields[fieldName] || "", editContent, editTitle);
          }
          rawData.customFields = customFields;
          rawData.source = "champ_db";
          rawData.role = "GLOBAL";
          
          const dictData = {
              matchup_id: matchupId,
              champion: championName,
              enemy: "GLOBAL",
              title: existingData?.title || `${championName} 基本戦略・トレンド`,
              strategy: existingData?.strategy || "",
              raw_data: rawData
          };
          
          const { error: upsertError } = await supabase
              .from('matchup_sentinel')
              .upsert(dictData, { onConflict: 'matchup_id' });
          if (upsertError) throw upsertError;
        }

        // 段階2 dual-write: 構造化テーブル champion_notes にも同じ記事を1行追加する（#29）。
        // ブラウザ(anon)はRLSで直接書けないためサーバーAPI経由。失敗しても本筋は止めない。
        try {
          await fetch('/api/admin/champion-notes/add', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              champions: validChampions,
              title: editTitle,
              body: editContent,
              source: 'article',
              source_article_id: selectedArticle.id,
            }),
          });
        } catch (dualErr) {
          console.warn('champion_notesへのdual-write失敗（辞典統合自体は成功）:', dualErr);
        }

        // 構造化項目（強み/弱み/パワースパイク/ビルド）も記事の内容でマージ更新する。
        // 上書きではなく「既存に無い知見だけ追記」なので、手書きの内容は消えない。
        let mergedNote = '';
        try {
          const mergeRes = await fetch('/api/admin/champion-facts/merge', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ champions: validChampions, title: editTitle, body: editContent }),
          });
          const mergeData = await mergeRes.json();
          if (mergeRes.ok) {
            const added = (mergeData.results || []).flatMap((r: any) => r.added || []);
            if (added.length > 0) mergedNote = `／辞典項目に${added.length}件を追記`;
          }
        } catch (mergeErr) {
          console.warn('champion_factsのマージ更新に失敗（辞典統合自体は成功）:', mergeErr);
        }

        // ライブラリから削除
        const { error: deleteError } = await supabase
            .from('personal_knowledge')
            .update({ tags: ['__DELETED__'] })
            .eq('id', selectedArticle.id);
        if (deleteError) throw deleteError;
        
        const champLabel = validChampions.length > 1 ? `${validChampions.join(', ')} (${validChampions.length}体)` : validChampions[0];
        showToast(`【統合完了】${champLabel} のチャンピオン辞典にマージ${mergedNote}し、ライブラリから削除しました！`, 'success');
        setArticles(prev => prev.filter(a => String(a.id) !== String(selectedArticle.id)));
        setSelectedArticle(null);
        setEditing(false);
        setSaving(false);
        return;
        
      } catch (err: any) {
        showToast('辞典への統合中にエラーが発生しました: ' + err.message, 'error');
        setSaving(false);
        return;
      }
    }

    // --- 汎用記事として保存（チャンピオン指定なし）---
    const { error } = await supabase.from('personal_knowledge').update(updateData).eq('id', selectedArticle.id);
    if (!error) {
      const updated = { ...selectedArticle, ...updateData };
      setSelectedArticle(updated);
      setArticles(prev => prev.map(a => a.id === selectedArticle.id ? updated : a));
      setEditing(false);
    } else { showToast('保存失敗: ' + error.message, 'error'); }
    setSaving(false);
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

    if (!supabase) {
      showToast('エラー: Supabase接続が無効なため削除できません。', 'error');
      return;
    }
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
        ({ error } = await supabase.from('personal_knowledge').update({ tags: ['__DELETED__'] }).eq('id', id));
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

  const copyPublishCommand = (championName: string) => {
    const cmd = `py d:\\my_work\\03_SYSTEMS\\TOOLS\\publish_local_article.py "${championName}"`;
    navigator.clipboard.writeText(cmd);
    showToast('コマンドをコピーしました！', 'success');
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  if (selectedArticle) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 md:p-12 max-w-5xl mx-auto flex flex-col gap-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <button onClick={() => { setSelectedArticle(null); setEditing(false); }} className="flex items-center gap-2 text-[#a78bfa] font-bold hover:text-white transition-colors">
            <ChevronLeft size={18} /> 一覧へ戻る
          </button>
          <div className="flex gap-2 flex-wrap">
            {!editing ? (
              <button onClick={startEditing} className="px-4 py-2 glass-panel glass-panel-hover text-[#a78bfa] rounded-xl text-sm font-bold flex items-center gap-2"><Pencil size={14} /> 編集する</button>
            ) : (
              <>
                <button onClick={cancelEditing} className="px-4 py-2 glass-panel text-gray-400 hover:text-white rounded-xl text-sm font-bold flex items-center gap-2"><X size={14} /> キャンセル</button>
                <button onClick={saveArticle} disabled={saving} className="px-4 py-2 bg-white text-black hover:-translate-y-0.5 shadow-lg shadow-white/20 rounded-xl text-sm font-black flex items-center gap-2 transition-all"><Save size={14} /> {saving ? '保存中...' : '保存する'}</button>
              </>
            )}
            <button onClick={() => copyPublishCommand(selectedArticle.champion || selectedArticle.title?.split(' ')[0] || '')} className="px-4 py-2 glass-panel glass-panel-hover text-[#00cfef] rounded-xl text-sm font-bold flex items-center gap-2"><Terminal size={14} /> 投稿コマンドをコピー</button>
            <button onClick={(e) => deleteArticle(selectedArticle.id, e)} className="px-4 py-2 glass-panel glass-panel-hover text-red-400 rounded-xl text-sm font-bold flex items-center gap-2"><Trash2 size={14} /> 削除</button>
          </div>
        </div>

        <div className="glass-panel rounded-3xl overflow-hidden relative group">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#a78bfa]/10 rounded-full blur-3xl"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#a78bfa] to-[#c89b3c]"></div>
          <div className="p-10 relative z-10">
            <header className="mb-10 pb-8 border-b border-white/10">
              <div className="flex items-center gap-2 text-[#a78bfa] font-mono text-xs mb-4 tracking-[0.15em] uppercase font-black"><Sparkles size={14} /> 攻略記事</div>
              {editing ? (
                <div className="flex flex-col gap-4 mb-6">
                  <div>
                    <label className="text-xs text-[#a78bfa] font-bold">タイトル</label>
                    <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full bg-black/50 border border-[#a78bfa]/30 rounded-xl p-3 text-2xl font-bold text-white outline-none focus:border-[#a78bfa]/60 transition-colors" />
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-xs text-[#a78bfa] font-bold">チャンピオン（複数選択可）</label>
                      {/* 選択済みタグ */}
                      {editChampions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {editChampions.map(c => (
                            <span key={c} className="flex items-center gap-1 px-2.5 py-1 bg-[#a78bfa]/20 border border-[#a78bfa]/40 rounded-full text-xs font-bold text-[#a78bfa]">
                              {c}
                              <button onClick={() => setEditChampions(prev => prev.filter(x => x !== c))} className="hover:text-white transition-colors ml-0.5"><X size={10} /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      {/* サジェスト付き入力 */}
                      <ChampSelect
                        value={champInput}
                        onChange={v => setChampInput(v)}
                        placeholder={editChampions.length === 0 ? "未設定の場合は「その他」になります" : "追加するチャンピオン名..."}
                        className="bg-black/50 border-[#a78bfa]/30 focus:border-[#a78bfa]/60"
                        onSelect={(champ: string) => {
                          if (champ && !editChampions.includes(champ)) {
                            setEditChampions(prev => [...prev, champ]);
                          }
                          setChampInput('');
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-xs text-[#a78bfa] font-bold">キーワード (カンマ区切り)</label>
                      <input type="text" value={editKeywords} onChange={e => setEditKeywords(e.target.value)} className="w-full bg-black/50 border border-[#a78bfa]/30 rounded-xl p-3 text-sm text-white outline-none focus:border-[#a78bfa]/60 transition-colors" placeholder="例: マクロ, 序盤, カウンター" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 mb-6">
                  <h1 className="text-4xl md:text-5xl font-black leading-tight font-mono text-white flex-1">{selectedArticle.title ? selectedArticle.title.replace(/_/g, ' ') : ''}</h1>
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
                        ? 'bg-amber-400/20 border-amber-400 text-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={favoriteArticles.includes(selectedArticle.id) ? "お気に入り解除" : "お気に入り登録"}
                  >
                    <StarIcon size={20} fill={favoriteArticles.includes(selectedArticle.id) ? "currentColor" : "none"} />
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full font-bold uppercase tracking-widest border border-white/5"><User size={14} className="text-[#a78bfa]" /> AI AGENT</span>
                <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full font-bold uppercase tracking-widest border border-white/5"><Clock size={14} className="text-[#a78bfa]" /> {isMounted && selectedArticle.created_at ? new Date(selectedArticle.created_at).toLocaleString('ja-JP') : '日付不明'}</span>
              </div>
            </header>

            {editing ? (
              <div className="flex flex-col gap-4">
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full min-h-[600px] p-6 bg-black/50 border border-[#a78bfa]/30 rounded-2xl text-sm leading-loose font-mono outline-none focus:border-[#a78bfa]/60 shadow-inner text-gray-200 transition-colors" />
                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                  <button onClick={cancelEditing} className="px-4 py-2 glass-panel text-gray-400 hover:text-white rounded-xl text-sm font-bold flex items-center gap-2"><X size={14} /> キャンセル</button>
                  <button onClick={saveArticle} disabled={saving} className="px-4 py-2 bg-white text-black hover:-translate-y-0.5 shadow-lg shadow-white/20 rounded-xl text-sm font-black flex items-center gap-2 transition-all"><Save size={14} /> {saving ? '保存中...' : '保存する'}</button>
                </div>
              </div>
            ) : (
              <div className="prose prose-invert prose-purple max-w-none text-[15px] leading-loose text-gray-300">
                {typeof (selectedArticle.raw_content || selectedArticle.content) === 'string' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedArticle.raw_content || selectedArticle.content}</ReactMarkdown>
                ) : (
                  <p className="text-gray-500 italic">本文が空です</p>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 flex items-center gap-4">
          <Book className="text-[#a78bfa]" size={36} /> <span className="text-gradient text-gradient-purple">攻略ライブラリ</span>
        </h1>
        <p className="text-[#a78bfa] font-medium text-glow flex items-center gap-2">
          <Activity size={18} className="animate-pulse" /> AI生成済みの攻略記事データベース
        </p>
      </motion.header>



      {/* 統計サマリー & タグクラウド */}
      {articles.length > 0 && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 総記事数とチャンピオン統計 */}
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between border-t-2 border-[#a78bfa]/50">
            <div>
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">📊 ライブラリ統計</h4>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-black text-white">{statsSummary.total}</span>
                <span className="text-sm text-gray-500 font-bold">総記事数</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">主要チャンピオン</span>
              <div className="flex flex-wrap gap-2">
                {statsSummary.champs.map(([champ, count]) => (
                  <button 
                    key={champ} 
                    onClick={() => setSearch(champ)}
                    className="text-xs bg-white/5 border border-white/5 hover:border-[#a78bfa]/30 hover:bg-[#a78bfa]/5 text-gray-300 font-bold px-2.5 py-1 rounded-lg transition-all"
                  >
                    {champ} ({count})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* よく使われるキーワード (タグクラウド) */}
          <div className="glass-panel p-6 rounded-2xl md:col-span-2 border-t-2 border-[#00cfef]/50 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">🎯 トレンドキーワード</h4>
              <div className="flex flex-wrap gap-2">
                {statsSummary.keywords.length > 0 ? statsSummary.keywords.map(([kw, count]) => (
                  <button
                    key={kw}
                    onClick={() => setSearch(kw)}
                    className="text-xs bg-black/40 hover:bg-[#00cfef]/10 border border-white/5 hover:border-[#00cfef]/30 text-gray-300 hover:text-[#00cfef] px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5"
                  >
                    <span># {kw}</span>
                    <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-1.5 py-0.5 rounded-md">{count}</span>
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
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a78bfa]" size={20} />
          <input type="text" placeholder="キーワード、チャンピオン名で検索..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full glass-panel border-2 border-transparent focus:border-[#a78bfa]/50 rounded-2xl py-4 pl-12 pr-4 text-white font-bold outline-none transition-colors shadow-lg" />
        </div>
        
        <div className="flex gap-3 flex-wrap">
          {/* 辞典へ移動した記事の閲覧・復元（誤移動のリカバリ用） */}
          <button
            onClick={() => { setShowMoved(v => !v); setSelectedArticle(null); }}
            title="辞典へ移動してライブラリから消えた記事を表示し、必要なら元に戻せます"
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
              showMoved
                ? 'bg-amber-500 text-black border-amber-400'
                : 'glass-panel glass-panel-hover text-amber-300 border-transparent'
            }`}
          >
            🗄️ {showMoved ? 'ライブラリに戻る' : `移動済み${movedCount > 0 ? ` (${movedCount})` : ''}`}
          </button>
          <button
            onClick={expandAllGroups}
            className="px-4 py-2.5 glass-panel glass-panel-hover text-xs font-bold text-[#a78bfa] rounded-2xl transition-all"
          >
            すべて展開
          </button>
          <button 
            onClick={collapseAllGroups} 
            className="px-4 py-2.5 glass-panel glass-panel-hover text-xs font-bold text-[#a78bfa] rounded-2xl transition-all"
          >
            すべて閉じる
          </button>
          <button
            onClick={handleSyncAllArticles}
            disabled={syncingAll}
            className="px-4 py-2.5 bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white text-xs font-bold rounded-2xl transition-all shadow-[0_0_15px_rgba(244,63,94,0.15)] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-3 w-3 ${syncingAll ? 'animate-spin' : ''}`} />
            {syncingAll && syncProgress
              ? (syncProgress.total > 0 ? `同期中... (${syncProgress.processed}/${syncProgress.total}件)` : "同期準備中...")
              : "全チャンプ辞典に一括同期"}
          </button>
          {syncingAll && syncProgress && syncProgress.total > 0 && (
            <div className="w-full basis-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((syncProgress.processed / syncProgress.total) * 100))}%` }}
              />
            </div>
          )}
          <div className="flex glass-panel p-1 rounded-2xl items-center">
            <button onClick={() => setGroupMode('champion')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${groupMode === 'champion' ? 'bg-[#a78bfa] text-black shadow-lg shadow-[#a78bfa]/20' : 'text-gray-400 hover:text-white'}`}>チャンピオン別</button>
            <button onClick={() => setGroupMode('keyword')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${groupMode === 'keyword' ? 'bg-[#a78bfa] text-black shadow-lg shadow-[#a78bfa]/20' : 'text-gray-400 hover:text-white'}`}>キーワード別</button>
          </div>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="glass-panel rounded-2xl px-5 font-bold text-[#a78bfa] outline-none min-w-[160px] appearance-none cursor-pointer text-center">
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
                <button onClick={() => toggleGroup(groupName)} className="w-full flex items-center gap-4 p-5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-left border-b border-white/5">
                  <span className="text-[#a78bfa] transition-transform duration-300" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)' }}><ChevronDown size={20} /></span>
                  <span className="bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/30 px-4 py-1.5 rounded-lg font-black font-mono tracking-wider shadow-[0_0_10px_rgba(167,139,250,0.1)]">{groupName}</span>
                  <span className="text-gray-500 text-sm font-bold">({items.length} 記事)</span>
                </button>

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
                        return (
                          <div key={article.id} className="transition-colors">
                            {/* 記事ヘッダー（クリックでアコーディオン展開） */}
                            <div
                              onClick={() => setExpandedId(isExpanded ? null : article.id)}
                              className="p-5 hover:bg-white/[0.03] cursor-pointer flex justify-between items-center group/item"
                            >
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[#a78bfa] transition-transform duration-300 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
                                    <ChevronDown size={16} />
                                  </span>
                                  <h3 className={`font-bold transition-colors flex items-center gap-2 ${isExpanded ? 'text-[#a78bfa]' : 'text-gray-200 group-hover/item:text-[#a78bfa]'}`}>
                                    {favoriteArticles.includes(article.id) && <StarIcon size={14} className="text-amber-400 shrink-0" fill="currentColor" />}
                                    {article.title ? article.title.replace(/_/g, ' ') : ''}
                                  </h3>
                                </div>
                                <div className="flex gap-2 flex-wrap ml-6">
                                  {article.tags && Array.isArray(article.tags) && article.tags.map((kw: string, kidx: number) => (
                                    <span key={kidx} className="text-[10px] text-gray-400 bg-black/40 border border-white/5 px-2 py-1 rounded-md">{kw}</span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-xs text-gray-500 font-mono flex items-center gap-2"><Clock size={14} className="text-[#a78bfa]/50" /> {isMounted && article.created_at ? new Date(article.created_at).toLocaleDateString('ja-JP') : '日付不明'}</div>
                                <button onClick={(e) => deleteArticle(article.id, e)} className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all p-2 rounded-lg"><Trash2 size={16} /></button>
                              </div>
                            </div>
                            {/* アコーディオン展開エリア（プレビュー + 操作ボタン） */}
                            <div
                              className="overflow-hidden transition-all duration-300 ease-in-out"
                              style={{ maxHeight: isExpanded ? '1000px' : '0px', opacity: isExpanded ? 1 : 0 }}
                            >
                              {isExpanded && (
                                <div className="px-5 pb-5 ml-6 border-l-2 border-[#a78bfa]/20">
                                  {/* Markdownプレビュー */}
                                  <div className="prose prose-invert prose-purple prose-sm max-w-none max-h-[400px] overflow-y-auto p-4 bg-black/30 border border-white/5 rounded-xl text-sm leading-relaxed mb-4 scrollbar-thin">
                                    {typeof (article.raw_content || article.content) === 'string' ? (
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.raw_content || article.content}</ReactMarkdown>
                                  ) : (
                                    <p className="text-gray-500 italic">本文が空です</p>
                                  )}
                                </div>
                                {/* 操作ボタン群 */}
                                <div className="flex gap-3 flex-wrap">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedArticle(article); }}
                                    className="px-4 py-2 glass-panel glass-panel-hover text-[#a78bfa] rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
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
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyPublishCommand(article.champion || article.title?.split(' ')[0] || '');
                                    }}
                                    className="px-4 py-2 glass-panel glass-panel-hover text-[#00cfef] rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                                  >
                                    <Terminal size={14} /> 投稿コマンド
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleFavorite(article.id, article.title || '');
                                    }}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border ${
                                      favoriteArticles.includes(article.id)
                                        ? 'bg-amber-400/20 border-amber-400 text-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.2)]'
                                        : 'glass-panel text-gray-400 hover:text-white border-transparent'
                                    }`}
                                  >
                                    <StarIcon size={14} fill={favoriteArticles.includes(article.id) ? "currentColor" : "none"} />
                                    {favoriteArticles.includes(article.id) ? 'お気に入り解除' : 'お気に入り'}
                                  </button>
                                </div>
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
                className="px-6 py-3 bg-[#a78bfa] text-black hover:-translate-y-0.5 shadow-lg shadow-[#a78bfa]/20 rounded-xl text-sm font-black transition-all"
              >
                もっとグループを読み込む (残り {grouped.length - visibleGroupsCount} グループ)
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="py-24 text-center glass-panel rounded-2xl flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-[#a78bfa]/10 rounded-full flex items-center justify-center mb-4">
            <Book size={32} className="text-[#a78bfa]" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{search ? `「${search}」に一致する記事なし` : 'まだ記事がありません'}</h3>
        </div>
      )}
      {/* トースト通知 */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
          <div className={`glass-panel p-4 rounded-2xl border flex items-center gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${
            toast.type === 'success' ? 'border-[#00cfef]/50 text-[#00cfef] bg-[#00cfef]/10' :
            toast.type === 'error' ? 'border-red-500/50 text-red-400 bg-red-500/10' : 'border-[#a78bfa]/50 text-[#a78bfa] bg-[#a78bfa]/10'
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
