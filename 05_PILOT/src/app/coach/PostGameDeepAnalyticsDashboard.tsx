'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getChampIcon } from '@/lib/ddragonClient';
import { AlertCircle, RefreshCw, Layers, Activity, Zap, BarChart3, Eye, Rewind, CheckCircle2 } from 'lucide-react';

// 試合後: 詳細分析（2026-10-05 全面見直し）
// 旧版はリコールのテンポ損失・ワード監査の採点・ランク水準ラベル・「最重要改善アクション」など、
// 実データを見ていない数値や定型文を表示していた。ここでは試合データに実在する数値だけを
// 対面と並べて出し、良し悪しの判断はプレイヤーに委ねる。リコール/ビルドは「テンポ」タブが担当。

interface RecentMatchMeta {
  matchId: string;
  championName: string;
  isWin: boolean;
  kdaStr: string;
  gameDurationStr: string;
  gameStartTimestamp: number;
}

interface LaneSide { cs: number; gold: number; xp: number; level: number }

interface MatchStats {
  cs_per_min: number;
  gold_earned: number;
  damage_to_champions: number;
  damage_share: number;
  kill_participation: number;
  deaths: number;
  vision_score: number;
  wards_placed: number;
  wards_killed: number;
  control_wards_bought: number;
}

interface PostGameData {
  success: boolean;
  selected_match_id: string;
  recent_matches: RecentMatchMeta[];
  cross_match_summary: {
    total_matches: number;
    wins: number;
    win_rate: number;
    avg_kda: string;
    avg_cs_per_min: number;
    avg_vision_score: number;
  };
  my_champion: string;
  enemy_champion: string | null;
  my_position: string;
  is_win: boolean;
  match_duration_str: string;
  kda_str: string;
  timeline_available: boolean;
  lane_snapshot: {
    minute: number;
    me: LaneSide;
    enemy: LaneSide | null;
    gold_diff: number | null;
    cs_diff: number | null;
    xp_diff: number | null;
    lane_result: string;
    thresholds: { big: number; small: number };
  } | null;
  match_stats: { me: MatchStats; enemy: MatchStats | null };
  control_ward_times: string[];
}

interface PostGameDashboardProps {
  controlledMatchId?: string;
  onSelectMatchId?: (mId: string) => void;
  summonerName?: string;
  puuid?: string;
}

const POSITION_LABEL: Record<string, string> = {
  TOP: 'TOP', JUNGLE: 'JG', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP',
};

const COMPARE_ROWS: { key: keyof MatchStats; label: string; unit?: string; lowerIsBetter?: boolean }[] = [
  { key: 'cs_per_min', label: 'CS/分' },
  { key: 'gold_earned', label: '獲得ゴールド', unit: 'G' },
  { key: 'damage_to_champions', label: 'チャンピオンへの与ダメージ' },
  { key: 'damage_share', label: 'チーム内ダメージ割合', unit: '%' },
  { key: 'kill_participation', label: 'キル関与率', unit: '%' },
  { key: 'deaths', label: 'デス', lowerIsBetter: true },
  { key: 'vision_score', label: '視界スコア' },
  { key: 'wards_placed', label: 'ワード設置' },
  { key: 'wards_killed', label: 'ワード破壊' },
  { key: 'control_wards_bought', label: 'コントロールワード購入' },
];

const signed = (v: number) => (v > 0 ? `+${v.toLocaleString()}` : v.toLocaleString());
const diffColor = (v: number | null) => (v == null || v === 0 ? 'text-stone-300' : v > 0 ? 'text-emerald-400' : 'text-rose-400');

