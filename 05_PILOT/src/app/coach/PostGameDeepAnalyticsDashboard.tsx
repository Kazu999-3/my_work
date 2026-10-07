'use client';

import LiteMarkdown from "@/components/LiteMarkdown";
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getChampIcon } from '@/lib/ddragonClient';
import { AlertCircle, RefreshCw, Layers, Activity, Zap, BarChart3, Eye, Info, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import type { PostgameTempoReport } from '@/lib/postgameTempo';
import PostGameTempoSections from './PostGameTempoSections';
import TargetComparisonCard from './TargetComparisonCard';
import PostGameReflectionForm from './PostGameReflectionForm';

// 試合後: 詳細分析（2026-10-05 全面見直し）
// 旧版はリコールのテンポ損失・ワード監査の採点・ランク水準ラベル・「最重要改善アクション」など、
// 実データを見ていない数値や定型文を表示していた。ここでは試合データに実在する数値だけを
// 対面と並べて出し、良し悪しの判断はプレイヤーに委ねる。
// 2026-10-06: 「試合後: テンポ」タブを統合し、15分テンポ逆再生・帰還・ビルド監査もこの下に表示する。

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
  vision_per_min: number;
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
  game_duration_sec: number;
  my_cs: number;
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
  tempo: PostgameTempoReport | null;
  tempo_error: string | null;
  timeline_error: string | null;
  auto_review: { weaknesses: string[]; focus: string | null; advice: string; created_at: string } | null;
  role_recent: {
    count: number;
    avg: Record<'cs_per_min' | 'deaths' | 'vision_per_min' | 'kill_participation' | 'damage_share' | 'control_wards_bought', number | null>;
  };
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

  const currentMatchId = controlledMatchId || internalMatchId;
  // 2026-10-08: ユーザー要望で最初から開いた状態にする（以前は閉じた状態で始まっていた）
  const [reviewExpanded, setReviewExpanded] = useState(true);

  const fetchAnalytics = async (matchId?: string) => {
    setSwitching(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (matchId) params.set('matchId', matchId);
      if (summonerName) params.set('summoner', summonerName);
      if (puuid) params.set('puuid', puuid);
      const res = await fetch(`/api/lol/postgame-deep-analytics?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || json.error || !json.success) throw new Error(json.error || '解析データの取得に失敗しました');
      setData(json);
      setReviewExpanded(false);
      if (!internalMatchId && json.selected_match_id) setInternalMatchId(json.selected_match_id);
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

      {/* 自動振り返り（ソロQ試合後の通知と同じ内容） */}
      {data.auto_review && (
        <div className="bg-stone-950 border border-amber-800/60 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black text-stone-100 flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-amber-400" />
              AIの自動振り返り
            </span>
            <span className="text-[10px] text-stone-500">
              {new Date(data.auto_review.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 作成（通知と同じ内容）
            </span>
          </div>
          {data.auto_review.weaknesses.length > 0 && (
            <p className="text-[11px]"><span className="font-bold text-rose-400">弱点: </span><span className="text-stone-300">{data.auto_review.weaknesses.join(' / ')}</span></p>
          )}
          {data.auto_review.focus && (
            <p className="text-[11px]"><span className="font-bold text-amber-300">次に意識すること: </span><span className="text-stone-300">{data.auto_review.focus}</span></p>
          )}
          <LiteMarkdown
            text={data.auto_review.advice}
            className={`text-[11px] text-stone-300 leading-relaxed space-y-0.5 ${reviewExpanded ? '' : 'max-h-20 overflow-hidden'}`}
          />
          <button
            type="button"
            onClick={() => setReviewExpanded((v) => !v)}
            className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            {reviewExpanded ? <><ChevronUp className="w-3 h-3" /> 折りたたむ</> : <><ChevronDown className="w-3 h-3" /> 全文を表示</>}
          </button>
        </div>
      )}

      {/* 目標ランク平均との比較 */}
      <TargetComparisonCard
        role={data.my_position}
        thisMatch={{
          cs_per_min: sm.me.cs_per_min,
          cs_at_15: lane && lane.minute === 15 ? lane.me.cs : null,
          deaths: sm.me.deaths,
          vision_per_min: sm.me.vision_per_min,
          kill_participation: sm.me.kill_participation,
          damage_share: sm.me.damage_share,
          control_wards_bought: sm.me.control_wards_bought,
        }}
        recentAvg={data.role_recent.avg}
        recentCount={data.role_recent.count}
      />

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
              {data.timeline_available ? 'この試合のタイムラインに自分のデータがありませんでした。' : `この試合のタイムラインを取得できませんでした（${data.timeline_error || '理由不明'}）。`}
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
              {data.timeline_available ? 'この試合ではコントロールワードを購入していません。' : 'タイムラインを取得できなかったため不明です（上のレーン戦の欄に理由を表示）。'}
            </p>
          )}
        </div>

      </div>

      {/* 15分テンポ逆再生・帰還テンポ・ビルド監査（旧「テンポ」タブ） */}
      {data.tempo ? (
        <PostGameTempoSections report={data.tempo} />
      ) : (
        <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-[11px] text-stone-400 flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          テンポ逆再生・帰還・ビルド監査を表示できません（{data.tempo_error || '理由不明'}）。
        </div>
      )}

      {/* 2026-10-08: 集団戦レビューはユーザー判断で外した */}

      {/* この試合の振り返り（旧「振り返りノート」タブ） */}
      <PostGameReflectionForm
        matchId={data.selected_match_id}
        champion={data.my_champion}
        enemyChampion={data.enemy_champion}
        isWin={data.is_win}
        kda={data.kda_str}
        cs={data.my_cs}
        gameDurationSec={data.game_duration_sec}
      />
    </div>
  );
}
