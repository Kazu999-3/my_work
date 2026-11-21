'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw, Trophy, Target, ArrowLeftRight, ShieldAlert, LogIn } from 'lucide-react';
import { toast } from '../../../components/Toaster';
import CustomSubNav from '../../../components/CustomSubNav';
import { useCurrentUser } from '../../../hooks/useCurrentUser';

import { ROLES, type PlayerStat, type PlayerPoolItem, type ChampionItem, type ActiveChampSelector, type Role } from './_parts/types';
import { getOcrAliases, saveOcrAlias, parseDurationText, OCR_ALIAS_STORAGE_KEY } from './_parts/ocrUtils';
import { useOcrImageProcessor } from './_parts/useOcrImageProcessor';
import ChampionSelectorModal from './_parts/ChampionSelectorModal';
import TeamStatsTable from './_parts/TeamStatsTable';
import MatchSummaryControls from './_parts/MatchSummaryControls';

function CustomRecordPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pendingId = searchParams.get('pending_id');
  const { user, loading: userLoading } = useCurrentUser();

  // OCR学習データのクラウド同期
  useEffect(() => {
    fetch('/api/admin/ocr-aliases')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok && data.aliases && typeof data.aliases === 'object') {
          const local = getOcrAliases();
          const merged = { ...local, ...data.aliases };
          localStorage.setItem(OCR_ALIAS_STORAGE_KEY, JSON.stringify(merged));
        }
      })
      .catch(() => {});
  }, []);

  const [playersPool, setPlayersPool] = useState<PlayerPoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' });
  const [winningTeam, setWinningTeam] = useState<'BLUE' | 'RED' | null>(null);
  const [durationText, setDurationText] = useState('');
  const [isFinalMatch, setIsFinalMatch] = useState(false);
  const [championsList, setChampionsList] = useState<ChampionItem[]>([]);
  const championsListRef = useRef(championsList);
  useEffect(() => {
    championsListRef.current = championsList;
  }, [championsList]);

  const [activeChampSelector, setActiveChampSelector] = useState<ActiveChampSelector | null>(null);

  // 10人分のステートを初期化
  const [stats, setStats] = useState<PlayerStat[]>(() => {
    const initial: PlayerStat[] = [];
    (['BLUE', 'RED'] as const).forEach((team) => {
      ROLES.forEach((role) => {
        initial.push({
          name: '',
          team,
          currentRole: role,
          kills: 0,
          deaths: 0,
          assists: 0,
          vision: 0,
          champion_name: '',
          damage_dealt: 0,
          damage_taken: 0,
          heal_shield: 0,
          objective_damage: 0,
          cs: 0,
        });
      });
    });
    return initial;
  });

  // OCR画像解析フック
  const {
    analyzing,
    isDragging,
    handleImageUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useOcrImageProcessor({
    playersPool,
    championsList,
    stats,
    setStats,
    setWinningTeam,
    setDurationText,
    setMessage,
  });

  // クリップボードからの画像貼り付け (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageUpload(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [playersPool, championsList, handleImageUpload]);

  // スタッツ値変更ハンドラ
  const handleStatChangeByIndex = (index: number, field: keyof PlayerStat, value: string) => {
    setStats((prev) => {
      const next = [...prev];
      const target = { ...next[index] };

      if (['kills', 'deaths', 'assists', 'vision', 'damage_dealt', 'damage_taken', 'heal_shield', 'objective_damage', 'cs', 'gold', 'penta_kills'].includes(field)) {
        (target as any)[field] = Number(value) || 0;
      } else {
        (target as any)[field] = value;
      }

      // OCR修正の自動学習
      if (field === 'name' && target.raw_ocr_name && value && target.raw_ocr_name !== value) {
        saveOcrAlias(target.raw_ocr_name, value);
      }

      next[index] = target;
      return next;
    });
  };

  // チャンピオン読み込み
  const loadChampions = async () => {
    try {
      const res = await fetch('/api/riot/champions');
      const data = await res.json();
      if (res.ok && data.champions) {
        setChampionsList(data.champions);
      } else {
        throw new Error(data.error || '一覧を取得できませんでした');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: `チャンピオン一覧の読み込み失敗: ${msg}` });
    }
  };

  useEffect(() => {
    loadChampions();
    fetch('/api/players/list')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.players && Array.isArray(data.players)) {
          setPlayersPool(data.players.map((p: any) => ({ name: p.name, ign: p.ign })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // バランサー結果の適用
  const applyBalancerResult = (br: any) => {
    if (!br || (!br.teamBlue && !br.teamRed)) return false;
    setStats(() => {
      const initial: PlayerStat[] = [];
      ROLES.forEach((role) => {
        const pb = br.teamBlue?.find((p: any) => (p.currentRole || p.role) === role);
        initial.push({
          name: pb ? pb.name : '',
          team: 'BLUE',
          currentRole: role,
          kills: 0,
          deaths: 0,
          assists: 0,
          vision: 0,
          champion_name: '',
          damage_dealt: 0,
          damage_taken: 0,
          heal_shield: 0,
          objective_damage: 0,
          cs: 0,
        });
      });
      ROLES.forEach((role) => {
        const pr = br.teamRed?.find((p: any) => (p.currentRole || p.role) === role);
        initial.push({
          name: pr ? pr.name : '',
          team: 'RED',
          currentRole: role,
          kills: 0,
          deaths: 0,
          assists: 0,
          vision: 0,
          champion_name: '',
          damage_dealt: 0,
          damage_taken: 0,
          heal_shield: 0,
          objective_damage: 0,
          cs: 0,
        });
      });
      return initial;
    });
    return true;
  };

  // 初期ロード時のチーム分け復元
  useEffect(() => {
    if (pendingId) {
      fetch(`/api/balancer/pending?id=${pendingId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.balanceResult) {
            applyBalancerResult(data.balanceResult);
            setMessage({ type: 'success', text: '✅ バランサーのチーム分け編成（10名）を自動ロードしました！' });
          }
        })
        .catch(console.error);
    } else {
      try {
        const cached = localStorage.getItem('balancer_last_result');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.teamBlue || parsed.teamRed)) {
            applyBalancerResult(parsed);
            setMessage({ type: 'success', text: '⚡ 直前のチーム分け構成（10名）を自動反映しました！' });
          }
        }
      } catch (e) {
        console.error('Failed to load cached balancer result:', e);
      }
    }
  }, [pendingId]);

  // BLUE ⇄ RED 陣営入替
  const handleSwapTeams = () => {
    setStats((prev) => {
      const next = [...prev];
      for (let i = 0; i < 5; i++) {
        const blueIdx = i;
        const redIdx = i + 5;
        const blueStat = { ...next[blueIdx], team: 'RED' as const };
        const redStat = { ...next[redIdx], team: 'BLUE' as const };
        next[blueIdx] = redStat;
        next[redIdx] = blueStat;
      }
      return next;
    });
    setWinningTeam((prev) => (prev === 'BLUE' ? 'RED' : prev === 'RED' ? 'BLUE' : null));
    setMessage({ type: 'success', text: '🔁 BLUE陣営とRED陣営を反転しました！' });
  };

  const handleRestoreCachedBalancer = () => {
    try {
      const cached = localStorage.getItem('balancer_last_result');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (applyBalancerResult(parsed)) {
          setMessage({ type: 'success', text: '⚡ 直前のチーム分け構成（10人）を反映しました！' });
          return;
        }
      }
      setMessage({ type: 'error', text: '直前のチーム分け情報が見つかりませんでした。' });
    } catch {
      setMessage({ type: 'error', text: 'チーム分け情報の読み込みに失敗しました。' });
    }
  };

  // 試合結果の送信・保存
  const handleSubmit = async () => {
    if (!winningTeam) {
      setMessage({ type: 'error', text: '勝利チームを選択してください。' });
      return;
    }

    const unselected = stats.find((s) => !s.name);
    if (unselected) {
      setMessage({ type: 'error', text: `全員のプレイヤー名を入力してください。（${unselected.team} ${unselected.currentRole} が未選択）` });
      return;
    }

    const uniqueNames = new Set(stats.map((s) => s.name));
    if (uniqueNames.size < 10) {
      setMessage({ type: 'error', text: '同じプレイヤーが重複して登録されています。10人全員別のプレイヤーを選択してください。' });
      return;
    }

    if (!userLoading && !user?.isAdmin) {
      setMessage({
        type: 'error',
        text: '試合結果の保存には管理者権限が必要です。右上の「ログインする」から管理者アカウントでログインしてください。',
      });
      toast.error('管理者権限が必要です');
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const parsedDuration = parseDurationText(durationText);
      const res = await fetch('/api/match/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          winningTeam,
          winning_team: winningTeam,
          gameDuration: parsedDuration,
          match_duration: parsedDuration,
          isFinalMatch,
          participants: stats.map((s) => ({
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
            cs: s.cs,
            penta_kills: s.penta_kills || 0,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存に失敗しました');

      if (pendingId) {
        await fetch(`/api/balancer/pending?id=${pendingId}`, { method: 'DELETE' }).catch(() => {});
      }

      // 直前の試合結果とMMR変動サマリーをsessionStorageへ一時保管（バランサー側でハイライト表示）
      try {
        if (typeof window !== 'undefined' && Array.isArray(data.updates)) {
          sessionStorage.setItem('ktm_last_match_result', JSON.stringify({
            matchId: data.matchId,
            winningTeam,
            updates: data.updates.map((u: any) => ({
              name: u.name,
              team: u.team,
              role: u.role,
              champion_name: u.champion_name,
              mmrDelta: u.mmrDelta || 0,
              newMmr: u.newMmr || u.currentMmr || 0,
            })),
            recordedAt: Date.now(),
          }));
        }
      } catch {}

      toast.success('✅ 試合結果を記録し、MMRを更新しました！');
      setMessage({ type: 'success', text: '✅ 試合結果を記録し、MMRを更新しました！（チーム分け画面へ戻ります）' });
      setDurationText('');

      setTimeout(() => {
        router.push('/balancer?recorded=1');
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: `保存エラー: ${msg}` });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground-soft p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <CustomSubNav />

        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground flex items-center gap-3">
            <Trophy className="h-7 w-7 md:h-8 md:w-8 text-success-600" />
            カスタム試合を手動記録
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSwapTeams}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-subtle hover:bg-surface-hover text-foreground-soft font-bold text-xs border border-border transition cursor-pointer"
              title="Blue側5人とRed側5人のプレイヤー・スコア・勝敗選択を丸ごと反転します"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-primary-600" />
              <span>🔁 陣営入替 (Blue ⇄ Red)</span>
            </button>
            <button
              type="button"
              onClick={handleRestoreCachedBalancer}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              title="直前にバランサーで決定した10人の編成を一括自動入力します"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>⚡ 直前のチーム分け構成（10人）を反映</span>
            </button>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl">
          {!userLoading && !user?.isAdmin && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="font-black text-white">
                    ⚠️ 試合結果の保存には「管理者権限」が必要です
                  </div>
                  <div className="text-[11px] text-stone-300 mt-0.5">
                    {user
                      ? `現在 @${user.displayName || user.username} でログイン中（一般権限）。管理者のDiscordアカウントで再ログインしてください。`
                      : '現在未ログインです。管理者のDiscordアカウントでログインしてください。'}
                  </div>
                </div>
              </div>
              <Link
                href={`/login?returnTo=${encodeURIComponent('/balancer/record' + (pendingId ? `?pending_id=${pendingId}` : ''))}`}
                className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <LogIn size={14} />
                <span>管理者ログイン</span>
              </Link>
            </div>
          )}

          {message.text && (
            <div
              className={`mb-6 p-4 rounded-lg text-sm font-bold border ${
                message.type === 'success'
                  ? 'bg-success-100 text-success-700 border-success-edge-soft'
                  : 'bg-primary-100 border-primary-edge-soft text-primary-700'
              }`}
            >
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
                ? 'border-success-edge-strong bg-success-50 text-success-700'
                : 'border-border bg-black/3 text-muted-strong hover:border-border hover:bg-black/5'
            }`}
          >
            {analyzing ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <RefreshCw className="h-10 w-10 text-success-600 animate-spin" />
                <span className="text-sm font-bold text-success-700 animate-pulse">Gemini APIで対戦結果画像を解析中...</span>
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
                  <Target className="h-12 w-12 text-success-500 animate-pulse" />
                </div>
                <p className="font-bold text-foreground mb-1 text-base">スクリーンショット画像を貼り付け (Ctrl+V)</p>
                <p className="text-xs text-muted-strong mb-1">または、ここにファイルをドラッグ＆ドロップ / クリックして選択</p>
                <p className="text-[11px] text-primary font-semibold">
                  💡 対戦後リザルト画面のほか、インゲーム観戦スコアボード（TAB画面）のスクショもそのまま貼り付け可能です
                </p>
              </div>
            )}
          </div>

          {/* チーム入力グリッド */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <TeamStatsTable
              team="BLUE"
              indices={[0, 1, 2, 3, 4]}
              stats={stats}
              playersPool={playersPool}
              championsList={championsList}
              onStatChange={handleStatChangeByIndex}
              onOpenChampSelector={(team, role, slotIndex) => setActiveChampSelector({ team, role, slotIndex })}
            />
            <TeamStatsTable
              team="RED"
              indices={[5, 6, 7, 8, 9]}
              stats={stats}
              playersPool={playersPool}
              championsList={championsList}
              onStatChange={handleStatChangeByIndex}
              onOpenChampSelector={(team, role, slotIndex) => setActiveChampSelector({ team, role, slotIndex })}
            />
          </div>

          {/* 試合結果コントロール（勝敗・時間・最終戦・送信） */}
          <MatchSummaryControls
            winningTeam={winningTeam}
            onSelectWinningTeam={setWinningTeam}
            durationText={durationText}
            onChangeDurationText={setDurationText}
            isFinalMatch={isFinalMatch}
            onChangeIsFinalMatch={setIsFinalMatch}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      {/* チャンピオン選択モーダル */}
      {activeChampSelector && (
        <ChampionSelectorModal
          activeSelector={activeChampSelector}
          championsList={championsList}
          onSelect={(slotIndex, championId) => handleStatChangeByIndex(slotIndex, 'champion_name', championId)}
          onClose={() => setActiveChampSelector(null)}
          onReloadChampions={loadChampions}
        />
      )}
    </div>
  );
}

export default function CustomRecordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        </div>
      }
    >
      <CustomRecordPageContent />
    </Suspense>
  );
}