export default function PostGameDeepAnalyticsDashboard({
  controlledMatchId,
  onSelectMatchId,
  summonerName,
  puuid,
}: PostGameDashboardProps = {}) {
  const [data, setData] = useState<PostGameData | null>(null);
  const [internalMatchId, setInternalMatchId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [memoText, setMemoText] = useState('');
  const [savedMemo, setSavedMemo] = useState('');
  const [savingMemo, setSavingMemo] = useState(false);
  const [memoStatus, setMemoStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const currentMatchId = controlledMatchId || internalMatchId;

  const fetchMemo = async (mId: string) => {
    try {
      const res = await fetch(`/api/lol/match-memo?matchId=${encodeURIComponent(mId)}`);
      const d = await res.json();
      const memo = d.success ? d.memo || '' : '';
      setMemoText(memo);
      setSavedMemo(memo);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAnalytics = async (matchId?: string) => {
    setSwitching(true);
    setError(null);
    setMemoStatus(null);
    setSyncStatus(null);
    try {
      const params = new URLSearchParams();
      if (matchId) params.set('matchId', matchId);
      if (summonerName) params.set('summoner', summonerName);
      if (puuid) params.set('puuid', puuid);
      const res = await fetch(`/api/lol/postgame-deep-analytics?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || json.error || !json.success) throw new Error(json.error || '解析データの取得に失敗しました');
      setData(json);
      if (!internalMatchId && json.selected_match_id) setInternalMatchId(json.selected_match_id);
      fetchMemo(json.selected_match_id);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'データ取得エラー');
    } finally {
      setLoading(false);
      setSwitching(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(currentMatchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatchId]);

  const handleSelect = (mId: string) => {
    if (onSelectMatchId) onSelectMatchId(mId);
    else setInternalMatchId(mId);
  };

  const handleSaveMemo = async () => {
    if (!data) return;
    setSavingMemo(true);
    setMemoStatus(null);
    try {
      const res = await fetch('/api/lol/match-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: data.selected_match_id,
          memo: memoText,
          summoner: summonerName,
          champion: data.my_champion,
          enemyChampion: data.enemy_champion,
          isWin: data.is_win,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || '保存に失敗しました');
      setSavedMemo(memoText);
      setMemoStatus({ ok: true, text: '保存しました' });
    } catch (e: any) {
      setMemoStatus({ ok: false, text: e.message || '保存に失敗しました' });
    } finally {
      setSavingMemo(false);
    }
  };

  // 自分で書いたメモだけを対面メモへ送る。旧版は自動生成の定型アドバイスを送っており、
  // 対面に関係ない文面が matchup_sentinel に溜まっていた(2026-10-05 変更)。
  const handleSyncMemo = async () => {
    if (!data || !data.enemy_champion || !savedMemo.trim()) return;
    setSyncing(true);
    setSyncStatus(null);
    try {
      const res = await fetch('/api/lol/sync-match-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myChampion: data.my_champion,
          enemyChampion: data.enemy_champion,
          keyLearning: savedMemo.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || '同期に失敗しました');
      setSyncStatus({ ok: true, text: d.message || '対面メモへ保存しました' });
    } catch (e: any) {
      setSyncStatus({ ok: false, text: e.message || '同期に失敗しました' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-5 md:p-6 animate-pulse space-y-4">
        <div className="h-5 bg-stone-800 rounded w-1/3" />
        <div className="h-20 bg-stone-900 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-44 bg-stone-900 rounded-xl" />
          <div className="h-44 bg-stone-900 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-5 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <h4 className="text-sm font-bold text-stone-100">試合後の詳細分析</h4>
        <p className="text-xs text-stone-400 max-w-md mx-auto">
          {error || '直近のランク戦データが見つかりませんでした。'}
        </p>
        <button
          onClick={() => fetchAnalytics(currentMatchId)}
          className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
        >
          <RefreshCw size={12} />
          <span>再読み込み</span>
        </button>
      </div>
    );
  }

  const lane = data.lane_snapshot;
  const sm = data.match_stats;
  const pos = POSITION_LABEL[data.my_position] || data.my_position;
  const cms = data.cross_match_summary;
  const memoDirty = memoText !== savedMemo;

  return (
    <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-5 md:p-6 text-stone-100 space-y-6">
      {/* 直近の試合選択 */}
      {data.recent_matches.length > 0 && (
        <div className="space-y-2.5">
          <h4 className="text-xs font-black text-stone-200 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>直近のソロQ（{data.recent_matches.length}試合）</span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {data.recent_matches.map((m, idx) => {
              const isSelected = data.selected_match_id === m.matchId;
              const d = new Date(m.gameStartTimestamp);
              const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
              return (
                <button
                  key={m.matchId}
                  type="button"
                  onClick={() => handleSelect(m.matchId)}
                  disabled={switching}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-stone-800 border-amber-500/70 ring-1 ring-amber-500/50'
                      : m.isWin
                      ? 'bg-emerald-950/30 border-emerald-800/60 hover:border-emerald-600/60'
                      : 'bg-rose-950/30 border-rose-800/60 hover:border-rose-600/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-black px-1.5 rounded font-mono text-white ${m.isWin ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                      {m.isWin ? 'WIN' : 'LOSS'}
                    </span>
                    <span className="text-[9px] font-mono text-stone-500">{timeStr}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Image
                      src={getChampIcon(m.championName)}
                      alt={m.championName}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full border border-stone-700 shrink-0"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <span className="text-[11px] font-black truncate">{m.championName}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                    <span className="font-bold">{m.kdaStr}</span>
                    <span>{m.gameDurationStr}</span>
                  </div>
                  <span className="sr-only">#{idx + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 直近の通算 */}
      {cms.total_matches > 1 && (
        <div className="bg-stone-950/60 border border-stone-800 rounded-xl p-3 flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px]">
          <span className="font-black text-stone-200 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-amber-400" />
            直近{cms.total_matches}試合
          </span>
          <span className="text-stone-300 font-mono">
            {cms.wins}勝{cms.total_matches - cms.wins}敗（
            <strong className={cms.win_rate >= 50 ? 'text-emerald-400' : 'text-rose-400'}>{cms.win_rate}%</strong>）
          </span>
          <span className="text-stone-300 font-mono">平均KDA {cms.avg_kda}</span>
          <span className="text-stone-300 font-mono">平均CS/分 {cms.avg_cs_per_min}</span>
          <span className="text-stone-300 font-mono">平均視界 {cms.avg_vision_score}</span>
        </div>
      )}

      {/* 選択中の試合ヘッダー */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-[10px] font-black text-white ${data.is_win ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            {data.is_win ? 'VICTORY' : 'DEFEAT'}
          </span>
          <span className="bg-stone-900 px-2 py-0.5 rounded border border-stone-800 text-stone-200 text-xs font-bold flex items-center gap-1.5">
            <Image
              src={getChampIcon(data.my_champion)}
              alt={data.my_champion}
              width={16}
              height={16}
              className="w-4 h-4 rounded-full"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            {data.my_champion}
            {data.enemy_champion && <span className="text-stone-400">vs {data.enemy_champion}</span>}
            <span className="text-stone-500 font-mono text-[10px]">({pos})</span>
          </span>
          <span className="text-xs font-mono text-stone-400">KDA {data.kda_str}</span>
          <span className="text-xs font-mono text-stone-400">{data.match_duration_str}</span>
          {switching && (
            <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
              <RefreshCw size={12} className="animate-spin" /> 読み込み中...
            </span>
          )}
        </div>
        <button
          onClick={() => fetchAnalytics(currentMatchId)}
          title="再読み込み"
          className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-100 transition"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. レーン戦 */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black text-stone-100 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              {lane ? `${lane.minute}分時点の対面比較` : 'レーン戦（15分時点）'}
            </span>
            {lane && (
              <span className={`text-[11px] font-black px-2 py-0.5 rounded border ${
                lane.gold_diff == null ? 'text-stone-300 bg-stone-900 border-stone-700'
                : lane.gold_diff >= lane.thresholds.small ? 'text-emerald-400 bg-emerald-950/30 border-emerald-800/60'
                : lane.gold_diff > -lane.thresholds.small ? 'text-stone-200 bg-stone-900 border-stone-700'
                : 'text-rose-400 bg-rose-950/30 border-rose-800/60'
              }`}>
                {lane.lane_result}
              </span>
            )}
          </div>

          {!lane ? (
            <p className="text-[11px] text-stone-400">
              {data.timeline_available ? 'この試合のタイムラインに自分のデータがありませんでした。' : 'この試合のタイムラインを取得できませんでした。'}
            </p>
          ) : (
            <>
              {lane.minute < 15 && (
                <p className="text-[10px] text-amber-300">試合が15分より前に終わったため、{lane.minute}分時点の値です。</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="text-stone-500 text-[10px]">
                      <th className="text-left font-bold py-1"></th>
                      <th className="text-right font-bold py-1">自分</th>
                      <th className="text-right font-bold py-1">{data.enemy_champion || '対面'}</th>
                      <th className="text-right font-bold py-1">差</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ['CS', 'cs', lane.cs_diff],
                      ['ゴールド', 'gold', lane.gold_diff],
                      ['経験値', 'xp', lane.xp_diff],
                      ['レベル', 'level', lane.enemy ? lane.me.level - lane.enemy.level : null],
                    ] as const).map(([label, key, diff]) => (
                      <tr key={key} className="border-t border-stone-800/60">
                        <td className="py-1.5 text-stone-400 font-sans font-bold">{label}</td>
                        <td className="py-1.5 text-right text-stone-100">{lane.me[key].toLocaleString()}</td>
                        <td className="py-1.5 text-right text-stone-400">{lane.enemy ? lane.enemy[key].toLocaleString() : '-'}</td>
                        <td className={`py-1.5 text-right font-bold ${diffColor(diff)}`}>{diff == null ? '-' : signed(diff)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-stone-500">
                判定はゴールド差の目安です（±{lane.thresholds.small}G 未満でほぼ互角、±{lane.thresholds.big}G 以上で「大きく」）。
              </p>
            </>
          )}
        </div>

        {/* 2. 試合全体の対面比較 */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
          <span className="text-xs font-black text-stone-100 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            試合全体の対面比較
          </span>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-stone-500 text-[10px]">
                  <th className="text-left font-bold py-1"></th>
                  <th className="text-right font-bold py-1">自分</th>
                  <th className="text-right font-bold py-1">{data.enemy_champion || '対面'}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => {
                  const mine = sm.me[row.key];
                  const theirs = sm.enemy ? sm.enemy[row.key] : null;
                  const better = theirs == null || mine === theirs ? null : row.lowerIsBetter ? mine < theirs : mine > theirs;
                  return (
                    <tr key={row.key} className="border-t border-stone-800/60">
                      <td className="py-1.5 text-stone-400 font-sans font-bold">{row.label}</td>
                      <td className={`py-1.5 text-right font-bold ${better == null ? 'text-stone-100' : better ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {mine.toLocaleString()}{row.unit || ''}
                      </td>
                      <td className="py-1.5 text-right text-stone-400">
                        {theirs == null ? '-' : `${theirs.toLocaleString()}${row.unit || ''}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!sm.enemy && <p className="text-[10px] text-stone-500">敵チームに同じポジションのプレイヤーが見つからなかったため、自分の値のみ表示しています。</p>}
        </div>

        {/* 3. コントロールワード購入時刻 */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-2">
          <span className="text-xs font-black text-stone-100 flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-amber-400" />
            コントロールワードの購入時刻
          </span>
          {data.control_ward_times.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {data.control_ward_times.map((t, i) => (
                <span key={i} className="text-[11px] font-mono font-bold bg-stone-900 text-stone-200 px-2 py-0.5 rounded border border-stone-800">
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-stone-400">
              {data.timeline_available ? 'この試合ではコントロールワードを購入していません。' : 'タイムラインを取得できなかったため不明です。'}
            </p>
          )}
        </div>

        {/* 4. テンポタブへの導線 */}
        <Link
          href={`/coach?tab=tempo&matchId=${encodeURIComponent(data.selected_match_id)}`}
          className="bg-stone-950 border border-stone-800 hover:border-amber-700/60 rounded-xl p-4 space-y-1 transition block"
        >
          <span className="text-xs font-black text-stone-100 flex items-center gap-1.5">
            <Rewind className="w-4 h-4 text-amber-400" />
            リコール・ビルドの分析は「🔁 試合後: テンポ」へ
          </span>
          <p className="text-[11px] text-stone-400">
            帰還ごとの所持金・購入品・前後のゴールド差の変化と、ビルドのチェックをこの試合で開きます。
          </p>
        </Link>
      </div>

      {/* 試合メモ ＆ 対面メモへの同期 */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-black text-stone-100">📝 この試合のメモ</span>
          {memoStatus && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
              memoStatus.ok ? 'text-emerald-400 bg-emerald-950/30 border-emerald-800/60' : 'text-rose-400 bg-rose-950/30 border-rose-800/60'
            }`}>
              {memoStatus.text}
            </span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            placeholder="例: 6レベル前にオールインされた。対面のレベル6を意識して下がる"
            className="flex-1 px-3.5 py-2.5 bg-stone-900/60 border border-stone-800 rounded-xl text-xs text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={handleSaveMemo}
            disabled={savingMemo || !memoDirty}
            className="px-4 py-2.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer shrink-0"
          >
            {savingMemo ? '保存中...' : '💾 メモを保存'}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-stone-800">
          <p className="text-[11px] text-stone-400">
            保存したメモを {data.enemy_champion ? `「${data.my_champion} vs ${data.enemy_champion}」の` : ''}対面メモへ追記します。次にこの対面と当たった時の試合前タブに表示されます。
          </p>
          <button
            type="button"
            onClick={handleSyncMemo}
            disabled={syncing || !data.enemy_champion || !savedMemo.trim() || memoDirty || syncStatus?.ok}
            title={!savedMemo.trim() ? '先にメモを保存してください' : memoDirty ? '変更を保存してから同期してください' : undefined}
            className="px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer bg-stone-800 hover:bg-stone-700 text-stone-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {syncing ? '同期中...' : syncStatus?.ok ? '同期済み' : 'メモを対面メモへ同期'}
          </button>
        </div>
        {syncStatus && (
          <p className={`text-[11px] font-bold ${syncStatus.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{syncStatus.text}</p>
        )}
      </div>
    </div>
  );
}
